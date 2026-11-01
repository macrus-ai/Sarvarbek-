import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import {
  api, createCampaign, createEnv, fakeTelegram, press, registerBlogger, registerBusiness, say, tgUser
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

test('ro‘yxatdan o‘tishda maxfiylik siyosatiga havola ko‘rsatiladi', async () => {
  const user = tgUser(300);
  await say(env, user, '/start');
  await press(env, user, 'lang:uz');
  assert.match(lastText(300), /<a href="https:\/\/macrus-ai\.github\.io\/Sarvarbek-\/privacy\.html">maxfiylik siyosati<\/a>/);

  const ru = tgUser(301);
  await say(env, ru, '/start blogger-ru');
  assert.match(tg.sent(301).at(-2).body.text, /privacy\.html\?lang=ru">политикой конфиденциальности/);
});

test('/privacy va /id', async () => {
  const user = tgUser(302);
  await say(env, user, '/privacy');
  assert.match(lastText(302), /maxfiylik siyosati/);
  assert.match(lastText(302), /\/delete/);
  await say(env, user, '/id');
  assert.match(lastText(302), /<code>302<\/code>/);
});

test('admin yangi foydalanuvchi haqida bir marta xabar oladi', async () => {
  const business = tgUser(310, { username: 'aziz_shop' });
  await registerBusiness(env, business);
  const notes = tg.sent(ADMIN).filter((c) => /Yangi biznes/.test(c.body.text));
  assert.equal(notes.length, 1);
  assert.match(notes[0].body.text, /Tabiiy kosmetika/);
  assert.match(notes[0].body.text, /\+998 90 111 22 33/);

  // Ma'lumotlarni yangilash yangi foydalanuvchi deb hisoblanmaydi
  await press(env, business, 'reg:restart');
  await press(env, business, 'role:business');
  await say(env, business, 'Aziz');
  await say(env, business, 'Yangi nom');
  await press(env, business, 'cat:beauty');
  await say(env, business, undefined, { contact: { phone_number: '998901112233', user_id: 310 } });
  assert.equal(tg.sent(ADMIN).filter((c) => /Yangi biznes/.test(c.body.text)).length, 1);

  const blogger = tgUser(311);
  await registerBlogger(env, blogger);
  assert.match(lastText(ADMIN), /Yangi bloger/);
});

test('admin yangi kampaniyani ko‘radi va yopa oladi', async () => {
  const business = tgUser(320);
  const blogger = tgUser(321);
  await registerBusiness(env, business);
  await registerBlogger(env, blogger);
  const { data } = await createCampaign(env, business, { title: 'Shubhali kampaniya' });
  const id = data.campaign.id;

  const note = tg.sent(ADMIN).at(-1);
  assert.match(note.body.text, /Yangi kampaniya/);
  assert.match(note.body.text, /Shubhali kampaniya/);
  assert.equal(note.body.reply_markup.inline_keyboard[0][0].callback_data, `adm:close:${id}`);

  // Admin bo'lmagan foydalanuvchi yopa olmaydi
  await press(env, blogger, `adm:close:${id}`);
  assert.match(tg.last('answerCallbackQuery').body.text, /eskirgan/);
  assert.equal((await api(env, blogger, '/api/campaigns')).data.campaigns.length, 1);

  tg.clear();
  await press(env, tgUser(ADMIN), `adm:close:${id}`, 'Yangi kampaniya');
  assert.equal((await api(env, blogger, '/api/campaigns')).data.campaigns.length, 0);
  assert.match(lastText(320), /moderator tomonidan yopildi/);
  assert.deepEqual(tg.last('editMessageText').body.reply_markup.inline_keyboard, []);

  await press(env, tgUser(ADMIN), `adm:close:${id}`);
  assert.match(tg.last('answerCallbackQuery').body.text, /allaqachon yopilgan/);
});

test('/delete: tasdiqlansa barcha ma’lumotlar o‘chadi, bekor qilinsa qoladi', async () => {
  const business = tgUser(330);
  const blogger = tgUser(331);
  await registerBusiness(env, business);
  await registerBlogger(env, blogger);
  const { data } = await createCampaign(env, business);
  await api(env, blogger, `/api/campaigns/${data.campaign.id}/apply`, { method: 'POST', body: {} });

  await say(env, business, '/delete');
  const confirm = tg.sent(330).at(-1);
  assert.match(confirm.body.text, /butunlay o‘chiriladi/);
  await press(env, business, 'del:no');
  assert.equal((await api(env, business, '/api/me')).data.registered, true);

  await press(env, business, 'del:yes');
  assert.match(tg.last('editMessageText').body.text, /o‘chirildi/);
  const me = await api(env, business, '/api/me');
  assert.equal(me.data.registered, false);
  assert.equal(me.data.user.company, null);
  assert.equal((await api(env, blogger, '/api/campaigns')).data.campaigns.length, 0);
  assert.equal((await api(env, blogger, '/api/my/applications')).data.applications.length, 0);
});
