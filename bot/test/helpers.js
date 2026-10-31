// Testlar uchun yordamchilar: xotiradagi SQLite (D1 o'rniga), soxta Telegram API va initData imzolash

import { createHmac } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import worker from '../src/index.js';
import { webhookSecret } from '../src/telegram.js';

export const TOKEN = '123456:TEST-token';
export const ORIGIN = 'https://ovoza.test';

// D1 API'sining kerakli qismi
function d1(db) {
  const norm = (v) => (v === undefined ? null : typeof v === 'boolean' ? Number(v) : v);
  const statement = (sql, args = []) => ({
    bind: (...values) => statement(sql, values.map(norm)),
    async first(column) {
      const row = db.prepare(sql).get(...args);
      if (!row) return null;
      const plain = { ...row };
      return column ? plain[column] : plain;
    },
    async all() {
      return { success: true, results: db.prepare(sql).all(...args).map((r) => ({ ...r })) };
    },
    async run() {
      const info = db.prepare(sql).run(...args);
      return { success: true, meta: { changes: Number(info.changes), last_row_id: Number(info.lastInsertRowid) } };
    }
  });
  return { prepare: (sql) => statement(sql) };
}

export function createDb() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  const dir = new URL('../migrations/', import.meta.url);
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    db.exec(readFileSync(new URL(file, dir), 'utf8'));
  }
  return d1(db);
}

// globalThis.fetch ni almashtirib, Telegramga yuborilgan barcha chaqiruvlarni yozib oladi
export function fakeTelegram() {
  const calls = [];
  const failing = new Set();
  let nextMessageId = 1000;
  const original = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input);
    if (!url.startsWith('https://api.telegram.org/')) return original(input, init);
    const method = url.split('/').pop();
    const body = JSON.parse(init.body || '{}');
    calls.push({ method, body });
    if (failing.has(method)) {
      return new Response(JSON.stringify({ ok: false, error_code: 400, description: 'Bad Request: query is too old' }), { status: 400 });
    }
    let result = true;
    if (method === 'sendMessage') result = { message_id: nextMessageId++, chat: { id: body.chat_id }, text: body.text };
    if (method === 'getMe') result = { id: 1, is_bot: true, username: 'ovoza_test_bot' };
    return new Response(JSON.stringify({ ok: true, result }), { headers: { 'content-type': 'application/json' } });
  };
  return {
    calls,
    restore: () => {
      globalThis.fetch = original;
    },
    clear: () => {
      calls.length = 0;
    },
    // Berilgan Telegram metodi xato qaytarsin
    fail: (method) => failing.add(method),
    sent: (chatId) => calls.filter((c) => c.method === 'sendMessage' && c.body.chat_id === chatId),
    last: (method) => [...calls].reverse().find((c) => c.method === method)
  };
}

export function signInitData(user, { token = TOKEN, authDate = Math.floor(Date.now() / 1000), extra = {} } = {}) {
  const fields = { auth_date: String(authDate), query_id: 'AAHtest', user: JSON.stringify(user), ...extra };
  const checkString = Object.keys(fields)
    .sort()
    .map((k) => `${k}=${fields[k]}`)
    .join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(token).digest();
  const hash = createHmac('sha256', secret).update(checkString).digest('hex');
  return new URLSearchParams({ ...fields, hash }).toString();
}

export function createEnv(extra = {}) {
  return {
    DB: createDb(),
    BOT_TOKEN: TOKEN,
    ADMIN_IDS: '999',
    ASSETS: { fetch: async () => new Response('asset') },
    ...extra
  };
}

let updateId = 1;

export async function sendUpdate(env, update) {
  const res = await worker.fetch(
    new Request(`${ORIGIN}/telegram/webhook`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-telegram-bot-api-secret-token': await webhookSecret(TOKEN) },
      body: JSON.stringify({ update_id: updateId++, ...update })
    }),
    env
  );
  return res;
}

let messageId = 1;

export const tgUser = (id, extra = {}) => ({ id, is_bot: false, first_name: `User${id}`, language_code: 'uz', ...extra });

// Foydalanuvchi botga matn (yoki kontakt) yuboradi
export const say = (env, from, text, extra = {}) =>
  sendUpdate(env, {
    message: { message_id: messageId++, date: 0, chat: { id: from.id, type: 'private' }, from, text, ...extra }
  });

// Foydalanuvchi inline tugmani bosadi
export const press = (env, from, data, text = 'savol') =>
  sendUpdate(env, {
    callback_query: {
      id: String(messageId++),
      from,
      data,
      message: { message_id: messageId++, date: 0, chat: { id: from.id, type: 'private' }, text }
    }
  });

export const shareContact = (env, from, phone) =>
  say(env, from, undefined, { contact: { phone_number: phone, user_id: from.id, first_name: from.first_name } });

export async function api(env, user, path, { method = 'GET', body, initData } = {}) {
  const res = await worker.fetch(
    new Request(`${ORIGIN}${path}`, {
      method,
      headers: {
        'x-telegram-init-data': initData ?? signInitData(user),
        ...(body ? { 'content-type': 'application/json' } : {})
      },
      body: body ? JSON.stringify(body) : undefined
    }),
    env
  );
  return { status: res.status, data: await res.json() };
}

// Biznesni bot orqali to'liq ro'yxatdan o'tkazadi
export async function registerBusiness(env, user, { company = 'Tabiiy kosmetika', category = 'beauty', lang = 'uz' } = {}) {
  await say(env, user, '/start');
  await press(env, user, `lang:${lang}`);
  await press(env, user, 'role:business');
  await say(env, user, 'Aziz');
  await say(env, user, company);
  await press(env, user, `cat:${category}`);
  await shareContact(env, user, '998901112233');
}

// Blogerni bot orqali to'liq ro'yxatdan o'tkazadi
export async function registerBlogger(env, user, { followers = '10000-50000', lang = 'uz' } = {}) {
  await say(env, user, '/start');
  await press(env, user, `lang:${lang}`);
  await press(env, user, 'role:blogger');
  await say(env, user, 'Dilnoza');
  await press(env, user, 'plat:Instagram');
  await say(env, user, '@dilnoza.blog');
  await press(env, user, `fol:${followers}`);
  await press(env, user, 'cat:beauty');
  await shareContact(env, user, '+998935556677');
}

// Ro'yxatdan o'tgan biznes nomidan kampaniya yaratadi
export async function createCampaign(env, business, overrides = {}) {
  const res = await api(env, business, '/api/campaigns', {
    method: 'POST',
    body: {
      title: 'Tabiiy yuz kremi',
      category: 'beauty',
      value: 180000,
      platforms: ['Instagram'],
      format: '1 Reels + 2 Stories',
      minFollowers: 5000,
      days: 7,
      slots: 2,
      city: 'Toshkent',
      description: 'Krem kuryer orqali yetkaziladi.',
      ...overrides
    }
  });
  return res;
}
