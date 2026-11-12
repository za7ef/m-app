// "Soon": upcoming movies and series, keyless sources.
// Movies: Wikidata (films whose first release date is ahead, ranked by how many Wikipedias cover them) + Cinemeta.
// Series: TVmaze schedule (season/series premieres in the next 3 weeks, with an IMDb id) + Cinemeta.
const CM = 'https://v3-cinemeta.strem.io';
let cache = null;

async function getJSON(url, ms = 15000, headers = {}) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { Accept: 'application/json', ...headers } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } finally { clearTimeout(timer); }
}
const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (d, n) => new Date(d.getTime() + n * 86400000);

async function pool(items, n, fn) {
  const out = []; const q = items.map((x, i) => [x, i]);
  await Promise.all(Array.from({ length: n }, async () => { while (q.length) { const [x, i] = q.shift(); try { out[i] = await fn(x); } catch { out[i] = null; } } }));
  return out;
}
const meta = (type, id) => getJSON(`${CM}/meta/${type}/${id}.json`, 10000).then((j) => j?.meta || null);

async function upcomingMovies(now) {
  const from = iso(now), to = iso(addDays(now, 150)), floor = iso(addDays(now, -60));
  // next release date ahead of today, skipping films that already came out somewhere long ago (festival runs etc.)
  const q = `SELECT ?imdb (MIN(?f) AS ?date) ?links WHERE {
    ?film wdt:P31 wd:Q11424; wdt:P345 ?imdb; wdt:P577 ?f; wikibase:sitelinks ?links. FILTER(?links > 4)
    FILTER(?f >= "${from}T00:00:00Z"^^xsd:dateTime && ?f < "${to}T00:00:00Z"^^xsd:dateTime)
    FILTER NOT EXISTS { ?film wdt:P577 ?old. FILTER(?old < "${floor}T00:00:00Z"^^xsd:dateTime) }
  } GROUP BY ?imdb ?links ORDER BY DESC(?links) LIMIT 40`;
  let rows = [];
  try {
    const j = await getJSON('https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(q), 60000);
    rows = (j?.results?.bindings || []).map((b) => ({ id: b.imdb.value, date: b.date.value.slice(0, 10) }));
  } catch {}
  // Cinemeta's current-year catalog also knows a few upcoming releases.
  try {
    const c = await getJSON(`${CM}/catalog/movie/year/genre=${now.getFullYear()}.json`);
    for (const m of c?.metas || []) if ((m.released || '').slice(0, 10) > from && !rows.some((r) => r.id === m.id)) rows.push({ id: m.id, date: m.released.slice(0, 10) });
  } catch {}
  const metas = await pool(rows, 6, (r) => meta('movie', r.id));
  return rows.map((r, i) => metas[i] && { ...metas[i], type: 'movie', soonDate: ((metas[i].released || '').slice(0, 10) > from ? metas[i].released.slice(0, 10) : r.date) })
    .filter((m) => m && m.soonDate >= from && (m.poster || m.background));
}

async function upcomingSeries(now) {
  const days = Array.from({ length: 21 }, (_, i) => iso(addDays(now, i)));
  const lists = await pool(days.flatMap((d) => [`https://api.tvmaze.com/schedule?country=US&date=${d}`, `https://api.tvmaze.com/schedule/web?date=${d}`]), 6, (u) => getJSON(u));
  const seen = new Map();
  for (const l of lists) for (const e of l || []) {
    const show = e.show || e._embedded?.show; const imdb = show?.externals?.imdb;
    if (!imdb || e.number !== 1 || seen.has(imdb)) continue;
    seen.set(imdb, { id: imdb, date: e.airdate, season: e.season, weight: show.weight || 0 });
  }
  const rows = [...seen.values()].sort((a, b) => b.weight - a.weight).slice(0, 30);
  const metas = await pool(rows, 6, (r) => meta('series', r.id));
  return rows.map((r, i) => metas[i] && { ...metas[i], type: 'series', soonDate: r.date, soonSeason: r.season }).filter((m) => m && (m.poster || m.background));
}

const sortSoon = (v) => v.sort((a, b) => (a.soonDate < b.soonDate ? -1 : a.soonDate > b.soonDate ? 1 : 0));

// onPart(list) fires when the first half (movies or series) is ready, so the feed shows up sooner.
export async function loadSoon(force, onPart) {
  if (!force && cache && Date.now() - cache.t < 60 * 60 * 1000) return cache.v;
  const now = new Date();
  let got = [];
  const add = (v) => { got = sortSoon([...got, ...v]); onPart?.(got); return v; };
  await Promise.all([upcomingMovies(now).catch(() => []).then(add), upcomingSeries(now).catch(() => []).then(add)]);
  if (got.length) cache = { t: Date.now(), v: got };
  return got;
}
