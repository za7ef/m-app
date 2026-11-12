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

import { Platform } from 'react-native';
import { vlcAvailable } from '../modules/m-vlc/src';
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

// Some magnets carry the 32-char base32 form of the info-hash; everything downstream (debrid APIs, engine, resume)
// expects 40-char hex.
function toHexHash(h) {
  if (!/^[A-Z2-7]{32}$/i.test(h)) return h;
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const c of h.toUpperCase()) bits += A.indexOf(c).toString(2).padStart(5, '0');
  let hex = '';
  for (let i = 0; i < 160; i += 4) hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
  return hex;
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
  const size = /💾\s*([\d.,]+\s*[KMGT]?B)/i.exec(text) || /\b(\d+(?:[.,]\d+)?\s*[KMGT]B)\b/i.exec(text);
  return {
    kind: 'torrent', addon: addonName, name: s.name, title: s.title, description: s.description,
    infoHash: toHexHash(infoHash).toLowerCase(), fileIdx: Number.isInteger(s.fileIdx) ? s.fileIdx : undefined,
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

let lastUploadKBps = 100;
async function startEngine(settings) {
  if (!Engine.engineAvailable) throw new TorrentError('notConfigured');
  lastUploadKBps = Number(settings.directUploadKBps) || 100;
  if (enginePort) return enginePort;
  try {
    enginePort = await Engine.start(Engine.cacheDir(), Number(settings.directUploadKBps) || 100);
    Engine.trimCache(CACHE_MB).catch(() => {});
  } catch (e) { throw new TorrentError('network', e?.message); }
  return enginePort;
}

const META_TIMEOUT_MS = 75000;
let dropTimer = null;
const IOS_PLAYABLE = /\.(mp4|m4v|mov)$/i;

async function resolveDirect(t, settings, opts = {}) {
  const port = await startEngine(settings);
  const say = opts.onProgress || (() => {});
  clearTimeout(dropTimer); dropTimer = null;
  const cancelled = () => opts.signal && opts.signal.aborted;
  say({ phase: 'meta' });
  let ih;
  try { ih = await Engine.addAsync(magnetOf(t)); } catch (e) { throw new TorrentError('network', e?.message); }
  // Wait for metadata with live status. The torrent is kept on timeout, so trying again continues where it left off.
  let info = null;
  const t0 = Date.now();
  while (!info) {
    if (cancelled()) throw new TorrentError('cancelled');
    info = await Engine.info(ih).catch(() => null);
    if (info) break;
    if (Date.now() - t0 > META_TIMEOUT_MS) {
      const st = await Engine.stats(ih).catch(() => ({}));
      throw new TorrentError('metaTimeout', `DHT ${st.dht || 0} · peers ${st.known || 0}`);
    }
    const st = await Engine.stats(ih).catch(() => ({}));
    say({ phase: 'meta', dht: st.dht || 0, known: st.known || 0, peers: st.peers || 0, secs: Math.round((Date.now() - t0) / 1000) });
    await sleep(700);
  }
  console.log('[torrent] metadata in', Date.now() - t0, 'ms');
  const files = info.files || [];
  const videos = files.filter((x) => VIDEO_EXT.test(x.path));
  let f = Number.isInteger(t.fileIdx) ? files.find((x) => x.index === t.fileIdx) : null;
  if (!f && t.filename) f = files.find((x) => x.path.endsWith(t.filename));
  if (!f) f = [...videos].sort((a, b) => (IOS_PLAYABLE.test(b.path) - IOS_PLAYABLE.test(a.path)) || (b.length - a.length))[0];
  if (!f) throw new TorrentError('noFile');
  // iOS's player (AVPlayer) can't open Matroska/AVI etc.
  if (Platform.OS === 'ios' && !IOS_PLAYABLE.test(f.path) && (!vlcAvailable || settings.playerEngine === 'native')) {
    Engine.drop(info.infoHash).catch(() => {});
    throw new TorrentError('iosFormat', f.path);
  }
  const name = encodeURIComponent((f.path.split('/').pop() || 'video.mp4').replace(/[^\w.\-]+/g, '_'));
  const url = `${Engine.streamBase(port)}/${info.infoHash}/${f.index}/${name}`;
  // Pre-buffer the start (and the end, where MP4 metadata often lives) so the player opens instantly.
  say({ phase: 'buffer', file: f.path });
  let done = false;
  const poll = (async () => {
    while (!done) {
      try { const st = await Engine.stats(info.infoHash); say({ phase: 'buffer', file: f.path, ...st }); } catch {}
      await sleep(1000);
    }
  })();
  // Pre-buffer requests also stop when the user cancels (they used to run on for up to 90 s and then open the player).
  const grab = (range) => {
    const ctl = new AbortController();
    const tm = setTimeout(() => ctl.abort(), 90000);
    const onCancel = () => ctl.abort();
    opts.signal?.addEventListener?.('abort', onCancel);
    return fetch(url, { headers: { Range: range }, signal: ctl.signal }).then((r) => r.arrayBuffer())
      .finally(() => { clearTimeout(tm); opts.signal?.removeEventListener?.('abort', onCancel); });
  };
  try {
    await Promise.all([grab('bytes=0-2097151'), f.length > 4194304 ? grab(`bytes=${f.length - 1048576}-${f.length - 1}`) : null]);
  } catch (e) {
    done = true;
    if (cancelled()) { endDirectPlayback(); throw new TorrentError('cancelled'); }
    const st = await Engine.stats(info.infoHash).catch(() => ({}));
    throw new TorrentError('stalled', `peers ${st.peers || 0}, ${Math.round((st.down || 0) / 1048576)} MB`);
  }
  done = true; await poll;
  if (cancelled()) { endDirectPlayback(); throw new TorrentError('cancelled'); }
  return { url, filename: f.path, infoHash: info.infoHash };
}

// Called when the player closes: stop downloading/sharing and keep the cache under its cap.
// The torrent stays loaded for 2 minutes, so reopening or picking another episode of the same pack is instant.
export function endDirectPlayback() {
  if (!enginePort) return;
  clearTimeout(dropTimer);
  dropTimer = setTimeout(async () => {
    dropTimer = null;
    try { await Engine.dropAll(); await Engine.trimCache(CACHE_MB); } catch {}
  }, 120000);
}

// After the app comes back from the background the OS may have closed the engine's local socket (iOS does this
// after a long suspension). Probe it; if it is dead, restart the engine, re-add the torrent and return the new
// stream URL (port and secret change). Returns the same URL when nothing had to be done.
export async function reviveLocalStream(url, magnet) {
  if (!isLocalStream(url) || !Engine.engineAvailable) return url;
  const alive = async () => {
    if (!enginePort) return false;
    const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 3000);
    try { await fetch(`http://127.0.0.1:${enginePort}/stream/x/0/0`, { signal: ctl.signal }); return true; } // any HTTP answer = alive
    catch { return false; } finally { clearTimeout(tm); }
  };
  if (await alive()) return url;
  console.warn('[torrent] local server gone after background, restarting');
  try { await Engine.stop(); } catch {}
  enginePort = null;
  const port = await startEngine({ directUploadKBps: lastUploadKBps });
  if (magnet) { try { await Engine.addAsync(magnet); } catch {} }
  const rest = (/^http:\/\/127\.0\.0\.1:\d+\/stream\/[^/]+\/(.*)$/.exec(url) || [])[1];
  return rest ? `${Engine.streamBase(port)}/${rest}` : url;
}

// Start the engine early (DHT bootstrap) so the first play doesn't pay the cold-start cost.
export function warmEngine(settings) {
  if (settings?.torrentMode !== 'direct' || !Engine.engineAvailable || enginePort) return;
  startEngine(settings).catch(() => {});
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
  if (settings.torrentMode === 'direct') return resolveDirect(t, settings, opts);
  const token = settings.debridToken.trim();
  return settings.debridProvider === 'torbox' ? resolveTorBox(t, token, opts) : resolveRealDebrid(t, token, opts);
}

// Used by the "Test connection" button in Settings.
export async function testTorrentSetup(settings) {
  if (!torrentReady(settings)) throw new TorrentError('notConfigured');
  if (settings.torrentMode === 'direct') { await startEngine(settings); return 'direct'; }
  if (settings.torrentMode === 'server') {
    // /stats.json is Stremio-specific; any other server is fine as long as it answers HTTP at all.
    const base = normalizeServer(settings.streamServer);
    try { await http(`${base}/stats.json`, { ms: 8000 }); }
    catch (e) {
      if (e?.code === 'auth') throw e;
      const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 8000);
      try { await fetch(base, { signal: ctl.signal }); } catch { throw new TorrentError('network'); } finally { clearTimeout(tm); }
    }
    return 'server';
  }
  const token = settings.debridToken.trim();
  if (settings.debridProvider === 'torbox') await http(`${TB}/user/me`, { headers: { Authorization: 'Bearer ' + token }, ms: 10000 });
  else await http(`${RD}/user`, { headers: { Authorization: 'Bearer ' + token }, ms: 10000 });
  return 'debrid';
}

export const torrentErrorKey = (e) => 'torrentErr_' + (e && e.code ? e.code : 'bad');

export function sizeBytes(str) {
  const m = /([\d.,]+)\s*([KMGT]?)B/i.exec(str || '');
  if (!m) return null;
  const n = parseFloat(m[1].replace(',', '.'));
  return n * Math.pow(1024, ' KMGT'.indexOf((m[2] || ' ').toUpperCase()) || 0);
}
// Smallest file first (unknown sizes last), then more seeders.
export function sortTorrents(list) {
  const k = (x) => { const b = sizeBytes(x.size); return b == null ? Infinity : b; };
  return [...list].sort((a, b) => (k(a) - k(b)) || (b.seeders - a.seeders));
}

// ---------- downloads ----------

// Gets a torrent ready for downloading. With the built-in engine the file is downloaded by the engine itself
// ({ kind: 'torrent', infoHash, fileIdx, magnet, name, length }); with debrid or a streaming server the torrent is
// resolved to a normal link ({ kind: 'http', url, filename }).
export async function prepareTorrentDownload(t, settings, opts = {}) {
  if (!torrentReady(settings)) throw new TorrentError('notConfigured');
  if (settings.torrentMode !== 'direct') {
    const r = await resolveTorrent(t, settings, opts);
    return { kind: 'http', url: r.url, filename: r.filename || t.filename };
  }
  await startEngine(settings);
  const magnet = magnetOf(t);
  let ih;
  try { ih = await Engine.addAsync(magnet); } catch (e) { throw new TorrentError('network', e?.message); }
  const t0 = Date.now();
  let info = null;
  while (!info) {
    if (opts.signal?.aborted) throw new TorrentError('cancelled');
    info = await Engine.info(ih).catch(() => null);
    if (info) break;
    if (Date.now() - t0 > META_TIMEOUT_MS) throw new TorrentError('metaTimeout');
    opts.onProgress?.({ phase: 'meta', secs: Math.round((Date.now() - t0) / 1000) });
    await sleep(700);
  }
  const files = info.files || [];
  let f = Number.isInteger(t.fileIdx) ? files.find((x) => x.index === t.fileIdx) : null;
  if (!f && t.filename) f = files.find((x) => x.path.endsWith(t.filename));
  if (!f) f = files.filter((x) => VIDEO_EXT.test(x.path)).sort((a, b) => b.length - a.length)[0];
  if (!f) throw new TorrentError('noFile');
  return { kind: 'torrent', infoHash: info.infoHash, fileIdx: f.index, magnet, name: f.path, length: f.length };
}
export const engineStartFor = (settings) => startEngine(settings);
export const torrentDownloadsDir = () => Engine.downloadsDir();
export const torrentDownloadStart = (magnet, idx) => Engine.downloadStart(magnet, idx, Engine.downloadsDir());
export const torrentDownloadStatus = (ih, idx) => Engine.downloadStatus(ih, idx);
export const torrentDownloadStop = (ih, idx) => Engine.downloadStop(ih, idx);
export const excludeFromBackup = (path) => Engine.excludeFromBackup(path);
