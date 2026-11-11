import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { View, StyleSheet, RefreshControl, Platform } from 'react-native';
import Animated, { useSharedValue, useAnimatedScrollHandler, useAnimatedStyle, interpolate, Extrapolation } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { useStore, useTheme } from '../../store';
import { Txt, Row, Press, Glass, Chips, IconBtn } from '../../components/ui';
import MaskedView from '@react-native-masked-view/masked-view';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Hero, MediaRow, Poster, WideCard, metaHref } from '../../components/media';
import { catalogsOf, fetchCatalog, allowedFor, OPEN_MOVIES_URL } from '../../addons';
import { t } from '../../i18n';

const GENRE_ROWS = [['Action', 'أكشن'], ['Comedy', 'كوميديا'], ['Animation', 'رسوم متحركة'], ['Sci-Fi', 'خيال علمي'], ['Documentary', 'وثائقي']];

function catTitle(c) {
  if (c.addon.transportUrl === OPEN_MOVIES_URL) return t('openMovies');
  if (c.addon.id === 'com.linvo.cinemeta') {
    if (c.id === 'top') return c.type === 'movie' ? t('popularMovies') : t('popularSeries');
    if (c.id === 'imdbRating') return `${t('featured')} · ${c.type === 'movie' ? t('movies') : t('series')}`;
  }
  return `${c.name || c.id} · ${c.addon.manifest.name}`;
}

export default function Home() {
  const th = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { addons, profile, progress, settings } = useStore();
  const [filter, setFilter] = useState('all');
  const [rows, setRows] = useState({});
  const [refreshing, setRefreshing] = useState(false);
  const y = useSharedValue(0);

  const cats = useMemo(() => {
    const base = catalogsOf(addons).filter((c) => filter === 'all' || c.type === filter);
    const genre = [];
    const cm = addons.find((a) => a.id === 'com.linvo.cinemeta' && !a.disabled);
    if (cm) for (const [g, ar] of GENRE_ROWS) for (const type of ['movie', 'series']) {
      if (filter !== 'all' && filter !== type) continue;
      if (filter === 'all' && type === 'series') continue;
      genre.push({ addon: cm, type, id: 'top', genre: g, key: `g:${type}:${g}`, title: settings.lang === 'ar' ? ar : g });
    }
    return [...base.map((c) => ({ ...c, key: `${c.addon.transportUrl}|${c.type}|${c.id}`, title: catTitle(c) })), ...genre];
  }, [addons, filter, settings.lang]);

  const load = useCallback(async () => {
    await Promise.all(cats.map(async (c) => {
      setRows((r) => (r[c.key]?.items ? r : { ...r, [c.key]: { loading: true } }));
      try {
        const items = await fetchCatalog(c.addon, c.type, c.id, c.genre ? { genre: c.genre } : {});
        setRows((r) => ({ ...r, [c.key]: { items } }));
      } catch { setRows((r) => ({ ...r, [c.key]: { items: [], error: true } })); }
    }));
  }, [cats]);
  useEffect(() => { load(); }, [load]);

  const ok = (m) => allowedFor(profile, m);
  const heroItems = useMemo(() => {
    const first = cats.find((c) => c.addon.id === 'com.linvo.cinemeta' && c.id === 'top');
    return ((first && rows[first.key]?.items) || []).filter(ok);
  }, [rows, cats, profile]);

  const cw = Object.values(progress || {}).sort((a, b) => b.at - a.at).filter((p) => p.pos > 5 && p.pos < (p.dur || 1) * 0.95);

  const onScroll = useAnimatedScrollHandler((e) => { y.value = e.contentOffset.y; });
  const headerBg = useAnimatedStyle(() => ({ opacity: interpolate(y.value, [0, 160], [0, 1], Extrapolation.CLAMP) }));

  return (
    <View style={{ flex: 1, backgroundColor: th.bg }}>
      {/* Vertical list is virtualized: only rows near the screen are mounted (many catalogs stay fast). */}
      <Animated.FlatList onScroll={onScroll} scrollEventThrottle={16} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} tintColor={th.accent} onRefresh={async () => { setRefreshing(true); setRows({}); await load(); setRefreshing(false); }} />}
        contentContainerStyle={{ paddingBottom: 150 }}
        data={cats} keyExtractor={(c) => c.key}
        initialNumToRender={4} maxToRenderPerBatch={3} windowSize={7} removeClippedSubviews={Platform.OS === 'android'}
        extraData={[rows, profile]}
        ListHeaderComponent={
          <>
            <Hero items={heroItems} motion={settings.previews} />
            {cw.length ? (
              <MediaRow title={t('continueWatching')} items={cw.map((p) => ({ ...p, id: p.metaId }))} wide
                renderItem={(p) => <WideCard item={p} onPress={() => router.push(metaHref({ id: p.metaId, type: p.type }) + '?autoplay=1')} />} />
            ) : null}
          </>
        }
        renderItem={({ item: c }) => {
          const r = rows[c.key] || { loading: true };
          return <MediaRow title={c.title} loading={r.loading} items={(r.items || []).filter(ok)} />;
        }} />

      {/* Top bar: glass appears as you scroll */}
      <View style={[styles.top, { paddingTop: insets.top + 4 }]} pointerEvents="box-none">
        {/* Gradient glass: blur + tint that fade out downwards (no hard edge) */}
        <Animated.View style={[styles.fade, headerBg]} pointerEvents="none">
          <MaskedView style={StyleSheet.absoluteFill}
            maskElement={<LinearGradient colors={['#000', '#000', 'rgba(0,0,0,0.6)', 'transparent']} locations={[0, 0.45, 0.75, 1]} style={StyleSheet.absoluteFill} />}>
            <BlurView intensity={45} tint={th.dark ? 'systemUltraThinMaterialDark' : 'systemUltraThinMaterialLight'} style={StyleSheet.absoluteFill} />
            <LinearGradient colors={[th.bg + 'CC', th.bg + '66', 'transparent']} style={StyleSheet.absoluteFill} />
          </MaskedView>
        </Animated.View>
        <Row style={{ justifyContent: 'space-between', paddingHorizontal: 14 }}>
          <Image source={require('../../../assets/mark.png')} style={{ width: 40, height: 40 }} />
          <IconBtn name="search" size={20} onPress={() => router.push('/search')} />
        </Row>
        <View style={{ paddingHorizontal: 14, paddingBottom: 8 }}>
          <Chips value={filter} onChange={setFilter} options={[['all', t('all')], ['movie', t('movies')], ['series', t('series')]]} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { position: 'absolute', top: 0, left: 0, right: 0 },
  fade: { position: 'absolute', top: 0, left: 0, right: 0, bottom: -40 },
});
