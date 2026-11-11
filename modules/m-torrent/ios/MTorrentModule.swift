import ExpoModulesCore
import Mtorrent

public class MTorrentModule: Module {
  public func definition() -> ModuleDefinition {
    Name("MTorrent")

    Function("cacheDir") { () -> String in
      let base = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
      return base.appendingPathComponent("torrents").path
    }
    Function("token") { () -> String in MtorrentToken() }
    AsyncFunction("start") { (dir: String, uploadKBps: Int) throws -> Int in
      var port: Int = 0
      var err: NSError?
      MtorrentStart(dir, uploadKBps, &port, &err)
      if let err = err { throw err }
      return port
    }
    AsyncFunction("add") { (magnet: String, timeoutSec: Int) throws -> String in
      var err: NSError?
      let r = MtorrentAdd(magnet, timeoutSec, &err)
      if let err = err { throw err }
      return r as String? ?? ""
    }
    AsyncFunction("addTorrentUrl") { (url: String) throws -> String in
      var err: NSError?
      let r = MtorrentAddTorrentURL(url, &err)
      if let err = err { throw err }
      return r as String? ?? ""
    }
    AsyncFunction("stats") { (ih: String) -> String in (MtorrentStats(ih) as String?) ?? "{}" }
    AsyncFunction("drop") { (ih: String) in MtorrentDrop(ih) }
    AsyncFunction("dropAll") { MtorrentDropAll() }
    AsyncFunction("stop") { MtorrentStop() }
    AsyncFunction("cacheSize") { () -> Double in Double(MtorrentCacheSize()) }
    AsyncFunction("trimCache") { (maxMB: Int) -> String in (MtorrentTrimCache(maxMB) as String?) ?? "" }
  }
}
