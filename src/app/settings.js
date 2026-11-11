import React, { useState } from 'react';
import { View, ScrollView, Alert, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, Layout } from 'react-native-reanimated';
import { useStore, useTheme } from '../store';
import { Txt, Row, Section, Item, Toggle, Chips, IconBtn, Press, Glass } from '../components/ui';
import { Avatar, PinPad } from '../components/ProfileGate';
import { THEMES, THEME_ORDER } from '../theme';
import { t, LANGS, CONTENT_LANGS } from '../i18n';
import { APP_NAME, APP_VERSION } from '../config';

const COLORS = ['#FFFFFF', '#FFE34D', '#7CF5FF', '#9BFF9B'];

export default function Settings() {
  const th = useTheme();
  const router = useRouter();
  const st = useStore();
  const { settings: s, setSetting, profiles, profile, list } = st;
  const [open, setOpen] = useState(null);
  const [gate, setGate] = useState(!!profile?.pin && profile && false);
  const tg = (k) => <Toggle value={s[k]} onChange={(v) => setSetting(k, v)} />;
  const exp = (k) => setOpen(open === k ? null : k);
  const langLabel = (c) => (CONTENT_LANGS.find(([x]) => x === c) || [c, c])[1];

  return (
    <View style={{ flex: 1, backgroundColor: th.bg }}>
      <Row style={{ justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 10 }}>
        <Txt bold size={28}>{t('settings')}</Txt>
        <IconBtn name="close" onPress={() => router.back()} />
      </Row>
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
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
        <Section title={t('profiles')}>
          <Item icon="people-outline" label={t('switchProfile')} onPress={() => { st.signOut(); router.back(); }} />
          <Item icon="person-add-outline" label={t('addProfile')} onPress={() => router.push('/profile-edit')} />
          <Item icon="log-out-outline" label={t('signOut')} last danger onPress={() => { st.signOut(); router.back(); }} />
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

        <Section title={t('parental')} footer={t('parentalNote')}>
          <Item icon="shield-checkmark-outline" label={t('maturityFor', { name: profile?.name || '' })} value={t('mat_' + (profile?.kids ? 'all' : profile?.maturity || 'adult'))}
            onPress={() => profile && router.push(`/profile-edit?id=${profile.id}`)} />
          <Item icon="lock-closed-outline" label={t('profileLock')} value={profile?.pin ? t('on') : t('off')}
            onPress={() => profile && router.push(`/profile-edit?id=${profile.id}`)} last />
        </Section>

        <Section title={t('general')}>
          <Item icon="phone-portrait-outline" label={t('haptics')} right={tg('haptics')} />
          <Item icon="bookmark-outline" label={t('clearList')} value={String(list.length)} onPress={() => Alert.alert(t('clearList'), t('sure'), [
            { text: t('cancel'), style: 'cancel' }, { text: t('clear'), style: 'destructive', onPress: st.clearList }])} />
          <Item icon="time-outline" label={t('clearHistory')} danger last onPress={() => Alert.alert(t('clearHistory'), t('sure'), [
            { text: t('cancel'), style: 'cancel' }, { text: t('clear'), style: 'destructive', onPress: st.clearHistory }])} />
        </Section>

        <Section title={t('addonsTitle')}>
          <Item icon="extension-puzzle-outline" label={t('manageAddons')} value={String(st.addons.length)} last onPress={() => { router.back(); setTimeout(() => router.navigate('/addons'), 50); }} />
        </Section>

        <Section title={t('helpAbout')}>
          <Item icon="information-circle-outline" label={t('about')} onPress={() => router.push('/legal/about')} />
          <Item icon="document-text-outline" label={t('terms')} onPress={() => router.push('/legal/terms')} />
          <Item icon="hand-left-outline" label={t('privacy')} onPress={() => router.push('/legal/privacy')} />
          <Item icon="help-buoy-outline" label={t('help')} onPress={() => router.push('/legal/help')} last />
        </Section>
        <Txt dim center size={12}>{APP_NAME} · v{APP_VERSION}</Txt>
      </ScrollView>
    </View>
  );
}
