import assert from 'node:assert/strict';
import { test } from 'node:test';
import { touchUser } from '../src/db.js';
import { createEnv, tgUser } from './helpers.js';

// Baza D1 ga o'xshash: har so'rovda yozish tezlikni tushiradi, shuning uchun touchUser keraksiz yozmaydi
function countWrites(db) {
  const writes = [];
  const prepare = db.prepare.bind(db);
  db.prepare = (sql) => {
    if (/^\s*(INSERT|UPDATE|DELETE)/i.test(sql)) writes.push(sql);
    return prepare(sql);
  };
  return writes;
}

test('touchUser: yangi foydalanuvchi yoziladi, o‘zgarmagan bo‘lsa qayta yozilmaydi', async () => {
  const env = createEnv();
  const writes = countWrites(env.DB);
  const from = tgUser(5001, { username: 'ali' });

  const first = await touchUser(env.DB, from, 'uz');
  assert.equal(first.tg_id, 5001);
  assert.equal(first.username, 'ali');
  assert.equal(writes.length, 1);

  const again = await touchUser(env.DB, from, 'uz');
  assert.equal(again.tg_id, 5001);
  assert.equal(writes.length, 1, 'o‘zgarmagan foydalanuvchi uchun yozuv bo‘lmasligi kerak');
});

test('touchUser: ism yoki username o‘zgarsa yangilanadi, til esa o‘zgarmaydi', async () => {
  const env = createEnv();
  await touchUser(env.DB, tgUser(5002, { username: 'vali', language_code: 'ru' }), 'ru');

  const renamed = await touchUser(env.DB, { ...tgUser(5002), first_name: 'Yangi', username: 'vali2' }, 'uz');
  assert.equal(renamed.first_name, 'Yangi');
  assert.equal(renamed.username, 'vali2');
  assert.equal(renamed.lang, 'ru');

  // Username olib tashlansa (null) ham yangilanadi
  const noName = await touchUser(env.DB, { id: 5002, first_name: 'Yangi' }, 'uz');
  assert.equal(noName.username, null);
});
