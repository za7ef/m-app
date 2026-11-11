import React, { useState } from 'react';
import { View, ScrollView, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useStore, useTheme } from '../../store';
import { Txt, Row, Glass, Btn, Section, Item, Toggle } from '../../components/ui';
import { installAddon, SUGGESTED, normalizeUrl } from '../../addons';
import { torrentReady } from '../../torrent';
import { t, isRTL } from '../../i18n';

const resNames = (m) => (m.resources || []).map((r) => (typeof r === 'string' ? r : r.name));

export default function Addons() {
  const th = useTheme();
  const insets = useSafeAreaInsets();
  const { addons, addAddon, removeAddon, toggleAddon, settings } = useStore();
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);

  const isHttp = (u) => /^http:\/\//i.test(u || '') && !/^http:\/\/(127\.0\.0\.1|localhost)[:/]/i.test(u);
  const install = async (u) => {
    if (!u.trim()) return;
    setBusy(true);
    try {
      const a = await installAddon(u);
      const rs = resNames(a.manifest);
      addAddon(a);
      setUrl('');
      const torrentOnly = /torrent/i.test(`${a.manifest.name} ${a.manifest.description}`) && rs.includes('stream');
      const msg = torrentOnly && !torrentReady(settings) ? t('addonTorrentWarn') : t('installedOk');
      Alert.alert(a.manifest.name, isHttp(a.transportUrl) ? `${msg}\n\n⚠️ ${t('httpAddonWarn')}` : msg);
    } catch { Alert.alert(t('install'), t('installFail')); }
    setBusy(false);
  };

  const installedUrls = new Set(addons.map((a) => a.transportUrl));
  return (
    <ScrollView style={{ flex: 1, backgroundColor: th.bg }} contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 150 }}>
      <Txt bold size={30} style={{ marginHorizontal: 16, marginBottom: 14 }}>{t('addonsTitle')}</Txt>

      <Glass radius={18} style={{ marginHorizontal: 16, padding: 12, marginBottom: 8 }}>
        <TextInput value={url} onChangeText={setUrl} placeholder={t('installUrlPh')} placeholderTextColor={th.dim}
          autoCapitalize="none" autoCorrect={false} keyboardType="url"
          style={{ color: th.text, fontSize: 15, paddingVertical: 8, textAlign: 'left', writingDirection: 'ltr' }} />
        <Btn title={busy ? t('installing') : t('install')} icon="download-outline" onPress={() => install(url)} disabled={busy} style={{ marginTop: 8 }} />
      </Glass>
      <Txt dim size={12} style={{ marginHorizontal: 20, marginBottom: 22, lineHeight: 18 }}>{t('addonDisclaimer')}</Txt>

      <Section title={t('installed')}>
        {addons.map((a, i) => (
          <Item key={a.transportUrl} last={i === addons.length - 1}
            label={a.manifest.name}
            hint={`${resNames(a.manifest).join(' · ')}${a.core ? ' · ' + t('core') : ''}${isHttp(a.transportUrl) ? ' · ⚠️ ' + t('httpBadge') : ''}`}
            right={<Row gap={10}>
              <Toggle value={!a.disabled} onChange={() => toggleAddon(a.transportUrl)} />
              {!a.core ? <Ionicons name="trash-outline" size={20} color="#FF453A" onPress={() => Alert.alert(a.manifest.name, t('uninstallQ'), [
                { text: t('cancel'), style: 'cancel' }, { text: t('uninstall'), style: 'destructive', onPress: () => removeAddon(a.transportUrl) }])} /> : null}
            </Row>} />
        ))}
      </Section>

      <Section title={t('recommended')}>
        {SUGGESTED.map((s, i) => {
          const has = installedUrls.has(normalizeUrl(s.url));
          return (
            <Item key={s.url} last={i === SUGGESTED.length - 1} label={s.name} hint={s.desc}
              right={has ? <Ionicons name="checkmark-circle" size={22} color={th.accent} /> : <Btn small title={t('install')} onPress={() => install(s.url)} />} />
          );
        })}
      </Section>
    </ScrollView>
  );
}
