import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, test } from 'node:test';
import {
  api, createCampaign, createEnv, fakeTelegram, registerBlogger, registerBusiness, tgUser
} from './helpers.js';

let tg;
let env;
beforeEach(() => {
  tg = fakeTelegram();
  env = createEnv();
});
afterEach(() => tg.restore());

const titles = (res) => res.data.campaigns.map((c) => c.title);

// Bir biznes, uch xil hududdagi e'lonlar va Samarqanddagi bloger
async function setup() {
  const business = tgUser(600);
  const blogger = tgUser(601);
  await registerBusiness(env, business);
  await registerBlogger(env, blogger, { followers: '5000-10000', region: 'samarkand' });
  const mk = (title, extra) => createCampaign(env, business, { title, minFollowers: 0, ...extra });
  const ids = {
    tashkent: (await mk('Toshkent kafesi', { region: 'tashkent_city', value: 300000 })).data.campaign.id,
    samarkand: (await mk('Samarqand saloni', { region: 'samarkand', value: 120000 })).data.campaign.id,
    all: (await mk('Yetkazib beriladigan krem', { region: 'all', value: 90000 })).data.campaign.id,
    big: (await mk('Katta blogerlar uchun', { region: 'samarkand', value: 500000, minFollowers: 50000 })).data.campaign.id
  };
  return { business, blogger, ids };
}

test('hudud filtri: tanlangan hudud va butun O‘zbekiston uchun e’lonlar', async () => {
  const { blogger } = await setup();
  const all = await api(env, blogger, '/api/campaigns');
  assert.equal(all.data.campaigns.length, 4);

  const sam = await api(env, blogger, '/api/campaigns?region=samarkand');
  assert.deepEqual(titles(sam).sort(), ['Katta blogerlar uchun', 'Samarqand saloni', 'Yetkazib beriladigan krem']);
  assert.equal(sam.data.campaigns.find((c) => c.title === 'Samarqand saloni').region, 'samarkand');

  const tash = await api(env, blogger, '/api/campaigns?region=tashkent_city');
  assert.deepEqual(titles(tash).sort(), ['Toshkent kafesi', 'Yetkazib beriladigan krem']);

  // Noma'lum hudud e'tiborsiz qoldiriladi
  assert.equal((await api(env, blogger, '/api/campaigns?region=mars')).data.campaigns.length, 4);
});

test('saralash: yangilari yoki qiymati yuqorilari', async () => {
  const { blogger } = await setup();
  const byNew = await api(env, blogger, '/api/campaigns');
  assert.equal(byNew.data.campaigns[0].title, 'Katta blogerlar uchun'); // oxirgi joylangan
  const byValue = await api(env, blogger, '/api/campaigns?sort=value');
  assert.deepEqual(
    byValue.data.campaigns.map((c) => c.value),
    [500000, 300000, 120000, 90000]
  );
});

test('“Menga mos”: obunachi talabi, bo‘sh o‘rin, hudud va yuborilgan so‘rov hisobga olinadi', async () => {
  const { business, blogger, ids } = await setup();
  const fit = await api(env, blogger, '/api/campaigns?fit=1');
  // Toshkent e'loni (boshqa hudud) va 50 000 obunachi talab qiladigan e'lon chiqmaydi
  assert.deepEqual(titles(fit).sort(), ['Samarqand saloni', 'Yetkazib beriladigan krem']);

  // So'rov yuborilgan e'lon ham chiqmaydi
  await api(env, blogger, `/api/campaigns/${ids.samarkand}/apply`, { method: 'POST', body: {} });
  assert.deepEqual(titles(await api(env, blogger, '/api/campaigns?fit=1')), ['Yetkazib beriladigan krem']);

  // O'rinlar to'lgan e'lon ham chiqmaydi
  const full = (await createCampaign(env, business, { title: 'Bir o‘rinli', region: 'all', minFollowers: 0, slots: 1 })).data.campaign.id;
  const other = tgUser(602);
  await registerBlogger(env, other, { region: 'samarkand' });
  const app = await api(env, other, `/api/campaigns/${full}/apply`, { method: 'POST', body: {} });
  await api(env, business, `/api/applications/${app.data.application.id}/decision`, { method: 'POST', body: { decision: 'accept' } });
  assert.ok(!titles(await api(env, blogger, '/api/campaigns?fit=1')).includes('Bir o‘rinli'));

  // Filtrlar birga ishlaydi
  const combined = await api(env, blogger, '/api/campaigns?fit=1&region=samarkand&sort=value&q=krem');
  assert.deepEqual(titles(combined), ['Yetkazib beriladigan krem']);
});

test('e’lon hududi: tekshiruv va eski ilova uchun “butun O‘zbekiston”', async () => {
  const business = tgUser(610);
  await registerBusiness(env, business);
  const bad = await createCampaign(env, business, { region: 'mars' });
  assert.equal(bad.status, 400);
  assert.deepEqual(bad.data.fields, ['region']);
  const old = await createCampaign(env, business, { region: undefined });
  assert.equal(old.status, 201);
  assert.equal(old.data.campaign.region, 'all');
  const ok = await createCampaign(env, business, { region: 'khorezm' });
  assert.equal(ok.data.campaign.region, 'khorezm');

  // Adminga e'lon hududi ko'rinadi
  assert.match(tg.sent(999).at(-1).body.text, /📍 Xorazm/);
});

test('profil hududini mini ilovadan o‘zgartirish', async () => {
  const blogger = tgUser(620);
  await registerBlogger(env, blogger, { region: 'andijan' });
  assert.equal((await api(env, blogger, '/api/me')).data.user.region, 'andijan');

  const bad = await api(env, blogger, '/api/me', { method: 'PATCH', body: { region: 'all' } });
  assert.equal(bad.status, 400);
  const ok = await api(env, blogger, '/api/me', { method: 'PATCH', body: { region: 'navoi' } });
  assert.equal(ok.status, 200);
  assert.equal(ok.data.user.region, 'navoi');
  const me = await api(env, blogger, '/api/me');
  assert.equal(me.data.user.region, 'navoi');
  assert.equal(me.data.meta.regions.length, 14);

  // Ro'yxatdan o'tmagan foydalanuvchi o'zgartira olmaydi
  const stranger = tgUser(621);
  assert.equal((await api(env, stranger, '/api/me', { method: 'PATCH', body: { region: 'navoi' } })).status, 403);
});

test('biznes so‘rovlarda va bot xabarida blogerning hududini ko‘radi', async () => {
  const { business, blogger, ids } = await setup();
  tg.clear();
  await api(env, blogger, `/api/campaigns/${ids.all}/apply`, { method: 'POST', body: {} });
  assert.match(tg.sent(600).at(-1).body.text, /📍 Samarqand/);
  const reqs = await api(env, business, '/api/requests');
  assert.equal(reqs.data.requests[0].blogger.region, 'samarkand');
  const mine = await api(env, blogger, '/api/my/applications');
  assert.equal(mine.data.applications[0].campaign.region, 'all');
});

test('migratsiya: eski e’lonlarning shahri bo‘yicha hudud aniqlanadi', () => {
  const db = new DatabaseSync(':memory:');
  const dir = new URL('../migrations/', import.meta.url);
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  const regionsFile = files.find((f) => f.includes('regions'));
  for (const f of files.filter((x) => x < regionsFile)) db.exec(readFileSync(new URL(f, dir), 'utf8'));

  db.exec("INSERT INTO users (tg_id, created_at, updated_at) VALUES (1, 0, 0)");
  const cities = {
    Toshkent: 'tashkent_city',
    'г. Ташкент': 'tashkent_city',
    'Toshkent viloyati, Chirchiq': 'tashkent',
    Самарканд: 'samarkand',
    "Farg'ona": 'fergana',
    'Qo‘qon': 'fergana',
    Нукус: 'karakalpakstan',
    Urganch: 'khorezm',
    Termiz: 'surkhandarya',
    '': 'all',
    'Oy shahri': null
  };
  const insert = db.prepare(
    `INSERT INTO campaigns (business_id, title, category, value, platforms, format, min_followers, days, slots, city, status, created_at, updated_at)
     VALUES (1, ?, 'food', 1000, 'Instagram', 'post', 0, 1, 1, ?, 'active', 0, 0)`
  );
  for (const city of Object.keys(cities)) insert.run(city, city);
  insert.run('nocity', null);

  db.exec(readFileSync(new URL(regionsFile, dir), 'utf8'));
  const got = Object.fromEntries(db.prepare('SELECT title, region FROM campaigns').all().map((r) => [r.title, r.region]));
  for (const [city, region] of Object.entries(cities)) assert.equal(got[city], region, city);
  assert.equal(got.nocity, 'all');
});
