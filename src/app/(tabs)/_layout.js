import React from 'react';
import { Platform } from 'react-native';
import { NativeTabs } from 'expo-router/native-tabs';
import GlassTabs from '../../components/GlassTabBar';
import { useStore } from '../../store';
import { t, isRTL } from '../../i18n';

const TABS = [
  ['index', 'tabHome', { default: 'house', selected: 'house.fill' }, 'home', '/'],
  ['list', 'tabList', { default: 'bookmark', selected: 'bookmark.fill' }, 'bookmark', '/list'],
  ['soon', 'tabSoon', { default: 'play.rectangle.on.rectangle', selected: 'play.rectangle.on.rectangle.fill' }, 'movie', '/soon'],
  ['addons', 'tabAddons', { default: 'puzzlepiece.extension', selected: 'puzzlepiece.extension.fill' }, 'extension', '/addons'],
  ['settings', 'settings', { default: 'gearshape', selected: 'gearshape.fill' }, 'settings', '/settings'],
];

// Native UITabBarController: iOS 26 draws the real Liquid Glass bar with its moving selection bubble.
export default function TabsLayout() {
  const { theme: th, settings } = useStore();
  if (Platform.OS === 'android') return <GlassTabs tabs={TABS} />;
  const list = isRTL(settings.lang) ? [...TABS].reverse() : TABS;
  return (
    <NativeTabs tintColor={th.accent} minimizeBehavior="onScrollDown">
      {list.map(([name, key, sf, md]) => (
        <NativeTabs.Trigger key={name} name={name}>
          <NativeTabs.Trigger.Icon sf={sf} md={md} />
          <NativeTabs.Trigger.Label>{t(key)}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      ))}
    </NativeTabs>
  );
}
