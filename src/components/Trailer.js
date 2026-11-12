// Trailer behind the title hero, played by the native player (AVPlayer / ExoPlayer) from a direct stream:
// no YouTube UI at all, real mute. If no stream can be found, the poster simply stays.
import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEvent } from 'expo';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Press, Glass } from './ui';
import { trailerStream } from '../ytstream';

export default function Trailer({ id, active, muted, onPlaying }) {
  const [src, setSrc] = useState(null);
  useEffect(() => {
    let ok = true;
    setSrc(null);
    if (id) trailerStream(id).then((s) => ok && setSrc(s)).catch(() => {});
    return () => { ok = false; };
  }, [id]);
  if (!src || !active) return null;
  return <TrailerPlayer src={src} muted={muted} onPlaying={onPlaying} />;
}

function TrailerPlayer({ src, muted, onPlaying }) {
  const player = useVideoPlayer({ uri: src.uri, headers: src.headers }, (p) => {
    p.loop = true; p.muted = !!muted; p.timeUpdateEventInterval = 0.25; p.audioMixingMode = 'auto'; p.play();
  });
  useEffect(() => { player.muted = !!muted; }, [muted]);
  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });
  const time = useEvent(player, 'timeUpdate', { currentTime: 0 });
  const visible = isPlaying && (time?.currentTime || 0) > 0.15;
  useEffect(() => { onPlaying?.(visible); }, [visible]);
  useEffect(() => () => onPlaying?.(false), []);
  return (
    <View style={[StyleSheet.absoluteFill, { opacity: visible ? 1 : 0 }]} pointerEvents="none">
      <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} allowsPictureInPicture={false} />
    </View>
  );
}

export function MuteButton({ muted, onToggle }) {
  return (
    <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.mute}>
      <Press onPress={onToggle} hitSlop={10}>
        <Glass radius={16} interactive style={styles.btn}><Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={16} color="#fff" /></Glass>
      </Press>
    </Animated.View>
  );
}
export const trailerIdOf = (meta) => meta?.trailers?.find((x) => !x.type || /trailer/i.test(x.type))?.source || meta?.trailers?.[0]?.source
  || meta?.trailerStreams?.[0]?.ytId || null;

const styles = StyleSheet.create({
  mute: { position: 'absolute', bottom: 10, end: 16 },
  btn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
});
