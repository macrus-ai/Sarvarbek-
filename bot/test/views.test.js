// Bloger ko'rsatkichlari: Instagramda reels, postlar, istoriya, qamrov (30 kun); boshqa platformalarda bitta
import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import worker from '../src/index.js';
import {
  ORIGIN, api, createCampaign, createEnv, fakeTelegram, press, registerBlogger, registerBusiness, say, shareContact,
  tgUser
} from './helpers.js';

// createEnv() da ADMIN_IDS = '999'
const ADMIN = 999;
let tg;
let env;
beforeEach(() => {
  tg = fakeTelegram();
  env = createEnv();
});
afterEach(() => tg.restore());

const lastText = (chatId) => tg.sent(chatId).at(-1)?.body.text ?? '';

async function login() {
  await say(env, tgUser(ADMIN), '/admin');
  const url = tg.sent(ADMIN).at(-1).body.reply_markup.inline_keyboard[0][0].url;
  const res = await worker.fetch(new Request(url), env);
  return res.headers.get('set-cookie').split(';')[0];
}

async function adminUser(cookie, id) {
  const res = await worker.fetch(
    new Request(`${ORIGIN}/api/admin/users/${id}`, { headers: { cookie, 'x-ovoza-admin': '1' } }),
    env
  );
  return (await res.json()).user;
}

const views = (u) => u.views.map((v) => [v.label, v.value]);

// Telegram yoki TikTok blogeri: o'rtacha ko'rishlar bitta savol
async function registerOther(user, platform, profile, { lang = 'uz', approve = true } = {}) {
  await say(env, user, '/start');
  await press(env, user, `lang:${lang}`);
  await press(env, user, 'role:blogger');
  await say(env, user, 'Kamola');
  await press(env, user, `plat:${platform}`);
  await say(env, user, profile);
  await press(env, user, 'fol:5000-10000');
  await press(env, user, 'rch:1000-3000');
  await press(env, user, 'stats:skip');
  await press(env, user, 'niche:news');
  await press(env, user, 'rgn:bukhara');
  await shareContact(env, user, '+998935556677');
  if (approve) await press(env, tgUser(ADMIN), `mod:a:${user.id}`);
}

test('admin panel: Instagram blogerining to‘rtta ko‘rsatkichi tartib bilan', async () => {
  await registerBlogger(env, tgUser(1700), { approve: false });
  const u = await adminUser(await login(), 1700);
  assert.deepEqual(views(u), [
    ['Reels (o‘rtacha)', '5 000 – 20 000'],
    ['Postlar (o‘rtacha)', '3 000 – 10 000'],
    ['Istoriya (o‘rtacha)', '1 000 – 3 000'],
    ['Qamrov (30 kun)', '20 000 – 100 000']
  ]);
  assert.equal(u.reels, undefined);
});

test('eski Instagram blogeri: yangi maydonlar "kiritilmagan", eski "Reels va postlar (eski)"', async () => {
  const old = tgUser(1710);
  await registerBlogger(env, old, { approve: false });
  // Yangilanishdan oldingi profil: faqat storis (reach) va birlashgan reels_reach
  await env.DB.prepare(
    `UPDATE users SET reach = '0-500', reels_reach = '1000-5000', reels_views = NULL, posts_views = NULL,
       accounts_reached = NULL WHERE tg_id = ?1`
  ).bind(1710).run();

  const u = await adminUser(await login(), 1710);
  assert.deepEqual(views(u), [
    ['Reels (o‘rtacha)', null],
    ['Postlar (o‘rtacha)', null],
    ['Istoriya (o‘rtacha)', '500 gacha'],
    ['Qamrov (30 kun)', null],
    ['Reels va postlar (eski)', '1 000 – 5 000']
  ]);

  // Moderatsiya kartasi (/moderatsiya): kiritilmaganlari ham ko'rinadi. Blogerga hech narsa yuborilmaydi.
  tg.clear();
  await say(env, tgUser(ADMIN), '/moderatsiya');
  const card = tg.sent(ADMIN).map((c) => c.body.text || '').find((t) => /#Yangi_bloger/.test(t));
  assert.match(
    card,
    /Reels \(o‘rtacha\): kiritilmagan\n.*Postlar \(o‘rtacha\): kiritilmagan\n.*Istoriya \(o‘rtacha\): 500 gacha\n.*Qamrov \(30 kun\): kiritilmagan\n.*Reels va postlar \(eski\): 1\s000 – 5\s000/
  );
  assert.equal(tg.sent(1710).length, 0);

  // Bizneslarga faqat kiritilganlari va eski qator ko'rinadi
  await press(env, tgUser(ADMIN), 'mod:a:1710');
  const business = tgUser(1711);
  await registerBusiness(env, business);
  const { data } = await createCampaign(env, business, { minFollowers: 0 });
  tg.clear();
  await api(env, old, `/api/campaigns/${data.campaign.id}/apply`, { method: 'POST', body: {} });
  const note = lastText(1711);
  assert.match(note, /Istoriya \(o‘rtacha\): 500 gacha\n.*Reels va postlar \(eski\): 1\s000 – 5\s000/);
  assert.doesNotMatch(note, /kiritilmagan|Qamrov|Postlar/);

  // Bloger yangi savollarga javob bersa, eski qator ko'rinmaydi (eski qiymat bazada qoladi)
  await press(env, old, 'reg:restart');
  await press(env, old, 'role:blogger');
  await say(env, old, 'Dilnoza');
  await press(env, old, 'plat:Instagram');
  await say(env, old, '@dilnoza.blog');
  await press(env, old, 'fol:10000-50000');
  await press(env, old, 'rls:20000-100000');
  await press(env, old, 'pst:1000-3000');
  await press(env, old, 'rch:500-1000');
  await press(env, old, 'acc:0-5000');
  await press(env, old, 'stats:skip');
  await press(env, old, 'niche:beauty');
  await press(env, old, 'rgn:tashkent_city');
  await shareContact(env, old, '+998935556677');
  assert.match(lastText(ADMIN), /#Profil_yangilandi/);
  assert.match(lastText(ADMIN), /Qamrov \(30 kun\): 5\s000 gacha/);
  assert.doesNotMatch(lastText(ADMIN), /eski|kiritilmagan/);
  const row = await env.DB.prepare('SELECT reels_reach FROM users WHERE tg_id = ?1').bind(1710).first();
  assert.equal(row.reels_reach, '1000-5000');
});

test('Telegram blogeri: bitta "Postlar (o‘rtacha)", TikTok — "Videolar (o‘rtacha)"', async () => {
  const channel = tgUser(1720);
  await registerOther(channel, 'Telegram', '@kamola_news', { approve: false });
  const card = tg.sent(ADMIN).map((c) => c.body.text || '').find((t) => /#Yangi_bloger/.test(t));
  assert.match(card, /👁 Postlar \(o‘rtacha\): 1\s000 – 3\s000/);
  assert.doesNotMatch(card, /Reels|Istoriya|Qamrov|kiritilmagan/);

  const tiktok = tgUser(1721);
  await registerOther(tiktok, 'TikTok', '@kamola_tt', { approve: false });
  const cookie = await login();
  assert.deepEqual(views(await adminUser(cookie, 1720)), [['Postlar (o‘rtacha)', '1 000 – 3 000']]);
  assert.deepEqual(views(await adminUser(cookie, 1721)), [['Videolar (o‘rtacha)', '1 000 – 3 000']]);

  // Bunday blogerga Instagram savollari berilmaydi
  const asked = tg.sent(1720).map((c) => c.body.text || '').join('\n');
  assert.doesNotMatch(asked, /Reels|Istoriya|Qamrov/);
  assert.match(asked, /Postlaringiz o‘rtacha nechta ko‘rish/);
});

test('ruscha: Instagram savollari va ko‘rsatkichlar nomi', async () => {
  const user = tgUser(1730, { language_code: 'ru' });
  await say(env, user, '/start');
  await press(env, user, 'lang:ru');
  await press(env, user, 'role:blogger');
  await say(env, user, 'Мадина');
  await press(env, user, 'plat:Instagram');
  await say(env, user, '@madina');
  await press(env, user, 'fol:5000-10000');
  assert.match(lastText(1730), /просмотров набирают ваши reels\?/);
  await press(env, user, 'rls:1000-5000');
  assert.match(lastText(1730), /ваши посты \(фото и карусели\)/);
  await press(env, user, 'pst:500-1000');
  assert.match(lastText(1730), /ваши сторис/);
  await press(env, user, 'rch:0-500');
  assert.match(lastText(1730), /Охват: сколько аккаунтов/);
  assert.match(lastText(1730), /Охваченные аккаунты/);
  const buttons = tg.last('sendMessage').body.reply_markup.inline_keyboard.flat();
  assert.equal(buttons[0].text, 'до 5 000');
  await press(env, user, 'acc:1000000+');
  await press(env, user, 'stats:skip');
  await press(env, user, 'niche:beauty');
  await press(env, user, 'rgn:samarkand');
  await shareContact(env, user, '+998935556677');
  assert.match(
    lastText(1730),
    /Reels \(в среднем\): 1\s000 – 5\s000\n.*Посты \(в среднем\): 500 – 1\s000\n.*Сторис \(в среднем\): до 500\n.*Охват за 30 дней: 1\s000\s000\+/
  );
});
