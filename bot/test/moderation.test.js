import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, test } from 'node:test';
import {
  api, approve, createCampaign, createEnv, fakeTelegram, press, registerBlogger, registerBusiness, say, sendUpdate,
  shareContact, tgUser
} from './helpers.js';

// createEnv() da ADMIN_IDS = '999'; bot tokeni '123456:...' — botning ID'si 123456
const ADMIN = 999;
const BOT_ID = 123456;
const GROUP = -1001111;
let tg;
let env;
let seq = 1;
beforeEach(() => {
  tg = fakeTelegram();
  env = createEnv();
});
afterEach(() => tg.restore());

const lastText = (chatId) => tg.sent(chatId).at(-1)?.body.text ?? '';
const cards = (chatId, tag) => tg.sent(chatId).filter((c) => c.body.text.includes(tag));

// Guruhdagi xabar (masalan, botni qo'shish yoki buyruq)
const groupMessage = (from, extra, chat = GROUP) =>
  sendUpdate(env, {
    message: { message_id: seq++, date: 0, chat: { id: chat, type: 'supergroup', title: 'Ovoza moderatsiya' }, from, ...extra }
  });

// Guruhdagi moderatsiya kartasidagi tugmani bosish (karta profil havolasi tugmasi bilan)
const groupPress = (from, data, chat = GROUP) =>
  sendUpdate(env, {
    callback_query: {
      id: String(seq++),
      from,
      data,
      message: {
        message_id: 500,
        date: 0,
        chat: { id: chat, type: 'supergroup' },
        text: '#Yangi_bloger\n\nkarta',
        reply_markup: {
          inline_keyboard: [
            [{ text: '✅', callback_data: data }],
            [{ text: '🔗 Profilni ochish', url: 'https://instagram.com/dilnoza.blog' }]
          ]
        }
      }
    }
  });

const addBotToGroup = (from, chat = GROUP) =>
  groupMessage(from, { new_chat_members: [{ id: BOT_ID, is_bot: true, first_name: 'Ovoza' }] }, chat);

test('yangi bloger moderatsiyada: ilova yopiq, admin tasdiqlagach ochiladi', async () => {
  const blogger = tgUser(700, { username: 'dilnoza' });
  await registerBlogger(env, blogger, { approve: false });

  const me = await api(env, blogger, '/api/me');
  assert.equal(me.data.registered, true);
  assert.equal(me.data.user.moderation, 'pending');
  const blocked = await api(env, blogger, '/api/campaigns');
  assert.equal(blocked.status, 403);
  assert.equal(blocked.data.error, 'moderation_pending');

  // Adminga moderatsiya kartasi: auditoriya hududi, tugmalar va profil havolasi
  const [card] = cards(ADMIN, '#Yangi_bloger');
  assert.match(card.body.text, /📍 Auditoriya: Toshkent shahri/);
  assert.match(card.body.text, /\+998 93 555 66 77/);
  assert.match(card.body.text, /⏳ Moderatsiyada/);
  const keyboard = card.body.reply_markup.inline_keyboard;
  assert.deepEqual(keyboard[0].map((b) => b.callback_data), ['mod:a:700', 'mod:r:700']);
  assert.equal(keyboard[1][0].url, 'https://instagram.com/dilnoza.blog');

  // /start: hali moderatsiyada
  await say(env, blogger, '/start');
  assert.match(lastText(700), /moderatsiyada/);
  assert.equal(tg.sent(700).at(-1).body.reply_markup.inline_keyboard[0][0].callback_data, 'reg:restart');

  // Moderator bo'lmagan foydalanuvchi tasdiqlay olmaydi
  const stranger = tgUser(701);
  await press(env, stranger, 'mod:a:700');
  assert.match(tg.last('answerCallbackQuery').body.text, /moderatorlar uchun/);
  assert.equal((await api(env, blogger, '/api/me')).data.user.moderation, 'pending');

  tg.clear();
  await approve(env, blogger);
  const approved = tg.sent(700).at(-1);
  assert.match(approved.body.text, /Profilingiz tasdiqlandi/);
  assert.ok(approved.body.reply_markup.inline_keyboard[0][0].web_app);
  assert.match(tg.last('editMessageText').body.text, /Tasdiqlandi/);
  assert.equal((await api(env, blogger, '/api/campaigns')).status, 200);

  // Qayta bosilsa: qaror allaqachon qabul qilingan
  await approve(env, blogger);
  assert.match(tg.last('answerCallbackQuery').body.text, /allaqachon/);
});

test('rad etilgan biznes qayta yuboradi va yana moderatsiyaga tushadi', async () => {
  const business = tgUser(710);
  await registerBusiness(env, business, { approve: false });
  assert.equal((await createCampaign(env, business)).data.error, 'moderation_pending');

  await press(env, tgUser(ADMIN), 'mod:r:710');
  assert.match(lastText(710), /tasdiqlanmadi/);
  assert.equal(tg.sent(710).at(-1).body.reply_markup.inline_keyboard[0][0].callback_data, 'reg:restart');
  assert.match(tg.last('editMessageText').body.text, /Rad etildi/);
  assert.equal((await api(env, business, '/api/me')).data.user.moderation, 'rejected');
  assert.equal((await api(env, business, '/api/campaigns')).data.error, 'moderation_rejected');
  await say(env, business, '/start');
  assert.match(lastText(710), /tasdiqlanmadi/);

  // "Qayta yuborish"
  await press(env, business, 'reg:restart');
  await press(env, business, 'role:business');
  await say(env, business, 'Aziz');
  await say(env, business, 'To‘g‘rilangan nom');
  await press(env, business, 'cat:food');
  await shareContact(env, business, '998901112233');
  assert.match(lastText(710), /moderatsiyada/);
  assert.match(lastText(ADMIN), /#Yangi_biznes/);
  assert.match(lastText(ADMIN), /qayta yuborildi/);
  assert.equal((await api(env, business, '/api/me')).data.user.moderation, 'pending');
});

test('tasdiqlangan biznes bloklansa, e’lonlari yopiladi', async () => {
  const business = tgUser(720);
  const blogger = tgUser(721);
  await registerBusiness(env, business);
  await registerBlogger(env, blogger);
  await createCampaign(env, business);
  assert.equal((await api(env, blogger, '/api/campaigns')).data.campaigns.length, 1);

  // Profilni yangilasa, jamoaga "bloklash" tugmasi bilan karta keladi
  await press(env, business, 'reg:restart');
  await press(env, business, 'role:business');
  await say(env, business, 'Aziz');
  await say(env, business, 'Shubhali nom');
  await press(env, business, 'cat:beauty');
  await shareContact(env, business, '998901112233');
  const card = tg.sent(ADMIN).at(-1);
  assert.match(card.body.text, /#Profil_yangilandi/);
  assert.equal(card.body.reply_markup.inline_keyboard[0][0].callback_data, 'mod:b:720');
  assert.equal((await api(env, business, '/api/me')).data.user.moderation, 'approved');

  await press(env, tgUser(ADMIN), 'mod:b:720');
  assert.match(tg.last('editMessageText').body.text, /Bloklandi/);
  assert.equal((await api(env, business, '/api/me')).data.user.moderation, 'rejected');
  assert.equal((await api(env, blogger, '/api/campaigns')).data.campaigns.length, 0);
});

test('guruh: admin botni qo‘shsa ulanadi, kartalar guruhga keladi, guruh a’zosi tasdiqlaydi', async () => {
  await addBotToGroup(tgUser(ADMIN));
  assert.match(lastText(GROUP), /Guruh ulandi/);

  const blogger = tgUser(730);
  await registerBlogger(env, blogger, { approve: false });
  assert.equal(cards(GROUP, '#Yangi_bloger').length, 1);
  assert.equal(cards(ADMIN, '#Yangi_bloger').length, 0); // adminga shaxsan takrorlanmaydi

  // Guruhdagi oddiy a'zo (ADMIN_IDS da yo'q) tasdiqlay oladi, profil havolasi tugmasi qoladi
  const member = tgUser(4242, { first_name: 'Moderator' });
  await groupPress(member, 'mod:a:730');
  const edited = tg.last('editMessageText').body;
  assert.match(edited.text, /Tasdiqlandi<\/b> · Moderator/);
  assert.deepEqual(edited.reply_markup.inline_keyboard, [[{ text: '🔗 Profilni ochish', url: 'https://instagram.com/dilnoza.blog' }]]);
  assert.equal((await api(env, blogger, '/api/me')).data.user.moderation, 'approved');

  // Xuddi shu a'zo shaxsiy chatda tugma bossa — ruxsat yo'q
  const other = tgUser(731);
  await registerBlogger(env, other, { approve: false });
  await press(env, member, 'mod:a:731');
  assert.match(tg.last('answerCallbackQuery').body.text, /moderatorlar uchun/);

  // Yangi reklama e'loni ham guruhga keladi va guruhdan yopiladi
  const business = tgUser(732);
  await registerBusiness(env, business, { approve: false });
  await groupPress(member, 'mod:a:732');
  const { data } = await createCampaign(env, business);
  assert.match(lastText(GROUP), /Yangi reklama e’loni/);
  await groupPress(member, `adm:close:${data.campaign.id}`);
  assert.equal((await api(env, blogger, '/api/campaigns')).data.campaigns.length, 0);
});

test('guruhni ulash: /ulash bloger va /ulash biznes, faqat adminlar', async () => {
  const A = -1002001;
  const B = -1002002;
  const admin = tgUser(ADMIN);

  // Admin bo'lmagan ula olmaydi
  await groupMessage(tgUser(5), { text: '/ulash' }, A);
  assert.match(lastText(A), /faqat Ovoza adminlari/);
  // Admin bo'lmagan botni qo'shsa — jim
  await addBotToGroup(tgUser(5), -1002009);
  assert.equal(tg.sent(-1002009).length, 0);

  await groupMessage(admin, { text: '/ulash@Ovozauz_bot bloger' }, A);
  assert.match(lastText(A), /yangi blogerlar keladi/);
  await groupMessage(admin, { text: '/ulash biznes' }, B);
  assert.match(lastText(B), /yangi bizneslar keladi/);

  // Uchinchi guruhga qo'shilsa, ulash usuli ko'rsatiladi, mavjud bog'lanish o'zgarmaydi
  await addBotToGroup(admin, -1002003);
  assert.match(lastText(-1002003), /\/ulash bloger/);

  await registerBlogger(env, tgUser(740), { approve: false });
  await registerBusiness(env, tgUser(741), { approve: false });
  assert.equal(cards(A, '#Yangi_bloger').length, 1);
  assert.equal(cards(B, '#Yangi_biznes').length, 1);
  assert.equal(cards(A, '#Yangi_biznes').length, 0);

  // Guruh supergroupga aylansa, yangi ID saqlanadi
  await groupMessage(admin, { migrate_to_chat_id: -1009999 }, A);
  await registerBlogger(env, tgUser(742), { approve: false });
  assert.equal(cards(-1009999, '#Yangi_bloger').length, 1);
});

test('reklama e’lonlari alohida guruhga keladi, ulanmagan bo‘lsa — bizneslar guruhiga', async () => {
  const BIZ = -1003001;
  const ADS = -1003002;
  const admin = tgUser(ADMIN);
  await groupMessage(admin, { text: '/ulash biznes' }, BIZ);

  const business = tgUser(770);
  await registerBusiness(env, business);
  await createCampaign(env, business, { title: 'Birinchi e’lon' });
  // E'lonlar guruhi hali yo'q: e'lon bizneslar guruhiga keladi
  assert.equal(cards(BIZ, '#Yangi_elon').length, 1);

  // "/ulash e'lon" (apostrof bilan ham) — e'lonlar endi alohida guruhga
  await groupMessage(admin, { text: "/ulash e'lon" }, ADS);
  assert.match(lastText(ADS), /yangi reklama e’lonlari keladi/);
  const { data } = await createCampaign(env, business, { title: 'Ikkinchi e’lon' });
  assert.equal(cards(BIZ, '#Yangi_elon').length, 1);
  const [ad] = cards(ADS, '#Yangi_elon');
  assert.match(ad.body.text, /Ikkinchi e’lon/);
  assert.deepEqual(ad.body.reply_markup.inline_keyboard[0].map((b) => b.callback_data), [
    `cm:a:${data.campaign.id}`,
    `cm:r:${data.campaign.id}`
  ]);

  // Profillar e'lonlar guruhiga kelmaydi
  await registerBusiness(env, tgUser(771), { approve: false });
  assert.equal(cards(ADS, '#Yangi_biznes').length, 0);
  assert.equal(cards(BIZ, '#Yangi_biznes').length, 2);

  // E'lonlar guruhining a'zosi e'lonni yopa oladi
  const blogger = tgUser(772);
  await registerBlogger(env, blogger);
  assert.equal((await api(env, blogger, '/api/campaigns')).data.campaigns.length, 2);
  await groupPress(tgUser(4343), `adm:close:${data.campaign.id}`, ADS);
  assert.deepEqual(
    (await api(env, blogger, '/api/campaigns')).data.campaigns.map((c) => c.title),
    ['Birinchi e’lon']
  );

  // Ruscha buyruq ham ishlaydi
  await groupMessage(admin, { text: '/ulash объявления' }, -1003003);
  assert.match(lastText(-1003003), /yangi reklama e’lonlari keladi/);
});

test('/moderatsiya kutayotgan profillarni qayta yuboradi, /stats sonini ko‘rsatadi', async () => {
  await registerBlogger(env, tgUser(750), { approve: false });
  await registerBusiness(env, tgUser(751), { approve: false });
  await registerBlogger(env, tgUser(752)); // tasdiqlangan
  tg.clear();

  await say(env, tgUser(ADMIN), '/moderatsiya');
  assert.match(tg.sent(ADMIN)[0].body.text, /Moderatsiyada: 2/);
  assert.equal(cards(ADMIN, '#Yangi_').length, 2);

  await say(env, tgUser(ADMIN), '/stats');
  assert.match(lastText(ADMIN), /Moderatsiyada: 2/);

  // Ulanmagan guruhda oddiy a'zo buyruq bersa — jim; ulangan guruhda ishlaydi
  await groupMessage(tgUser(6), { text: '/moderatsiya' });
  assert.equal(tg.sent(GROUP).length, 0);
  await groupMessage(tgUser(ADMIN), { text: '/ulash' });
  await groupMessage(tgUser(6), { text: '/moderatsiya' });
  assert.equal(cards(GROUP, '#Yangi_').length, 2);

  // Oddiy foydalanuvchiga bu buyruq ishlamaydi
  await say(env, tgUser(752), '/moderatsiya');
  assert.doesNotMatch(lastText(752), /Moderatsiyada/);
});

test('moderatorlar sozlanmagan bo‘lsa, profil darhol faollashadi', async () => {
  env = createEnv({ ADMIN_IDS: '' });
  const blogger = tgUser(760);
  await registerBlogger(env, blogger, { approve: false });
  assert.equal((await api(env, blogger, '/api/me')).data.user.moderation, 'approved');
  assert.ok(tg.sent(760).at(-1).body.reply_markup.inline_keyboard[0][0].web_app);
});

test('migratsiya: avval ro‘yxatdan o‘tganlar tasdiqlangan hisoblanadi', () => {
  const db = new DatabaseSync(':memory:');
  const dir = new URL('../migrations/', import.meta.url);
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  const modFile = files.find((f) => f.includes('moderation'));
  for (const f of files.filter((x) => x < modFile)) db.exec(readFileSync(new URL(f, dir), 'utf8'));
  db.exec(`INSERT INTO users (tg_id, role, reg_step, registered_at, created_at, updated_at) VALUES (1, 'blogger', 'done', 10, 0, 0)`);
  db.exec(`INSERT INTO users (tg_id, role, reg_step, created_at, updated_at) VALUES (2, 'blogger', 'niche', 0, 0)`);
  db.exec(readFileSync(new URL(modFile, dir), 'utf8'));
  const rows = Object.fromEntries(db.prepare('SELECT tg_id, moderation FROM users').all().map((r) => [r.tg_id, r.moderation]));
  assert.deepEqual(rows, { 1: 'approved', 2: null });
});
