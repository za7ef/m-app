// Merge rules for local <-> cloud state. Pure functions, no I/O.
// - profiles: union by id; same id → the one with newer `at`.
// - My List: union by id; removals are tombstones (removed[id] = time) so they don't come back.
// - progress (latest per title) and watched (per episode/video): newer `at` wins.
// - settings: newer `settingsAt` wins.

const newer = (a, b) => ((a?.at || 0) >= (b?.at || 0) ? a : b);

function mergeMap(a = {}, b = {}) {
  const out = { ...a };
  for (const k of Object.keys(b)) out[k] = out[k] ? newer(out[k], b[k]) : b[k];
  return out;
}

function mergeList(la = [], lb = [], ra = {}, rb = {}) {
  const removed = { ...ra };
  for (const k of Object.keys(rb)) removed[k] = Math.max(removed[k] || 0, rb[k]);
  const byId = {};
  for (const x of [...la, ...lb]) byId[x.id] = byId[x.id] ? newer(byId[x.id], x) : x;
  const list = Object.values(byId).filter((x) => (x.at || 0) > (removed[x.id] || 0)).sort((x, y) => (y.at || 0) - (x.at || 0));
  return { list, removed };
}

function since(m, t) { const o = {}; for (const k of Object.keys(m)) if ((m[k].at || 0) > t) o[k] = m[k]; return o; }
function mergeData(a = {}, b = {}) {
  const ml = mergeList(a.list, b.list, a.removed, b.removed);
  const clearedAt = Math.max(a.clearedAt || 0, b.clearedAt || 0); // "clear history" wins over older entries
  return { list: ml.list, removed: ml.removed, clearedAt,
    progress: since(mergeMap(a.progress, b.progress), clearedAt), watched: since(mergeMap(a.watched, b.watched), clearedAt) };
}

export function mergeState(local, cloud) {
  if (!cloud) return local;
  const profiles = {};
  const deleted = { ...(local.deletedProfiles || {}) };
  for (const k of Object.keys(cloud.deletedProfiles || {})) deleted[k] = Math.max(deleted[k] || 0, cloud.deletedProfiles[k]);
  for (const p of [...(local.profiles || []), ...(cloud.profiles || [])]) profiles[p.id] = profiles[p.id] ? newer(profiles[p.id], p) : p;
  const plist = Object.values(profiles).filter((p) => !deleted[p.id] || (p.at || 0) > deleted[p.id]);
  const data = {};
  for (const p of plist) data[p.id] = mergeData(local.data?.[p.id], cloud.data?.[p.id]);
  const useCloudSettings = (cloud.settingsAt || 0) > (local.settingsAt || 0);
  return {
    ...local,
    profiles: plist.length ? plist : local.profiles,
    data,
    deletedProfiles: deleted,
    settings: useCloudSettings ? { ...local.settings, ...stripLocal(cloud.settings) } : local.settings,
    settingsAt: Math.max(local.settingsAt || 0, cloud.settingsAt || 0),
  };
}

// Torrent keys hold the user's debrid API token / server address: they stay on this device.
import { TORRENT_SETTINGS } from './torrent';
// The Gemini key is the user's own secret too: device-only.
const stripLocal = (settings = {}) => { const o = { ...settings }; TORRENT_SETTINGS.forEach((k) => delete o[k]); delete o.geminiKey; return o; };

// What goes to the cloud (no add-on manifests' runtime fields, no active profile).
export function toCloud(s) {
  return {
    v: 1,
    profiles: s.profiles,
    data: s.data,
    deletedProfiles: s.deletedProfiles || {},
    settings: stripLocal(s.settings),
    settingsAt: s.settingsAt || 0,
    addons: (s.addons || []).filter((a) => !a.core).map((a) => ({ transportUrl: a.transportUrl, disabled: !!a.disabled })),
    updatedAt: Date.now(),
  };
}

export const sameCloud = (a, b) => JSON.stringify({ ...a, updatedAt: 0 }) === JSON.stringify({ ...b, updatedAt: 0 });
