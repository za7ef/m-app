// Android: floating "liquid glass" pill tab bar (iOS keeps the native UITabBar).
// Real blur via expo-blur's Dimezis method (Android 12+) over a BlurTargetView that wraps the screens;
// older Android gets a translucent tinted panel. Built on expo-router's headless tabs.
import React, { forwardRef, useRef } from 'react';
import { View, Pressable, StyleSheet, Platform, Text } from 'react-native';
import { Tabs, TabList, TabTrigger, TabSlot } from 'expo-router/ui';
import { BlurView, BlurTargetView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '../store';
import { t } from '../i18n';

const BLUR_OK = Platform.OS === 'android' && Platform.Version >= 31;
export const FLOATING_BAR_HEIGHT = 64;

const ICONS = { index: ['home-outline', 'home'], list: ['bookmark-outline', 'bookmark'], addons: ['extension-puzzle-outline', 'extension-puzzle'], settings: ['settings-outline', 'settings'] };

const TabButton = forwardRef(({ isFocused, name, label, th, ...props }, ref) => {
  const pill = useAnimatedStyle(() => ({
    opacity: withSpring(isFocused ? 1 : 0, { damping: 18 }),
    transform: [{ scale: withSpring(isFocused ? 1 : 0.7, { damping: 16 }) }],
  }), [isFocused]);
  const color = isFocused ? th.accent : th.dark ? 'rgba(255,255,255,0.72)' : 'rgba(0,0,0,0.6)';
  return (
    <Pressable ref={ref} {...props} style={styles.btn} android_ripple={{ color: th.accent + '33', borderless: true, radius: 34 }}
      accessibilityRole="tab" accessibilityState={{ selected: !!isFocused }}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.pill, { backgroundColor: th.accent + (th.dark ? '2E' : '22') }, pill]} />
      <Ionicons name={ICONS[name][isFocused ? 1 : 0]} size={22} color={color} />
      <Text numberOfLines={1} style={[styles.label, { color, fontWeight: isFocused ? '700' : '500' }]}>{label}</Text>
    </Pressable>
  );
});

// The visual glass bar; TabList (asChild) hands it the triggers as children.
const BarShell = forwardRef(({ th, target, bottom, tint, solid, children, style, ...rest }, ref) => (
  <View pointerEvents="box-none" style={[styles.wrap, { bottom }]}>
    <View style={[styles.shadow, { shadowColor: '#000' }]}>
      <View style={styles.clip}>
        {BLUR_OK ? (
          <BlurView blurTarget={target} experimentalBlurMethod="dimezisBlurView" intensity={70} blurReductionFactor={4}
            tint={th.dark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        ) : null}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: BLUR_OK ? tint : solid }]} />
        <LinearGradient colors={th.dark ? ['rgba(255,255,255,0.14)', 'rgba(255,255,255,0.02)'] : ['rgba(255,255,255,0.75)', 'rgba(255,255,255,0.15)']}
          start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} pointerEvents="none" />
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.rim, { borderColor: th.dark ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.08)' }]} />
        <View ref={ref} {...rest} style={styles.row}>{children}</View>
      </View>
    </View>
  </View>
));

export default function GlassTabs({ tabs }) {
  const { theme: th, settings } = useStore();
  const insets = useSafeAreaInsets();
  const target = useRef(null);
  const list = tabs; // the root view's direction already mirrors this row in RTL
  const tint = th.dark ? 'rgba(22,24,38,0.55)' : 'rgba(255,255,255,0.6)';
  const solid = th.dark ? 'rgba(22,24,38,0.92)' : 'rgba(250,250,252,0.94)';
  return (
    <Tabs>
      <BlurTargetView ref={target} style={{ flex: 1, backgroundColor: th.bg }}>
        <TabSlot />
      </BlurTargetView>
      {/* TabList must be a direct child of Tabs (expo-router reads the triggers from it). */}
      <TabList asChild>
        <BarShell th={th} target={target} bottom={Math.max(insets.bottom, 10) + 6} tint={tint} solid={solid}>
          {list.map(([name, key, , , href]) => (
            <TabTrigger key={name} name={name} href={href} asChild>
              <TabButton name={name} label={t(key)} th={th} />
            </TabTrigger>
          ))}
        </BarShell>
      </TabList>
    </Tabs>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, alignItems: 'center' },
  shadow: { width: '100%', maxWidth: 460, borderRadius: 32, elevation: 14, shadowOpacity: 0.3, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } },
  clip: { borderRadius: 32, overflow: 'hidden', height: FLOATING_BAR_HEIGHT },
  rim: { borderRadius: 32, borderWidth: StyleSheet.hairlineWidth * 2 },
  row: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, backgroundColor: 'transparent' },
  btn: { flex: 1, height: FLOATING_BAR_HEIGHT - 12, alignItems: 'center', justifyContent: 'center', marginHorizontal: 2 },
  pill: { borderRadius: 24 },
  label: { fontSize: 11, marginTop: 2 },
});
