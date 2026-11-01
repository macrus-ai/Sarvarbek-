import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import worker from '../src/index.js';
import {
  ORIGIN, api, createCampaign, createEnv, fakeTelegram, press, registerBlogger, registerBusiness, say, sendUpdate,
  shareContact, tgUser
} from './helpers.js';

let tg;
let env;
beforeEach(() => {
  tg = fakeTelegram();
  env = createEnv();
});
afterEach(() => tg.restore());

const lastText = (chatId) => tg.sent(chatId).at(-1)?.body.text ?? '';

test('webhook noto‘g‘ri maxfiy kalit bilan rad etiladi', async () => {
  const res = await worker.fetch(
    new Request(`${ORIGIN}/telegram/webhook`, {
      method: 'POST',
      headers: { 'x-telegram-bot-api-secret-token': 'wrong' },
      body: '{}'
    }),
    env
  );
  assert.equal(res.status, 403);
  assert.equal(tg.calls.length, 0);
});

test('biznes bot orqali ro‘yxatdan o‘tadi', async () => {
  const user = tgUser(10);
  await say(env, user, '/start');
  assert.match(lastText(10), /Tilni tanlang/);

  await press(env, user, 'lang:uz');
  assert.match(lastText(10), /Siz kimsiz\?/);

  await press(env, user, 'role:business');
  assert.match(lastText(10), /Ismingizni yozing/);

  await say(env, user, 'A');
  assert.match(lastText(10), /Ism 2–60/);

  await say(env, user, 'Aziz');
  assert.match(lastText(10), /kompaniyangiz nomini/);

  await say(env, user, 'Tabiiy kosmetika');
  assert.match(lastText(10), /qaysi toifaga/);

  await say(env, user, 'kosmetika');
  assert.match(lastText(10), /tugmalardan birini/);

  await press(env, user, 'cat:beauty');
  const phoneQuestion = tg.sent(10).at(-1);
  assert.match(phoneQuestion.body.text, /telefon raqamingizni/);
  assert.equal(phoneQuestion.body.reply_markup.keyboard[0][0].request_contact, true);

  // Boshqa odamning kontakti qabul qilinmaydi
  await say(env, user, undefined, { contact: { phone_number: '998900000000', user_id: 77 } });
  assert.match(lastText(10), /o‘zingizning raqamingizni/);

  await shareContact(env, user, '998901112233');
  const done = tg.sent(10).at(-1);
  assert.match(done.body.text, /Ro‘yxatdan o‘tdingiz/);
  assert.match(done.body.text, /\+998 90 111 22 33/);
  assert.equal(done.body.reply_markup.inline_keyboard[0][0].web_app.url, `${ORIGIN}/`);

  const me = await api(env, user, '/api/me');
  assert.equal(me.data.registered, true);
  assert.equal(me.data.user.role, 'business');
  assert.equal(me.data.user.company, 'Tabiiy kosmetika');
  assert.equal(me.data.user.category, 'beauty');
});

test('bloger ruscha ro‘yxatdan o‘tadi, telefonni qo‘lda yozadi', async () => {
  const user = tgUser(20, { language_code: 'ru' });
  await say(env, user, '/start');
  await press(env, user, 'lang:ru');
  assert.match(lastText(20), /Кто вы\?/);
  await press(env, user, 'role:blogger');
  await say(env, user, 'Мадина');
  await press(env, user, 'plat:TikTok');
  await say(env, user, 'madina blog');
  assert.match(lastText(20), /ссылку или @username/);
  await say(env, user, '@madina');
  await press(env, user, 'fol:5000-10000');
  await press(env, user, 'cat:food');
  await say(env, user, '12345');
  assert.match(lastText(20), /\+998 90 123 45 67/);
  await say(env, user, '+998 93 555 66 77');
  assert.match(lastText(20), /Регистрация завершена/);
  assert.match(lastText(20), /5\s000 – 10\s000/);

  const me = await api(env, user, '/api/me');
  assert.equal(me.data.user.role, 'blogger');
  assert.equal(me.data.user.lang, 'ru');
  assert.equal(me.data.user.platform, 'TikTok');
  assert.equal(me.data.user.niche, 'food'); // eski "cat:" tugmasi ham ishlaydi
});

test('bloger yo‘nalishi: 20 ta yo‘nalish va "Boshqa", biznes toifalari alohida', async () => {
  const user = tgUser(21);
  await say(env, user, '/start');
  await press(env, user, 'lang:uz');
  await press(env, user, 'role:blogger');
  await say(env, user, 'Jasur');
  await press(env, user, 'plat:YouTube');
  await say(env, user, '@jasur_travel');
  await press(env, user, 'fol:10000-50000');

  const buttons = tg.last('sendMessage').body.reply_markup.inline_keyboard.flat();
  assert.equal(buttons.length, 21);
  assert.deepEqual(buttons.at(-1), { text: 'Boshqa', callback_data: 'niche:other' });
  assert.ok(buttons.every((b) => b.callback_data.startsWith('niche:')));
  assert.ok(buttons.some((b) => b.text === 'Sayohat'));
  assert.equal(new Set(buttons.map((b) => b.callback_data)).size, 21);

  await press(env, user, 'niche:travel');
  await shareContact(env, user, '998901234567');
  assert.match(lastText(21), /🏷 Sayohat/);
  assert.equal((await api(env, user, '/api/me')).data.user.niche, 'travel');

  // Ruscha nomlar va mini ilova uchun ro'yxat
  const ru = tgUser(22, { language_code: 'ru' });
  await registerBlogger(env, ru, { lang: 'ru', niche: 'other' });
  assert.match(lastText(22), /🏷 Другое/);
  const meta = (await api(env, ru, '/api/me')).data.meta;
  assert.equal(meta.niches.length, 21);
  assert.equal(meta.niches.at(-1).ru, 'Другое');
  assert.equal(meta.categories.length, 7);

  // Biznes toifasi ro'yxati o'zgarmagan, yo'nalish tugmasi u yerda ishlamaydi
  const business = tgUser(23);
  await say(env, business, '/start');
  await press(env, business, 'lang:uz');
  await press(env, business, 'role:business');
  await say(env, business, 'Aziz');
  await say(env, business, 'Aziz market');
  const cats = tg.last('sendMessage').body.reply_markup.inline_keyboard.flat();
  assert.equal(cats.length, 7);
  assert.ok(cats.every((b) => b.callback_data.startsWith('cat:')));
  tg.clear();
  await press(env, business, 'niche:travel');
  assert.match(tg.last('answerCallbackQuery').body.text, /eskirgan|eski/i);
  await press(env, business, 'cat:travel');
  assert.equal((await api(env, business, '/api/me')).data.user.category, null);
});

test('eskirgan tugma bosilsa ogohlantiradi', async () => {
  const user = tgUser(30);
  await say(env, user, '/start');
  await press(env, user, 'lang:uz');
  await press(env, user, 'role:blogger');
  tg.clear();
  await press(env, user, 'role:business');
  const answer = tg.last('answerCallbackQuery');
  assert.match(answer.body.text, /eskirgan/);
  assert.equal(tg.sent(30).length, 0);
});

test('ro‘yxatdan o‘tgan foydalanuvchi /start bosganda bosh menyu chiqadi', async () => {
  const user = tgUser(40);
  await registerBusiness(env, user);
  await say(env, user, '/start');
  const home = tg.sent(40).at(-1);
  assert.match(home.body.text, /Assalomu alaykum, Aziz/);
  const buttons = home.body.reply_markup.inline_keyboard.flat();
  assert.ok(buttons.some((b) => b.web_app?.url === `${ORIGIN}/`));
  assert.ok(buttons.some((b) => b.callback_data === 'reg:restart'));
});

test('/lang tilni o‘zgartiradi', async () => {
  const user = tgUser(50);
  await registerBusiness(env, user);
  await say(env, user, '/lang');
  await press(env, user, 'setlang:ru');
  assert.match(lastText(50), /Здравствуйте, Aziz/);
  const me = await api(env, user, '/api/me');
  assert.equal(me.data.user.lang, 'ru');
});

test('/stats faqat admin uchun', async () => {
  const admin = tgUser(999);
  const other = tgUser(60);
  await registerBusiness(env, other);
  tg.clear();
  await say(env, other, '/stats');
  assert.doesNotMatch(lastText(60), /Statistika/);
  await say(env, admin, '/stats');
  assert.match(lastText(999), /Statistika/);
  assert.match(lastText(999), /Bizneslar: 1/);
});

test('biznes blogerga o‘tsa, faol kampaniyalari yopiladi', async () => {
  const user = tgUser(70);
  await registerBusiness(env, user);
  assert.equal((await createCampaign(env, user)).status, 201);
  await press(env, user, 'reg:restart');
  await press(env, user, 'role:blogger');
  // Qayta ro'yxatdan o'tish tugamaguncha ilova "ro'yxatdan o'ting" deydi
  const me = await api(env, user, '/api/me');
  assert.equal(me.data.registered, false);
  await registerBlogger(env, tgUser(72));
  const campaigns = await api(env, tgUser(72), '/api/campaigns');
  assert.equal(campaigns.data.campaigns.length, 0);
});

test('guruhdagi xabarlarga javob berilmaydi', async () => {
  const user = tgUser(80);
  await sendUpdate(env, { message: { message_id: 1, date: 0, chat: { id: -100, type: 'group' }, from: user, text: '/start' } });
  assert.equal(tg.calls.length, 0);
});

test('/setup webhook, menyu tugmasi va buyruqlarni sozlaydi', async () => {
  const { webhookSecret } = await import('../src/telegram.js');
  const bad = await worker.fetch(new Request(`${ORIGIN}/setup`, { method: 'POST', headers: { 'x-setup-key': 'x' } }), env);
  assert.equal(bad.status, 403);

  const res = await worker.fetch(
    new Request(`${ORIGIN}/setup`, { method: 'POST', headers: { 'x-setup-key': await webhookSecret(env.BOT_TOKEN) } }),
    env
  );
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.bot, 'ovoza_test_bot');
  const hook = tg.last('setWebhook');
  assert.equal(hook.body.url, `${ORIGIN}/telegram/webhook`);
  assert.equal(hook.body.secret_token, await webhookSecret(env.BOT_TOKEN));
  assert.equal(tg.last('setChatMenuButton').body.menu_button.web_app.url, `${ORIGIN}/`);
  assert.equal(tg.calls.filter((c) => c.method === 'setMyCommands').length, 2);
});

test('Telegram tugma signaliga xato qaytarsa ham javob saqlanadi', async () => {
  tg.fail('answerCallbackQuery');
  const user = tgUser(90);
  await registerBusiness(env, user);
  const me = await api(env, user, '/api/me');
  assert.equal(me.data.registered, true);
  assert.equal(me.data.user.category, 'beauty');
});

test('saytdagi havola: rol va til tayyor bo‘lsa, darhol ism so‘raladi', async () => {
  const user = tgUser(110, { language_code: 'en' });
  await say(env, user, '/start business-ru');
  const sent = tg.sent(110);
  assert.match(sent.at(-2).body.text, /Регистрация для бизнеса/);
  assert.match(sent.at(-1).body.text, /Напишите ваше имя/);
  const me = await api(env, user, '/api/me');
  assert.equal(me.data.user.role, 'business');
  assert.equal(me.data.user.lang, 'ru');
  assert.equal(me.data.registered, false);
  await say(env, user, 'Азиз');
  assert.match(lastText(110), /названи[ея] магазина/);
});

test('saytdagi havola: faqat rol bo‘lsa, til so‘raladi va rol savoli o‘tkazib yuboriladi', async () => {
  const user = tgUser(111);
  await say(env, user, '/start blogger');
  const question = tg.sent(111).at(-1);
  assert.match(question.body.text, /Tilni tanlang/);
  assert.equal(question.body.reply_markup.inline_keyboard[0][0].callback_data, 'lang:uz:blogger');
  await press(env, user, 'lang:uz:blogger');
  assert.match(lastText(111), /Ismingizni yozing/);
  const me = await api(env, user, '/api/me');
  assert.equal(me.data.user.role, 'blogger');
});

test('saytdagi havola: noma’lum parametr oddiy boshlanishga olib keladi', async () => {
  const user = tgUser(112);
  await say(env, user, '/start hello');
  const question = tg.sent(112).at(-1);
  assert.equal(question.body.reply_markup.inline_keyboard[0][0].callback_data, 'lang:uz');
});

test('saytdagi havola: ro‘yxatdan o‘tgan foydalanuvchiga bosh menyu chiqadi', async () => {
  const user = tgUser(113);
  await registerBusiness(env, user);
  await say(env, user, '/start blogger-uz');
  assert.match(lastText(113), /Assalomu alaykum/);
  const me = await api(env, user, '/api/me');
  assert.equal(me.data.user.role, 'business');
});
