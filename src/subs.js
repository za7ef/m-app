const CP1256 = "€پ‚ƒ„…†‡ˆ‰ٹ‹Œچژڈگ‘’“”•–—ک™ڑ›œ‌‍ں ،¢£¤¥¦§¨©ھ«¬­®¯°±²³´µ¶·¸¹؛»¼½¾؟ہءآأؤإئابةتثجحخدذرزسشصض×طظعغـفقكàلâمنهوçèéêëىيîïًٌٍَôُِ÷ّùْûü‎‏ے";

function decodeUtf8Strict(b) {
  let out = '', i = 0;
  if (b[0] === 0xEF && b[1] === 0xBB && b[2] === 0xBF) i = 3;
  while (i < b.length) {
    const c = b[i];
    let cp, n;
    if (c < 0x80) { cp = c; n = 0; }
    else if ((c & 0xE0) === 0xC0) { cp = c & 0x1F; n = 1; }
    else if ((c & 0xF0) === 0xE0) { cp = c & 0x0F; n = 2; }
    else if ((c & 0xF8) === 0xF0) { cp = c & 0x07; n = 3; }
    else return null;
    if (i + n >= b.length + (n ? 0 : 1)) return null;
    for (let k = 1; k <= n; k++) {
      const d = b[i + k];
      if (d === undefined || (d & 0xC0) !== 0x80) return null;
      cp = (cp << 6) | (d & 0x3F);
    }
    if (cp > 0x10FFFF || (cp >= 0xD800 && cp <= 0xDFFF)) return null; // not valid UTF-8 -> try the Arabic codepage
    out += String.fromCodePoint(cp);
    i += n + 1;
  }
  return out;
}

export function decodeSubBytes(b) {
  const u = decodeUtf8Strict(b);
  if (u !== null) return u;
  let out = '';
  for (let i = 0; i < b.length; i++) out += b[i] < 128 ? String.fromCharCode(b[i]) : CP1256[b[i] - 128];
  return out; // Windows-1256 (common for Arabic subtitles)
}

function toSec(t) {
  const m = t.trim().replace(',', '.').split(':');
  let s = 0;
  for (const p of m) s = s * 60 + parseFloat(p);
  return s;
}

export function parseSubs(text) {
  const lines = text.replace(/\r/g, '').split('\n');
  const cues = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/((?:\d+:)?\d+:\d+[.,]\d+)\s*-->\s*((?:\d+:)?\d+:\d+[.,]\d+)/);
    if (!m) continue;
    const buf = [];
    i++;
    while (i < lines.length && lines[i].trim() !== '') { buf.push(lines[i]); i++; }
    const txt = buf.join('\n').replace(/<[^>]+>/g, '').replace(/\{[^}]*\}/g, '').trim();
    if (txt) cues.push({ start: toSec(m[1]), end: toSec(m[2]), text: txt });
  }
  return cues;
}

export async function readBytes(uri, ms = 15000) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(uri, { signal: ctl.signal });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const buf = await r.arrayBuffer();
    if (buf.byteLength > 5 * 1024 * 1024) throw new Error('subtitle file too large');
    return new Uint8Array(buf);
  } finally { clearTimeout(timer); }
}



export async function loadSubs(url) {
  const b = await readBytes(url);
  return parseSubs(decodeSubBytes(b)).filter((c) => !/opensubtitles|osdb\.link|www\./i.test(c.text));
}
