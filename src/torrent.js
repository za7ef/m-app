// Torrent add-on support.
// Stremio add-ons may return torrent streams ({ infoHash, fileIdx, sources } or a magnet: URL).
// iOS video players can't play a torrent, so a torrent stream is first resolved to a direct HTTP(S) URL by one of:
//   • debrid  – a debrid service (Real-Debrid / TorBox) using the user's own API token.
//   • server  – a torrent-to-HTTP streaming server the user runs (e.g. the Stremio server, default port 11470).
// Nothing is resolved until the user taps a torrent source, and no token or server address leaves the device
// (they are excluded from cloud sync, see sync.js).

export const DEBRID_PROVIDERS = [['realdebrid', 'Real-Debrid'], ['torbox', 'TorBox']];
export const TORRENT_MODES = ['off', 'direct', 'debrid', 'server'];
export const TORRENT_SETTINGS = ['torrentMode', 'debridProvider', 'debridToken', 'streamServer', 'directUploadKBps']; // device-only keys

import * as Engine from '../modules/m-torrent/src';

const RD = 'https://api.real-debrid.com/rest/1.0';
const TB = 'https://api.torbox.app/v1/api';
const VIDEO_EXT = /\.(mkv|mp4|m4v|mov|avi|webm|ts|m2ts|wmv|flv)$/i;
const HASH_RE = /^[a-f0-9]{40}$|^[A-Z2-7]{32}$/i;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class TorrentError extends Error {
  constructor(code, msg) { super(msg || code); this.code = code; }
}
// codes: notConfigured | auth | notCached | timeout | noFile | network | bad

// ---------- stream helpers ----------

export function isTorrentStream(s) {
  return !!(s && (s.infoHash || (typeof s.url === 'string' && /^magnet:/i.test(s.url))));
}

function hashFromMagnet(m) {
  const x = /xt=urn:btih:([^&]+)/i.exec(m || '');
  return x ? x[1] : null;
}

// Normalises a raw add-on stream into what the UI and resolvers need.
export function normalizeTorrent(s, addonName) {
  const infoHash = (s.infoHash || hashFromMagnet(s.url) || '').toString();
  if (!HASH_RE.test(infoHash)) return null;
  const trackers = [];
  for (const src of s.sources || []) if (typeof src === 'string' && src.startsWith('tracker:')) trackers.push(src.slice(8));
  if (typeof s.url === 'string' && /^magnet:/i.test(s.url)) {
    for (const m of s.url.matchAll(/[?&]tr=([^&]+)/gi)) { try { trackers.push(decodeURIComponent(m[1])); } catch {} }
  }
  const text = `${s.name || ''}\n${s.title || ''}\n${s.description || ''}`;
  const seeds = /👤\s*(\d+)/.exec(text) || /seed(?:er)?s?\D{0,3}(\d+)/i.exec(text);
  const size = /💾\s*([\d.,]+\s*[KMGT]?B)/i.exec(text);
  return {
    kind: 'torrent', addon: addonName, name: s.name, title: s.title, description: s.description,
    infoHash: infoHash.toLowerCase(), fileIdx: Number.isInteger(s.fileIdx) ? s.fileIdx : undefined,
    trackers: [...new Set(trackers)], filename: s.behaviorHints?.filename,
    seeders: seeds ? +seeds[1] : 0, size: size ? size[1] : null, subtitles: s.subtitles,
  };
}

export function magnetOf(t) {
  const tr = t.trackers.map((x) => '&tr=' + encodeURIComponent(x)).join('');
  return `magnet:?xt=urn:btih:${t.infoHash}${t.filename ? '&dn=' + encodeURIComponent(t.filename) : ''}${tr}`;
}

// ---------- configuration ----------

export function torrentReady(settings) {
  if (settings.torrentMode === 'direct') return Engine.engineAvailable;
  if (settings.torrentMode === 'debrid') return !!(settings.debridToken || '').trim();
  if (settings.torrentMode === 'server') return !!(settings.streamServer || '').trim();
  return false;
}

export function normalizeServer(u) {
  let s = (u || '').trim();
  if (!s) return '';
  if (!/^https?:\/\//i.test(s)) s = 'http://' + s;
  return s.replace(/\/+$/, '');
}

// ---------- http ----------

async function http(url, { method = 'GET', headers, body, ms = 20000 } = {}) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  let r;
  try { r = await fetch(url, { method, headers, body, signal: ctl.signal }); }
  catch { throw new TorrentError('network'); }
  finally { clearTimeout(timer); }
  if (r.status === 401 || r.status === 403) throw new TorrentError('auth');
  const text = await r.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch {}
  if (!r.ok) throw new TorrentError('bad', `HTTP ${r.status} ${text.slice(0, 120)}`);
  return json;
}
const form = (o) => Object.entries(o).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
const FORM = { 'Content-Type': 'application/x-www-form-urlencoded' };

// ---------- Real-Debrid ----------

async function resolveRealDebrid(t, token, { onStatus, wait = 12000, poll = 1500 } = {}) {
  const auth = { Authorization: 'Bearer ' + token };
  const add = await http(`${RD}/torrents/addMagnet`, { method: 'POST', headers: { ...auth, ...FORM }, body: form({ magnet: magnetOf(t) }) });
  const id = add && add.id;
  if (!id) throw new TorrentError('bad', 'no id');
  const drop = () => http(`${RD}/torrents/delete/${id}`, { method: 'DELETE', headers: auth }).catch(() => {});
  try {
    let info = await http(`${RD}/torrents/info/${id}`, { headers: auth });
    if (info.status === 'waiting_files_selection') {
      const files = info.files || [];
      const pick = Number.isInteger(t.fileIdx) && files[t.fileIdx] ? String(files[t.fileIdx].id) : 'all';
      await http(`${RD}/torrents/selectFiles/${id}`, { method: 'POST', headers: { ...auth, ...FORM }, body: form({ files: pick }) });
    }
    const end = Date.now() + wait;
    for (;;) {
      info = await http(`${RD}/torrents/info/${id}`, { headers: auth });
      if (info.status === 'downloaded') break;
      if (['magnet_error', 'error', 'virus', 'dead'].includes(info.status)) throw new TorrentError('bad', info.status);
      if (Date.now() > end) throw new TorrentError('notCached');
      if (onStatus) onStatus(info.status, info.progress);
      await sleep(poll);
    }
    const links = info.links || [];
    const selected = (info.files || []).filter((f) => f.selected === 1);
    if (!links.length) throw new TorrentError('noFile');
    // links[i] corresponds to selected[i]; pick the requested/largest video file
    let k = 0;
    if (selected.length === links.length && selected.length > 1) {
      const vids = selected.map((f, i) => ({ f, i })).filter((x) => VIDEO_EXT.test(x.f.path || ''));
      const pool = vids.length ? vids : selected.map((f, i) => ({ f, i }));
      k = pool.sort((a, b) => b.f.bytes - a.f.bytes)[0].i;
    }
    const un = await http(`${RD}/unrestrict/link`, { method: 'POST', headers: { ...auth, ...FORM }, body: form({ link: links[k] }) });
    if (!un || !un.download) throw new TorrentError('noFile');
    return { url: un.download };
  } catch (e) {
    if (e instanceof TorrentError && e.code !== 'noFile') await drop(); // don't leave half-added torrents in the account
    throw e;
  }
}

// ---------- TorBox ----------

async function resolveTorBox(t, token, { onStatus, wait = 12000, poll = 1500 } = {}) {
  const auth = { Authorization: 'Bearer ' + token };
  // only cached torrents are played: never start a download the user didn't ask for
  const chk = await http(`${TB}/torrents/checkcached?hash=${t.infoHash}&format=list`, { headers: auth });
  const cachedHit = chk && Array.isArray(chk.data) ? chk.data.some((x) => (x.hash || x) === t.infoHash || x === t.infoHash) : !!(chk && chk.data && chk.data[t.infoHash]);
  if (!cachedHit) throw new TorrentError('notCached');

  const fd = new FormData();
  fd.append('magnet', magnetOf(t));
  fd.append('seed', '3');
  fd.append('allow_zip', 'false');
  const created = await http(`${TB}/torrents/createtorrent`, { method: 'POST', headers: auth, body: fd });
  const tid = created && created.data && (created.data.torrent_id ?? created.data.queued_id);
  if (tid == null) throw new TorrentError('bad', 'no id');

  const end = Date.now() + wait;
  let tor = null;
  for (;;) {
    const l = await http(`${TB}/torrents/mylist?id=${tid}&bypass_cache=true`, { headers: auth });
    tor = l && l.data;
    if (Array.isArray(tor)) tor = tor.find((x) => x.id === tid) || tor[0];
    if (tor && tor.files && tor.files.length && (tor.download_finished || tor.download_present || tor.cached)) break;
    if (Date.now() > end) throw new TorrentError('timeout');
    if (onStatus) onStatus(tor && tor.download_state, tor && tor.progress);
    await sleep(poll);
  }
  const files = tor.files;
  let file = Number.isInteger(t.fileIdx) ? files[t.fileIdx] : null;
  if (!file) {
    const vids = files.filter((f) => VIDEO_EXT.test(f.name || f.short_name || ''));
    file = (vids.length ? vids : files).slice().sort((a, b) => b.size - a.size)[0];
  }
  if (!file) throw new TorrentError('noFile');
  const dl = await http(`${TB}/torrents/requestdl?token=${encodeURIComponent(token)}&torrent_id=${tid}&file_id=${file.id}&redirect=false`, { headers: auth });
  if (!dl || !dl.data) throw new TorrentError('noFile');
  return { url: dl.data };
}

// ---------- streaming server (Stremio-server compatible) ----------

async function resolveServer(t, server) {
  const base = normalizeServer(server);
  // ask the server to start the torrent with our trackers (best effort; the stream URL below also works on its own)
  const sources = [...t.trackers.map((x) => 'tracker:' + x), 'dht:' + t.infoHash];
  await http(`${base}/${t.infoHash}/create`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, ms: 15000,
    body: JSON.stringify({ torrent: { infoHash: t.infoHash }, peerSearch: { sources, min: 40, max: 150 } }),
  }).catch((e) => { if (e.code === 'network') throw e; });
  const idx = Number.isInteger(t.fileIdx) ? t.fileIdx : -1; // -1 = let the server choose the main video file
  return { url: `${base}/${t.infoHash}/${idx}` };
}

// ---------- direct (built-in engine) ----------
// The engine downloads pieces from peers (and shares pieces back at a low, capped rate) and serves the file
// on http://127.0.0.1:<port>, so the normal player can play and seek it. Torrents are dropped when playback ends.

let enginePort = null;
const CACHE_MB = 2048;
export const isLocalStream = (url) => typeof url === 'string' && url.startsWith('http://127.0.0.1:');

async function startEngine(settings) {
  if (!Engine.engineAvailable) throw new TorrentError('notConfigured');
  if (enginePort) return enginePort;
  try {
    enginePort = await Engine.start(Engine.cacheDir(), Number(settings.directUploadKBps) || 100);
    Engine.trimCache(CACHE_MB).catch(() => {});
  } catch (e) { throw new TorrentError('network', e?.message); }
  return enginePort;
}

async function resolveDirect(t, settings) {
  const port = await startEngine(settings);
  let info;
  try { info = await Engine.add(magnetOf(t), 60); }
  catch (e) { throw new TorrentError(/timeout/i.test(e?.message || '') ? 'timeout' : 'network', e?.message); }
  const files = info.files || [];
  let f = Number.isInteger(t.fileIdx) ? files.find((x) => x.index === t.fileIdx) : null;
  if (!f && t.filename) f = files.find((x) => x.path.endsWith(t.filename));
  if (!f) f = files.filter((x) => VIDEO_EXT.test(x.path)).sort((a, b) => b.length - a.length)[0];
  if (!f) throw new TorrentError('noFile');
  return { url: `http://127.0.0.1:${port}/stream/${info.infoHash}/${f.index}`, filename: f.path, infoHash: info.infoHash };
}

// Called when the player closes: stop downloading/sharing and keep the cache under its cap.
export async function endDirectPlayback() {
  if (!enginePort) return;
  try { await Engine.dropAll(); await Engine.trimCache(CACHE_MB); } catch {}
}

export async function clearTorrentCache() {
  if (!Engine.engineAvailable) return;
  try { if (enginePort) await Engine.dropAll(); await Engine.trimCache(0); } catch {}
}

export const torrentCacheSize = async () => (Engine.engineAvailable ? Engine.cacheSize().catch(() => 0) : 0);
export const directAvailable = Engine.engineAvailable;

// ---------- public API ----------

// Returns { url } ready for the player, or throws TorrentError.
export async function resolveTorrent(t, settings, opts) {
  if (!torrentReady(settings)) throw new TorrentError('notConfigured');
  if (settings.torrentMode === 'server') return resolveServer(t, settings.streamServer);
  if (settings.torrentMode === 'direct') return resolveDirect(t, settings);
  const token = settings.debridToken.trim();
  return settings.debridProvider === 'torbox' ? resolveTorBox(t, token, opts) : resolveRealDebrid(t, token, opts);
}

// Used by the "Test connection" button in Settings.
export async function testTorrentSetup(settings) {
  if (!torrentReady(settings)) throw new TorrentError('notConfigured');
  if (settings.torrentMode === 'direct') { await startEngine(settings); return 'direct'; }
  if (settings.torrentMode === 'server') {
    await http(`${normalizeServer(settings.streamServer)}/stats.json`, { ms: 8000 });
    return 'server';
  }
  const token = settings.debridToken.trim();
  if (settings.debridProvider === 'torbox') await http(`${TB}/user/me`, { headers: { Authorization: 'Bearer ' + token }, ms: 10000 });
  else await http(`${RD}/user`, { headers: { Authorization: 'Bearer ' + token }, ms: 10000 });
  return 'debrid';
}

export const torrentErrorKey = (e) => 'torrentErr_' + (e && e.code ? e.code : 'bad');

// Best torrent first: higher quality, then more seeders.
export function sortTorrents(list, qualityOf) {
  return [...list].sort((a, b) => (qualityOf(b) - qualityOf(a)) || (b.seeders - a.seeders));
}
