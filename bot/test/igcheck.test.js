import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { instagramUsername } from '../src/igcheck.js';
import { createEnv, fakeTelegram, press, say, tgUser } from './helpers.js';

let tg;
let restoreGraph;
let graphCalls;

// Meta Graph API'ni soxtalashtirish: fakeTelegram'dan keyin o'rnatiladi, boshqa so'rovlarni unga uzatadi
function fakeGraph(respond) {
  const previous = globalThis.fetch;
  graphCalls = [];
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (!url.startsWith('https://graph.facebook.com/')) return previous(input, init);
    graphCalls.push(url);
    return respond(url);
  };
  restoreGraph = () => {
    globalThis.fetch = previous;
  };
}

const found = () => new Response(JSON.stringify({ business_discovery: { username: 'x', id: '1' } }), { status: 200 });
const notFound = () =>
  new Response(JSON.stringify({ error: { message: 'Invalid user id', code: 110, error_subcode: 2207013 } }), { status: 400 });
const tokenExpired = () => new Response(JSON.stringify({ error: { message: 'Token expired', code: 190 } }), { status: 400 });

beforeEach(() => {
  tg = fakeTelegram();
});
afterEach(() => {
  restoreGraph?.();
  restoreGraph = null;
  tg.restore();
});

const lastText = (chatId) => tg.sent(chatId).at(-1)?.body.text ?? '';
const withMeta = () => createEnv({ META_IG_USER_ID: '17841000000000000', META_ACCESS_TOKEN: 'test-meta-token' });

async function toProfileStep(env, user) {
  await say(env, user, '/start');
  await press(env, user, 'lang:uz');
  await press(env, user, 'role:blogger');
  await say(env, user, 'Madina');
  await press(env, user, 'plat:Instagram');
}

test('instagramUsername: oddiy profil havolasidan username oladi', () => {
  assert.equal(instagramUsername('https://instagram.com/madina.uz'), 'madina.uz');
  assert.equal(instagramUsername('https://www.instagram.com/madina/'), 'madina');
  assert.equal(instagramUsername('https://instagram.com/p/ABC123'), null);
  assert.equal(instagramUsername('nohavola'), null);
});

test('mavjud bo‘lmagan Instagram akkaunt rad etiladi, bloger qayta yozadi', async () => {
  const env = withMeta();
  fakeGraph((url) => (decodeURIComponent(url).includes('username(yoq_akkaunt)') ? notFound() : found()));
  const user = tgUser(601);
  await toProfileStep(env, user);

  await say(env, user, 'https://instagram.com/yoq_akkaunt');
  assert.match(lastText(user.id), /Bunday Instagram akkaunt topilmadi/);
  assert.equal(graphCalls.length, 1);

  // Xato manzil saqlanmadi: bloger shu qadamda turibdi va to'g'risini yuboradi
  await say(env, user, 'https://instagram.com/bor_akkaunt');
  assert.equal(graphCalls.length, 2);
  assert.doesNotMatch(lastText(user.id), /topilmadi/);
  assert.match(lastText(user.id), /Obunachilaringiz soni/);
});

test('Meta ishlamasa (token xatosi, tarmoq) bloger to‘xtatilmaydi', async () => {
  const env = withMeta();
  fakeGraph(() => tokenExpired());
  const user = tgUser(602);
  await toProfileStep(env, user);
  await say(env, user, '@madina');
  assert.match(lastText(user.id), /Obunachilaringiz soni/);

  restoreGraph();
  fakeGraph(() => {
    throw new Error('network down');
  });
  const user2 = tgUser(603);
  await toProfileStep(env, user2);
  await say(env, user2, '@madina2');
  assert.match(lastText(user2.id), /Obunachilaringiz soni/);
});

test('Meta kalitlari sozlanmagan bo‘lsa, tekshiruv umuman chaqirilmaydi', async () => {
  const env = createEnv();
  fakeGraph(() => notFound());
  const user = tgUser(604);
  await toProfileStep(env, user);
  await say(env, user, '@madina');
  assert.equal(graphCalls.length, 0);
  assert.match(lastText(user.id), /Obunachilaringiz soni/);
});

test('Instagram bo‘lmagan platformalar uchun Meta chaqirilmaydi', async () => {
  const env = withMeta();
  fakeGraph(() => notFound());
  const user = tgUser(605);
  await say(env, user, '/start');
  await press(env, user, 'lang:uz');
  await press(env, user, 'role:blogger');
  await say(env, user, 'Madina');
  await press(env, user, 'plat:Telegram');
  await say(env, user, '@madina_kanal');
  assert.equal(graphCalls.length, 0);
});
