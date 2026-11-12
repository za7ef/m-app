// Downloads for offline playback.
//
// Three kinds of source:
//  - torrent (built-in engine): the Go engine downloads the chosen file into Documents/downloads/torrents and resumes
//    after a pause or an app restart (pieces already on disk are kept).
//  - http (mp4/mkv links, and torrents resolved through debrid or a streaming server): expo-file-system's resumable
//    download, in a background session on iOS, so it keeps going while the app is in the background.
//  - hls (m3u8): the segments are downloaded one by one and joined into a single local file (.ts, or .mp4 for fMP4
//    streams). Encrypted streams are not supported.
// The chosen subtitle (and its translation, when subtitle translation is on) is saved next to the video.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Platform } from 'react-native';
import * as LegacyFS from 'expo-file-system/legacy';
import { File, Paths } from 'expo-file-system';
import * as Network from 'expo-network';
import { useEffect, useState } from 'react';
import { prepareTorrentDownload, engineStartFor, torrentDownloadStart, torrentDownloadStatus, torrentDownloadStop, sizeBytes } from './torrent';
import { getSubtitles, streamQuality } from './addons';
import { loadSubs } from './subs';
import { rankSubs } from './subtools';
import { createTranslator } from './subtrans';
import { getLang } from './i18n';

const KEY = 'm-app.downloads';
const DIR = LegacyFS.documentDirectory + 'downloads/';
const MAX_ACTIVE = 2;
export const LOW_SPACE = 1.5 * 1024 ** 3; // warn when less than this would be left

let items = {}; // id (video id) -> item
let loaded = null;
let settingsRef = {};
let addonsRef = [];
const listeners = new Set();
const running = {}; // id -> { stop() } for active jobs
let saveT = null;

const persist = () => {
  clearTimeout(saveT);
  saveT = setTimeout(() => AsyncStorage.setItem(KEY, JSON.stringify(items)).catch(() => {}), 800);
};
const emit = () => { const snap = { ...items }; listeners.forEach((f) => f(snap)); };
const update = (id, patch) => {
  if (!items[id]) return;
  items[id] = { ...items[id], ...patch };
  emit(); persist();
};

export function initDownloads() {
  if (loaded) return loaded;
  loaded = (async () => {
    try { items = JSON.parse((await AsyncStorage.getItem(KEY)) || '{}'); } catch { items = {}; }
    // anything that was running when the app closed carries on
    Object.values(items).forEach((it) => { if (it.status === 'downloading' || it.status === 'preparing') items[it.id] = { ...it, status: 'queued', speed: 0 }; });
    await LegacyFS.makeDirectoryAsync(DIR, { intermediates: true }).catch(() => {});
    emit();
    pump();
  })();
  AppState.addEventListener('change', (s) => { if (s === 'active') pump(); });
  setInterval(() => { if (Object.values(items).some((x) => x.status === 'wifi' || x.status === 'queued')) pump(); }, 20000);
  return loaded;
}

// Keep the manager in step with the app's settings and add-ons (called from the store on change).
export function setDownloadContext(settings, addons) { settingsRef = settings || {}; addonsRef = addons || []; }

export function useDownloads() {
  const [snap, setSnap] = useState(items);
  useEffect(() => { initDownloads(); listeners.add(setSnap); setSnap({ ...items }); return () => { listeners.delete(setSnap); }; }, []);
  return snap;
}

export const getDownload = (id) => items[id] || null;

// ---- storage ----
export async function storageInfo() {
  let free = null; let total = null;
  try { free = Paths.availableDiskSpace; total = Paths.totalDiskSpace; } catch {}
  if (free == null) { try { free = await LegacyFS.getFreeDiskStorageAsync(); total = await LegacyFS.getTotalDiskCapacityAsync(); } catch {} }
  const used = Object.values(items).reduce((n, x) => n + (x.bytes || 0), 0);
  return { free, total, used };
}

// ---- adding ----

// Estimated size of a source in bytes (torrent add-ons write it in the title), or null.
export const sourceSize = (s) => (s?.size ? sizeBytes(s.size) : null) || (s?.behaviorHints?.videoSize || null);
export const sourceLabel = (s) => ((s?.name || s?.addon || '').replace(/\n/g, ' ') + (s?.title ? ' · ' + String(s.title).split('\n')[0] : '')).trim();

// item: { id, metaId, type, title, subtitle, season, episode, poster, thumb, source }
export async function addDownload(item) {
  await initDownloads();
  const it = items[item.id];
  if (it && it.status !== 'error') return;
  const s = item.source;
  items[item.id] = {
    ...item,
    source: {
      kind: s.infoHash ? 'torrent' : 'http', infoHash: s.infoHash, fileIdx: s.fileIdx, trackers: s.trackers, filename: s.filename || s.behaviorHints?.filename,
      url: s.url, headers: s.behaviorHints?.proxyHeaders?.request, name: s.name, title: s.title, addon: s.addon,
      size: sourceSize(s), quality: streamQuality(s), label: sourceLabel(s),
    },
    status: 'queued', bytes: 0, total: sourceSize(s) || 0, speed: 0, addedAt: Date.now(), error: null,
  };
  emit(); persist();
  pump();
}

export function pauseDownload(id) {
  running[id]?.stop('paused');
  update(id, { status: 'paused', speed: 0 });
}
export function resumeDownload(id) {
  if (!items[id]) return;
  update(id, { status: 'queued', error: null });
  pump();
}
export async function removeDownload(id) {
  const it = items[id];
  running[id]?.stop('removed');
  delete running[id];
  if (!it) return;
  delete items[id];
  emit(); persist();
  if (it.job?.infoHash != null) torrentDownloadStop(it.job.infoHash, it.job.fileIdx).catch(() => {});
  const del = (u) => u && LegacyFS.deleteAsync(u, { idempotent: true }).catch(() => {});
  del(it.file); del(it.file && it.file + '.part'); del(it.tmp); del(it.subFile); del(it.trFile);
  if (it.job?.path) { del('file://' + it.job.path); del('file://' + it.job.path + '.part'); }
}

// What the player needs to play a finished download without internet.
export async function offlineSession(id) {
  const it = items[id];
  if (!it || it.status !== 'done' || !it.file) return null;
  const read = async (u) => { try { return u ? JSON.parse(await LegacyFS.readAsStringAsync(u)) : null; } catch { return null; } };
  const sub = await read(it.subFile);
  const tr = await read(it.trFile);
  return { url: it.file, offline: { sub: sub?.sub || null, cues: sub?.cues || null, tr: tr?.lang === getLang() ? tr.tr : null } };
}

// ---- scheduler ----
async function wifiOk() {
  if (!settingsRef.dlWifiOnly) return true;
  try { const n = await Network.getNetworkStateAsync(); return n.type === Network.NetworkStateType.WIFI || n.type === Network.NetworkStateType.ETHERNET; } catch { return true; }
}

let pumping = false;
async function pump() {
  if (pumping) return;
  pumping = true;
  try {
    const waiting = Object.values(items).filter((x) => x.status === 'queued' || x.status === 'wifi').sort((a, b) => a.addedAt - b.addedAt);
    if (!waiting.length) return;
    const ok = await wifiOk();
    for (const it of waiting) {
      if (!ok) { if (it.status !== 'wifi') update(it.id, { status: 'wifi' }); continue; }
      if (Object.keys(running).length >= MAX_ACTIVE) { if (it.status === 'wifi') update(it.id, { status: 'queued' }); continue; }
      start(it.id);
    }
  } finally { pumping = false; }
}

function start(id) {
  let stopped = null;
  const ctl = { stop: (why) => { stopped = why || 'paused'; ctl.onStop?.(); } };
  running[id] = ctl;
  update(id, { status: 'preparing', error: null });
  const isStopped = () => stopped;
  (async () => {
    try {
      let it = items[id];
      if (!it.job) {
        const src = it.source;
        let job;
        if (src.kind === 'torrent') {
          const r = await prepareTorrentDownload(src, settingsRef, {});
          job = r.kind === 'torrent' ? { kind: 'torrent', infoHash: r.infoHash, fileIdx: r.fileIdx, magnet: r.magnet, name: r.name }
            : { kind: /\.m3u8(\?|$)/i.test(r.url) ? 'hls' : 'http', url: r.url, name: r.filename };
          if (r.length) update(id, { total: r.length });
        } else job = { kind: /\.m3u8(\?|$)/i.test(src.url || '') ? 'hls' : 'http', url: src.url, headers: src.headers, name: src.filename };
        update(id, { job });
        it = items[id];
      }
      if (isStopped()) return;
      update(id, { status: 'downloading' });
      saveSubtitles(id).catch(() => {});
      const job = it.job;
      if (job.kind === 'torrent') await runTorrent(id, job, ctl, isStopped);
      else if (job.kind === 'hls') await runHls(id, job, ctl, isStopped);
      else await runHttp(id, job, ctl, isStopped);
      if (!isStopped() && items[id]) update(id, { status: 'done', speed: 0, doneAt: Date.now() });
    } catch (e) {
      if (!isStopped() && items[id]) update(id, { status: 'error', speed: 0, error: e?.code || e?.message || 'error' });
    } finally {
      if (running[id] === ctl) delete running[id];
      pump();
    }
  })();
}

const extOf = (name, url, fallback) => {
  const m = /\.(mp4|m4v|mov|mkv|webm|avi|ts)(\?|$)/i.exec(name || '') || /\.(mp4|m4v|mov|mkv|webm|avi|ts)(\?|$)/i.exec(url || '');
  return m ? m[1].toLowerCase() : fallback;
};
const safe = (id) => String(id).replace(/[^\w.-]+/g, '_');

async function runHttp(id, job, ctl, isStopped) {
  const it = items[id];
  const file = it.file || DIR + safe(id) + '.' + extOf(job.name, job.url, 'mp4');
  if (!it.file) update(id, { file });
  let last = { t: Date.now(), b: it.bytes || 0 };
  const onProgress = ({ totalBytesWritten: w, totalBytesExpectedToWrite: tot }) => {
    const now = Date.now();
    const patch = { bytes: w };
    if (tot > 0) patch.total = tot;
    if (now - last.t >= 1000) { patch.speed = Math.max(0, ((w - last.b) * 1000) / (now - last.t)); last = { t: now, b: w }; }
    else if (now - last.t < 300) return;
    update(id, patch);
  };
  const dl = LegacyFS.createDownloadResumable(job.url, file, { headers: job.headers || {} }, onProgress, it.resumeData || undefined);
  let saver = null;
  ctl.onStop = () => {
    clearInterval(saver);
    dl.pauseAsync().then((r) => { if (items[id]) update(id, { resumeData: r?.resumeData || null }); }).catch(() => {});
  };
  // remember where we are now and then, so a killed app can resume instead of starting over
  saver = setInterval(() => { try { const s = dl.savable(); if (s?.resumeData) update(id, { resumeData: s.resumeData }); } catch {} }, 10000);
  try {
    const r = it.resumeData ? await dl.resumeAsync() : await dl.downloadAsync();
    if (isStopped()) return;
    if (!r || (r.status && r.status >= 400)) throw new Error('http ' + (r?.status || ''));
    const info = await LegacyFS.getInfoAsync(file);
    update(id, { bytes: info.size || items[id].bytes, total: info.size || items[id].total, resumeData: null });
  } finally { clearInterval(saver); }
  if (isStopped()) throw Object.assign(new Error('stopped'), { code: 'stopped' });
}

async function runTorrent(id, job, ctl, isStopped) {
  await engineStartFor(settingsRef);
  await torrentDownloadStart(job.magnet, job.fileIdx);
  ctl.onStop = () => torrentDownloadStop(job.infoHash, job.fileIdx).catch(() => {});
  let last = null;
  while (!isStopped()) {
    const st = await torrentDownloadStatus(job.infoHash, job.fileIdx).catch(() => ({}));
    if (st.err) throw new Error(st.err);
    if (st.length) {
      const now = Date.now();
      const patch = { bytes: st.completed || 0, total: st.length, peers: st.peers || 0 };
      if (last) patch.speed = Math.max(0, ((st.completed - last.b) * 1000) / (now - last.t));
      last = { t: now, b: st.completed || 0 };
      update(id, patch);
    }
    if (st.done && st.path) {
      update(id, { file: 'file://' + st.path, job: { ...job, path: st.path } });
      // keep seeding off: the file is complete, release it from the engine
      torrentDownloadStop(job.infoHash, job.fileIdx).catch(() => {});
      return;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
}

// HLS: pick the best variant, then fetch segments in order and append them to one file.
// relative playlist URIs (RN's URL class doesn't resolve them reliably)
const abs = (u, base) => {
  if (/^https?:\/\//i.test(u)) return u;
  const origin = /^(https?:\/\/[^/]+)/i.exec(base)?.[1] || '';
  if (u.startsWith('//')) return (/^(https?:)/i.exec(base)?.[1] || 'https:') + u;
  if (u.startsWith('/')) return origin + u;
  return base.split('?')[0].replace(/[^/]*$/, '') + u;
};
async function getText(url, headers) {
  const r = await fetch(url, { headers: headers || {} });
  if (!r.ok) throw new Error('http ' + r.status);
  return { text: await r.text(), url: r.url || url };
}
async function runHls(id, job, ctl, isStopped) {
  let { text, url } = await getText(job.url, job.headers);
  if (/#EXT-X-STREAM-INF/.test(text)) {
    const lines = text.split(/\r?\n/);
    let best = null;
    lines.forEach((l, i) => {
      const m = /#EXT-X-STREAM-INF:.*?BANDWIDTH=(\d+)/.exec(l);
      if (m && lines[i + 1] && !lines[i + 1].startsWith('#')) { const bw = +m[1]; if (!best || bw > best.bw) best = { bw, uri: abs(lines[i + 1].trim(), url) }; }
    });
    if (!best) throw new Error('hls: no variant');
    ({ text, url } = await getText(best.uri, job.headers));
  }
  if (/#EXT-X-KEY:METHOD=(?!NONE)/.test(text)) throw Object.assign(new Error('hls encrypted'), { code: 'hlsEncrypted' });
  const lines = text.split(/\r?\n/);
  const segs = lines.filter((l) => l && !l.startsWith('#')).map((l) => abs(l.trim(), url));
  const map = /#EXT-X-MAP:URI="([^"]+)"/.exec(text);
  const fmp4 = !!map;
  const it = items[id];
  const file = it.file || DIR + safe(id) + (fmp4 ? '.mp4' : '.ts');
  if (!it.file) update(id, { file });
  const f = new File(file);
  let next = it.hlsNext || 0;
  if (next === 0) { try { if (f.exists) f.delete(); } catch {} f.create(); }
  const fetchBytes = async (u) => { const r = await fetch(u, { headers: job.headers || {} }); if (!r.ok) throw new Error('http ' + r.status); return new Uint8Array(await r.arrayBuffer()); };
  if (next === 0 && fmp4) await f.write(await fetchBytes(abs(map[1], url)), { append: true });
  let bytes = it.bytes || 0;
  let last = { t: Date.now(), b: bytes };
  for (; next < segs.length; next++) {
    if (isStopped()) throw Object.assign(new Error('stopped'), { code: 'stopped' });
    let data = null;
    for (let a = 0; a < 4 && !data; a++) {
      try { data = await fetchBytes(segs[next]); } catch (e) { if (a === 3) throw e; await new Promise((r) => setTimeout(r, 2000 * (a + 1))); }
    }
    await f.write(data, { append: true });
    bytes += data.length;
    const now = Date.now();
    const patch = { bytes, hlsNext: next + 1, total: Math.round((bytes / (next + 1)) * segs.length) };
    if (now - last.t >= 1000) { patch.speed = ((bytes - last.b) * 1000) / (now - last.t); last = { t: now, b: bytes }; }
    update(id, patch);
  }
  update(id, { total: bytes });
}

// ---- subtitles saved with the video ----
async function saveSubtitles(id) {
  const it = items[id];
  if (!it || it.subFile) return;
  const st = settingsRef;
  if (!st.subLang || st.subLang === 'off') return;
  const ISO = { ar: 'ara', en: 'eng', fr: 'fre', es: 'spa', de: 'ger', tr: 'tur', ur: 'urd', id: 'ind', fa: 'per', hi: 'hin', it: 'ita', pt: 'por', ru: 'rus', ja: 'jpn', ko: 'kor', zh: 'chi' };
  const langs = [st.subLang, st.subFallback].filter(Boolean).map((l) => ISO[l] || l);
  const list = await getSubtitles(it.type, it.id, addonsRef, langs, it.source?.filename ? { filename: it.source.filename } : null).catch(() => []);
  const rank = (l) => { const i = langs.indexOf(l); return i < 0 ? 99 : i; };
  const sub = rankSubs(list, rank, it.source?.filename || it.source?.label || '').find((x) => rank(x.lang) < 99);
  if (!sub) return;
  const cues = await loadSubs(sub.url).catch(() => null);
  if (!cues?.length) return;
  const subFile = DIR + safe(id) + '.sub.json';
  await LegacyFS.writeAsStringAsync(subFile, JSON.stringify({ sub: { id: sub.id, url: sub.url, lang: sub.lang, addon: sub.addon }, cues }));
  update(id, { subFile, subLang: sub.lang });
  // translation into the app language, when that is on
  const app = getLang();
  const subLang2 = Object.keys(ISO).find((k) => ISO[k] === sub.lang) || sub.lang;
  if (!st.subTranslate || subLang2 === app) return;
  const engine = st.subTrEngine === 'google' ? 'google' : st.subTrEngine === 'gemini' ? 'gemini' : (st.geminiKey ? 'gemini' : 'google');
  if (engine === 'gemini' && !st.geminiKey) return;
  const tr = await new Promise((resolve) => {
    let map = {};
    const c = createTranslator({ cues, lang: app, engine, apiKey: st.geminiKey, cacheId: String(sub.id || sub.url),
      onUpdate: (m, p) => { map = m; if (p.total && p.done >= p.total) { c.stop(); resolve(map); } },
      onError: (e) => { if (e === 'key') { c.stop(); resolve(map); } } });
    c.focus(0);
    setTimeout(() => { c.stop(); resolve(map); }, 10 * 60000);
  });
  if (!Object.keys(tr).length) return;
  const trFile = DIR + safe(id) + '.tr.json';
  await LegacyFS.writeAsStringAsync(trFile, JSON.stringify({ lang: app, engine, tr }));
  update(id, { trFile });
}

export const isIOS = Platform.OS === 'ios';
