import React from 'react';
import { View, ScrollView, Linking } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useStore, useTheme } from '../../store';
import { Txt, Row, IconBtn, Section, Item, Glass, Press } from '../../components/ui';
import { LEGAL } from '../../legal';
import { t, getLang } from '../../i18n';
import { APP_NAME, APP_VERSION, DEVELOPER_URL, REPO_URL } from '../../config';

export default function Legal() {
  const th = useTheme();
  const router = useRouter();
  const { doc } = useLocalSearchParams();
  const lang = getLang();
  const title = { terms: t('terms'), privacy: t('privacy'), about: t('about'), help: t('help') }[doc] || '';

  return (
    <View style={{ flex: 1, backgroundColor: th.bg }}>
      <Row style={{ justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 10 }}>
        <Txt bold size={24}>{title}</Txt>
        <IconBtn name="close" onPress={() => router.back()} />
      </Row>
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
        {doc === 'about' ? <About th={th} /> : doc === 'help' ? (
          <View style={{ paddingHorizontal: 20 }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <View key={i} style={{ marginBottom: 18 }}>
                <Txt bold size={16}>{t('helpQ' + i)}</Txt>
                <Txt sub size={14} style={{ marginTop: 6, lineHeight: 22 }}>{t('helpA' + i)}</Txt>
              </View>
            ))}
          </View>
        ) : (
          <View style={{ paddingHorizontal: 20 }}>
            {(LEGAL[doc]?.[lang] || []).map(([h, body], i) => (
              <View key={i} style={{ marginBottom: 16 }}>
                {h ? <Txt bold size={16} style={{ marginBottom: 6 }}>{h}</Txt> : null}
                <Txt sub={!h} size={14} style={{ lineHeight: 23 }}>{body}</Txt>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function About({ th }) {
  return (
    <View>
      <View style={{ alignItems: 'center', marginVertical: 16 }}>
        <Image source={require('../../../assets/icon.png')} style={{ width: 96, height: 96, borderRadius: 22 }} />
        <Txt bold center size={24} style={{ marginTop: 12 }}>{APP_NAME}</Txt>
        <Txt sub center size={13}>v{APP_VERSION}</Txt>
      </View>
      <Txt size={15} style={{ marginHorizontal: 20, marginBottom: 22, lineHeight: 24 }}>{t('aboutDesc')}</Txt>
      <Section title={t('aboutDev')}>
        <View style={{ padding: 16 }}>
          <Row gap={12}>
            <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: th.accent, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="code-slash" size={24} color={th.onAccent} />
            </View>
            <View style={{ flex: 1 }}>
              <Txt bold size={17}>{t('devName')}</Txt>
              <Txt sub size={13}>{t('devRole')}</Txt>
            </View>
          </Row>
        </View>
        <Item icon="logo-github" label="github.com/za7ef" onPress={() => Linking.openURL(DEVELOPER_URL)} />
        <Item icon="git-branch-outline" label={t('sourceCode')} onPress={() => Linking.openURL(REPO_URL)} last />
      </Section>
      <Txt dim center size={12} style={{ marginHorizontal: 30, lineHeight: 18 }}>{t('aboutNotAffiliated')}</Txt>
    </View>
  );
}
