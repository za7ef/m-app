import React from 'react';
import { View, FlatList, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useStore, useTheme } from '../../store';
import { Txt, Row } from '../../components/ui';
import { Poster } from '../../components/media';
import { t } from '../../i18n';

const { width: W } = Dimensions.get('window');
const COLS = 3, GAP = 10, PW = (W - 32 - GAP * (COLS - 1)) / COLS;

export default function MyList() {
  const th = useTheme();
  const insets = useSafeAreaInsets();
  const { list } = useStore();
  return (
    <View style={{ flex: 1, backgroundColor: th.bg, paddingTop: insets.top + 8 }}>
      <Txt bold size={30} style={{ marginHorizontal: 16, marginBottom: 14 }}>{t('myList')}</Txt>
      {!list.length ? (
        <View style={{ alignItems: 'center', marginTop: 80, paddingHorizontal: 40 }}>
          <Ionicons name="bookmark-outline" size={56} color={th.dim} />
          <Txt sub center style={{ marginTop: 14, lineHeight: 22 }}>{t('listEmpty')}</Txt>
        </View>
      ) : (
        <FlatList data={list} numColumns={COLS} keyExtractor={(m) => m.id}
          columnWrapperStyle={{ gap: GAP, paddingHorizontal: 16 }} contentContainerStyle={{ gap: GAP, paddingBottom: 120 }}
          renderItem={({ item, index }) => <Poster meta={item} width={PW} height={PW * 1.5} index={index} />} />
      )}
    </View>
  );
}
