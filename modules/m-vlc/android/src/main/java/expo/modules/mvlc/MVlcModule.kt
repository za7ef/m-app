package expo.modules.mvlc

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.functions.Queues

class MVlcModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("MVlc")

    View(MVlcView::class) {
      Events("onStatus", "onTime", "onTracks", "onPlaying")

      Prop("uri") { view: MVlcView, uri: String? -> view.setUri(uri) }
      Prop("paused") { view: MVlcView, paused: Boolean -> view.setPaused(paused) }
      Prop("rate") { view: MVlcView, rate: Double -> view.setRate(rate) }
      Prop("startAt") { view: MVlcView, sec: Double -> view.startAt = sec }
      Prop("fit") { view: MVlcView, fit: String -> view.setFit(fit) }
      Prop("subDelay") { view: MVlcView, ms: Double -> view.setSubDelay(ms) }

      AsyncFunction("seek") { view: MVlcView, sec: Double -> view.seek(sec) }.runOnQueue(Queues.MAIN)
      AsyncFunction("setAudioTrack") { view: MVlcView, id: Int -> view.setAudioTrack(id) }.runOnQueue(Queues.MAIN)
      AsyncFunction("setSubtitleTrack") { view: MVlcView, id: Int -> view.setSubtitleTrack(id) }.runOnQueue(Queues.MAIN)
      AsyncFunction("reattach") { view: MVlcView -> view.reattach() }.runOnQueue(Queues.MAIN)
      AsyncFunction("stop") { view: MVlcView -> view.stopPlayback() }.runOnQueue(Queues.MAIN)

      OnViewDestroys { view: MVlcView -> view.release() }
    }
  }
}
