// Yangi reklama e'loni haqida mos blogerlarga xabar.
//
// E'lon tasdiqlanganda navbatga tushadi (db.js dagi enqueueAdBroadcast). Cloudflare cron har daqiqada
// shu yerdagi sendAdBroadcasts ni chaqiradi (index.js dagi scheduled): u keyingi blogerlarga yuboradi.
// Bitta ishga tushishda LIMITS.adNotifyBatch tadan ko'p emas: bepul tarifda bitta ishga tushishda
// 50 tagacha tashqi so'rov (Telegram va D1) mumkin.

import { LIMITS } from './constants.js';
import { adBroadcastTargets, advanceAdBroadcast, disableAdNotifications, getCampaign, openAdBroadcasts } from './db.js';
import { tr } from './i18n.js';
import { deliver } from './services.js';
import { TelegramError } from './telegram.js';
import { botIdOf } from './util.js';

// Mini ilovada e'lonni darhol ochadigan havola (app.js ?c= ni tushunadi)
export const adLink = (ctx, id) => `${ctx.origin}/?c=${id}`;

export const adNotifyKeyboard = (T, ctx, id) => ({
  inline_keyboard: [
    [{ text: T.viewAd, web_app: { url: adLink(ctx, id) } }],
    [{ text: T.notifyOffButton, callback_data: 'ntf:off' }]
  ]
});

export function adNotifyBatch(env) {
  const n = Number(env?.AD_NOTIFY_BATCH);
  return Number.isInteger(n) && n > 0 ? Math.min(n, 500) : LIMITS.adNotifyBatch;
}

// Qayta urinsa o'tadigan xatolar: Telegram "kuting" (429), Telegram serveri yoki tarmoq xatosi
const isTemporary = (e) => !(e instanceof TelegramError) || e.code === 429 || !e.code || e.code >= 500;

// Bitta ishga tushish. Qaytaradi: { sent, skipped, blocked, stopped }
export async function sendAdBroadcasts(ctx, { budget = adNotifyBatch(ctx.env) } = {}) {
  const result = { sent: 0, skipped: 0, blocked: [], stopped: false };

  for (const job of await openAdBroadcasts(ctx.db, 3)) {
    if (budget <= 0 || result.stopped) break;

    const c = await getCampaign(ctx.db, job.campaign_id, 0);
    // E'lon o'chirilgan, yopilgan, tasdiqlanmagan yoki o'rinlari to'lgan: boshqa yuborilmaydi
    if (!c || c.status !== 'active' || c.moderation !== 'approved' || Number(c.accepted) >= c.slots) {
      await advanceAdBroadcast(ctx.db, job.campaign_id, job.last_tg_id, 0, true);
      continue;
    }

    const limit = budget;
    const targets = await adBroadcastTargets(ctx.db, c, job.last_tg_id, limit, botIdOf(ctx.env.BOT_TOKEN));
    let last = job.last_tg_id;
    let sent = 0;
    for (const t of targets) {
      const T = tr(t.lang);
      try {
        await deliver(ctx, t.tg_id, {
          text: T.newAdForBlogger(c),
          photo: c.image_file_id || null,
          extra: { reply_markup: adNotifyKeyboard(T, ctx, c.id) }
        });
        sent += 1;
      } catch (e) {
        if (isTemporary(e)) {
          // Shu blogerdan keyingi daqiqada davom etamiz
          console.warn('ad notify paused:', e.message);
          result.stopped = true;
          break;
        }
        if (e.code === 403) result.blocked.push(t.tg_id); // botni bloklagan yoki akkaunt o'chirilgan
        else result.skipped += 1; // masalan, chat topilmadi
      }
      last = t.tg_id;
      budget -= 1;
    }
    result.sent += sent;
    const done = !result.stopped && targets.length < limit;
    await advanceAdBroadcast(ctx.db, c.id, last, sent, done);
  }

  await disableAdNotifications(ctx.db, result.blocked);
  return result;
}
