import ExpoModulesCore
import Darwin

// Opens MobileVLCKit at runtime. Returns nil on success, or the dyld error.
enum VlcLoader {
  static var path: String { (Bundle.main.privateFrameworksPath ?? "") + "/MobileVLCKit.framework/MobileVLCKit" }
  static var embedded: Bool { FileManager.default.fileExists(atPath: path) }
  private static var result: String??
  static func load() -> String? {
    if let r = result { return r }
    var err: String? = nil
    if !embedded { err = "MobileVLCKit not embedded" }
    else if dlopen(path, RTLD_NOW) == nil { err = String(cString: dlerror()) }
    else if NSClassFromString("VLCMediaPlayer") == nil { err = "VLCMediaPlayer class missing" }
    result = .some(err)
    return err
  }
}

// VLC video view driven through the Objective-C runtime (no compile-time VLCKit import).
class MVlcView: ExpoView {
  let onStatus = EventDispatcher()
  let onTime = EventDispatcher()
  let onTracks = EventDispatcher()
  let onPlaying = EventDispatcher()

  private let videoView = UIView()
  private var player: NSObject?
  private var timer: Timer?
  private var uri: String?
  private var paused = false
  private var didStart = false
  private var lastState = -1
  private var lastPlaying: Bool?
  private var lastTracksKey = ""
  var startAt: Double = 0

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    clipsToBounds = true
    backgroundColor = .black
    videoView.backgroundColor = .black
    addSubview(videoView)
    // VLC draws with OpenGL ES, which iOS forbids in the background (the app is killed). Pause natively the moment
    // we leave the foreground (JS may already be suspended), resume on return if we paused it.
    NotificationCenter.default.addObserver(self, selector: #selector(appBackground), name: UIApplication.didEnterBackgroundNotification, object: nil)
    NotificationCenter.default.addObserver(self, selector: #selector(appForeground), name: UIApplication.willEnterForegroundNotification, object: nil)
  }

  private var pausedForBackground = false
  @objc private func appBackground() {
    guard let p = player, isPlaying else { return }
    pausedForBackground = true
    p.perform(NSSelectorFromString("pause"))
  }
  @objc private func appForeground() {
    guard pausedForBackground else { return }
    pausedForBackground = false
    if !paused, let p = player, p.value(forKey: "media") != nil { p.perform(NSSelectorFromString("play")) }
  }

  // "cover": VLC always letterboxes inside its drawable, so the drawable is scaled up until the video fills the view.
  private var cover = false
  func setFit(_ fit: String) { cover = (fit == "cover"); applyFit() }
  private func applyFit() {
    var scale: CGFloat = 1
    if cover, let p = player, p.responds(to: NSSelectorFromString("videoSize")), let v = p.value(forKey: "videoSize") as? NSValue {
      let vs = v.cgSizeValue
      if vs.width > 0, vs.height > 0, bounds.width > 0, bounds.height > 0 {
        let a = bounds.width / vs.width, b = bounds.height / vs.height
        scale = max(a, b) / min(a, b)
      }
    }
    if abs(videoView.transform.a - scale) > 0.001 { videoView.transform = CGAffineTransform(scaleX: scale, y: scale) }
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    let t = videoView.transform
    videoView.transform = .identity
    videoView.frame = bounds
    videoView.transform = t
    applyFit()
  }

  deinit {
    NotificationCenter.default.removeObserver(self)
    timer?.invalidate()
    player?.perform(NSSelectorFromString("stop"))
  }

  private func ensurePlayer() -> NSObject? {
    if let p = player { return p }
    if let err = VlcLoader.load() {
      onStatus(["status": "error", "error": "VLC: \(err)"])
      return nil
    }
    guard let cls = NSClassFromString("VLCMediaPlayer") as? NSObject.Type else { return nil }
    let p = cls.init()
    p.setValue(videoView, forKey: "drawable")
    player = p
    timer = Timer.scheduledTimer(withTimeInterval: 0.25, repeats: true) { [weak self] _ in self?.tick() }
    return p
  }

  func setUri(_ u: String?) {
    guard u != uri else { return }
    uri = u
    guard let u = u, let url = URL(string: u) else { player?.perform(NSSelectorFromString("stop")); return }
    guard let p = ensurePlayer() else { return }
    p.perform(NSSelectorFromString("stop"))
    didStart = false
    lastTracksKey = ""
    guard let mcls = NSClassFromString("VLCMedia") as? NSObject.Type,
          let media = mcls.perform(NSSelectorFromString("mediaWithURL:"), with: url)?.takeUnretainedValue() as? NSObject else {
      onStatus(["status": "error", "error": "VLC: VLCMedia unavailable"]); return
    }
    media.perform(NSSelectorFromString("addOptions:"), with: ["network-caching": 3000, "http-reconnect": true])
    p.setValue(media, forKey: "media")
    onStatus(["status": "loading"])
    if !paused { p.perform(NSSelectorFromString("play")) }
  }

  private var isPlaying: Bool { (player?.value(forKey: "playing") as? Bool) ?? false }

  func setPaused(_ pz: Bool) {
    paused = pz
    guard let p = player else { return }
    if pz { if isPlaying { p.perform(NSSelectorFromString("pause")) } }
    else if p.value(forKey: "media") != nil && !isPlaying { p.perform(NSSelectorFromString("play")) }
  }

  func setRate(_ r: Double) { player?.setValue(NSNumber(value: Float(r)), forKey: "rate") }

  private func ms(_ t: Any?) -> Double {
    guard let o = t as? NSObject, let n = o.value(forKey: "intValue") as? NSNumber else { return 0 }
    return n.doubleValue
  }

  func seek(_ sec: Double) {
    guard let p = player, let tcls = NSClassFromString("VLCTime") as? NSObject.Type,
          let t = tcls.perform(NSSelectorFromString("timeWithNumber:"), with: NSNumber(value: Int(max(0, sec) * 1000)))?.takeUnretainedValue() else { return }
    p.setValue(t, forKey: "time")
  }

  func setAudioTrack(_ id: Int) { player?.setValue(NSNumber(value: Int32(id)), forKey: "currentAudioTrackIndex") }
  func setSubtitleTrack(_ id: Int) { player?.setValue(NSNumber(value: Int32(id)), forKey: "currentVideoSubTitleIndex") }
  func stop() { player?.perform(NSSelectorFromString("stop")) }

  // Poll state/time (avoids depending on VLCKit's delegate protocol at compile time).
  private func tick() {
    guard let p = player else { return }
    let state = (p.value(forKey: "state") as? NSNumber)?.intValue ?? 0
    let playing = isPlaying
    if state != lastState {
      lastState = state
      switch state {
      case 1, 2: if !playing { onStatus(["status": "loading"]) }
      case 5:
        onStatus(["status": "readyToPlay"])
        if !didStart { didStart = true; if startAt > 1 { seek(startAt) } }
      case 4: onStatus(["status": "error", "error": "VLC could not open this source"])
      case 3: onStatus(["status": "idle", "ended": true])
      default: break
      }
    }
    if cover { applyFit() } // video size is known only once playback starts
    if playing != lastPlaying { lastPlaying = playing; onPlaying(["isPlaying": playing]) }
    if playing {
      let len = ms((p.value(forKey: "media") as? NSObject)?.value(forKey: "length"))
      onTime(["currentTime": ms(p.value(forKey: "time")) / 1000.0, "duration": len / 1000.0])
    }
    emitTracks(p)
  }

  private func emitTracks(_ p: NSObject) {
    let an = (p.value(forKey: "audioTrackNames") as? [String]) ?? []
    let ai = (p.value(forKey: "audioTrackIndexes") as? [NSNumber]) ?? []
    let sn = (p.value(forKey: "videoSubTitlesNames") as? [String]) ?? []
    let si = (p.value(forKey: "videoSubTitlesIndexes") as? [NSNumber]) ?? []
    let aid = (p.value(forKey: "currentAudioTrackIndex") as? NSNumber)?.intValue ?? -1
    let sid = (p.value(forKey: "currentVideoSubTitleIndex") as? NSNumber)?.intValue ?? -1
    let key = "\(an)|\(sn)|\(aid)|\(sid)"
    if key == lastTracksKey { return }
    lastTracksKey = key
    var audio: [[String: Any]] = []
    for (i, n) in an.enumerated() where i < ai.count { audio.append(["id": ai[i].intValue, "name": n]) }
    var subs: [[String: Any]] = []
    for (i, n) in sn.enumerated() where i < si.count { subs.append(["id": si[i].intValue, "name": n]) }
    onTracks(["audio": audio, "subtitles": subs, "audioId": aid, "subtitleId": sid])
  }
}
