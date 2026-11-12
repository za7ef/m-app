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
  }
}
