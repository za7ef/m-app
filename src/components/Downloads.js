// Download UI pieces used on the title page: the per-episode button, the source picker and the season sheet.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Modal, Pressable, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../store';
import { Txt, Row, Btn, Glass, Press, Chips } from './ui';
import { getStreams, streamQuality } from '../addons';
import { sizeBytes } from '../torrent';
import { useDownloads, addDownload, pauseDownload, resumeDownload, removeDownload, storageInfo, sourceSize, sourceLabel, LOW_SPACE } from '../downloads';
import { t } from '../i18n';

export const fmtBytes = (b) => {
  if (b == null || !isFinite(b)) return '—';
  if (b >= 1024 ** 3) return (b / 1024 ** 3).toFixed(b >= 10 * 1024 ** 3 ? 0 : 1) + ' GB';
  if (b >= 1024 ** 2) return Math.round(b / 1024 ** 2) + ' MB';
  return Math.max(1, Math.round(b / 1024)) + ' KB';
};
export const pct = (it) => (it?.total ? Math.min(100, Math.floor(((it.bytes || 0) / it.total) * 100)) : 0);

// All downloadable sources for a video (direct links and torrents), smallest first; unknown sizes last.
export function downloadable(s) {
  const list = [...(s.direct || []).filter((x) => x.url && !/^(https?:\/\/)?(www\.)?youtube/i.test(x.url)), ...(s.torrents || [])];
  const k = (x) => { const b = sourceSize(x); return b == null ? Infinity : b; };
  return list.sort((a, b) => k(a) - k(b) || (b.seeders || 0) - (a.seeders || 0));
}

// "auto" quality: same as the last source used for this title if known, else 1080p; then the smallest at that quality.
export function autoPick(list, quality) {
  if (!list.length) return null;
  const q = quality && quality !== 'auto' ? +quality : 1080;
  const at = list.filter((x) => streamQuality(x) === q);
  if (at.length) return at[0];
  const below = list.filter((x) => { const v = streamQuality(x); return v && v < q; }).sort((a, b) => streamQuality(b) - streamQuality(a));
  return below[0] || list[0];
}

const confirmSpace = async (bytes) => {
  const { free } = await storageInfo();
  if (free == null || bytes == null || free - bytes > LOW_SPACE) return true;
  return new Promise((r) => Alert.alert(t('dlLowSpaceTitle'), t('dlLowSpaceMsg', { need: fmtBytes(bytes), free: fmtBytes(free) }), [
    { text: t('cancel'), style: 'cancel', onPress: () => r(false) }, { text: t('dlAnyway'), onPress: () => r(true) }]));
};

// Starts a download after the space check.
export async function startDownload(item) {
  if (!(await confirmSpace(sourceSize(item.source)))) return false;
  await addDownload(item);
  return true;
}

// Small round button: download → progress ring → check. Tap for pause/cancel, or play/delete when done.
export function DlButton({ id, onDownload, onPlay, size = 30 }) {
  const th = useTheme();
  const all = useDownloads();
  const it = all[id];
  const st = it?.status;
  const onPress = () => {
    if (!it) return onDownload();
    if (st === 'done') {
      return Alert.alert(it.subtitle || it.title, null, [
        { text: t('play'), onPress: onPlay }, { text: t('dlDelete'), style: 'destructive', onPress: () => removeDownload(id) }, { text: t('cancel'), style: 'cancel' }]);
    }
    if (st === 'paused' || st === 'error') {
      return Alert.alert(it.subtitle || it.title, st === 'error' ? t('dlFailed') : null, [
        { text: t('dlResume'), onPress: () => resumeDownload(id) }, { text: t('dlCancel'), style: 'destructive', onPress: () => removeDownload(id) }, { text: t('cancel'), style: 'cancel' }]);
    }
    return Alert.alert(it.subtitle || it.title, `${pct(it)}%`, [
      { text: t('dlPause'), onPress: () => pauseDownload(id) }, { text: t('dlCancel'), style: 'destructive', onPress: () => removeDownload(id) }, { text: t('cancel'), style: 'cancel' }]);
  };
  let inner;
  if (!it) inner = <Ionicons name="arrow-down-circle-outline" size={size} color={th.text} />;
  else if (st === 'done') inner = <Ionicons name="checkmark-circle" size={size} color={th.accent} />;
  else if (st === 'error') inner = <Ionicons name="alert-circle-outline" size={size} color="#FF9F0A" />;
  else {
    inner = (
      <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 2.5, borderColor: st === 'paused' ? th.dim : th.accent, alignItems: 'center', justifyContent: 'center' }}>
        {st === 'paused' ? <Ionicons name="pause" size={size * 0.45} color={th.dim} />
          : st === 'preparing' || st === 'queued' || st === 'wifi' ? <ActivityIndicator size="small" color={th.accent} style={{ transform: [{ scale: 0.7 }] }} />
          : <Txt bold size={size * 0.3} style={{ color: th.text }}>{pct(it)}</Txt>}
      </View>
    );
  }
  return <Press onPress={onPress} hitSlop={10} scale={0.9}>{inner}</Press>;
}

function SheetBox({ visible, onClose, children, height = '80%' }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} supportedOrientations={['portrait', 'landscape']}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' }} onPress={onClose} />
      <Glass radius={28} style={{ maxHeight: height, marginHorizontal: 8, marginBottom: insets.bottom + 8 }}>
        <View style={{ alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: '#888', marginTop: 8 }} />
        {children}
      </Glass>
    </Modal>
  );
}

function SourceRow({ s, on, onPress }) {
  const th = useTheme();
  const q = streamQuality(s);
  return (
    <Press scale={0.98} onPress={onPress}>
      <View style={{ paddingVertical: 10, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: on ? 'rgba(255,255,255,0.08)' : 'transparent' }}>
        <Ionicons name={s.infoHash ? 'magnet-outline' : 'link-outline'} size={20} color={th.accent} />
        <View style={{ flex: 1 }}>
          <Txt bold size={14} numberOfLines={1}>{sourceLabel(s) || s.addon}</Txt>
          <Txt sub size={12}>{[fmtBytes(sourceSize(s)), q ? q + 'p' : null, s.infoHash ? `👤 ${s.seeders || 0}` : null].filter(Boolean).join(' · ')}</Txt>
        </View>
        {on ? <Ionicons name="checkmark" size={20} color={th.accent} /> : null}
      </View>
    </Press>
  );
}

// Source list for one video, smallest first. onPick(source).
export function SourcePicker({ visible, type, videoId, addons, title, current, onPick, onClose }) {
  const [s, setS] = useState(null);
  useEffect(() => {
    if (!visible) return;
    const ctl = new AbortController();
    setS(null);
    getStreams(type, videoId, addons, { signal: ctl.signal, onUpdate: (p) => setS({ ...p, loading: true }) })
      .then((r) => setS({ ...r, loading: false })).catch(() => setS((p) => ({ ...(p || {}), loading: false })));
    return () => ctl.abort();
  }, [visible, videoId]);
  const list = s ? downloadable(s) : [];
  return (
    <SheetBox visible={visible} onClose={onClose}>
      <Row gap={8} style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6 }}>
        <Txt bold size={17} style={{ flex: 1 }} numberOfLines={1}>{title || t('dlChooseSource')}</Txt>
        {!s || s.loading ? <ActivityIndicator /> : null}
      </Row>
      <Txt sub size={12} style={{ paddingHorizontal: 16, marginBottom: 4 }}>{t('dlChooseSource')} · {t('dlSmallestFirst')}</Txt>
      <ScrollView contentContainerStyle={{ paddingBottom: 12 }}>
        {list.map((x, i) => <SourceRow key={(x.infoHash || x.url) + (x.fileIdx ?? '') + i} s={x} on={current && (current.infoHash ? current.infoHash === x.infoHash && current.fileIdx === x.fileIdx : current.url === x.url)} onPress={() => onPick(x)} />)}
        {s && !s.loading && !list.length ? <Txt sub style={{ padding: 16 }}>{t('noSources')}</Txt> : null}
      </ScrollView>
    </SheetBox>
  );
}

const QUALITIES = ['auto', '2160', '1080', '720', '480'];

// Pick several episodes of a show and download them together.
export function SeasonSheet({ visible, onClose, meta, type, addons, seasons, initialSeason, epName, makeItem, lastQuality }) {
  const th = useTheme();
  const all = useDownloads();
  const [season, setSeason] = useState(initialSeason);
  const [sel, setSel] = useState({}); // videoId -> true
  const [quality, setQuality] = useState('auto');
  const [srcs, setSrcs] = useState({}); // videoId -> { list, pick, loading, manual }
  const [picker, setPicker] = useState(null); // video being changed
  const [free, setFree] = useState(null);
  const reqs = useRef({});
  useEffect(() => { if (visible) { setSeason(initialSeason); storageInfo().then((i) => setFree(i.free)); } }, [visible]);
  const eps = useMemo(() => (meta?.videos || []).filter((v) => v.season === season).sort((a, b) => (a.episode || a.number) - (b.episode || b.number)), [meta, season]);
  const q = quality === 'auto' ? (lastQuality || 'auto') : quality;

  // fetch sources for each ticked episode (3 at a time) and choose one automatically
  useEffect(() => {
    const need = Object.keys(sel).filter((id) => sel[id] && !srcs[id] && !reqs.current[id]);
    if (!need.length) return;
    let n = 0;
    const next = () => {
      const id = need[n++];
      if (!id) return;
      reqs.current[id] = true;
      setSrcs((p) => ({ ...p, [id]: { loading: true, list: [] } }));
      getStreams(type, id, addons).then((r) => {
        const list = downloadable(r);
        setSrcs((p) => ({ ...p, [id]: { loading: false, list, pick: autoPick(list, q) } }));
      }).catch(() => setSrcs((p) => ({ ...p, [id]: { loading: false, list: [] } }))).finally(() => { delete reqs.current[id]; next(); });
    };
    next(); next(); next();
  }, [sel]);
  // a new quality choice re-picks every episode that wasn't changed by hand
  useEffect(() => { setSrcs((p) => { const o = {}; for (const k in p) o[k] = p[k].manual || !p[k].list ? p[k] : { ...p[k], pick: autoPick(p[k].list, q) }; return o; }); }, [quality]);

  const avail = eps.filter((v) => !all[v.id]);
  const allOn = avail.length > 0 && avail.every((v) => sel[v.id]);
  const chosen = Object.keys(sel).filter((id) => sel[id]);
  const total = chosen.reduce((n, id) => n + (sourceSize(srcs[id]?.pick) || 0), 0);
  const unknown = chosen.filter((id) => srcs[id]?.pick && !sourceSize(srcs[id].pick)).length;
  const loading = chosen.some((id) => srcs[id]?.loading);
  const go = async () => {
    const vids = (meta.videos || []).filter((v) => sel[v.id] && srcs[v.id]?.pick);
    if (!vids.length) return;
    const { free: f } = await storageInfo();
    const ok = f == null || f - total > LOW_SPACE || await new Promise((r) => Alert.alert(t('dlLowSpaceTitle'), t('dlLowSpaceMsg', { need: fmtBytes(total), free: fmtBytes(f) }), [
      { text: t('cancel'), style: 'cancel', onPress: () => r(false) }, { text: t('dlAnyway'), onPress: () => r(true) }]));
    if (!ok) return;
    for (const v of vids) await addDownload(makeItem(v, srcs[v.id].pick));
    setSel({});
    onClose();
  };

  return (
    <SheetBox visible={visible} onClose={onClose} height="88%">
      <View style={{ paddingHorizontal: 16, paddingTop: 10 }}>
        <Txt bold size={18}>{t('dlEpisodes')}</Txt>
        <Chips value={season} onChange={setSeason} options={seasons.map((s) => [s, s === 0 ? t('specials') : t('season', { n: s })])} />
        <Txt sub size={12} style={{ marginTop: 10 }}>{t('dlQuality')}</Txt>
        <Chips value={quality} onChange={setQuality} options={QUALITIES.map((x) => [x, x === 'auto' ? t('dlAutoQ', { q: (lastQuality || '1080') + 'p' }) : x + 'p'])} />
        <Press onPress={() => setSel((p) => { const o = { ...p }; avail.forEach((v) => { o[v.id] = !allOn; }); return o; })} style={{ marginTop: 10 }}>
          <Row gap={8}><Ionicons name={allOn ? 'checkbox' : 'square-outline'} size={22} color={th.accent} /><Txt bold size={14}>{t('dlSelectAll')}</Txt></Row>
        </Press>
      </View>
      <ScrollView contentContainerStyle={{ paddingVertical: 6 }}>
        {eps.map((v) => {
          const d = all[v.id];
          const on = !!sel[v.id];
          const sr = srcs[v.id];
          return (
            <View key={v.id} style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
              <Row gap={10}>
                {d ? <Ionicons name={d.status === 'done' ? 'checkmark-circle' : 'arrow-down-circle'} size={22} color={th.accent} />
                  : <Press onPress={() => setSel((p) => ({ ...p, [v.id]: !p[v.id] }))} hitSlop={8}><Ionicons name={on ? 'checkbox' : 'square-outline'} size={22} color={th.accent} /></Press>}
                <View style={{ flex: 1 }}>
                  <Txt size={14} numberOfLines={1}>{(v.episode || v.number) + '. ' + epName(v)}</Txt>
                  {d ? <Txt sub size={12}>{d.status === 'done' ? t('dlDone') : t('dlInProgress')}</Txt>
                    : on ? (sr?.loading ? <Txt sub size={12}>{t('loading')}</Txt>
                      : sr?.pick ? (
                        <Press onPress={() => setPicker(v)}>
                          <Txt size={12} numberOfLines={1} style={{ color: th.accent }}>{[fmtBytes(sourceSize(sr.pick)), streamQuality(sr.pick) ? streamQuality(sr.pick) + 'p' : null, sourceLabel(sr.pick)].filter(Boolean).join(' · ')} ›</Txt>
                        </Press>
                      ) : <Txt size={12} style={{ color: '#FF9F0A' }}>{t('noSources')}</Txt>) : null}
                </View>
              </Row>
            </View>
          );
        })}
      </ScrollView>
      <View style={{ paddingHorizontal: 16, paddingBottom: 14, paddingTop: 6 }}>
        <Txt sub size={13} center>{t('dlTotal', { n: chosen.length, size: fmtBytes(total), free: fmtBytes(free) })}{unknown ? ' ' + t('dlUnknownN', { n: unknown }) : ''}</Txt>
        {free != null && total > free - LOW_SPACE ? <Txt size={12} center style={{ color: '#FF9F0A', marginTop: 4 }}>{t('dlLowSpaceShort')}</Txt> : null}
        <Btn icon="arrow-down" title={t('download')} disabled={!chosen.length || loading} onPress={go} style={{ marginTop: 10 }} />
      </View>
      {picker ? (
        <SourcePicker visible type={type} videoId={picker.id} addons={addons} title={(picker.episode || picker.number) + '. ' + epName(picker)} current={srcs[picker.id]?.pick}
          onClose={() => setPicker(null)} onPick={(x) => { setSrcs((p) => ({ ...p, [picker.id]: { ...(p[picker.id] || {}), pick: x, manual: true } })); setPicker(null); }} />
      ) : null}
    </SheetBox>
  );
}

export { sizeBytes };
