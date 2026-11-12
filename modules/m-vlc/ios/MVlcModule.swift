import ExpoModulesCore

public class MVlcModule: Module {
  public func definition() -> ModuleDefinition {
    Name("MVlc")

    // Never loads VLC; only reports whether the framework file is in the app bundle.
    Constant("embedded") { VlcLoader.embedded }
    AsyncFunction("load") { () -> String? in VlcLoader.load() }

    View(MVlcView.self) {
      Events("onStatus", "onTime", "onTracks", "onPlaying")

      Prop("uri") { (view: MVlcView, uri: String?) in view.setUri(uri) }
      Prop("paused") { (view: MVlcView, paused: Bool) in view.setPaused(paused) }
      Prop("rate") { (view: MVlcView, rate: Double) in view.setRate(rate) }
      Prop("startAt") { (view: MVlcView, sec: Double) in view.startAt = sec }
      Prop("fit") { (view: MVlcView, fit: String) in view.setFit(fit) }
      Prop("subDelay") { (view: MVlcView, ms: Double) in view.setSubDelay(ms) }

      AsyncFunction("seek") { (view: MVlcView, sec: Double) in view.seek(sec) }
      AsyncFunction("setAudioTrack") { (view: MVlcView, id: Int) in view.setAudioTrack(id) }
      AsyncFunction("setSubtitleTrack") { (view: MVlcView, id: Int) in view.setSubtitleTrack(id) }
      AsyncFunction("stop") { (view: MVlcView) in view.stop() }
    }
  }
}
