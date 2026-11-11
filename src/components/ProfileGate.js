import React, { useState } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import Animated, { FadeIn, FadeInUp, ZoomIn, useSharedValue, useAnimatedStyle, withSequence, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useStore, useTheme } from '../store';
import { Txt, Press, Row, Glass, IconBtn } from './ui';
import { t } from '../i18n';

const { width: W } = Dimensions.get('window');
const TILE = Math.min(120, (W - 100) / 2);

export function Avatar({ p, size = TILE, radius = 16 }) {
  return (
    <View style={{ width: size, height: size, borderRadius: radius, backgroundColor: p.color, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={p.icon} size={size * 0.5} color="rgba(255,255,255,0.95)" />
    </View>
  );
}

// "Who's watching" + PIN pad. Shown over the app until a profile is chosen.
export default function ProfileGate() {
  const th = useTheme();
  const router = useRouter();
  const { profiles, selectProfile, tapStrong } = useStore();
  const [manage, setManage] = useState(false);
  const [pinFor, setPinFor] = useState(null);

  const choose = (p) => {
    if (manage) { router.push(`/profile-edit?id=${p.id}`); return; }
    if (p.pin) { setPinFor(p); return; }
    tapStrong(); selectProfile(p.id); if (router.canGoBack()) router.back();
  };

  return (
    <Animated.View entering={FadeIn.duration(300)} style={{ flex: 1, backgroundColor: th.bg }}>
      <SafeAreaView style={{ flex: 1 }}>
        <Row style={{ justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 6 }}>
          <Image source={require('../../assets/mark.png')} style={{ width: 44, height: 44 }} />
          <Press onPress={() => setManage((m) => !m)}><Txt bold size={16} style={{ color: th.accent }}>{manage ? t('done') : t('manageProfiles')}</Txt></Press>
        </Row>
        {pinFor ? <PinPad profile={pinFor} onCancel={() => setPinFor(null)} onOk={() => { tapStrong(); selectProfile(pinFor.id); if (router.canGoBack()) router.back(); }} /> : (
          <View style={{ flex: 1, justifyContent: 'center', paddingBottom: 60 }}>
            <Animated.View entering={FadeInUp.duration(500)}><Txt bold center size={24} style={{ marginBottom: 28 }}>{t('whoWatching')}</Txt></Animated.View>
            <View style={styles.grid}>
              {profiles.map((p, i) => (
                <Animated.View key={p.id} entering={ZoomIn.delay(80 * i).springify().damping(14)}>
                  <Press scale={0.9} onPress={() => choose(p)} style={{ alignItems: 'center', width: TILE + 20 }}>
                    <View>
                      <Avatar p={p} />
                      {manage ? <View style={styles.editBadge}><Ionicons name="pencil" size={TILE * 0.3} color="#fff" /></View> : null}
                      {p.pin && !manage ? <View style={styles.lock}><Ionicons name="lock-closed" size={14} color="#fff" /></View> : null}
                    </View>
                    <Txt center size={15} style={{ marginTop: 8 }} numberOfLines={1}>{p.name}</Txt>
                    {p.kids ? <Txt center dim size={12}>{t('kidsBadge')}</Txt> : null}
                  </Press>
                </Animated.View>
              ))}
              {profiles.length < 5 ? (
                <Press scale={0.9} onPress={() => router.push('/profile-edit')} style={{ alignItems: 'center', width: TILE + 20 }}>
                  <Glass radius={16} interactive style={{ width: TILE, height: TILE, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="add" size={TILE * 0.45} color={th.sub} />
                  </Glass>
                  <Txt center sub size={15} style={{ marginTop: 8 }}>{t('addProfile')}</Txt>
                </Press>
              ) : null}
            </View>
          </View>
        )}
      </SafeAreaView>
    </Animated.View>
  );
}

export function PinPad({ profile, onOk, onCancel, title }) {
  const th = useTheme();
  const [code, setCode] = useState('');
  const [err, setErr] = useState(false);
  const shake = useSharedValue(0);
  const st = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));
  const press = (d) => {
    const c = (code + d).slice(0, 4);
    setCode(c); setErr(false);
    if (c.length === 4) {
      if (!profile || c === profile.pin) { onOk(c); setCode(''); }
      else {
        setErr(true); setCode('');
        shake.value = withSequence(withTiming(-12, { duration: 50 }), withTiming(12, { duration: 50 }), withTiming(-8, { duration: 50 }), withTiming(0, { duration: 50 }));
      }
    }
  };
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      {profile ? <Avatar p={profile} size={72} /> : null}
      <Txt bold center size={20} style={{ marginTop: 14 }}>{title || t('enterPin')}</Txt>
      <Animated.View style={[{ flexDirection: 'row', gap: 16, marginVertical: 22, direction: 'ltr' }, st]}>
        {[0, 1, 2, 3].map((i) => <View key={i} style={[styles.pinDot, { borderColor: th.text, backgroundColor: i < code.length ? th.text : 'transparent' }]} />)}
      </Animated.View>
      <Txt center size={13} style={{ color: '#FF453A', height: 18 }}>{err ? t('wrongPin') : ''}</Txt>
      <View style={styles.pad}>
        {keys.map((k, i) => k === '' ? <View key={i} style={styles.key} /> : (
          <Press key={i} scale={0.88} onPress={() => (k === '⌫' ? setCode(code.slice(0, -1)) : press(k))}>
            <Glass radius={36} interactive style={styles.key}><Txt bold center size={26}>{k}</Txt></Glass>
          </Press>
        ))}
      </View>
      <Press onPress={onCancel}><Txt sub size={16} style={{ marginTop: 18 }}>{t('cancel')}</Txt></Press>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 18, paddingHorizontal: 20 },
  editBadge: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  lock: { position: 'absolute', bottom: 6, end: 6, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 10, padding: 3 },
  pinDot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2 },
  pad: { flexDirection: 'row', flexWrap: 'wrap', width: 72 * 3 + 40, gap: 20, justifyContent: 'center', direction: 'ltr' },
  key: { width: 72, height: 72, alignItems: 'center', justifyContent: 'center' },
});
