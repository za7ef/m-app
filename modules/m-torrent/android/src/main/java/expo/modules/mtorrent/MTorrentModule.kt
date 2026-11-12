package expo.modules.mtorrent

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import mtorrent.Mtorrent
import java.io.File

class MTorrentModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("MTorrent")

    Function("cacheDir") {
      val ctx = appContext.reactContext ?: throw Exception("no context")
      File(ctx.cacheDir, "torrents").absolutePath
    }
    Function("token") { Mtorrent.token() }
    AsyncFunction("addAsync") { magnet: String -> Mtorrent.addAsync(magnet) }
    AsyncFunction("info") { ih: String -> Mtorrent.info(ih) }
    AsyncFunction("dhtNodes") { Mtorrent.dhtNodes().toInt() }
    AsyncFunction("start") { dir: String, uploadKBps: Int -> Mtorrent.start(dir, uploadKBps.toLong()).toInt() }
    AsyncFunction("add") { magnet: String, timeoutSec: Int -> Mtorrent.add(magnet, timeoutSec.toLong()) }
    AsyncFunction("addTorrentUrl") { url: String -> Mtorrent.addTorrentURL(url) }
    AsyncFunction("stats") { ih: String -> Mtorrent.stats(ih) }
    AsyncFunction("drop") { ih: String -> Mtorrent.drop(ih) }
    AsyncFunction("dropAll") { Mtorrent.dropAll() }
    AsyncFunction("stop") { Mtorrent.stop() }
    AsyncFunction("cacheSize") { Mtorrent.cacheSize().toDouble() }
    AsyncFunction("trimCache") { maxMB: Int -> Mtorrent.trimCache(maxMB.toLong()) }
    Function("downloadsDir") {
      val ctx = appContext.reactContext ?: throw Exception("no context")
      File(ctx.filesDir, "downloads/torrents").absolutePath
    }
    AsyncFunction("downloadStart") { magnet: String, fileIdx: Int, dir: String -> Mtorrent.downloadStart(magnet, fileIdx.toLong(), dir) }
    AsyncFunction("downloadStatus") { ih: String, fileIdx: Int -> Mtorrent.downloadStatus(ih, fileIdx.toLong()) }
    AsyncFunction("downloadStop") { ih: String, fileIdx: Int -> Mtorrent.downloadStop(ih, fileIdx.toLong()) }
    // iOS only. On Android, expo-secure-store's backup rules only include shared prefs, so files (downloads too) are never backed up.
    AsyncFunction("excludeFromBackup") { _: String -> 0 }
    // Foreground service with a progress notification while downloads run (Android only).
    Function("fgUpdate") { title: String, text: String, percent: Int ->
      val ctx = appContext.reactContext ?: return@Function false
      try {
        if (DownloadService.running) {
          val nm = ctx.getSystemService(android.content.Context.NOTIFICATION_SERVICE) as android.app.NotificationManager
          nm.notify(DownloadService.NOTIF_ID, DownloadService.build(ctx, title, text, percent))
        } else {
          val i = android.content.Intent(ctx, DownloadService::class.java).putExtra("title", title).putExtra("text", text).putExtra("percent", percent)
          if (android.os.Build.VERSION.SDK_INT >= 26) ctx.startForegroundService(i) else ctx.startService(i)
        }
        true
      } catch (e: Exception) { false } // e.g. not allowed to start from the background; retried on the next update
    }
    Function("fgStop") {
      val ctx = appContext.reactContext ?: return@Function false
      try { ctx.stopService(android.content.Intent(ctx, DownloadService::class.java)) } catch (e: Exception) { false }
    }
  }
}
