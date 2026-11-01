// Telegram xabarlari: ro'yxatdan o'tish, buyruqlar va tugmalar

import { CATEGORIES, FOLLOWERS, PLATFORMS, findFollowers, isCategory, isPlatform } from './constants.js';
import { closeBusinessCampaigns, closeCampaignByAdmin, deleteUserData, getStats, touchUser, updateUser } from './db.js';
import { catLabel, followersLabel, tr } from './i18n.js';
import { AppError, appUrl, decide, notifyAdmins } from './services.js';
import { esc, guessLang, isAdmin, isRegistered, normalizePhone, now, privacyUrl } from './util.js';

// Ro'yxatdan o'tish qadamlari
const FLOW = {
  business: ['name', 'company', 'category', 'phone'],
  blogger: ['name', 'platform', 'profile', 'followers', 'niche', 'phone']
};
const BUTTON_STEPS = new Set(['lang', 'role', 'category', 'platform', 'followers', 'niche']);

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

const phoneKeyboard = (T) => ({
  keyboard: [[{ text: T.phoneButton, request_contact: true }]],
  resize_keyboard: true,
  one_time_keyboard: true
});

const homeKeyboard = (T, ctx) => ({
  inline_keyboard: [
    [{ text: T.openApp, web_app: { url: appUrl(ctx) } }],
    [{ text: T.updateProfile, callback_data: 'reg:restart' }]
  ]
});

/* ---------- Savollar ---------- */

function ask(ctx, user, step) {
  const T = tr(user.lang);
  const id = user.tg_id;
  const lang = user.lang === 'ru' ? 'ru' : 'uz';
  const categoryButtons = () => ({
    inline_keyboard: rows(CATEGORIES.map((c) => ({ text: c[lang], callback_data: `cat:${c.id}` })), 2)
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
      return ctx.tg.send(id, T.askNiche, { reply_markup: categoryButtons() });
    case 'platform':
      return ctx.tg.send(id, T.askPlatform, {
        reply_markup: { inline_keyboard: rows(PLATFORMS.map((p) => ({ text: p, callback_data: `plat:${p}` })), 2) }
      });
    case 'profile':
      return ctx.tg.send(id, T.askProfile);
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
  const next = flow[flow.indexOf(user.reg_step) + 1] || 'done';
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

async function finish(ctx, user) {
  const T = tr(user.lang);
  const text = user.role === 'business' ? T.doneBusiness(T.summaryBusiness(user)) : T.doneBlogger(T.summaryBlogger(user));
  try {
    await ctx.tg.send(user.tg_id, text, { reply_markup: homeKeyboard(T, ctx) });
  } finally {
    if (user.firstRegistration) await notifyAdmins(ctx, (TA) => ({ text: TA.adminNewUser(user) }));
  }
}

function sendHome(ctx, user) {
  const T = tr(user.lang);
  return ctx.tg.send(user.tg_id, T.home(user.name || user.first_name || ''), { reply_markup: homeKeyboard(T, ctx) });
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
  if (msg.chat?.type !== 'private' || !msg.from || msg.from.is_bot) return undefined;

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
    case 'profile':
      if (text.length < 3 || text.length > 200 || text.startsWith('/') || /\s/.test(text)) return ctx.tg.send(id, T.errProfile);
      return advance(ctx, user, { profile: text });
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
      await updateUser(ctx.db, user.tg_id, { reg_step: 'role' });
      return ask(ctx, { ...user, reg_step: 'role' }, 'role');
    }
    case 'role': {
      if (user.reg_step !== 'role' || (value !== 'business' && value !== 'blogger')) return stale();
      await ack();
      await markChosen(value === 'business' ? T.roleBusiness : T.roleBlogger);
      // Biznesdan blogerga o'tganda eski kampaniyalar yopiladi
      if (user.role === 'business' && value === 'blogger') await closeBusinessCampaigns(ctx.db, user.tg_id);
      await updateUser(ctx.db, user.tg_id, { role: value, reg_step: 'name' });
      return ask(ctx, { ...user, role: value, reg_step: 'name' }, 'name');
    }
    case 'cat': {
      if ((user.reg_step !== 'category' && user.reg_step !== 'niche') || !isCategory(value)) return stale();
      await ack();
      await markChosen(catLabel(value, user.lang));
      return advance(ctx, user, { [user.reg_step]: value });
    }
    case 'plat': {
      if (user.reg_step !== 'platform' || !isPlatform(value)) return stale();
      await ack();
      await markChosen(value);
      return advance(ctx, user, { platform: value });
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
    case 'adm': {
      // Moderatsiya: faqat ADMIN_IDS dagilar uchun
      if (value !== 'close' || !isAdmin(user.tg_id, ctx.env)) return stale();
      const { changed, campaign } = await closeCampaignByAdmin(ctx.db, Number(extra));
      if (!campaign) return stale();
      if (!changed) return ack(T.adminAlreadyClosed, true);
      await ack();
      try {
        await ctx.tg.edit(chatId, messageId, `${esc(cq.message.text || '')}\n\n${T.adminClosed}`, {
          reply_markup: { inline_keyboard: [] }
        });
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
