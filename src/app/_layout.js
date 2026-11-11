import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StoreProvider, useStore } from '../store';
import { isRTL, onLang } from '../i18n';
import Intro from '../components/Intro';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StoreProvider>
        <Root />
      </StoreProvider>
    </SafeAreaProvider>
  );
}

function Root() {
  const { theme: th, settings, profile } = useStore();
  const [intro, setIntro] = useState(true);
  const [, force] = useState(0);
  useEffect(() => onLang(() => force((x) => x + 1)), []);
  const router = useRouter();
  useEffect(() => { SplashScreen.hideAsync().catch(() => {}); }, []);
  // No profile chosen yet (launch or "sign out of profile"): show "who's watching".
  useEffect(() => {
    if (!profile && !intro) { const id = setTimeout(() => router.push('/profiles'), 0); return () => clearTimeout(id); }
  }, [profile, intro]);
  const rtl = isRTL(settings.lang);
  return (
    // One place controls direction: every row/start/end below mirrors automatically.
    <View key={settings.lang} style={{ flex: 1, backgroundColor: th.bg, direction: rtl ? 'rtl' : 'ltr' }}>
      <StatusBar style={th.dark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: th.bg }, animation: 'fade' }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="title/[type]/[id]" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="player" options={{ presentation: 'fullScreenModal', animation: 'fade', orientation: 'all' }} />
        <Stack.Screen name="profiles" options={{ presentation: 'fullScreenModal', animation: 'fade', gestureEnabled: false }} />
        <Stack.Screen name="settings" options={{ presentation: 'modal' }} />
        <Stack.Screen name="profile-edit" options={{ presentation: 'modal' }} />
        <Stack.Screen name="legal/[doc]" options={{ presentation: 'modal' }} />
      </Stack>
      {intro ? <Intro onDone={() => setIntro(false)} /> : null}
    </View>
  );
}
