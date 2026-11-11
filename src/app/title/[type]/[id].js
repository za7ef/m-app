import React, { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, Dimensions, ActivityIndicator, TextInput, Linking, Alert } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import Animated, {
  useSharedValue, useAnimatedScrollHandler, useAnimatedStyle, interpolate, Extrapolation, FadeIn, FadeInDown, FadeInUp, Layout,
} from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useStore, useTheme } from '../../../store';
import { Txt, Row, Btn, IconBtn, Glass, Press, Chips } from '../../../components/ui';
import { MediaRow, Poster } from '../../../components/media';
import { getMeta, getStreams, fetchCatalog, streamQuality, allowedFor } from '../../../addons';
import { setSession } from '../../../session';
import { resolveTorrent, torrentReady, sortTorrents, torrentErrorKey } from '../../../torrent';
import { t, isRTL } from '../../../i18n';

const FILL = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 };

const { width: W } = Dimensions.get('window');
const HERO = W * 0.62;

export default function Title() {
  const th = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { type, id, autoplay } = useLocalSearchParams();
  const metaId = decodeURIComponent(id);
  const store = useStore();
  const { addons, inList, toggleList, progress, watched, settings, profile } = store;
  const [meta, setMeta] = useState(null);
  const [err, setErr] = useState(false);
  const [season, setSeason] = useState(null);
  const [sources, setSources] = useState(null); // { videoId, direct, external, torrents, loading }
  const [similar, setSimilar] = useState([]);
  const [link, setLink] = useState('');
  const [resolving, setResolving] = useState(null); // infoHash being resolved
  const y = useSharedValue(0);

  useEffect(() => {
    let alive = true;
    getMeta(type, metaId, addons).then((m) => {
      if (!alive) return;
      setMeta(m);
      const seasons = [...new Set((m.videos || []).map((v) => v.season))].filter((s) => s != null).sort((a, b) => (a || 99) - (b || 99));
      const pr = progress[metaId];
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
  const pr = progress[metaId];

  const pickBest = (direct) => {
    const sorted = [...direct].sort((a, b) => streamQuality(b) - streamQuality(a));
    if (settings.dataUsage === 'save') sorted.reverse();
    return sorted[0];
  };

  const openSources = async (video, auto) => {
    const vid = video ? video.id : metaId;
    setSources({ videoId: vid, video, loading: true, direct: [], external: [], torrents: [] });
    const s = await getStreams(type, vid, addons);
    setSources({ videoId: vid, video, ...s, loading: false });
    if (auto && s.direct.length) play(pickBest(s.direct), video);
  };

  // Torrent source → resolve to a direct URL (debrid / streaming server) → play.
  const playTorrent = async (tt, video) => {
    if (!torrentReady(settings)) {
      Alert.alert(t('torrentSetupTitle'), t('torrentSetupMsg'), [
        { text: t('cancel'), style: 'cancel' }, { text: t('torrentOpenSettings'), onPress: () => router.navigate('/settings') }]);
      return;
    }
    setResolving(tt.infoHash);
    try {
      const r = await resolveTorrent(tt, settings);
      play({ ...tt, url: r.url, subtitles: tt.subtitles }, video);
    } catch (e) {
      Alert.alert(t('torrentFailTitle'), t(torrentErrorKey(e)));
    }
    setResolving(null);
  };

  const play = (stream, video) => {
    const idx = video ? episodes.findIndex((e) => e.id === video.id) : -1;
    const next = idx >= 0 ? episodes[idx + 1] : null;
    setSession({
      url: stream.url, fallbacks: stream.fallbacks || [], headers: stream.behaviorHints?.proxyHeaders?.request, title: meta.name,
      subtitle: video ? `${t('season', { n: video.season })} · ${t('episode', { n: video.episode || video.number })}${video.name ? ' · ' + video.name : ''}` : '',
      metaId, type, videoId: video ? video.id : metaId, season: video?.season, episode: video?.episode || video?.number,
      poster: meta.poster, background: meta.background, thumb: video?.thumbnail,
      startAt: (() => { const vid0 = video ? video.id : metaId; const w = watched[vid0] || (pr && pr.videoId === vid0 ? pr : null); return settings.resume && w && w.pos < (w.dur || 1) * 0.95 ? w.pos : 0; })(),
      streamSubs: stream.subtitles || [],
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

  const onScroll = useAnimatedScrollHandler((e) => { y.value = e.contentOffset.y; });
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
      <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={{ paddingBottom: 60 }}>
        <View style={{ height: HERO, overflow: 'hidden' }}>
          <Animated.View style={[StyleSheet.absoluteFill, heroSt]}>
            <Image source={{ uri: meta.background || meta.poster }} style={StyleSheet.absoluteFill} contentFit="cover" transition={400} />
          </Animated.View>
          <LinearGradient colors={['transparent', th.bg]} locations={[0.5, 1]} style={StyleSheet.absoluteFill} />
        </View>

        <Animated.View entering={FadeInDown.duration(450)} style={{ paddingHorizontal: 16, marginTop: -40 }}>
          {meta.logo ? <Image source={{ uri: meta.logo }} style={{ width: W * 0.6, height: 80, alignSelf: 'flex-start' }} contentFit="contain" contentPosition={isRTL() ? 'right' : 'left'} />
            : <Txt bold size={28}>{meta.name}</Txt>}
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

          {sources ? <Sources s={sources} resolving={resolving} ready={torrentReady(settings)} onPlay={(st) => play(st, sources.video)} onTorrent={(tt) => playTorrent(tt, sources.video)} /> : null}

          {meta.description ? <Txt size={15} style={{ marginTop: 16, lineHeight: 22 }}>{meta.description}</Txt> : null}
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
            {episodes.map((v, i) => (
              <Animated.View key={v.id} entering={FadeIn.delay(Math.min(i, 10) * 30)}>
                <Press scale={0.98} onPress={() => openSources(v, false)}>
                  <Row gap={12} center={false} style={{ paddingHorizontal: 16, paddingVertical: 10 }}>
                    <View style={{ width: W * 0.34, height: W * 0.2, borderRadius: 8, overflow: 'hidden', backgroundColor: th.card, alignItems: 'center', justifyContent: 'center' }}>
                      {v.thumbnail ? <Image source={{ uri: v.thumbnail }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} /> : null}
                      <Ionicons name="play-circle" size={32} color="rgba(255,255,255,0.92)" style={{ textAlign: 'center', lineHeight: 34, width: 34, height: 34 }} />
                      {watched[v.id] ? <View style={[styles.epProg, { width: `${Math.min(100, (watched[v.id].pos / (watched[v.id].dur || 1)) * 100)}%`, backgroundColor: th.accent }]} /> : null}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Txt bold size={14} numberOfLines={2}>{(v.episode || v.number) + '. ' + (v.name || v.title || t('episode', { n: v.episode || v.number }))}</Txt>
                      {v.overview || v.description ? <Txt sub size={12} numberOfLines={3} style={{ marginTop: 4, lineHeight: 17 }}>{v.overview || v.description}</Txt> : null}
                    </View>
                  </Row>
                </Press>
              </Animated.View>
            ))}
          </View>
        ) : null}

        {similar.length ? <View style={{ marginTop: 20 }}><MediaRow title={t('moreLikeThis')} items={similar.filter((m) => allowedFor(profile, m))} /></View> : null}
      </Animated.ScrollView>

      {/* floating glass bar */}
      <Animated.View style={[styles.bar, { paddingTop: insets.top > 20 ? 10 : 10 }, barSt]} pointerEvents="none">
        <View style={[StyleSheet.absoluteFill, { backgroundColor: th.bg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: th.line }]} />
        <LinearGradient colors={[th.bg, 'transparent']} style={{ position: 'absolute', left: 0, right: 0, top: 64, height: 18 }} />
        <Txt bold center size={16} numberOfLines={1} style={{ marginHorizontal: 70 }}>{meta.name}</Txt>
      </Animated.View>
      <View style={[styles.close, { top: 10 }]}><IconBtn name="close" onPress={() => router.back()} /></View>
    </View>
  );
}

function Sources({ s, onPlay, onTorrent, resolving, ready }) {
  const th = useTheme();
  if (s.loading) return <Row gap={8} style={{ marginTop: 14 }}><ActivityIndicator color={th.accent} /><Txt sub>{t('loading')}</Txt></Row>;
  return (
    <Animated.View entering={FadeInUp.duration(300)} style={{ marginTop: 14 }}>
      <Txt bold size={16} style={{ marginBottom: 8 }}>{t('sources')}</Txt>
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
          {sortTorrents(s.torrents, streamQuality).slice(0, 25).map((tt) => (
            <Press key={tt.infoHash + (tt.fileIdx ?? '')} scale={0.98} disabled={!!resolving} onPress={() => onTorrent(tt)}>
              <Glass radius={14} interactive style={{ padding: 12, marginBottom: 8, opacity: resolving && resolving !== tt.infoHash ? 0.5 : 1 }}>
                <Row gap={10}>
                  {resolving === tt.infoHash ? <ActivityIndicator color={th.accent} /> : <Ionicons name="magnet-outline" size={24} color={th.accent} />}
                  <View style={{ flex: 1 }}>
                    <Txt bold size={14} numberOfLines={1}>{(tt.name || tt.addon).replace(/\n/g, ' ')}</Txt>
                    <Txt sub size={12} numberOfLines={2}>{(tt.title || tt.description || '').replace(/\n/g, ' · ')}</Txt>
                  </View>
                </Row>
              </Glass>
            </Press>
          ))}
        </>
      ) : null}
      {!s.direct.length && !s.external.length && !s.torrents.length ? (
        <View><Txt sub size={14}>{t('noSources')}</Txt><Txt dim size={12} style={{ marginTop: 4 }}>{t('noSourcesHint')}</Txt></View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  center: { ...FILL, alignItems: 'center', justifyContent: 'center' },
  bar: { position: 'absolute', top: 0, left: 0, right: 0, height: 64, justifyContent: 'center' },
  close: { position: 'absolute', end: 12 },
  prTrack: { height: 3, borderRadius: 2, marginTop: 8, overflow: 'hidden' },
  epProg: { position: 'absolute', bottom: 0, start: 0, height: 3 },
});
