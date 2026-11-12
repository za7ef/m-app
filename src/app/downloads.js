// Downloads: progress, pause/resume/delete, storage, Wi-Fi only, and offline playback.
import React, { useEffect, useState } from 'react';
import { View, ScrollView, Alert, Platform } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useStore, useTheme } from '../store';
import { Txt, Row, Glass, Press, IconBtn, Toggle } from '../components/ui';
import { useDownloads, pauseDownload, resumeDownload, removeDownload, storageInfo, offlineSession, LOW_SPACE } from '../downloads';
import { fmtBytes, pct } from '../components/Downloads';
import { setSession } from '../session';
import { t } from '../i18n';

export default function Downloads() {
  const th = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const store = useStore();
  const { settings, watched } = store;
  const all = useDownloads();
  const list = Object.values(all).sort((a, b) => (a.metaId === b.metaId ? (a.season || 0) - (b.season || 0) || (a.episode || 0) - (b.episode || 0) : b.addedAt - a.addedAt));
  const [space, setSpace] = useState(null);
  useEffect(() => { storageInfo().then(setSpace); }, [Object.keys(all).length, list.filter((x) => x.status === 'done').length]);

  const play = async (it) => {
    const off = await offlineSession(it.id);
    if (!off) return;
    const w = watched[it.id];
    setSession({
      url: off.url, fallbacks: [], title: it.title, subtitle: it.subtitle, metaId: it.metaId, type: it.type, videoId: it.id,
      season: it.season, episode: it.episode, poster: it.poster, background: it.background, thumb: it.thumb, filename: off.url.split('/').pop(),
      startAt: settings.resume && w && w.pos < (w.dur || 1) * 0.95 ? w.pos : 0, streamSubs: [], offline: off.offline, source: { offline: true }, next: null, episodes: null,
    });
    router.push('/player');
  };
  const menu = (it) => {
    const st = it.status;
    const b = [];
    if (st === 'done') b.push({ text: t('play'), onPress: () => play(it) });
    else if (st === 'paused' || st === 'error') b.push({ text: t('dlResume'), onPress: () => resumeDownload(it.id) });
    else b.push({ text: t('dlPause'), onPress: () => pauseDownload(it.id) });
    b.push({ text: st === 'done' ? t('dlDelete') : t('dlCancel'), style: 'destructive', onPress: () => removeDownload(it.id) });
    b.push({ text: t('cancel'), style: 'cancel' });
    Alert.alert(it.subtitle || it.title, it.source?.label || null, b);
  };
  const statusText = (it) => {
    switch (it.status) {
      case 'done': return `${t('dlDone')} · ${fmtBytes(it.bytes || it.total)}`;
      case 'paused': return `${t('dlPaused')} · ${pct(it)}%`;
      case 'error': return t('dlFailed') + (it.error === 'hlsEncrypted' ? ' · ' + t('dlHlsEncrypted') : '');
      case 'wifi': return t('dlWaitingWifi');
      case 'queued': return t('dlQueued');
      case 'preparing': return t('dlPreparing');
      default: return `${pct(it)}% · ${fmtBytes(it.bytes)} / ${fmtBytes(it.total)}${it.speed ? ' · ' + fmtBytes(it.speed) + '/s' : ''}${it.peers != null && it.job?.kind === 'torrent' ? ` · 👤 ${it.peers}` : ''}`;
    }
  };
  const low = space?.free != null && space.free < LOW_SPACE;

  return (
    <View style={{ flex: 1, backgroundColor: th.bg, paddingTop: insets.top + 8 }}>
      <Row gap={10} style={{ paddingHorizontal: 16, marginBottom: 10 }}>
        <IconBtn name={Platform.OS === 'ios' ? 'chevron-down' : 'arrow-back'} onPress={() => router.back()} />
        <Txt bold size={26} style={{ flex: 1 }}>{t('downloads')}</Txt>
      </Row>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 40 }}>
        <Glass radius={16} style={{ padding: 14, marginBottom: 12 }}>
          <Row gap={10}>
            <Ionicons name="phone-portrait-outline" size={20} color={th.sub} />
            <Txt size={14} style={{ flex: 1 }}>{t('dlSpace', { used: fmtBytes(space?.used || 0), free: fmtBytes(space?.free) })}</Txt>
          </Row>
          {space?.total ? (
            <View style={{ height: 6, borderRadius: 3, backgroundColor: th.line, marginTop: 10, overflow: 'hidden', flexDirection: 'row' }}>
              <View style={{ width: `${Math.min(100, ((space.total - space.free) / space.total) * 100)}%`, backgroundColor: low ? '#FF9F0A' : th.accent }} />
            </View>
          ) : null}
          {low ? <Txt size={12} style={{ color: '#FF9F0A', marginTop: 8 }}>{t('dlLowSpaceShort')}</Txt> : null}
          <Row gap={10} style={{ marginTop: 12 }}>
            <Ionicons name="wifi" size={20} color={th.sub} />
            <Txt size={14} style={{ flex: 1 }}>{t('dlWifiOnly')}</Txt>
            <Toggle value={!!settings.dlWifiOnly} onChange={(v) => store.setSetting('dlWifiOnly', v)} />
          </Row>
          <Txt dim size={12} style={{ marginTop: 8, lineHeight: 17 }}>{Platform.OS === 'ios' ? t('dlBgIos') : t('dlBgAndroid')}</Txt>
        </Glass>

        {!list.length ? (
          <View style={{ alignItems: 'center', marginTop: 60, paddingHorizontal: 30 }}>
            <Ionicons name="arrow-down-circle-outline" size={56} color={th.dim} />
            <Txt sub center style={{ marginTop: 14, lineHeight: 22 }}>{t('dlEmpty')}</Txt>
          </View>
        ) : list.map((it) => (
          <Press key={it.id} scale={0.98} onPress={() => (it.status === 'done' ? play(it) : menu(it))} onLongPress={() => menu(it)}>
            <Row gap={12} style={{ paddingVertical: 10 }}>
              <View style={{ width: 96, height: 56, borderRadius: 8, overflow: 'hidden', backgroundColor: th.card }}>
                {it.thumb || it.background || it.poster ? <Image source={{ uri: it.thumb || it.background || it.poster }} style={{ width: '100%', height: '100%' }} contentFit="cover" /> : null}
                {it.status === 'done' ? <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="play-circle" size={26} color="rgba(255,255,255,0.92)" /></View> : null}
              </View>
              <View style={{ flex: 1 }}>
                <Txt bold size={14} numberOfLines={1}>{it.title}</Txt>
                {it.subtitle ? <Txt sub size={12} numberOfLines={1}>{it.subtitle}</Txt> : null}
                <Txt dim size={11} numberOfLines={1}>{[it.source?.label, fmtBytes(it.total || it.source?.size)].filter(Boolean).join(' · ')}</Txt>
                <Txt size={12} style={{ color: it.status === 'error' ? '#FF9F0A' : th.sub, marginTop: 2 }} numberOfLines={1}>{statusText(it)}</Txt>
                {it.status !== 'done' ? (
                  <View style={{ height: 3, borderRadius: 2, backgroundColor: th.line, marginTop: 5, overflow: 'hidden' }}>
                    <View style={{ height: 3, width: `${pct(it)}%`, backgroundColor: it.status === 'paused' ? th.dim : th.accent }} />
                  </View>
                ) : null}
              </View>
              <Press onPress={() => (it.status === 'downloading' || it.status === 'preparing' || it.status === 'queued' || it.status === 'wifi' ? pauseDownload(it.id) : it.status === 'done' ? menu(it) : resumeDownload(it.id))} hitSlop={10}>
                <Ionicons size={26} color={th.text}
                  name={it.status === 'done' ? 'ellipsis-horizontal' : it.status === 'paused' || it.status === 'error' ? 'play-circle-outline' : 'pause-circle-outline'} />
              </Press>
            </Row>
          </Press>
        ))}
      </ScrollView>
    </View>
  );
}
