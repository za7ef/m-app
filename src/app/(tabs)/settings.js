import React, { useState, useEffect } from 'react';
import { View, ScrollView, Alert, Pressable, Modal, TextInput, ActivityIndicator, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useStore, useTheme } from '../../store';
import { Txt, Row, Section, Item, Toggle, Chips, IconBtn, Press, Glass, Btn } from '../../components/ui';
import { Avatar, PinPad } from '../../components/ProfileGate';
import { THEMES, THEME_ORDER } from '../../theme';
import { t, LANGS, CONTENT_LANGS } from '../../i18n';
import { APP_NAME, APP_VERSION } from '../../config';
import { vlcAvailable } from '../../../modules/m-vlc/src';
import { DEBRID_PROVIDERS, testTorrentSetup, torrentErrorKey, directAvailable, clearTorrentCache, torrentCacheSize } from '../../torrent';
import { signOut as cloudSignOut, deleteAccount, authErrorKey } from '../../firebase';

const COLORS = ['#FFFFFF', '#FFE34D', '#7CF5FF', '#9BFF9B'];

export default function Settings() {
  const th = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const st = useStore();
  const { settings: s, setSetting, profiles, profile, list } = st;
  const [open, setOpen] = useState(null);
  const [pwAsk, setPwAsk] = useState(null); // cross-platform password confirm (Alert.prompt is iOS-only)
  const [pw, setPw] = useState('');
  const [testing, setTesting] = useState(false);
  const [cacheMB, setCacheMB] = useState(null);
  useEffect(() => { if (s.torrentMode === 'direct') torrentCacheSize().then((b) => setCacheMB(Math.round(b / 1048576))); }, [s.torrentMode]);
  const [gate, setGate] = useState(!!profile?.pin && profile && false);
  const tg = (k) => <Toggle value={s[k]} onChange={(v) => setSetting(k, v)} />;
  const exp = (k) => setOpen(open === k ? null : k);
  const langLabel = (c) => (CONTENT_LANGS.find(([x]) => x === c) || [c, c])[1];

  return (
    <View style={{ flex: 1, backgroundColor: th.bg }}>
      <Row style={{ justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: insets.top + 8, paddingBottom: 10 }}>
        <Txt bold size={30}>{t('settings')}</Txt>
      </Row>
      <ScrollView contentContainerStyle={{ paddingBottom: 150 }}>
        {/* Profiles */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingHorizontal: 16, paddingVertical: 10 }}>
          {profiles.map((p) => (
            <Press key={p.id} onPress={() => router.push(`/profile-edit?id=${p.id}`)} style={{ alignItems: 'center', width: 72 }}>
              <View style={{ borderWidth: 2, borderColor: p.id === profile?.id ? th.accent : 'transparent', borderRadius: 14, padding: 2 }}>
                <Avatar p={p} size={60} radius={12} />
              </View>
              <Txt center size={12} numberOfLines={1} style={{ marginTop: 4 }}>{p.name}</Txt>
            </Press>
          ))}
        </ScrollView>
        {st.cloudEnabled ? (
          <Section title={t('account')} footer={st.user ? t('syncNote') : t('localNote')}>
            {st.user ? (
              <>
                <Item icon="person-circle-outline" label={st.user.email || t('account')} hint={t('sync_' + st.syncState)}
                  right={st.syncState === 'syncing' ? <Ionicons name="sync" size={18} color={th.sub} /> : st.syncState === 'error' ? <Ionicons name="cloud-offline-outline" size={18} color="#FF9F0A" /> : <Ionicons name="cloud-done-outline" size={18} color={th.accent} />} />
                <Item icon="log-out-outline" label={t('signOutAccount')} onPress={() => Alert.alert(t('signOutAccount'), t('signOutAccountQ'), [
                  { text: t('cancel'), style: 'cancel' }, { text: t('signOutAccount'), onPress: () => cloudSignOut() }])} />
                <Item icon="trash-outline" danger last label={t('deleteAccount')} onPress={() => Alert.alert(t('deleteAccount'), t('deleteAccountQ'), [
                  { text: t('cancel'), style: 'cancel' },
                  { text: t('delete'), style: 'destructive', onPress: () => {
                    const run = (pw) => deleteAccount(pw).then(() => Alert.alert(t('deleteAccount'), t('accountDeleted'))).catch((e) => Alert.alert(t('deleteAccount'), t(authErrorKey(e))));
                    const isEmail = (st.user.providerData || []).some((x) => x.providerId === 'password');
                    if (isEmail) setPwAsk({ run });
                    else run();
                  } }])} />
              </>
            ) : (
              <Item icon="person-circle-outline" label={t('signInOrCreate')} onPress={() => router.push('/account')} last />
            )}
          </Section>
        ) : null}
        <Section title={t('profiles')}>
          <Item icon="people-outline" label={t('switchProfile')} onPress={() => st.signOut()} />
          <Item icon="person-add-outline" label={t('addProfile')} onPress={() => router.push('/profile-edit')} />
          <Item icon="log-out-outline" label={t('signOut')} last danger onPress={() => st.signOut()} />
        </Section>

        <Section title={t('appearance')}>
          <Item icon="color-palette-outline" label={t('theme')} last>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingTop: 12 }}>
              {THEME_ORDER.map((k) => {
                const T = THEMES[k];
                const on = s.theme === k;
                return (
                  <Press key={k} onPress={() => setSetting('theme', k)} style={{ alignItems: 'center', width: 64 }}>
                    <View style={{ width: 52, height: 52, borderRadius: 26, borderWidth: on ? 3 : 1, borderColor: on ? T.accent : th.line, overflow: 'hidden', backgroundColor: T.bg, alignItems: 'center', justifyContent: 'center' }}>
                      <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: T.accent }} />
                    </View>
                    <Txt center size={11} style={{ marginTop: 4 }}>{t('theme_' + k)}</Txt>
                  </Press>
                );
              })}
            </View>
          </Item>
        </Section>

        <Section title={t('language')}>
          <Item icon="globe-outline" label={t('appLanguage')} value={LANGS.find(([c]) => c === s.lang)?.[1]} onPress={() => exp('lang')}>
            {open === 'lang' ? <Chips value={s.lang} onChange={(v) => setSetting('lang', v)} options={LANGS} /> : null}
          </Item>
          <Item icon="volume-medium-outline" label={t('audioLang')} value={langLabel(s.audioLang)} onPress={() => exp('audio')} hint={t('audioLangHint')}>
            {open === 'audio' ? <Chips value={s.audioLang} onChange={(v) => setSetting('audioLang', v)} options={CONTENT_LANGS} /> : null}
          </Item>
          <Item icon="text-outline" label={t('subLang')} value={s.subLang === 'off' ? t('off') : langLabel(s.subLang)} onPress={() => exp('sub')}>
            {open === 'sub' ? <Chips value={s.subLang} onChange={(v) => setSetting('subLang', v)} options={[['off', t('off')], ...CONTENT_LANGS]} /> : null}
          </Item>
          <Item icon="swap-horizontal-outline" label={t('subFallback')} value={langLabel(s.subFallback)} onPress={() => exp('fb')}>
            {open === 'fb' ? <Chips value={s.subFallback} onChange={(v) => setSetting('subFallback', v)} options={CONTENT_LANGS} /> : null}
          </Item>
          <Item icon="flash-outline" label={t('autoSubs')} right={tg('autoSubs')} last />
        </Section>

        <Section title={t('subTrSection')}>
          <Item icon="language-outline" label={t('subTrEngine')} hint={(s.subTrEngine || 'auto') !== 'google' ? t('geminiNote') : undefined}>
            <Chips value={s.subTrEngine || 'auto'} onChange={(v) => setSetting('subTrEngine', v)} options={[['auto', t('subTrAuto')], ['gemini', 'Gemini'], ['google', 'Google']]} />
          </Item>
          <Item icon="key-outline" label={t('geminiKey')} hint={t('geminiKeyHint')} last>
            <TextInput value={s.geminiKey} onChangeText={(v) => setSetting('geminiKey', v.trim())} placeholder="AIza…" placeholderTextColor={th.dim}
              autoCapitalize="none" autoCorrect={false} secureTextEntry
              style={{ color: th.text, backgroundColor: th.card, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginTop: 10, fontSize: 15, textAlign: 'left', writingDirection: 'ltr' }} />
            <Pressable onPress={() => Linking.openURL('https://aistudio.google.com/apikey').catch(() => {})} style={{ marginTop: 10 }}>
              <Txt size={14} style={{ color: th.accent }}>{t('geminiGetKey')}</Txt>
            </Pressable>
          </Item>
        </Section>

        <Section title={t('subAppearance')}>
          <View style={{ margin: 14, height: 70, borderRadius: 12, backgroundColor: '#222', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 10 }}>
            <Txt center style={{ color: s.subColor, fontSize: { small: 14, medium: 17, large: 21, xl: 26 }[s.subSize], fontWeight: s.subFont === 'bold' ? '800' : '400',
              backgroundColor: s.subBg === 'solid' ? 'rgba(0,0,0,0.85)' : s.subBg === 'dim' ? 'rgba(0,0,0,0.45)' : 'transparent', paddingHorizontal: 6,
              textShadowColor: s.subShadow ? '#000' : 'transparent', textShadowRadius: 4 }}>{t('subPreview')}</Txt>
          </View>
          <Item label={t('subSize')}><Chips value={s.subSize} onChange={(v) => setSetting('subSize', v)} options={[['small', t('small')], ['medium', t('medium')], ['large', t('large')], ['xl', t('xl')]]} /></Item>
          <Item label={t('subColor')}>
            <Row gap={12} style={{ paddingTop: 10 }}>
              {COLORS.map((c) => <Pressable key={c} onPress={() => setSetting('subColor', c)}><View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: c, borderWidth: s.subColor === c ? 3 : 0, borderColor: th.accent }} /></Pressable>)}
            </Row>
          </Item>
          <Item label={t('subBg')}><Chips value={s.subBg} onChange={(v) => setSetting('subBg', v)} options={[['none', t('none')], ['dim', t('dim')], ['solid', t('solid')]]} /></Item>
          <Item label={t('subFont')}><Chips value={s.subFont} onChange={(v) => setSetting('subFont', v)} options={[['system', t('regular')], ['bold', t('bold')]]} /></Item>
          <Item label={t('subShadow')} right={tg('subShadow')} last />
        </Section>

        <Section title={t('playback')}>
          {vlcAvailable ? (
            <Item icon="film-outline" label={t('playerEngine')} hint={t('playerEngineHint')} value={t('engine_' + (s.playerEngine || 'auto'))} onPress={() => exp('engine')}>
              {open === 'engine' ? <Chips value={s.playerEngine || 'auto'} onChange={(v) => setSetting('playerEngine', v)} options={[['auto', t('engine_auto')], ['native', t('engine_native')], ['vlc', 'VLC']]} /> : null}
            </Item>
          ) : null}
          <Item icon="play-skip-forward-outline" label={t('autoNext')} right={tg('autoNext')} />
          <Item icon="sparkles-outline" label={t('previews')} hint={t('previewsHint')} right={tg('previews')} />
          <Item icon="play-forward-outline" label={t('skipIntroSetting')} hint={t('skipIntroHint')} right={tg('skipIntro')} />
          <Item icon="refresh-outline" label={t('resumeSetting')} right={tg('resume')} />
          <Item icon="speedometer-outline" label={t('defaultSpeed')} value={s.speed + 'x'} onPress={() => exp('speed')}>
            {open === 'speed' ? <Chips value={s.speed} onChange={(v) => setSetting('speed', v)} options={[0.75, 1, 1.25, 1.5, 2].map((x) => [x, x + 'x'])} /> : null}
          </Item>
          <Item icon="timer-outline" label={t('skipStep')} value={t('seconds', { n: s.skip })} onPress={() => exp('skip')}>
            {open === 'skip' ? <Chips value={s.skip} onChange={(v) => setSetting('skip', v)} options={[5, 10, 15, 30].map((x) => [x, t('seconds', { n: x })])} /> : null}
          </Item>
          <Item icon="sunny-outline" label={t('keepAwake')} right={tg('keepAwake')} />
          <Item icon="headset-outline" label={t('bgAudio')} right={tg('bgAudio')} last />
        </Section>

        <Section title={t('dataSection')} footer={t('dataNote')}>
          <Item icon="cellular-outline" label={t('dataUsage')} onPress={() => exp('data')} value={t('data_' + s.dataUsage)}>
            {open === 'data' ? <Chips value={s.dataUsage} onChange={(v) => setSetting('dataUsage', v)} options={[['auto', t('data_auto')], ['save', t('data_save')], ['max', t('data_max')]]} /> : null}
          </Item>
          <Item icon="wifi-outline" label={t('wifiOnly')} right={tg('wifiOnly')} last />
        </Section>

        <Section title={t('torrentSection')} footer={t('torrentNote')}>
          <Item icon="magnet-outline" label={t('torrentMode')} value={t('torrentMode_' + s.torrentMode)} onPress={() => exp('tmode')}>
            {open === 'tmode' ? <Chips value={s.torrentMode} onChange={(v) => {
                if (v === 'direct' && s.torrentMode !== 'direct') {
                  if (!directAvailable) { Alert.alert(t('torrentMode_direct'), t('directUnavailable')); return; }
                  Alert.alert(t('torrentMode_direct'), t('directWarn'), [{ text: t('cancel'), style: 'cancel' }, { text: t('directEnable'), onPress: () => setSetting('torrentMode', 'direct') }]);
                  return;
                }
                setSetting('torrentMode', v);
              }}
              options={[['off', t('torrentMode_off')], ['direct', t('torrentMode_direct')], ['debrid', t('torrentMode_debrid')], ['server', t('torrentMode_server')]]} /> : null}
          </Item>
          {s.torrentMode === 'direct' ? (
            <>
              <Item icon="arrow-up-circle-outline" label={t('directUpload')} hint={t('directUploadHint')}>
                <Chips value={Number(s.directUploadKBps) || 100} onChange={(v) => setSetting('directUploadKBps', v)} options={[[50, '50 KB/s'], [100, '100 KB/s'], [250, '250 KB/s']]} />
              </Item>
              <Item icon="trash-bin-outline" label={t('directClear')} value={cacheMB != null ? `${cacheMB} MB` : ''}
                onPress={async () => { await clearTorrentCache(); setCacheMB(Math.round((await torrentCacheSize()) / 1048576)); }} />
            </>
          ) : null}
          {s.torrentMode === 'debrid' ? (
            <>
              <Item icon="cloud-download-outline" label={t('debridProvider')}>
                <Chips value={s.debridProvider} onChange={(v) => setSetting('debridProvider', v)} options={DEBRID_PROVIDERS} />
              </Item>
              <Item icon="key-outline" label={t('debridToken')} hint={t('debridTokenHint')}>
                <TextInput value={s.debridToken} onChangeText={(v) => setSetting('debridToken', v.trim())} placeholder="API token" placeholderTextColor={th.dim}
                  autoCapitalize="none" autoCorrect={false} secureTextEntry
                  style={{ color: th.text, backgroundColor: th.card, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginTop: 10, fontSize: 15, textAlign: 'left', writingDirection: 'ltr' }} />
              </Item>
            </>
          ) : null}
          {s.torrentMode === 'server' ? (
            <Item icon="server-outline" label={t('streamServer')} hint={t('streamServerHint')}>
              <TextInput value={s.streamServer} onChangeText={(v) => setSetting('streamServer', v.trim())} placeholder="http://192.168.1.10:11470" placeholderTextColor={th.dim}
                autoCapitalize="none" autoCorrect={false} keyboardType="url"
                style={{ color: th.text, backgroundColor: th.card, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginTop: 10, fontSize: 15, textAlign: 'left', writingDirection: 'ltr' }} />
            </Item>
          ) : null}
          {s.torrentMode !== 'off' ? (
            <Item icon="pulse-outline" label={t('torrentTest')} last right={testing ? <ActivityIndicator color={th.accent} /> : null}
              onPress={async () => {
                if (testing) return;
                setTesting(true);
                try { await testTorrentSetup(s); Alert.alert(t('torrentTest'), t('torrentTestOk')); }
                catch (e) { Alert.alert(t('torrentTest'), t(torrentErrorKey(e))); }
                setTesting(false);
              }} />
          ) : null}
        </Section>

        <Section title={t('parental')} footer={t('parentalNote')}>
          <Item icon="shield-checkmark-outline" label={t('maturityFor', { name: profile?.name || '' })} value={t('mat_' + (profile?.kids ? 'all' : profile?.maturity || 'adult'))}
            onPress={() => profile && router.push(`/profile-edit?id=${profile.id}`)} />
          <Item icon="lock-closed-outline" label={t('profileLock')} value={profile?.pin ? t('on') : t('off')}
            onPress={() => profile && router.push(`/profile-edit?id=${profile.id}`)} last />
        </Section>

        <Section title={t('general')}>
          <Item icon="phone-portrait-outline" label={t('haptics')} right={tg('haptics')} />
          <Item icon="bug-outline" label={t('devTools')} hint={t('devToolsHint')} right={tg('devTools')} />
          {s.devTools ? <Item icon="pulse-outline" label={t('openDiag')} onPress={() => router.push('/diag')} /> : null}
          <Item icon="bookmark-outline" label={t('clearList')} value={String(list.length)} onPress={() => Alert.alert(t('clearList'), t('sure'), [
            { text: t('cancel'), style: 'cancel' }, { text: t('clear'), style: 'destructive', onPress: st.clearList }])} />
          <Item icon="time-outline" label={t('history')} value={String(Object.keys(st.progress || {}).length)} last onPress={() => router.push('/history')} />
        </Section>

        <Section title={t('addonsTitle')}>
          <Item icon="extension-puzzle-outline" label={t('manageAddons')} value={String(st.addons.length)} last onPress={() => router.navigate('/addons')} />
        </Section>

        <Section title={t('helpAbout')}>
          <Item icon="information-circle-outline" label={t('about')} onPress={() => router.push('/legal/about')} />
          <Item icon="document-text-outline" label={t('terms')} onPress={() => router.push('/legal/terms')} />
          <Item icon="hand-left-outline" label={t('privacy')} onPress={() => router.push('/legal/privacy')} />
          <Item icon="help-buoy-outline" label={t('help')} onPress={() => router.push('/legal/help')} last />
        </Section>
        <Txt dim center size={12}>{APP_NAME} · v{APP_VERSION}</Txt>
      </ScrollView>
      <Modal visible={!!pwAsk} transparent animationType="fade" onRequestClose={() => setPwAsk(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 24 }}>
          <View style={{ backgroundColor: th.bg2, borderRadius: 22, padding: 18, gap: 12 }}>
            <Txt bold size={17}>{t('deleteAccount')}</Txt>
            <Txt sub size={14}>{t('enterPassword')}</Txt>
            <TextInput value={pw} onChangeText={setPw} secureTextEntry autoFocus placeholder={t('password')} placeholderTextColor={th.dim}
              style={{ color: th.text, backgroundColor: th.card, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, fontSize: 16, textAlign: 'left', writingDirection: 'ltr' }} />
            <Row gap={10} style={{ justifyContent: 'flex-end' }}>
              <Press onPress={() => { setPwAsk(null); setPw(''); }}><Txt size={16} style={{ padding: 8 }}>{t('cancel')}</Txt></Press>
              <Press onPress={() => { const r = pwAsk.run; setPwAsk(null); r(pw); setPw(''); }}><Txt bold size={16} style={{ padding: 8, color: '#FF453A' }}>{t('delete')}</Txt></Press>
            </Row>
          </View>
        </View>
      </Modal>
    </View>
  );
}
