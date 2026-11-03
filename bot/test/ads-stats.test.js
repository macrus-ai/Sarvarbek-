import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import {
  api, approve, createCampaign, createEnv, fakeTelegram, getImage, press, registerBlogger, registerBusiness, say,
  sendPhoto, tgUser
} from './helpers.js';
import { normalizeProfile } from '../src/util.js';

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
const photosTo = (chatId) => tg.calls.filter((c) => c.method === 'sendPhoto' && String(c.body.chat_id) === String(chatId));

test('profil havolasi platformaga tekshiriladi va to‘liq havolaga aylanadi', () => {
  assert.equal(normalizeProfile('Instagram', '1macrus83'), 'https://instagram.com/1macrus83');
  assert.equal(normalizeProfile('Instagram', '@dilnoza.blog'), 'https://instagram.com/dilnoza.blog');
  assert.equal(normalizeProfile('Instagram', 'https://www.instagram.com/dilnoza.blog/?igsh=abc'), 'https://www.instagram.com/dilnoza.blog');
  assert.equal(normalizeProfile('Instagram', 'instagram.com/dilnoza'), 'https://instagram.com/dilnoza');
  assert.equal(normalizeProfile('Instagram', 'https://tiktok.com/@x'), null);
  assert.equal(normalizeProfile('Instagram', 'https://instagram.com.evil.com/x'), null);
  assert.equal(normalizeProfile('Instagram', 'salom dunyo'), null);
  assert.equal(normalizeProfile('TikTok', 'https://vm.tiktok.com/ZMabc/'), 'https://vm.tiktok.com/ZMabc');
  assert.equal(normalizeProfile('Telegram', '@kanal'), 'https://t.me/kanal');
  assert.equal(normalizeProfile('YouTube', 'https://www.youtube.com/watch?v=abc'), 'https://www.youtube.com/watch?v=abc');
});

test('bloger: Instagram havolasi, to‘rtta ko‘rsatkich va statistika skrinshoti', async () => {
  const blogger = tgUser(800, { username: 'dilnoza' });
  await say(env, blogger, '/start');
  await press(env, blogger, 'lang:uz');
  await press(env, blogger, 'role:blogger');
  await say(env, blogger, 'Dilnoza');
  await press(env, blogger, 'plat:Instagram');
  assert.match(lastText(800), /Instagram profilingiz havolasini yuboring/);
  assert.match(lastText(800), /instagram\.com\/username/);
  await say(env, blogger, 'https://t.me/dilnoza');
  assert.match(lastText(800), /Instagram havolasiga o‘xshamaydi/);
  await say(env, blogger, 'https://www.instagram.com/dilnoza.blog/?igsh=xyz');
  await press(env, blogger, 'fol:10000-50000');
  const buttons = () => tg.last('sendMessage').body.reply_markup.inline_keyboard.flat();
  // Instagram: reels → postlar → istoriya → qamrov (30 kun)
  assert.match(lastText(800), /Reels videolaringiz o‘rtacha nechta ko‘rish/);
  assert.equal(buttons().length, 6);
  assert.equal(buttons()[0].text, '1\u00a0000 gacha');
  assert.equal(buttons()[0].callback_data, 'rls:0-1000');
  await press(env, blogger, 'rch:3000-10000'); // eski tartibdagi tugma: hozir reels so'ralyapti
  assert.match(tg.last('answerCallbackQuery').body.text, /Bu tugma eskirgan/);
  await press(env, blogger, 'rls:20000-100000');
  assert.match(lastText(800), /Postlaringiz \(rasm va karusellar\) o‘rtacha nechta ko‘rish/);
  assert.equal(buttons()[0].text, '500 gacha');
  assert.equal(buttons()[0].callback_data, 'pst:0-500');
  await press(env, blogger, 'pst:1000-3000');
  assert.match(lastText(800), /Istoriyalaringiz \(storis\) o‘rtacha nechta ko‘rish/);
  await press(env, blogger, 'rch:3000-10000');
  assert.match(lastText(800), /Qamrov: oxirgi 30 kunda/);
  assert.match(lastText(800), /Qamrab olingan akkauntlar/);
  assert.deepEqual(buttons().map((b) => b.text), [
    '5\u00a0000 gacha', '5\u00a0000 – 20\u00a0000', '20\u00a0000 – 100\u00a0000',
    '100\u00a0000 – 500\u00a0000', '500\u00a0000 – 1\u00a0000\u00a0000', '1\u00a0000\u00a0000+'
  ]);
  await press(env, blogger, 'acc:100000-500000');
  assert.match(lastText(800), /Statistika skrinshotini rasm qilib yuboring/);
  assert.match(lastText(800), /Professional panel/);
  await sendPhoto(env, blogger, 'stats-800');
  await press(env, blogger, 'niche:lifestyle');
  await press(env, blogger, 'rgn:samarkand');
  await say(env, blogger, '+998935556677');

  const done = lastText(800);
  assert.match(done, /instagram\.com\/dilnoza\.blog/);
  assert.match(
    done,
    /Reels \(o‘rtacha\): 20\s000 – 100\s000\n.*Postlar \(o‘rtacha\): 1\s000 – 3\s000\n.*Istoriya \(o‘rtacha\): 3\s000 – 10\s000\n.*Qamrov \(30 kun\): 100\s000 – 500\s000/
  );
  assert.doesNotMatch(done, /eski|kiritilmagan/);
  assert.match(done, /Statistika: yuborildi/);

  // Moderatsiya kartasi statistika rasmi bilan keladi
  const [card] = photosTo(ADMIN);
  assert.equal(card.body.photo, 'stats-800'); // eng katta o'lcham
  assert.match(card.body.caption, /#Yangi_bloger/);
  assert.match(card.body.caption, /href="https:\/\/www\.instagram\.com\/dilnoza\.blog"/);
  assert.match(card.body.caption, /Statistika skrinshoti — rasmda/);
  assert.match(card.body.caption, /Reels \(o‘rtacha\): 20\s000 – 100\s000\n.*Postlar.*\n.*Istoriya.*\n.*Qamrov \(30 kun\): 100\s000 – 500\s000/);
  assert.equal(card.body.reply_markup.inline_keyboard[0][0].callback_data, 'mod:a:800');

  // Rasmli kartadan tasdiqlash — rasm osti matni yangilanadi
  await press(env, tgUser(ADMIN), 'mod:a:800');
  assert.ok(tg.last('editMessageCaption') || tg.last('editMessageText'));
  const me = await api(env, blogger, '/api/me');
  assert.equal(me.data.user.profile, 'https://www.instagram.com/dilnoza.blog');
  assert.equal(me.data.user.moderation, 'approved');
});

test('so‘rov: biznes avval profil va statistikani ko‘radi, Telegram va telefon — qabul qilgach', async () => {
  const business = tgUser(810);
  const blogger = tgUser(811, { username: 'secret_blogger' });
  await registerBusiness(env, business);
  await registerBlogger(env, blogger, { stats: true, reach: '500-1000' });
  const { data } = await createCampaign(env, business, { title: 'Kitob', minFollowers: 0 });
  tg.clear();

  await api(env, blogger, `/api/campaigns/${data.campaign.id}/apply`, { method: 'POST', body: { message: 'Salom' } });
  const [note] = photosTo(810);
  assert.equal(note.body.photo, `stats-811`);
  const caption = note.body.caption;
  assert.match(caption, /Yangi so‘rov/);
  assert.match(caption, /📸 Instagram: <a href="https:\/\/instagram\.com\/dilnoza\.blog">instagram\.com\/dilnoza\.blog<\/a>/);
  assert.match(caption, /Istoriya \(o‘rtacha\): 500 – 1\s000/);
  assert.match(caption, /Telegrami va telefon raqami so‘rovni qabul qilganingizdan keyin/);
  assert.doesNotMatch(caption, /secret_blogger|tg:\/\/user|\+998/);

  // Mini ilovada ham username va telefon yashirin, statistika rasmi bor
  let reqs = (await api(env, business, '/api/requests')).data.requests;
  assert.equal(reqs[0].blogger.username, null);
  assert.equal(reqs[0].blogger.phone, null);
  assert.equal(reqs[0].blogger.reach, '500-1000');
  assert.match(reqs[0].blogger.statsImage, /^\/img\/s\/811-[0-9a-f]{16}\.jpg$/);
  const img = await getImage(env, reqs[0].blogger.statsImage);
  assert.equal(img.status, 200);
  assert.equal((await getImage(env, '/img/s/811-0123456789abcdef.jpg')).status, 404);

  // Qabul qilgach: xabar (rasm osti) Telegram va telefon bilan yangilanadi
  await api(env, business, `/api/applications/${reqs[0].id}/decision`, { method: 'POST', body: { decision: 'accept' } });
  const edited = tg.last('editMessageCaption').body.caption;
  assert.match(edited, /Qabul qilindi/);
  assert.match(edited, /tg:\/\/user\?id=811/);
  assert.match(edited, /@secret_blogger/);
  assert.match(edited, /\+998 93 555 66 77/);
  assert.doesNotMatch(edited, /qabul qilganingizdan keyin/);
  reqs = (await api(env, business, '/api/requests')).data.requests;
  assert.equal(reqs[0].blogger.username, 'secret_blogger');
  assert.equal(reqs[0].blogger.phone, '+998 93 555 66 77');
});

test('statistikasiz bloger so‘rovi oddiy matn bo‘lib keladi', async () => {
  const business = tgUser(820);
  const blogger = tgUser(821);
  await registerBusiness(env, business);
  await registerBlogger(env, blogger);
  const { data } = await createCampaign(env, business, { minFollowers: 0 });
  tg.clear();
  await api(env, blogger, `/api/campaigns/${data.campaign.id}/apply`, { method: 'POST', body: {} });
  assert.equal(photosTo(820).length, 0);
  assert.match(lastText(820), /Yangi so‘rov/);
  assert.doesNotMatch(lastText(820), /Statistika skrinshoti/);
  assert.equal((await api(env, business, '/api/requests')).data.requests[0].blogger.statsImage, null);
});

test('reklama e’loni tasdiqlanguncha blogerlarga ko‘rinmaydi', async () => {
  const business = tgUser(830);
  const blogger = tgUser(831);
  await registerBusiness(env, business);
  await registerBlogger(env, blogger);
  const { data } = await createCampaign(env, business, { title: 'Yangi kafe', minFollowers: 0, approve: false });
  const id = data.campaign.id;
  assert.equal(data.campaign.moderation, 'pending');

  // Blogerga ko'rinmaydi, so'rov ham yuborilmaydi; egasi esa holatini ko'radi
  assert.equal((await api(env, blogger, '/api/campaigns')).data.campaigns.length, 0);
  assert.equal((await api(env, blogger, `/api/campaigns/${id}`)).status, 404);
  assert.equal((await api(env, blogger, `/api/campaigns/${id}/apply`, { method: 'POST', body: {} })).status, 404);
  assert.equal((await api(env, business, `/api/campaigns/${id}`)).data.campaign.moderation, 'pending');
  assert.equal((await api(env, business, '/api/my/campaigns')).data.campaigns[0].moderation, 'pending');

  // Adminga karta: tasdiqlash/rad etish tugmalari
  const card = tg.sent(ADMIN).filter((c) => c.body.text.includes('#Yangi_elon')).at(-1);
  assert.match(card.body.text, /Moderatsiyada/);
  assert.deepEqual(card.body.reply_markup.inline_keyboard[0].map((b) => b.callback_data), [`cm:a:${id}`, `cm:r:${id}`]);

  // Moderator bo'lmagan tasdiqlay olmaydi
  await press(env, blogger, `cm:a:${id}`);
  assert.match(tg.last('answerCallbackQuery').body.text, /moderatorlar uchun/);

  await press(env, tgUser(ADMIN), `cm:a:${id}`);
  assert.match(tg.last('editMessageText').body.text, /E’lon tasdiqlandi/);
  assert.equal(tg.last('editMessageText').body.reply_markup.inline_keyboard[0][0].callback_data, `adm:close:${id}`);
  assert.match(lastText(830), /reklama e’loningiz tasdiqlandi/);
  assert.deepEqual((await api(env, blogger, '/api/campaigns')).data.campaigns.map((c) => c.title), ['Yangi kafe']);

  await press(env, tgUser(ADMIN), `cm:a:${id}`);
  assert.match(tg.last('answerCallbackQuery').body.text, /allaqachon/);
});

test('rad etilgan e’lon blogerlarga chiqmaydi va qayta ochilmaydi', async () => {
  const business = tgUser(840);
  const blogger = tgUser(841);
  await registerBusiness(env, business);
  await registerBlogger(env, blogger);
  const { data } = await createCampaign(env, business, { approve: false });
  const id = data.campaign.id;

  await press(env, tgUser(ADMIN), `cm:r:${id}`);
  assert.match(tg.last('editMessageText').body.text, /E’lon rad etildi/);
  assert.deepEqual(tg.last('editMessageText').body.reply_markup.inline_keyboard, []);
  assert.match(lastText(840), /tasdiqlanmadi/);
  assert.equal((await api(env, blogger, '/api/campaigns')).data.campaigns.length, 0);
  const own = (await api(env, business, `/api/campaigns/${id}`)).data.campaign;
  assert.equal(own.moderation, 'rejected');
  assert.equal(own.status, 'closed'); // faol e'lonlar limitidan joy egallamaydi

  const reopen = await api(env, business, `/api/campaigns/${id}`, { method: 'PATCH', body: { status: 'active' } });
  assert.equal(reopen.status, 409);
  assert.equal(reopen.data.error, 'campaign_rejected');
});

test('moderatsiyadagi e’longa rasm qo‘shilsa, rasm tasdiqlash tugmalari bilan keladi', async () => {
  const business = tgUser(850);
  await registerBusiness(env, business);
  const { data } = await createCampaign(env, business, { approve: false });
  const id = data.campaign.id;
  const { putImage, JPEG } = await import('./helpers.js');
  await putImage(env, business, id, JPEG);
  const card = photosTo(ADMIN).at(-1);
  assert.match(card.body.caption, /#Elon_rasmi/);
  assert.match(card.body.caption, /Moderatsiyada/);
  assert.equal(card.body.reply_markup.inline_keyboard[0][0].callback_data, `cm:a:${id}`);
});

test('/moderatsiya kutayotgan e’lonlarni ham yuboradi, /stats ularni sanaydi', async () => {
  const business = tgUser(860);
  await registerBusiness(env, business);
  await createCampaign(env, business, { title: 'Birinchi', approve: false });
  await createCampaign(env, business, { title: 'Ikkinchi', approve: false });
  tg.clear();

  await say(env, tgUser(ADMIN), '/moderatsiya');
  const texts = tg.sent(ADMIN).map((c) => c.body.text);
  assert.ok(texts.some((x) => /Moderatsiyada: 2 ta reklama e’loni/.test(x)));
  assert.equal(texts.filter((x) => x.includes('#Yangi_elon')).length, 2);

  await say(env, tgUser(ADMIN), '/stats');
  assert.match(lastText(ADMIN), /Moderatsiyada: 0 profil, 2 e’lon/);
});

test('moderatorlar bo‘lmasa e’lon darhol chiqadi', async () => {
  env = createEnv({ ADMIN_IDS: '' });
  const business = tgUser(870);
  const blogger = tgUser(871);
  await registerBusiness(env, business);
  await registerBlogger(env, blogger);
  const { data } = await createCampaign(env, business, { approve: false });
  assert.equal(data.campaign.moderation, 'approved');
  assert.equal((await api(env, blogger, '/api/campaigns')).data.campaigns.length, 1);
  await approve(env, blogger); // ADMIN_IDS bo'sh — hech narsa qilmaydi
});
