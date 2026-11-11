// On launch: compare the latest GitHub Release with this build and offer the update. Silent on any failure.
import React, { useEffect, useState } from 'react';
import { Modal, View, ScrollView, Linking, StyleSheet } from 'react-native';
import { Txt, Btn, Glass } from './ui';
import { APP_VERSION } from '../config';
import { t, isRTL } from '../i18n';

const API = 'https://api.github.com/repos/za7ef/m-app/releases/latest';
const parse = (v) => String(v || '').replace(/^v/i, '').split(/[.-]/).slice(0, 3).map((x) => parseInt(x, 10) || 0);
export function isNewer(a, b) { const x = parse(a), y = parse(b); for (let i = 0; i < 3; i++) { if (x[i] !== y[i]) return x[i] > y[i]; } return false; }

export default function UpdatePrompt({ enabled }) {
  const [rel, setRel] = useState(null);
  useEffect(() => {
    if (!enabled) return;
    let ok = true;
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 8000);
    fetch(API, { signal: ctl.signal, headers: { Accept: 'application/vnd.github+json' } })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (ok && j && !j.draft && !j.prerelease && j.tag_name && isNewer(j.tag_name, APP_VERSION)) setRel(j); })
      .catch(() => {})
      .finally(() => clearTimeout(timer));
    return () => { ok = false; ctl.abort(); };
  }, [enabled]);
  if (!rel) return null;
  const rtl = isRTL();
  return (
    <Modal transparent animationType="fade" visible onRequestClose={() => setRel(null)}>
      <View style={styles.back}>
        <Glass radius={26} style={styles.card}>
          <Txt bold size={20} center>{t('updateTitle')}</Txt>
          <Txt sub center size={14} style={{ marginTop: 4, writingDirection: 'ltr' }}>{rel.tag_name.replace(/^v?/, 'v')}</Txt>
          <ScrollView style={{ maxHeight: 320, marginTop: 14 }} contentContainerStyle={{ paddingBottom: 4 }}>
            <Markdown text={rel.body || ''} rtl={rtl} />
          </ScrollView>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
            <Btn kind="glass" title={t('cancel')} onPress={() => setRel(null)} style={{ flex: 1 }} />
            <Btn kind="light" title={t('update')} onPress={() => { Linking.openURL(rel.html_url).catch(() => {}); setRel(null); }} style={{ flex: 1 }} />
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
