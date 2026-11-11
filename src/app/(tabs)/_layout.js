import React from 'react';
import { NativeTabs } from 'expo-router/native-tabs';
import { useStore } from '../../store';
import { t, isRTL } from '../../i18n';

const TABS = [
  ['index', 'tabHome', { default: 'house', selected: 'house.fill' }, 'home'],
  ['list', 'tabList', { default: 'bookmark', selected: 'bookmark.fill' }, 'bookmark'],
  ['addons', 'tabAddons', { default: 'puzzlepiece.extension', selected: 'puzzlepiece.extension.fill' }, 'extension'],
  ['settings', 'settings', { default: 'gearshape', selected: 'gearshape.fill' }, 'settings'],
];

// Native UITabBarController: iOS 26 draws the real Liquid Glass bar with its moving selection bubble.
export default function TabsLayout() {
  const { theme: th, settings } = useStore();
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
