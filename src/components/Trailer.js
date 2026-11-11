// Auto-playing YouTube trailer behind the title hero, with sound and a small mute button.
import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Press, Glass } from './ui';

const ORIGIN = 'https://za7ef.github.io';
const html = (id) => `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<style>html,body{margin:0;padding:0;background:#000;overflow:hidden;height:100%;width:100%}
#w{position:absolute;top:50%;left:50%;height:100%;width:177.78vh;min-width:100%;min-height:56.25vw;transform:translate(-50%,-50%) scale(1.18)}
#p{width:100%;height:100%;pointer-events:none}</style></head><body><div id="w"><div id="p"></div></div>
<script src="https://www.youtube.com/iframe_api"></script><script>
var player;function post(m){window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify(m))}
function onYouTubeIframeAPIReady(){player=new YT.Player('p',{videoId:'${id}',host:'https://www.youtube-nocookie.com',
playerVars:{autoplay:1,controls:0,disablekb:1,fs:0,iv_load_policy:3,modestbranding:1,playsinline:1,rel:0,origin:'${ORIGIN}',loop:1,playlist:'${id}'},
events:{onReady:function(e){e.target.unMute();e.target.setVolume(100);e.target.playVideo()},
onStateChange:function(e){post({state:e.data})},onError:function(e){post({error:e.data})}}})}
window.setMuted=function(m){if(!player)return;m?player.mute():player.unMute()};
window.pauseIt=function(){player&&player.pauseVideo()};
</script></body></html>`;

export default function Trailer({ id, active, muted, onPlaying }) {
  const web = useRef(null);
  const [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const set = (v) => { setPlaying(v); onPlaying?.(v); };
  useEffect(() => { web.current?.injectJavaScript(`window.setMuted(${!!muted});true;`); }, [muted]);
  useEffect(() => { if (!active && playing) set(false); }, [active]);
  if (!id || failed || !active) return null;
  return (
    <View style={[StyleSheet.absoluteFill, { opacity: playing ? 1 : 0 }]} pointerEvents="none">
      <WebView ref={web} source={{ html: html(id), baseUrl: ORIGIN }} originWhitelist={['*']}
        style={{ flex: 1, backgroundColor: '#000' }} scrollEnabled={false} bounces={false}
        allowsInlineMediaPlayback mediaPlaybackRequiresUserAction={false} allowsFullscreenVideo={false}
        javaScriptEnabled domStorageEnabled
        onMessage={(e) => {
          try {
            const m = JSON.parse(e.nativeEvent.data);
            if (m.error != null) { setFailed(true); set(false); }
            else if (m.state === 1) { set(true); if (muted) web.current?.injectJavaScript('window.setMuted(true);true;'); }
            else if (m.state === 0) set(false);
          } catch {}
        }}
        onError={() => { setFailed(true); set(false); }} />
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
  mute: { position: 'absolute', bottom: 56, end: 14 },
  btn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
});
