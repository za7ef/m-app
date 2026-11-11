import React, { useState } from 'react';
import { View, ScrollView, TextInput, Alert, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { useStore, useTheme } from '../store';
import { Txt, Row, Section, Item, Toggle, Chips, IconBtn, Btn, Glass } from '../components/ui';
import { Avatar, PinPad } from '../components/ProfileGate';
import { AVATAR_COLORS, AVATAR_ICONS } from '../theme';
import { t, isRTL } from '../i18n';

export default function ProfileEdit() {
  const th = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const st = useStore();
  const existing = st.profiles.find((p) => p.id === id);
  const [f, setF] = useState(existing || { name: '', icon: AVATAR_ICONS[st.profiles.length % AVATAR_ICONS.length], color: AVATAR_COLORS[st.profiles.length % AVATAR_COLORS.length], kids: false, maturity: 'adult', pin: null });
  const [pinMode, setPinMode] = useState(existing?.pin ? 'verify' : null);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));

  // A locked profile must be unlocked before editing.
  if (pinMode === 'verify') return <View style={{ flex: 1, backgroundColor: th.bg }}><PinPad profile={existing} onOk={() => setPinMode(null)} onCancel={() => router.back()} /></View>;
  if (pinMode === 'set') return <View style={{ flex: 1, backgroundColor: th.bg }}><PinPad title={t('newPin')} onOk={(c) => { set('pin', c); setPinMode(null); }} onCancel={() => setPinMode(null)} /></View>;

  const save = () => {
    const name = (f.name || '').trim();
    if (!name) { Alert.alert(t('profileName'), t('nameRequired')); return; }
    const data = { ...f, name, maturity: f.kids ? 'all' : f.maturity };
    if (existing) st.updateProfile(existing.id, data); else st.addProfile(data);
    router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: th.bg }}>
      <Row style={{ justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 6 }}>
        <IconBtn name="close" onPress={() => router.back()} />
        <Txt bold size={18}>{existing ? t('editProfile') : t('addProfile')}</Txt>
        <Btn small title={t('save')} onPress={save} />
      </Row>
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        <Animated.View entering={ZoomIn.springify()} style={{ alignItems: 'center', marginVertical: 18 }}>
          <Avatar p={f} size={110} radius={22} />
        </Animated.View>
        <Glass radius={16} style={{ marginHorizontal: 16, marginBottom: 20 }}>
          <TextInput value={f.name} onChangeText={(v) => set('name', v)} placeholder={t('profileName')} placeholderTextColor={th.dim} maxLength={20}
            style={{ color: th.text, fontSize: 17, padding: 14 }} />
        </Glass>
        <Section title={t('avatar')}>
          <View style={{ padding: 14 }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {AVATAR_ICONS.map((ic) => (
                <Pressable key={ic} onPress={() => set('icon', ic)}>
                  <View style={{ width: 46, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: f.icon === ic ? f.color : th.card }}>
                    <Ionicons name={ic} size={24} color={f.icon === ic ? '#fff' : th.sub} />
                  </View>
                </Pressable>
              ))}
            </View>
            <Row gap={10} style={{ marginTop: 14, flexWrap: 'wrap' }}>
              {AVATAR_COLORS.map((c) => (
                <Pressable key={c} onPress={() => set('color', c)}>
                  <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: c, borderWidth: f.color === c ? 3 : 0, borderColor: th.text }} />
                </Pressable>
              ))}
            </Row>
          </View>
        </Section>
        <Section title={t('parental')} footer={t('parentalNote')}>
          <Item icon="happy-outline" label={t('kidsProfile')} hint={t('kidsHint')} right={<Toggle value={f.kids} onChange={(v) => set('kids', v)} />} />
          {!f.kids ? (
            <Item icon="shield-checkmark-outline" label={t('maturity')}>
              <Chips value={f.maturity} onChange={(v) => set('maturity', v)} options={[['all', t('mat_all')], ['teen', t('mat_teen')], ['adult', t('mat_adult')]]} />
            </Item>
          ) : null}
          <Item icon="lock-closed-outline" label={t('profileLock')} hint={t('pinHint')} last
            right={<Toggle value={!!f.pin} onChange={(v) => (v ? setPinMode('set') : set('pin', null))} />} />
        </Section>
        {existing && st.profiles.length > 1 ? (
          <Section>
            <Item icon="trash-outline" danger last label={t('deleteProfile')} onPress={() => Alert.alert(t('deleteProfile'), t('sure'), [
              { text: t('cancel'), style: 'cancel' }, { text: t('delete'), style: 'destructive', onPress: () => { st.deleteProfile(existing.id); router.back(); } }])} />
          </Section>
        ) : null}
      </ScrollView>
    </View>
  );
}
