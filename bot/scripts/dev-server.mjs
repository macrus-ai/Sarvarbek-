// Lokal sinov serveri: bot Worker'i (soxta Telegram va xotiradagi baza bilan), mini ilova va sayt bitta manzilda.
//
//   node scripts/dev-server.mjs [port]      (standart: 8787)
//
//   http://localhost:8787/            — sayt (repo ildizi), "Real keyslar" shu serverdan oladi
//   http://localhost:8787/keyslar.html
//   http://localhost:8787/app/?as=200 — mini ilova shu foydalanuvchi nomidan (Telegram'siz)
//                                       100, 101 — biznes; 200, 201, 202 — bloger
//
// Namuna ma'lumotlar: 2 biznes, 3 bloger, e'lonlar, tasdiqlangan va kutilayotgan natijalar.
// Haqiqiy Telegram'ga hech narsa yuborilmaydi (fetch soxta).

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import worker from '../src/index.js';
import {
  api, createCampaign, createEnv, fakeTelegram, registerBlogger, registerBusiness, signInitData, tgUser
} from '../test/helpers.js';

const PORT = Number(process.argv[2]) || 8787;
const SITE = fileURLToPath(new URL('../../', import.meta.url));
const APP = fileURLToPath(new URL('../public/', import.meta.url));
const ORIGIN = `http://localhost:${PORT}`;

fakeTelegram();
const env = createEnv({
  ASSETS: { fetch: async () => new Response('not found', { status: 404 }) }
});

/* ---------- Namuna ma'lumotlar ---------- */
const users = {
  100: tgUser(100, { first_name: 'Aziz', username: 'shavi_coffee' }),
  101: tgUser(101, { first_name: 'Malika' }),
  200: tgUser(200, { first_name: 'Dilnoza', username: 'dilnoza' }),
  201: tgUser(201, { first_name: 'Jasur' }),
  202: tgUser(202, { first_name: 'Sevara', language_code: 'ru' })
};

async function seed() {
  await registerBusiness(env, users[100], { company: 'Shavi Coffee', category: 'cafe' });
  await registerBusiness(env, users[101], { company: 'Gulnoza Beauty Studio', category: 'beauty' });
  await registerBlogger(env, users[200], { stats: true });
  await registerBlogger(env, users[201], { followers: '5000-10000' });
  await registerBlogger(env, users[202], { followers: '50000-100000', lang: 'ru' });
  // Bloger ismlari va profillari har xil bo'lsin
  await env.DB.prepare("UPDATE users SET name = 'Jasur Karimov', profile = 'jasur.eats' WHERE tg_id = 201").run();
  await env.DB.prepare("UPDATE users SET name = 'Sevara Aliyeva', profile = 'sevara.life' WHERE tg_id = 202").run();

  const c1 = (await createCampaign(env, users[100], {
    title: 'Ikki kishilik nonushta', category: 'cafe', value: 160000, format: '1 Reels + 2 Stories', slots: 3,
    region: 'tashkent_city', city: 'Chilonzor', minFollowers: 0
  })).data.campaign;
  const c2 = (await createCampaign(env, users[100], {
    title: 'Yangi qahva menyusi tatimi', category: 'cafe', value: 90000, format: '3 ta Stories', slots: 5,
    region: 'tashkent_city', minFollowers: 0
  })).data.campaign;
  const c3 = (await createCampaign(env, users[101], {
    title: 'Soch turmagi va parvarish', category: 'beauty', value: 300000, format: '1 Reels', slots: 2,
    region: 'samarkand', minFollowers: 0
  })).data.campaign;

  const apply = async (who, c) =>
    (await api(env, users[who], `/api/campaigns/${c.id}/apply`, { method: 'POST', body: { message: 'Salom! Qiziqaman.' } })).data.application.id;
  const accept = (biz, id) => api(env, users[biz], `/api/applications/${id}/decision`, { method: 'POST', body: { decision: 'accept' } });
  const result = (who, id, body) => api(env, users[who], `/api/applications/${id}/result`, { method: 'POST', body });
  const confirm = (biz, id, review, rating) =>
    api(env, users[biz], `/api/applications/${id}/result/decision`, { method: 'POST', body: { decision: 'confirm', review, rating } });

  // Shavi Coffee: nonushta — 2 bloger tasdiqlangan
  const a1 = await apply(200, c1);
  await accept(100, a1);
  await result(200, a1, { postUrl: 'https://www.instagram.com/reel/C0ffee01/', views: 18400, note: 'Reels + 2 Stories, kafeda suratga oldim' });
  await confirm(100, a1, 'Video juda iliq chiqdi, keyingi hafta 25 ta yangi mehmon “Dilnozadan ko‘rdik” dedi.', 5);
  const a2 = await apply(201, c1);
  await accept(100, a2);
  await result(201, a2, { postUrl: 'https://www.instagram.com/reel/C0ffee02/', views: 6200 });
  await confirm(100, a2, null, 4);
  // Shavi Coffee: qahva menyusi — Sevara natija yuborgan, biznes hali tekshirmagan; Dilnoza qabul qilingan, natija yo'q
  const a3 = await apply(202, c2);
  await accept(100, a3);
  await result(202, a3, { postUrl: 'https://www.instagram.com/stories/sevara.life/1/', views: 9100, note: '3 ta Stories joylandi' });
  const a4 = await apply(200, c2);
  await accept(100, a4);
  // Gulnoza: Sevara tasdiqlangan
  const a5 = await apply(202, c3);
  await accept(101, a5);
  await result(202, a5, { postUrl: 'https://www.instagram.com/reel/Beauty01/', views: 41000 });
  await confirm(101, a5, 'Samarqanddan 12 ta yozilish bo‘ldi. Rahmat!', 5);
  // Jasur Gulnozaga so'rov yuborgan (kutilmoqda)
  await apply(201, c3);
}

await seed();
console.log('seed: ok');

/* ---------- Server ---------- */
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json' };

// Telegram WebApp o'rniga stub: initData shu foydalanuvchi uchun imzolanadi
const stub = (user) => `<script>
window.Telegram = { WebApp: {
  initData: ${JSON.stringify(signInitData(user))},
  initDataUnsafe: { user: ${JSON.stringify(user)} },
  version: '7.10', colorScheme: matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
  isVersionAtLeast: () => false, ready() {}, expand() {}, close() { location.reload(); }, onEvent() {},
  setHeaderColor() {}, setBackgroundColor() {}, disableVerticalSwipes() {},
  showConfirm(m, cb) { cb(confirm(m)); }, openLink(u) { window.open(u, '_blank'); }, openTelegramLink(u) { window.open(u, '_blank'); },
  HapticFeedback: { notificationOccurred() {} }
} };
</script>`;

async function sendFile(res, base, rel) {
  const path = normalize(join(base, rel));
  if (!path.startsWith(normalize(base))) return res.writeHead(403).end();
  try {
    let body = await readFile(path);
    if (rel.endsWith('assets/js/config.js')) {
      body = Buffer.from(String(body).replace(/apiBase: '[^']*'/, `apiBase: '${ORIGIN}'`));
    }
    res.writeHead(200, { 'content-type': TYPES[extname(path)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
}

createServer(async (req, res) => {
  const url = new URL(req.url, ORIGIN);
  const p = url.pathname;
  try {
    // Mini ilova
    if (p === '/app' || p === '/app/') {
      const user = users[url.searchParams.get('as')] || users[200];
      const html = String(await readFile(join(APP, 'index.html')))
        .replace('<script src="https://telegram.org/js/telegram-web-app.js"></script>', stub(user))
        .replace('href="app.css"', 'href="/app/app.css"').replace('src="app.js"', 'src="/app/app.js"').replace('href="favicon.svg"', 'href="/app/favicon.svg"');
      res.writeHead(200, { 'content-type': TYPES['.html'], 'cache-control': 'no-store' });
      return res.end(html);
    }
    if (p.startsWith('/app/')) return sendFile(res, APP, p.slice(5));
    // Worker: API, ochiq keyslar, rasmlar
    if (p.startsWith('/api/') || p.startsWith('/public/') || p.startsWith('/img/')) {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const body = chunks.length && req.method !== 'GET' && req.method !== 'HEAD' ? Buffer.concat(chunks) : undefined;
      const r = await worker.fetch(new Request(url, { method: req.method, headers: req.headers, body }), env, { waitUntil() {} });
      const headers = Object.fromEntries(r.headers);
      res.writeHead(r.status, headers);
      return res.end(Buffer.from(await r.arrayBuffer()));
    }
    // Sayt
    return sendFile(res, SITE, p === '/' ? 'index.html' : p.slice(1));
  } catch (e) {
    console.error(e);
    res.writeHead(500).end('error');
  }
}).listen(PORT, () => console.log(`dev server: ${ORIGIN}`));
