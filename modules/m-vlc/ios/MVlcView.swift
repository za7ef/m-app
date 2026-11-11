import ExpoModulesCore
import MobileVLCKit

// A video view backed by libVLC (plays MKV, HEVC, Dolby Vision fallback to HDR10/SDR, E-AC3/DDP, embedded subs...).
class MVlcView: ExpoView, VLCMediaPlayerDelegate {
  let onStatus = EventDispatcher()
  let onTime = EventDispatcher()
  let onTracks = EventDispatcher()
  let onPlaying = EventDispatcher()

  private let videoView = UIView()
  private let player = VLCMediaPlayer()
  private var uri: String?
  private var paused = false
  private var lastTracksKey = ""
  private var didStart = false
  var startAt: Double = 0
  private var cropRatio: String?

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    clipsToBounds = true
    backgroundColor = .black
    videoView.backgroundColor = .black
    addSubview(videoView)
    player.drawable = videoView
    player.delegate = self
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    videoView.frame = bounds
  }

  deinit { player.stop() }

  func setUri(_ u: String?) {
    guard u != uri else { return }
    uri = u
    player.stop()
    didStart = false
    lastTracksKey = ""
    guard let u = u, let url = URL(string: u) else { return }
    let media = VLCMedia(url: url)
    media.addOptions(["network-caching": 3000, "http-reconnect": true])
    player.media = media
    onStatus(["status": "loading"])
    if !paused { player.play() }
  }

  func setPaused(_ p: Bool) {
    paused = p
    if p { if player.isPlaying { player.pause() } } else if player.media != nil && !player.isPlaying { player.play() }
  }

  func setRate(_ r: Double) { player.rate = Float(r) }

  func setFit(_ fit: String) {
    // "cover" fills the screen (crop) using the view's aspect ratio; "contain" letterboxes.
    player.scaleFactor = 0
    if fit == "cover", bounds.width > 0, bounds.height > 0 {
      cropRatio = "\(Int(bounds.width)):\(Int(bounds.height))"
      cropRatio!.withCString { player.videoCropGeometry = UnsafeMutablePointer(mutating: $0) }
    } else {
      cropRatio = nil
      player.videoCropGeometry = nil
    }
  }

  func seek(_ sec: Double) { player.time = VLCTime(int: Int32(max(0, sec) * 1000)) }

  func setAudioTrack(_ id: Int) { player.currentAudioTrackIndex = Int32(id) }
  func setSubtitleTrack(_ id: Int) { player.currentVideoSubTitleIndex = Int32(id) }
  func stop() { player.stop() }

  // MARK: VLCMediaPlayerDelegate
  func mediaPlayerStateChanged(_ aNotification: Notification) {
    switch player.state {
    case .opening, .buffering:
      onStatus(["status": player.isPlaying ? "readyToPlay" : "loading"])
    case .playing:
      onStatus(["status": "readyToPlay"])
      if !didStart {
        didStart = true
        if startAt > 1 { seek(startAt) }
      }
    case .error:
      onStatus(["status": "error", "error": "VLC could not open this source"])
    case .ended:
      onStatus(["status": "idle", "ended": true])
    default: break
    }
    onPlaying(["isPlaying": player.isPlaying])
    emitTracks()
  }

  func mediaPlayerTimeChanged(_ aNotification: Notification) {
    let cur = Double(player.time.intValue) / 1000.0
    let len = Double(player.media?.length.intValue ?? 0) / 1000.0
    onTime(["currentTime": cur, "duration": len])
    emitTracks()
  }

  private func emitTracks() {
    let an = (player.audioTrackNames as? [String]) ?? []
    let ai = (player.audioTrackIndexes as? [NSNumber]) ?? []
    let sn = (player.videoSubTitlesNames as? [String]) ?? []
    let si = (player.videoSubTitlesIndexes as? [NSNumber]) ?? []
    let key = "\(an)|\(sn)|\(player.currentAudioTrackIndex)|\(player.currentVideoSubTitleIndex)"
    if key == lastTracksKey { return }
    lastTracksKey = key
    var audio: [[String: Any]] = []
    for (i, n) in an.enumerated() where i < ai.count { audio.append(["id": ai[i].intValue, "name": n]) }
    var subs: [[String: Any]] = []
    for (i, n) in sn.enumerated() where i < si.count { subs.append(["id": si[i].intValue, "name": n]) }
    onTracks(["audio": audio, "subtitles": subs,
              "audioId": Int(player.currentAudioTrackIndex), "subtitleId": Int(player.currentVideoSubTitleIndex)])
  }
}
