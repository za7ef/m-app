import { requireOptionalNativeModule } from 'expo-modules-core';

// Native torrent engine (engine/ Go package via gomobile). Null when the native part isn't in the build.
const N = requireOptionalNativeModule('MTorrent');
export const engineAvailable = !!N;

export const start = (dir, uploadKBps) => N.start(dir, uploadKBps);
export const add = async (magnet, timeoutSec) => JSON.parse(await N.add(magnet, timeoutSec));
export const addTorrentUrl = async (url) => JSON.parse(await N.addTorrentUrl(url));
export const stats = async (ih) => JSON.parse((await N.stats(ih)) || '{}');
export const drop = (ih) => N.drop(ih);
export const dropAll = () => N.dropAll();
export const stop = () => N.stop();
export const cacheSize = () => N.cacheSize();
export const trimCache = (maxMB) => N.trimCache(maxMB);
export const cacheDir = () => N.cacheDir();
// Base URL for streams; includes the engine's per-session secret.
export const streamBase = (port) => `http://127.0.0.1:${port}/stream/${N.token()}`;
export const addAsync = (magnet) => N.addAsync(magnet);
export const info = async (ih) => { const r = await N.info(ih); return r ? JSON.parse(r) : null; };
export const dhtNodes = () => N.dhtNodes();
// Downloads (whole file kept for offline playback, separate from the streaming cache)
export const downloadsDir = () => N.downloadsDir();
export const downloadStart = (magnet, fileIdx, dir) => N.downloadStart(magnet, fileIdx, dir);
export const downloadStatus = async (ih, fileIdx) => JSON.parse((await N.downloadStatus(ih, fileIdx)) || '{}');
export const downloadStop = (ih, fileIdx) => N.downloadStop(ih, fileIdx);
// iOS: mark a folder (and all files under it) as excluded from iCloud backup. No-op elsewhere / without the module.
export const excludeFromBackup = (path) => (N?.excludeFromBackup ? N.excludeFromBackup(path).catch(() => 0) : Promise.resolve(0));
