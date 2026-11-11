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
