import React from 'react';
import { View, Text, Pressable, Switch, StyleSheet, Platform } from 'react-native';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { BlurView } from 'expo-blur';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useStore, useTheme } from '../store';
import { isRTL } from '../i18n';

let glassOK = false;
try { glassOK = Platform.OS === 'ios' && isLiquidGlassAvailable(); } catch { glassOK = false; }
export const hasLiquidGlass = glassOK;

// Real Liquid Glass on iOS 26+, blur fallback otherwise.
// `noGlass` forces blur: GlassView must not sit inside a parent with animated opacity.
export function Glass({ style, children, interactive, tint, radius = 22, noGlass, intensity = 40 }) {
  const th = useTheme();
  const shape = [{ borderRadius: radius, overflow: 'hidden' }, style];
  if (glassOK && !noGlass) {
    return (
      <GlassView style={shape} glassEffectStyle="regular" isInteractive={!!interactive}
        tintColor={tint} colorScheme={th.dark ? 'dark' : 'light'}>
        {children}
      </GlassView>
    );
  }
  return (
    <BlurView intensity={intensity} tint={th.dark ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight'}
      style={[shape, { backgroundColor: tint || (Platform.OS === 'android' ? (th.dark ? 'rgba(28,30,46,0.78)' : 'rgba(255,255,255,0.85)') : (th.dark ? 'rgba(30,32,48,0.35)' : 'rgba(255,255,255,0.5)')) }]}>
      {children}
    </BlurView>
  );
}

// Per-string direction: the first strong character decides, so English text inside the
// Arabic UI keeps its punctuation on the right side ("victim." not ".victim").
const STRONG = /[A-Za-z\u00C0-\u024F\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/;
export function textDir(children) {
  const str = Array.isArray(children) ? children.filter((c) => typeof c === 'string' || typeof c === 'number').join('') : typeof children === 'string' ? children : '';
  const m = str.match(STRONG);
  if (!m) return null;
  return /[A-Za-z\u00C0-\u024F]/.test(m[0]) ? 'ltr' : 'rtl';
}

export function Txt({ style, children, sub, dim, bold, size = 15, center, numberOfLines, ...rest }) {
  const th = useTheme();
  const dir = textDir(children) || (isRTL() ? 'rtl' : 'ltr');
  return (
    <Text numberOfLines={numberOfLines} {...rest}
      style={[{ color: dim ? th.dim : sub ? th.sub : th.text, fontSize: size, fontWeight: bold ? '700' : '400',
        textAlign: center ? 'center' : undefined, writingDirection: dir }, style]}>
      {children}
    </Text>
  );
}

export function Row({ style, children, gap = 8, center = true }) {
  return <View style={[{ flexDirection: 'row', alignItems: center ? 'center' : 'flex-start', gap }, style]}>{children}</View>;
}

// Pressable with spring scale feedback.
export function Press({ onPress, onLongPress, style, children, scale = 0.96, disabled, hitSlop }) {
  const s = useSharedValue(1);
  const st = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  const { tap } = useStore();
  return (
    <Pressable disabled={disabled} hitSlop={hitSlop}
      onPressIn={() => { s.value = withSpring(scale, { damping: 18, stiffness: 400 }); }}
      onPressOut={() => { s.value = withSpring(1, { damping: 14, stiffness: 300 }); }}
      onPress={() => { tap(); onPress && onPress(); }} onLongPress={onLongPress}>
      <Animated.View style={[st, style, disabled && { opacity: 0.5 }]}>{children}</Animated.View>
    </Pressable>
  );
}

export function Btn({ title, icon, onPress, kind = 'primary', style, small, disabled }) {
  const th = useTheme();
  const primary = kind === 'primary';
  const light = kind === 'light';
  const fg = primary ? th.onAccent : light ? '#000' : th.text;
  const inner = (
    <Row gap={8} style={{ justifyContent: 'center', paddingVertical: small ? 9 : 13, paddingHorizontal: small ? 14 : 20 }}>
      {icon ? <Ionicons name={icon} size={small ? 17 : 21} color={fg} /> : null}
      {title ? <Txt bold size={small ? 14 : 16} style={{ color: fg }}>{title}</Txt> : null}
    </Row>
  );
  return (
    <Press onPress={onPress} style={style} disabled={disabled}>
      {primary ? <View style={{ backgroundColor: th.accent, borderRadius: 14 }}>{inner}</View>
        : light ? <View style={{ backgroundColor: '#fff', borderRadius: 14 }}>{inner}</View>
        : <Glass radius={14} interactive>{inner}</Glass>}
    </Press>
  );
}

export function IconBtn({ name, onPress, size = 22, style, glass = true, color }) {
  const th = useTheme();
  const icon = <Ionicons name={name} size={size} color={color || th.text} />;
  return (
    <Press onPress={onPress} hitSlop={8} style={style}>
      {glass ? <Glass radius={22} interactive style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>{icon}</Glass>
        : <View style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>{icon}</View>}
    </Press>
  );
}

export function Chip({ label, active, onPress }) {
  const th = useTheme();
  return (
    <Press onPress={onPress}>
      {active
        ? <View style={[styles.chip, { backgroundColor: th.accent }]}><Txt bold size={14} style={{ color: th.onAccent }}>{label}</Txt></View>
        : <Glass radius={18} interactive style={styles.chip}><Txt size={14}>{label}</Txt></Glass>}
    </Press>
  );
}

export function Chips({ options, value, onChange }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 10 }}>
      {options.map(([v, label]) => <Chip key={String(v)} label={label} active={v === value} onPress={() => onChange(v)} />)}
    </View>
  );
}

// Settings building blocks
export function Section({ title, children, footer }) {
  return (
    <View style={{ marginBottom: 22 }}>
      {title ? <Txt sub size={13} bold style={{ marginHorizontal: 20, marginBottom: 8, opacity: 0.9 }}>{title}</Txt> : null}
      <Glass radius={22} style={{ marginHorizontal: 16 }}>{children}</Glass>
      {footer ? <Txt dim size={12} style={{ marginHorizontal: 20, marginTop: 8, lineHeight: 18 }}>{footer}</Txt> : null}
    </View>
  );
}

export function Item({ icon, label, value, onPress, right, last, danger, children, hint }) {
  const th = useTheme();
  const body = (
    <View style={{ paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth, borderBottomColor: th.line }}>
      <Row gap={12}>
        {icon ? <View style={[styles.itemIcon, { backgroundColor: th.accent + '33' }]}><Ionicons name={icon} size={17} color={danger ? '#FF453A' : th.accent} /></View> : null}
        <View style={{ flex: 1 }}>
          <Txt size={16} style={danger && { color: '#FF453A' }}>{label}</Txt>
          {hint ? <Txt dim size={12} style={{ marginTop: 2 }}>{hint}</Txt> : null}
        </View>
        {value !== undefined ? <Txt sub size={15}>{value}</Txt> : null}
        {right}
        {onPress && !right ? <Ionicons name={isRTL() ? 'chevron-back' : 'chevron-forward'} size={18} color={th.dim} /> : null}
      </Row>
      {children}
    </View>
  );
  return onPress ? <Pressable onPress={onPress}>{body}</Pressable> : body;
}

export function Toggle({ value, onChange }) {
  const th = useTheme();
  return <Switch value={!!value} onValueChange={onChange} trackColor={{ true: th.accent }} />;
}

const styles = StyleSheet.create({
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18 },
  itemIcon: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
});
