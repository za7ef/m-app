package expo.modules.mvlc

import android.content.Context
import android.net.Uri
import android.widget.FrameLayout
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView
import org.videolan.libvlc.LibVLC
import org.videolan.libvlc.Media
import org.videolan.libvlc.MediaPlayer
import org.videolan.libvlc.util.VLCVideoLayout

// libVLC-backed video view: plays MKV, HEVC, AC3/E-AC3/DTS/TrueHD audio, embedded subtitles...
class MVlcView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  private val onStatus by EventDispatcher()
  private val onTime by EventDispatcher()
  private val onTracks by EventDispatcher()
  private val onPlaying by EventDispatcher()

  private val libVLC = LibVLC(context, arrayListOf("--network-caching=3000", "--http-reconnect", "--audio-time-stretch"))
  private val player = MediaPlayer(libVLC)
  private val layout = VLCVideoLayout(context)
  private var uri: String? = null
  private var paused = false
  private var didStart = false
  private var lastTracksKey = ""
  private var lastTimeEmit = 0L
  var startAt: Double = 0.0
  override val shouldUseAndroidLayout = true

  init {
    addView(layout, FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT))
    player.attachViews(layout, null, true, false)
    player.setEventListener { e ->
      when (e.type) {
        MediaPlayer.Event.Opening, MediaPlayer.Event.Buffering -> if (!player.isPlaying) onStatus(mapOf("status" to "loading"))
        MediaPlayer.Event.Playing -> {
          onStatus(mapOf("status" to "readyToPlay"))
          if (!didStart) { didStart = true; if (startAt > 1) seek(startAt) }
          onPlaying(mapOf("isPlaying" to true))
        }
        MediaPlayer.Event.Paused, MediaPlayer.Event.Stopped -> onPlaying(mapOf("isPlaying" to false))
        MediaPlayer.Event.EndReached -> { onPlaying(mapOf("isPlaying" to false)); onStatus(mapOf("status" to "idle", "ended" to true)) }
        MediaPlayer.Event.EncounteredError -> onStatus(mapOf("status" to "error", "error" to "VLC could not open this source"))
        MediaPlayer.Event.TimeChanged -> {
          val now = System.currentTimeMillis()
          if (now - lastTimeEmit > 250) {
            lastTimeEmit = now
            onTime(mapOf("currentTime" to player.time / 1000.0, "duration" to player.length / 1000.0))
          }
        }
        MediaPlayer.Event.ESAdded, MediaPlayer.Event.ESDeleted, MediaPlayer.Event.ESSelected -> emitTracks()
        else -> {}
      }
    }
  }

  fun setUri(u: String?) {
    if (u == uri) return
    uri = u
    player.stop()
    didStart = false
    lastTracksKey = ""
    if (u == null) return
    val media = Media(libVLC, Uri.parse(u))
    media.setHWDecoderEnabled(true, false)
    player.media = media
    media.release()
    onStatus(mapOf("status" to "loading"))
    if (!paused) player.play()
  }

  fun setPaused(p: Boolean) {
    paused = p
    if (p) { if (player.isPlaying) player.pause() } else if (player.media != null && !player.isPlaying) player.play()
  }

  fun setRate(r: Double) { player.rate = r.toFloat() }

  fun setFit(fit: String) {
    player.videoScale = if (fit == "cover") MediaPlayer.ScaleType.SURFACE_FILL else MediaPlayer.ScaleType.SURFACE_BEST_FIT
  }

  fun seek(sec: Double) { player.time = (maxOf(0.0, sec) * 1000).toLong() }
  fun setAudioTrack(id: Int) { player.setAudioTrack(id) }
  fun setSubtitleTrack(id: Int) { player.setSpuTrack(id) }
  fun stopPlayback() { player.stop() }

  fun release() {
    try { player.stop(); player.detachViews(); player.release(); libVLC.release() } catch (_: Throwable) {}
  }

  private fun emitTracks() {
    val audio = (player.audioTracks ?: emptyArray()).map { mapOf("id" to it.id, "name" to it.name) }
    val subs = (player.spuTracks ?: emptyArray()).map { mapOf("id" to it.id, "name" to it.name) }
    val key = "$audio|$subs|${player.audioTrack}|${player.spuTrack}"
    if (key == lastTracksKey) return
    lastTracksKey = key
    onTracks(mapOf("audio" to audio, "subtitles" to subs, "audioId" to player.audioTrack, "subtitleId" to player.spuTrack))
  }
}
