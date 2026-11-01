// Ovoza boti: Cloudflare Worker kirish nuqtasi
//
//   POST /telegram/webhook  — Telegramdan keladigan xabarlar
//   POST /setup             — webhook, menyu tugmasi va buyruqlarni sozlash (deploydan keyin)
//   /api/*                  — mini ilova API'si
//   GET /img/c/...          — reklama e'lonlarining rasmlari (Telegramdan olib beriladi)
//   qolganlari              — mini ilova fayllari (public/)

import { handleApi } from './api.js';
import { handleUpdate } from './bot.js';
import { tr } from './i18n.js';
import { IMAGE_PATH, serveImage } from './images.js';
import { createTelegram, webhookSecret } from './telegram.js';
import { json } from './util.js';

export default {
  async fetch(request, env, exec) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/health') return json({ ok: true });

    const image = path.match(IMAGE_PATH);
    if (image || path === '/telegram/webhook' || path === '/setup' || path.startsWith('/api/')) {
      if (!env.BOT_TOKEN || !env.DB) return json({ error: 'not_configured' }, 503);
      const ctx = { env, db: env.DB, tg: createTelegram(env.BOT_TOKEN), origin: url.origin };
      try {
        if (image) return await serveImage(request, ctx, image, exec);
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
  }
};

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
  const me = await tg.call('getMe');
  await tg.call('setWebhook', {
    url: `${origin}/telegram/webhook`,
    secret_token: secret,
    allowed_updates: ['message', 'callback_query']
  });
  await tg.call('setChatMenuButton', {
    menu_button: { type: 'web_app', text: 'Ovoza', web_app: { url: `${origin}/` } }
  });

  for (const lang of ['uz', 'ru']) {
    const T = tr(lang);
    const scope = lang === 'ru' ? { language_code: 'ru' } : {};
    await tg.call('setMyCommands', { commands: T.commands, ...scope });
    await tg.call('setMyDescription', { description: T.description, ...scope });
    await tg.call('setMyShortDescription', { short_description: T.shortDescription, ...scope });
  }

  return json({ ok: true, bot: me.username, app: `${origin}/`, webhook: `${origin}/telegram/webhook` });
}
