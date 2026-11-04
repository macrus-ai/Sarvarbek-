// Yangi reklama e'loni haqida mos blogerlarga xabar (src/broadcast.js, cron orqali)
import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import worker from '../src/index.js';
import { webhookSecret } from '../src/telegram.js';
import {
  JPEG, ORIGIN, TOKEN, api, createCampaign, createEnv, fakeTelegram, press, putImage, registerBlogger, registerBusiness,
  runCron, say, tgUser
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

const NOTICE = /Sizga mos yangi reklama e’loni|Новое подходящее вам объявление/;
// Blogerga "yangi e'lon" xabarini yuborishga urinishlar (Telegram xato qaytarganlari ham)
const adNotices = (chatId) =>
  tg.calls.filter(
    (c) =>
      (c.method === 'sendMessage' || c.method === 'sendPhoto') &&
      Number(c.body.chat_id) === chatId &&
      NOTICE.test(c.body.text || c.body.caption || '')
  );
const notifyAds = (id) => env.DB.prepare('SELECT notify_ads FROM users WHERE tg_id = ?1').bind(id).first('notify_ads');
const broadcast = () => env.DB.prepare('SELECT * FROM ad_broadcasts ORDER BY campaign_id DESC').first();

const business = tgUser(100);

test('tasdiqlangan e’lon mos blogerlarga cron orqali boradi, mos kelmaganlarga bormaydi', async () => {
  await registerBusiness(env, business);
  await registerBlogger(env, tgUser(201)); // Toshkent shahri, 10 000 – 50 000
  await registerBlogger(env, tgUser(202), { region: 'samarkand' });
  await registerBlogger(env, tgUser(203), { followers: '1000-5000' });
  await registerBlogger(env, tgUser(204, { language_code: 'ru' }), { lang: 'ru' });
  const { data } = await createCampaign(env, business, { region: 'tashkent_city', minFollowers: 10000 });
  const id = data.campaign.id;

  // Tasdiqlanganda hali hech kimga yuborilmaydi: e'lon navbatga tushadi
  assert.equal(adNotices(201).length, 0);
  assert.equal((await broadcast()).campaign_id, id);

  await runCron(env);
  const [notice] = adNotices(201);
  assert.ok(notice, 'mos blogerga xabar bordi');
  assert.match(notice.body.text, /«Tabiiy yuz kremi»/);
  assert.match(notice.body.text, /Mahsulot qiymati: 180\s000 so‘m/);
  assert.match(notice.body.text, /Toshkent shahri/);
  assert.match(notice.body.text, /10\s000\+ obunachi/);
  const buttons = notice.body.reply_markup.inline_keyboard.flat();
  assert.equal(buttons[0].web_app.url, `${ORIGIN}/?c=${id}`);
  assert.equal(buttons[1].callback_data, 'ntf:off');

  assert.equal(adNotices(202).length, 0, 'boshqa hudud');
  assert.equal(adNotices(203).length, 0, 'obunachilari kam');
  assert.match(adNotices(204)[0].body.text, /Новое подходящее вам объявление/);
  assert.equal(adNotices(100).length, 0, 'biznesga emas');

  // Takrorlanmaydi
  await runCron(env);
  assert.equal(adNotices(201).length, 1);
  const job = await broadcast();
  assert.ok(job.done_at);
  assert.equal(job.sent, 2);
});

test('butun O‘zbekiston uchun e’lon hamma hududdagi blogerlarga boradi', async () => {
  await registerBusiness(env, business);
  await registerBlogger(env, tgUser(201));
  await registerBlogger(env, tgUser(202), { region: 'samarkand' });
  await createCampaign(env, business); // hudud ko'rsatilmagan: butun O'zbekiston
  await runCron(env);
  assert.equal(adNotices(201).length, 1);
  assert.equal(adNotices(202).length, 1);
});

test('moderatsiyadagi, rad etilgan va yopilgan e’lon haqida xabar bormaydi', async () => {
  await registerBusiness(env, business);
  await registerBlogger(env, tgUser(201));

  const pending = (await createCampaign(env, business, { approve: false })).data.campaign;
  await runCron(env);
  assert.equal(adNotices(201).length, 0);
  await press(env, tgUser(ADMIN), `cm:r:${pending.id}`, '#Yangi_elon');
  await runCron(env);
  assert.equal(adNotices(201).length, 0);

  const closed = (await createCampaign(env, business, { title: 'Yopiladigan e’lon' })).data.campaign;
  await press(env, tgUser(ADMIN), `adm:close:${closed.id}`, '#Yangi_elon');
  await runCron(env);
  assert.equal(adNotices(201).length, 0);
  assert.ok((await broadcast()).done_at);
});

test('so‘rov yuborib bo‘lgan blogerga xabar bormaydi', async () => {
  await registerBusiness(env, business);
  const blogger = tgUser(201);
  await registerBlogger(env, blogger);
  const { data } = await createCampaign(env, business);
  await api(env, blogger, `/api/campaigns/${data.campaign.id}/apply`, { method: 'POST', body: {} });
  await runCron(env);
  assert.equal(adNotices(201).length, 0);
});

test('bloger xabarlarni o‘chiradi va /xabarlar bilan qayta yoqadi', async () => {
  await registerBusiness(env, business);
  const blogger = tgUser(201);
  await registerBlogger(env, blogger);
  await createCampaign(env, business);
  await runCron(env);
  assert.equal(adNotices(201).length, 1);

  // Xabardagi "o'chirish" tugmasi
  await press(env, blogger, 'ntf:off');
  assert.equal(await notifyAds(201), 0);
  assert.match(tg.sent(201).at(-1).body.text, /xabarlar o‘chirildi/);
  await createCampaign(env, business, { title: 'Ikkinchi e’lon' });
  await runCron(env);
  assert.equal(adNotices(201).length, 1);

  await say(env, blogger, '/xabarlar');
  const status = tg.sent(201).at(-1).body;
  assert.match(status.text, /o‘chirilgan/);
  assert.equal(status.reply_markup.inline_keyboard[0][0].callback_data, 'ntf:on');
  await press(env, blogger, 'ntf:on');
  assert.equal(await notifyAds(201), 1);
  await createCampaign(env, business, { title: 'Uchinchi e’lon' });
  await runCron(env);
  assert.equal(adNotices(201).length, 2);
  assert.match(adNotices(201).at(-1).body.text, /Uchinchi e’lon/);
});

test('/xabarlar biznes uchun emas', async () => {
  await registerBusiness(env, business);
  await say(env, business, '/xabarlar');
  assert.match(tg.sent(100).at(-1).body.text, /blogerlar uchun/);
  await press(env, business, 'ntf:off');
  assert.match(tg.last('answerCallbackQuery').body.text, /eskirgan/);
});

test('botni bloklagan blogerga boshqa yuborilmaydi, qolganlarga yuborilaveradi', async () => {
  await registerBusiness(env, business);
  await registerBlogger(env, tgUser(201));
  await registerBlogger(env, tgUser(202));
  tg.failChat(201); // 403: bot was blocked by the user
  await createCampaign(env, business);
  await runCron(env);
  assert.equal(adNotices(202).length, 1);
  assert.equal(await notifyAds(201), 0);
  assert.equal(await notifyAds(202), 1);
});

test('Telegram "kuting" desa, keyingi daqiqada o‘sha blogerdan davom etadi', async () => {
  await registerBusiness(env, business);
  await registerBlogger(env, tgUser(201));
  await registerBlogger(env, tgUser(202));
  tg.failChat(201, 429, 'Too Many Requests: retry after 5');
  await createCampaign(env, business);
  await runCron(env);
  assert.equal(adNotices(202).length, 0, 'navbat to‘xtadi');
  assert.equal((await broadcast()).done_at, null);

  tg.unfailChat(201);
  await runCron(env);
  assert.equal(adNotices(201).length, 2); // birinchi urinish xato, ikkinchisi yetib bordi
  assert.equal(adNotices(202).length, 1);
  assert.equal(await notifyAds(201), 1, '429 bloklash emas');
});

test('xabarlar har daqiqada bo‘lib-bo‘lib yuboriladi (AD_NOTIFY_BATCH)', async () => {
  env = createEnv({ AD_NOTIFY_BATCH: '2' });
  await registerBusiness(env, business);
  for (const id of [201, 202, 203]) await registerBlogger(env, tgUser(id));
  await createCampaign(env, business);
  const reached = () => [201, 202, 203].filter((id) => adNotices(id).length).length;

  await runCron(env);
  assert.equal(reached(), 2);
  await runCron(env);
  assert.equal(reached(), 3);
  await runCron(env);
  assert.equal(reached(), 3);
  for (const id of [201, 202, 203]) assert.equal(adNotices(id).length, 1);
  const job = await broadcast();
  assert.ok(job.done_at);
  assert.equal(job.sent, 3);
});

test('rasmli e’lon haqida xabar rasm bilan boradi', async () => {
  await registerBusiness(env, business);
  await registerBlogger(env, tgUser(201));
  const { data } = await createCampaign(env, business, { approve: false });
  assert.equal((await putImage(env, business, data.campaign.id, JPEG)).status, 200);
  await press(env, tgUser(ADMIN), `cm:a:${data.campaign.id}`, '#Yangi_elon');
  await runCron(env);
  const [notice] = adNotices(201);
  assert.equal(notice.method, 'sendPhoto');
  assert.match(notice.body.caption, /«Tabiiy yuz kremi»/);
});

test('cron mini ilova manzilini /setup dan oladi', async () => {
  await registerBusiness(env, business);
  await registerBlogger(env, tgUser(201));
  await createCampaign(env, business);

  // /setup hali chaqirilmagan: manzil yo'q, hech narsa yuborilmaydi
  await worker.scheduled({ cron: '* * * * *' }, env, { waitUntil() {} });
  assert.equal(adNotices(201).length, 0);

  const res = await worker.fetch(
    new Request(`${ORIGIN}/setup`, { method: 'POST', headers: { 'x-setup-key': await webhookSecret(TOKEN) } }),
    env
  );
  assert.equal(res.status, 200);
  await worker.scheduled({ cron: '* * * * *' }, env, { waitUntil() {} });
  assert.equal(adNotices(201).length, 1);
  assert.equal(adNotices(201)[0].body.reply_markup.inline_keyboard[0][0].web_app.url.startsWith(`${ORIGIN}/?c=`), true);
});

test('biznes o‘chirilsa, uning e’lonlari navbatdan ham o‘chadi', async () => {
  await registerBusiness(env, business);
  await registerBlogger(env, tgUser(201));
  await createCampaign(env, business);
  assert.ok(await broadcast());
  await say(env, business, '/delete');
  await press(env, business, 'del:yes');
  assert.equal(await broadcast(), null);
  await runCron(env);
  assert.equal(adNotices(201).length, 0);
});
