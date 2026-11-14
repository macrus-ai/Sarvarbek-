// Eski botdan (@Ovozauz_bot) yangi botga ko'chish (src/oldbot.js)
import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import worker from '../src/index.js';
import { webhookSecret } from '../src/telegram.js';
import {
  OLD_TOKEN, ORIGIN, TOKEN, createCampaign, createEnv, fakeTelegram, getImage, registerBlogger, registerBusiness, runCron,
  say, sendOldUpdate, tgUser
} from './helpers.js';

// createEnv() da ADMIN_IDS = '999'
const ADMIN = 999;
let tg;
let env;
beforeEach(() => {
  tg = fakeTelegram();
  env = createEnv({ OLD_BOT_TOKEN: OLD_TOKEN });
});
afterEach(() => tg.restore());

const setting = (key) => env.DB.prepare('SELECT value FROM settings WHERE key = ?1').bind(key).first('value');
const putSetting = (key, value) =>
  env.DB.prepare(
    'INSERT INTO settings (key, value, updated_at) VALUES (?1, ?2, 0) ON CONFLICT (key) DO UPDATE SET value = excluded.value'
  )
    .bind(key, value)
    .run();
const userRow = (id) => env.DB.prepare('SELECT * FROM users WHERE tg_id = ?1').bind(id).first();
// Foydalanuvchi eski botda qolgan: yangi botga hali yozmagan (ko'chishdan oldingi barcha foydalanuvchilar shunday)
const leaveOnOldBot = (id) => env.DB.prepare('UPDATE users SET bot_id = NULL WHERE tg_id = ?1').bind(id).run();
const privateMsg = (from, text) => ({ message: { message_id: 1, date: 0, chat: { id: from.id, type: 'private' }, from, text } });
const runSetup = async () =>
  worker.fetch(new Request(`${ORIGIN}/setup`, { method: 'POST', headers: { 'x-setup-key': await webhookSecret(TOKEN) } }), env);
const oldCalls = (method) => tg.calls.filter((c) => c.token === OLD_TOKEN && c.method === method);
const uploads = () => tg.calls.filter((c) => c.method === 'sendPhoto' && c.token === TOKEN && typeof c.body.photo === 'object');

test('eski bot har qanday xabarga yangi botga yo‘naltiradi, sayt havolasi parametri saqlanadi', async () => {
  const user = tgUser(501);
  assert.equal((await sendOldUpdate(env, privateMsg(user, '/start business-uz'))).status, 200);
  const [msg] = tg.sentByOld(501);
  assert.match(msg.body.text, /ko‘chdi: <b>@ovoza_test_bot<\/b>/);
  assert.equal(msg.body.reply_markup.inline_keyboard[0][0].url, 'https://t.me/ovoza_test_bot?start=business-uz');
  assert.equal(tg.sent(501).length, 0, 'yangi bot birinchi bo‘lib yozmaydi');

  await sendOldUpdate(env, privateMsg(user, 'salom'));
  assert.equal(tg.sentByOld(501).at(-1).body.reply_markup.inline_keyboard[0][0].url, 'https://t.me/ovoza_test_bot');
});

test('eski bot ruscha tanlagan foydalanuvchiga ruscha javob beradi', async () => {
  const user = tgUser(502);
  await registerBusiness(env, user, { lang: 'ru' });
  await sendOldUpdate(env, privateMsg(user, 'привет'));
  assert.match(tg.sentByOld(502).at(-1).body.text, /Бот Miqyos переехал/);
  assert.equal(tg.sentByOld(502).at(-1).body.reply_markup.inline_keyboard[0][0].text, '➡️ Перейти в новый бот');
});

test('eski bot guruhda jim turadi, eski tugmalarga ogohlantirish beradi, begona so‘rovni rad etadi', async () => {
  await sendOldUpdate(env, {
    message: { message_id: 1, date: 0, chat: { id: -100, type: 'group' }, from: tgUser(ADMIN), text: '/stats' }
  });
  assert.equal(oldCalls('sendMessage').length, 0);

  await sendOldUpdate(env, {
    callback_query: { id: 'cb1', from: tgUser(ADMIN), data: 'mod:a:1', message: { message_id: 5, date: 0, chat: { id: -100, type: 'group' } } }
  });
  const [answer] = oldCalls('answerCallbackQuery');
  assert.equal(answer.body.show_alert, true);
  assert.match(answer.body.text, /@ovoza_test_bot/);

  assert.equal((await sendOldUpdate(env, privateMsg(tgUser(1), 'x'), { secret: 'wrong-secret' })).status, 403);
  // Eski bot sozlanmagan bo'lsa, manzil yo'q
  assert.equal((await sendOldUpdate(createEnv(), privateMsg(tgUser(1), 'x'))).status, 404);
});

test('/setup eski botni yo‘naltiruvchiga aylantiradi, yangi bot odatdagidek sozlanadi', async () => {
  const res = await runSetup();
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.bot, 'ovoza_test_bot');
  assert.equal(body.oldBot, 'old_test_bot');
  assert.equal(await setting('bot_username'), 'ovoza_test_bot');

  const [hook] = oldCalls('setWebhook');
  assert.equal(hook.body.url, `${ORIGIN}/telegram/old-webhook`);
  assert.equal(hook.body.secret_token, await webhookSecret(OLD_TOKEN));
  assert.deepEqual(oldCalls('setChatMenuButton')[0].body.menu_button, { type: 'default' });
  assert.equal(oldCalls('deleteMyCommands').length, 4, 'uz/ru, shaxsiy va guruh buyruqlari o‘chadi');
  assert.match(oldCalls('setMyDescription')[0].body.description, /@ovoza_test_bot/);
  assert.equal(oldCalls('setMyName')[0].body.name, 'Miqyos (eski)');

  const newHook = tg.calls.find((c) => c.token === TOKEN && c.method === 'setWebhook');
  assert.equal(newHook.body.url, `${ORIGIN}/telegram/webhook`);
  assert.equal(tg.calls.find((c) => c.token === TOKEN && c.method === 'setChatMenuButton').body.menu_button.type, 'web_app');

  // Eski bot xato bersa ham yangi bot sozlanadi
  tg.clear();
  tg.fail('deleteMyCommands');
  const again = await runSetup();
  assert.equal(again.status, 200);
  assert.equal((await again.json()).oldBot, null);
  assert.ok(tg.calls.some((c) => c.token === TOKEN && c.method === 'setMyDescription'));
});

test('yangi botga hali yozmagan blogerga e’lon xabari yuborilmaydi va xabarlari o‘chirilmaydi', async () => {
  const blogger = tgUser(601);
  await registerBlogger(env, blogger);
  assert.equal(Number((await userRow(601)).bot_id), 123456, 'yangi botga yozgan');
  await leaveOnOldBot(601);

  const business = tgUser(602);
  await registerBusiness(env, business);
  await createCampaign(env, business);
  await runCron(env);
  const notices = () =>
    tg.calls.filter((c) => c.method === 'sendMessage' && c.body.chat_id === 601 && /Sizga mos yangi reklama e’loni/.test(c.body.text));
  assert.equal(notices().length, 0);
  assert.equal(Number((await userRow(601)).notify_ads), 1, 'blokladi deb hisoblanmaydi');

  // Bloger yangi botga yozdi: endi xabarlar boradi
  await say(env, blogger, '/start');
  assert.equal(Number((await userRow(601)).bot_id), 123456);
  await createCampaign(env, business, { title: 'Ikkinchi e’lon' });
  await runCron(env);
  assert.equal(notices().length, 1);
});

test('eski botdagi statistika rasmlari yangi botga ko‘chadi; ungacha eski bot orqali ko‘rsatiladi', async () => {
  await registerBlogger(env, tgUser(701), { stats: true });
  await registerBlogger(env, tgUser(702), { stats: true });
  await registerBlogger(env, tgUser(703), { stats: true }); // bu rasm allaqachon yangi botda
  const before = await userRow(701);
  tg.ownFile(before.stats_file_id, OLD_TOKEN);
  tg.ownFile((await userRow(702)).stats_file_id, OLD_TOKEN);

  // Ko'chirilmagan rasm eski bot orqali olinadi
  const img = await getImage(env, `/img/s/701-${before.stats_key}.jpg`);
  assert.equal(img.status, 200);
  assert.equal(tg.last('file').token, OLD_TOKEN);

  // Admin yangi botga hali yozmagan: yuklab bo'lmaydi, hech narsa buzilmaydi, keyinroq qayta uriniladi
  tg.failChat(ADMIN, 403, 'Forbidden: bot can’t initiate conversation with a user');
  await runCron(env);
  assert.equal((await userRow(701)).stats_file_id, before.stats_file_id);
  assert.notEqual(await setting('old_files_moved'), 'done');

  tg.unfailChat(ADMIN);
  tg.clear();
  await runCron(env); // har daqiqada bittadan
  const after = await userRow(701);
  assert.notEqual(after.stats_file_id, before.stats_file_id);
  assert.equal(after.stats_key, before.stats_key, 'rasm manzili o‘zgarmaydi');
  const [upload] = uploads();
  assert.equal(Number(upload.body.chat_id), ADMIN);
  assert.equal(upload.body.disable_notification, 'true');
  assert.equal(tg.last('deleteMessage').body.chat_id, ADMIN, 'yordamchi xabar o‘chiriladi');

  await runCron(env);
  await runCron(env);
  await runCron(env);
  assert.equal(await setting('old_files_moved'), 'done');
  assert.equal(uploads().length, 2, 'faqat eski botdagi ikki rasm yuklandi');
  assert.notEqual((await userRow(702)).stats_file_id, `stats-702`);
  assert.equal((await userRow(703)).stats_file_id, 'stats-703');

  // Endi rasm yangi bot orqali olinadi
  tg.clear();
  assert.equal((await getImage(env, `/img/s/701-${before.stats_key}.jpg`)).status, 200);
  assert.equal(tg.last('file').token, TOKEN);
});

test('eski foydalanuvchilarga bir martalik xabar faqat admin ruxsat bersa yuboriladi', async () => {
  await registerBusiness(env, tgUser(801));
  await registerBlogger(env, tgUser(802));
  await registerBusiness(env, tgUser(803));
  await leaveOnOldBot(801);
  await leaveOnOldBot(803);
  tg.failChat(803, 403); // eski botni bloklagan

  await runCron(env);
  assert.equal(tg.sentByOld(801).length, 0, 'ruxsatsiz yuborilmaydi');

  await putSetting('old_bot_notice', 'go');
  await runCron(env);
  assert.equal(tg.sentByOld(801).length, 1);
  assert.equal(tg.sentByOld(801)[0].body.reply_markup.inline_keyboard[0][0].url, 'https://t.me/ovoza_test_bot');
  assert.equal(tg.sentByOld(802).length, 0, 'yangi botga yozganga yuborilmaydi');
  assert.equal(await setting('old_bot_notice'), 'done');

  await runCron(env);
  assert.equal(tg.sentByOld(801).length, 1, 'qayta yuborilmaydi');
});
