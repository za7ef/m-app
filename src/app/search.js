import React, { useEffect, useRef, useState } from 'react';
import { View, TextInput, FlatList, ActivityIndicator, Dimensions } from 'react-native';
import { IS_TV } from '../tv';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useStore, useTheme } from '../store';
import { Txt, Row, Glass, IconBtn } from '../components/ui';
import { Poster } from '../components/media';
import { search, fetchCatalog, allowedFor } from '../addons';
import { t, isRTL } from '../i18n';

const { width: W } = Dimensions.get('window');
const COLS = IS_TV ? 7 : 3, GAP = IS_TV ? 18 : 10, PW = ((IS_TV ? W - 88 : W) - 32 - GAP * (COLS - 1)) / COLS;

export default function Search() {
  const th = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { addons, profile } = useStore();
  const [q, setQ] = useState('');
  const [res, setRes] = useState(null);
  const [trending, setTrending] = useState([]);
  const [busy, setBusy] = useState(false);
  const timer = useRef(null);
  const reqId = useRef(0); // only the latest query may set results / busy

  useEffect(() => {
    const cm = addons.find((a) => a.id === 'com.linvo.cinemeta');
    if (cm) fetchCatalog(cm, 'movie', 'top').then((m) => setTrending(m.slice(0, 30))).catch(() => {});
  }, []);

  useEffect(() => {
    clearTimeout(timer.current);
    const id = ++reqId.current;
    if (q.trim().length < 2) { setRes(null); setBusy(false); return; }
    timer.current = setTimeout(async () => {
      setBusy(true);
      let r = [];
      try { r = await search(addons, q.trim()); } catch {}
      if (id !== reqId.current) return; // a newer query is running
      setRes(r); setBusy(false);
    }, 450);
    return () => clearTimeout(timer.current);
  }, [q]);

  const data = (res || trending).filter((m) => allowedFor(profile, m));
  return (
    <View style={{ flex: 1, backgroundColor: th.bg, paddingTop: insets.top + 8 }}>
      <Row gap={10} style={{ marginHorizontal: 16, marginBottom: 12 }}>
      <Glass radius={23} style={{ flex: 1 }}>
        <Row gap={8} style={{ paddingHorizontal: 14, height: 46 }}>
          <Ionicons name="search" size={19} color={th.sub} />
          <TextInput value={q} onChangeText={setQ} placeholder={t('searchPh')} placeholderTextColor={th.dim} autoFocus
            style={{ flex: 1, color: th.text, fontSize: 16 }} autoCorrect={false} returnKeyType="search" clearButtonMode="while-editing" />
          {busy ? <ActivityIndicator color={th.accent} /> : null}
        </Row>
      </Glass>
      <IconBtn name="close" onPress={() => router.back()} />
      </Row>
      <Txt bold size={18} style={{ marginHorizontal: 16, marginBottom: 10 }}>{res ? '' : t('topSearches')}</Txt>
      {res && !res.length && !busy ? <Txt sub center style={{ marginTop: 40 }}>{t('noResults')}</Txt> : null}
      <FlatList data={data} numColumns={COLS} keyExtractor={(m) => m.id}
        columnWrapperStyle={{ gap: GAP, paddingHorizontal: 16 }} contentContainerStyle={{ gap: GAP, paddingBottom: 120 }}
        keyboardDismissMode="on-drag"
        renderItem={({ item, index }) => <Poster meta={item} width={PW} height={PW * 1.5} index={index} />} />
    </View>
  );
}
