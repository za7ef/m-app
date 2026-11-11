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
    AsyncFunction("start") { dir: String, uploadKBps: Int -> Mtorrent.start(dir, uploadKBps.toLong()).toInt() }
    AsyncFunction("add") { magnet: String, timeoutSec: Int -> Mtorrent.add(magnet, timeoutSec.toLong()) }
    AsyncFunction("addTorrentUrl") { url: String -> Mtorrent.addTorrentURL(url) }
    AsyncFunction("stats") { ih: String -> Mtorrent.stats(ih) }
    AsyncFunction("drop") { ih: String -> Mtorrent.drop(ih) }
    AsyncFunction("dropAll") { Mtorrent.dropAll() }
    AsyncFunction("stop") { Mtorrent.stop() }
    AsyncFunction("cacheSize") { Mtorrent.cacheSize().toDouble() }
    AsyncFunction("trimCache") { maxMB: Int -> Mtorrent.trimCache(maxMB.toLong()) }
  }
}
