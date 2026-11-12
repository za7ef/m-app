import React, { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { AppState } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { setLang } from './i18n';
import { THEMES } from './theme';
import { DEFAULT_ADDONS, installAddon } from './addons';
import { onUser, pullCloud, pushCloud, watchCloud, cloudEnabled } from './firebase';
import { mergeState, toCloud, sameCloud } from './sync';
import { hashProfiles } from './pin';

const KEY = 'm-app:v1';


// History is capped so the synced document stays far below Firestore's 1 MB limit (oldest entries drop first).
const MAX_PROGRESS = 150, MAX_WATCHED = 1500;
function newest(m, max) {
  const keys = Object.keys(m);
  if (keys.length <= max) return m;
  const o = {};
  keys.sort((a, b) => (m[b].at || 0) - (m[a].at || 0)).slice(0, max).forEach((k) => { o[k] = m[k]; });
  return o;
}

export const DEFAULT_SETTINGS = {
  lang: 'ar', theme: 'orbit',
  audioLang: 'ar', subLang: 'ar', subFallback: 'en', autoSubs: true,
  autoNext: true, previews: true, speed: 1, skip: 10, skipIntro: true, resume: true,
  haptics: true, keepAwake: true, bgAudio: false,
  subSize: 'medium', subColor: '#FFFFFF', subBg: 'dim', subFont: 'system', subShadow: true,
  dataUsage: 'auto', wifiOnly: false, playerEngine: 'auto', devTools: false,
  subTranslate: false, subTrEngine: 'auto', geminiKey: '', // subtitle translation (key: device-only, SecureStore)
  torrentMode: 'off', debridProvider: 'realdebrid', debridToken: '', streamServer: '', directUploadKBps: 100, // torrent add-ons (device-only, never synced; token kept in SecureStore)
};

const newProfile = (name, i = 0) => ({
  id: 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
  name, icon: ['planet', 'rocket', 'moon', 'flash'][i % 4], color: ['#8B5CF6', '#22D3EE', '#10B981', '#F5B83D'][i % 4],
  kids: false, maturity: 'adult', pin: null, at: Date.now(),
});

const initial = () => {
  const p = newProfile('محمد', 0);
  return {
    settings: DEFAULT_SETTINGS,
    addons: DEFAULT_ADDONS,
    profiles: [p],
    activeProfile: null, // chosen on launch ("who's watching")
    data: { [p.id]: { list: [], progress: {} } }, // per-profile My List + progress
  };
};

const Ctx = createContext(null);

const TOKEN_KEY = 'm-app.debridToken';
const GEMINI_KEY = 'm-app.geminiKey';

export function StoreProvider({ children }) {
  const [state, setState] = useState(null);
  const saveT = useRef(null);
  const lastTok = useRef(null);
  const lastGem = useRef(null);

  useEffect(() => {
    (async () => {
      let s = initial();
      try {
        const raw = await AsyncStorage.getItem(KEY);
        if (raw) {
          const p = JSON.parse(raw);
          s = { ...s, ...p, settings: { ...DEFAULT_SETTINGS, ...(p.settings || {}) }, activeProfile: null };
          // keep core add-ons present
          for (const a of DEFAULT_ADDONS) if (a.core && !s.addons.find((x) => x.id === a.id)) s.addons.unshift(a);
        }
      } catch {}
      try { const tok = await SecureStore.getItemAsync(TOKEN_KEY); if (tok) s.settings = { ...s.settings, debridToken: tok }; } catch {}
      try { const gk = await SecureStore.getItemAsync(GEMINI_KEY); if (gk) s.settings = { ...s.settings, geminiKey: gk }; lastGem.current = gk || ''; } catch { lastGem.current = ''; }
      s = { ...s, profiles: hashProfiles(s.profiles) }; // old installs kept PINs in plain text
      setLang(s.settings.lang);
      setState(s);
    })();
  }, []);

  const writeLocal = useRef(null);
  writeLocal.current = (st) => {
      const { activeProfile, ...rest } = st;
      const tok = rest.settings?.debridToken || '';
      // the debrid token never goes into plain storage
      AsyncStorage.setItem(KEY, JSON.stringify({ ...rest, settings: { ...rest.settings, debridToken: '', geminiKey: '' } })).catch(() => {});
      const gk = rest.settings?.geminiKey || '';
      if (lastGem.current !== null && gk !== lastGem.current) {
        lastGem.current = gk;
        (gk ? SecureStore.setItemAsync(GEMINI_KEY, gk) : SecureStore.deleteItemAsync(GEMINI_KEY)).catch(() => {});
      }
      if (tok !== lastTok.current) {
        lastTok.current = tok;
        (tok ? SecureStore.setItemAsync(TOKEN_KEY, tok) : SecureStore.deleteItemAsync(TOKEN_KEY)).catch(() => {});
      }
  };
  useEffect(() => {
    if (!state) return;
    clearTimeout(saveT.current);
    saveT.current = setTimeout(() => { saveT.current = null; writeLocal.current(state); }, 800);
  }, [state]);
  // Write a pending save right away when the app leaves the foreground: the OS may kill it there.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') return;
      // short delay so the player's own last-position save (same event) is included
      setTimeout(() => {
        if (!saveT.current || !stateRef.current) return;
        clearTimeout(saveT.current); saveT.current = null;
        writeLocal.current(stateRef.current);
      }, 80);
    });
    return () => sub.remove();
  }, []);

  // ---- account + cloud sync (offline-first: local state is the source; cloud is merged in) ----
  const [user, setUser] = useState(undefined); // undefined = unknown yet, null = signed out
  const [syncState, setSyncState] = useState('idle'); // idle | syncing | ok | error
  const lastPushAt = useRef(0);
  const pushT = useRef(null);
  const lastPushed = useRef('');
  const stateRef = useRef(null);
  stateRef.current = state;

  const applyCloud = useCallback((cloud) => {
    setState((prev) => {
      if (!prev) return prev;
      const m0 = mergeState(prev, cloud);
      const merged = { ...m0, profiles: hashProfiles(m0.profiles) };
      // Nothing actually changed: keep the same object, so no re-render and no push back (two devices used to
      // bounce the same data to each other every ~30 s forever).
      if (sameCloud(toCloud(merged), toCloud(prev))) return prev;
      if (merged.settings.lang !== prev.settings.lang) setLang(merged.settings.lang);
      return merged;
    });
    // add-ons installed on another device
    const have = new Set((stateRef.current?.addons || []).map((a) => a.transportUrl));
    for (const a of cloud?.addons || []) if (!have.has(a.transportUrl)) {
      installAddon(a.transportUrl).then((x) => setState((p) => (p.addons.some((y) => y.transportUrl === x.transportUrl) ? p : { ...p, addons: [...p.addons, { ...x, disabled: a.disabled }] }))).catch(() => {});
    }
  }, []);

  useEffect(() => {
    const fallback = setTimeout(() => setUser((u) => (u === undefined ? null : u)), 5000);
    let off = () => {};
    try { off = onUser((u) => { console.log('[auth] state', !!u); setUser(u || null); }); } catch (e) { console.warn('[auth] onUser threw', e?.message); setUser(null); }
    return () => { clearTimeout(fallback); off(); };
  }, []);
  useEffect(() => {
    if (!user || !state) return;
    let off = () => {};
    (async () => {
      setSyncState('syncing');
      try {
        const cloud = await pullCloud(user.uid);
        if (cloud) applyCloud(cloud);
        else await pushCloud(user.uid, toCloud(stateRef.current)); // first sign-in: upload local data
        setSyncState('ok');
        off = watchCloud(user.uid, (c) => { if (JSON.stringify(c.updatedAt) !== lastPushed.current) applyCloud(c); });
      } catch { setSyncState('error'); }
    })();
    return () => off();
  }, [user?.uid, !!state]);
  useEffect(() => {
    if (!user || !state) return;
    clearTimeout(pushT.current);
    // At most one cloud write per 30 s (playback progress changes state every few seconds).
    const wait = Math.max(2000, (lastPushAt.current || 0) + 30000 - Date.now());
    pushT.current = setTimeout(async () => {
      lastPushAt.current = Date.now(); pushT.current = null;
      try {
        const payload = toCloud(stateRef.current);
        lastPushed.current = JSON.stringify(payload.updatedAt);
        await pushCloud(user.uid, payload);
        setSyncState('ok');
      } catch { setSyncState('error'); }
    }, wait);
  }, [state, user?.uid]);

  // Flush a pending cloud write when the app goes to the background.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => {
      if (st !== 'background' || !user || !stateRef.current || !pushT.current) return;
      clearTimeout(pushT.current); pushT.current = null;
      lastPushAt.current = Date.now();
      const payload = toCloud(stateRef.current);
      lastPushed.current = JSON.stringify(payload.updatedAt);
      pushCloud(user.uid, payload).then(() => setSyncState('ok'), () => setSyncState('error'));
    });
    return () => sub.remove();
  }, [user?.uid]);

  const api = useMemo(() => {
    if (!state) return null;
    const s = state;
    const pid = s.activeProfile;
    const pdata = (pid && s.data[pid]) || { list: [], progress: {} };
    const upd = (fn) => setState((prev) => fn(prev));
    const updData = (fn) => upd((prev) => {
      const d = prev.data[prev.activeProfile] || { list: [], progress: {} };
      return { ...prev, data: { ...prev.data, [prev.activeProfile]: fn(d) } };
    });
    return {
      ...s,
      user, syncState, cloudEnabled,
      theme: THEMES[s.settings.theme] || THEMES.orbit,
      profile: s.profiles.find((p) => p.id === pid) || null,
      list: pdata.list,
      progress: pdata.progress,
      setSetting: (k, v) => {
        if (k === 'lang') setLang(v);
        upd((p) => ({ ...p, settings: { ...p.settings, [k]: v }, settingsAt: Date.now() }));
      },
      tap: () => { if (s.settings.haptics) Haptics.selectionAsync().catch(() => {}); },
      tapStrong: () => { if (s.settings.haptics) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); },
      // profiles
      selectProfile: (id) => upd((p) => ({ ...p, activeProfile: id })),
      signOut: () => upd((p) => ({ ...p, activeProfile: null })),
      addProfile: (fields) => {
        const np = { ...newProfile(fields.name || 'ملف', s.profiles.length), ...fields };
        upd((p) => ({ ...p, profiles: [...p.profiles, np], data: { ...p.data, [np.id]: { list: [], progress: {} } } }));
        return np.id;
      },
      updateProfile: (id, fields) => upd((p) => ({ ...p, profiles: p.profiles.map((x) => (x.id === id ? { ...x, ...fields, at: Date.now() } : x)) })),
      deleteProfile: (id) => upd((p) => {
        if (p.profiles.length <= 1) return p;
        const data = { ...p.data }; delete data[id];
        return { ...p, profiles: p.profiles.filter((x) => x.id !== id), data, deletedProfiles: { ...(p.deletedProfiles || {}), [id]: Date.now() }, activeProfile: p.activeProfile === id ? null : p.activeProfile };
      }),
      // my list
      inList: (id) => pdata.list.some((x) => x.id === id),
      toggleList: (meta) => updData((d) => {
        const has = d.list.some((x) => x.id === meta.id);
        const now = Date.now();
        const item = { id: meta.id, type: meta.type, name: meta.name, poster: meta.poster, background: meta.background, at: now };
        return has
          ? { ...d, list: d.list.filter((x) => x.id !== meta.id), removed: { ...(d.removed || {}), [meta.id]: now } }
          : { ...d, list: [item, ...d.list] };
      }),
      clearList: () => updData((d) => { const now = Date.now(); const removed = { ...(d.removed || {}) }; d.list.forEach((x) => { removed[x.id] = now; }); return { ...d, list: [], removed }; }),
      // progress / continue watching. key = video id (movie id or series ep id)
      saveProgress: (entry) => updData((d) => {
        const at = Date.now();
        return { ...d, progress: newest({ ...d.progress, [entry.metaId]: { ...entry, at } }, MAX_PROGRESS),
          watched: newest({ ...(d.watched || {}), [entry.videoId || entry.metaId]: { pos: entry.pos, dur: entry.dur, at, ...(entry.source ? { source: entry.source } : {}) } }, MAX_WATCHED) };
      }),
      clearProgress: (metaId) => updData((d) => { const pr = { ...d.progress }; delete pr[metaId]; return { ...d, progress: pr }; }),
      watched: pdata.watched || {},
      clearHistory: () => updData((d) => ({ ...d, progress: {}, watched: {}, clearedAt: Date.now() })),
      // add-ons
      addAddon: (a) => upd((p) => ({ ...p, addons: [...p.addons.filter((x) => x.transportUrl !== a.transportUrl), a] })),
      removeAddon: (url) => upd((p) => ({ ...p, addons: p.addons.filter((x) => x.transportUrl !== url || x.core) })),
      toggleAddon: (url) => upd((p) => ({ ...p, addons: p.addons.map((x) => (x.transportUrl === url ? { ...x, disabled: !x.disabled } : x)) })),
    };
  }, [state, user, syncState]);

  if (!api) return null;
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export const useStore = () => useContext(Ctx);
export const useTheme = () => useContext(Ctx).theme;
