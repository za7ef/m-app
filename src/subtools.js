// Subtitle helpers for the player: OpenSubtitles file hash, ranking by release name, and per-video timing offsets.
import AsyncStorage from '@react-native-async-storage/async-storage';

// OpenSubtitles "moviehash": file size + the 64-bit sum of the first and last 64 KB (read with HTTP Range requests).
// Works for direct http(s) links and the local torrent stream; returns null when the server doesn't support ranges.
const CHUNK = 65536;
async function range(url, from, to, headers) {
  const ctl = new AbortController();
  const tm = setTimeout(() => ctl.abort(), 15000);
  try {
    const r = await fetch(url, { headers: { ...(headers || {}), Range: `bytes=${from}-${to}` }, signal: ctl.signal });
    if (r.status !== 206) return null;
    const total = Number((r.headers.get('content-range') || '').split('/')[1]) || null;
    return { buf: new Uint8Array(await r.arrayBuffer()), total };
  } catch { return null; } finally { clearTimeout(tm); }
}
function sum64(bytes) {
  let s = 0n;
  const n = Math.floor(bytes.length / 8) * 8;
  for (let i = 0; i < n; i += 8) {
    let v = 0n;
    for (let k = 7; k >= 0; k--) v = (v << 8n) | BigInt(bytes[i + k]);
    s = (s + v) & 0xFFFFFFFFFFFFFFFFn;
  }
  return s;
}
export async function movieHash(url, headers) {
  if (!/^https?:\/\//i.test(url || '') || typeof BigInt !== 'function') return null;
  const head = await range(url, 0, CHUNK - 1, headers);
  if (!head || !head.total || head.total < CHUNK * 2 || head.buf.length < CHUNK) return null;
  const tail = await range(url, head.total - CHUNK, head.total - 1, headers);
  if (!tail || tail.buf.length < CHUNK) return null;
  const h = (BigInt(head.total) + sum64(head.buf) + sum64(tail.buf)) & 0xFFFFFFFFFFFFFFFFn;
  return { hash: h.toString(16).padStart(16, '0'), size: head.total };
}

// Release-name tokens ("1080p", "WEB-DL", group...) shared between the video and a subtitle's name.
const tokens = (s) => new Set(String(s || '').toLowerCase().replace(/\.[a-z0-9]{2,4}$/, '').split(/[^a-z0-9]+/).filter((x) => x.length > 1 && !/^(the|and|of|a|srt|vtt|sub|subs)$/.test(x)));
export function releaseScore(videoName, sub) {
  const v = tokens(videoName);
  if (!v.size) return 0;
  const name = `${sub.subtitleFileName || ''} ${sub.movieReleaseName || ''} ${sub.releaseGroup || ''} ${sub.filename || ''} ${sub.release || ''} ${sub.title || ''}`;
  let n = 0;
  for (const tk of tokens(name)) if (v.has(tk)) n++;
  return n;
}

// Orders subtitles: preferred language first, then hash-matched (add-on said so), then release-name overlap,
// keeping the add-on's own order otherwise (OpenSubtitles already sorts hash matches first when given the hash).
// OpenSubtitles marks hash matches with m: 'h'.
export function rankSubs(list, langRank, videoName) {
  return list.map((x, i) => ({ x, i, l: langRank(x.lang), m: x.m === 'h' || x.moviehashMatch || x.hashMatch ? 1 : 0, r: releaseScore(videoName, x) }))
    .sort((a, b) => a.l - b.l || b.m - a.m || b.r - a.r || a.i - b.i)
    .map((o) => o.x);
}

// Timing offset (seconds, positive = subtitles later) saved per video + subtitle file.
const DKEY = 'm-app.subDelay';
let delays = null;
async function loadDelays() {
  if (delays) return delays;
  try { delays = JSON.parse((await AsyncStorage.getItem(DKEY)) || '{}'); } catch { delays = {}; }
  return delays;
}
const dk = (videoId, subKey) => `${videoId}|${subKey || 'embedded'}`;
export async function getDelay(videoId, subKey) { const d = await loadDelays(); return d[dk(videoId, subKey)]?.v || 0; }
export async function saveDelay(videoId, subKey, v) {
  const d = await loadDelays();
  const k = dk(videoId, subKey);
  if (!v) delete d[k]; else d[k] = { v, at: Date.now() };
  const keys = Object.keys(d);
  if (keys.length > 400) keys.sort((a, b) => d[a].at - d[b].at).slice(0, keys.length - 400).forEach((x) => delete d[x]);
  AsyncStorage.setItem(DKEY, JSON.stringify(d)).catch(() => {});
}
export const subKeyOf = (sub) => (sub ? String(sub.id || sub.url || '') : 'embedded');
