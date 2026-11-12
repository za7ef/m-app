import { useFocusEffect } from 'expo-router';
import { useAppActive } from './Trailer';
import { prefetchMeta } from '../addons';
import React, { useEffect, useState, useCallback } from 'react';
import { View, FlatList, StyleSheet, Dimensions, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withRepeat, Easing, FadeIn, FadeInDown, cancelAnimation, ReduceMotion,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Txt, Row, Press, Btn, Glass } from './ui';
import { useStore, useTheme } from '../store';
import { t, isRTL } from '../i18n';

const { width: W } = Dimensions.get('window');
export const POSTER_W = Math.round(W * 0.29);
export const POSTER_H = Math.round(POSTER_W * 1.5);

export const metaHref = (m) => { prefetchMeta(m.type || 'movie', m.id); return `/title/${m.type || 'movie'}/${encodeURIComponent(m.id)}`; };

export function Poster({ meta, width = POSTER_W, height = POSTER_H, progress, onPress, index = 0 }) {
  const th = useTheme();
  const router = useRouter();
  return (
    <Animated.View entering={FadeIn.delay(Math.min(index, 8) * 40).duration(350)}>
      <Press scale={0.93} onPress={onPress || (() => router.push(metaHref(meta)))}>
        <View style={[styles.poster, { width, height, backgroundColor: th.card }]}>
          {meta.poster
            ? <Image source={{ uri: meta.poster }} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} recyclingKey={meta.id} />
            : <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', padding: 8 }]}><Txt bold center size={13}>{meta.name}</Txt></View>}
          {progress != null ? (
            <View style={styles.progTrack}><View style={[styles.progFill, { width: `${Math.max(3, progress * 100)}%`, backgroundColor: th.accent }]} /></View>
          ) : null}
        </View>
      </Press>
    </Animated.View>
  );
}

// Horizontal row. RTL: list stays LTR internally and is inverted, so it starts at the right edge.
export function MediaRow({ title, items, loading, renderItem, wide, onSeeAll }) {
  const rtl = isRTL();
  if (!loading && (!items || !items.length)) return null;
  return (
    <View style={{ marginBottom: 22 }}>
      <Row style={{ paddingHorizontal: 16, marginBottom: 10, justifyContent: 'space-between' }}>
        <Txt bold size={19}>{title}</Txt>
        {onSeeAll ? <Press onPress={onSeeAll}><Ionicons name={rtl ? 'chevron-back' : 'chevron-forward'} size={20} color="#888" /></Press> : null}
      </Row>
      {loading ? <SkeletonRow wide={wide} /> : (
        <FlatList
          horizontal inverted={rtl} style={{ direction: 'ltr' }}
          data={items} keyExtractor={(m, i) => m.id + ':' + i}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}
          renderItem={({ item, index }) => (
            <View style={{ direction: rtl ? 'rtl' : 'ltr' }}>
              {renderItem ? renderItem(item, index) : <Poster meta={item} index={index} />}
            </View>
          )}
          initialNumToRender={6} windowSize={5}
        />
      )}
    </View>
  );
}

function SkeletonRow({ wide }) {
  const th = useTheme();
  const o = useSharedValue(0.35);
  useEffect(() => { o.value = withRepeat(withTiming(0.8, { duration: 700 }), -1, true); return () => cancelAnimation(o); }, []);
  const st = useAnimatedStyle(() => ({ opacity: o.value }));
  return (
    <Row gap={10} style={{ paddingHorizontal: 16 }}>
      {[0, 1, 2, 3].map((i) => (
        <Animated.View key={i} style={[st, { width: wide ? W * 0.62 : POSTER_W, height: wide ? W * 0.35 : POSTER_H, borderRadius: 10, backgroundColor: th.card }]} />
      ))}
    </Row>
  );
}

// Big hero with slow Ken Burns motion and cross-fade between featured titles.
export function Hero({ items, motion = true, height = W * 1.32 }) {
  const th = useTheme();
  const router = useRouter();
  const { inList, toggleList } = useStore();
  const [i, setI] = useState(0);
  const scale = useSharedValue(1);
  const list = (items || []).filter((m) => m.background || m.poster).slice(0, 6);
  const m = list[i % Math.max(1, list.length)];

  useEffect(() => {
    if (!motion) { scale.value = 1.02; return; }
    scale.value = 1;
    scale.value = withRepeat(withTiming(1.12, { duration: 9000, easing: Easing.inOut(Easing.quad), reduceMotion: ReduceMotion.System }), -1, true);
    return () => cancelAnimation(scale);
  }, [motion]);
  // rotate only while Home is on screen and the app is in the foreground
  const [focused, setFocused] = useState(true);
  useFocusEffect(useCallback(() => { setFocused(true); return () => setFocused(false); }, []));
  const appActive = useAppActive();
  useEffect(() => {
    if (!motion || list.length < 2 || !focused || !appActive) return;
    const id = setInterval(() => setI((x) => (x + 1) % list.length), 9000);
    return () => clearInterval(id);
  }, [motion, list.length, focused, appActive]);
  const imgSt = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  if (!m) return <View style={{ height, backgroundColor: th.bg2 }}><ActivityIndicator style={{ marginTop: height / 2 }} color={th.accent} /></View>;
  const genres = (m.genres || m.genre || []).slice(0, 3);
  const saved = inList(m.id);
  return (
    <View style={{ height, overflow: 'hidden' }}>
      <Animated.View key={m.id} entering={FadeIn.duration(900)} style={[StyleSheet.absoluteFill, imgSt]}>
        <Image source={{ uri: m.poster && !m.background ? m.poster : (m.background || m.poster) }} style={StyleSheet.absoluteFill} contentFit="cover" transition={600} />
      </Animated.View>
      <LinearGradient colors={['rgba(0,0,0,0.55)', 'transparent', 'transparent']} locations={[0, 0.25, 1]} style={StyleSheet.absoluteFill} />
      <LinearGradient colors={['transparent', th.bg + 'AA', th.bg]} locations={[0.45, 0.8, 1]} style={StyleSheet.absoluteFill} />
      <Animated.View key={'c' + m.id} entering={FadeInDown.duration(600)} style={styles.heroContent}>
        {m.logo ? <Image source={{ uri: m.logo }} style={{ width: W * 0.7, height: W * 0.24 }} contentFit="contain" />
          : <Txt bold center size={34} numberOfLines={2}>{m.name}</Txt>}
        {genres.length ? <Txt sub center size={13} style={{ marginTop: 10 }}>{genres.join('  •  ')}</Txt> : null}
        <Row gap={12} style={{ marginTop: 16, justifyContent: 'center' }}>
          <Btn kind="light" icon="play" title={t('play')} onPress={() => router.push(metaHref(m) + '?autoplay=1')} style={{ minWidth: 130 }} />
          <Btn kind="glass" icon={saved ? 'checkmark' : 'add'} title={t('myList')} onPress={() => toggleList(m)} style={{ minWidth: 130 }} />
        </Row>
      </Animated.View>
      {list.length > 1 ? (
        <Row gap={6} style={styles.dots}>
          {list.map((x, k) => <View key={x.id} style={[styles.dot, { backgroundColor: k === i % list.length ? th.text : th.text + '44', width: k === i % list.length ? 16 : 6 }]} />)}
        </Row>
      ) : null}
    </View>
  );
}

export function WideCard({ item, onPress }) {
  // Continue-watching card (landscape thumbnail + progress)
  const th = useTheme();
  const w = W * 0.62, h = w * 0.56;
  return (
    <Press scale={0.95} onPress={onPress}>
      <View style={{ width: w }}>
        <View style={{ width: w, height: h, borderRadius: 12, overflow: 'hidden', backgroundColor: th.card }}>
          <Image source={{ uri: item.thumb || item.background || item.poster }} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} />
          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.7)']} style={StyleSheet.absoluteFill} />
          <View style={styles.playBadge}><Glass radius={20} noGlass style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="play" size={20} color="#fff" /></Glass></View>
          <View style={styles.progTrack}><View style={[styles.progFill, { width: `${Math.max(3, (item.pos / (item.dur || 1)) * 100)}%`, backgroundColor: th.accent }]} /></View>
        </View>
        <Txt bold size={14} numberOfLines={1} style={{ marginTop: 6 }}>{item.name}</Txt>
        {item.epLabel ? <Txt sub size={12} numberOfLines={1}>{item.epLabel}</Txt> : null}
      </View>
    </Press>
  );
}

const styles = StyleSheet.create({
  poster: { borderRadius: 10, overflow: 'hidden' },
  progTrack: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 4, backgroundColor: 'rgba(255,255,255,0.25)' },
  progFill: { height: 4 },
  heroContent: { position: 'absolute', left: 20, right: 20, bottom: 46, alignItems: 'center' },
  dots: { position: 'absolute', bottom: 18, alignSelf: 'center' },
  dot: { height: 6, borderRadius: 3 },
  playBadge: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center' },
});
