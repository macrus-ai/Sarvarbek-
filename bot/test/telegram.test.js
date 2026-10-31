import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { validateInitData, webhookSecret } from '../src/telegram.js';
import { formatPhone, normalizePhone, profileUrl } from '../src/util.js';
import { TOKEN, signInitData } from './helpers.js';

const user = { id: 42, first_name: 'Aziz', language_code: 'uz' };

test('initData: to‘g‘ri imzo qabul qilinadi', async () => {
  const result = await validateInitData(signInitData(user), TOKEN);
  assert.equal(result.user.id, 42);
});

test('initData: o‘zgartirilgan ma’lumot rad etiladi', async () => {
  const params = new URLSearchParams(signInitData(user));
  params.set('user', JSON.stringify({ ...user, id: 43 }));
  assert.equal(await validateInitData(params.toString(), TOKEN), null);
});

test('initData: boshqa bot tokeni bilan imzolangani rad etiladi', async () => {
  assert.equal(await validateInitData(signInitData(user, { token: '1:other' }), TOKEN), null);
});

test('initData: eskirgani rad etiladi', async () => {
  const old = Math.floor(Date.now() / 1000) - 2 * 86400;
  assert.equal(await validateInitData(signInitData(user, { authDate: old }), TOKEN), null);
});

test('initData: hash yo‘q yoki bo‘sh bo‘lsa rad etiladi', async () => {
  assert.equal(await validateInitData('', TOKEN), null);
  assert.equal(await validateInitData('user=%7B%7D&auth_date=1', TOKEN), null);
});

test('initData: signature maydoni hash hisobiga kirgan bo‘lsa ham, kirmagan bo‘lsa ham ishlaydi', async () => {
  // signature hisobga kirgan
  const inside = signInitData(user, { extra: { signature: 'abc' } });
  assert.equal((await validateInitData(inside, TOKEN)).user.id, 42);

  // signature hisobga kirmagan (hash usiz hisoblangan, keyin qo'shilgan)
  const params = new URLSearchParams(signInitData(user));
  params.set('signature', 'xyz');
  assert.equal((await validateInitData(params.toString(), TOKEN)).user.id, 42);
});

test('webhookSecret: deploy workflow bilan bir xil hisoblanadi', async () => {
  const secret = await webhookSecret(TOKEN);
  assert.match(secret, /^[0-9a-f]{48}$/);
  // workflow: printf 'ovoza-webhook:%s' "$TOKEN" | sha256sum | cut -c1-48
  assert.equal(secret, createHash('sha256').update(`ovoza-webhook:${TOKEN}`).digest('hex').slice(0, 48));
});

test('telefon raqamlari', () => {
  assert.equal(normalizePhone('998901234567'), '+998901234567');
  assert.equal(normalizePhone('+998 90 123 45 67', { strict: true }), '+998901234567');
  assert.equal(normalizePhone('901234567', { strict: true }), '+998901234567');
  assert.equal(normalizePhone('79161234567'), '+79161234567');
  assert.equal(normalizePhone('79161234567', { strict: true }), null);
  assert.equal(normalizePhone('salom', { strict: true }), null);
  assert.equal(formatPhone('+998901234567'), '+998 90 123 45 67');
});

test('profil havolasi', () => {
  assert.equal(profileUrl('Instagram', '@dilnoza.blog'), 'https://instagram.com/dilnoza.blog');
  assert.equal(profileUrl('TikTok', 'dilnoza'), 'https://www.tiktok.com/@dilnoza');
  assert.equal(profileUrl('Telegram', '@kanal'), 'https://t.me/kanal');
  assert.equal(profileUrl('YouTube', 'https://youtube.com/@x'), 'https://youtube.com/@x');
  assert.equal(profileUrl('Instagram', 'instagram.com/dilnoza'), 'https://instagram.com/dilnoza');
  assert.equal(profileUrl('Instagram', 'javascript:alert(1)'), null);
});
