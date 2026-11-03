// Telegram xabarlari: ro'yxatdan o'tish, buyruqlar va tugmalar

import {
  ACCOUNTS_REACHED, CATEGORIES, FOLLOWERS, NICHES, PLATFORMS, REACH, REELS_REACH, REGIONS, findAccountsReached,
  findFollowers, findReach, findReelsReach, isCategory, isNiche, isPlatform, isRegion
} from './constants.js';
import {
  closeBusinessCampaigns, closeCampaignByAdmin, deleteUserData, getSetting, getStats, getUser, listPendingCampaigns,
  listPendingUsers, setSetting, touchUser, updateUser
} from './db.js';
import { createLoginLink } from './admin.js';
import { accountsLabel, catLabel, followersLabel, nicheLabel, reachLabel, reelsLabel, regionLabel, tr } from './i18n.js';
import { newImageKey } from './images.js';
import {
  AppError, MOD_CHAT_KEYS, adKeyboard, canModerate, decide, editMessage, homeKeyboard, isModerationChat, moderate,
  moderateCampaign, moderationEnabled, pendingKeyboard, resubmitKeyboard, sendAdCard, sendModerationCard
} from './services.js';
import { botIdOf, esc, guessLang, isAdmin, isRegistered, normalizePhone, normalizeProfile, now, privacyUrl } from './util.js';

// Ro'yxatdan o'tish qadamlari.
// Bloger ko'rishlari: Instagram — reels, postlar, istoriya (reach), qamrov (accounts); boshqalar — faqat reach.
const FLOW = {
  business: ['name', 'company', 'category', 'phone'],
  blogger: [
    'name', 'platform', 'profile', 'followers', 'reels', 'posts', 'reach', 'accounts', 'stats', 'niche', 'region', 'phone'
  ]
};
const BUTTON_STEPS = new Set([
  'lang', 'role', 'category', 'platform', 'followers', 'reels', 'posts', 'reach', 'accounts', 'niche', 'region'
]);

// Reels, postlar va qamrov savollari faqat Instagram blogerlari uchun
const INSTAGRAM_STEPS = new Set(['reels', 'posts', 'accounts']);
const stepApplies = (step, user) => !INSTAGRAM_STEPS.has(step) || user.platform === 'Instagram';

// Platforma Instagram bo'lmasa, Instagramga xos javoblar tozalanadi (eski reels_reach ham)
const NOT_INSTAGRAM = { reels_reach: null, reels_views: null, posts_views: null, accounts_reached: null };

const statsKeyboard = (T) => ({ inline_keyboard: [[{ text: T.statsSkip, callback_data: 'stats:skip' }]] });

export async function handleUpdate(update, ctx) {
  if (update.message) return onMessage(update.message, ctx);
  if (update.callback_query) return onCallback(update.callback_query, ctx);
  return undefined;
}

/* ---------- Klaviaturalar ---------- */

function rows(buttons, perRow) {
  const out = [];
  for (let i = 0; i < buttons.length; i += perRow) out.push(buttons.slice(i, i + perRow));
  return out;
}

// role berilsa (saytdagi havoladan), til tanlangandan keyin rol savoli o'tkazib yuboriladi
const langKeyboard = (prefix, role = null) => ({
  inline_keyboard: [[
    { text: '🇺🇿 O‘zbekcha', callback_data: `${prefix}:uz${role ? `:${role}` : ''}` },
    { text: '🇷🇺 Русский', callback_data: `${prefix}:ru${role ? `:${role}` : ''}` }
  ]]
});

// Saytdagi havola: t.me/<bot>?start=business-uz (rol va ixtiyoriy til)
export function parseStartPayload(payload) {
  const m = String(payload || '').toLowerCase().match(/^(business|blogger)(?:[-_](uz|ru))?$/);
  return { role: m ? m[1] : null, lang: m && m[2] ? m[2] : null };
}

// Oraliq tugmalari (ko'rishlar, qamrov), ikki ustunda
const rangeButtons = (ranges, label, prefix, lang) => ({
  inline_keyboard: rows(ranges.map((r) => ({ text: label(r.id, lang), callback_data: `${prefix}:${r.id}` })), 2)
});

const phoneKeyboard = (T) => ({
  keyboard: [[{ text: T.phoneButton, request_contact: true }]],
  resize_keyboard: true,
  one_time_keyboard: true
});

/* ---------- Savollar ---------- */

function ask(ctx, user, step) {
  const T = tr(user.lang);
  const id = user.tg_id;
  const lang = user.lang === 'ru' ? 'ru' : 'uz';
  const categoryButtons = () => ({
    inline_keyboard: rows(CATEGORIES.map((c) => ({ text: c[lang], callback_data: `cat:${c.id}` })), 2)
  });
  const nicheButtons = () => ({
    inline_keyboard: rows(NICHES.map((n) => ({ text: n[lang], callback_data: `niche:${n.id}` })), 2)
  });

  switch (step) {
    case 'lang':
      return ctx.tg.send(id, T.chooseLang, { reply_markup: langKeyboard('lang') });
    case 'role':
      return ctx.tg.send(id, T.welcome(privacyUrl(ctx.env, lang)), {
        reply_markup: {
          inline_keyboard: [
            [{ text: T.roleBusiness, callback_data: 'role:business' }],
            [{ text: T.roleBlogger, callback_data: 'role:blogger' }]
          ]
        }
      });
    case 'name':
      return ctx.tg.send(id, T.askName);
    case 'company':
      return ctx.tg.send(id, T.askCompany);
    case 'category':
      return ctx.tg.send(id, T.askCategory, { reply_markup: categoryButtons() });
    case 'niche':
      return ctx.tg.send(id, T.askNiche, { reply_markup: nicheButtons() });
    case 'region':
      return ctx.tg.send(id, T.askRegion, {
        reply_markup: { inline_keyboard: rows(REGIONS.map((r) => ({ text: r[lang], callback_data: `rgn:${r.id}` })), 2) }
      });
    case 'platform':
      return ctx.tg.send(id, T.askPlatform, {
        reply_markup: { inline_keyboard: rows(PLATFORMS.map((p) => ({ text: p, callback_data: `plat:${p}` })), 2) }
      });
    case 'profile':
      return ctx.tg.send(id, T.askProfile(user.platform));
    case 'reels':
      return ctx.tg.send(id, T.askReels, { reply_markup: rangeButtons(REELS_REACH, reelsLabel, 'rls', lang) });
    case 'posts':
      return ctx.tg.send(id, T.askPosts, { reply_markup: rangeButtons(REACH, reachLabel, 'pst', lang) });
    case 'reach':
      return ctx.tg.send(id, T.askReach(user.platform), { reply_markup: rangeButtons(REACH, reachLabel, 'rch', lang) });
    case 'accounts':
      return ctx.tg.send(id, T.askAccounts, { reply_markup: rangeButtons(ACCOUNTS_REACHED, accountsLabel, 'acc', lang) });
    case 'stats':
      return ctx.tg.send(id, T.askStats(user.platform), { reply_markup: statsKeyboard(T) });
    case 'followers':
      return ctx.tg.send(id, T.askFollowers, {
        reply_markup: {
          inline_keyboard: rows(FOLLOWERS.map((f) => ({ text: followersLabel(f.id), callback_data: `fol:${f.id}` })), 2)
        }
      });
    case 'phone':
      return ctx.tg.send(id, T.askPhone, { reply_markup: phoneKeyboard(T) });
    default:
      return undefined;
  }
}

// Javobni saqlaydi va keyingi qadamni belgilaydi (Telegramga hech narsa yubormaydi)
async function save(ctx, user, fields) {
  const flow = FLOW[user.role];
  const merged = { ...user, ...fields };
  let next = 'done';
  for (let i = flow.indexOf(user.reg_step) + 1; i < flow.length; i += 1) {
    if (stepApplies(flow[i], merged)) {
      next = flow[i];
      break;
    }
  }
  const changes = { ...fields, reg_step: next };
  if (next === 'done') changes.registered_at = user.registered_at || now();
  await updateUser(ctx.db, user.tg_id, changes);
  // firstRegistration: adminga "yangi foydalanuvchi" xabari uchun (qayta ro'yxatdan o'tishda emas)
  return { ...user, ...changes, firstRegistration: next === 'done' && !user.registered_at };
}

// Keyingi savolni beradi yoki ro'yxatdan o'tishni yakunlaydi
const proceed = (ctx, user) => (user.reg_step === 'done' ? finish(ctx, user) : ask(ctx, user, user.reg_step));

// Avval saqlaymiz, keyin yozamiz: xabar yuborilmay qolsa ham javob yo'qolmaydi
async function advance(ctx, user, fields) {
  return proceed(ctx, await save(ctx, user, fields));
}

// Ro'yxatdan o'tish tugadi. Yangi profil jamoa tasdiqlaguncha moderatsiyada turadi.
async function finish(ctx, user) {
  const T = tr(user.lang);
  const summary = user.role === 'business' ? T.summaryBusiness(user) : T.summaryBlogger(user);
  const doneText = user.role === 'business' ? T.doneBusiness(summary) : T.doneBlogger(summary);

  // Tasdiqlangan foydalanuvchi ma'lumotlarini yangiladi: kirish saqlanadi, jamoa o'zgarishni ko'radi
  if (user.moderation === 'approved') {
    try {
      await ctx.tg.send(user.tg_id, doneText, { reply_markup: homeKeyboard(T, ctx, user.role) });
    } finally {
      await sendModerationCard(ctx, user, 'updated');
    }
    return;
  }

  // Moderatorlar sozlanmagan bo'lsa, profil darhol faollashadi
  if (!(await moderationEnabled(ctx))) {
    await updateUser(ctx.db, user.tg_id, { moderation: 'approved' });
    await ctx.tg.send(user.tg_id, doneText, { reply_markup: homeKeyboard(T, ctx, user.role) });
    return;
  }

  const resubmitted = Boolean(user.moderation);
  await updateUser(ctx.db, user.tg_id, { moderation: 'pending' });
  try {
    await ctx.tg.send(user.tg_id, T.donePending(summary), { reply_markup: pendingKeyboard(T) });
  } finally {
    await sendModerationCard(ctx, { ...user, moderation: 'pending' }, resubmitted ? 'resubmitted' : 'new');
  }
}

// Bosh menyu: faqat tasdiqlangan profil ilovani ocha oladi
function sendHome(ctx, user) {
  const T = tr(user.lang);
  const id = user.tg_id;
  if (user.moderation === 'rejected') return ctx.tg.send(id, T.rejectedNotice, { reply_markup: resubmitKeyboard(T) });
  if (user.moderation !== 'approved') return ctx.tg.send(id, T.pendingHome, { reply_markup: pendingKeyboard(T) });
  return ctx.tg.send(id, T.home(user.name || user.first_name || ''), { reply_markup: homeKeyboard(T, ctx, user.role) });
}

// Biznes ma'lumotlarini yangilamaydi: hammasini o'chirib, qaytadan ro'yxatdan o'tadi (eski e'lonlar qolmaydi)
function askDeleteBusiness(ctx, user) {
  const T = tr(user.lang);
  return ctx.tg.send(user.tg_id, T.bizDeleteConfirm, {
    reply_markup: {
      inline_keyboard: [[
        { text: T.bizDeleteYes, callback_data: 'biz:yes' },
        { text: T.deleteNo, callback_data: 'biz:no' }
      ]]
    }
  });
}

/* ---------- Moderatsiya guruhi ---------- */

// which: 'all' | 'blogger' | 'business' | 'ads'
async function bindModerationChat(ctx, chatId, which) {
  for (const [kind, key] of Object.entries(MOD_CHAT_KEYS)) {
    if (which === 'all' || which === kind) await setSetting(ctx.db, key, chatId);
  }
}

// "/ulash bloger", "/ulash biznes", "/ulash elon" (e'lon, reklama), argumentsiz — hammasi
function parseBindTarget(arg) {
  const a = String(arg || '').toLowerCase().replace(/[‘’'ʻʼ`]/g, '');
  if (a.startsWith('blog')) return 'blogger';
  if (a.startsWith('biz') || a.startsWith('brend')) return 'business';
  if (a.startsWith('elon') || a.startsWith('rek') || a.startsWith('ads') || a.startsWith('объяв')) return 'ads';
  return 'all';
}

// Tasdiq kutayotgan profillar va reklama e'lonlari: eng eskilari, kartalari bilan.
// what: { users, ads } — shu chatga qaysilari kerak (alohida guruhlar bo'lsa, har biriga o'zinikilari).
async function sendPendingList(ctx, chatId, lang = 'uz', what = { users: true, ads: true }) {
  const T = tr(lang);
  const { pending, pending_ads: pendingAds } = await getStats(ctx.db);
  const users = what.users ? pending : 0;
  const ads = what.ads ? pendingAds : 0;
  if (!users && !ads) return ctx.tg.send(chatId, T.pendingNone);
  const sendSafe = async (fn) => {
    try {
      await fn();
    } catch (e) {
      console.warn('send pending card failed:', e.message);
    }
  };
  if (users) {
    await ctx.tg.send(chatId, T.pendingCount(users));
    for (const u of await listPendingUsers(ctx.db)) await sendSafe(() => sendModerationCard(ctx, u, 'new', { chatId, lang }));
  }
  if (ads) {
    await ctx.tg.send(chatId, T.pendingAdsCount(ads));
    for (const c of await listPendingCampaigns(ctx.db)) {
      const owner = await getUser(ctx.db, c.business_id);
      await sendSafe(() => sendAdCard(ctx, c, owner?.name || '', { chatId, lang }));
    }
  }
  return undefined;
}

// Guruh qaysi oqimlarga ulangan: profillar (bloger/biznes) va e'lonlar
async function chatKinds(ctx, chatId) {
  const value = async (key) => Number(await getSetting(ctx.db, key)) || null;
  const [blogger, business, ads] = await Promise.all([
    value(MOD_CHAT_KEYS.blogger),
    value(MOD_CHAT_KEYS.business),
    value(MOD_CHAT_KEYS.ads)
  ]);
  return {
    users: chatId === blogger || chatId === business,
    // E'lonlar guruhi bo'lmasa, e'lonlar bizneslar guruhiga keladi
    ads: chatId === ads || (!ads && chatId === business)
  };
}

// Guruhdagi xabarlar: botni qo'shish, /ulash, /moderatsiya, /stats. Boshqa xabarlarga javob berilmaydi.
async function onGroupMessage(msg, ctx) {
  const chatId = msg.chat.id;
  const T = tr('uz');

  // Guruh supergroupga aylansa, Telegram yangi ID beradi
  if (msg.migrate_to_chat_id) {
    for (const key of Object.values(MOD_CHAT_KEYS)) {
      if (Number(await getSetting(ctx.db, key)) === chatId) await setSetting(ctx.db, key, msg.migrate_to_chat_id);
    }
    return undefined;
  }

  const admin = isAdmin(msg.from.id, ctx.env);
  const botId = botIdOf(ctx.env.BOT_TOKEN);
  const added =
    msg.group_chat_created || msg.supergroup_chat_created || (msg.new_chat_members || []).some((m) => m.id === botId);
  if (added) {
    if (!admin) return undefined;
    // Birinchi guruh avtomatik ulanadi; keyingilari uchun qanday ulash ko'rsatiladi
    for (const key of Object.values(MOD_CHAT_KEYS)) {
      if (await getSetting(ctx.db, key)) return ctx.tg.send(chatId, T.groupHelp);
    }
    await bindModerationChat(ctx, chatId, 'all');
    return ctx.tg.send(chatId, T.groupBound('all'));
  }

  const text = typeof msg.text === 'string' ? msg.text.trim() : '';
  if (!text.startsWith('/')) return undefined;
  const [head, arg = ''] = text.slice(1).split(/\s+/);
  const cmd = head.split('@')[0].toLowerCase();

  if (cmd === 'ulash') {
    if (!admin) return ctx.tg.send(chatId, T.groupNotAdmin);
    const which = parseBindTarget(arg);
    await bindModerationChat(ctx, chatId, which);
    return ctx.tg.send(chatId, T.groupBound(which));
  }
  if (cmd === 'moderatsiya' || cmd === 'stats') {
    if (!admin && !(await isModerationChat(ctx, chatId))) return undefined;
    if (cmd === 'stats') return ctx.tg.send(chatId, T.stats(await getStats(ctx.db)));
    const kinds = await chatKinds(ctx, chatId);
    // Hech qaysi oqimga ulanmagan guruhda admin so'rasa — hammasi
    return sendPendingList(ctx, chatId, 'uz', kinds.users || kinds.ads ? kinds : { users: true, ads: true });
  }
  return undefined;
}

async function start(ctx, user, payload) {
  if (isRegistered(user)) return sendHome(ctx, user);
  const { role, lang } = parseStartPayload(payload);
  if (role && lang) return beginAs(ctx, user, role, lang);
  await updateUser(ctx.db, user.tg_id, { reg_step: 'lang' });
  return ctx.tg.send(user.tg_id, tr(user.lang).chooseLang, { reply_markup: langKeyboard('lang', role) });
}

// Rol va til ma'lum: salomlashib, darhol ismni so'raymiz
async function beginAs(ctx, user, role, lang) {
  if (user.role === 'business' && role === 'blogger') await closeBusinessCampaigns(ctx.db, user.tg_id);
  await updateUser(ctx.db, user.tg_id, { lang, role, reg_step: 'name' });
  const updated = { ...user, lang, role, reg_step: 'name' };
  await ctx.tg.send(user.tg_id, tr(lang).welcomeAs(role, privacyUrl(ctx.env, lang)));
  return ask(ctx, updated, 'name');
}

/* ---------- Matnli xabarlar ---------- */

async function onMessage(msg, ctx) {
  if (!msg.from || msg.from.is_bot) return undefined;
  if (msg.chat?.type === 'group' || msg.chat?.type === 'supergroup') return onGroupMessage(msg, ctx);
  if (msg.chat?.type !== 'private') return undefined;

  const user = await touchUser(ctx.db, msg.from, guessLang(msg.from.language_code));
  const T = tr(user.lang);
  const id = user.tg_id;
  const text = typeof msg.text === 'string' ? msg.text.trim() : '';

  if (text.startsWith('/')) {
    const cmd = text.slice(1).split(/[\s@]/)[0].toLowerCase();
    if (cmd === 'start') return start(ctx, user, text.split(/\s+/)[1]);
    if (cmd === 'lang') return ctx.tg.send(id, T.chooseLang, { reply_markup: langKeyboard('setlang') });
    if (cmd === 'help') return ctx.tg.send(id, T.help);
    if (cmd === 'app') return isRegistered(user) ? sendHome(ctx, user) : ctx.tg.send(id, T.notRegistered);
    if (cmd === 'stats' && isAdmin(id, ctx.env)) return ctx.tg.send(id, T.stats(await getStats(ctx.db)));
    if (cmd === 'moderatsiya' && isAdmin(id, ctx.env)) return sendPendingList(ctx, id, user.lang);
    // Admin panelga kirish: havola faqat tugmada (matnda bo'lsa, Telegram uni ko'rib chiqib "ishlatib" qo'yishi mumkin)
    if (cmd === 'admin' && isAdmin(id, ctx.env)) {
      return ctx.tg.send(id, T.adminPanel, {
        reply_markup: { inline_keyboard: [[{ text: T.adminPanelButton, url: await createLoginLink(ctx, id) }]] }
      });
    }
    if (cmd === 'id') return ctx.tg.send(id, T.myId(id));
    if (cmd === 'privacy') return ctx.tg.send(id, T.privacy(privacyUrl(ctx.env, user.lang)));
    if (cmd === 'delete') {
      return ctx.tg.send(id, T.deleteConfirm, {
        reply_markup: {
          inline_keyboard: [[
            { text: T.deleteYes, callback_data: 'del:yes' },
            { text: T.deleteNo, callback_data: 'del:no' }
          ]]
        }
      });
    }
  }

  switch (user.reg_step) {
    case 'name':
      if (text.length < 2 || text.length > 60 || text.startsWith('/')) return ctx.tg.send(id, T.errName);
      return advance(ctx, user, { name: text });
    case 'company':
      if (text.length < 2 || text.length > 80 || text.startsWith('/')) return ctx.tg.send(id, T.errCompany);
      return advance(ctx, user, { company: text });
    case 'profile': {
      // Havola platformaga tegishli bo'lishi kerak; "@user" ham to'liq havolaga aylanadi
      const url = text.startsWith('/') ? null : normalizeProfile(user.platform, text);
      if (!url) return ctx.tg.send(id, T.errProfile(user.platform));
      return advance(ctx, user, { profile: url });
    }
    case 'stats': {
      // Statistika skrinshoti: rasm (Telegram file_id saqlanadi)
      const photo = Array.isArray(msg.photo) ? msg.photo[msg.photo.length - 1] : null;
      if (!photo?.file_id) return ctx.tg.send(id, T.errStats, { reply_markup: statsKeyboard(T) });
      return advance(ctx, user, { stats_file_id: photo.file_id, stats_key: newImageKey() });
    }
    case 'phone':
      return onPhone(ctx, user, msg, text);
    default:
      if (BUTTON_STEPS.has(user.reg_step)) return ctx.tg.send(id, T.useButtons);
      if (!isRegistered(user)) return start(ctx, user);
      return sendHome(ctx, user);
  }
}

async function onPhone(ctx, user, msg, text) {
  const T = tr(user.lang);
  let phone;
  if (msg.contact) {
    if (msg.contact.user_id !== msg.from.id) return ctx.tg.send(user.tg_id, T.errContactNotOwn, { reply_markup: phoneKeyboard(T) });
    phone = normalizePhone(msg.contact.phone_number);
  } else {
    phone = normalizePhone(text, { strict: true });
  }
  if (!phone) return ctx.tg.send(user.tg_id, T.errPhone, { reply_markup: phoneKeyboard(T) });

  const updated = await save(ctx, user, { phone });
  await ctx.tg.send(user.tg_id, T.phoneSaved, { reply_markup: { remove_keyboard: true } });
  return proceed(ctx, updated);
}

/* ---------- Tugmalar ---------- */

async function onCallback(cq, ctx) {
  // Tugma bosilganini Telegramga bildirish. Bu bezak: xato bo'lsa ham javob saqlanaveradi.
  const ack = (text, alert = false) =>
    ctx.tg.answer(cq.id, text, alert).catch((e) => console.warn('answerCallbackQuery failed:', e.message));

  if (!cq.from || !cq.message) return ack();

  const user = await touchUser(ctx.db, cq.from, guessLang(cq.from.language_code));
  const T = tr(user.lang);
  const [kind, value, extra] = String(cq.data || '').split(':');
  const chatId = cq.message.chat.id;
  const messageId = cq.message.message_id;
  const stale = () => ack(T.staleButton);

  // Savol xabaridagi tugmalarni olib, tanlangan javobni yozib qo'yadi
  const markChosen = async (label) => {
    try {
      await ctx.tg.edit(chatId, messageId, `${esc(cq.message.text || '')}\n\n<b>→ ${esc(label)}</b>`);
    } catch {
      /* xabar juda eski bo'lsa tahrirlab bo'lmaydi */
    }
  };

  switch (kind) {
    case 'lang': {
      if (user.reg_step !== 'lang' || (value !== 'uz' && value !== 'ru')) return stale();
      await ack();
      await markChosen(value === 'ru' ? 'Русский' : 'O‘zbekcha');
      if (extra === 'business' || extra === 'blogger') return beginAs(ctx, user, extra, value);
      await updateUser(ctx.db, user.tg_id, { lang: value, reg_step: 'role' });
      return ask(ctx, { ...user, lang: value, reg_step: 'role' }, 'role');
    }
    case 'setlang': {
      if (value !== 'uz' && value !== 'ru') return stale();
      await updateUser(ctx.db, user.tg_id, { lang: value });
      const updated = { ...user, lang: value };
      const T2 = tr(value);
      await ack(T2.langSaved);
      try {
        await ctx.tg.edit(chatId, messageId, T2.langSaved);
      } catch {
        /* e'tiborsiz */
      }
      if (isRegistered(updated)) return sendHome(ctx, updated);
      if (updated.reg_step && updated.reg_step !== 'done') return ask(ctx, updated, updated.reg_step);
      return undefined;
    }
    case 'reg': {
      if (value !== 'restart') return stale();
      await ack();
      // Tasdiqlangan biznes (eski "Ma'lumotlarni yangilash" tugmasi ham) — o'chirib, qayta ro'yxatdan o'tish
      if (user.role === 'business' && isRegistered(user) && user.moderation === 'approved') {
        return askDeleteBusiness(ctx, user);
      }
      await updateUser(ctx.db, user.tg_id, { reg_step: 'role' });
      return ask(ctx, { ...user, reg_step: 'role' }, 'role');
    }
    case 'role': {
      if (user.reg_step !== 'role' || (value !== 'business' && value !== 'blogger')) return stale();
      await ack();
      await markChosen(value === 'business' ? T.roleBusiness : T.roleBlogger);
      // Biznesdan blogerga o'tganda eski e'lonlar yopiladi
      if (user.role === 'business' && value === 'blogger') await closeBusinessCampaigns(ctx.db, user.tg_id);
      await updateUser(ctx.db, user.tg_id, { role: value, reg_step: 'name' });
      return ask(ctx, { ...user, role: value, reg_step: 'name' }, 'name');
    }
    // Biznes toifasi (cat:) yoki bloger yo'nalishi (niche:). Eski "cat:" tugmalari yo'nalish uchun ham ishlaydi.
    case 'cat':
    case 'niche': {
      const step = user.reg_step;
      const valid = step === 'category' ? kind === 'cat' && isCategory(value) : step === 'niche' && isNiche(value);
      if (!valid) return stale();
      await ack();
      await markChosen(step === 'niche' ? nicheLabel(value, user.lang) : catLabel(value, user.lang));
      return advance(ctx, user, { [step]: value });
    }
    case 'rgn': {
      if (user.reg_step !== 'region' || !isRegion(value)) return stale();
      await ack();
      await markChosen(regionLabel(value, user.lang));
      return advance(ctx, user, { region: value });
    }
    // Instagram: reels, postlar va qamrov (istoriya — "rch:")
    case 'rls': {
      if (user.reg_step !== 'reels' || !findReelsReach(value)) return stale();
      await ack();
      await markChosen(reelsLabel(value, user.lang));
      return advance(ctx, user, { reels_views: value });
    }
    case 'pst': {
      if (user.reg_step !== 'posts' || !findReach(value)) return stale();
      await ack();
      await markChosen(reachLabel(value, user.lang));
      return advance(ctx, user, { posts_views: value });
    }
    case 'acc': {
      if (user.reg_step !== 'accounts' || !findAccountsReached(value)) return stale();
      await ack();
      await markChosen(accountsLabel(value, user.lang));
      return advance(ctx, user, { accounts_reached: value });
    }
    case 'biz': {
      if (user.role !== 'business' || !isRegistered(user)) return stale();
      if (value === 'delete') {
        await ack();
        return askDeleteBusiness(ctx, user);
      }
      if (value === 'no') {
        await ack();
        try {
          await ctx.tg.edit(chatId, messageId, T.deleteCancelled);
        } catch {
          /* e'tiborsiz */
        }
        return undefined;
      }
      if (value !== 'yes') return stale();
      await ack();
      // Profil, e'lonlar va ularga kelgan so'rovlar o'chadi; til saqlanib, rol savolidan boshlanadi
      await deleteUserData(ctx.db, user.tg_id);
      try {
        await ctx.tg.edit(chatId, messageId, T.bizDeleted);
      } catch {
        /* e'tiborsiz */
      }
      const fresh = await touchUser(ctx.db, cq.from, user.lang);
      await updateUser(ctx.db, fresh.tg_id, { lang: user.lang, reg_step: 'role' });
      return ask(ctx, { ...fresh, lang: user.lang, reg_step: 'role' }, 'role');
    }
    case 'rch': {
      if (user.reg_step !== 'reach' || !findReach(value)) return stale();
      await ack();
      await markChosen(reachLabel(value, user.lang));
      return advance(ctx, user, { reach: value });
    }
    case 'stats': {
      // Skrinshotsiz davom etish (oldin yuborilgan bo'lsa, o'shanisi saqlanib qoladi)
      if (value !== 'skip' || user.reg_step !== 'stats') return stale();
      await ack();
      await markChosen(T.statsSkip);
      return advance(ctx, user, {});
    }
    case 'plat': {
      if (user.reg_step !== 'platform' || !isPlatform(value)) return stale();
      await ack();
      await markChosen(value);
      return advance(ctx, user, { platform: value, ...(value === 'Instagram' ? {} : NOT_INSTAGRAM) });
    }
    case 'fol': {
      if (user.reg_step !== 'followers' || !findFollowers(value)) return stale();
      await ack();
      await markChosen(followersLabel(value));
      return advance(ctx, user, { followers: value });
    }
    case 'ap': {
      const appId = Number(extra);
      const decision = value === 'a' ? 'accepted' : value === 'r' ? 'rejected' : null;
      if (!decision || !Number.isSafeInteger(appId)) return stale();
      // Ro'yxatdan o'tish yarim qolgan yoki profil tasdiqlanmagan bo'lsa — sababini aytamiz
      if (!isRegistered(user)) return ack(T.errFinishRegistration, true);
      if (user.moderation !== 'approved') return ack(T.errNotApproved, true);
      try {
        await decide(ctx, user, appId, decision);
      } catch (e) {
        if (!(e instanceof AppError)) throw e;
        const messages = { already_decided: T.errAlreadyDecided, campaign_full: T.errCampaignFull };
        return ack(messages[e.code] || T.errNotFound, true);
      }
      return ack(decision === 'accepted' ? T.decidedAccepted : T.decidedRejected);
    }
    case 'del': {
      if (value !== 'yes' && value !== 'no') return stale();
      await ack();
      if (value === 'yes') await deleteUserData(ctx.db, user.tg_id);
      try {
        await ctx.tg.edit(chatId, messageId, value === 'yes' ? T.deleted : T.deleteCancelled);
      } catch {
        /* e'tiborsiz */
      }
      return undefined;
    }
    case 'mod': {
      // Profilni tasdiqlash, rad etish yoki bloklash: adminlar va moderatsiya guruhi a'zolari
      const targetId = Number(extra);
      if (!['a', 'r', 'b'].includes(value) || !Number.isSafeInteger(targetId)) return stale();
      if (!(await canModerate(ctx, user.tg_id, chatId))) return ack(T.modNoRights, true);
      const TM = cq.message.chat.type === 'private' ? T : tr('uz');
      try {
        await moderate(ctx, user.tg_id, targetId, value);
      } catch (e) {
        if (!(e instanceof AppError)) throw e;
        return ack(e.code === 'already' ? TM.modAlready : TM.modGone, true);
      }
      await ack();
      const who = user.name || user.first_name || '';
      const line = value === 'a' ? TM.modApproved(who) : value === 'b' ? TM.modBlocked(who) : TM.modRejected(who);
      // Qaror tugmalari olib tashlanadi, profil havolasi qoladi
      const keep = (cq.message.reply_markup?.inline_keyboard || []).map((row) => row.filter((b) => b.url)).filter((row) => row.length);
      try {
        const original = esc(cq.message.text || cq.message.caption || '');
        await editMessage(ctx, chatId, messageId, `${original}\n\n${line}`, { reply_markup: { inline_keyboard: keep } });
      } catch {
        /* xabar juda eski bo'lsa tahrirlab bo'lmaydi */
      }
      return undefined;
    }
    case 'cm': {
      // Reklama e'lonini tasdiqlash yoki rad etish: adminlar va jamoa guruhi a'zolari
      const campaignId = Number(extra);
      if (!['a', 'r'].includes(value) || !Number.isSafeInteger(campaignId)) return stale();
      if (!(await canModerate(ctx, user.tg_id, chatId))) return ack(T.modNoRights, true);
      const TM = cq.message.chat.type === 'private' ? T : tr('uz');
      let result;
      try {
        result = await moderateCampaign(ctx, user.tg_id, campaignId, value);
      } catch (e) {
        if (!(e instanceof AppError)) throw e;
        return ack(e.code === 'already' ? TM.modAlready : TM.modGone, true);
      }
      await ack();
      const who = user.name || user.first_name || '';
      const line = value === 'a' ? TM.adApproved(who) : TM.adRejected(who);
      // Tasdiqlansa "E'lonni yopish" tugmasi qoladi, rad etilsa tugma kerak emas
      const keyboard = value === 'a' ? adKeyboard(TM, result.campaign) : { inline_keyboard: [] };
      try {
        const original = esc(cq.message.text || cq.message.caption || '');
        await editMessage(ctx, chatId, messageId, `${original}\n\n${line}`, { reply_markup: keyboard });
      } catch {
        /* e'tiborsiz */
      }
      return undefined;
    }
    case 'adm': {
      // E'lonni yopish: adminlar va moderatsiya guruhi a'zolari
      if (value !== 'close' || !(await canModerate(ctx, user.tg_id, chatId))) return stale();
      const { changed, campaign } = await closeCampaignByAdmin(ctx.db, Number(extra));
      if (!campaign) return stale();
      if (!changed) return ack(T.adminAlreadyClosed, true);
      await ack();
      try {
        // Xabar matnli yoki rasmli (e'lon rasmi) bo'lishi mumkin
        const closedMarkup = { reply_markup: { inline_keyboard: [] } };
        if (cq.message.photo) {
          await ctx.tg.editCaption(chatId, messageId, `${esc(cq.message.caption || '')}\n\n${T.adminClosed}`, closedMarkup);
        } else {
          await ctx.tg.edit(chatId, messageId, `${esc(cq.message.text || '')}\n\n${T.adminClosed}`, closedMarkup);
        }
      } catch {
        /* e'tiborsiz */
      }
      try {
        await ctx.tg.send(campaign.business_id, tr(campaign.business_lang).toBusinessClosed(campaign.title));
      } catch (e) {
        console.warn('notify business failed:', e.message);
      }
      return undefined;
    }
    default:
      return stale();
  }
}
