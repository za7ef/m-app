// Localized title + overview for the app language, without an API key:
// Wikidata (IMDb id → label + Wikipedia article) → Wikipedia summary in that language.
import { getLang } from './i18n';

const mem = new Map();
async function getJSON(url, ms = 9000, headers = {}) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { Accept: 'application/json', ...headers } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } finally { clearTimeout(timer); }
}

export async function localizeMeta(meta, lang = getLang()) {
  const imdb = (meta?.imdb_id || meta?.id || '').match(/^tt\d+/)?.[0];
  if (!imdb || !lang || lang === 'en') return null;
  const key = imdb + ':' + lang;
  if (mem.has(key)) return mem.get(key);
  let out = null;
  try {
    const q = `SELECT ?label ?art WHERE { ?item wdt:P345 "${imdb}". OPTIONAL{?item rdfs:label ?label FILTER(lang(?label)="${lang}")} OPTIONAL{?art schema:about ?item; schema:isPartOf <https://${lang}.wikipedia.org/>} } LIMIT 1`;
    const j = await getJSON('https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(q));
    const b = j?.results?.bindings?.[0] || {};
    const name = b.label?.value || null;
    let description = null;
    const art = b.art?.value;
    if (art) {
      const title = art.split('/wiki/')[1];
      try {
        const s = await getJSON(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${title}`);
        if (s?.extract && s.type !== 'disambiguation') description = s.extract.trim();
      } catch {}
    }
    if (name || description) out = { name, description };
  } catch { return null; } // network error: don't cache, try again next time
  mem.set(key, out);
  if (mem.size > 200) mem.delete(mem.keys().next().value);
  return out;
}

// Machine translation fallback (keyless Google endpoint) for text with no localized source, e.g. episode titles.
const tmem = new Map();
export async function translate(text, lang = getLang()) {
  if (!text || !lang || lang === 'en') return text;
  const key = lang + '|' + text;
  if (tmem.has(key)) return tmem.get(key);
  const j = await getJSON(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${lang}&dt=t&q=${encodeURIComponent(text.slice(0, 1800))}`, 10000);
  const out = (j?.[0] || []).map((x) => x?.[0] || '').join('').trim() || text;
  tmem.set(key, out);
  if (tmem.size > 2000) tmem.delete(tmem.keys().next().value);
  return out;
}

// Translates episode names/overviews of one season, a few at a time. Returns { [videoId]: { name, overview } }.
export async function localizeEpisodes(eps, lang = getLang(), onPart) {
  if (!lang || lang === 'en') return {};
  const out = {};
  const queue = [...eps];
  const worker = async () => {
    while (queue.length) {
      const v = queue.shift();
      const name = v.name || v.title, ov = v.overview || v.description;
      try {
        const [n, o] = await Promise.all([name ? translate(name, lang) : null, ov ? translate(ov, lang) : null]);
        out[v.id] = { name: n, overview: o };
        onPart?.({ ...out });
      } catch {}
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  return out;
}
