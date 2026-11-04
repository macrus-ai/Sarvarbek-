// Admin panel: ma'lumotlarni Excel'ga yuklab olish (server qismi va public/admin/xlsx.js)
import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import worker from '../src/index.js';
import {
  ORIGIN, api, createCampaign, createEnv, fakeTelegram, press, registerBlogger, registerBusiness, say, tgUser
} from './helpers.js';
import '../public/admin/xlsx.js';

const { OvozaXlsx } = globalThis;

// createEnv() da ADMIN_IDS = '999'
const ADMIN = 999;
let tg;
let env;
beforeEach(() => {
  tg = fakeTelegram();
  env = createEnv();
});
afterEach(() => tg.restore());

async function login() {
  await say(env, tgUser(ADMIN), '/admin');
  const url = tg.sent(ADMIN).at(-1).body.reply_markup.inline_keyboard[0][0].url;
  const res = await worker.fetch(new Request(url), env);
  return res.headers.get('set-cookie').split(';')[0];
}

async function panel(cookie, path) {
  const res = await worker.fetch(new Request(`${ORIGIN}${path}`, { headers: cookie ? { cookie } : {} }), env);
  return { status: res.status, data: await res.json() };
}

test('eksport: faqat admin uchun, blogerlar, bizneslar, e’lonlar va so‘rovlar to‘liq', async () => {
  const business = tgUser(100, { username: 'kosmetika_uz' });
  const blogger = tgUser(201, { username: 'dilnoza' });
  await registerBusiness(env, business);
  await registerBlogger(env, blogger, { stats: true });
  // Ro'yxatdan o'tishni tugatmagan foydalanuvchi eksportga kirmaydi
  await say(env, tgUser(300), '/start');
  const { data } = await createCampaign(env, business, { region: 'tashkent_city' });
  await api(env, blogger, `/api/campaigns/${data.campaign.id}/apply`, { method: 'POST', body: { message: 'Salom!' } });
  await press(env, blogger, 'ntf:off');

  assert.equal((await panel(null, '/api/admin/export/users')).status, 401);
  const cookie = await login();

  const users = (await panel(cookie, '/api/admin/export/users')).data;
  assert.equal(users.total, 2);
  assert.equal(users.pageSize, 500);
  const b = users.rows.find((r) => r.role === 'blogger');
  assert.equal(b.id, 201);
  assert.equal(b.username, 'dilnoza');
  assert.equal(b.phone, '+998 93 555 66 77');
  assert.equal(b.platform, 'Instagram');
  assert.equal(b.profile, 'https://instagram.com/dilnoza.blog');
  assert.match(b.followers, /10\s000 – 50\s000/);
  assert.match(b.reels, /5\s000 – 20\s000/);
  assert.match(b.posts, /3\s000 – 10\s000/);
  assert.match(b.stories, /1\s000 – 3\s000/);
  assert.match(b.accounts, /20\s000 – 100\s000/);
  assert.equal(b.region, 'Toshkent shahri');
  assert.equal(b.niche, 'Go‘zallik va kosmetika');
  assert.equal(b.stats, true);
  assert.equal(b.notifyAds, false);
  assert.equal(b.moderation, 'approved');
  assert.equal(b.applications, 1);
  const biz = users.rows.find((r) => r.role === 'business');
  assert.equal(biz.company, 'Tabiiy kosmetika');
  assert.equal(biz.category, 'Go‘zallik');
  assert.equal(biz.campaigns, 1);

  const campaigns = (await panel(cookie, '/api/admin/export/campaigns')).data;
  assert.equal(campaigns.total, 1);
  const c = campaigns.rows[0];
  assert.equal(c.title, 'Tabiiy yuz kremi');
  assert.equal(c.value, 180000);
  assert.equal(c.platforms, 'Instagram');
  assert.equal(c.region, 'Toshkent shahri');
  assert.equal(c.status, 'active');
  assert.equal(c.applications, 1);

  const apps = (await panel(cookie, '/api/admin/export/applications')).data;
  assert.equal(apps.total, 1);
  assert.equal(apps.rows[0].bloggerName, 'Dilnoza');
  assert.equal(apps.rows[0].bloggerPhone, '+998 93 555 66 77');
  assert.equal(apps.rows[0].title, 'Tabiiy yuz kremi');
  assert.equal(apps.rows[0].message, 'Salom!');

  // Keyingi sahifa bo'sh
  assert.deepEqual((await panel(cookie, '/api/admin/export/users?page=2')).data.rows, []);
  assert.equal((await panel(cookie, '/api/admin/export/secrets')).status, 404);
});

/* ---------- xlsx.js ---------- */

// Mustaqil CRC32 (bit bo'yicha), xlsx.js dagi jadvalli hisobni tekshirish uchun
function crcSlow(bytes) {
  let c = 0xffffffff;
  for (const byte of bytes) {
    c ^= byte;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
  }
  return (c ^ 0xffffffff) >>> 0;
}

// Siqilmagan zip'ni o'qiydi: { nomi: matn }
function unzip(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const end = bytes.length - 22;
  assert.equal(view.getUint32(end, true), 0x06054b50);
  const count = view.getUint16(end + 10, true);
  let p = view.getUint32(end + 16, true);
  const files = {};
  const dec = new TextDecoder();
  for (let i = 0; i < count; i += 1) {
    assert.equal(view.getUint32(p, true), 0x02014b50);
    assert.equal(view.getUint16(p + 10, true), 0, 'siqilmagan');
    const crc = view.getUint32(p + 16, true);
    const size = view.getUint32(p + 24, true);
    const nameLen = view.getUint16(p + 28, true);
    const local = view.getUint32(p + 42, true);
    const name = dec.decode(bytes.subarray(p + 46, p + 46 + nameLen));
    assert.equal(view.getUint32(local, true), 0x04034b50);
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    const data = bytes.subarray(start, start + size);
    assert.equal(crcSlow(data), crc, `${name}: CRC`);
    files[name] = dec.decode(data);
    p += 46 + nameLen;
  }
  return files;
}

test('xlsx: ustun nomlari va CRC32', () => {
  assert.equal(OvozaXlsx.columnName(0), 'A');
  assert.equal(OvozaXlsx.columnName(25), 'Z');
  assert.equal(OvozaXlsx.columnName(26), 'AA');
  assert.equal(OvozaXlsx.columnName(701), 'ZZ');
  assert.equal(OvozaXlsx.columnName(702), 'AAA');
  assert.equal(OvozaXlsx.crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
});

test('xlsx: varaqlar, sarlavha, son va matn kataklari, maxsus belgilar', () => {
  const bytes = OvozaXlsx.build([
    {
      name: 'Blogerlar',
      header: ['ID', 'Ism', 'Izoh'],
      widths: [12, 20, 30],
      rows: [
        [201, 'Dilnoza', 'Go‘zallik & <kosmetika> "top"'],
        [202, '', null],
        [203, 'Emoji 📸', 'boshqaruv\u0001belgisi']
      ]
    },
    { name: 'E’lonlar', header: ['Nomi'], rows: [] },
    { name: 'Yomon/nom*[1]', header: ['A'], rows: [['x']] }
  ]);
  const files = unzip(bytes);
  assert.deepEqual(Object.keys(files).sort(), [
    '[Content_Types].xml', '_rels/.rels', 'xl/_rels/workbook.xml.rels', 'xl/styles.xml', 'xl/workbook.xml',
    'xl/worksheets/sheet1.xml', 'xl/worksheets/sheet2.xml', 'xl/worksheets/sheet3.xml'
  ]);

  const wb = files['xl/workbook.xml'];
  assert.match(wb, /<sheet name="Blogerlar" sheetId="1" r:id="rId1"\/>/);
  assert.match(wb, /<sheet name="E’lonlar" sheetId="2" r:id="rId2"\/>/);
  assert.match(wb, /<sheet name="Yomon nom  1" sheetId="3"/); // Excel taqiqlagan belgilar almashtirildi
  assert.match(wb, /localSheetId="0" hidden="1">'Blogerlar'!\$A\$1:\$C\$4</);
  assert.match(files['[Content_Types].xml'], /\/xl\/worksheets\/sheet3\.xml/);
  assert.match(files['xl/_rels/workbook.xml.rels'], /Id="rId4"[^>]+styles/);

  const s1 = files['xl/worksheets/sheet1.xml'];
  assert.match(s1, /<c r="A1" t="inlineStr" s="1"><is><t xml:space="preserve">ID<\/t><\/is><\/c>/); // qalin sarlavha
  assert.match(s1, /<c r="A2"><v>201<\/v><\/c>/); // son
  assert.match(s1, /Go‘zallik &amp; &lt;kosmetika&gt; &quot;top&quot;/);
  assert.match(s1, /<row r="3"><c r="A3"><v>202<\/v><\/c><\/row>/); // bo'sh kataklar yozilmaydi
  assert.match(s1, /Emoji 📸/);
  assert.match(s1, /boshqaruvbelgisi/);
  assert.match(s1, /<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"\/>/);
  assert.match(s1, /<col min="3" max="3" width="30" customWidth="1"\/>/);
  assert.match(s1, /<autoFilter ref="A1:C4"\/>/);
  assert.match(files['xl/worksheets/sheet2.xml'], /<autoFilter ref="A1:A1"\/>/);
});
