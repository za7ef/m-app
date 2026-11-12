import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, Dimensions, ActivityIndicator, TextInput, Linking, Alert, Platform, PanResponder } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import Animated, {
  useSharedValue, withTiming, useAnimatedScrollHandler, useAnimatedStyle, interpolate, Extrapolation, FadeIn, FadeInDown, FadeInUp,
} from 'react-native-reanimated';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useStore, useTheme } from '../../../store';
import { Txt, Row, Btn, IconBtn, Glass, Press, Chips } from '../../../components/ui';
import { MediaRow, Poster } from '../../../components/media';
import { getMeta, getStreams, fetchCatalog, streamQuality, allowedFor } from '../../../addons';
import { setSession } from '../../../session';
import { magnetOf, resolveTorrent, torrentReady, sortTorrents, torrentErrorKey, endDirectPlayback, warmEngine } from '../../../torrent';
import { t, isRTL, getLang } from '../../../i18n';
import Trailer, { MuteButton, trailerIdOf } from '../../../components/Trailer';
import { localizeMeta, localizeEpisodes, translate } from '../../../localize';

const FILL = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 };

const { width: W } = Dimensions.get('window');
const HERO = W * 0.62;

export default function Title() {
  const th = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { type, id, autoplay } = useLocalSearchParams();
  const metaId = (() => { try { return decodeURIComponent(id); } catch { return String(id); } })(); // a bad %-sequence must not crash the page
  const store = useStore();
  const { addons, inList, toggleList, progress, watched, settings, profile } = store;
  const [meta, setMeta] = useState(null);
  const [err, setErr] = useState(false);
  const [season, setSeason] = useState(null);
  const [sources, setSources] = useState(null); // { videoId, direct, external, torrents, loading }
  const [similar, setSimilar] = useState([]);
  const [link, setLink] = useState('');
  const [resolving, setResolving] = useState(null); // infoHash being resolved
  const [resolveInfo, setResolveInfo] = useState(null); // live engine progress (direct mode)
  const y = useSharedValue(0);
  const [focused, setFocused] = useState(true);
  useFocusEffect(React.useCallback(() => { setFocused(true); return () => setFocused(false); }, []));
  const [trailerOn, setTrailerOn] = useState(false);
  const trailerMuted = !!settings.trailerMuted; // remembered across titles and launches
  const setTrailerMuted = (f) => store.setSetting('trailerMuted', typeof f === 'function' ? f(trailerMuted) : f);
  const [trailerStopped, setTrailerStopped] = useState(false);
  const [handleOn, setHandleOn] = useState(true);
  useEffect(() => { const id = setTimeout(() => setHandleOn(false), 2000); return () => clearTimeout(id); }, []);
  const [loc, setLoc] = useState(null); // { name, description } in the app language
  const addonsRef = useRef(addons); addonsRef.current = addons;

  useEffect(() => {
    let alive = true;
    getMeta(type, metaId, addons).then((m) => {
      if (!alive) return;
      setMeta(m);
      localizeMeta(m, getLang()).then(async (l) => {
        if (!l?.description && m.description && getLang() !== 'en') {
          try { l = { ...(l || {}), description: await translate(m.description, getLang()) }; } catch {}
        }
        if (alive) setLoc(l);
      }).catch(() => {});
      const seasons = [...new Set((m.videos || []).map((v) => v.season))].filter((s) => s != null).sort((a, b) => (a || 99) - (b || 99));
      const pr = progress[metaId];
  // Long seasons (hundreds of episodes) are drawn in chunks as you scroll down, not all at once.
  const EP_CHUNK = 40;
  const [epLimit, setEpLimit] = useState(EP_CHUNK);
  useEffect(() => { setEpLimit(EP_CHUNK); }, [season]);
  const onScrollEnd = (e) => {
    const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
    if (epLimit < episodes.length && contentOffset.y + layoutMeasurement.height > contentSize.height - 900) setEpLimit((n) => n + EP_CHUNK);
  };
      setSeason(pr?.season ?? seasons.find((s) => s > 0) ?? seasons[0] ?? null);
      const g = (m.genres || m.genre || [])[0];
      const cm = addons.find((a) => a.id === 'com.linvo.cinemeta');
      if (g && cm) fetchCatalog(cm, type, 'top', { genre: g }).then((s) => alive && setSimilar(s.filter((x) => x.id !== metaId).slice(0, 18))).catch(() => {});
    }).catch(() => alive && setErr(true));
    return () => { alive = false; };
  }, [metaId]);

  const episodes = useMemo(() => (meta?.videos || []).filter((v) => v.season === season).sort((a, b) => (a.episode || a.number) - (b.episode || b.number)), [meta, season]);
  const seasons = useMemo(() => [...new Set((meta?.videos || []).map((v) => v.season))].filter((s) => s != null).sort((a, b) => (a || 99) - (b || 99)), [meta]);
  const isSeries = type === 'series' && (meta?.videos || []).length > 0;
  const [epLoc, setEpLoc] = useState({});
  useEffect(() => {
    if (!episodes.length || getLang() === 'en') return;
    let ok = true;
    localizeEpisodes(episodes.filter((v) => !epLoc[v.id]), getLang(), (part) => ok && setEpLoc((p) => ({ ...p, ...part }))).catch(() => {});
    return () => { ok = false; };
  }, [episodes]);
  const pr = progress[metaId];

  const pickBest = (direct) => {
    const sorted = [...direct].sort((a, b) => streamQuality(b) - streamQuality(a));
    if (settings.dataUsage === 'save') sorted.reverse();
    return sorted[0];
  };

  // One request at a time: a newer tap cancels the older one so a late empty answer can't overwrite good results.
  const reqRef = useRef(0);
  const streamAbort = useRef(null);
  const openSources = async (video, auto) => {
    const vid = video ? video.id : metaId;
    const req = ++reqRef.current;
    streamAbort.current?.abort();
    const ctl = new AbortController(); streamAbort.current = ctl;
    setTrailerStopped(true); // pressing play stops the trailer and brings the poster back
    setSources({ videoId: vid, video, loading: true, direct: [], external: [], torrents: [] });
    const cur = () => req === reqRef.current && alive.current;
    // Resume: replay the exact source last used for this title/episode, if it shows up again.
    const last = auto ? (watched[vid]?.source || (pr && pr.videoId === vid ? pr.source : null)) : null;
    let done = false;
    const tryAuto = (s) => {
      if (done || !auto || !cur()) return;
      if (last?.infoHash) {
        const tt = s.torrents.find((x) => x.infoHash === last.infoHash && (last.fileIdx == null || x.fileIdx === last.fileIdx))
          || s.torrents.find((x) => x.infoHash === last.infoHash);
        if (tt) { done = true; playTorrent(tt, video); }
      } else if (last?.url) {
        const d = s.direct.find((x) => x.url === last.url);
        if (d) { done = true; play(d, video); }
      }
    };
    let s = { direct: [], external: [], torrents: [] };
    for (let round = 0; round < 2 && cur(); round++) {
      if (round) await new Promise((r) => setTimeout(r, 2000));
      s = await getStreams(type, vid, addonsRef.current, { signal: ctl.signal,
        onUpdate: (p) => { if (!cur()) return; setSources({ videoId: vid, video, ...p, loading: true }); tryAuto(p); } });
      if (s.direct.length || s.external.length || s.torrents.length) break;
    }
    if (!cur()) return;
    setSources({ videoId: vid, video, ...s, loading: false });
    tryAuto(s);
    if (!done && auto && !last && s.direct.length) play(pickBest(s.direct), video);
  };

  // Torrent source → resolve to a direct URL (debrid / streaming server) → play.
  const alive = useRef(true);
  const resolvingRef = useRef(false);
  const abortRef = useRef(null);
  useEffect(() => { alive.current = true; warmEngine(settings); return () => { alive.current = false; abortRef.current?.abort(); streamAbort.current?.abort(); }; }, []);
  const cancelResolve = () => abortRef.current?.abort();
  const playTorrent = async (tt, video) => {
    if (!torrentReady(settings)) {
      Alert.alert(t('torrentSetupTitle'), t('torrentSetupMsg'), [
        { text: t('cancel'), style: 'cancel' }, { text: t('torrentOpenSettings'), onPress: () => router.navigate('/settings') }]);
      return;
    }
    if (resolvingRef.current) return; // one at a time
    resolvingRef.current = true;
    setResolving(tt.infoHash);
    try {
      const ctl = new AbortController(); abortRef.current = ctl;
      const r = await resolveTorrent(tt, settings, { signal: ctl.signal, onProgress: (p) => alive.current && setResolveInfo(p) });
      if (alive.current && !ctl.signal.aborted) play({ ...tt, url: r.url, subtitles: tt.subtitles }, video);
      else endDirectPlayback(); // cancelled, or the user left the page while it was loading
    } catch (e) {
      if (alive.current && e?.code !== 'cancelled') Alert.alert(t('torrentFailTitle'), t(torrentErrorKey(e)) + (e?.message && e.message !== e.code ? `\n\n${e.message}` : ''));
    }
    resolvingRef.current = false;
    if (alive.current) { setResolving(null); setResolveInfo(null); }
  };

  const play = (stream, video) => {
    const idx = video ? episodes.findIndex((e) => e.id === video.id) : -1;
    const next = idx >= 0 ? episodes[idx + 1] : null;
    setSession({
      url: stream.url, fallbacks: stream.fallbacks || [], headers: stream.behaviorHints?.proxyHeaders?.request, title: loc?.name || meta.name,
      subtitle: video ? `${t('season', { n: video.season })} · ${t('episode', { n: video.episode || video.number })}${video.name ? ' · ' + (epLoc[video.id]?.name || video.name) : ''}` : '',
      metaId, type, videoId: video ? video.id : metaId, season: video?.season, episode: video?.episode || video?.number,
      poster: meta.poster, background: meta.background, thumb: video?.thumbnail,
      startAt: (() => { const vid0 = video ? video.id : metaId; const w = watched[vid0] || (pr && pr.videoId === vid0 ? pr : null); return settings.resume && w && w.pos < (w.dur || 1) * 0.95 ? w.pos : 0; })(),
      streamSubs: stream.subtitles || [],
      magnet: stream.infoHash && stream.trackers ? magnetOf(stream) : null, // lets the player revive the local server after background
      source: stream.infoHash ? { infoHash: stream.infoHash, fileIdx: stream.fileIdx, addon: stream.addon } : { url: stream.url, addon: stream.addon },
      next: next ? { video: next, metaName: meta.name } : null,
      episodes: isSeries ? episodes : null,
    });
    router.push('/player');
  };

  // Autoplay from hero / continue watching
  useEffect(() => {
    if (!meta || autoplay !== '1') return;
    if (isSeries) {
      const v = (pr && meta.videos.find((x) => x.id === pr.videoId)) || episodes[0];
      if (v) openSources(v, true);
    } else openSources(null, true);
  }, [meta]);

  const dragging = useSharedValue(0);
  // iOS sheets move as a whole when pulled down (the scroll offset stays at 0), so show the grabber as soon as
  // a drag starts at the top of the page, and hide it again when the drag ends.
  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => { y.value = e.contentOffset.y; },
    onBeginDrag: (e) => { if (e.contentOffset.y <= 8) dragging.value = withTiming(1, { duration: 120 }); },
    onEndDrag: () => { dragging.value = withTiming(0, { duration: 400 }); },
    onMomentumEnd: () => { dragging.value = withTiming(0, { duration: 400 }); },
  });
  const grabShow = useSharedValue(1);
  useEffect(() => { grabShow.value = withTiming(handleOn ? 1 : 0, { duration: 300 }); }, [handleOn]);
  const grabSt = useAnimatedStyle(() => ({ opacity: Math.max(grabShow.value, dragging.value, interpolate(y.value, [-40, -4], [1, 0], Extrapolation.CLAMP)) }));
  // Android has no native swipe-to-dismiss for modals: drag the top strip down to close.
  const dragClose = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: () => setHandleOn(true),
    onPanResponderRelease: (_, g) => { if (g.dy > 70) router.back(); else setHandleOn(false); },
    onPanResponderTerminate: () => setHandleOn(false),
  }), []);
  const heroSt = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(y.value, [-200, 0, HERO], [-100, 0, HERO * 0.45], Extrapolation.CLAMP) },
      { scale: interpolate(y.value, [-200, 0], [1.4, 1], Extrapolation.CLAMP) }],
  }));
  const barSt = useAnimatedStyle(() => ({ opacity: interpolate(y.value, [HERO * 0.5, HERO * 0.9], [0, 1], Extrapolation.CLAMP) }));

  if (err) return <View style={[styles.center, { backgroundColor: th.bg }]}><Txt sub>{t('error')}</Txt><Btn small kind="glass" title={t('cancel')} onPress={() => router.back()} style={{ marginTop: 14 }} /></View>;
  if (!meta) return <View style={[styles.center, { backgroundColor: th.bg }]}><ActivityIndicator color={th.accent} size="large" /></View>;
  if (!allowedFor(profile, meta)) return <View style={[styles.center, { backgroundColor: th.bg }]}><Ionicons name="lock-closed" size={40} color={th.dim} /><Btn small kind="glass" title={t('cancel')} onPress={() => router.back()} style={{ marginTop: 14 }} /></View>;

  const saved = inList(meta.id);
  const year = meta.releaseInfo || meta.year;
  return (
    <View style={{ flex: 1, backgroundColor: th.bg }}>
      <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} onMomentumScrollEnd={onScrollEnd} onScrollEndDrag={onScrollEnd} contentContainerStyle={{ paddingBottom: 60 }}>
        <View style={{ height: HERO, overflow: 'hidden' }}>
          <Animated.View style={[StyleSheet.absoluteFill, heroSt]}>
            <Image source={{ uri: meta.background || meta.poster }} style={StyleSheet.absoluteFill} contentFit="cover" transition={400} />
            <Trailer id={trailerIdOf(meta)} active={focused && !trailerStopped} muted={trailerMuted} onPlaying={setTrailerOn} />
          </Animated.View>
          <LinearGradient colors={['transparent', th.bg]} locations={[0.5, 1]} style={StyleSheet.absoluteFill} pointerEvents="none" />
        </View>

        <Animated.View entering={FadeInDown.duration(450)} style={{ paddingHorizontal: 16, marginTop: -40 }}>
          {meta.logo ? <Image source={{ uri: meta.logo }} style={{ width: W * 0.6, height: 80, alignSelf: 'flex-start' }} contentFit="contain" contentPosition={isRTL() ? 'right' : 'left'} />
            : <Txt bold size={28}>{loc?.name || meta.name}</Txt>}
          {meta.logo && loc?.name && loc.name !== meta.name ? <Txt sub bold size={15} style={{ marginTop: 6 }}>{loc.name}</Txt> : null}
          <Row gap={10} style={{ marginTop: 10, flexWrap: 'wrap' }}>
            {meta.imdbRating ? <Row gap={4}><Ionicons name="star" size={13} color="#F5C518" /><Txt bold size={13}>{meta.imdbRating}</Txt></Row> : null}
            {year ? <Txt sub size={13}>{year}</Txt> : null}
            {meta.runtime ? <Txt sub size={13}>{meta.runtime}</Txt> : null}
            {isSeries ? <Txt sub size={13}>{seasons.filter((s) => s > 0).length} {t('series') === 'Series' ? 'Seasons' : 'مواسم'}</Txt> : null}
          </Row>

          <Btn kind="light" icon="play" title={pr ? t('resume') : t('play')} style={{ marginTop: 16 }}
            onPress={() => {
              if (isSeries) openSources((pr && meta.videos.find((x) => x.id === pr.videoId)) || episodes[0], true);
              else openSources(null, true);
            }} />
          {pr ? (
            <View style={[styles.prTrack, { backgroundColor: th.line }]}><View style={{ height: 3, width: `${(pr.pos / (pr.dur || 1)) * 100}%`, backgroundColor: th.accent }} /></View>
          ) : null}

          {sources ? <Sources s={sources} resolving={resolving} info={resolveInfo} onCancel={cancelResolve} ready={torrentReady(settings)} onPlay={(st) => play(st, sources.video)} onTorrent={(tt) => playTorrent(tt, sources.video)} /> : null}

          {loc?.description || meta.description ? <Txt size={15} style={{ marginTop: 16, lineHeight: 22 }}>{loc?.description || meta.description}</Txt> : null}
          {meta.cast?.length ? <Txt sub size={13} style={{ marginTop: 10 }} numberOfLines={2}>{t('cast')}: {meta.cast.slice(0, 5).join('، ')}</Txt> : null}
          {meta.director?.length ? <Txt sub size={13} style={{ marginTop: 4 }}>{t('director')}: {[].concat(meta.director).join('، ')}</Txt> : null}

          <Row gap={28} style={{ marginTop: 18, marginBottom: 6 }}>
            <Press onPress={() => toggleList(meta)} style={{ alignItems: 'center' }}>
              <Ionicons name={saved ? 'checkmark' : 'add'} size={26} color={th.text} />
              <Txt sub size={12}>{saved ? t('added') : t('myList')}</Txt>
            </Press>
            <Press onPress={() => meta.trailers?.[0] && WebBrowser.openBrowserAsync(`https://www.youtube.com/watch?v=${meta.trailers[0].source}`)} style={{ alignItems: 'center', opacity: meta.trailers?.length ? 1 : 0.4 }}>
              <Ionicons name="film-outline" size={24} color={th.text} />
              <Txt sub size={12}>{t('trailer')}</Txt>
            </Press>
          </Row>

          {/* direct link you own the rights to */}
          <Glass radius={14} style={{ marginTop: 14, padding: 10 }}>
            <Row gap={8}>
              <Ionicons name="link" size={18} color={th.sub} />
              <TextInput value={link} onChangeText={setLink} placeholder={t('directLinkPh')} placeholderTextColor={th.dim}
                autoCapitalize="none" autoCorrect={false} keyboardType="url" style={{ flex: 1, color: th.text, fontSize: 14, textAlign: 'left', writingDirection: 'ltr' }} />
              <Btn small title={t('open')} onPress={() => /^https?:\/\//i.test(link.trim()) && play({ url: link.trim() }, null)} />
            </Row>
          </Glass>
        </Animated.View>

        {isSeries ? (
          <View style={{ marginTop: 22 }}>
            <View style={{ paddingHorizontal: 16 }}>
              <Txt bold size={19}>{t('episodes')}</Txt>
              <Chips value={season} onChange={setSeason} options={seasons.map((s) => [s, s === 0 ? t('specials') : t('season', { n: s })])} />
            </View>
            {episodes.slice(0, epLimit).map((v, i) => (
              <Animated.View key={v.id} entering={FadeIn.delay(Math.min(i, 10) * 30)}>
                <Press scale={0.98} onPress={() => openSources(v, false)}>
                  <Row gap={12} center={false} style={{ paddingHorizontal: 16, paddingVertical: 10 }}>
                    <View style={{ width: W * 0.34, height: W * 0.2, borderRadius: 8, overflow: 'hidden', backgroundColor: th.card, alignItems: 'center', justifyContent: 'center' }}>
                      {v.thumbnail ? <Image source={{ uri: v.thumbnail }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} /> : null}
                      <Ionicons name="play-circle" size={32} color="rgba(255,255,255,0.92)" style={{ textAlign: 'center', lineHeight: 34, width: 34, height: 34 }} />
                      {watched[v.id] ? <View style={[styles.epProg, { width: `${Math.min(100, (watched[v.id].pos / (watched[v.id].dur || 1)) * 100)}%`, backgroundColor: th.accent }]} /> : null}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Txt bold size={14} numberOfLines={2}>{(v.episode || v.number) + '. ' + (epLoc[v.id]?.name || v.name || v.title || t('episode', { n: v.episode || v.number }))}</Txt>
                      {v.overview || v.description ? <Txt sub size={12} numberOfLines={3} style={{ marginTop: 4, lineHeight: 17 }}>{epLoc[v.id]?.overview || v.overview || v.description}</Txt> : null}
                    </View>
                  </Row>
                </Press>
              </Animated.View>
            ))}
          </View>
        ) : null}

        {similar.length ? <View style={{ marginTop: 20 }}><MediaRow title={t('moreLikeThis')} items={similar.filter((m) => allowedFor(profile, m))} /></View> : null}
        {/* last child so it sits above the logo block that overlaps the hero bottom (that overlap ate the taps before) */}
        {trailerOn && !trailerStopped ? <MuteButton muted={trailerMuted} onToggle={() => setTrailerMuted(!trailerMuted)} style={{ position: 'absolute', top: HERO - 48, end: 16, zIndex: 20, elevation: 20 }} /> : null}
      </Animated.ScrollView>

      {/* floating glass bar */}
      <Animated.View style={[styles.bar, { paddingTop: insets.top > 20 ? 10 : 10 }, barSt]} pointerEvents="none">
        <View style={[StyleSheet.absoluteFill, { backgroundColor: th.bg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: th.line }]} />
        <LinearGradient colors={[th.bg, 'transparent']} style={{ position: 'absolute', left: 0, right: 0, top: 64, height: 18 }} />
        <Txt bold center size={16} numberOfLines={1} style={{ marginHorizontal: 70 }}>{loc?.name || meta.name}</Txt>
      </Animated.View>
      {/* grabber: shown 2 s on open, and again while pulling down to close */}
      <Animated.View pointerEvents={Platform.OS === 'android' ? 'auto' : 'none'} {...(Platform.OS === 'android' ? dragClose.panHandlers : {})}
        style={[styles.grabWrap, grabSt]}>
        <View style={styles.grab} />
      </Animated.View>
    </View>
  );
}

function Sources({ s, onPlay, onTorrent, resolving, ready, info, onCancel }) {
  const th = useTheme();
  const any = s.direct.length || s.external.length || s.torrents.length;
  if (s.loading && !any) return <Row gap={8} style={{ marginTop: 14 }}><ActivityIndicator color={th.accent} /><Txt sub>{t('loading')}</Txt></Row>;
  return (
    <Animated.View entering={FadeInUp.duration(300)} style={{ marginTop: 14 }}>
      <Row gap={8} style={{ marginBottom: 8 }}><Txt bold size={16}>{t('sources')}</Txt>{s.loading ? <ActivityIndicator size="small" color={th.accent} /> : null}</Row>
      {s.direct.map((st, i) => (
        <Press key={'d' + i} scale={0.98} onPress={() => onPlay(st)}>
          <Glass radius={14} interactive style={{ padding: 12, marginBottom: 8 }}>
            <Row gap={10}>
              <Ionicons name="play-circle" size={26} color={th.accent} />
              <View style={{ flex: 1 }}>
                <Txt bold size={14} numberOfLines={1}>{st.name || st.addon}</Txt>
                <Txt sub size={12} numberOfLines={2}>{(st.title || st.description || '').replace(/\n/g, ' · ')}</Txt>
              </View>
            </Row>
          </Glass>
        </Press>
      ))}
      {s.external.length ? <Txt sub size={13} style={{ marginTop: 6, marginBottom: 6 }}>{t('whereToWatch')} · {t('opensExternally')}</Txt> : null}
      {s.external.map((st, i) => (
        <Press key={'e' + i} scale={0.98} onPress={() => Linking.openURL(st.externalUrl).catch(() => WebBrowser.openBrowserAsync(st.externalUrl))}>
          <Glass radius={14} interactive style={{ padding: 12, marginBottom: 8 }}>
            <Row gap={10}>
              <Ionicons name="open-outline" size={22} color={th.sub} />
              <View style={{ flex: 1 }}>
                <Txt bold size={14} numberOfLines={1}>{st.name}</Txt>
                {st.title ? <Txt sub size={12} numberOfLines={1}>{st.title}</Txt> : null}
              </View>
            </Row>
          </Glass>
        </Press>
      ))}
      {s.torrents.length ? (
        <>
          <Txt sub size={13} style={{ marginTop: 6, marginBottom: 6 }}>{t('torrentSources')}{ready ? '' : ' · ' + t('torrentNotSet')}</Txt>
          {sortTorrents(s.torrents).slice(0, 25).map((tt) => (
            <Press key={tt.infoHash + (tt.fileIdx ?? '')} scale={0.98} disabled={!!resolving && resolving !== tt.infoHash}
              onPress={() => (resolving === tt.infoHash ? onCancel() : onTorrent(tt))}>
              <Glass radius={14} interactive style={{ padding: 12, marginBottom: 8, opacity: resolving && resolving !== tt.infoHash ? 0.5 : 1 }}>
                <Row gap={10}>
                  {resolving === tt.infoHash ? <ActivityIndicator color={th.accent} /> : <Ionicons name="magnet-outline" size={24} color={th.accent} />}
                  <View style={{ flex: 1 }}>
                    <Txt bold size={14} numberOfLines={1}>{(tt.name || tt.addon).replace(/\n/g, ' ')}</Txt>
                    <Txt sub size={12} numberOfLines={2}>{(tt.title || tt.description || '').replace(/\n/g, ' · ')}</Txt>
                    {resolving === tt.infoHash && info ? (
                      <Txt size={12} style={{ color: th.accent, marginTop: 4 }}>
                        {info.phase === 'meta' ? (info.secs != null ? t('engMetaLive', { dht: info.dht, known: info.known, secs: info.secs }) : t('engMeta'))
                          : t('engBuffer', { peers: info.peers || 0, mb: ((info.down || 0) / 1048576).toFixed(1) })}
                      </Txt>
                    ) : null}
                    {resolving === tt.infoHash ? <Txt size={12} dim style={{ marginTop: 2 }}>{t('tapToCancel')}</Txt> : null}
                  </View>
                </Row>
              </Glass>
            </Press>
          ))}
        </>
      ) : null}
      {!s.loading && !any ? (
        <View><Txt sub size={14}>{t('noSources')}</Txt><Txt dim size={12} style={{ marginTop: 4 }}>{t('noSourcesHint')}</Txt></View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  center: { ...FILL, alignItems: 'center', justifyContent: 'center' },
  bar: { position: 'absolute', top: 0, left: 0, right: 0, height: 64, justifyContent: 'center' },
  grabWrap: { position: 'absolute', top: 0, left: 0, right: 0, height: 34, alignItems: 'center', paddingTop: 8 },
  grab: { width: 40, height: 5, borderRadius: 3, backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
  prTrack: { height: 3, borderRadius: 2, marginTop: 8, overflow: 'hidden' },
  epProg: { position: 'absolute', bottom: 0, start: 0, height: 3 },
});
