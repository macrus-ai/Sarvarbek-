// Miqyos boti: Cloudflare Worker kirish nuqtasi
//
//   POST /telegram/webhook  — Telegramdan keladigan xabarlar
//   POST /setup             — webhook, menyu tugmasi va buyruqlarni sozlash (deploydan keyin)
//   /api/*                  — mini ilova API'si
//   GET /img/c/...          — reklama e'lonlarining rasmlari (Telegramdan olib beriladi)
//   /admin/login, /api/admin/* — admin panel (sahifasi public/admin/ da)
//   qolganlari              — mini ilova fayllari (public/)
//
//   scheduled (cron, har daqiqada, wrangler.toml) — yangi e'lonlar haqida blogerlarga xabar (broadcast.js)

import { handleAdmin } from './admin.js';
import { handleApi } from './api.js';
import { handleUpdate } from './bot.js';
import { sendAdBroadcasts } from './broadcast.js';
import { BRAND } from './constants.js';
import { getSetting, setSetting } from './db.js';
import { tr } from './i18n.js';
import { IMAGE_PATH, STATS_PATH, serveImage, serveStatsImage } from './images.js';
import { createTelegram, webhookSecret } from './telegram.js';
import { json } from './util.js';

export default {
  async fetch(request, env, exec) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/health') return json({ ok: true });

    const image = path.match(IMAGE_PATH);
    const stats = path.match(STATS_PATH);
    const admin = path === '/admin/login' || path.startsWith('/api/admin/');
    if (admin || image || stats || path === '/telegram/webhook' || path === '/setup' || path.startsWith('/api/')) {
      if (!env.BOT_TOKEN || !env.DB) return json({ error: 'not_configured' }, 503);
      // exec: javobdan keyin fonda davom etadigan ishlar uchun (waitUntil)
      const ctx = { env, db: env.DB, tg: createTelegram(env.BOT_TOKEN), origin: url.origin, exec };
      try {
        if (image) return await serveImage(request, ctx, image, exec);
        if (stats) return await serveStatsImage(request, ctx, stats, exec);
        if (admin) return await handleAdmin(request, ctx);
        if (path === '/telegram/webhook') return await webhook(request, ctx);
        if (path === '/setup') return await setup(request, ctx);
        return await handleApi(request, ctx);
      } catch (e) {
        console.error('request failed:', e);
        return json({ error: 'server' }, 500);
      }
    }

    if (env.ASSETS) return env.ASSETS.fetch(request);
    return new Response('Not found', { status: 404 });
  },

  // Cron: navbatdagi blogerlarga yangi e'lon haqida xabar. Manzil (mini ilova havolasi uchun) /setup da saqlanadi.
  async scheduled(event, env) {
    if (!env.BOT_TOKEN || !env.DB) return;
    const origin = await getSetting(env.DB, APP_ORIGIN);
    if (!origin) {
      console.warn('scheduled: app origin is not saved yet (run /setup)');
      return;
    }
    const ctx = { env, db: env.DB, tg: createTelegram(env.BOT_TOKEN), origin };
    try {
      const r = await sendAdBroadcasts(ctx);
      if (r.sent || r.blocked.length || r.skipped) console.log('ad notify:', JSON.stringify({ ...r, blocked: r.blocked.length }));
    } catch (e) {
      console.error('ad notify failed:', e);
    }
  }
};

// Sozlamalardagi kalit: mini ilova manzili (https://...workers.dev)
const APP_ORIGIN = 'app_origin';

async function webhook(request, ctx) {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const secret = await webhookSecret(ctx.env.BOT_TOKEN);
  if (request.headers.get('x-telegram-bot-api-secret-token') !== secret) return new Response('Forbidden', { status: 403 });

  let update;
  try {
    update = await request.json();
  } catch {
    return new Response('Bad request', { status: 400 });
  }

  try {
    await handleUpdate(update, ctx);
  } catch (e) {
    // Telegram qayta-qayta yubormasligi uchun baribir 200 qaytaramiz
    console.error('update failed:', e);
  }
  return new Response('ok');
}

// Deploy workflow shu manzilni chaqiradi. Kalit bot tokenidan hosil qilinadi.
async function setup(request, ctx) {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const secret = await webhookSecret(ctx.env.BOT_TOKEN);
  if (request.headers.get('x-setup-key') !== secret) return json({ error: 'forbidden' }, 403);

  const { tg, origin } = ctx;
  // Cron'da so'rov manzili bo'lmaydi: xabardagi ilova havolasi uchun saqlab qo'yamiz
  await setSetting(ctx.db, APP_ORIGIN, origin);
  const me = await tg.call('getMe');
  await tg.call('setWebhook', {
    url: `${origin}/telegram/webhook`,
    secret_token: secret,
    allowed_updates: ['message', 'callback_query']
  });
  await tg.call('setChatMenuButton', {
    menu_button: { type: 'web_app', text: BRAND, web_app: { url: `${origin}/` } }
  });
  // Botning Telegram'dagi ismi. Telegram ismni tez-tez o'zgartirishga ruxsat bermaydi,
  // shuning uchun faqat farq qilsa yozamiz, xato bo'lsa ham deploy to'xtamaydi.
  try {
    const current = await tg.call('getMyName');
    if (current?.name !== BRAND) await tg.call('setMyName', { name: BRAND });
  } catch (e) {
    console.error('setMyName failed:', e);
  }

  for (const lang of ['uz', 'ru']) {
    const T = tr(lang);
    const scope = lang === 'ru' ? { language_code: 'ru' } : {};
    await tg.call('setMyCommands', { commands: T.commands, ...scope });
    await tg.call('setMyCommands', { commands: T.groupCommands, scope: { type: 'all_group_chats' }, ...scope });
    await tg.call('setMyDescription', { description: T.description, ...scope });
    await tg.call('setMyShortDescription', { short_description: T.shortDescription, ...scope });
  }

  return json({ ok: true, bot: me.username, app: `${origin}/`, webhook: `${origin}/telegram/webhook` });
}
