// Builds dist/ from src/ and the channel's newest uploads. Needs Node 20+, no packages.
// If YouTube cannot be reached, the last good list in data/latest.json is used.
import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const dist = join(root, 'dist');
const dataFile = join(root, 'data', 'latest.json');
const feedUrl = 'https://www.youtube.com/feeds/videos.xml?channel_id=UCL7KqPYAqhZsvklZ08L-abQ';
const perRow = 3;

const decode = (s) =>
  s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

async function readFeed() {
  const res = await fetch(feedUrl, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`feed ${res.status}`);
  const xml = await res.text();
  const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map(([, e]) => ({
    id: e.match(/<yt:videoId>(.*?)<\/yt:videoId>/)[1],
    title: decode(e.match(/<title>(.*?)<\/title>/)[1]),
    published: e.match(/<published>(.*?)<\/published>/)[1],
    short: /youtube\.com\/shorts\//.test(e.match(/<link rel="alternate" href="(.*?)"/)[1]),
  }));
  entries.sort((a, b) => b.published.localeCompare(a.published));
  const pick = (short) => entries.filter((e) => e.short === short).slice(0, perRow).map(({ short: _, ...e }) => e);
  const latest = { films: pick(false), shorts: pick(true) };
  if (!latest.films.length) throw new Error('feed has no films');
  return latest;
}

// YouTube's own image for a video, saved next to the page so visitors never connect to a third party.
async function saveThumb(id, short) {
  const name = short ? 'oardefault' : 'maxresdefault';
  const sources = [
    [`https://i.ytimg.com/vi_webp/${id}/${name}.webp`, 'webp'],
    [`https://i.ytimg.com/vi/${id}/${name}.jpg`, 'jpg'],
    [`https://i.ytimg.com/vi/${id}/hqdefault.jpg`, 'jpg'],
  ];
  for (const [url, ext] of sources) {
    const res = await fetch(url, { signal: AbortSignal.timeout(20000) }).catch(() => null);
    if (!res?.ok) continue;
    await writeFile(join(dist, 'thumbs', `${id}.${ext}`), Buffer.from(await res.arrayBuffer()));
    return `/thumbs/${id}.${ext}`;
  }
  throw new Error(`no thumbnail for ${id}`);
}

const formatDate = (iso) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

async function card(video, short) {
  const href = short ? `https://www.youtube.com/shorts/${video.id}` : `https://www.youtube.com/watch?v=${video.id}`;
  const [w, h] = short ? [720, 1280] : [1280, 720];
  const thumb = await saveThumb(video.id, short);
  return [
    `<a class="card card--${short ? 'short' : 'film'}" href="${href}" target="_blank" rel="noopener">`,
    `<span class="card__frame"><img src="${thumb}" alt="" width="${w}" height="${h}" loading="lazy" decoding="async"></span>`,
    `<span class="card__title">${escape(video.title)}</span>`,
    `<time class="card__date" datetime="${video.published.slice(0, 10)}">${formatDate(video.published)}</time>`,
    `</a>`,
  ].join('');
}

let latest;
try {
  latest = await readFeed();
} catch (err) {
  console.warn(`Using the saved list: ${err.message}`);
  latest = JSON.parse(await readFile(dataFile, 'utf8'));
}

await rm(dist, { recursive: true, force: true });
await mkdir(join(dist, 'thumbs'), { recursive: true });
await mkdir(join(root, 'data'), { recursive: true });
await cp(join(root, 'src'), dist, { recursive: true, filter: (p) => !/[\\/]parts([\\/]|$)/.test(p) });
await writeFile(dataFile, `${JSON.stringify(latest, null, 2)}\n`);

const parts = join(root, 'src', 'parts');
const svg = async (name) => (await readFile(join(parts, `${name}.svg`), 'utf8')).trim();
const icons = {};
for (const file of await readdir(join(parts, 'icons'))) {
  icons[file.replace('.svg', '')] = (await readFile(join(parts, 'icons', file), 'utf8')).trim();
}

const films = await Promise.all(latest.films.map((v) => card(v, false)));
const shorts = await Promise.all(latest.shorts.map((v) => card(v, true)));

let html = await readFile(join(root, 'src', 'index.html'), 'utf8');
html = html
  .replaceAll('{{wordmark}}', await svg('wordmark'))
  .replaceAll('{{arrow}}', await svg('arrow'))
  .replaceAll('{{year}}', String(new Date().getUTCFullYear()))
  .replace(/\{\{icon:(\w+)\}\}/g, (_, name) => icons[name])
  .replace('{{films}}', films.join('\n      '))
  .replace('{{shorts}}', shorts.join('\n      '));
await writeFile(join(dist, 'index.html'), html);
await writeFile(join(dist, 'CNAME'), 'ohmhytte.com\n');

console.log(`Built ${films.length} films and ${shorts.length} shorts.`);
