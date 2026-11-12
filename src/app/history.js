// Viewing history of the active profile: what was watched (latest per title), newest first, grouped by day.
// Tap opens the title; swipe a row to remove it; "Clear history" empties it. Removals sync through the profile state.
import React, { useRef } from 'react';
import { View, ScrollView, Alert, Platform, Animated, PanResponder } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useStore, useTheme } from '../store';
import { Txt, Row, Press, IconBtn } from '../components/ui';
import { metaHref } from '../components/media';
import { t, getLang, isRTL } from '../i18n';

const DAY = 86400000;
const startOfDay = (ts) => { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); };
function dayLabel(ts) {
  const today = startOfDay(Date.now());
  const d = startOfDay(ts);
  if (d === today) return t('today');
  if (d === today - DAY) return t('yesterday');
  const opts = Date.now() - d < 6 * DAY ? { weekday: 'long' } : { weekday: 'long', day: 'numeric', month: 'long', ...(new Date(d).getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}) };
  try { return new Date(d).toLocaleDateString(getLang() === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-US', opts); } catch { return new Date(d).toDateString(); }
}
const timeOf = (ts) => { try { return new Date(ts).toLocaleTimeString(getLang() === 'ar' ? 'ar-SA-u-nu-latn' : 'en-US', { hour: 'numeric', minute: '2-digit' }); } catch { return ''; } };

// Row that slides sideways (toward the reading start) to reveal a delete action; a long swipe deletes at once.
function SwipeRow({ children, onDelete, th }) {
  const x = useRef(new Animated.Value(0)).current;
  const dir = isRTL() ? 1 : -1; // swipe toward the start edge
  const W = 90;
  const open = useRef(false);
  const pan = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
    onPanResponderMove: (_, g) => { const v = g.dx * dir + (open.current ? W : 0); x.setValue(Math.max(0, v) * dir); },
    onPanResponderRelease: (_, g) => {
      const v = g.dx * dir + (open.current ? W : 0);
      if (v > 220) { Animated.timing(x, { toValue: dir * 500, duration: 160, useNativeDriver: true }).start(() => onDelete()); return; }
      open.current = v > W / 2;
      Animated.spring(x, { toValue: open.current ? dir * W : 0, useNativeDriver: true, bounciness: 0 }).start();
    },
    onPanResponderTerminate: () => { open.current = false; Animated.spring(x, { toValue: 0, useNativeDriver: true }).start(); },
  })).current;
  return (
    <View style={{ overflow: 'hidden' }}>
      <View style={{ position: 'absolute', top: 0, bottom: 0, [dir < 0 ? 'right' : 'left']: 0, width: W, alignItems: 'center', justifyContent: 'center' }}>
        <Press onPress={onDelete} hitSlop={8} style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: '#FF453A', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="trash-outline" size={22} color="#fff" />
        </Press>
      </View>
      <Animated.View style={{ transform: [{ translateX: x }], backgroundColor: th.bg }} {...pan.panHandlers}>{children}</Animated.View>
    </View>
  );
}

export default function History() {
  const th = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const store = useStore();
  const items = Object.entries(store.progress || {}).map(([id, p]) => ({ id, ...p })).filter((x) => x.at).sort((a, b) => b.at - a.at);
  const groups = [];
  for (const it of items) {
    const label = dayLabel(it.at);
    if (!groups.length || groups[groups.length - 1].label !== label) groups.push({ label, items: [] });
    groups[groups.length - 1].items.push(it);
  }
  const clearAll = () => Alert.alert(t('clearHistory'), t('clearHistoryQ'), [
    { text: t('cancel'), style: 'cancel' }, { text: t('clear'), style: 'destructive', onPress: store.clearHistory }]);

  return (
    <View style={{ flex: 1, backgroundColor: th.bg, paddingTop: insets.top + 8 }}>
      <Row gap={10} style={{ paddingHorizontal: 16, marginBottom: 6 }}>
        <IconBtn name={Platform.OS === 'ios' ? 'chevron-down' : 'arrow-back'} onPress={() => router.back()} />
        <Txt bold size={26} style={{ flex: 1 }}>{t('history')}</Txt>
        {items.length ? <Press onPress={clearAll} hitSlop={8}><Txt size={14} style={{ color: '#FF453A' }}>{t('clearHistoryShort')}</Txt></Press> : null}
      </Row>
      {store.profile?.name ? <Txt dim size={12} style={{ paddingHorizontal: 16, marginBottom: 6 }}>{t('historyFor', { name: store.profile.name })}</Txt> : null}
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
        {!items.length ? (
          <View style={{ alignItems: 'center', marginTop: 80, paddingHorizontal: 30 }}>
            <Ionicons name="time-outline" size={56} color={th.dim} />
            <Txt sub center style={{ marginTop: 14, lineHeight: 22 }}>{t('historyEmpty')}</Txt>
          </View>
        ) : groups.map((g) => (
          <View key={g.label} style={{ marginBottom: 6 }}>
            <Txt bold size={15} style={{ paddingHorizontal: 16, marginTop: 12, marginBottom: 4 }}>{g.label}</Txt>
            {g.items.map((it) => {
              const p = it.dur ? Math.min(100, Math.round((it.pos / it.dur) * 100)) : 0;
              // the player saves the episode line already formatted ("Season 1 · Episode 2 · name")
              const ep = it.type === 'series'
                ? it.epLabel || [it.season != null ? t('season', { n: it.season }) : null, it.episode != null ? t('episode', { n: it.episode }) : null].filter(Boolean).join(' · ') || null
                : null;
              return (
                <SwipeRow key={it.id} th={th} onDelete={() => store.removeHistory(it.id)}>
                  <Press scale={0.98} onPress={() => router.push(metaHref({ id: it.metaId || it.id, type: it.type }))}>
                    <Row gap={12} style={{ paddingVertical: 9, paddingHorizontal: 16 }}>
                      <View style={{ width: 54, height: 80, borderRadius: 8, overflow: 'hidden', backgroundColor: th.card }}>
                        {it.poster || it.thumb || it.background ? <Image source={{ uri: it.poster || it.thumb || it.background }} style={{ width: '100%', height: '100%' }} contentFit="cover" /> : null}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Txt bold size={15} numberOfLines={1}>{it.name || it.metaId}</Txt>
                        {ep ? <Txt sub size={13} numberOfLines={1}>{ep}</Txt> : null}
                        <Txt dim size={12} style={{ marginTop: 2 }}>{timeOf(it.at)}{p ? ` · ${p >= 95 ? t('historyDone') : t('historyPct', { p })}` : ''}</Txt>
                        <View style={{ height: 3, borderRadius: 2, backgroundColor: th.line, marginTop: 6, overflow: 'hidden' }}>
                          <View style={{ height: 3, width: `${p}%`, backgroundColor: th.accent }} />
                        </View>
                      </View>
                    </Row>
                  </Press>
                </SwipeRow>
              );
            })}
          </View>
        ))}
        {items.length ? <Txt dim size={12} center style={{ marginTop: 14, paddingHorizontal: 30 }}>{t('historySwipeHint')}</Txt> : null}
      </ScrollView>
    </View>
  );
}
