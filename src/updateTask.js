// Background check for a newer GitHub Release (no push server): iOS BGTaskScheduler / Android WorkManager via
// expo-background-task, roughly every 6 h (the OS decides the exact time). Notifies once per version.
import * as TaskManager from 'expo-task-manager';
import * as BackgroundTask from 'expo-background-task';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { APP_VERSION } from './config';

export const UPDATE_TASK = 'm-update-check';
const NOTIFIED_KEY = 'm.update.notified';
const LANG_KEY = 'm.update.lang';
const API = 'https://api.github.com/repos/za7ef/m-app/releases/latest';

const parse = (v) => String(v || '').replace(/^v/i, '').split(/[.-]/).slice(0, 3).map((x) => parseInt(x, 10) || 0);
export function isNewer(a, b) { const x = parse(a), y = parse(b); for (let i = 0; i < 3; i++) { if (x[i] !== y[i]) return x[i] > y[i]; } return false; }

export async function fetchLatest(ms = 10000) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(API, { signal: ctl.signal, headers: { Accept: 'application/vnd.github+json' } });
    if (!r.ok) return null; // offline / rate limit: stay quiet
    const j = await r.json();
    return j && !j.draft && !j.prerelease && j.tag_name ? j : null;
  } catch { return null; } finally { clearTimeout(timer); }
}

export const markNotified = (tag) => AsyncStorage.setItem(NOTIFIED_KEY, String(tag)).catch(() => {});
export const rememberLang = (l) => AsyncStorage.setItem(LANG_KEY, l || 'ar').catch(() => {});

async function checkAndNotify() {
  const rel = await fetchLatest();
  if (!rel || !isNewer(rel.tag_name, APP_VERSION)) return;
  const last = await AsyncStorage.getItem(NOTIFIED_KEY);
  if (last === rel.tag_name) return;
  const ar = ((await AsyncStorage.getItem(LANG_KEY)) || 'ar') === 'ar';
  const v = rel.tag_name.replace(/^v?/, 'v');
  await Notifications.scheduleNotificationAsync({
    content: { title: ar ? 'تحديث جديد' : 'New update', body: ar ? `الإصدار ${v} جاهز. اضغط للتفاصيل.` : `Version ${v} is available. Tap for details.`,
      data: { url: 'mapp://' } },
    trigger: null,
  });
  await markNotified(rel.tag_name);
}

TaskManager.defineTask(UPDATE_TASK, async () => {
  try { await checkAndNotify(); } catch {}
  return BackgroundTask.BackgroundTaskResult.Success;
});

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

// Registers the background check. Needs no permission, so it runs at launch (even before the intro is finished).
export async function registerUpdateTask() {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('updates', { name: 'Updates', importance: Notifications.AndroidImportance.DEFAULT });
    }
    const status = await BackgroundTask.getStatusAsync();
    if (status === BackgroundTask.BackgroundTaskStatus.Available && !(await TaskManager.isTaskRegisteredAsync(UPDATE_TASK))) {
      await BackgroundTask.registerTaskAsync(UPDATE_TASK, { minimumInterval: 6 * 60 }); // minutes
    }
  } catch (e) { console.warn('[update] register failed', e?.message); }
}

// Called once the app UI is up: ask for notification permission (Android 13+ / iOS) and make sure the task exists.
export async function setupUpdateChecks() {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('updates', { name: 'Updates', importance: Notifications.AndroidImportance.DEFAULT });
    }
    const p = await Notifications.getPermissionsAsync();
    if (!p.granted && p.canAskAgain) await Notifications.requestPermissionsAsync();
    const status = await BackgroundTask.getStatusAsync();
    if (status === BackgroundTask.BackgroundTaskStatus.Available && !(await TaskManager.isTaskRegisteredAsync(UPDATE_TASK))) {
      await BackgroundTask.registerTaskAsync(UPDATE_TASK, { minimumInterval: 6 * 60 }); // minutes
    }
  } catch (e) { console.warn('[update] setup failed', e?.message); }
}
