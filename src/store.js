import React, { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { setLang } from './i18n';
import { THEMES } from './theme';
import { DEFAULT_ADDONS } from './addons';

const KEY = 'm-app:v1';

export const DEFAULT_SETTINGS = {
  lang: 'ar', theme: 'orbit',
  audioLang: 'ar', subLang: 'ar', subFallback: 'en', autoSubs: true,
  autoNext: true, previews: true, speed: 1, skip: 10, skipIntro: true, resume: true,
  haptics: true, keepAwake: true, bgAudio: false,
  subSize: 'medium', subColor: '#FFFFFF', subBg: 'dim', subFont: 'system', subShadow: true,
  dataUsage: 'auto', wifiOnly: false,
};

const newProfile = (name, i = 0) => ({
  id: 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
  name, icon: ['planet', 'rocket', 'moon', 'flash'][i % 4], color: ['#8B5CF6', '#22D3EE', '#10B981', '#F5B83D'][i % 4],
  kids: false, maturity: 'adult', pin: null,
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

export function StoreProvider({ children }) {
  const [state, setState] = useState(null);
  const saveT = useRef(null);

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
      setLang(s.settings.lang);
      setState(s);
    })();
  }, []);

  useEffect(() => {
    if (!state) return;
    clearTimeout(saveT.current);
    saveT.current = setTimeout(() => {
      const { activeProfile, ...rest } = state;
      AsyncStorage.setItem(KEY, JSON.stringify(rest)).catch(() => {});
    }, 300);
  }, [state]);

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
      theme: THEMES[s.settings.theme] || THEMES.orbit,
      profile: s.profiles.find((p) => p.id === pid) || null,
      list: pdata.list,
      progress: pdata.progress,
      setSetting: (k, v) => {
        if (k === 'lang') setLang(v);
        upd((p) => ({ ...p, settings: { ...p.settings, [k]: v } }));
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
      updateProfile: (id, fields) => upd((p) => ({ ...p, profiles: p.profiles.map((x) => (x.id === id ? { ...x, ...fields } : x)) })),
      deleteProfile: (id) => upd((p) => {
        if (p.profiles.length <= 1) return p;
        const data = { ...p.data }; delete data[id];
        return { ...p, profiles: p.profiles.filter((x) => x.id !== id), data, activeProfile: p.activeProfile === id ? null : p.activeProfile };
      }),
      // my list
      inList: (id) => pdata.list.some((x) => x.id === id),
      toggleList: (meta) => updData((d) => {
        const has = d.list.some((x) => x.id === meta.id);
        const item = { id: meta.id, type: meta.type, name: meta.name, poster: meta.poster, background: meta.background };
        return { ...d, list: has ? d.list.filter((x) => x.id !== meta.id) : [item, ...d.list] };
      }),
      clearList: () => updData((d) => ({ ...d, list: [] })),
      // progress / continue watching. key = video id (movie id or series ep id)
      saveProgress: (entry) => updData((d) => ({ ...d, progress: { ...d.progress, [entry.metaId]: { ...entry, at: Date.now() } } })),
      clearProgress: (metaId) => updData((d) => { const pr = { ...d.progress }; delete pr[metaId]; return { ...d, progress: pr }; }),
      clearHistory: () => updData((d) => ({ ...d, progress: {} })),
      // add-ons
      addAddon: (a) => upd((p) => ({ ...p, addons: [...p.addons.filter((x) => x.transportUrl !== a.transportUrl), a] })),
      removeAddon: (url) => upd((p) => ({ ...p, addons: p.addons.filter((x) => x.transportUrl !== url || x.core) })),
      toggleAddon: (url) => upd((p) => ({ ...p, addons: p.addons.map((x) => (x.transportUrl === url ? { ...x, disabled: !x.disabled } : x)) })),
    };
  }, [state]);

  if (!api) return null;
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export const useStore = () => useContext(Ctx);
export const useTheme = () => useContext(Ctx).theme;
