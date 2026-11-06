import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { sheetsKey } from '../src/sheets.js';
import { TOKEN, createEnv, fakeTelegram, press, registerBlogger, registerBusiness, say, shareContact, tgUser } from './helpers.js';

const SHEETS_URL = 'https://script.google.com/macros/s/TEST/exec';

let tg;
let env;
let posts;
let sheetsStatus;
beforeEach(() => {
  tg = fakeTelegram();
  // Apps Script web app'ga yuborilgan so'rovlarni yozib oladi (qolganlari soxta Telegramga)
  posts = [];
  sheetsStatus = 200;
  const telegramFetch = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    if (String(input) !== SHEETS_URL) return telegramFetch(input, init);
    if (sheetsStatus === 'network') throw new TypeError('fetch failed');
    posts.push(JSON.parse(init.body));
    return new Response('ok', { status: sheetsStatus });
  };
  env = createEnv({ SHEETS_URL });
});
afterEach(() => tg.restore());

test('yangi bloger jadvalning "Blogerlar" varag‘iga yoziladi', async () => {
  await registerBlogger(env, tgUser(1700, { username: 'dilnoza_tg' }), { approve: false });

  assert.equal(posts.length, 1);
  const [post] = posts;
  assert.equal(post.key, await sheetsKey(TOKEN));
  assert.equal(post.key.length, 48);
  assert.equal(post.sheet, 'Blogerlar');
  assert.equal(post.row['Nomi (@handle)'], 'Dilnoza (@dilnoza.blog)');
  assert.equal(post.row.Platforma, 'Instagram');
  assert.equal(post.row.Havola, 'https://instagram.com/dilnoza.blog');
  assert.match(post.row.Obunachilar, /10\s000 – 50\s000/);
  assert.match(post.row.Engagement, /Reels \(o‘rtacha\): 5\s000 – 20\s000/);
  assert.equal(post.row['Ochiq aloqa'], '+998 93 555 66 77; @dilnoza_tg');
  assert.equal(post.row.Manba, 'Telegram bot');
  assert.equal(post.row.Izoh, 'Telegram ID: 1700');
  assert.ok(post.row.Soha);
  assert.ok(post.row.Shahar);
  // Sana va Holat ni jadval (Apps Script) o'zi qo'yadi
  assert.equal(post.row.Holat, undefined);
});

test('yangi biznes "Brendlar" varag‘iga yoziladi', async () => {
  await registerBusiness(env, tgUser(1710), { company: 'Zaytun osh markazi' });

  assert.equal(posts.length, 1);
  assert.equal(posts[0].sheet, 'Brendlar');
  assert.deepEqual(posts[0].row, {
    Nomi: 'Zaytun osh markazi',
    Soha: posts[0].row.Soha,
    Aloqa: 'Aziz; +998 90 111 22 33',
    Manba: 'Telegram bot',
    Izoh: 'Telegram ID: 1710'
  });
  assert.ok(posts[0].row.Soha);
});

test('profilni qayta tahrirlash jadvalga yangi qator qo‘shmaydi', async () => {
  const blogger = tgUser(1720);
  await registerBlogger(env, blogger, { approve: false });
  assert.equal(posts.length, 1);

  // Moderatsiyadagi bloger "Ma'lumotlarni o'zgartirish" ni bosib, qaytadan to'ldiradi
  await press(env, blogger, 'reg:restart');
  await press(env, blogger, 'role:blogger');
  await say(env, blogger, 'Dilnoza');
  await press(env, blogger, 'plat:TikTok');
  await say(env, blogger, '@dilnoza');
  await press(env, blogger, 'fol:10000-50000');
  await press(env, blogger, 'rch:1000-3000');
  await press(env, blogger, 'stats:skip');
  await press(env, blogger, 'niche:beauty');
  await press(env, blogger, 'rgn:tashkent_city');
  await shareContact(env, blogger, '+998935556677');
  // Ro'yxatdan o'tish oxirigacha yetdi: jamoaga "qayta yuborildi" kartasi bordi
  assert.match(tg.sent(999).at(-1).body.text, /qayta yuborildi/);

  assert.equal(posts.length, 1);
});

test('jadval ishlamasa ham ro‘yxatdan o‘tish tugaydi', async () => {
  sheetsStatus = 500;
  await registerBusiness(env, tgUser(1730), { approve: false });
  assert.equal(posts.length, 1);
  assert.match(tg.sent(1730).at(-1).body.text, /Moderatsiya/i);

  sheetsStatus = 'network';
  await registerBlogger(env, tgUser(1731), { approve: false });
  assert.match(tg.sent(1731).at(-1).body.text, /Moderatsiya/i);
});

test('SHEETS_URL sozlanmagan bo‘lsa, jadvalga hech narsa yuborilmaydi', async () => {
  env = createEnv();
  await registerBusiness(env, tgUser(1740));
  assert.equal(posts.length, 0);
});

test('Cloudflare’da jadvalga yozish fonda (waitUntil) bajariladi', async () => {
  const { addToSheet } = await import('../src/sheets.js');
  const waited = [];
  const ctx = { env, exec: { waitUntil: (p) => waited.push(p) } };
  const user = { tg_id: 1750, role: 'business', company: 'Kafe', name: 'Ali', phone: '998901234567', category: 'food' };

  await addToSheet(ctx, user);
  assert.equal(waited.length, 1);
  await waited[0];
  assert.equal(posts.length, 1);
  assert.equal(posts[0].row.Nomi, 'Kafe');
});
