import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, Share } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { APP_VERSION } from '../config';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StoreProvider, useStore } from '../store';
import { isRTL, onLang } from '../i18n';
import Intro from '../components/Intro';

SplashScreen.preventAutoHideAsync().catch(() => {});

// Crash capture: keep the last fatal JS error so the next launch can show it (for screenshots/bug reports).
const CRASH_KEY = 'm-app:lastCrash';
let pendingCrash = null;
const crashListeners = new Set();
try {
  const prev = global.ErrorUtils?.getGlobalHandler?.();
  global.ErrorUtils?.setGlobalHandler?.((e, fatal) => {
    if (!fatal || __DEV__) { prev && prev(e, fatal); return; }
    // Release: record it and show the crash screen instead of letting React Native abort the app.
    const text = `${new Date().toISOString()} v${APP_VERSION}\n${e?.message || e}\n${(e?.stack || '').slice(0, 1500)}`;
    AsyncStorage.setItem(CRASH_KEY, text).catch(() => {});
    pendingCrash = text;
    crashListeners.forEach((f) => f(text));
  });
} catch {}

function CrashScreen({ text, onClose }) {
  return (
    <View style={{ flex: 1, backgroundColor: '#0B0D17', paddingTop: 70, paddingHorizontal: 18, paddingBottom: 30 }}>
      <Text style={{ color: '#fff', fontSize: 22, fontWeight: '700', textAlign: 'center' }}>حدث خطأ · Something went wrong</Text>
      <Text style={{ color: '#aab', fontSize: 14, textAlign: 'center', marginTop: 8 }}>التقط صورة لهذه الشاشة وأرسلها · Screenshot this and send it</Text>
      <ScrollView style={{ flex: 1, marginTop: 16, backgroundColor: '#151829', borderRadius: 14 }} contentContainerStyle={{ padding: 12 }}>
        <Text selectable style={{ color: '#ff8a80', fontSize: 12, fontFamily: 'monospace' }}>{text}</Text>
      </ScrollView>
      <View style={{ flexDirection: 'row', gap: 12, marginTop: 14 }}>
        <Pressable onPress={() => Share.share({ message: text }).catch(() => {})} style={{ flex: 1, backgroundColor: '#2a2f4a', borderRadius: 14, padding: 14 }}>
          <Text style={{ color: '#fff', textAlign: 'center', fontWeight: '600' }}>مشاركة · Share</Text>
        </Pressable>
        {onClose ? (
          <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: '#6C5CE7', borderRadius: 14, padding: 14 }}>
            <Text style={{ color: '#fff', textAlign: 'center', fontWeight: '600' }}>متابعة · Continue</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

// expo-router error boundary: render errors show the crash screen instead of closing the app.
export function ErrorBoundary({ error, retry }) {
  useEffect(() => { SplashScreen.hideAsync().catch(() => {}); }, []);
  return <CrashScreen text={`v${APP_VERSION}\n${error?.message}\n${(error?.stack || '').slice(0, 1500)}`} onClose={retry} />;
}

export default function RootLayout() {
  const [crash, setCrash] = useState(pendingCrash);
  useEffect(() => { const f = (t) => setCrash(t); crashListeners.add(f); return () => crashListeners.delete(f); }, []);
  useEffect(() => { AsyncStorage.getItem(CRASH_KEY).then((t) => { if (t) { setCrash(t); AsyncStorage.removeItem(CRASH_KEY); } }).catch(() => {}); }, []);
  if (crash) return <CrashScreen text={'آخر خطأ · Last crash:\n' + crash} onClose={() => setCrash(null)} />;
  return (
    <SafeAreaProvider>
      <StoreProvider>
        <Root />
      </StoreProvider>
    </SafeAreaProvider>
  );
}

function Root() {
  const { theme: th, settings, profile, user, cloudEnabled } = useStore();
  const [intro, setIntro] = useState(true);
  const [, force] = useState(0);
  useEffect(() => onLang(() => force((x) => x + 1)), []);
  const router = useRouter();
  useEffect(() => { SplashScreen.hideAsync().catch(() => {}); }, []);
  // No profile chosen yet (launch or "sign out of profile"): show "who's watching".
  useEffect(() => {
    console.log('[gate]', JSON.stringify({ intro, user: user === undefined ? 'unknown' : !!user, prompted: !!settings.accountPrompted, profile: !!profile }));
    if (intro) return;
    // First launch with cloud configured: offer sign-in once (can continue without an account).
    if (cloudEnabled && user === undefined) return; // still checking the saved session
    if (cloudEnabled && !user && !settings.accountPrompted) { const id = setTimeout(() => router.push('/account'), 300); return () => clearTimeout(id); }
    if (!profile) { const id = setTimeout(() => router.push('/profiles'), 300); return () => clearTimeout(id); }
  }, [profile, intro, user, settings.accountPrompted]);
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
        <Stack.Screen name="account" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
        <Stack.Screen name="search" options={{ animation: 'fade_from_bottom' }} />
        <Stack.Screen name="profile-edit" options={{ presentation: 'modal' }} />
        <Stack.Screen name="legal/[doc]" options={{ presentation: 'modal' }} />
      </Stack>
      {intro ? <Intro onDone={() => setIntro(false)} /> : null}
    </View>
  );
}
