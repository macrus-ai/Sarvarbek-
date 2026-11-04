import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import {
  api, approve, createCampaign, createEnv, fakeTelegram, press, registerBlogger, registerBusiness, say, shareContact,
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
const cards = (chatId, tag) => tg.sent(chatId).filter((c) => c.body.text.includes(tag));

test('ro‘yxatdan o‘tishda maxfiylik siyosatiga havola ko‘rsatiladi', async () => {
  const user = tgUser(300);
  await say(env, user, '/start');
  await press(env, user, 'lang:uz');
  assert.match(lastText(300), /<a href="https:\/\/ovozagroup\.uz\/privacy\.html">maxfiylik siyosati<\/a>/);

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

test('admin yangi foydalanuvchini moderatsiya kartasi bilan bir marta oladi', async () => {
  const business = tgUser(310, { username: 'aziz_shop' });
  await registerBusiness(env, business);
  const notes = tg.sent(ADMIN).filter((c) => /#Yangi_biznes/.test(c.body.text));
  assert.equal(notes.length, 1);
  assert.match(notes[0].body.text, /Tabiiy kosmetika/);
  assert.match(notes[0].body.text, /\+998 90 111 22 33/);

  const blogger = tgUser(311);
  await registerBlogger(env, blogger, { approve: false });
  assert.match(lastText(ADMIN), /#Yangi_bloger/);
  await approve(env, blogger);

  // Tasdiqlangan bloger ma'lumotlarini yangilasa — yangi foydalanuvchi emas, "#Profil_yangilandi" keladi
  await press(env, blogger, 'reg:restart');
  await press(env, blogger, 'role:blogger');
  await say(env, blogger, 'Dilnoza Yangi');
  await press(env, blogger, 'plat:TikTok');
  await say(env, blogger, '@dilnoza_tt');
  await press(env, blogger, 'fol:10000-50000');
  await press(env, blogger, 'rch:3000-10000'); // TikTok: reels, postlar va qamrov savollari yo'q
  await press(env, blogger, 'stats:skip');
  await press(env, blogger, 'niche:beauty');
  await press(env, blogger, 'rgn:tashkent_city');
  await shareContact(env, blogger, '+998935556677');
  assert.equal(tg.sent(ADMIN).filter((c) => /#Yangi_bloger/.test(c.body.text)).length, 1);
  assert.match(lastText(ADMIN), /#Profil_yangilandi/);
  assert.match(lastText(ADMIN), /Dilnoza Yangi/);
  // Instagramdan TikTokka o'tdi — Instagram ko'rsatkichlari o'chdi, bitta "Videolar" qoldi
  assert.match(lastText(ADMIN), /Videolar \(o‘rtacha\): 3\s000 – 10\s000/);
  assert.doesNotMatch(lastText(ADMIN), /Reels|Postlar|Istoriya|Qamrov|kiritilmagan/);
  const row = await env.DB.prepare('SELECT reels_views, posts_views, accounts_reached, reels_reach FROM users WHERE tg_id = ?1')
    .bind(311)
    .first();
  assert.deepEqual(row, { reels_views: null, posts_views: null, accounts_reached: null, reels_reach: null });
  assert.equal((await api(env, blogger, '/api/me')).data.user.moderation, 'approved');
});

test('admin yangi kampaniyani ko‘radi va yopa oladi', async () => {
  const business = tgUser(320);
  const blogger = tgUser(321);
  await registerBusiness(env, business);
  await registerBlogger(env, blogger);
  const { data } = await createCampaign(env, business, { title: 'Shubhali kampaniya' });
  const id = data.campaign.id;

  // Karta avval tasdiqlash tugmalari bilan keladi; tasdiqlangach "yopish" tugmasi qoladi
  const note = cards(ADMIN, '#Yangi_elon').at(-1);
  assert.match(note.body.text, /Yangi reklama e’loni/);
  assert.match(note.body.text, /Shubhali kampaniya/);
  assert.equal(note.body.reply_markup.inline_keyboard[0][0].callback_data, `cm:a:${id}`);
  const approvedCard = tg.calls.filter((c) => c.method === 'editMessageText').at(-1).body;
  assert.match(approvedCard.text, /E’lon tasdiqlandi/);
  assert.equal(approvedCard.reply_markup.inline_keyboard[0][0].callback_data, `adm:close:${id}`);

  // Admin bo'lmagan foydalanuvchi yopa olmaydi
  await press(env, blogger, `adm:close:${id}`);
  assert.match(tg.last('answerCallbackQuery').body.text, /eskirgan/);
  assert.equal((await api(env, blogger, '/api/campaigns')).data.campaigns.length, 1);

  tg.clear();
  await press(env, tgUser(ADMIN), `adm:close:${id}`, 'Yangi reklama e’loni');
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
