import React, { useEffect, useRef, useState, useCallback } from 'react';
import { endDirectPlayback, reviveLocalStream, isLocalStream } from '../torrent';
import { VlcView, VlcPlayer, vlcAvailable } from '../../modules/m-vlc/src';
import { View, StyleSheet, Pressable, PanResponder, ScrollView, ActivityIndicator, Modal, AppState, Alert } from 'react-native';
import { IS_TV } from '../tv';
import { useVideoPlayer, VideoView, VideoAirPlayButton } from 'expo-video';
import { Platform } from 'react-native';
import { useEvent } from 'expo';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useKeepAwake } from 'expo-keep-awake';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, FadeIn, FadeOut, ZoomIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useStore } from '../store';
import { Txt, Row, Glass, Press, FocusRow } from '../components/ui';
import { getSession, setSession } from '../session';
import { getSubtitles, getStreams, streamQuality } from '../addons';
import { loadSubs } from '../subs';
import { movieHash, rankSubs, getDelay, saveDelay, subKeyOf } from '../subtools';
import { createTranslator, GEMINI_MODEL } from '../subtrans';
import { getLang } from '../i18n';
import { offlineSession } from '../downloads';
import { t } from '../i18n';
import { CONTENT_LANGS } from '../i18n';

const NEEDS_VLC = /\.(mkv|avi|wmv|flv|webm|m2ts|ts)(\b|$)|\b(hevc|x265|h265|dovi|dolby.?vision)\b/i;
const FILL = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 };

const ISO3 = { ar: 'ara', en: 'eng', fr: 'fre', es: 'spa', tr: 'tur', ur: 'urd', hi: 'hin', id: 'ind', de: 'ger', ja: 'jpn', ko: 'kor' };
const fmt = (s) => {
  s = Math.max(0, Math.floor(s || 0));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0');
};
const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const SUB_SIZES = { small: 15, medium: 19, large: 24, xl: 30 };

function KeepAwake() { useKeepAwake(); return null; }

export default function Player() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const store = useStore();
  const { settings, saveProgress, addons, theme: th, tap } = store;
  const [sess, setSess] = useState(getSession());
  const s = sess || {};
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  // Which engine plays this source: the native player (AVPlayer/ExoPlayer) or VLC (MKV, HEVC/DV, DDP...).
  const wantsVlc = (url) => vlcAvailable && (settings.playerEngine === 'vlc' ||
    ((settings.playerEngine || 'auto') === 'auto' && NEEDS_VLC.test(`${url || ''} ${s.filename || ''}`)));
  const [useVlc, setUseVlc] = useState(() => wantsVlc(s.url));
  const vlc = useRef(null);
  if (!vlc.current) vlc.current = new VlcPlayer();
  const [, bump] = useState(0);
  vlc.current.onChange = () => bump((x) => x + 1);
  const vlcRef = useRef(null);
  useEffect(() => { vlc.current.view = vlcRef.current; });
  const [vlcTracks, setVlcTracks] = useState({ audio: [], subtitles: [], audioId: -1, subtitleId: -1 });
  useEffect(() => { const sub = vlc.current.addListener('tracksChange', setVlcTracks); return () => sub.remove(); }, []);

  const native = useVideoPlayer(s.url && !useVlc ? { uri: s.url, headers: s.headers } : null, (p) => {
    p.timeUpdateEventInterval = 0.25;
    p.playbackRate = settings.speed || 1;
    p.staysActiveInBackground = !!settings.bgAudio;
    if (Platform.OS === 'ios') p.allowsExternalPlayback = true; // AirPlay to Apple TV / AirPlay TVs
    // Android only keeps background playback alive with a media notification (foreground service).
    if (Platform.OS === 'android' && settings.bgAudio) p.showNowPlayingNotification = true;
    if (s.startAt) p.currentTime = s.startAt;
    p.play();
  });
  const player = useVlc ? vlc.current : native;
  useEffect(() => { if (useVlc) { native.pause?.(); vlc.current._rate = settings.speed || 1; vlc.current.replace({ uri: s.url }); } }, [useVlc]);
  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });
  const { status, error } = useEvent(player, 'statusChange', { status: player.status, error: null });
  // Try the next mirror when a source fails, and keep the real error for the details line.
  const tried = useRef(0);
  const [errInfo, setErrInfo] = useState('');
  useEffect(() => { tried.current = 0; setErrInfo(''); }, [s.videoId]);
  useEffect(() => {
    if (status !== 'error') return;
    const msg = (error && (error.message || String(error))) || 'unknown';
    const fb = (s.fallbacks || [])[tried.current];
    console.warn('[player] source failed', (s.url || '').split('?')[0].replace(/\/stream\/[0-9a-f]{32}\//, '/stream/…/'), msg);
    if (!useVlc && vlcAvailable && (settings.playerEngine || 'auto') === 'auto' && !fb) {
      console.warn('[player] native player failed, switching to VLC');
      setUseVlc(true);
      return;
    }
    if (fb) {
      tried.current += 1;
      setErrInfo('');
      player.replace({ uri: fb, headers: s.headers });
      if (s.startAt) player.currentTime = s.startAt;
      player.play();
    } else {
      let host = '';
      try { host = (s.url.match(/^https?:\/\/([^/]+)/i) || [])[1] || ''; } catch {}
      setErrInfo(`${msg}${host ? ' · ' + host : ''}${tried.current ? ' · ' + t('triedMirrors', { n: tried.current + 1 }) : ''}`);
    }
  }, [status]);
  useEffect(() => { console.log('[player] status', status, useVlc ? 'vlc' : 'native', error?.message || ''); }, [status, useVlc]);
  const time = useEvent(player, 'timeUpdate', { currentTime: 0, bufferedPosition: 0 });
  const cur = time?.currentTime || 0;
  // The loading spinner follows real progress: once time moves forward, playback is running even if
  // the engine never reports leaving "loading" (it used to stick until pause/resume).
  const lastAdv = useRef({ t: 0, at: 0 });
  if (cur !== lastAdv.current.t) lastAdv.current = { t: cur, at: Date.now() };
  const [, tick] = useState(0);
  // only ticks while the engine says "loading" (it used to re-render the player every 0.7 s all the time)
  useEffect(() => { if (status !== 'loading') return; const id = setInterval(() => tick((x) => x + 1), 700); return () => clearInterval(id); }, [status]);
  const advancing = Date.now() - lastAdv.current.at < 1500 && cur > 0;
  const showSpinner = status === 'loading' && !advancing;
  const dur = player.duration || 0;

  const [show, setShow] = useState(true);
  const hideT = useRef(null);
  const [panel, setPanel] = useState(null); // 'subs' | 'speed' | 'eps'
  const [rate, setRate] = useState(settings.speed || 1);
  const [subsList, setSubsList] = useState([]);
  const [subSel, setSubSel] = useState(null);
  const [cues, setCues] = useState([]);
  const [fit, setFit] = useState('contain');
  const [nextCount, setNextCount] = useState(null);
  const nextCancelled = useRef(null); // videoId whose countdown the user cancelled (don't restart it a second later)
  const [locked, setLocked] = useState(false);

  // orientation: allow landscape while playing
  useEffect(() => {
    if (!IS_TV) ScreenOrientation.unlockAsync().catch(() => {});
    return () => { if (!IS_TV) ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {}); endDirectPlayback(); };
  }, []);

  const poke = useCallback(() => {
    setShow(true);
    clearTimeout(hideT.current);
    hideT.current = setTimeout(() => setShow(false), 3500);
  }, []);
  useEffect(() => { poke(); return () => clearTimeout(hideT.current); }, [s.url]);

  // subtitles: stream-provided + subtitle add-ons, ranked by preferred languages
  useEffect(() => {
    if (!s.videoId) return;
    if (s.offline?.cues && s.offline.sub) { // downloaded: subtitle saved with the video, no network needed
      setSubsList([s.offline.sub]); setSubSel(s.offline.sub); setCues(s.offline.cues);
      return;
    }
    let alive = true;
    const langs = [settings.subLang, settings.subFallback].filter(Boolean).map((l) => ISO3[l] || l);
    const videoName = s.filename || decodeURIComponent(((s.url || '').split('?')[0].split('/').pop()) || '');
    // the file's OpenSubtitles hash lets the add-on put subtitles made for this exact release first (max 6 s)
    Promise.race([movieHash(s.url, s.headers).catch(() => null), new Promise((r) => setTimeout(() => r(null), 6000))])
      .then((h) => getSubtitles(s.type, s.videoId, addons, langs, h ? { videoHash: h.hash, videoSize: h.size, filename: s.filename } : (s.filename ? { filename: s.filename } : null)))
      .then((list) => {
      if (!alive) return;
      const rank = (l) => { const i = langs.indexOf(l); return i < 0 ? 99 : i; };
      const all = rankSubs([...(s.streamSubs || []).map((x) => ({ ...x, addon: 'stream' })), ...list], rank, videoName).slice(0, 60);
      setSubsList(all);
      if (settings.autoSubs && settings.subLang !== 'off') {
        const pick = all.find((x) => x.lang === ISO3[settings.subLang] || x.lang === settings.subLang);
        if (pick) chooseSub(pick);
      }
    }).catch(() => {});
    return () => { alive = false; };
  }, [s.videoId]);

  const subReq = useRef(0);
  const chooseSub = async (sub) => {
    const id = ++subReq.current; // ignore late results from an earlier choice
    setSubSel(sub); setCues([]);
    if (!sub) return;
    let c = [];
    try { c = await loadSubs(sub.url); } catch {}
    if (id === subReq.current && mounted.current) setCues(c);
  };
  // ---- subtitle timing offset (seconds, + = later), saved per video + subtitle file; VLC gets it for embedded tracks
  const [subDelay, setSubDelayState] = useState(0);
  useEffect(() => { let ok = true; getDelay(s.videoId, subKeyOf(subSel)).then((v) => ok && setSubDelayState(v)); return () => { ok = false; }; }, [s.videoId, subSel]);
  const setSubDelay = (v) => { const r = Math.round(v * 10) / 10; setSubDelayState(r); saveDelay(s.videoId, subKeyOf(subSel), r); };
  const [syncAt, setSyncAt] = useState(null); // "two taps" sync: playback time when the user heard the line
  const nextMatch = () => { // next subtitle file in the same language (ranked best-first)
    if (!subsList.length) return;
    const i = subsList.indexOf(subSel);
    const lang = subSel?.lang;
    const rest = [...subsList.slice(i + 1), ...subsList.slice(0, Math.max(0, i))].filter((x) => !lang || x.lang === lang);
    if (rest[0]) chooseSub(rest[0]);
  };

  // ---- translate the chosen subtitles into the app language (Gemini with the user's key, or Google)
  const appLang = getLang();
  const trEngine = settings.subTrEngine === 'google' ? 'google' : settings.subTrEngine === 'gemini' ? 'gemini' : (settings.geminiKey ? 'gemini' : 'google');
  const subLang2 = subSel ? (Object.keys(ISO3).find((k) => ISO3[k] === subSel.lang) || subSel.lang) : null;
  const trWanted = !!settings.subTranslate && !!subSel && cues.length > 0 && subLang2 !== appLang;
  const [trMap, setTrMap] = useState({});
  const [trProg, setTrProg] = useState(null);
  const [trErr, setTrErr] = useState(null);
  const trCtl = useRef(null);
  const trFocus = useRef(0);
  const curRef = useRef(0); curRef.current = cur;
  useEffect(() => {
    setTrMap({}); setTrProg(null); setTrErr(null);
    if (!trWanted) return;
    if (s.offline?.tr && subSel === s.offline.sub) { setTrMap(s.offline.tr); setTrProg(null); return; } // saved with the download
    if (trEngine === 'gemini' && !settings.geminiKey) { setTrErr('noKey'); return; }
    const ctl = createTranslator({ cues, lang: appLang, engine: trEngine, apiKey: settings.geminiKey, cacheId: subKeyOf(subSel),
      onUpdate: (m, p) => { if (mounted.current) { setTrMap(m); setTrProg(p); } }, onError: (e) => mounted.current && setTrErr(e) });
    trCtl.current = ctl;
    const p0 = curRef.current;
    trFocus.current = p0;
    ctl.focus(p0);
    // hold playback until the lines around the playhead are ready (a few seconds at most), then keep going
    let held = false;
    if (player.playing) { held = true; player.pause(); }
    ctl.waitFor(p0, 12000).then(() => { if (held && mounted.current && trCtl.current === ctl) player.play(); });
    return () => { ctl.stop(); if (trCtl.current === ctl) trCtl.current = null; };
  }, [trWanted, trEngine, settings.geminiKey, cues, appLang]);
  // after a seek, translate from the new spot first
  useEffect(() => { if (trCtl.current && Math.abs(cur - trFocus.current) > 45) { trFocus.current = cur; trCtl.current.focus(cur); } }, [Math.floor(cur / 5)]);

  const cueAt = cur - subDelay;
  const cueIdx = cues.length ? cues.findIndex((c) => cueAt >= c.start && cueAt <= c.end) : -1;
  const cue = cueIdx >= 0 ? { ...cues[cueIdx], text: (trWanted && trMap[cueIdx]) || cues[cueIdx].text } : null;

  // progress saving. Every store write re-renders the whole app, so it is committed every 30 s, and right away
  // on pause, when the app goes to the background and when the player closes (nothing lost if the OS kills it).
  const lastSave = useRef(0);
  const pending = useRef(null);
  const commit = useCallback(() => { if (pending.current) { saveProgress(pending.current); pending.current = null; } }, [saveProgress]);
  const commitRef = useRef(commit); commitRef.current = commit;
  useEffect(() => {
    if (!s.metaId || !dur || cur < 3) return;
    pending.current = { metaId: s.metaId, type: s.type, videoId: s.videoId, name: s.title, poster: s.poster, background: s.background, thumb: s.thumb,
      season: s.season, episode: s.episode, epLabel: s.subtitle, pos: cur, dur, source: s.source };
    if (Math.abs(cur - lastSave.current) < 30) return;
    lastSave.current = cur;
    commit();
  }, [Math.floor(cur)]);
  useEffect(() => { if (!isPlaying) commitRef.current(); }, [isPlaying]);
  useEffect(() => () => commitRef.current(), []);

  // Background / return. VLC draws with OpenGL, which iOS forbids in the background (the app gets killed), so it is
  // paused there; on Android it pauses too unless background audio is on. On return: re-hook VLC's video surface
  // (Android), revive the local torrent server if the OS closed it, and resume what we paused.
  const bgPaused = useRef(false);
  const live = useRef({}); live.current = { player, useVlc, isPlaying, s, cur };
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (st) => {
      const L = live.current;
      if (st === 'background') {
        commitRef.current();
        if (L.useVlc && L.isPlaying && (Platform.OS === 'ios' || !settings.bgAudio)) { bgPaused.current = true; L.player.pause(); }
        return;
      }
      if (st !== 'active') return;
      if (L.useVlc && Platform.OS === 'android') vlcRef.current?.reattach?.().catch?.(() => {});
      if (isLocalStream(L.s.url)) {
        try {
          const url = await reviveLocalStream(L.s.url, L.s.magnet);
          if (mounted.current && url !== L.s.url) {
            const ns = { ...L.s, url, startAt: L.cur };
            setSession(ns); setSess(ns);
            L.player.replace({ uri: url, headers: ns.headers });
            if (!L.useVlc) L.player.currentTime = L.cur;
            L.player.play(); bgPaused.current = false;
            return;
          }
        } catch (e) { console.warn('[player] revive failed', e?.message); }
      }
      if (bgPaused.current) { bgPaused.current = false; L.player.play(); }
    });
    return () => sub.remove();
  }, []);

  // next episode: countdown in the last 25 s
  useEffect(() => {
    if (!s.next || !dur) return;
    const left = dur - cur;
    if (left < 25 && left > 0 && nextCount == null && settings.autoNext && nextCancelled.current !== s.videoId) setNextCount(10);
  }, [Math.floor(cur)]);
  useEffect(() => {
    if (nextCount == null) return;
    if (nextCount <= 0) { goNext(); return; }
    const id = setTimeout(() => setNextCount((n) => (n == null ? n : n - 1)), 1000);
    return () => clearTimeout(id);
  }, [nextCount]);

  const goNext = async (pick) => {
    setNextCount(null);
    const nx = (pick && pick.id ? pick : null) || s.next?.video; if (!nx) return;
    commit();
    const off = await offlineSession(nx.id).catch(() => null); // next episode already downloaded: play it from the device
    if (off && mounted.current) {
      const eps = s.episodes || [];
      const i = eps.findIndex((e) => e.id === nx.id);
      const ns = { ...s, filename: off.url.split('/').pop(), magnet: null, url: off.url, fallbacks: [], headers: undefined, videoId: nx.id, season: nx.season, episode: nx.episode || nx.number,
        subtitle: `${t('season', { n: nx.season })} · ${t('episode', { n: nx.episode || nx.number })}${nx.name ? ' · ' + nx.name : ''}`,
        thumb: nx.thumbnail, startAt: 0, streamSubs: [], offline: off.offline, source: { offline: true }, next: eps[i + 1] ? { video: eps[i + 1] } : null };
      setSession(ns); setSess(ns); setSubSel(null); setCues([]);
      const v = wantsVlc(ns.url);
      if (v !== useVlc) setUseVlc(v); else player.replace({ uri: ns.url });
      player.play();
      return;
    }
    let res;
    try { res = await getStreams(s.type, nx.id, addons); }
    catch { if (mounted.current) Alert.alert(t('playError')); return; } // offline etc.: say so instead of silently doing nothing
    if (!mounted.current) return;
    const best = [...res.direct].sort((a, b) => streamQuality(b) - streamQuality(a))[0];
    if (!best) { router.back(); return; }
    const eps = s.episodes || [];
    const i = eps.findIndex((e) => e.id === nx.id);
    const ns = { ...s, filename: best.behaviorHints?.filename || null, magnet: null, url: best.url, fallbacks: best.fallbacks || [], headers: best.behaviorHints?.proxyHeaders?.request, videoId: nx.id, season: nx.season, episode: nx.episode || nx.number,
      subtitle: `${t('season', { n: nx.season })} · ${t('episode', { n: nx.episode || nx.number })}${nx.name ? ' · ' + nx.name : ''}`,
      thumb: nx.thumbnail, startAt: 0, streamSubs: best.subtitles || [], offline: null, source: { url: best.url, addon: best.addon }, next: eps[i + 1] ? { video: eps[i + 1] } : null };
    setSession(ns); setSess(ns); setSubSel(null); setCues([]);
    const v = wantsVlc(ns.url);
    if (v !== useVlc) setUseVlc(v);
    else player.replace({ uri: ns.url, headers: ns.headers });
    player.play();
  };

  const seek = (d) => { tap(); player.seekBy(d); poke(); };
  const toggle = () => { tap(); isPlaying ? player.pause() : player.play(); poke(); };
  const setSpeed = (r) => { player.playbackRate = r; setRate(r); };

  const showSkipIntro = settings.skipIntro && cur > 5 && cur < 180 && dur > 600 && s.episode;

  if (!s.url) return <View style={styles.black}><Txt center style={{ color: '#fff', marginTop: 200 }}>{t('error')}</Txt></View>;
  const subStyle = {
    fontSize: SUB_SIZES[settings.subSize] || 19, color: settings.subColor || '#fff',
    backgroundColor: settings.subBg === 'solid' ? 'rgba(0,0,0,0.85)' : settings.subBg === 'dim' ? 'rgba(0,0,0,0.45)' : 'transparent',
    textShadowColor: settings.subShadow ? '#000' : 'transparent', textShadowRadius: settings.subShadow ? 4 : 0,
  };

  return (
    <View style={styles.black}>
      {settings.keepAwake ? <KeepAwake /> : null}
      {useVlc ? (
        <VlcView ref={vlcRef} style={StyleSheet.absoluteFill} uri={vlc.current.src?.uri || s.url} paused={vlc.current.paused} rate={vlc.current.playbackRate}
          startAt={s.startAt || 0} fit={fit} subDelay={subSel ? 0 : subDelay * 1000}
          onStatus={vlc.current.handleStatus} onTime={vlc.current.handleTime} onPlaying={vlc.current.handlePlaying} onTracks={vlc.current.handleTracks} />
      ) : (
        <VideoView player={native} style={StyleSheet.absoluteFill} contentFit={fit} nativeControls={false} allowsPictureInPicture startsPictureInPictureAutomatically={false} />
      )}
      <Pressable style={StyleSheet.absoluteFill} onPress={() => (show ? setShow(false) : poke())} />

      {trWanted && (trErr || (trProg && trProg.done === 0)) ? (
        <View pointerEvents="none" style={[styles.subWrap, { top: insets.top + 70 }]}>
          <Txt center size={13} style={{ color: '#fff', backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, overflow: 'hidden' }}>
            {trErr ? t('trErr_' + trErr) : t('trWorking')}
          </Txt>
        </View>
      ) : null}
      {/* subtitles */}
      {cue ? (
        <View pointerEvents="none" style={[styles.subWrap, { bottom: show ? 110 : 40 + insets.bottom }]}>
          <Txt center style={[styles.subText, subStyle, settings.subFont === 'bold' && { fontWeight: '800' }]}>{cue.text}</Txt>
        </View>
      ) : null}

      {showSpinner ? <ActivityIndicator size="large" color="#fff" style={StyleSheet.absoluteFill} /> : null}
      {status === 'error' && errInfo ? (
        <View style={styles.centerAbs} pointerEvents="none">
          <Ionicons name="alert-circle-outline" size={40} color="#fff" />
          <Txt center style={{ color: '#fff', marginTop: 8 }}>{t('playError')}</Txt>
          <Txt center size={11} style={{ color: '#aaa', marginTop: 6, marginHorizontal: 30, writingDirection: 'ltr' }} numberOfLines={4} selectable>{errInfo}</Txt>
        </View>
      ) : null}

      {locked ? (
        <View style={[styles.lockBtn, { bottom: insets.bottom + 24 }]}>
          <Press onPress={() => { setLocked(false); poke(); }}><Glass radius={24} noGlass style={styles.round}><Ionicons name="lock-closed" size={22} color="#fff" /></Glass></Press>
        </View>
      ) : show ? (
        <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(220)} style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <View style={styles.shade} pointerEvents="none" />
          {/* top */}
          <Row style={[styles.top, { paddingTop: insets.top + 6, paddingHorizontal: 14 + Math.max(insets.left, insets.right) }]} gap={10}>
            <Press onPress={() => router.back()}><Glass radius={22} interactive style={styles.round}><Ionicons name="close" size={24} color="#fff" /></Glass></Press>
            <View style={{ flex: 1 }}>
              <Txt bold numberOfLines={1} style={{ color: '#fff' }} size={16}>{s.title}</Txt>
              {s.subtitle ? <Txt numberOfLines={1} size={12} style={{ color: '#ddd' }}>{s.subtitle}</Txt> : null}
            </View>
            {Platform.OS === 'ios' && !useVlc ? (
              <Glass radius={22} interactive style={styles.round}>
                <VideoAirPlayButton tint="#fff" activeTint={th.accent} prioritizeVideoDevices style={{ width: 30, height: 30 }} onBeginPresentingRoutes={poke} />
              </Glass>
            ) : null}
            <Press onPress={() => { setFit(fit === 'contain' ? 'cover' : 'contain'); poke(); }}><Glass radius={22} interactive style={styles.round}><Ionicons name={fit === 'contain' ? 'expand' : 'contract'} size={20} color="#fff" /></Glass></Press>
          </Row>
          {/* center */}
          <View style={styles.center} pointerEvents="box-none">
            <Press onPress={() => seek(-(settings.skip || 10))}><Ionicons name="play-back" size={34} color="#fff" /></Press>
            <Press onPress={toggle} scale={0.85} tvFocus radius={40}>
              <Glass radius={42} interactive style={{ width: 84, height: 84, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={isPlaying ? 'pause' : 'play'} size={42} color="#fff" />
              </Glass>
            </Press>
            <Press onPress={() => seek(settings.skip || 10)}><Ionicons name="play-forward" size={34} color="#fff" /></Press>
          </View>
          {/* bottom */}
          <View style={[styles.bottom, { paddingBottom: insets.bottom + 10, paddingHorizontal: 16 + Math.max(insets.left, insets.right) }]}>
            <Scrubber cur={cur} dur={dur} buffered={time?.bufferedPosition || 0} accent={th.accent}
              onSeek={(v) => { player.currentTime = v; poke(); }} onDrag={poke} />
            <Row style={{ justifyContent: 'space-between', marginTop: 4, direction: 'ltr' }}>
              <Txt size={12} style={{ color: '#ddd' }}>{fmt(cur)}</Txt>
              <Txt size={12} style={{ color: '#ddd' }}>-{fmt(dur - cur)}</Txt>
            </Row>
            <Glass radius={20} style={{ marginTop: 10 }}>
              <Row style={{ justifyContent: 'space-around', paddingVertical: 8 }}>
                <Tool icon="speedometer-outline" label={`${t('speed')} ${rate}x`} onPress={() => setPanel('speed')} />
                <Tool icon="chatbox-ellipses-outline" label={t('subtitles')} onPress={() => setPanel('subs')} />
                {useVlc && (vlcTracks.audio.length > 1 || vlcTracks.subtitles.length > 1) ? <Tool icon="musical-notes-outline" label={t('tracks')} onPress={() => setPanel('tracks')} /> : null}
                {s.episodes ? <Tool icon="albums-outline" label={t('episodes')} onPress={() => setPanel('eps')} /> : null}
                <Tool icon="lock-open-outline" label={t('lock')} onPress={() => { setLocked(true); setShow(false); }} />
                {s.next ? <Tool icon="play-skip-forward" label={t('nextEp')} onPress={() => goNext()} /> : null}
              </Row>
            </Glass>
          </View>
        </Animated.View>
      ) : null}

      {showSkipIntro && !locked ? (
        <Animated.View entering={ZoomIn} style={[styles.skipIntro, { bottom: (show ? 170 : cue ? 120 : 40) + insets.bottom }]}>
          <Press onPress={() => { player.seekBy(85); poke(); }}>
            <Glass radius={14} interactive style={{ paddingHorizontal: 16, paddingVertical: 10 }}><Txt bold style={{ color: '#fff' }}>{t('skipIntro')}</Txt></Glass>
          </Press>
        </Animated.View>
      ) : null}

      {nextCount != null ? (
        <Animated.View entering={ZoomIn} style={[styles.skipIntro, { bottom: (show ? 170 : cue ? 120 : 40) + insets.bottom }]}>
          <Row gap={8}>
            <Press onPress={() => { nextCancelled.current = s.videoId; setNextCount(null); }}><Glass radius={14} style={{ paddingHorizontal: 14, paddingVertical: 10 }}><Txt style={{ color: '#fff' }}>{t('cancel')}</Txt></Glass></Press>
            <Press onPress={() => goNext()}><View style={{ backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 10 }}><Txt bold style={{ color: '#000' }}>{t('nextIn', { n: nextCount })}</Txt></View></Press>
          </Row>
        </Animated.View>
      ) : null}

      <Sheet visible={!!panel} onClose={() => setPanel(null)}>
        {panel === 'speed' ? SPEEDS.map((r) => (
          <Opt key={r} label={r + 'x'} on={r === rate} onPress={() => { setSpeed(r); setPanel(null); }} />
        )) : panel === 'subs' ? (
          <>
            <Opt label={t('off')} on={!subSel} onPress={() => { chooseSub(null); setPanel(null); }} />
            {!subsList.length ? <Txt style={{ color: '#aaa', padding: 14 }}>{t('noSubs')}</Txt> : null}
            <SubTools delay={subDelay} setDelay={setSubDelay} cur={cur} cues={cues} syncAt={syncAt} setSyncAt={setSyncAt}
              hasSub={!!subSel || (useVlc && vlcTracks.subtitleId >= 0)} canNext={subsList.length > 1 && !!subSel} onNext={nextMatch}
              translate={!!settings.subTranslate} setTranslate={(v) => store.setSetting('subTranslate', v)}
              engine={trEngine} setEngine={(v) => store.setSetting('subTrEngine', v)} hasKey={!!settings.geminiKey}
              sameLang={!!subSel && subLang2 === appLang} prog={trProg} err={trErr} onRetry={() => { setTrErr(null); trCtl.current?.retry(); }}
              onOpenSettings={() => { setPanel(null); router.push('/settings'); }} />
            {subsList.map((x, i) => (
              <Opt key={x.id || x.url || i} label={`${langName(x.lang)} · ${x.addon === 'stream' ? t('fromSource') : x.addon}`} on={subSel === x}
                onPress={() => { chooseSub(x); setPanel(null); }} />
            ))}
          </>
        ) : panel === 'tracks' ? (
          <>
            <Txt bold style={{ color: '#fff', paddingHorizontal: 14, paddingTop: 8 }}>{t('audioTrack')}</Txt>
            {vlcTracks.audio.map((a) => (
              <Opt key={'a' + a.id} label={a.name} on={a.id === vlcTracks.audioId} onPress={() => { vlcRef.current?.setAudioTrack(a.id); setPanel(null); }} />
            ))}
            <Txt bold style={{ color: '#fff', paddingHorizontal: 14, paddingTop: 12 }}>{t('embeddedSubs')}</Txt>
            {vlcTracks.subtitles.map((x) => (
              <Opt key={'s' + x.id} label={x.id === -1 ? t('off') : x.name} on={x.id === vlcTracks.subtitleId} onPress={() => { vlcRef.current?.setSubtitleTrack(x.id); setPanel(null); }} />
            ))}
          </>
        ) : panel === 'eps' ? (s.episodes || []).map((e) => (
          <Opt key={e.id} label={`${e.episode || e.number}. ${e.name || e.title || ''}`} on={e.id === s.videoId}
            onPress={() => { setPanel(null); goNext(e); }} />
        )) : null}
      </Sheet>
    </View>
  );
}


function langName(code) {
  const two = Object.keys(ISO3).find((k) => ISO3[k] === code) || code;
  const f = CONTENT_LANGS.find(([c]) => c === two);
  return f ? f[1] : code;
}

function Tool({ icon, label, onPress }) {
  return (
    <Press onPress={onPress} style={{ alignItems: 'center', minWidth: 56 }}>
      <Ionicons name={icon} size={22} color="#fff" />
      <Txt center size={11} style={{ color: '#ddd', marginTop: 2 }} numberOfLines={1}>{label}</Txt>
    </Press>
  );
}

// Subtitle tools inside the subtitles sheet: timing offset, two-tap sync, next matching file, translation.
function SubTools({ delay, setDelay, cur, cues, syncAt, setSyncAt, hasSub, canNext, onNext, translate, setTranslate, engine, setEngine, hasKey, sameLang, prog, err, onRetry, onOpenSettings }) {
  if (!hasSub) return null;
  const fmt = (v) => (v > 0 ? '+' : '') + v.toFixed(1) + (t('secShort') || 's');
  const Btn = ({ label, onPress, on }) => (
    <Press onPress={onPress}><View style={[styles.stBtn, on && { backgroundColor: '#fff' }]}><Txt size={14} bold style={{ color: on ? '#000' : '#fff' }}>{label}</Txt></View></Press>
  );
  // lines around the moment the user pressed "now" (original timing), to pick the one they heard
  const near = syncAt == null ? [] : cues.filter((c) => c.start > syncAt - 25 && c.start < syncAt + 25).slice(0, 12);
  return (
    <View style={{ paddingHorizontal: 14, paddingBottom: 6 }}>
      <Txt bold style={{ color: '#fff', paddingTop: 6 }}>{t('subTiming')}</Txt>
      <Row gap={8} style={{ marginTop: 8, flexWrap: 'wrap' }}>
        <Btn label="-0.5" onPress={() => setDelay(delay - 0.5)} />
        <View style={[styles.stBtn, { minWidth: 70, alignItems: 'center', backgroundColor: 'transparent' }]}><Txt size={14} style={{ color: '#fff', writingDirection: 'ltr' }}>{fmt(delay)}</Txt></View>
        <Btn label="+0.5" onPress={() => setDelay(delay + 0.5)} />
        {delay ? <Btn label={t('reset')} onPress={() => setDelay(0)} /> : null}
      </Row>
      <Txt size={12} style={{ color: '#aaa', marginTop: 6 }}>{t('subTimingHint')}</Txt>
      {cues.length ? (
        <>
          <Row gap={8} style={{ marginTop: 12, flexWrap: 'wrap' }}>
            <Btn label={syncAt == null ? t('syncNow') : t('syncPick')} on={syncAt != null} onPress={() => setSyncAt(syncAt == null ? cur : null)} />
            {canNext ? <Btn label={t('subNextMatch')} onPress={onNext} /> : null}
          </Row>
          {syncAt == null ? <Txt size={12} style={{ color: '#aaa', marginTop: 6 }}>{t('syncHint')}</Txt> : null}
          {near.map((c, i) => (
            <Pressable key={i} onPress={() => { setDelay(syncAt - c.start); setSyncAt(null); }} style={{ paddingVertical: 8 }}>
              <Txt size={14} numberOfLines={2} style={{ color: '#fff' }}>{c.text.replace(/\n/g, ' ')}</Txt>
            </Pressable>
          ))}
          {syncAt != null && !near.length ? <Txt size={13} style={{ color: '#aaa', marginTop: 6 }}>{t('syncNone')}</Txt> : null}
        </>
      ) : null}
      {cues.length && !sameLang ? (
        <View style={{ marginTop: 14 }}>
          <Row gap={10}>
            <Txt bold style={{ color: '#fff', flex: 1 }}>{t('subTranslate')}</Txt>
            <Btn label={translate ? t('on') : t('off')} on={translate} onPress={() => setTranslate(!translate)} />
          </Row>
          {translate ? (
            <>
              <Row gap={8} style={{ marginTop: 8 }}>
                <Btn label="Gemini" on={engine === 'gemini'} onPress={() => setEngine('gemini')} />
                <Btn label="Google" on={engine === 'google'} onPress={() => setEngine('google')} />
              </Row>
              {engine === 'gemini' ? <Txt size={12} style={{ color: '#aaa', marginTop: 6 }}>{t('geminiNote')}</Txt> : null}
              {engine === 'gemini' && !hasKey ? (
                <Press onPress={onOpenSettings}><Txt size={13} style={{ color: '#fff', marginTop: 8, textDecorationLine: 'underline' }}>{t('geminiNeedKey')}</Txt></Press>
              ) : null}
              {prog && prog.total ? <Txt size={12} style={{ color: '#aaa', marginTop: 6 }}>{t('trProgress', { n: Math.round((prog.done / prog.total) * 100) })}</Txt> : null}
              {err && err !== 'noKey' ? (
                <Row gap={8} style={{ marginTop: 6 }}>
                  <Txt size={13} style={{ color: '#FF9F0A', flex: 1 }}>{t('trErr_' + err)}</Txt>
                  {err !== 'key' ? <Btn label={t('retry')} onPress={onRetry} /> : null}
                </Row>
              ) : null}
            </>
          ) : null}
        </View>
      ) : null}
      <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.15)', marginTop: 12 }} />
    </View>
  );
}

function Opt({ label, on, onPress }) {
  return (
    <FocusRow onPress={onPress} style={{ paddingVertical: 13, paddingHorizontal: 18 }}>
      <Row gap={10}>
        <Ionicons name={on ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={on ? '#fff' : '#777'} />
        <Txt style={{ color: '#fff', flex: 1 }} size={15} numberOfLines={1}>{label}</Txt>
      </Row>
    </FocusRow>
  );
}

function Sheet({ visible, onClose, children }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} supportedOrientations={['portrait', 'landscape']}>
      <Pressable style={{ flex: 1 }} onPress={onClose} />
      <Glass radius={28} style={{ maxHeight: '60%', marginHorizontal: 8, marginBottom: insets.bottom + 8 }}>
        <View style={{ alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: '#888', marginTop: 8 }} />
        <ScrollView contentContainerStyle={{ paddingVertical: 8 }}>{children}</ScrollView>
      </Glass>
    </Modal>
  );
}

function Scrubber({ cur, dur, buffered, accent, onSeek, onDrag }) {
  const [w, setW] = useState(1);
  const [drag, setDrag] = useState(null);
  const h = useSharedValue(4);
  const ref = useRef({});
  ref.current = { w, dur, onSeek, onDrag };
  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (e) => { h.value = withTiming(8); const x = e.nativeEvent.locationX; setDrag(Math.max(0, Math.min(1, x / ref.current.w))); ref.current.onDrag(); },
    onPanResponderMove: (e) => { const x = e.nativeEvent.locationX; setDrag(Math.max(0, Math.min(1, x / ref.current.w))); ref.current.onDrag(); },
    onPanResponderRelease: (e) => {
      h.value = withTiming(4);
      const f = Math.max(0, Math.min(1, e.nativeEvent.locationX / ref.current.w));
      setDrag(null); ref.current.onSeek(f * ref.current.dur);
    },
    onPanResponderTerminate: () => { h.value = withTiming(4); setDrag(null); },
  })).current;
  const frac = drag != null ? drag : dur ? cur / dur : 0;
  const bar = useAnimatedStyle(() => ({ height: h.value, borderRadius: h.value / 2 }));
  return (
    <View style={{ height: 30, justifyContent: 'center', direction: 'ltr' }} onLayout={(e) => setW(e.nativeEvent.layout.width)} {...pan.panHandlers}>
      <Animated.View style={[{ backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden' }, bar]} pointerEvents="none">
        <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${dur ? (buffered / dur) * 100 : 0}%`, backgroundColor: 'rgba(255,255,255,0.35)' }} />
        <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${frac * 100}%`, backgroundColor: accent }} />
      </Animated.View>
      <View pointerEvents="none" style={{ position: 'absolute', left: frac * w - 8, width: 16, height: 16, borderRadius: 8, backgroundColor: accent, transform: [{ scale: drag != null ? 1.3 : 1 }] }} />
      {drag != null ? <Txt size={13} bold style={{ position: 'absolute', top: -26, left: Math.max(0, Math.min(w - 60, frac * w - 30)), width: 60, textAlign: 'center', color: '#fff' }}>{fmt(drag * dur)}</Txt> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  black: { flex: 1, backgroundColor: '#000' },
  shade: { ...FILL, backgroundColor: 'rgba(0,0,0,0.35)' },
  top: { position: 'absolute', top: 0, left: 0, right: 0 },
  center: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 46, direction: 'ltr' },
  bottom: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  round: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  stBtn: { backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8 },
  subWrap: { position: 'absolute', left: 24, right: 24, alignItems: 'center' },
  subText: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, overflow: 'hidden', lineHeight: 28 },
  centerAbs: { ...FILL, alignItems: 'center', justifyContent: 'center' },
  skipIntro: { position: 'absolute', end: 20 },
  lockBtn: { position: 'absolute', alignSelf: 'center' },
});
