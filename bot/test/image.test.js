import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import {
  JPEG, api, createCampaign, createEnv, fakeTelegram, getImage, putImage, registerBlogger, registerBusiness,
  sendUpdate, tgUser
} from './helpers.js';
import { pickSizes, sniffImage } from '../src/images.js';

// createEnv() da ADMIN_IDS = '999'
const ADMIN = 999;
let tg;
let env;
beforeEach(() => {
  tg = fakeTelegram();
  env = createEnv();
});
afterEach(() => tg.restore());

const photosTo = (chatId) => tg.calls.filter((c) => c.method === 'sendPhoto' && String(c.body.chat_id) === String(chatId));

async function setup() {
  const business = tgUser(500);
  const blogger = tgUser(501);
  await registerBusiness(env, business);
  await registerBlogger(env, blogger);
  const { data } = await createCampaign(env, business);
  return { business, blogger, id: data.campaign.id };
}

test('rasm turini baytlar bo‘yicha aniqlash', () => {
  assert.equal(sniffImage(JPEG).type, 'image/jpeg');
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
  assert.equal(sniffImage(png).type, 'image/png');
  const webp = new TextEncoder().encode('RIFF\0\0\0\0WEBPVP8 ');
  assert.equal(sniffImage(webp).type, 'image/webp');
  assert.equal(sniffImage(new TextEncoder().encode('<svg onload=alert(1)>')), null);
  assert.equal(sniffImage(new Uint8Array([0xff, 0xd8])), null);
});

test('o‘lchamlarni tanlash: katta va kartalar uchun kichigi', () => {
  const sizes = pickSizes([
    { file_id: 'big', width: 1280, height: 720 },
    { file_id: 'tiny', width: 90, height: 51 },
    { file_id: 'mid', width: 800, height: 450 },
    { file_id: 'small', width: 320, height: 180 }
  ]);
  assert.deepEqual(sizes, { fileId: 'big', thumbId: 'mid' });
  assert.deepEqual(pickSizes([{ file_id: 'only', width: 200, height: 200 }]), { fileId: 'only', thumbId: 'only' });
  assert.equal(pickSizes(undefined), null);
});

test('biznes e’longa rasm qo‘yadi, bloger uni ko‘radi', async () => {
  const { business, blogger, id } = await setup();
  tg.clear();

  const res = await putImage(env, business, id, JPEG);
  assert.equal(res.status, 200);
  const image = res.data.campaign.image;
  assert.match(image.url, new RegExp(`^/img/c/${id}-[0-9a-f]{16}\\.jpg$`));
  assert.equal(image.thumb, image.url.replace('.jpg', '-s.jpg'));

  // Rasm biznesning chatiga tasdiq sifatida yuklandi (fayl bilan, ovozsiz)
  const [upload] = photosTo(500);
  assert.equal(upload.body.photo.type, 'image/jpeg');
  assert.equal(upload.body.photo.size, JPEG.length);
  assert.equal(upload.body.disable_notification, 'true');
  assert.match(upload.body.caption, /«Tabiiy yuz kremi» reklama e’loniga rasm qo‘shildi/);

  // Admin rasmni file_id bilan va "yopish" tugmasi bilan oldi
  const [note] = photosTo(ADMIN);
  assert.equal(note.body.photo, 'photo1-l');
  assert.match(note.body.caption, /Reklama e’loniga rasm qo‘shildi/);
  assert.equal(note.body.reply_markup.inline_keyboard[0][0].callback_data, `adm:close:${id}`);

  // Bloger ro'yxatda ham, e'lon sahifasida ham rasmni ko'radi
  const list = await api(env, blogger, '/api/campaigns');
  assert.deepEqual(list.data.campaigns[0].image, image);
  const detail = await api(env, blogger, `/api/campaigns/${id}`);
  assert.deepEqual(detail.data.campaign.image, image);

  // Rasm worker orqali Telegramdan olinadi; kartalar uchun o'rtacha o'lcham
  const big = await getImage(env, image.url);
  assert.equal(big.status, 200);
  assert.equal(big.headers.get('content-type'), 'image/jpeg');
  assert.match(big.headers.get('cache-control'), /immutable/);
  const bytes = new Uint8Array(await big.arrayBuffer());
  assert.equal(sniffImage(bytes).type, 'image/jpeg');
  assert.match(new TextDecoder().decode(bytes.subarray(4)), /photos\/photo1-l\.jpg/);

  const small = await getImage(env, image.thumb);
  assert.match(new TextDecoder().decode(new Uint8Array(await small.arrayBuffer()).subarray(4)), /photo1-m/);
  // file_path eslab qolinadi: qayta ochilganda getFile chaqirilmaydi
  await getImage(env, image.url);
  assert.equal(tg.calls.filter((c) => c.method === 'getFile').length, 2);
  // Javobda bot tokeni ko'rinmaydi
  assert.ok(!JSON.stringify([...big.headers]).includes('TEST-token'));

  // So'rov yuborgan bloger "So'rovlarim" da ham rasmni ko'radi
  await api(env, blogger, `/api/campaigns/${id}/apply`, { method: 'POST', body: {} });
  const mine = await api(env, blogger, '/api/my/applications');
  assert.deepEqual(mine.data.applications[0].campaign.image, image);
});

test('rasm manzili kalitsiz yoki noto‘g‘ri kalit bilan ochilmaydi', async () => {
  const { business, id } = await setup();
  assert.equal((await getImage(env, `/img/c/${id}-0123456789abcdef.jpg`)).status, 404); // rasm yo'q

  const { data } = await putImage(env, business, id, JPEG);
  const wrongKey = data.campaign.image.url.replace(/-[0-9a-f]{16}/, '-0123456789abcdef');
  assert.equal((await getImage(env, wrongKey)).status, 404);
  assert.equal((await getImage(env, `/img/c/9999-0123456789abcdef.jpg`)).status, 404);
  assert.equal((await getImage(env, `/img/c/${id}.jpg`)).status, 200); // bu yo'l rasm emas: mini ilova fayllariga ketadi

  tg.fail('file');
  const broken = await getImage(env, data.campaign.image.url);
  assert.equal(broken.status, 502);
});

test('rasmni almashtirish va olib tashlash: eski manzil ishlamay qoladi', async () => {
  const { business, blogger, id } = await setup();
  const first = (await putImage(env, business, id, JPEG)).data.campaign.image;
  const second = (await putImage(env, business, id, JPEG)).data.campaign.image;
  assert.notEqual(first.url, second.url);
  assert.equal((await getImage(env, first.url)).status, 404);
  assert.equal((await getImage(env, second.url)).status, 200);

  const removed = await api(env, business, `/api/campaigns/${id}/image`, { method: 'DELETE' });
  assert.equal(removed.status, 200);
  assert.equal(removed.data.campaign.image, null);
  assert.equal((await getImage(env, second.url)).status, 404);
  assert.equal((await api(env, blogger, `/api/campaigns/${id}`)).data.campaign.image, null);
});

test('rasm yuklash: tekshiruvlar va huquqlar', async () => {
  const { business, blogger, id } = await setup();

  const notImage = await putImage(env, business, id, new TextEncoder().encode('<html>salom</html>'));
  assert.equal(notImage.status, 400);
  assert.equal(notImage.data.error, 'image_invalid');

  const huge = await putImage(env, business, id, JPEG, { headers: { 'content-length': String(6 * 1024 * 1024) } });
  assert.equal(huge.status, 413);
  assert.equal(huge.data.error, 'image_too_large');
  assert.equal(huge.data.limitMb, 5);

  const big = new Uint8Array(5 * 1024 * 1024 + 1);
  big.set(JPEG);
  assert.equal((await putImage(env, business, id, big)).data.error, 'image_too_large');

  assert.equal((await putImage(env, blogger, id, JPEG)).status, 403);
  const other = tgUser(502);
  await registerBusiness(env, other, { company: 'Boshqa do‘kon' });
  assert.equal((await putImage(env, other, id, JPEG)).status, 404);
  assert.equal((await api(env, other, `/api/campaigns/${id}/image`, { method: 'DELETE' })).status, 404);
  assert.equal((await putImage(env, business, 9999, JPEG)).status, 404);

  // Telegram rasmni qabul qilmasa (masalan, juda cho'zinchoq rasm)
  tg.fail('sendPhoto');
  const rejected = await putImage(env, business, id, JPEG);
  assert.equal(rejected.status, 400);
  assert.equal(rejected.data.error, 'image_invalid');
  assert.equal((await api(env, business, `/api/campaigns/${id}`)).data.campaign.image, null);
});

test('admin rasmli xabardan e’lonni yopadi', async () => {
  const { business, id } = await setup();
  await putImage(env, business, id, JPEG);
  tg.clear();

  const admin = tgUser(ADMIN);
  await sendUpdate(env, {
    callback_query: {
      id: 'cb-photo',
      from: admin,
      data: `adm:close:${id}`,
      message: {
        message_id: 77,
        date: 0,
        chat: { id: ADMIN, type: 'private' },
        photo: [{ file_id: 'photo1-l', width: 1280, height: 960 }],
        caption: 'Reklama e’loniga rasm qo‘shildi\n«Tabiiy yuz kremi»'
      }
    }
  });

  const edit = tg.last('editMessageCaption');
  assert.ok(edit, 'rasm osti matni yangilanishi kerak');
  assert.equal(edit.body.message_id, 77);
  assert.match(edit.body.caption, /Siz yopdingiz/);
  assert.deepEqual(edit.body.reply_markup.inline_keyboard, []);
  assert.equal(tg.last('editMessageText'), undefined);
  assert.equal((await api(env, business, `/api/campaigns/${id}`)).data.campaign.status, 'closed');
});

test('ruscha: biznesga va adminga ruscha matn', async () => {
  const business = tgUser(510, { language_code: 'ru' });
  await registerBusiness(env, business, { lang: 'ru' });
  const { data } = await createCampaign(env, business);
  tg.clear();
  await putImage(env, business, data.campaign.id, JPEG);
  assert.match(photosTo(510)[0].body.caption, /Фото добавлено к рекламному объявлению/);
});
