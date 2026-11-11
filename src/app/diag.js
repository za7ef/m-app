// Hidden diagnostics screen (mapp://diag): checks the built-in torrent engine with a public-domain film
// (Sintel, Blender Foundation, CC-BY) and plays it through the normal video player.
import React, { useEffect, useState } from 'react';
import { View, ScrollView } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Txt } from '../components/ui';
import { useTheme } from '../store';
import * as Engine from '../../modules/m-torrent/src';

const SINTEL = 'magnet:?xt=urn:btih:08ada5a7a6183aae1e09d831df6748d566095a10&dn=Sintel'
  + '&tr=udp%3A%2F%2Fexplodie.org%3A6969&tr=udp%3A%2F%2Ftracker.opentrackr.org%3A1337%2Fannounce'
  + '&tr=udp%3A%2F%2Ftracker.openbittorrent.com%3A6969&tr=wss%3A%2F%2Ftracker.webtorrent.dev'
  + '&ws=https%3A%2F%2Fwebtorrent.io%2Ftorrents%2F';

export default function Diag() {
  const th = useTheme();
  const insets = useSafeAreaInsets();
  const [log, setLog] = useState([]);
  const [url, setUrl] = useState(null);
  const say = (m) => { console.log('[diag]', m); setLog((l) => [...l, m]); };
  const player = useVideoPlayer(url ? { uri: url } : null, (p) => { p.play(); });

  useEffect(() => {
    let off = false;
    (async () => {
      say('engine available: ' + Engine.engineAvailable);
      if (!Engine.engineAvailable) return;
      try {
        const port = await Engine.start(Engine.cacheDir(), 50);
        say('port ' + port);
        let info;
        try { info = await Engine.add(SINTEL, 60); say('magnet metadata from peers ok'); }
        catch (e) { say('magnet: ' + e.message + ' -> trying .torrent file'); info = await Engine.addTorrentUrl('https://webtorrent.io/torrents/sintel.torrent'); }
        const f = info.files.filter((x) => /\.mp4$/.test(x.path)).sort((a, b) => b.length - a.length)[0];
        say(`metadata ok: ${info.name}, ${info.files.length} files, playing ${f.path}`);
        if (!off) setUrl(`http://127.0.0.1:${port}/stream/${info.infoHash}/${f.index}`);
        for (let i = 0; i < 20 && !off; i++) {
          await new Promise((r) => setTimeout(r, 5000));
          say('stats ' + JSON.stringify(await Engine.stats(info.infoHash)));
        }
      } catch (e) { say('error ' + (e?.message || e)); }
    })();
    return () => { off = true; Engine.dropAll().catch(() => {}); };
  }, []);

  useEffect(() => {
    if (!player) return;
    const a = player.addListener('statusChange', (e) => say('player ' + e.status + (e.error ? ' ' + e.error.message : '')));
    const b = setInterval(() => { if (url) console.log('[diag] time ' + player.currentTime?.toFixed(1)); }, 5000);
    return () => { a.remove(); clearInterval(b); };
  }, [player, url]);

  return (
    <View style={{ flex: 1, backgroundColor: th.bg, paddingTop: insets.top + 10 }}>
      <View style={{ aspectRatio: 16 / 9, backgroundColor: '#000' }}>{url ? <VideoView player={player} style={{ flex: 1 }} contentFit="contain" /> : null}</View>
      <ScrollView contentContainerStyle={{ padding: 14 }}>
        {log.map((l, i) => <Txt key={i} size={12} style={{ writingDirection: 'ltr', textAlign: 'left', marginBottom: 4 }}>{l}</Txt>)}
      </ScrollView>
    </View>
  );
}
