// Resolves a YouTube trailer id to a direct stream (HLS or MP4) that the native player can play, so no YouTube UI
// is ever shown. Runs on the phone (home IP), asking YouTube's own app clients. Returns null when it can't.
const CLIENTS = [
  { name: 'IOS', id: 5, version: '20.10.4', ua: 'com.google.ios.youtube/20.10.4 (iPhone16,2; U; CPU iOS 18_3_2 like Mac OS X;)',
    extra: { deviceMake: 'Apple', deviceModel: 'iPhone16,2', osName: 'iPhone', osVersion: '18.3.2.22D82' } },
  { name: 'ANDROID_VR', id: 28, version: '1.62.27', ua: 'com.google.android.apps.youtube.vr.oculus/1.62.27 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip',
    extra: { deviceMake: 'Oculus', deviceModel: 'Quest 3', androidSdkVersion: 32, osName: 'Android', osVersion: '12L' } },
];
const mem = new Map();

async function ask(c, id, ms = 7000) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
      method: 'POST', signal: ctl.signal,
      headers: { 'Content-Type': 'application/json', 'User-Agent': c.ua, 'X-YouTube-Client-Name': String(c.id), 'X-YouTube-Client-Version': c.version },
      body: JSON.stringify({ videoId: id, contentCheckOk: true, racyCheckOk: true,
        context: { client: { clientName: c.name, clientVersion: c.version, hl: 'en', gl: 'US', ...c.extra } } }),
    });
    if (!r.ok) return null;
    const j = await r.json();
    if (j?.playabilityStatus?.status !== 'OK') { console.log('[trailer]', c.name, j?.playabilityStatus?.status, j?.playabilityStatus?.reason || ''); return null; }
    const sd = j.streamingData || {};
    if (sd.hlsManifestUrl) return { uri: sd.hlsManifestUrl, headers: { 'User-Agent': c.ua } };
    // muxed MP4 (audio+video), best first
    const mux = (sd.formats || []).filter((f) => f.url && /mp4/.test(f.mimeType || '')).sort((a, b) => (b.height || 0) - (a.height || 0));
    if (mux[0]) return { uri: mux[0].url, headers: { 'User-Agent': c.ua } };
    return null;
  } catch { return null; } finally { clearTimeout(timer); }
}

export async function trailerStream(id) {
  if (!id) return null;
  const hit = mem.get(id);
  if (hit && Date.now() - hit.t < 60 * 60 * 1000) return hit.v; // signed URLs expire after a few hours
  // ask both clients at once, take the first good answer
  const v = await new Promise((resolve) => {
    let left = CLIENTS.length;
    CLIENTS.forEach((c) => ask(c, id).then((r) => { if (r) resolve(r); else if (--left === 0) resolve(null); }));
  });
  mem.set(id, { t: Date.now(), v });
  return v;
}
export const prefetchTrailer = (id) => { trailerStream(id).catch(() => {}); };
