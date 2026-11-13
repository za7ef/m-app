// On launch: compare the latest GitHub Release with this build and offer the update. Silent on any failure.
import React, { useEffect, useState } from 'react';
import { Modal, View, ScrollView, Linking, StyleSheet } from 'react-native';
import { Txt, Btn, Glass } from './ui';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { APP_VERSION } from '../config';

// "Later" hides the prompt for that version for a day (a newer version still shows right away).
const SNOOZE = 'm.updateSnooze';
const snoozed = async (tag) => { try { const v = JSON.parse((await AsyncStorage.getItem(SNOOZE)) || 'null'); return !!v && v.tag === tag && Date.now() - v.at < 864e5; } catch { return false; } };
const snooze = (tag) => AsyncStorage.setItem(SNOOZE, JSON.stringify({ tag, at: Date.now() })).catch(() => {});
import { t, isRTL } from '../i18n';

import * as Notifications from 'expo-notifications';
import { fetchLatest, isNewer, markNotified, setupUpdateChecks, registerUpdateTask, rememberLang } from '../updateTask';
import { getLang } from '../i18n';

export default function UpdatePrompt({ enabled }) {
  const [rel, setRel] = useState(null);
  // Tapping the "update available" notification opens this prompt. Listened for from launch (also a tap that
  // cold-started the app); the prompt itself waits until the intro is gone.
  const [tapped, setTapped] = useState(false);
  useEffect(() => {
    registerUpdateTask(); // early: the app may be closed before the intro ends
    Notifications.getLastNotificationResponseAsync().then((r) => { if (r) setTapped(true); }).catch(() => {});
    const sub = Notifications.addNotificationResponseReceivedListener(() => setTapped(true));
    return () => sub.remove();
  }, []);
  useEffect(() => {
    if (!enabled || !tapped) return;
    fetchLatest(8000).then((j) => { setTapped(false); if (j && isNewer(j.tag_name, APP_VERSION)) setRel(j); }).catch(() => setTapped(false));
  }, [enabled, tapped]);
  useEffect(() => {
    if (!enabled) return;
    let ok = true;
    rememberLang(getLang());
    fetchLatest(8000).then(async (j) => {
      if (ok && j && isNewer(j.tag_name, APP_VERSION) && !(await snoozed(j.tag_name))) { setRel(j); markNotified(j.tag_name); } // seen in-app: no extra notification
    }).catch(() => {});
    setupUpdateChecks();
    return () => { ok = false; };
  }, [enabled]);
  if (!rel) return null;
  const rtl = isRTL();
  return (
    <Modal transparent animationType="fade" visible onRequestClose={() => { snooze(rel.tag_name); setRel(null); }}>
      <View style={styles.back}>
        <Glass radius={26} style={styles.card}>
          <Txt bold size={20} center>{t('updateTitle')}</Txt>
          <Txt sub center size={14} style={{ marginTop: 4, writingDirection: 'ltr' }}>{rel.tag_name.replace(/^v?/, 'v')}</Txt>
          <Txt bold size={16} style={{ marginTop: 14 }}>{t('whatsNew')}</Txt>
          <ScrollView style={{ maxHeight: 320, marginTop: 8 }} contentContainerStyle={{ paddingBottom: 4 }}>
            <Markdown text={rel.body || ''} rtl={rtl} />
          </ScrollView>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
            <Btn kind="glass" title={t('updLater')} onPress={() => { snooze(rel.tag_name); setRel(null); }} style={{ flex: 1 }} />
            <Btn kind="light" title={t('updOk')} onPress={() => { Linking.openURL(rel.html_url).catch(() => {}); setRel(null); }} style={{ flex: 1 }} />
          </View>
        </Glass>
      </View>
    </Modal>
  );
}

// Small markdown renderer: headings, bullets, numbered lists, **bold**; HTML tags are dropped.
function Inline({ text, size, bold }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return (
    <Txt size={size} bold={bold} style={{ lineHeight: size * 1.5 }}>
      {parts.map((p, i) => (/^\*\*.*\*\*$/.test(p) ? <Txt key={i} bold size={size}>{p.slice(2, -2)}</Txt> : p.replace(/`/g, '')))}
    </Txt>
  );
}
function Markdown({ text }) {
  const lines = text.replace(/\r/g, '').replace(/<[^>]+>/g, '').split('\n');
  return lines.map((l, i) => {
    const s = l.trim();
    if (!s) return <View key={i} style={{ height: 6 }} />;
    const h = /^(#{1,6})\s+(.*)$/.exec(s);
    if (h) return <View key={i} style={{ marginTop: 6 }}><Inline text={h[2]} size={h[1].length <= 2 ? 17 : 15} bold /></View>;
    const b = /^[-*•]\s+(.*)$/.exec(s) || /^(\d+[.)]\s+.*)$/.exec(s);
    if (b) return <View key={i} style={{ flexDirection: 'row', gap: 6, marginTop: 2 }}><Txt size={14}>{/^\d/.test(b[1]) ? '' : '•'}</Txt><View style={{ flex: 1 }}><Inline text={b[1]} size={14} /></View></View>;
    return <Inline key={i} text={s} size={14} />;
  });
}

const styles = StyleSheet.create({
  back: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: 22 },
  card: { width: '100%', maxWidth: 440, padding: 20 },
});
