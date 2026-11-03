import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import worker from '../src/index.js';
import {
  ORIGIN, api, createCampaign, createEnv, fakeTelegram, registerBlogger, registerBusiness, say, sendUpdate, tgUser
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

// Botdan havola olib, panelga kiradi; sessiya cookie'sini qaytaradi
async function loginLink() {
  await say(env, tgUser(ADMIN), '/admin');
  return tg.sent(ADMIN).at(-1).body.reply_markup.inline_keyboard[0][0].url;
}

async function login() {
  const res = await worker.fetch(new Request(await loginLink()), env);
  assert.equal(res.status, 200);
  return res.headers.get('set-cookie').split(';')[0];
}

async function panel(cookie, path, { method = 'GET', body, csrf = true } = {}) {
  const res = await worker.fetch(
    new Request(`${ORIGIN}${path}`, {
      method,
      headers: {
        ...(cookie ? { cookie } : {}),
        ...(csrf ? { 'x-ovoza-admin': '1' } : {}),
        ...(body ? { 'content-type': 'application/json' } : {})
      },
      body: body ? JSON.stringify(body) : undefined
    }),
    env
  );
  return { status: res.status, data: await res.json(), headers: res.headers };
}

test('kirish: /admin faqat adminga bir martalik havola beradi, sessiya cookie bilan', async () => {
  // Admin bo'lmagan foydalanuvchi havola olmaydi
  const user = tgUser(1500);
  await registerBlogger(env, user);
  await say(env, user, '/admin');
  assert.doesNotMatch(lastText(1500), /Admin panel/);

  const url = await loginLink();
  assert.match(url, new RegExp(`^${ORIGIN}/admin/login\\?t=[0-9a-f]{64}$`));
  assert.doesNotMatch(lastText(ADMIN), /admin\/login/); // havola matnda emas, faqat tugmada

  const res = await worker.fetch(new Request(url), env);
  assert.equal(res.status, 200);
  const setCookie = res.headers.get('set-cookie');
  assert.match(setCookie, /^ovoza_admin=[0-9a-f]{64}; Path=\/; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000$/);
  assert.match(await res.text(), /\/admin\//);
  const cookie = setCookie.split(';')[0];

  // Havola bir martalik
  assert.equal((await worker.fetch(new Request(url), env)).status, 400);
  assert.equal((await worker.fetch(new Request(`${ORIGIN}/admin/login?t=abc`), env)).status, 400);

  // Cookie'siz — 401 (kirish sahifasi uchun bot nomi bilan), cookie bilan — admin
  const anon = await panel(null, '/api/admin/me');
  assert.equal(anon.status, 401);
  assert.equal(anon.data.bot, 'ovoza_test_bot');
  const me = await panel(cookie, '/api/admin/me');
  assert.equal(me.status, 200);
  assert.equal(me.data.admin.id, ADMIN);

  // O'zgartiruvchi so'rov maxsus sarlavhasiz bajarilmaydi (boshqa saytdan yuborib bo'lmaydi)
  assert.equal((await panel(cookie, '/api/admin/logout', { method: 'POST', csrf: false })).status, 403);

  const out = await panel(cookie, '/api/admin/logout', { method: 'POST' });
  assert.match(out.headers.get('set-cookie'), /Max-Age=0/);
  assert.equal((await panel(cookie, '/api/admin/me')).status, 401);
});

test('kirish: muddati o‘tgan havola va ADMIN_IDS dan olib tashlangan admin', async () => {
  const url = await loginLink();
  await env.DB.prepare('UPDATE admin_tokens SET expires_at = 1').run();
  assert.equal((await worker.fetch(new Request(url), env)).status, 400);

  const cookie = await login();
  assert.equal((await panel(cookie, '/api/admin/me')).status, 200);
  env.ADMIN_IDS = '12345';
  assert.equal((await panel(cookie, '/api/admin/me')).status, 401);
});

test('panel: statistika, profil va e’lonlar moderatsiyasi', async () => {
  const blogger = tgUser(1510);
  const business = tgUser(1511);
  const approved = tgUser(1512);
  await registerBlogger(env, blogger, { approve: false });
  await registerBusiness(env, business, { approve: false });
  await registerBusiness(env, approved, { company: 'Kafe Samarqand' });
  const { data } = await createCampaign(env, approved, { title: 'Kafe kechki ovqat', minFollowers: 0, approve: false });
  const adId = data.campaign.id;
  const cookie = await login();

  const stats = (await panel(cookie, '/api/admin/stats')).data;
  assert.equal(stats.pendingUsers, 2);
  assert.equal(stats.pendingAds, 1);
  assert.equal(stats.businesses, 2);
  assert.equal(stats.bloggers, 1);
  assert.equal(stats.week.users, 3);

  const pending = (await panel(cookie, '/api/admin/users?status=pending')).data;
  assert.equal(pending.total, 2);
  const card = pending.users.find((u) => u.id === 1510);
  assert.equal(card.role, 'blogger');
  assert.equal(card.profileUrl, 'https://instagram.com/dilnoza.blog');
  assert.equal(card.region, 'Toshkent shahri');
  assert.equal(card.phone, '+998 93 555 66 77');

  // Tasdiqlash — foydalanuvchiga botda xabar boradi
  tg.clear();
  const ok = await panel(cookie, '/api/admin/users/1510/moderation', { method: 'POST', body: { action: 'approve' } });
  assert.equal(ok.status, 200);
  assert.equal(ok.data.user.moderation, 'approved');
  assert.match(lastText(1510), /Profilingiz tasdiqlandi/);
  const again = await panel(cookie, '/api/admin/users/1510/moderation', { method: 'POST', body: { action: 'approve' } });
  assert.equal(again.status, 409);

  const rejected = await panel(cookie, '/api/admin/users/1511/moderation', { method: 'POST', body: { action: 'reject' } });
  assert.equal(rejected.data.user.moderation, 'rejected');
  assert.match(lastText(1511), /tasdiqlanmadi/);
  assert.equal((await panel(cookie, '/api/admin/users/1511/moderation', { method: 'POST', body: { action: 'x' } })).status, 400);

  // E'lon: moderatsiyadagilar ro'yxati, tasdiqlash, yopish
  const ads = (await panel(cookie, '/api/admin/campaigns?moderation=pending')).data;
  assert.equal(ads.campaigns.length, 1);
  assert.equal(ads.campaigns[0].business.company, 'Kafe Samarqand');
  const approvedAd = await panel(cookie, `/api/admin/campaigns/${adId}/moderation`, { method: 'POST', body: { action: 'approve' } });
  assert.equal(approvedAd.data.campaign.moderation, 'approved');
  assert.match(lastText(1512), /reklama e’loningiz tasdiqlandi/);
  assert.deepEqual((await api(env, blogger, '/api/campaigns')).data.campaigns.map((c) => c.title), ['Kafe kechki ovqat']);

  const closed = await panel(cookie, `/api/admin/campaigns/${adId}/close`, { method: 'POST' });
  assert.equal(closed.data.campaign.status, 'closed');
  assert.match(lastText(1512), /moderator tomonidan yopildi/);
  assert.equal((await panel(cookie, `/api/admin/campaigns/${adId}/close`, { method: 'POST' })).status, 409);
  assert.equal((await api(env, blogger, '/api/campaigns')).data.campaigns.length, 0);
  assert.equal((await panel(cookie, '/api/admin/campaigns/9999/close', { method: 'POST' })).status, 404);
});

test('panel: qidiruv, foydalanuvchi tafsiloti, so‘rovlar va o‘chirish', async () => {
  const blogger = tgUser(1520, { username: 'madina_blog' });
  const business = tgUser(1521);
  await registerBlogger(env, blogger);
  await registerBusiness(env, business, { company: 'Gul do‘koni' });
  const { data } = await createCampaign(env, business, { minFollowers: 0 });
  await api(env, blogger, `/api/campaigns/${data.campaign.id}/apply`, { method: 'POST', body: { message: 'Salom' } });
  const cookie = await login();

  const find = async (q) => (await panel(cookie, `/api/admin/users?q=${encodeURIComponent(q)}`)).data.users.map((u) => u.id);
  assert.deepEqual(await find('gul'), [1521]);
  assert.deepEqual(await find('madina_'), [1520]);
  assert.deepEqual(await find('93 555'), [1520]); // telefon raqami bo'shliq bilan
  assert.deepEqual(await find('1521'), [1521]); // Telegram ID
  assert.deepEqual(await find('100%'), []);
  assert.equal((await panel(cookie, '/api/admin/users?role=business')).data.total, 1);

  const biz = (await panel(cookie, '/api/admin/users/1521')).data;
  assert.equal(biz.user.company, 'Gul do‘koni');
  assert.equal(biz.campaigns.length, 1);
  assert.equal(biz.campaigns[0].applications, 1);
  const blog = (await panel(cookie, '/api/admin/users/1520')).data;
  assert.equal(blog.applications[0].campaign.id, data.campaign.id);

  const apps = (await panel(cookie, '/api/admin/applications?status=pending')).data;
  assert.equal(apps.total, 1);
  assert.equal(apps.applications[0].blogger.name, 'Dilnoza');
  assert.equal(apps.applications[0].business.company, 'Gul do‘koni');
  assert.equal((await panel(cookie, '/api/admin/applications?status=accepted')).data.total, 0);

  const ad = (await panel(cookie, `/api/admin/campaigns/${data.campaign.id}`)).data;
  assert.equal(ad.campaign.business.company, 'Gul do‘koni');
  assert.equal(ad.campaign.applications, 1);
  assert.deepEqual(ad.applications.map((a) => a.blogger.id), [1520]);
  assert.equal((await panel(cookie, '/api/admin/campaigns/9999')).status, 404);

  // O'chirish: biznes, uning e'lonlari va ularga kelgan so'rovlar
  assert.equal((await panel(cookie, '/api/admin/users/1521', { method: 'DELETE' })).status, 200);
  assert.equal((await panel(cookie, '/api/admin/users/1521')).status, 404);
  assert.equal((await panel(cookie, '/api/admin/applications')).data.total, 0);
  assert.equal((await panel(cookie, '/api/admin/users/1521', { method: 'DELETE' })).status, 404);
});

test('panel: guruhlar sozlamasi', async () => {
  const cookie = await login();
  let s = (await panel(cookie, '/api/admin/settings')).data;
  assert.equal(s.groups.blogger, null);
  assert.equal(s.bot, 'ovoza_test_bot');

  await sendUpdate(env, {
    message: { message_id: 5, date: 0, chat: { id: -100700, type: 'supergroup', title: 'Moderatsiya' }, from: tgUser(ADMIN), text: '/ulash' }
  });
  s = (await panel(cookie, '/api/admin/settings')).data;
  assert.equal(s.groups.blogger.id, -100700);
  assert.equal(s.groups.ads.id, -100700);

  s = (await panel(cookie, '/api/admin/settings/groups/ads', { method: 'DELETE' })).data;
  assert.equal(s.groups.ads, null);
  assert.equal(s.groups.business.id, -100700);
});
