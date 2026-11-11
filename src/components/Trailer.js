// Auto-playing YouTube trailer behind the title hero, with sound and a small mute button.
import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Press, Glass } from './ui';

const ORIGIN = 'https://za7ef.github.io';
// The video stays invisible (poster shows) until it has really played for ~2 s, and hides again before the end,
// on pause and on buffering, so no YouTube title/channel/buttons/end screen is ever seen. The frame is also scaled
// up to crop the edges, and a transparent layer sits on top so nothing can be tapped.
const html = (id, muted) => `<!DOCTYPE html><html><head><link rel="preconnect" href="https://www.youtube-nocookie.com"><link rel="preconnect" href="https://i.ytimg.com"><link rel="preconnect" href="https://www.google.com"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<style>html,body{margin:0;padding:0;background:#000;overflow:hidden;height:100%;width:100%}
#w{position:absolute;top:50%;left:50%;height:100%;width:177.78vh;min-width:100%;min-height:56.25vw;transform:translate(-50%,-50%) scale(1.35)}
#p{width:100%;height:100%;pointer-events:none}#c{position:fixed;top:0;left:0;right:0;bottom:0;z-index:9;background:transparent}</style></head>
<body><div id="w"><div id="p"></div></div><div id="c"></div>
<script src="https://www.youtube.com/iframe_api"></script><script>
var player,st=-1,vis=null;function post(m){window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify(m))}
function show(v){if(v!==vis){vis=v;post({visible:v})}}
function onYouTubeIframeAPIReady(){player=new YT.Player('p',{videoId:'${id}',host:'https://www.youtube-nocookie.com',
playerVars:{autoplay:1,controls:0,disablekb:1,fs:0,iv_load_policy:3,modestbranding:1,playsinline:1,rel:0,showinfo:0,cc_load_policy:0,origin:'${ORIGIN}'},
events:{onReady:function(e){${muted ? 'e.target.mute()' : 'e.target.unMute();e.target.setVolume(100)'};e.target.playVideo()},
onStateChange:function(e){st=e.data;if(st!==1)show(false);if(st===0){player.seekTo(0,true);player.playVideo()}},onError:function(e){post({error:e.data})}}})}
setInterval(function(){if(!player||!player.getCurrentTime)return;var t=player.getCurrentTime(),d=player.getDuration()||0;
if(d&&t>d-1.6){show(false);player.seekTo(0,true);player.playVideo();return}
show(st===1&&t>1.0)},200);
window.setMuted=function(m){if(!player||!player.mute)return;m?player.mute():(player.unMute(),player.setVolume(100))};
</script></body></html>`;

export default function Trailer({ id, active, muted, onPlaying }) {
  const web = useRef(null);
  const initMuted = useRef(!!muted);
  const [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const everOn = useRef(false);
  const set = (v) => { setPlaying(v); if (v) everOn.current = true; onPlaying?.(v || everOn.current); };
  useEffect(() => { web.current?.injectJavaScript(`window.setMuted(${!!muted});true;`); }, [muted]);
  useEffect(() => { if (!active) set(false); }, [active]);
  if (!id || failed || !active) return null;
  return (
    <View style={[StyleSheet.absoluteFill, { opacity: playing ? 1 : 0 }]} pointerEvents="none">
      <WebView ref={web} source={{ html: html(id, initMuted.current), baseUrl: ORIGIN }} originWhitelist={['*']}
        style={{ flex: 1, backgroundColor: '#000' }} scrollEnabled={false} bounces={false}
        allowsInlineMediaPlayback mediaPlaybackRequiresUserAction={false} allowsFullscreenVideo={false}
        javaScriptEnabled domStorageEnabled
        onMessage={(e) => {
          try {
            const m = JSON.parse(e.nativeEvent.data);
            if (m.error != null) { setFailed(true); set(false); }
            else if (m.visible != null) set(!!m.visible);
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
  mute: { position: 'absolute', bottom: 10, end: 16 },
  btn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
});
