// Xavfsiz barter: bloger natijani yuboradi, biznes tasdiqlaydi, keys saytda chiqadi
import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import worker from '../src/index.js';
import { normalizePostUrl } from '../src/results.js';
import {
  ORIGIN, api, createCampaign, createEnv, fakeTelegram, press, putImage, JPEG, registerBlogger, registerBusiness, tgUser
} from './helpers.js';

let tg;
let env;
const business = tgUser(100, { username: 'aziz_shop' });
const blogger = tgUser(200, { username: 'dilnoza' });
const blogger2 = tgUser(201);
const admin = tgUser(999);

beforeEach(() => {
  tg = fakeTelegram();
  env = createEnv();
});
afterEach(() => tg.restore());

const getPublic = async (path, init = {}) => {
  const res = await worker.fetch(new Request(`${ORIGIN}${path}`, init), env);
  return { status: res.status, headers: res.headers, data: res.status === 204 ? null : await res.json() };
};

// Biznes, bloger, tasdiqlangan e'lon va qabul qilingan so'rov
async function accepted({ who = blogger } = {}) {
  await registerBusiness(env, business);
  await registerBlogger(env, who);
  const campaign = (await createCampaign(env, business)).data.campaign;
  const app = (await api(env, who, `/api/campaigns/${campaign.id}/apply`, { method: 'POST', body: {} })).data.application;
  await api(env, business, `/api/applications/${app.id}/decision`, { method: 'POST', body: { decision: 'accept' } });
  tg.clear();
  return { campaign, appId: app.id };
}

const submit = (appId, body = {}, who = blogger) =>
  api(env, who, `/api/applications/${appId}/result`, {
    method: 'POST',
    body: { postUrl: 'https://www.instagram.com/reel/ABC123/', views: '12 500', note: 'Krem juda yoqdi', ...body }
  });

test('post havolasi tekshiruvi', () => {
  assert.equal(normalizePostUrl('instagram.com/reel/ABC'), 'https://instagram.com/reel/ABC');
  assert.equal(normalizePostUrl('https://t.me/kanal/15'), 'https://t.me/kanal/15');
  assert.equal(normalizePostUrl('javascript:alert(1)'), null);
  assert.equal(normalizePostUrl('salom'), null);
  assert.equal(normalizePostUrl(''), null);
  assert.equal(normalizePostUrl(`https://a.uz/${'x'.repeat(400)}`), null);
});

test('qabul qilinganda bloger va biznesga xavfsiz barter haqida aytiladi', async () => {
  await registerBusiness(env, business);
  await registerBlogger(env, blogger);
  const campaign = (await createCampaign(env, business)).data.campaign;
  const app = (await api(env, blogger, `/api/campaigns/${campaign.id}/apply`, { method: 'POST', body: {} })).data.application;
  tg.clear();
  await api(env, business, `/api/applications/${app.id}/decision`, { method: 'POST', body: { decision: 'accept' } });
  assert.match(tg.sent(blogger.id).at(-1).body.text, /Xavfsiz barter/);
});

test('bloger natijani yuboradi: biznesga tugmalar bilan xabar boradi', async () => {
  const { appId } = await accepted();
  const res = await submit(appId);
  assert.equal(res.status, 200);
  assert.equal(res.data.result.status, 'submitted');
  assert.equal(res.data.result.views, 12500);

  const msg = tg.sent(business.id).at(-1);
  assert.match(msg.body.text, /Bloger reklamani joyladi/);
  assert.match(msg.body.text, /instagram\.com\/reel\/ABC123/);
  const buttons = msg.body.reply_markup.inline_keyboard.flat();
  assert.ok(buttons.some((b) => b.callback_data === `rs:c:${appId}`));
  assert.ok(buttons.some((b) => b.callback_data === `rs:d:${appId}`));
  assert.ok(buttons.some((b) => b.url === 'https://www.instagram.com/reel/ABC123/'));

  // Ilovada ikkala tomon ham natijani ko'radi
  const mine = (await api(env, blogger, '/api/my/applications')).data.applications[0];
  assert.equal(mine.result.status, 'submitted');
  const req = (await api(env, business, '/api/requests')).data.requests[0];
  assert.equal(req.result.postUrl, 'https://www.instagram.com/reel/ABC123/');
});

test('natija: noto‘g‘ri ma’lumot, begona so‘rov va qabul qilinmagan so‘rov', async () => {
  const { campaign, appId } = await accepted();
  const bad = await submit(appId, { postUrl: 'salom', views: '-5' });
  assert.equal(bad.status, 400);
  assert.deepEqual(bad.data.fields.sort(), ['postUrl', 'views']);

  await registerBlogger(env, blogger2);
  assert.equal((await submit(appId, {}, blogger2)).status, 404);
  assert.equal((await submit(appId, {}, business)).status, 403);

  const app2 = (await api(env, blogger2, `/api/campaigns/${campaign.id}/apply`, { method: 'POST', body: {} })).data.application;
  const pending = await submit(app2.id, {}, blogger2);
  assert.equal(pending.status, 409);
  assert.equal(pending.data.error, 'not_accepted');
});

test('biznes botda "Bajarildi" bosadi: keys saytda chiqadi, jamoaga va blogerga xabar', async () => {
  const { campaign, appId } = await accepted();
  await submit(appId);
  tg.clear();

  await press(env, business, `rs:c:${appId}`, 'Bloger reklamani joyladi');
  const toBlogger = tg.sent(blogger.id).at(-1).body.text;
  assert.match(toBlogger, /Biznes natijani tasdiqladi/);
  const link = toBlogger.match(/https:\/\/miqyos\.uz\/keyslar\.html\?b=([a-z0-9]+)/);
  assert.ok(link, toBlogger);
  const publicId = link[1];
  // Jamoaga "Yangi keys" kartasi (guruh yo'q: adminga shaxsan)
  const card = tg.sent(admin.id).at(-1);
  assert.match(card.body.text, /Yangi keys/);
  assert.equal(card.body.reply_markup.inline_keyboard[0][0].callback_data, `cs:h:${appId}`);

  // Qayta bosish: allaqachon
  await press(env, business, `rs:c:${appId}`);
  assert.equal(tg.last('answerCallbackQuery').body.text, 'Bu natija bo‘yicha qaror allaqachon qabul qilingan.');
  // Tasdiqlangan natijani bloger o'zgartira olmaydi
  assert.equal((await submit(appId)).data.error, 'result_confirmed');

  // Ochiq API: ro'yxat
  const list = await getPublic('/public/cases');
  assert.equal(list.status, 200);
  assert.equal(list.headers.get('access-control-allow-origin'), '*');
  assert.equal(list.data.businesses.length, 1);
  const b = list.data.businesses[0];
  assert.equal(b.id, publicId);
  assert.equal(b.name, 'Tabiiy kosmetika');
  assert.equal(b.cases, 1);
  assert.equal(b.views, 12500);
  assert.equal(list.data.totals.cases, 1);
  // Telegram ID, telefon yo'q
  assert.doesNotMatch(JSON.stringify(list.data), /998|"100"|"200"/);

  // Ochiq API: biznes sahifasi, har bir e'lon bo'yicha natijalar
  const page = await getPublic(`/public/cases/${publicId}`);
  assert.equal(page.status, 200);
  assert.equal(page.data.business.cases, 1);
  assert.equal(page.data.campaigns.length, 1);
  const c = page.data.campaigns[0];
  assert.equal(c.id, campaign.id);
  assert.equal(c.title, 'Tabiiy yuz kremi');
  assert.equal(c.results.length, 1);
  const r = c.results[0];
  assert.equal(r.postUrl, 'https://www.instagram.com/reel/ABC123/');
  assert.equal(r.postPlatform, 'Instagram');
  assert.equal(r.blogger.name, 'Dilnoza');
  assert.equal(r.blogger.profileUrl, 'https://instagram.com/dilnoza.blog');
  assert.doesNotMatch(JSON.stringify(page.data), /998|dilnoza"|aziz_shop/);

  assert.equal((await getPublic('/public/cases/yoqid123')).status, 404);
  assert.equal((await getPublic('/public/cases', { method: 'OPTIONS' })).status, 204);
});

test('biznes ilovada tasdiqlaydi: fikr va baho saytda ko‘rinadi, keyin o‘zgartirsa bo‘ladi', async () => {
  const { appId } = await accepted();
  await submit(appId);
  const bad = await api(env, business, `/api/applications/${appId}/result/decision`, {
    method: 'POST',
    body: { decision: 'confirm', rating: 7 }
  });
  assert.equal(bad.status, 400);

  const ok = await api(env, business, `/api/applications/${appId}/result/decision`, {
    method: 'POST',
    body: { decision: 'confirm', review: 'Video zo‘r chiqdi, 30 ta buyurtma keldi', rating: 5 }
  });
  assert.equal(ok.status, 200);
  assert.equal(ok.data.result.status, 'confirmed');
  assert.equal(ok.data.result.rating, 5);

  const updated = await api(env, business, `/api/applications/${appId}/review`, {
    method: 'POST',
    body: { review: 'Yana hamkorlik qilamiz', rating: 4 }
  });
  assert.equal(updated.data.result.review, 'Yana hamkorlik qilamiz');

  const id = (await getPublic('/public/cases')).data.businesses[0].id;
  const page = await getPublic(`/public/cases/${id}`);
  assert.equal(page.data.campaigns[0].results[0].review, 'Yana hamkorlik qilamiz');
  assert.equal(page.data.business.rating, 4);
});

test('"Muammo bor": bloger va jamoaga xabar, bloger qayta yuboradi, saytda ko‘rinmaydi', async () => {
  const { appId } = await accepted();
  await submit(appId);
  tg.clear();

  const res = await api(env, business, `/api/applications/${appId}/result/decision`, {
    method: 'POST',
    body: { decision: 'dispute', note: 'Stories chiqmadi' }
  });
  assert.equal(res.data.result.status, 'disputed');
  assert.match(tg.sent(blogger.id).at(-1).body.text, /muammo borligini aytdi[\s\S]*Stories chiqmadi/);
  const card = tg.sent(admin.id).at(-1).body.text;
  assert.match(card, /#Muammo/);
  assert.match(card, /\+998/); // jamoa ikki tomonning telefonini ko'radi
  assert.equal((await getPublic('/public/cases')).data.businesses.length, 0);

  const mine = (await api(env, blogger, '/api/my/applications')).data.applications[0];
  assert.equal(mine.result.disputeNote, 'Stories chiqmadi');

  tg.clear();
  const again = await submit(appId, { postUrl: 'https://instagram.com/stories/dilnoza.blog/1' });
  assert.equal(again.data.result.status, 'submitted');
  assert.match(tg.sent(business.id).at(-1).body.text, /qayta yubordi/);
});

test('jamoa keysni saytdan yashiradi va qaytaradi', async () => {
  const { appId } = await accepted();
  await submit(appId);
  await press(env, business, `rs:c:${appId}`);

  // Oddiy foydalanuvchi yashira olmaydi
  await press(env, blogger, `cs:h:${appId}`);
  assert.equal((await getPublic('/public/cases')).data.businesses.length, 1);

  await press(env, admin, `cs:h:${appId}`, '#Keys');
  assert.equal((await getPublic('/public/cases')).data.businesses.length, 0);
  const markup = tg.last('editMessageReplyMarkup').body.reply_markup;
  assert.equal(markup.inline_keyboard[0][0].callback_data, `cs:s:${appId}`);

  await press(env, admin, `cs:s:${appId}`, '#Keys');
  assert.equal((await getPublic('/public/cases')).data.businesses.length, 1);
});

test('biznes sahifasida natijasi yo‘q e’lonlar ham bor, rasm to‘liq manzil bilan', async () => {
  const { appId } = await accepted();
  const second = (await createCampaign(env, business, { title: 'Soch uchun moy' })).data.campaign;
  await putImage(env, business, second.id, JPEG);
  await submit(appId);
  await press(env, business, `rs:c:${appId}`);

  const id = (await getPublic('/public/cases')).data.businesses[0].id;
  const page = await getPublic(`/public/cases/${id}`);
  assert.equal(page.data.campaigns.length, 2);
  // Natijasi bor e'lon birinchi
  assert.equal(page.data.campaigns[0].results.length, 1);
  assert.equal(page.data.campaigns[1].title, 'Soch uchun moy');
  assert.equal(page.data.campaigns[1].results.length, 0);
  assert.ok(page.data.campaigns[1].image.url.startsWith(`${ORIGIN}/img/c/`));
});

test('biznes o‘chirilsa keyslari ham yo‘qoladi', async () => {
  const { appId } = await accepted();
  await submit(appId);
  await press(env, business, `rs:c:${appId}`);
  await api(env, business, '/api/me/delete', { method: 'POST', body: {} });
  assert.equal((await getPublic('/public/cases')).data.businesses.length, 0);
});
