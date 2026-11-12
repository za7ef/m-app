// YouTube trailer (IFrame API) with every bit of YouTube UI kept out of sight:
// - zoomed (scale) + overflow hidden, so the title bar on top and "More videos"/logo at the bottom fall outside;
// - a transparent layer on top blocks touches, so the centre pause button never appears;
// - invisible (poster shows) until PLAYING for ~1 s, hidden again on pause/buffer and before the end (then restarts).
// Mute goes through the IFrame API (enablejsapi) and is remembered by the caller.
import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, AppState } from 'react-native';
import { WebView } from 'react-native-webview';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Press, Glass } from './ui';

const ORIGIN = 'https://za7ef.github.io';
const html = (id, muted, scale) => `<!DOCTYPE html><html><head>
<link rel="preconnect" href="https://www.youtube.com"><link rel="preconnect" href="https://www.youtube-nocookie.com"><link rel="preconnect" href="https://i.ytimg.com">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<style>html,body{margin:0;padding:0;background:#000;overflow:hidden;height:100%;width:100%}
#w{position:absolute;top:50%;left:50%;width:max(100vw,177.78vh);height:max(100vh,56.25vw);transform:translate(-50%,-50%) scale(${scale})}
#p,#p iframe{width:100%;height:100%;pointer-events:none;border:0}
#c{position:fixed;top:0;left:0;right:0;bottom:0;z-index:9;background:transparent}</style></head>
<body><div id="w"><div id="p"></div></div><div id="c"></div>
<script src="https://www.youtube.com/iframe_api"></script><script>
var player,st=-1,vis=null,muted=${muted ? 'true' : 'false'};
function post(m){window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify(m))}
function show(v){if(v!==vis){vis=v;post({visible:v})}}
function applyMute(){if(!player||!player.mute)return;if(muted){player.mute()}else{player.unMute();player.setVolume(100)}}
function onYouTubeIframeAPIReady(){player=new YT.Player('p',{videoId:'${id}',host:'https://www.youtube-nocookie.com',
playerVars:{autoplay:1,mute:${muted ? 1 : 0},controls:0,disablekb:1,enablejsapi:1,fs:0,iv_load_policy:3,modestbranding:1,playsinline:1,rel:0,cc_load_policy:0,origin:'${ORIGIN}'},
events:{onReady:function(e){applyMute();e.target.playVideo()},
onStateChange:function(e){st=e.data;if(st!==1)show(false);if(st===1)applyMute();if(st===0){player.seekTo(0,true);player.playVideo()}},
onError:function(e){post({error:e.data})}}})}
setInterval(function(){if(!player||!player.getCurrentTime)return;var t=player.getCurrentTime(),d=player.getDuration()||0;
if(d&&t>d-1.6){show(false);player.seekTo(0,true);player.playVideo();return}
show(st===1&&t>1.0)},200);
window.setMuted=function(m){muted=!!m;applyMute()};
</script></body></html>`;

// true while the app is in the foreground
export function useAppActive() {
  const [on, setOn] = useState(AppState.currentState === 'active');
  useEffect(() => { const sub = AppState.addEventListener('change', (st) => setOn(st === 'active')); return () => sub.remove(); }, []);
  return on;
}

export default function Trailer({ id, active: wanted, muted, onPlaying, scale = 1.45 }) {
  // Leaving the app unloads the trailer (no sound in the background, memory back to the OS); it reloads on return.
  const appActive = useAppActive();
  const active = wanted && appActive;
  const web = useRef(null);
  const [gen, setGen] = useState(0); // bumped to rebuild the web view after the OS killed its process
  const initMuted = useRef(!!muted);
  const [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const set = (v) => { setPlaying(v); onPlaying?.(v); };
  useEffect(() => { web.current?.injectJavaScript(`window.setMuted&&window.setMuted(${!!muted});true;`); }, [muted]);
  useEffect(() => { if (!active) set(false); }, [active]);
  useEffect(() => { setFailed(false); }, [id]);
  const rebuild = () => { set(false); if (gen >= 2) setFailed(true); else setGen((g) => g + 1); }; // give up after 3 tries
  if (!id || failed || !active) return null;
  return (
    <View style={[StyleSheet.absoluteFill, { opacity: playing ? 1 : 0, overflow: 'hidden' }]} pointerEvents="none">
      <WebView key={gen} ref={web} source={{ html: html(id, initMuted.current, scale), baseUrl: ORIGIN }} originWhitelist={['*']}
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
        onError={() => { setFailed(true); set(false); }}
        // iOS / Android may kill the web content process under memory pressure: show the poster and rebuild it.
        onContentProcessDidTerminate={rebuild}
        onRenderProcessGone={rebuild} />
    </View>
  );
}

export function MuteButton({ muted, onToggle, style }) {
  return (
    <Animated.View entering={FadeIn} exiting={FadeOut} style={style}>
      <Press onPress={onToggle} hitSlop={12}>
        <Glass radius={17} interactive style={styles.btn}><Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={17} color="#fff" /></Glass>
      </Press>
    </Animated.View>
  );
}
export const trailerIdOf = (meta) => meta?.trailers?.find((x) => !x.type || /trailer/i.test(x.type))?.source || meta?.trailers?.[0]?.source
  || meta?.trailerStreams?.[0]?.ytId || null;

const styles = StyleSheet.create({
  btn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
});
