import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, StyleSheet, Pressable, PanResponder, ScrollView, ActivityIndicator, Modal } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEvent } from 'expo';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useKeepAwake } from 'expo-keep-awake';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, FadeIn, FadeOut, ZoomIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useStore } from '../store';
import { Txt, Row, Glass, Press } from '../components/ui';
import { getSession, setSession } from '../session';
import { getSubtitles, getStreams, streamQuality } from '../addons';
import { loadSubs } from '../subs';
import { t } from '../i18n';
import { CONTENT_LANGS } from '../i18n';

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

  const player = useVideoPlayer(s.url ? { uri: s.url, headers: s.headers } : null, (p) => {
    p.timeUpdateEventInterval = 0.25;
    p.playbackRate = settings.speed || 1;
    p.staysActiveInBackground = !!settings.bgAudio;
    if (s.startAt) p.currentTime = s.startAt;
    p.play();
  });
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
    console.warn('[player] source failed', s.url, msg);
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
  const time = useEvent(player, 'timeUpdate', { currentTime: 0, bufferedPosition: 0 });
  const cur = time?.currentTime || 0;
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
  const [locked, setLocked] = useState(false);

  // orientation: allow landscape while playing
  useEffect(() => {
    ScreenOrientation.unlockAsync().catch(() => {});
    return () => { ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {}); };
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
    let alive = true;
    const langs = [settings.subLang, settings.subFallback].filter(Boolean).map((l) => ISO3[l] || l);
    getSubtitles(s.type, s.videoId, addons, langs).then((list) => {
      if (!alive) return;
      const all = [...(s.streamSubs || []).map((x) => ({ ...x, addon: 'stream' })), ...list].slice(0, 60);
      setSubsList(all);
      if (settings.autoSubs && settings.subLang !== 'off') {
        const pick = all.find((x) => x.lang === ISO3[settings.subLang] || x.lang === settings.subLang);
        if (pick) chooseSub(pick);
      }
    }).catch(() => {});
    return () => { alive = false; };
  }, [s.videoId]);

  const chooseSub = async (sub) => {
    setSubSel(sub); setCues([]);
    if (!sub) return;
    try { setCues(await loadSubs(sub.url)); } catch { setCues([]); }
  };
  const cue = cues.length ? cues.find((c) => cur >= c.start && cur <= c.end) : null;

  // progress saving
  const lastSave = useRef(0);
  useEffect(() => {
    if (!s.metaId || !dur || cur < 3) return;
    if (Math.abs(cur - lastSave.current) < 5) return;
    lastSave.current = cur;
    saveProgress({ metaId: s.metaId, type: s.type, videoId: s.videoId, name: s.title, poster: s.poster, background: s.background, thumb: s.thumb,
      season: s.season, episode: s.episode, epLabel: s.subtitle, pos: cur, dur });
  }, [Math.floor(cur)]);

  // next episode: countdown in the last 25 s
  useEffect(() => {
    if (!s.next || !dur) return;
    const left = dur - cur;
    if (left < 25 && left > 0 && nextCount == null && settings.autoNext) setNextCount(10);
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
    const res = await getStreams(s.type, nx.id, addons);
    const best = [...res.direct].sort((a, b) => streamQuality(b) - streamQuality(a))[0];
    if (!best) { router.back(); return; }
    const eps = s.episodes || [];
    const i = eps.findIndex((e) => e.id === nx.id);
    const ns = { ...s, url: best.url, fallbacks: best.fallbacks || [], headers: best.behaviorHints?.proxyHeaders?.request, videoId: nx.id, season: nx.season, episode: nx.episode || nx.number,
      subtitle: `${t('season', { n: nx.season })} · ${t('episode', { n: nx.episode || nx.number })}${nx.name ? ' · ' + nx.name : ''}`,
      thumb: nx.thumbnail, startAt: 0, streamSubs: best.subtitles || [], next: eps[i + 1] ? { video: eps[i + 1] } : null };
    setSession(ns); setSess(ns); setSubSel(null); setCues([]);
    player.replace({ uri: ns.url, headers: ns.headers }); player.play();
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
      <VideoView player={player} style={StyleSheet.absoluteFill} contentFit={fit} nativeControls={false} allowsPictureInPicture startsPictureInPictureAutomatically={false} />
      <Pressable style={StyleSheet.absoluteFill} onPress={() => (show ? setShow(false) : poke())} />

      {/* subtitles */}
      {cue ? (
        <View pointerEvents="none" style={[styles.subWrap, { bottom: show ? 110 : 40 + insets.bottom }]}>
          <Txt center style={[styles.subText, subStyle, settings.subFont === 'bold' && { fontWeight: '800' }]}>{cue.text}</Txt>
        </View>
      ) : null}

      {status === 'loading' ? <ActivityIndicator size="large" color="#fff" style={StyleSheet.absoluteFill} /> : null}
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
            <Press onPress={() => { setFit(fit === 'contain' ? 'cover' : 'contain'); poke(); }}><Glass radius={22} interactive style={styles.round}><Ionicons name={fit === 'contain' ? 'expand' : 'contract'} size={20} color="#fff" /></Glass></Press>
          </Row>
          {/* center */}
          <View style={styles.center} pointerEvents="box-none">
            <Press onPress={() => seek(-(settings.skip || 10))}><Ionicons name="play-back" size={34} color="#fff" /></Press>
            <Press onPress={toggle} scale={0.85}>
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
                {s.episodes ? <Tool icon="albums-outline" label={t('episodes')} onPress={() => setPanel('eps')} /> : null}
                <Tool icon="lock-open-outline" label={t('lock')} onPress={() => { setLocked(true); setShow(false); }} />
                {s.next ? <Tool icon="play-skip-forward" label={t('nextEp')} onPress={() => goNext()} /> : null}
              </Row>
            </Glass>
          </View>
        </Animated.View>
      ) : null}

      {showSkipIntro && !locked ? (
        <Animated.View entering={ZoomIn} style={[styles.skipIntro, { bottom: (show ? 170 : 40) + insets.bottom }]}>
          <Press onPress={() => { player.seekBy(85); poke(); }}>
            <Glass radius={14} interactive style={{ paddingHorizontal: 16, paddingVertical: 10 }}><Txt bold style={{ color: '#fff' }}>{t('skipIntro')}</Txt></Glass>
          </Press>
        </Animated.View>
      ) : null}

      {nextCount != null ? (
        <Animated.View entering={ZoomIn} style={[styles.skipIntro, { bottom: (show ? 170 : 40) + insets.bottom }]}>
          <Row gap={8}>
            <Press onPress={() => setNextCount(null)}><Glass radius={14} style={{ paddingHorizontal: 14, paddingVertical: 10 }}><Txt style={{ color: '#fff' }}>{t('cancel')}</Txt></Glass></Press>
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
            {subsList.map((x, i) => (
              <Opt key={x.id || x.url || i} label={`${langName(x.lang)} · ${x.addon === 'stream' ? t('fromSource') : x.addon}`} on={subSel === x}
                onPress={() => { chooseSub(x); setPanel(null); }} />
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

function Opt({ label, on, onPress }) {
  return (
    <Pressable onPress={onPress} style={{ paddingVertical: 13, paddingHorizontal: 18 }}>
      <Row gap={10}>
        <Ionicons name={on ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={on ? '#fff' : '#777'} />
        <Txt style={{ color: '#fff', flex: 1 }} size={15} numberOfLines={1}>{label}</Txt>
      </Row>
    </Pressable>
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
  subWrap: { position: 'absolute', left: 24, right: 24, alignItems: 'center' },
  subText: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, overflow: 'hidden', lineHeight: 28 },
  centerAbs: { ...FILL, alignItems: 'center', justifyContent: 'center' },
  skipIntro: { position: 'absolute', end: 20 },
  lockBtn: { position: 'absolute', alignSelf: 'center' },
});
