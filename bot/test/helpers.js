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
  let nextFile = 1;
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input);
    if (!url.startsWith('https://api.telegram.org/')) return original(input, init);

    // Faylni yuklab olish: https://api.telegram.org/file/bot<token>/<file_path>
    if (url.startsWith('https://api.telegram.org/file/')) {
      const filePath = url.split('/').slice(5).join('/');
      calls.push({ method: 'file', body: { filePath } });
      if (failing.has('file')) return new Response('Not Found', { status: 404 });
      return new Response(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...new TextEncoder().encode(filePath)]), {
        headers: { 'content-type': 'application/octet-stream' }
      });
    }

    const method = url.split('/').pop();
    let body;
    if (init.body instanceof FormData) {
      // Fayl yuklash: maydonlar matn, fayl esa { name, type, size } ko'rinishida yoziladi
      body = {};
      for (const [key, value] of init.body) {
        body[key] = typeof value === 'string' ? value : { name: value.name, type: value.type, size: value.size };
      }
    } else {
      body = JSON.parse(init.body || '{}');
    }
    calls.push({ method, body });
    if (failing.has(method)) {
      return new Response(JSON.stringify({ ok: false, error_code: 400, description: 'Bad Request: query is too old' }), { status: 400 });
    }
    let result = true;
    if (method === 'sendMessage') result = { message_id: nextMessageId++, chat: { id: body.chat_id }, text: body.text };
    if (method === 'sendPhoto') {
      // Yangi fayl yuklansa Telegram yangi file_id'lar beradi, file_id yuborilsa o'shani qaytaradi
      const id = typeof body.photo === 'string' ? body.photo.replace(/-[sml]$/, '') : `photo${nextFile++}`;
      result = {
        message_id: nextMessageId++,
        chat: { id: Number(body.chat_id) },
        caption: body.caption,
        photo: [
          { file_id: `${id}-s`, width: 320, height: 240 },
          { file_id: `${id}-m`, width: 800, height: 600 },
          { file_id: `${id}-l`, width: 1280, height: 960 }
        ]
      };
    }
    if (method === 'getFile') result = { file_id: body.file_id, file_path: `photos/${body.file_id}.jpg` };
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

// Mini ilova rasm yuklaydi (so'rov tanasi — xom baytlar)
export async function putImage(env, user, campaignId, bytes, { headers = {} } = {}) {
  const res = await worker.fetch(
    new Request(`${ORIGIN}/api/campaigns/${campaignId}/image`, {
      method: 'PUT',
      headers: { 'x-telegram-init-data': signInitData(user), 'content-type': 'image/jpeg', ...headers },
      body: bytes
    }),
    env
  );
  return { status: res.status, data: await res.json() };
}

// Kichik "JPEG" (testlar uchun faqat boshidagi belgi muhim)
export const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1]);

// Rasmni xuddi brauzer kabi oladi (initData'siz)
export const getImage = (env, path) => worker.fetch(new Request(`${ORIGIN}${path}`), env);

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
export async function registerBlogger(env, user, { followers = '10000-50000', lang = 'uz', niche = 'beauty' } = {}) {
  await say(env, user, '/start');
  await press(env, user, `lang:${lang}`);
  await press(env, user, 'role:blogger');
  await say(env, user, 'Dilnoza');
  await press(env, user, 'plat:Instagram');
  await say(env, user, '@dilnoza.blog');
  await press(env, user, `fol:${followers}`);
  await press(env, user, `niche:${niche}`);
  await shareContact(env, user, '+998935556677');
}

// Ro'yxatdan o'tgan biznes nomidan reklama e'loni yaratadi
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
