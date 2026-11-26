// Yangi tasdiqlangan blogerga hozir ochiq mos e'lonlar haqida xabar (services.js dagi sendOpenAds)
import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import {
  ORIGIN, api, createCampaign, createEnv, fakeTelegram, registerBlogger, registerBusiness, runCron, tgUser
} from './helpers.js';

let tg;
let env;
beforeEach(() => {
  tg = fakeTelegram();
  env = createEnv();
});
afterEach(() => tg.restore());

const OPEN = /Sizga mos ochiq reklama e’lonlari|Открытые подходящие вам объявления/;
const NEW = /Sizga mos yangi reklama e’loni/;
const msgs = (chatId, re) =>
  tg.calls.filter(
    (c) =>
      (c.method === 'sendMessage' || c.method === 'sendPhoto') &&
      Number(c.body.chat_id) === chatId &&
      re.test(c.body.text || c.body.caption || '')
  );

const business = tgUser(100);

// E'lon joylanadi va uning "yangi e'lon" xabarlari tugaydi (hali bloger yo'q)
async function postAd(overrides = {}) {
  const { data } = await createCampaign(env, business, overrides);
  await runCron(env);
  return data.campaign.id;
}

test('tasdiqlangan yangi blogerga ochiq mos e’lonlar ro‘yxati boradi', async () => {
  await registerBusiness(env, business);
  const id = await postAd({ title: 'Tabiiy yuz kremi', region: 'all' });
  await postAd({ title: 'Samarqanddagi kafe', region: 'samarkand' }); // boshqa hudud
  await postAd({ title: 'Katta brend', minFollowers: 100000 }); // obunachilar yetmaydi
  await postAd({ title: 'Telegram uchun', platforms: ['Telegram'] }); // boshqa platforma

  await registerBlogger(env, tgUser(201)); // Toshkent shahri, Instagram, 10 000 – 50 000
  const [m] = msgs(201, OPEN);
  assert.ok(m, 'ochiq e’lonlar xabari bordi');
  assert.match(m.body.text, /1 ta/);
  assert.match(m.body.text, /«Tabiiy yuz kremi»/);
  assert.match(m.body.text, /180\s000 so‘m/);
  assert.doesNotMatch(m.body.text, /Samarqanddagi|Katta brend|Telegram uchun/);
  const buttons = m.body.reply_markup.inline_keyboard.flat();
  assert.equal(buttons[0].web_app.url, `${ORIGIN}/?c=${id}`);
  assert.equal(buttons.at(-1).callback_data, 'ntf:off');
  assert.equal(msgs(201, OPEN).length, 1, 'faqat bitta xabar');
});

test('mos ochiq e’lon bo‘lmasa, xabar bormaydi; yopilgan e’lon chiqmaydi', async () => {
  await registerBusiness(env, business);
  const id = await postAd();
  await api(env, business, `/api/campaigns/${id}`, { method: 'PATCH', body: { status: 'closed' } });
  await registerBlogger(env, tgUser(201));
  assert.equal(msgs(201, OPEN).length, 0);
});

test('5 tadan ko‘p bo‘lsa — 5 tasi ro‘yxatda va "Barcha e’lonlar" tugmasi', async () => {
  await registerBusiness(env, business);
  for (let i = 1; i <= 7; i++) await postAd({ title: `E’lon ${i}` });
  await registerBlogger(env, tgUser(201));
  const [m] = msgs(201, OPEN);
  assert.match(m.body.text, /7 ta/);
  assert.match(m.body.text, /yana 2 ta/);
  assert.match(m.body.text, /«E’lon 7»/, 'eng yangisi birinchi');
  assert.doesNotMatch(m.body.text, /«E’lon 1»/);
  const rows = m.body.reply_markup.inline_keyboard;
  assert.equal(rows.length, 7); // 5 e'lon + barcha e'lonlar + o'chirish
  assert.equal(rows[5][0].web_app.url, `${ORIGIN}/`);
});

test('navbati hali tugamagan e’lon ikki marta kelmaydi: uni cron yuboradi', async () => {
  await registerBusiness(env, business);
  await createCampaign(env, business); // cron hali ishlamadi
  await registerBlogger(env, tgUser(201));
  assert.equal(msgs(201, OPEN).length, 0);
  await runCron(env);
  assert.equal(msgs(201, NEW).length, 1);
});

test('ruscha bloger ruscha xabar oladi', async () => {
  await registerBusiness(env, business);
  await postAd();
  await registerBlogger(env, tgUser(204, { language_code: 'ru' }), { lang: 'ru' });
  const [m] = msgs(204, OPEN);
  assert.match(m.body.text, /Открытые подходящие вам объявления: 1/);
});

test('biznes tasdiqlanganda bunday xabar bormaydi', async () => {
  await registerBusiness(env, business);
  await postAd();
  await registerBusiness(env, tgUser(101), { company: 'Boshqa' });
  assert.equal(msgs(101, OPEN).length, 0);
});
