// "Soon": full-screen vertical feed (like Reels/Snap) of upcoming movies and series. One item per screen,
// swipe up for the next; the trailer of the visible item plays, the others stop.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, FlatList, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useStore, useTheme } from '../../store';
import { Txt, Row, Press, Glass } from '../../components/ui';
import Trailer, { MuteButton, trailerIdOf } from '../../components/Trailer';
import { metaHref } from '../../components/media';
import { loadSoon } from '../../soon';
import { localizeMeta } from '../../localize';
import { t, getLang } from '../../i18n';

const VIEWABILITY = { itemVisiblePercentThreshold: 70 }; // must not change between renders

const fmtDate = (d) => {
  try { return new Date(d + 'T12:00:00Z').toLocaleDateString(getLang() === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' }); }
  catch { return d; }
};

export default function Soon() {
  const th = useTheme();
  const [items, setItems] = useState(null);
  const [h, setH] = useState(0);
  const [index, setIndex] = useState(0);
  const [focused, setFocused] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  useFocusEffect(useCallback(() => { setFocused(true); return () => setFocused(false); }, []));
  // later arrivals are appended (not re-sorted) so the item you're watching doesn't jump
  const merge = (v) => setItems((prev) => { if (!prev || !prev.length) return v; const have = new Set(prev.map((m) => m.type + m.id)); return [...prev, ...v.filter((m) => !have.has(m.type + m.id))]; });
  useEffect(() => { loadSoon(false, (part) => part.length && merge(part)).then(merge).catch(() => setItems((p) => p || [])); }, []);
  const onViewable = useRef(({ viewableItems }) => { const v = viewableItems.find((x) => x.isViewable); if (v) setIndex(v.index); }).current;

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }} onLayout={(e) => setH(e.nativeEvent.layout.height)}>
      {!items || !h ? <View style={styles.center}><ActivityIndicator color={th.accent} size="large" /></View>
        : !items.length ? <View style={styles.center}><Txt style={{ color: '#aaa' }}>{t('soonEmpty')}</Txt></View>
        : (
          <FlatList data={items} keyExtractor={(m) => m.type + m.id} pagingEnabled showsVerticalScrollIndicator={false}
            decelerationRate="fast" snapToInterval={h} snapToAlignment="start" disableIntervalMomentum
            getItemLayout={(_, i) => ({ length: h, offset: h * i, index: i })}
            windowSize={3} initialNumToRender={2} maxToRenderPerBatch={2} removeClippedSubviews={false}
            onViewableItemsChanged={onViewable} viewabilityConfig={VIEWABILITY}
            refreshControl={<RefreshControl refreshing={refreshing} tintColor="#fff"
              onRefresh={() => { setRefreshing(true); loadSoon(true).then((v) => v.length && setItems(v)).finally(() => setRefreshing(false)); }} />}
            renderItem={({ item, index: i }) => <SoonItem m={item} h={h} active={focused && i === index} />} />
        )}
    </View>
  );
}

function SoonItem({ m, h, active }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const store = useStore();
  const { inList, toggleList, settings } = store;
  const muted = !!settings.trailerMuted;
  const [on, setOn] = useState(false);
  const [loc, setLoc] = useState(null);
  useEffect(() => { if (active && !loc) localizeMeta(m, getLang()).then((l) => l && setLoc(l)).catch(() => {}); }, [active]);
  const saved = inList(m.id);
  const name = loc?.name || m.name;
  const label = m.type === 'series'
    ? (m.soonSeason > 1 ? t('season', { n: m.soonSeason }) + ' · ' : t('newSeries') + ' · ')
    : t('inCinemas') + ' · ';
  return (
    <View style={{ height: h, backgroundColor: '#000' }}>
      <Image source={{ uri: m.poster || m.background }} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} />
      <Trailer id={trailerIdOf(m)} active={active} muted={muted} onPlaying={setOn} scale={1.2} />
      <LinearGradient colors={['rgba(0,0,0,0.45)', 'transparent', 'transparent', 'rgba(0,0,0,0.85)']} locations={[0, 0.2, 0.55, 1]} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <Press onPress={() => router.push(metaHref(m))} scale={1} style={StyleSheet.absoluteFill}><View style={{ flex: 1 }} /></Press>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + 96 }]} pointerEvents="box-none">
        <View style={{ flex: 1 }} pointerEvents="none">
          {m.logo ? <Image source={{ uri: m.logo }} style={{ width: '80%', height: 70, marginBottom: 6 }} contentFit="contain" contentPosition={getLang() === 'ar' ? 'right' : 'left'} /> : null}
          <Txt bold size={22} numberOfLines={2} style={{ color: '#fff' }}>{name}</Txt>
          <Row gap={6} style={{ marginTop: 6 }}>
            <Ionicons name="calendar-outline" size={14} color="#ddd" />
            <Txt size={14} style={{ color: '#ddd' }}>{label}{fmtDate(m.soonDate)}</Txt>
          </Row>
          {loc?.description || m.description ? <Txt size={13} numberOfLines={2} style={{ color: '#bbb', marginTop: 6, lineHeight: 19 }}>{loc?.description || m.description}</Txt> : null}
        </View>
        <View style={{ alignItems: 'center', gap: 14, marginStart: 12 }}>
          <Press onPress={() => toggleList(m)} style={{ alignItems: 'center' }}>
            <Glass radius={22} interactive style={styles.round}><Ionicons name={saved ? 'checkmark' : 'add'} size={24} color="#fff" /></Glass>
            <Txt size={11} style={{ color: '#ddd', marginTop: 3 }}>{saved ? t('added') : t('myList')}</Txt>
          </Press>
          {on ? <MuteButton muted={muted} onToggle={() => store.setSetting('trailerMuted', !muted)} /> : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'flex-end' },
  round: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
