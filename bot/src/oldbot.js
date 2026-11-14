// Eski botdan (@Ovozauz_bot) yangi botga (@miqyosbot) ko'chish.
//
// Telegram foydalanuvchilarni bir botdan boshqasiga o'tkazmaydi va bot foydalanuvchiga birinchi bo'lib
// yoza olmaydi. Shuning uchun eski bot (OLD_BOT_TOKEN) shu Worker'da qoladi:
//   - /telegram/old-webhook: shaxsiy chatdagi har qanday xabarga "yangi botga o'ting" deb tugma bilan
//     javob beradi (saytdagi /start parametri ham uzatiladi). Guruhlarda jim turadi;
//   - /setup: eski botning webhook'i, menyusi (mini ilova olib tashlanadi), buyruqlari va tavsifi;
//   - cron: eski botga yuklangan rasmlar yangi botga ko'chiriladi (file_id har bot uchun alohida);
//     admin ruxsat bersa (settings: old_bot_notice = 'go'), eski foydalanuvchilarga bir martalik xabar.
// Foydalanuvchi yangi botga yozganda users.bot_id yangi botning ID siga teng bo'ladi (db.js touchUser).

import { BRAND } from './constants.js';
import { getSetting, getUser, setSetting } from './db.js';
import { tr } from './i18n.js';
import { pickSizes, sniffImage } from './images.js';
import { TelegramError, createTelegram, webhookSecret } from './telegram.js';
import { adminIds, botIdOf, guessLang } from './util.js';

// Sozlamalardagi kalitlar
export const BOT_USERNAME = 'bot_username'; // yangi botning username'i (/setup saqlaydi)
export const FILES_MOVED = 'old_files_moved'; // 'done' yoki {"u": oxirgi bloger, "c": oxirgi e'lon}; -1 — bosqich tugadi
export const OLD_NOTICE = 'old_bot_notice'; // 'go' — xabarni boshlash, {"after": ID} — davomi, 'done' — tugadi

// Eski bot sozlangan bo'lsa (va u yangisining o'zi bo'lmasa) — uning Telegram mijozi
export function oldTelegram(env) {
  const token = env.OLD_BOT_TOKEN;
  return token && token !== env.BOT_TOKEN ? createTelegram(token) : null;
}

const isTemporary = (e) => !(e instanceof TelegramError) || e.code === 429 || !e.code || e.code >= 500;

async function newBotUsername(ctx) {
  const saved = await getSetting(ctx.db, BOT_USERNAME);
  if (saved) return saved;
  const me = await ctx.tg.call('getMe');
  await setSetting(ctx.db, BOT_USERNAME, me.username);
  return me.username;
}

// Saytdagi havola parametri (/start business-uz) yangi botga ham uzatiladi
function startParam(text) {
  const m = typeof text === 'string' ? text.trim().match(/^\/start(?:@\w+)?\s+([A-Za-z0-9_-]{1,64})$/) : null;
  return m ? m[1] : '';
}

function movedMessage(T, username, start = '') {
  const url = `https://t.me/${username}${start ? `?start=${start}` : ''}`;
  return { text: T.botMoved(username), extra: { reply_markup: { inline_keyboard: [[{ text: T.botMovedButton, url }]] } } };
}

async function langOf(ctx, from) {
  const user = await getUser(ctx.db, from.id);
  return user?.lang || guessLang(from.language_code);
}

// POST /telegram/old-webhook — eski botga kelgan xabarlar
export async function oldWebhook(request, ctx) {
  if (!ctx.oldTg) return new Response('Not found', { status: 404 });
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const secret = await webhookSecret(ctx.env.OLD_BOT_TOKEN);
  if (request.headers.get('x-telegram-bot-api-secret-token') !== secret) return new Response('Forbidden', { status: 403 });

  let update;
  try {
    update = await request.json();
  } catch {
    return new Response('Bad request', { status: 400 });
  }
  try {
    await handleOldUpdate(update, ctx);
  } catch (e) {
    // Telegram qayta-qayta yubormasligi uchun baribir 200
    console.error('old bot update failed:', e);
  }
  return new Response('ok');
}

async function handleOldUpdate(update, ctx) {
  const msg = update.message;
  if (msg?.from && !msg.from.is_bot && msg.chat?.type === 'private') {
    const T = tr(await langOf(ctx, msg.from));
    const { text, extra } = movedMessage(T, await newBotUsername(ctx), startParam(msg.text));
    await ctx.oldTg.send(msg.chat.id, text, extra);
    return;
  }
  // Eski xabarlardagi tugmalar (masalan, guruhdagi eski moderatsiya kartasi)
  const cq = update.callback_query;
  if (cq?.from) {
    const T = tr(await langOf(ctx, cq.from));
    await ctx.oldTg.answer(cq.id, T.botMovedShort(await newBotUsername(ctx)), true);
  }
}

// /setup dan: eski botni yo'naltiruvchiga aylantiradi. Qaytaradi: eski botning username'i (yoki null).
export async function setupOldBot(ctx, username) {
  const old = ctx.oldTg;
  if (!old) return null;
  const me = await old.call('getMe');
  await old.call('setWebhook', {
    url: `${ctx.origin}/telegram/old-webhook`,
    secret_token: await webhookSecret(ctx.env.OLD_BOT_TOKEN),
    allowed_updates: ['message', 'callback_query']
  });
  // Mini ilova tugmasi olib tashlanadi: ilova faqat yangi bot orqali ochiladi
  await old.call('setChatMenuButton', { menu_button: { type: 'default' } });
  for (const lang of ['uz', 'ru']) {
    const T = tr(lang);
    const language = lang === 'ru' ? { language_code: 'ru' } : {};
    await old.call('deleteMyCommands', { ...language });
    await old.call('deleteMyCommands', { scope: { type: 'all_group_chats' }, ...language });
    await old.call('setMyDescription', { description: T.oldBotDescription(username), ...language });
    await old.call('setMyShortDescription', { short_description: T.oldBotShortDescription(username), ...language });
  }
  // Ikki bir xil nomli bot adashtirmasin. Telegram ismni tez-tez o'zgartirishga ruxsat bermaydi.
  try {
    const name = `${BRAND} (eski)`;
    if ((await old.call('getMyName'))?.name !== name) await old.call('setMyName', { name });
  } catch (e) {
    console.error('old bot setMyName failed:', e);
  }
  return me.username;
}

/* ---------- Rasmlarni ko'chirish ---------- */

// Rasmlar jadvallari: id, file_id va yangi file_id larni saqlash
const FILE_JOBS = [
  {
    key: 'u', // blogerlarning statistika skrinshotlari
    list: (db, after, limit) =>
      db
        .prepare('SELECT tg_id AS id, stats_file_id AS file_id FROM users WHERE stats_file_id IS NOT NULL AND tg_id > ?1 ORDER BY tg_id LIMIT ?2')
        .bind(after, limit)
        .all(),
    save: (db, id, oldId, sizes) =>
      db.prepare('UPDATE users SET stats_file_id = ?1 WHERE tg_id = ?2 AND stats_file_id = ?3').bind(sizes.fileId, id, oldId).run()
  },
  {
    key: 'c', // reklama e'lonlarining rasmlari (katta va kichik o'lcham)
    list: (db, after, limit) =>
      db
        .prepare('SELECT id, image_file_id AS file_id FROM campaigns WHERE image_file_id IS NOT NULL AND id > ?1 ORDER BY id LIMIT ?2')
        .bind(after, limit)
        .all(),
    save: (db, id, oldId, sizes) =>
      db
        .prepare('UPDATE campaigns SET image_file_id = ?1, image_thumb_id = ?2 WHERE id = ?3 AND image_file_id = ?4')
        .bind(sizes.fileId, sizes.thumbId, id, oldId)
        .run()
  }
];

function readCursor(state) {
  try {
    const c = JSON.parse(state || '{}');
    return { u: Number(c.u) || 0, c: Number(c.c) || 0 };
  } catch {
    return { u: 0, c: 0 };
  }
}

// Bitta faylni yangi botga ko'chiradi. Qaytaradi: yangi o'lchamlar (pickSizes) yoki null —
// fayl yangi botda allaqachon bor yoki eski botda ham topilmadi (unda tegilmaydi).
async function moveFile(ctx, chat, fileId) {
  try {
    await ctx.tg.call('getFile', { file_id: fileId });
    return null;
  } catch (e) {
    if (isTemporary(e)) throw e;
  }
  let file;
  try {
    file = await ctx.oldTg.call('getFile', { file_id: fileId });
  } catch (e) {
    if (isTemporary(e)) throw e;
    console.warn('old file not found:', e.message);
    return null;
  }
  const res = await fetch(ctx.oldTg.fileUrl(file.file_path));
  if (!res.ok) throw new Error(`old file download: HTTP ${res.status}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  const kind = sniffImage(bytes) || { type: 'image/jpeg', ext: 'jpg' };
  // Yangi bot rasmni adminning chatiga ovozsiz yuklaydi va darhol o'chiradi: bizga faqat file_id kerak
  const message = await ctx.tg.uploadPhoto(chat, { bytes, type: kind.type, name: `photo.${kind.ext}` }, undefined, {
    disable_notification: true
  });
  await ctx.tg.call('deleteMessage', { chat_id: chat, message_id: message.message_id }).catch(() => {});
  return pickSizes(message.photo);
}

// Cron'dan: har safar bir nechta rasm. Admin yangi botga hali yozmagan bo'lsa, yuklash xato beradi
// va keyingi daqiqada qayta uriniladi. Qaytaradi: { moved, done } yoki null (ish yo'q).
export async function moveOldFiles(ctx, { limit = 1 } = {}) {
  if (!ctx.oldTg) return null;
  const state = await getSetting(ctx.db, FILES_MOVED);
  if (state === 'done') return null;
  const chat = adminIds(ctx.env)[0];
  if (!chat) return null;

  const cursor = readCursor(state);
  let budget = limit;
  let moved = 0;
  try {
    for (const job of FILE_JOBS) {
      if (cursor[job.key] < 0) continue;
      const requested = budget;
      const { results } = await job.list(ctx.db, cursor[job.key], requested);
      for (const row of results) {
        const sizes = await moveFile(ctx, chat, row.file_id);
        if (sizes) {
          await job.save(ctx.db, row.id, row.file_id, sizes);
          moved += 1;
        }
        cursor[job.key] = row.id;
        budget -= 1;
      }
      if (results.length < requested) cursor[job.key] = -1; // bu jadvalda boshqa rasm qolmadi
      if (budget <= 0) break;
    }
  } catch (e) {
    console.warn('moving old files paused:', e.message);
  }
  const done = cursor.u < 0 && cursor.c < 0;
  await setSetting(ctx.db, FILES_MOVED, done ? 'done' : JSON.stringify(cursor));
  return { moved, done };
}

/* ---------- Eski foydalanuvchilarga bir martalik xabar ---------- */

// Faqat admin sozlamalarda old_bot_notice = 'go' qilganda ishlaydi. Yangi botga allaqachon
// yozganlarga yuborilmaydi. Qaytaradi: { sent, done } yoki null (ish yo'q).
export async function noticeOldUsers(ctx, { limit = 5 } = {}) {
  if (!ctx.oldTg) return null;
  const state = await getSetting(ctx.db, OLD_NOTICE);
  if (!state || state === 'done') return null;

  let after = 0;
  if (state !== 'go') {
    try {
      after = Number(JSON.parse(state).after) || 0;
    } catch {
      return null;
    }
  }
  const { results } = await ctx.db
    .prepare('SELECT tg_id, lang FROM users WHERE tg_id > ?1 AND (bot_id IS NULL OR bot_id <> ?2) ORDER BY tg_id LIMIT ?3')
    .bind(after, botIdOf(ctx.env.BOT_TOKEN), limit)
    .all();
  const username = await newBotUsername(ctx);

  let sent = 0;
  let stopped = false;
  for (const u of results) {
    const { text, extra } = movedMessage(tr(u.lang), username);
    try {
      await ctx.oldTg.send(u.tg_id, text, extra);
      sent += 1;
    } catch (e) {
      // "Kuting" yoki tarmoq xatosi: keyingi daqiqada shu foydalanuvchidan davom etamiz.
      // Botni bloklagan (403) yoki chat topilmagan (400) — o'tkazib yuboramiz.
      if (isTemporary(e)) {
        stopped = true;
        break;
      }
    }
    after = u.tg_id;
  }
  const done = !stopped && results.length < limit;
  await setSetting(ctx.db, OLD_NOTICE, done ? 'done' : JSON.stringify({ after }));
  return { sent, done };
}
