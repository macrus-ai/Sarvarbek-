// So'rov yuborish, so'rov bo'yicha qaror va moderatsiya: mini ilova ham, bot tugmalari ham shu funksiyalardan foydalanadi

import { findFollowers } from './constants.js';
import {
  closeBusinessCampaigns, closeCampaignByAdmin, decideApplication, getApplicationFull, getCampaign, getSetting, getUser,
  insertApplication, setApplicationNotify, setCampaignModeration, setModeration
} from './db.js';
import { tr } from './i18n.js';
import { TelegramError } from './telegram.js';
import { adminIds, isAdmin, isApproved, isRegistered, profileUrl } from './util.js';

export class AppError extends Error {
  constructor(code, status = 400, extra = {}) {
    super(code);
    this.code = code;
    this.status = status;
    this.extra = extra;
  }
}

export const appUrl = (ctx, tab) => `${ctx.origin}/${tab ? `?tab=${tab}` : ''}`;

// Tasdiqlangan foydalanuvchining bosh menyusi. Bloger ma'lumotlarini yangilaydi,
// biznes esa o'chirib, qaytadan ro'yxatdan o'tadi (eski e'lonlar qolmasin).
export const homeKeyboard = (T, ctx, role) => ({
  inline_keyboard: [
    [{ text: T.openApp, web_app: { url: appUrl(ctx) } }],
    role === 'business'
      ? [{ text: T.deleteBusiness, callback_data: 'biz:delete' }]
      : [{ text: T.updateProfile, callback_data: 'reg:restart' }]
  ]
});
export const pendingKeyboard = (T) => ({ inline_keyboard: [[{ text: T.editProfile, callback_data: 'reg:restart' }]] });
export const resubmitKeyboard = (T) => ({ inline_keyboard: [[{ text: T.resubmit, callback_data: 'reg:restart' }]] });

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

// Blogerning obunachilari e'lon talabiga yetadimi (oraliqning yuqori chegarasi bo'yicha)
export function followersOk(blogger, campaign) {
  const range = findFollowers(blogger.followers);
  return !(campaign.min_followers > 0 && range && range.max !== null && range.max < campaign.min_followers);
}

// Bloger reklama e'loniga so'rov yuboradi; biznesga bot orqali xabar boradi
export async function applyToCampaign(ctx, blogger, campaignId, message) {
  if (!isApproved(blogger) || blogger.role !== 'blogger') throw new AppError('forbidden', 403);

  const c = await getCampaign(ctx.db, campaignId, blogger.tg_id);
  if (!c) throw new AppError('not_found', 404);
  if (c.moderation !== 'approved') throw new AppError('not_found', 404);
  if (c.status !== 'active') throw new AppError('campaign_closed', 409);
  if (c.my_status) throw new AppError('already_applied', 409);
  if (c.accepted >= c.slots) throw new AppError('campaign_full', 409);

  if (!followersOk(blogger, c)) throw new AppError('followers_low', 409, { min: c.min_followers });

  const row = await insertApplication(ctx.db, c.id, blogger.tg_id, message);
  if (!row) throw new AppError('already_applied', 409);

  await notifyBusiness(ctx, row.id);
  return { id: row.id, status: 'pending' };
}

// Biznesga yangi so'rov: blogerning profili va statistikasi (skrinshot bo'lsa — rasm bilan).
// Telegram profili va telefon raqami faqat qabul qilinganda ochiladi.
async function notifyBusiness(ctx, appId) {
  const a = await getApplicationFull(ctx.db, appId);
  const T = tr(a.business_lang);
  try {
    const msg = await deliver(ctx, a.business_id, {
      text: T.newApplication(a),
      photo: a.stats_file_id || null,
      extra: { reply_markup: decisionKeyboard(T, a.id, ctx) }
    });
    await setApplicationNotify(ctx.db, a.id, a.business_id, msg.message_id);
  } catch (e) {
    // Biznes botni bloklagan bo'lishi mumkin: so'rov baribir ilovada ko'rinadi
    console.warn('notify business failed:', e.message);
  }
}

// Xabar matnini yoki (rasmli xabarda) rasm ostidagi matnni almashtiradi
export async function editMessage(ctx, chatId, messageId, text, extra = {}) {
  try {
    return await ctx.tg.edit(chatId, messageId, text, extra);
  } catch (e) {
    if (!(e instanceof TelegramError) || e.code !== 400) throw e;
    return ctx.tg.editCaption(chatId, messageId, text, extra);
  }
}

// Biznes so'rovni qabul qiladi yoki rad etadi; blogerga bot orqali javob boradi
export async function decide(ctx, business, appId, decision) {
  if (decision !== 'accepted' && decision !== 'rejected') throw new AppError('invalid', 400);
  if (!isApproved(business) || business.role !== 'business') throw new AppError('forbidden', 403);

  const changes = await decideApplication(ctx.db, appId, business.tg_id, decision);
  const a = await getApplicationFull(ctx.db, appId);
  if (!a || a.business_id !== business.tg_id) throw new AppError('not_found', 404);
  if (!changes) throw new AppError(a.status !== 'pending' ? 'already_decided' : 'campaign_full', 409);

  // Biznesdagi xabardan tugmalarni olib, natijani yozib qo'yamiz
  const TB = tr(a.business_lang);
  if (a.notify_message_id) {
    const status = decision === 'accepted' ? TB.statusAccepted(a) : TB.statusRejected;
    try {
      await editMessage(ctx, a.notify_chat_id, a.notify_message_id, `${TB.newApplication(a, true)}\n\n${status}`, {
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

/* ---------- Jamoaga xabarlar va moderatsiya ---------- */

// Jamoa guruhlari (botni guruhga qo'shib, /ulash bilan bog'lanadi). Har biri alohida guruh bo'lishi mumkin:
//   blogger — yangi blogerlar, business — yangi bizneslar, ads — yangi reklama e'lonlari
export const MOD_CHAT_KEYS = { blogger: 'chat_blogger', business: 'chat_business', ads: 'chat_ads' };

// E'lonlar guruhi ulanmagan bo'lsa, e'lonlar bizneslar guruhiga keladi
const CHAT_ROUTES = {
  blogger: [MOD_CHAT_KEYS.blogger],
  business: [MOD_CHAT_KEYS.business],
  ads: [MOD_CHAT_KEYS.ads, MOD_CHAT_KEYS.business]
};

export async function moderationChat(ctx, kind) {
  for (const key of CHAT_ROUTES[kind] || CHAT_ROUTES.business) {
    const value = await getSetting(ctx.db, key);
    if (value) return Number(value);
  }
  return null;
}

export async function isModerationChat(ctx, chatId) {
  if (chatId == null) return false;
  const chats = await Promise.all(Object.values(MOD_CHAT_KEYS).map((key) => getSetting(ctx.db, key)));
  return chats.some((value) => value && Number(value) === Number(chatId));
}

// Moderator: ADMIN_IDS dagi admin yoki moderatsiya guruhidagi tugmani bosgan a'zo
export async function canModerate(ctx, userId, chatId) {
  return isAdmin(userId, ctx.env) || (await isModerationChat(ctx, chatId));
}

// Moderatorlar bo'lmasa (ADMIN_IDS ham, guruh ham yo'q), yangi profillar avtomatik tasdiqlanadi
export async function moderationEnabled(ctx) {
  if (adminIds(ctx.env).length) return true;
  return Boolean((await moderationChat(ctx, 'blogger')) || (await moderationChat(ctx, 'business')));
}

// Xabarni yuboradi. Profil havolasi tugmasini Telegram qabul qilmasa, tugmasiz qayta yuboradi.
// Rasm (file_id) bo'lsa — rasm ostida matn bilan; rasmni yuborib bo'lmasa — oddiy matn.
export async function deliver(ctx, chatId, { text, extra = {}, photo }) {
  if (photo) {
    try {
      return await ctx.tg.photo(chatId, photo, text, extra);
    } catch (e) {
      // Masalan, matn rasm osti uchun juda uzun (1024 belgi) yoki rasm topilmadi
      if (!(e instanceof TelegramError) || e.code !== 400) throw e;
      console.warn('send photo failed, sending text:', e.message);
    }
  }
  try {
    return await ctx.tg.send(chatId, text, extra);
  } catch (e) {
    const rows = extra.reply_markup?.inline_keyboard;
    if (!(e instanceof TelegramError) || e.code !== 400 || !rows?.some((row) => row.some((b) => b.url))) throw e;
    const keyboard = rows.map((row) => row.filter((b) => !b.url)).filter((row) => row.length);
    return ctx.tg.send(chatId, text, { ...extra, reply_markup: { inline_keyboard: keyboard } });
  }
}

// Jamoaga xabar. build(T) => { text, extra, photo? }. kind: 'blogger' | 'business' | 'ads' (qaysi guruhga).
// Guruh ulangan bo'lsa — guruhga (o'zbekcha), aks holda ADMIN_IDS dagilarga shaxsan.
// Xato bo'lsa ham asosiy ish to'xtamaydi.
export async function notifyAdmins(ctx, build, kind = 'business') {
  const chat = await moderationChat(ctx, kind);
  if (chat) {
    try {
      await deliver(ctx, chat, build(tr('uz')));
      return;
    } catch (e) {
      // Bot guruhdan chiqarilgan bo'lishi mumkin: xabar yo'qolmasin, adminlarga yuboramiz
      console.warn('notify moderation chat failed:', e.message);
    }
  }
  for (const id of adminIds(ctx.env)) {
    try {
      const admin = await getUser(ctx.db, id);
      await deliver(ctx, id, build(tr(admin?.lang)));
    } catch (e) {
      console.warn('notify admin failed:', e.message);
    }
  }
}

// mode: 'new' | 'resubmitted' (tasdiqlash/rad etish) yoki 'updated' (tasdiqlangan profil o'zgardi — bloklash)
export function moderationKeyboard(T, u, mode) {
  const rows =
    mode === 'updated'
      ? [[{ text: T.modBlock, callback_data: `mod:b:${u.tg_id}` }]]
      : [[
          { text: T.modApprove, callback_data: `mod:a:${u.tg_id}` },
          { text: T.modReject, callback_data: `mod:r:${u.tg_id}` }
        ]];
  const url = u.role === 'blogger' ? profileUrl(u.platform, u.profile) : null;
  if (url) rows.push([{ text: T.modProfile, url }]);
  return { inline_keyboard: rows };
}

// Bloger kartasi statistika skrinshoti bilan keladi (bo'lsa)
const moderationMessage = (T, u, mode) => ({
  text: mode === 'updated' ? T.modUpdated(u) : T.modNew(u, mode === 'resubmitted'),
  photo: u.role === 'blogger' ? u.stats_file_id || null : null,
  extra: { reply_markup: moderationKeyboard(T, u, mode) }
});

// Profil kartasini jamoaga yuboradi. chatId berilsa — aynan o'sha chatga (/moderatsiya ro'yxati uchun).
export function sendModerationCard(ctx, u, mode = 'new', { chatId = null, lang = 'uz' } = {}) {
  if (chatId) return deliver(ctx, chatId, moderationMessage(tr(lang), u, mode));
  return notifyAdmins(ctx, (T) => moderationMessage(T, u, mode), u.role);
}

// Moderator qarori. action: 'a' — tasdiqlash, 'r' — rad etish, 'b' — bloklash (tasdiqlangan profilni)
export async function moderate(ctx, moderatorId, targetId, action) {
  const status = action === 'a' ? 'approved' : 'rejected';
  const target = await getUser(ctx.db, targetId);
  if (!target || !isRegistered(target)) throw new AppError('gone', 404);
  if (!(await setModeration(ctx.db, targetId, status, moderatorId))) throw new AppError('already', 409);
  // Rad etilgan biznesning e'lonlari blogerlarga ko'rinmasin
  if (status === 'rejected' && target.role === 'business') await closeBusinessCampaigns(ctx.db, targetId);

  const T = tr(target.lang);
  try {
    if (status === 'approved') {
      const text = target.role === 'business' ? T.approvedBusiness : T.approvedBlogger;
      await ctx.tg.send(targetId, text, { reply_markup: homeKeyboard(T, ctx, target.role) });
    } else {
      await ctx.tg.send(targetId, T.rejectedNotice, { reply_markup: resubmitKeyboard(T) });
    }
  } catch (e) {
    // Foydalanuvchi botni bloklagan bo'lishi mumkin: qaror baribir saqlanadi
    console.warn('notify moderated user failed:', e.message);
  }
  return { target, status };
}

/* ---------- Reklama e'lonlari moderatsiyasi ---------- */

// E'lon kartasining tugmalari: moderatsiyada — tasdiqlash/rad etish, tasdiqlangan — yopish
export function adKeyboard(T, c) {
  if (c.moderation === 'pending') {
    return {
      inline_keyboard: [[
        { text: T.modApprove, callback_data: `cm:a:${c.id}` },
        { text: T.modReject, callback_data: `cm:r:${c.id}` }
      ]]
    };
  }
  return { inline_keyboard: [[{ text: T.adminClose, callback_data: `adm:close:${c.id}` }]] };
}

// Yangi e'lon kartasi e'lonlar guruhiga (kontakt — biznes egasining ismi)
export function sendAdCard(ctx, c, contact, { chatId = null, lang = 'uz' } = {}) {
  const build = (T) => ({
    text: T.adminNewCampaign({ ...c, business_contact: contact }),
    extra: { reply_markup: adKeyboard(T, c) }
  });
  if (chatId) return deliver(ctx, chatId, build(tr(lang)));
  return notifyAdmins(ctx, build, 'ads');
}

// Moderator qarori: action 'a' — tasdiqlash (blogerlarga ko'rinadi), 'r' — rad etish
export async function moderateCampaign(ctx, moderatorId, campaignId, action) {
  const status = action === 'a' ? 'approved' : 'rejected';
  const c = await getCampaign(ctx.db, campaignId, 0);
  if (!c) throw new AppError('gone', 404);
  if (!(await setCampaignModeration(ctx.db, campaignId, status, moderatorId))) throw new AppError('already', 409);
  // Rad etilgan e'lon yopiladi: faol e'lonlar limitidan joy egallamasin
  if (status === 'rejected') await closeCampaignByAdmin(ctx.db, campaignId);

  const owner = await getUser(ctx.db, c.business_id);
  const T = tr(owner?.lang);
  try {
    if (status === 'approved') {
      await ctx.tg.send(c.business_id, T.toBusinessAdApproved(c.title), {
        reply_markup: { inline_keyboard: [[{ text: T.openApp, web_app: { url: appUrl(ctx, 'campaigns') } }]] }
      });
    } else {
      await ctx.tg.send(c.business_id, T.toBusinessAdRejected(c.title));
    }
  } catch (e) {
    console.warn('notify business about ad failed:', e.message);
  }
  return { campaign: { ...c, moderation: status } };
}
