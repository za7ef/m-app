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
