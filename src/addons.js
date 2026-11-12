// Client for the open Stremio add-on protocol (manifest / catalog / meta / stream / subtitles).
// Direct HTTP(S) streams and official "externalUrl" links are used as-is. Torrent (infoHash / magnet) streams are
// returned separately; the UI resolves them to a direct URL through src/torrent.js (debrid service or streaming server).
import { isTorrentStream, normalizeTorrent } from './torrent';

const CINEMETA = 'https://v3-cinemeta.strem.io/manifest.json';
const WATCHHUB = 'https://watchhub.strem.io/manifest.json';
const OPENSUBS = 'https://opensubtitles-v3.strem.io/manifest.json';
export const OPEN_MOVIES_URL = 'builtin://open-movies';

const OPEN_MOVIES = [
  // Several HTTPS mirrors per title; the player falls back to the next one if a URL fails.
  { id: 'tt1254207', name: 'Big Buck Bunny', year: '2008', file: 'BigBuckBunny', urls: [
    ['MP4 720p · archive.org', 'https://archive.org/download/BigBuckBunny_124/Content/big_buck_bunny_720p_surround.mp4'],
    ['HLS · mux', 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'] ] },
  { id: 'tt1727587', name: 'Sintel', year: '2010', file: 'Sintel', urls: [
    ['MP4 · archive.org', 'https://archive.org/download/Sintel/sintel-2048-stereo.mp4'],
    ['MP4 SD · archive.org', 'https://archive.org/download/Sintel/sintel-2048-stereo_512kb.mp4'] ] },
  { id: 'tt2285752', name: 'Tears of Steel', year: '2012', file: 'TearsOfSteel', urls: [
    ['HLS · Unified Streaming', 'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8'] ] },
  { id: 'tt0807840', name: 'Elephants Dream', year: '2006', file: 'ElephantsDream', urls: [
    ['MP4 HD · archive.org', 'https://archive.org/download/ElephantsDream/ed_hd.mp4'],
    ['MP4 SD · archive.org', 'https://archive.org/download/ElephantsDream/ed_1024_512kb.mp4'] ] },
];
const OPEN_BASE = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/';

export const DEFAULT_ADDONS = [
  {
    transportUrl: CINEMETA, core: true, id: 'com.linvo.cinemeta',
    manifest: {
      id: 'com.linvo.cinemeta', name: 'Cinemeta', version: '3', description: 'Official movie & series metadata',
      resources: ['catalog', 'meta'], types: ['movie', 'series'], idPrefixes: ['tt'],
      catalogs: [
        { type: 'movie', id: 'top', name: 'Popular', extra: [{ name: 'search' }, { name: 'genre' }, { name: 'skip' }] },
        { type: 'series', id: 'top', name: 'Popular', extra: [{ name: 'search' }, { name: 'genre' }, { name: 'skip' }] },
        { type: 'movie', id: 'imdbRating', name: 'Featured', extra: [{ name: 'genre' }, { name: 'skip' }] },
        { type: 'series', id: 'imdbRating', name: 'Featured', extra: [{ name: 'genre' }, { name: 'skip' }] },
      ],
    },
  },
  {
    transportUrl: OPEN_MOVIES_URL, core: true, id: 'builtin.openmovies',
    manifest: {
      id: 'builtin.openmovies', name: 'Open Movies (Blender, CC BY)', version: '1',
      description: 'Free Creative Commons films by the Blender Foundation, streamed directly.',
      resources: ['catalog', 'stream'], types: ['movie'], idPrefixes: ['tt'],
      catalogs: [{ type: 'movie', id: 'open', name: 'Open Movies' }],
    },
  },
  {
    transportUrl: WATCHHUB, id: 'org.stremio.watchhub',
    manifest: { id: 'org.stremio.watchhub', name: 'WatchHub', version: '1', description: 'Where to watch on official services',
      resources: ['stream'], types: ['movie', 'series'], idPrefixes: ['tt'], catalogs: [] },
  },
  {
    transportUrl: OPENSUBS, id: 'org.stremio.opensubtitlesv3',
    manifest: { id: 'org.stremio.opensubtitlesv3', name: 'OpenSubtitles v3', version: '1', description: 'Subtitles',
      resources: ['subtitles'], types: ['movie', 'series'], idPrefixes: ['tt'], catalogs: [] },
  },
];

export const SUGGESTED = [
  { url: WATCHHUB, name: 'WatchHub', desc: 'Official services (where to watch)' },
  { url: OPENSUBS, name: 'OpenSubtitles v3', desc: 'Subtitles' },
];

export function normalizeUrl(u) {
  let s = (u || '').trim();
  if (s.startsWith('stremio://')) s = 'https://' + s.slice('stremio://'.length);
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
  if (!/manifest\.json(\?.*)?$/.test(s)) s = s.replace(/\/+$/, '') + '/manifest.json';
  return s;
}
const base = (transportUrl) => transportUrl.replace(/\/manifest\.json(\?.*)?$/, '');

async function getJSON(url, ms = 12000) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctl.signal });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } finally { clearTimeout(timer); }
}

const cache = new Map();
async function cached(url, ms) {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.t < 10 * 60 * 1000) return hit.v;
  const v = await getJSON(url, ms);
  cache.set(url, { t: Date.now(), v });
  if (cache.size > 300) cache.delete(cache.keys().next().value); // bounded memory
  return v;
}

export async function installAddon(url) {
  const transportUrl = normalizeUrl(url);
  const manifest = await getJSON(transportUrl);
  if (!manifest || !manifest.id || !manifest.resources) throw new Error('bad manifest');
  return { transportUrl, id: manifest.id, manifest };
}

const resName = (r) => (typeof r === 'string' ? r : r && r.name);
function supports(addon, resource, type, id) {
  const m = addon.manifest;
  const r = (m.resources || []).find((x) => resName(x) === resource);
  if (!r) return false;
  const types = (typeof r === 'object' && r.types) || m.types || [];
  if (type && types.length && !types.includes(type)) return false;
  const prefixes = (typeof r === 'object' && r.idPrefixes) || m.idPrefixes;
  if (id && prefixes && prefixes.length && !prefixes.some((p) => id.startsWith(p))) return false;
  return true;
}
const active = (addons) => addons.filter((a) => !a.disabled);

export function catalogsOf(addons) {
  const out = [];
  for (const a of active(addons)) for (const c of a.manifest.catalogs || []) {
    const req = (c.extra || []).filter((e) => e.isRequired).map((e) => e.name);
    if (req.length) continue; // needs search/genre to work
    out.push({ addon: a, ...c });
  }
  return out;
}

export async function fetchCatalog(addon, type, id, extra = {}) {
  if (addon.transportUrl === OPEN_MOVIES_URL) return openMoviesMetas();
  const ex = Object.entries(extra).filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
  const url = `${base(addon.transportUrl)}/catalog/${type}/${encodeURIComponent(id)}${ex ? '/' + ex : ''}.json`;
  const j = await cached(url);
  return (j.metas || []).map((m) => ({ ...m, type: m.type || type }));
}

async function openMoviesMetas() {
  const metas = await Promise.all(OPEN_MOVIES.map(async (o) => {
    try { const m = await getMeta('movie', o.id, DEFAULT_ADDONS); return { ...m, id: o.id, type: 'movie' }; }
    catch { return { id: o.id, type: 'movie', name: o.name, releaseInfo: o.year }; }
  }));
  return metas;
}

export async function search(addons, q) {
  const cats = [];
  for (const a of active(addons)) for (const c of a.manifest.catalogs || [])
    if ((c.extra || []).some((e) => e.name === 'search') || (c.extraSupported || []).includes('search')) cats.push({ a, c });
  const res = await Promise.allSettled(cats.map(({ a, c }) => fetchCatalog(a, c.type, c.id, { search: q })));
  const seen = new Set(); const out = [];
  res.forEach((r) => { if (r.status === 'fulfilled') for (const m of r.value) if (!seen.has(m.id)) { seen.add(m.id); out.push(m); } });
  return out;
}

// Warm the metadata cache as soon as a title is tapped, so the page (and its trailer) can start sooner.
export function prefetchMeta(type, id) {
  if (!/^tt\d+/.test(id || '')) return;
  cached(`${base(CINEMETA)}/meta/${type}/${encodeURIComponent(id)}.json`)
    .catch(() => {});
}

export async function getMeta(type, id, addons) {
  for (const a of active(addons)) {
    if (!supports(a, 'meta', type, id)) continue;
    try {
      const j = await cached(`${base(a.transportUrl)}/meta/${type}/${encodeURIComponent(id)}.json`);
      if (j && j.meta) return { ...j.meta, type: j.meta.type || type };
    } catch {}
  }
  throw new Error('no meta');
}

// Returns { direct: [...], external: [...], torrents: [...] }.
// onUpdate(partial) fires every time one add-on answers, so the UI can show sources as they arrive.
// Add-ons that fail or answer empty (cold caches are common) are retried before giving up.
export async function getStreams(type, id, addons, { onUpdate, signal } = {}) {
  const direct = [], external = [], torrents = [];
  const snap = () => ({ direct: [...direct], external: [...external], torrents: [...torrents] });
  const jobs = active(addons).filter((a) => supports(a, 'stream', type, id)).map(async (a) => {
    if (a.transportUrl === OPEN_MOVIES_URL) {
      const o = OPEN_MOVIES.find((x) => x.id === id);
      if (o) {
        const all = [...o.urls.map((u) => u[1]), OPEN_BASE + o.file + '.mp4'];
        o.urls.forEach(([label, url], i) => direct.push({ addon: 'Open Movies', name: 'Blender · CC BY', title: `${o.name} · ${label}`, url,
          fallbacks: all.filter((x) => x !== url), builtinRank: 100 - i }));
        onUpdate?.(snap());
      }
      return;
    }
    const u = `${base(a.transportUrl)}/stream/${type}/${encodeURIComponent(id)}.json`;
    for (let attempt = 0; attempt < 3; attempt++) {
      if (signal?.aborted) return;
      if (attempt) await new Promise((r) => setTimeout(r, 1200 * attempt));
      let j;
      try { j = await getJSON(u, 25000); } catch { continue; }
      const list = j?.streams || [];
      if (!list.length) continue; // cold add-on cache: ask again
      for (const s of list) {
        if (isTorrentStream(s)) { const tt = normalizeTorrent(s, a.manifest.name); if (tt) torrents.push(tt); continue; }
        if (s.url && /^https?:/i.test(s.url)) direct.push({ ...s, addon: a.manifest.name });
        else if (s.externalUrl && /^https?:/i.test(s.externalUrl)) external.push({ ...s, addon: a.manifest.name });
      }
      if (!signal?.aborted) onUpdate?.(snap());
      return;
    }
  });
  await Promise.all(jobs);
  return snap();
}

// extra: { videoHash, videoSize, filename } — Stremio subtitle extras; OpenSubtitles uses the hash to put exact
// matches for this very file first.
export async function getSubtitles(type, id, addons, langs, extra) {
  const out = [];
  const ex = extra ? Object.entries(extra).filter(([, v]) => v != null && v !== '').map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&') : '';
  await Promise.all(active(addons).filter((a) => supports(a, 'subtitles', type, id)).map(async (a) => {
    try {
      const j = await getJSON(`${base(a.transportUrl)}/subtitles/${type}/${encodeURIComponent(id)}${ex ? '/' + ex : ''}.json`);
      for (const s of j.subtitles || []) if (s.url) out.push({ ...s, addon: a.manifest.name });
    } catch {}
  }));
  const rank = (l) => { const i = langs.indexOf(l); return i < 0 ? 99 : i; };
  return out.sort((x, y) => rank(x.lang) - rank(y.lang));
}

export function streamQuality(s) {
  if (s.builtinRank) return 10000 + s.builtinRank;
  const txt = `${s.name || ''} ${s.title || ''} ${s.description || ''}`;
  const m = txt.match(/(2160|1440|1080|720|576|480|360)p/i) || (/4k/i.test(txt) && ['', '2160']);
  return m ? +m[1] : 0;
}

// Kids filter: Cinemeta has no rating data, so kids profiles use genres.
const KID_OK = ['Animation', 'Family'];
const KID_BAD = ['Horror', 'Crime', 'War', 'Thriller', 'Mystery'];
export function allowedFor(profile, meta) {
  if (!profile || profile.maturity === 'adult' && !profile.kids) return true;
  const g = meta.genres || meta.genre || [];
  if (profile.kids || profile.maturity === 'all') return g.some((x) => KID_OK.includes(x)) && !g.some((x) => KID_BAD.includes(x));
  if (profile.maturity === 'teen') return !g.includes('Horror');
  return true;
}
