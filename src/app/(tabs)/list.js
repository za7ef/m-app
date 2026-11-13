import React from 'react';
import { View, FlatList, Dimensions } from 'react-native';
import { IS_TV } from '../../tv';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useStore, useTheme } from '../../store';
import { Txt, Row, Glass, Press } from '../../components/ui';
import { useRouter } from 'expo-router';
import { useDownloads } from '../../downloads';
import { Poster } from '../../components/media';
import { t, isRTL } from '../../i18n';

const { width: W } = Dimensions.get('window');
const COLS = IS_TV ? 7 : 3, GAP = IS_TV ? 18 : 10, PW = ((IS_TV ? W - 88 : W) - 32 - GAP * (COLS - 1)) / COLS;

export default function MyList() {
  const th = useTheme();
  const insets = useSafeAreaInsets();
  const { list } = useStore();
  const router = useRouter();
  const dls = Object.values(useDownloads());
  const active = dls.filter((x) => x.status !== 'done' && x.status !== 'paused' && x.status !== 'error').length;
  return (
    <View style={{ flex: 1, backgroundColor: th.bg, paddingTop: insets.top + 8 }}>
      <Txt bold size={30} style={{ marginHorizontal: 16, marginBottom: 14 }}>{t('myList')}</Txt>
      <Press scale={0.98} onPress={() => router.push('/downloads')} style={{ marginHorizontal: 16, marginBottom: 14 }}>
        <Glass radius={14} interactive style={{ paddingHorizontal: 14, paddingVertical: 12 }}>
          <Row gap={10}>
            <Ionicons name="arrow-down-circle-outline" size={22} color={th.accent} />
            <Txt bold size={15} style={{ flex: 1 }}>{t('downloads')}</Txt>
            <Txt sub size={13}>{active ? t('dlActiveN', { n: active }) : dls.length ? String(dls.length) : ''}</Txt>
            <Ionicons name="chevron-forward" size={18} color={th.dim} style={{ transform: [{ scaleX: isRTL() ? -1 : 1 }] }} />
          </Row>
        </Glass>
      </Press>
      {!list.length ? (
        <View style={{ alignItems: 'center', marginTop: 80, paddingHorizontal: 40 }}>
          <Ionicons name="bookmark-outline" size={56} color={th.dim} />
          <Txt sub center style={{ marginTop: 14, lineHeight: 22 }}>{t('listEmpty')}</Txt>
        </View>
      ) : (
        <FlatList data={list} numColumns={COLS} keyExtractor={(m) => m.id}
          columnWrapperStyle={{ gap: GAP, paddingHorizontal: 16 }} contentContainerStyle={{ gap: GAP, paddingBottom: 150 }}
          renderItem={({ item, index }) => <Poster meta={item} width={PW} height={PW * 1.5} index={index} />} />
      )}
    </View>
  );
}
