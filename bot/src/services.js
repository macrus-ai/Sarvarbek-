// So'rov yuborish va so'rov bo'yicha qaror: mini ilova ham, bot tugmalari ham shu funksiyalardan foydalanadi

import { findFollowers } from './constants.js';
import { decideApplication, getApplicationFull, getCampaign, getUser, insertApplication, setApplicationNotify } from './db.js';
import { tr } from './i18n.js';
import { adminIds, isRegistered } from './util.js';

export class AppError extends Error {
  constructor(code, status = 400, extra = {}) {
    super(code);
    this.code = code;
    this.status = status;
    this.extra = extra;
  }
}

export const appUrl = (ctx, tab) => `${ctx.origin}/${tab ? `?tab=${tab}` : ''}`;

export function decisionKeyboard(T, appId, ctx) {
  return {
    inline_keyboard: [
      [
        { text: T.accept, callback_data: `ap:a:${appId}` },
        { text: T.reject, callback_data: `ap:r:${appId}` }
      ],
      [{ text: T.openRequests, web_app: { url: appUrl(ctx, 'requests') } }]
    ]
  };
}

// Bloger kampaniyaga so'rov yuboradi; biznesga bot orqali xabar boradi
export async function applyToCampaign(ctx, blogger, campaignId, message) {
  if (!isRegistered(blogger) || blogger.role !== 'blogger') throw new AppError('forbidden', 403);

  const c = await getCampaign(ctx.db, campaignId, blogger.tg_id);
  if (!c) throw new AppError('not_found', 404);
  if (c.status !== 'active') throw new AppError('campaign_closed', 409);
  if (c.my_status) throw new AppError('already_applied', 409);
  if (c.accepted >= c.slots) throw new AppError('campaign_full', 409);

  const range = findFollowers(blogger.followers);
  if (c.min_followers > 0 && range && range.max !== null && range.max < c.min_followers) {
    throw new AppError('followers_low', 409, { min: c.min_followers });
  }

  const row = await insertApplication(ctx.db, c.id, blogger.tg_id, message);
  if (!row) throw new AppError('already_applied', 409);

  await notifyBusiness(ctx, row.id);
  return { id: row.id, status: 'pending' };
}

async function notifyBusiness(ctx, appId) {
  const a = await getApplicationFull(ctx.db, appId);
  const T = tr(a.business_lang);
  try {
    const msg = await ctx.tg.send(a.business_id, T.newApplication(a), { reply_markup: decisionKeyboard(T, a.id, ctx) });
    await setApplicationNotify(ctx.db, a.id, a.business_id, msg.message_id);
  } catch (e) {
    // Biznes botni bloklagan bo'lishi mumkin: so'rov baribir ilovada ko'rinadi
    console.warn('notify business failed:', e.message);
  }
}

// Biznes so'rovni qabul qiladi yoki rad etadi; blogerga bot orqali javob boradi
export async function decide(ctx, business, appId, decision) {
  if (decision !== 'accepted' && decision !== 'rejected') throw new AppError('invalid', 400);
  if (!isRegistered(business) || business.role !== 'business') throw new AppError('forbidden', 403);

  const changes = await decideApplication(ctx.db, appId, business.tg_id, decision);
  const a = await getApplicationFull(ctx.db, appId);
  if (!a || a.business_id !== business.tg_id) throw new AppError('not_found', 404);
  if (!changes) throw new AppError(a.status !== 'pending' ? 'already_decided' : 'campaign_full', 409);

  // Biznesdagi xabardan tugmalarni olib, natijani yozib qo'yamiz
  const TB = tr(a.business_lang);
  if (a.notify_message_id) {
    const status = decision === 'accepted' ? TB.statusAccepted(a) : TB.statusRejected;
    try {
      await ctx.tg.edit(a.notify_chat_id, a.notify_message_id, `${TB.newApplication(a)}\n\n${status}`, {
        reply_markup: { inline_keyboard: [] }
      });
    } catch (e) {
      console.warn('edit business message failed:', e.message);
    }
  }

  const TG = tr(a.blogger_lang);
  try {
    await ctx.tg.send(a.blogger_id, decision === 'accepted' ? TG.toBloggerAccepted(a) : TG.toBloggerRejected(a), {
      reply_markup: { inline_keyboard: [[{ text: TG.openApp, web_app: { url: appUrl(ctx, 'mine') } }]] }
    });
  } catch (e) {
    console.warn('notify blogger failed:', e.message);
  }

  return { id: a.id, status: a.status };
}

// Adminlarga (ADMIN_IDS) xabar. build(T) => { text, extra }. Xato bo'lsa ham asosiy ish to'xtamaydi.
export async function notifyAdmins(ctx, build) {
  for (const id of adminIds(ctx.env)) {
    try {
      const admin = await getUser(ctx.db, id);
      const { text, extra = {} } = build(tr(admin?.lang));
      await ctx.tg.send(id, text, extra);
    } catch (e) {
      console.warn('notify admin failed:', e.message);
    }
  }
}
