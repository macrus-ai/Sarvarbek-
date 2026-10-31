import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import {
  api, createCampaign, createEnv, fakeTelegram, press, registerBlogger, registerBusiness, signInitData, tgUser
} from './helpers.js';

let tg;
let env;
const business = tgUser(100, { username: 'aziz_shop' });
const blogger = tgUser(200, { username: 'dilnoza' });
const blogger2 = tgUser(201);

beforeEach(() => {
  tg = fakeTelegram();
  env = createEnv();
});
afterEach(() => tg.restore());

async function setup() {
  await registerBusiness(env, business);
  await registerBlogger(env, blogger);
  tg.clear();
}

test('initData bo‘lmasa yoki noto‘g‘ri bo‘lsa 401', async () => {
  assert.equal((await api(env, business, '/api/me', { initData: '' })).status, 401);
  assert.equal((await api(env, business, '/api/me', { initData: signInitData(business, { token: '1:x' }) })).status, 401);
});

test('ro‘yxatdan o‘tmagan foydalanuvchi', async () => {
  const me = await api(env, tgUser(300), '/api/me');
  assert.equal(me.status, 200);
  assert.equal(me.data.registered, false);
  assert.equal(me.data.meta.categories.length, 7);
  const list = await api(env, tgUser(300), '/api/campaigns');
  assert.equal(list.status, 403);
  assert.equal(list.data.error, 'not_registered');
});

test('kampaniya yaratish: tekshiruv va rollar', async () => {
  await setup();
  const bad = await createCampaign(env, business, { title: 'X', value: 10, platforms: ['MySpace'], days: 0 });
  assert.equal(bad.status, 400);
  assert.deepEqual(bad.data.fields.sort(), ['days', 'platforms', 'title', 'value']);

  const fromBlogger = await createCampaign(env, blogger);
  assert.equal(fromBlogger.status, 403);

  const ok = await createCampaign(env, business, { value: '180 000' });
  assert.equal(ok.status, 201);
  assert.equal(ok.data.campaign.value, 180000);
  assert.equal(ok.data.campaign.businessName, 'Tabiiy kosmetika');
  assert.equal(ok.data.campaign.left, 2);
  assert.equal(ok.data.campaign.own, true);
});

test('kampaniyalar ro‘yxati: filtrlar va qidiruv', async () => {
  await setup();
  await createCampaign(env, business, { title: 'Tabiiy yuz kremi', category: 'beauty', platforms: ['Instagram'] });
  await createCampaign(env, business, { title: 'Ikki kishilik kechki ovqat', category: 'food', platforms: ['TikTok', 'Instagram'], city: 'Samarqand' });

  const all = await api(env, blogger, '/api/campaigns');
  assert.equal(all.data.campaigns.length, 2);
  assert.equal(all.data.campaigns[0].pending, undefined); // boshqa biznesning so'rovlar soni ko'rinmaydi

  const food = await api(env, blogger, '/api/campaigns?category=food');
  assert.deepEqual(food.data.campaigns.map((c) => c.title), ['Ikki kishilik kechki ovqat']);

  const tiktok = await api(env, blogger, '/api/campaigns?platform=TikTok');
  assert.equal(tiktok.data.campaigns.length, 1);

  const search = await api(env, blogger, `/api/campaigns?q=${encodeURIComponent("samarqand")}`);
  assert.equal(search.data.campaigns.length, 1);
});

test('bloger so‘rov yuboradi, biznesga bot orqali tugmali xabar boradi', async () => {
  await setup();
  const { data } = await createCampaign(env, business);
  const id = data.campaign.id;

  const res = await api(env, blogger, `/api/campaigns/${id}/apply`, { method: 'POST', body: { message: 'Auditoriyam ayollar, 25–35 yosh' } });
  assert.equal(res.status, 201);

  const notice = tg.sent(100).at(-1);
  assert.match(notice.body.text, /Yangi so‘rov/);
  assert.match(notice.body.text, /Dilnoza/);
  assert.match(notice.body.text, /Auditoriyam ayollar/);
  assert.doesNotMatch(notice.body.text, /935556677/); // telefon qabul qilinguncha ko'rinmaydi
  const buttons = notice.body.reply_markup.inline_keyboard.flat();
  assert.ok(buttons.some((b) => b.callback_data === `ap:a:${res.data.application.id}`));
  assert.ok(buttons.some((b) => b.callback_data === `ap:r:${res.data.application.id}`));

  const again = await api(env, blogger, `/api/campaigns/${id}/apply`, { method: 'POST', body: {} });
  assert.equal(again.status, 409);
  assert.equal(again.data.error, 'already_applied');

  const detail = await api(env, blogger, `/api/campaigns/${id}`);
  assert.equal(detail.data.campaign.myStatus, 'pending');

  const fromBusiness = await api(env, business, `/api/campaigns/${id}/apply`, { method: 'POST', body: {} });
  assert.equal(fromBusiness.status, 403);
});

test('obunachilar yetmasa so‘rov qabul qilinmaydi', async () => {
  await setup();
  await registerBlogger(env, blogger2, { followers: '1000-5000' });
  const { data } = await createCampaign(env, business, { minFollowers: 10000 });
  const res = await api(env, blogger2, `/api/campaigns/${data.campaign.id}/apply`, { method: 'POST', body: {} });
  assert.equal(res.status, 409);
  assert.equal(res.data.error, 'followers_low');
  assert.equal(res.data.min, 10000);
});

test('biznes ilovada qabul qiladi: blogerga aloqa ma’lumotlari boradi', async () => {
  await setup();
  const { data } = await createCampaign(env, business);
  const applied = await api(env, blogger, `/api/campaigns/${data.campaign.id}/apply`, { method: 'POST', body: {} });
  const appId = applied.data.application.id;
  const businessMessageId = tg.sent(100).at(-1);
  tg.clear();

  const res = await api(env, business, `/api/applications/${appId}/decision`, { method: 'POST', body: { decision: 'accept' } });
  assert.equal(res.status, 200);
  assert.equal(res.data.application.status, 'accepted');

  const toBlogger = tg.sent(200).at(-1);
  assert.match(toBlogger.body.text, /qabul qilindi/);
  assert.match(toBlogger.body.text, /\+998 90 111 22 33/);
  assert.match(toBlogger.body.text, /@aziz_shop/);

  const edited = tg.last('editMessageText');
  assert.equal(edited.body.chat_id, 100);
  assert.ok(businessMessageId);
  assert.deepEqual(edited.body.reply_markup.inline_keyboard, []);
  assert.match(edited.body.text, /Qabul qilindi/);

  const mine = await api(env, blogger, '/api/my/applications');
  assert.equal(mine.data.applications[0].status, 'accepted');
  assert.equal(mine.data.applications[0].contact.phone, '+998 90 111 22 33');

  const requests = await api(env, business, '/api/requests');
  assert.equal(requests.data.requests[0].blogger.phone, '+998 93 555 66 77');
  assert.equal(requests.data.requests[0].blogger.profileUrl, 'https://instagram.com/dilnoza.blog');

  const twice = await api(env, business, `/api/applications/${appId}/decision`, { method: 'POST', body: { decision: 'reject' } });
  assert.equal(twice.status, 409);
  assert.equal(twice.data.error, 'already_decided');
});

test('biznes bot tugmasi orqali rad etadi', async () => {
  await setup();
  const { data } = await createCampaign(env, business);
  const applied = await api(env, blogger, `/api/campaigns/${data.campaign.id}/apply`, { method: 'POST', body: {} });
  tg.clear();

  await press(env, business, `ap:r:${applied.data.application.id}`);
  assert.match(tg.last('answerCallbackQuery').body.text, /Rad etildi/);
  assert.match(tg.sent(200).at(-1).body.text, /rad etildi/);

  const mine = await api(env, blogger, '/api/my/applications');
  assert.equal(mine.data.applications[0].status, 'rejected');
  assert.equal(mine.data.applications[0].contact, null);
});

test('boshqa biznes birovning so‘roviga qaror qila olmaydi', async () => {
  await setup();
  const other = tgUser(101);
  await registerBusiness(env, other, { company: 'Boshqa do‘kon' });
  const { data } = await createCampaign(env, business);
  const applied = await api(env, blogger, `/api/campaigns/${data.campaign.id}/apply`, { method: 'POST', body: {} });

  const res = await api(env, other, `/api/applications/${applied.data.application.id}/decision`, { method: 'POST', body: { decision: 'accept' } });
  assert.equal(res.status, 404);

  tg.clear();
  await press(env, other, `ap:a:${applied.data.application.id}`);
  assert.equal(tg.last('answerCallbackQuery').body.show_alert, true);
  assert.equal(tg.sent(200).length, 0);
});

test('o‘rinlar to‘lsa yangi so‘rov va qabul to‘xtaydi', async () => {
  await setup();
  await registerBlogger(env, blogger2);
  const blogger3 = tgUser(202);
  await registerBlogger(env, blogger3);
  const { data } = await createCampaign(env, business, { slots: 1 });
  const id = data.campaign.id;

  const a1 = await api(env, blogger, `/api/campaigns/${id}/apply`, { method: 'POST', body: {} });
  const a2 = await api(env, blogger2, `/api/campaigns/${id}/apply`, { method: 'POST', body: {} });
  await api(env, business, `/api/applications/${a1.data.application.id}/decision`, { method: 'POST', body: { decision: 'accept' } });

  const full = await api(env, business, `/api/applications/${a2.data.application.id}/decision`, { method: 'POST', body: { decision: 'accept' } });
  assert.equal(full.status, 409);
  assert.equal(full.data.error, 'campaign_full');

  const late = await api(env, blogger3, `/api/campaigns/${id}/apply`, { method: 'POST', body: {} });
  assert.equal(late.data.error, 'campaign_full');

  // Rad etish baribir mumkin
  const reject = await api(env, business, `/api/applications/${a2.data.application.id}/decision`, { method: 'POST', body: { decision: 'reject' } });
  assert.equal(reject.status, 200);
});

test('kampaniyani yopish va qayta ochish', async () => {
  await setup();
  const { data } = await createCampaign(env, business);
  const id = data.campaign.id;

  const closed = await api(env, business, `/api/campaigns/${id}`, { method: 'PATCH', body: { status: 'closed' } });
  assert.equal(closed.data.campaign.status, 'closed');
  assert.equal((await api(env, blogger, '/api/campaigns')).data.campaigns.length, 0);
  assert.equal((await api(env, blogger, `/api/campaigns/${id}`)).status, 404);

  const notOwner = await api(env, blogger, `/api/campaigns/${id}`, { method: 'PATCH', body: { status: 'active' } });
  assert.equal(notOwner.status, 403);

  const reopened = await api(env, business, `/api/campaigns/${id}`, { method: 'PATCH', body: { status: 'active' } });
  assert.equal(reopened.data.campaign.status, 'active');

  const mine = await api(env, business, '/api/my/campaigns');
  assert.equal(mine.data.campaigns.length, 1);
  assert.equal(mine.data.campaigns[0].pending, 0);
});

test('faol kampaniyalar soni cheklangan', async () => {
  await setup();
  for (let i = 0; i < 20; i += 1) await createCampaign(env, business, { title: `Kampaniya ${i + 1}` });
  const extra = await createCampaign(env, business, { title: 'Ortiqcha kampaniya' });
  assert.equal(extra.status, 409);
  assert.equal(extra.data.error, 'too_many_campaigns');
});
