import React, { useEffect } from 'react';
import { StyleSheet, Pressable, View, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withDelay, withSequence, Easing, runOnJS, useReducedMotion, interpolate,
} from 'react-native-reanimated';
import { useTheme } from '../store';

const { width: W } = Dimensions.get('window');
const MARK = W * 0.42;

// Original launch animation: the M reveals from the bottom, an orbit ring sweeps in with a
// light streak, a soft glow pulses, then everything zooms gently into the app (~1.8 s).
export default function Intro({ onDone }) {
  const th = useTheme();
  const reduce = useReducedMotion();
  const reveal = useSharedValue(0); // 0..1 mark reveal
  const ring = useSharedValue(0);   // 0..1 ring sweep
  const streak = useSharedValue(0); // 0..1 light streak position
  const glow = useSharedValue(0);
  const out = useSharedValue(0);    // 0..1 exit zoom/fade

  const finish = () => onDone && onDone();
  const exit = (d = 0) => {
    out.value = withDelay(d, withTiming(1, { duration: reduce ? 250 : 420, easing: Easing.in(Easing.cubic) }, (f) => { if (f) runOnJS(finish)(); }));
  };

  useEffect(() => {
    if (reduce) { reveal.value = withTiming(1, { duration: 250 }); ring.value = 1; exit(500); return; }
    reveal.value = withTiming(1, { duration: 620, easing: Easing.out(Easing.cubic) });
    ring.value = withDelay(300, withTiming(1, { duration: 700, easing: Easing.out(Easing.back(1.4)) }));
    streak.value = withDelay(650, withTiming(1, { duration: 550, easing: Easing.inOut(Easing.quad) }));
    glow.value = withDelay(900, withSequence(withTiming(1, { duration: 260 }), withTiming(0.35, { duration: 380 })));
    exit(1380);
  }, []);

  const markSt = useAnimatedStyle(() => ({
    opacity: interpolate(reveal.value, [0, 0.4, 1], [0, 1, 1]),
    transform: [{ translateY: (1 - reveal.value) * 24 }, { scale: 0.86 + reveal.value * 0.14 }],
  }));
  const clipSt = useAnimatedStyle(() => ({ height: MARK * reveal.value }));
  const ringSt = useAnimatedStyle(() => ({
    opacity: ring.value,
    transform: [{ rotateZ: `${-12 - (1 - ring.value) * 140}deg` }, { scaleX: 0.3 + ring.value * 0.7 }],
  }));
  const streakSt = useAnimatedStyle(() => ({
    opacity: interpolate(streak.value, [0, 0.15, 0.85, 1], [0, 1, 1, 0]),
    transform: [{ translateX: interpolate(streak.value, [0, 1], [-W * 0.6, W * 0.6]) }, { rotateZ: '-12deg' }],
  }));
  const glowSt = useAnimatedStyle(() => ({ opacity: glow.value * 0.35, transform: [{ scale: 0.8 + glow.value * 0.5 }] }));
  const rootSt = useAnimatedStyle(() => ({ opacity: 1 - out.value }));
  const zoomSt = useAnimatedStyle(() => ({ transform: [{ scale: 1 + out.value * 2.4 }] }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: th.bg, zIndex: 100 }, rootSt]}>
      <Pressable style={styles.center} onPress={() => exit(0)}>
        <Animated.View style={[styles.center, zoomSt]}>
          <Animated.View style={[styles.glow, { backgroundColor: th.accent }, glowSt]} />
          <Animated.View style={[{ width: MARK, height: MARK, justifyContent: 'flex-end', overflow: 'hidden' }, clipSt]}>
            <Animated.View style={[{ width: MARK, height: MARK, position: 'absolute', bottom: 0 }, markSt]}>
              <Image source={require('../../assets/mark-m.png')} style={{ width: MARK, height: MARK }} contentFit="contain" />
            </Animated.View>
          </Animated.View>
          <Animated.View style={[styles.ring, { borderColor: '#E6ECFF' }, ringSt]} />
          <Animated.View style={[styles.streak, streakSt]} pointerEvents="none">
            <LinearGradient colors={['transparent', 'rgba(255,255,255,0.85)', 'transparent']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ flex: 1 }} />
          </Animated.View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  glow: { position: 'absolute', width: MARK * 1.1, height: MARK * 1.1, borderRadius: MARK, opacity: 0 },
  ring: { position: 'absolute', width: MARK * 1.7, height: MARK * 0.42, borderRadius: MARK, borderWidth: 3 },
  streak: { position: 'absolute', width: W * 0.35, height: 3 },
});
