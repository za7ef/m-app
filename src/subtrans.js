// Subtitle translation into the app language, keeping every cue's timing.
// Engines: 'gemini' (the user's own API key, more natural) or 'google' (no key).
// Work is done in batches ordered around the playback position: the batch under the playhead first, then forward,
// then what's behind. focus(pos) after a seek re-orders the queue. Finished batches are cached on the device.
import AsyncStorage from '@react-native-async-storage/async-storage';

export const GEMINI_MODEL = 'gemini-2.5-flash';
const LANG_NAMES = { ar: 'Arabic (natural Modern Standard Arabic, as used in professional subtitles)', en: 'English' };
const BATCH = { gemini: 60, google: 25 };

export class TransError extends Error {
  constructor(code, msg) { super(msg || code); this.code = code; } // key | rate | network | bad
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function hashStr(s) { // small stable hash for cache keys
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

async function timedFetch(url, opts = {}, ms = 45000) {
  const ctl = new AbortController();
  const tm = setTimeout(() => ctl.abort(), ms);
  try { return await fetch(url, { ...opts, signal: ctl.signal }); }
  catch { throw new TransError('network'); }
  finally { clearTimeout(tm); }
}

// ---- Gemini ----
async function geminiBatch(texts, lang, key) {
  const input = {};
  texts.forEach((t, i) => { input[String(i + 1)] = t; });
  const prompt = `You translate movie/TV subtitles into ${LANG_NAMES[lang] || lang}.
Translate naturally, like a professional subtitler: keep the tone, slang and meaning, keep names as they are, keep it short enough to read on screen.
Input is a JSON object of numbered subtitle lines. Return ONLY a JSON object with exactly the same keys, each value the translation of that key's line.
Keep the same number of line breaks (\\n) inside each value. Never merge, split, skip or add keys.

${JSON.stringify(input)}`;
  const r = await timedFetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3, responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } },
    }),
  });
  if (r.status === 429) throw new TransError('rate');
  if (r.status === 400 || r.status === 401 || r.status === 403) {
    const body = await r.text().catch(() => '');
    if (/API_KEY|api key|PERMISSION_DENIED|UNAUTHENTICATED/i.test(body) || r.status !== 400) throw new TransError('key', body.slice(0, 160));
    throw new TransError('bad', body.slice(0, 160));
  }
  if (!r.ok) throw new TransError(r.status >= 500 ? 'rate' : 'bad', 'HTTP ' + r.status); // 5xx = overloaded: retry like a rate limit
  const j = await r.json().catch(() => null);
  const txt = j?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
  let out;
  try { out = JSON.parse(txt.replace(/^```(?:json)?\s*|\s*```$/g, '')); } catch { throw new TransError('bad', 'not JSON'); }
  return texts.map((t, i) => (typeof out[String(i + 1)] === 'string' && out[String(i + 1)].trim() ? out[String(i + 1)] : null));
}

// ---- Google Translate (no key) ----
const SEP = '\n⟦§⟧\n';
async function googleText(q, lang) {
  const r = await timedFetch('https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&dt=t&tl=' + encodeURIComponent(lang), {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' }, body: 'q=' + encodeURIComponent(q),
  }, 20000);
  if (r.status === 429) throw new TransError('rate');
  if (!r.ok) throw new TransError('bad', 'HTTP ' + r.status);
  const j = await r.json().catch(() => null);
  if (!Array.isArray(j?.[0])) throw new TransError('bad');
  return j[0].map((x) => x?.[0] || '').join('');
}
async function googleBatch(texts, lang) {
  const joined = await googleText(texts.join(SEP), lang);
  const parts = joined.split(/\s*⟦\s*§\s*⟧\s*/);
  if (parts.length === texts.length) return parts.map((p) => p.trim() || null);
  // separator got mangled: fall back to one request per line for this batch
  const out = [];
  for (const t of texts) { try { out.push((await googleText(t, lang)).trim() || null); } catch (e) { if (e.code === 'rate') throw e; out.push(null); } }
  return out;
}

// cues: [{start,end,text}], returns a controller. onUpdate(map index->text, {done,total}); onError(code) for UI.
export function createTranslator({ cues, lang, engine, apiKey, cacheId, onUpdate, onError }) {
  const size = BATCH[engine] || 25;
  const nb = Math.ceil(cues.length / size);
  const done = new Array(nb).fill(false);
  const tr = {};
  const ck = `subtr:${engine}:${lang}:${hashStr(cacheId + '|' + cues.length + '|' + (cues[0]?.text || ''))}`;
  let queue = [];
  let stopped = false;
  let running = false;
  let saveT = null;

  const progress = () => ({ done: done.filter(Boolean).length, total: nb });
  const emit = () => onUpdate && onUpdate({ ...tr }, progress());
  const save = () => {
    clearTimeout(saveT);
    saveT = setTimeout(() => AsyncStorage.setItem(ck, JSON.stringify({ tr, done })).catch(() => {}), 1500);
  };
  const order = (pos) => {
    let at = cues.findIndex((c) => c.end >= pos);
    if (at < 0) at = cues.length - 1;
    const b0 = Math.max(0, Math.floor(at / size));
    const o = [];
    for (let b = b0; b < nb; b++) o.push(b);
    for (let b = b0 - 1; b >= 0; b--) o.push(b);
    queue = o.filter((b) => !done[b]);
  };

  async function run() {
    if (running) return;
    running = true;
    let backoff = 0;
    while (!stopped && queue.length) {
      const b = queue[0];
      if (done[b]) { queue.shift(); continue; }
      const from = b * size;
      const texts = cues.slice(from, from + size).map((c) => c.text);
      try {
        const out = engine === 'gemini' ? await geminiBatch(texts, lang, apiKey) : await googleBatch(texts, lang);
        if (stopped) break;
        out.forEach((t, i) => { if (t) tr[from + i] = t; });
        done[b] = true;
        if (queue[0] === b) queue.shift();
        backoff = 0;
        onError && onError(null);
        emit(); save();
      } catch (e) {
        if (stopped) break;
        const code = e?.code || 'network';
        onError && onError(code);
        if (code === 'key') { stopped = true; break; } // nothing to retry until the key is fixed
        if (code === 'bad') { done[b] = true; queue.shift(); emit(); continue; } // skip a batch the model mangled; original text stays
        backoff = Math.min(60000, backoff ? backoff * 2 : (code === 'rate' ? 15000 : 5000));
        await sleep(backoff);
      }
    }
    running = false;
  }

  const ready = (async () => {
    try {
      const raw = await AsyncStorage.getItem(ck);
      if (raw) {
        const c = JSON.parse(raw);
        Object.assign(tr, c.tr || {});
        (c.done || []).forEach((d, i) => { if (d && i < nb) done[i] = true; });
      }
    } catch {}
    emit();
  })();

  return {
    // translate starting at this playback position (call again after a seek)
    async focus(pos) { await ready; if (stopped) return; order(pos || 0); run(); },
    // resolves when the batch that covers `pos` is translated (or after ms)
    async waitFor(pos, ms = 12000) {
      await ready;
      const at = Math.max(0, cues.findIndex((c) => c.end >= pos));
      const b = Math.floor(at / size);
      const t0 = Date.now();
      while (!stopped && !done[b] && Date.now() - t0 < ms) await sleep(250);
    },
    retry() { if (stopped) return; run(); },
    stop() { stopped = true; clearTimeout(saveT); AsyncStorage.setItem(ck, JSON.stringify({ tr, done })).catch(() => {}); },
    progress,
  };
}
