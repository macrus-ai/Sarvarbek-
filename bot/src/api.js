// Mini ilova uchun API. Har bir so'rov Telegram initData bilan tekshiriladi.

import { CATEGORIES, FOLLOWERS, LIMITS, PLATFORMS, isCategory, isPlatform } from './constants.js';
import {
  countActiveCampaigns, createCampaign, getCampaign, listActiveCampaigns, listBloggerApplications,
  listBusinessCampaigns, listBusinessRequests, setCampaignImage, setCampaignStatus, touchUser
} from './db.js';
import { tr } from './i18n.js';
import { forgetImage, imageOut, newImageKey, pickSizes, sniffImage } from './images.js';
import { AppError, applyToCampaign, decide, notifyAdmins } from './services.js';
import { TelegramError, validateInitData } from './telegram.js';
import { formatPhone, guessLang, isRegistered, json, normSearch, profileUrl } from './util.js';

const META = {
  categories: CATEGORIES,
  platforms: PLATFORMS,
  followers: FOLLOWERS
};

/* ---------- Javob shakllari ---------- */

function userOut(u) {
  return {
    id: u.tg_id,
    role: u.role,
    lang: u.lang,
    name: u.name || u.first_name || '',
    username: u.username || null,
    company: u.company || null,
    category: u.category || null,
    platform: u.platform || null,
    profile: u.profile || null,
    followers: u.followers || null,
    niche: u.niche || null
  };
}

function campaignOut(c, viewerId) {
  const accepted = Number(c.accepted) || 0;
  const own = c.business_id === viewerId;
  return {
    id: c.id,
    title: c.title,
    category: c.category,
    value: c.value,
    platforms: String(c.platforms || '').split(',').filter(Boolean),
    format: c.format,
    minFollowers: c.min_followers,
    days: c.days,
    slots: c.slots,
    city: c.city || '',
    description: c.description || '',
    image: imageOut(c.id, c),
    status: c.status,
    businessName: c.business_name || '',
    accepted,
    left: Math.max(0, c.slots - accepted),
    pending: own ? Number(c.pending) || 0 : undefined,
    myStatus: c.my_status || null,
    own,
    createdAt: c.created_at
  };
}

function myApplicationOut(a) {
  return {
    id: a.id,
    status: a.status,
    message: a.message || '',
    createdAt: a.created_at,
    updatedAt: a.updated_at,
    campaign: {
      id: a.campaign_id,
      title: a.title,
      value: a.value,
      format: a.format,
      days: a.days,
      city: a.city || '',
      status: a.campaign_status,
      businessName: a.company || '',
      image: imageOut(a.campaign_id, a)
    },
    contact:
      a.status === 'accepted'
        ? { name: a.contact_name || '', phone: formatPhone(a.contact_phone), username: a.contact_username || null }
        : null
  };
}

function requestOut(r) {
  return {
    id: r.id,
    status: r.status,
    message: r.message || '',
    createdAt: r.created_at,
    campaign: { id: r.campaign_id, title: r.title },
    blogger: {
      id: r.blogger_id,
      name: r.name || '',
      username: r.username || null,
      platform: r.platform,
      profile: r.profile,
      profileUrl: profileUrl(r.platform, r.profile),
      followers: r.followers,
      niche: r.niche,
      phone: r.phone ? formatPhone(r.phone) : null
    }
  };
}

/* ---------- Tekshiruvlar ---------- */

async function readBody(request) {
  try {
    const body = await request.json();
    if (body && typeof body === 'object' && !Array.isArray(body)) return body;
  } catch {
    /* pastda xato qaytariladi */
  }
  throw new AppError('invalid', 400);
}

const text = (v) => (typeof v === 'string' ? v.trim() : '');

function toInt(v) {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(/[\s ]/g, ''));
  return Number.isInteger(n) ? n : NaN;
}

const between = (n, min, max) => Number.isInteger(n) && n >= min && n <= max;

function validateCampaign(b) {
  const errors = [];
  const title = text(b.title);
  const format = text(b.format);
  const city = text(b.city);
  const description = text(b.description);
  const value = toInt(b.value);
  const minFollowers = b.minFollowers === '' || b.minFollowers == null ? 0 : toInt(b.minFollowers);
  const days = toInt(b.days);
  const slots = toInt(b.slots);
  const platforms = Array.isArray(b.platforms) ? [...new Set(b.platforms)] : [];

  if (title.length < LIMITS.titleMin || title.length > LIMITS.titleMax) errors.push('title');
  if (!isCategory(b.category)) errors.push('category');
  if (!between(value, LIMITS.valueMin, LIMITS.valueMax)) errors.push('value');
  if (!platforms.length || !platforms.every(isPlatform)) errors.push('platforms');
  if (format.length < 2 || format.length > LIMITS.formatMax) errors.push('format');
  if (!between(minFollowers, 0, LIMITS.followersMax)) errors.push('minFollowers');
  if (!between(days, 1, LIMITS.daysMax)) errors.push('days');
  if (!between(slots, 1, LIMITS.slotsMax)) errors.push('slots');
  if (city.length > LIMITS.cityMax) errors.push('city');
  if (description.length > LIMITS.descriptionMax) errors.push('description');

  if (errors.length) throw new AppError('invalid', 400, { fields: errors });
  return { title, category: b.category, value, platforms, format, minFollowers, days, slots, city, description };
}

function requireRole(user, role) {
  if (user.role !== role) throw new AppError('forbidden', 403);
}

// Rasm so'rov tanasida xom baytlar sifatida keladi (multipart emas)
async function readImage(request) {
  const declared = Number(request.headers.get('content-length'));
  const tooLarge = () => new AppError('image_too_large', 413, { limitMb: LIMITS.imageMaxBytes / 1024 / 1024 });
  if (declared > LIMITS.imageMaxBytes) throw tooLarge();
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.length > LIMITS.imageMaxBytes) throw tooLarge();
  const kind = sniffImage(bytes);
  if (!kind) throw new AppError('image_invalid', 400);
  return { bytes, type: kind.type, name: `ovoza.${kind.ext}` };
}

// Rasmni Telegramga yuklaydi: u biznesning bot bilan chatiga tasdiq sifatida boradi
async function uploadImage(ctx, user, campaign, file) {
  let message;
  try {
    message = await ctx.tg.uploadPhoto(user.tg_id, file, tr(user.lang).imageSaved(campaign.title), {
      disable_notification: true
    });
  } catch (e) {
    if (e instanceof TelegramError) {
      console.warn('image upload failed:', e.message);
      // 400 — Telegram rasmni qabul qilmadi (buzilgan fayl yoki juda cho'zinchoq rasm)
      throw new AppError(e.code === 400 ? 'image_invalid' : 'image_failed', e.code === 400 ? 400 : 502);
    }
    throw e;
  }
  const sizes = pickSizes(message?.photo);
  if (!sizes) throw new AppError('image_failed', 502);
  return { ...sizes, key: newImageKey() };
}

/* ---------- Marshrutlar ---------- */

export async function handleApi(request, ctx) {
  const auth = await validateInitData(request.headers.get('x-telegram-init-data'), ctx.env.BOT_TOKEN);
  if (!auth) return json({ error: 'unauthorized' }, 401);

  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '');
  const method = request.method.toUpperCase();

  try {
    const user = await touchUser(ctx.db, auth.user, guessLang(auth.user.language_code));
    if (method === 'GET' && path === '/api/me') {
      return json({ user: userOut(user), registered: isRegistered(user), meta: META });
    }
    if (!isRegistered(user)) throw new AppError('not_registered', 403);
    return await route(ctx, user, method, path, url, request);
  } catch (e) {
    if (e instanceof AppError) return json({ error: e.code, ...e.extra }, e.status);
    throw e;
  }
}

async function route(ctx, user, method, path, url, request) {
  const { db } = ctx;
  const id = user.tg_id;
  let m;

  // Faol reklama e'lonlari ro'yxati (filtrlar bilan)
  if (method === 'GET' && path === '/api/campaigns') {
    const category = url.searchParams.get('category') || null;
    const platform = url.searchParams.get('platform') || null;
    const q = normSearch(url.searchParams.get('q'));
    let rows = await listActiveCampaigns(db, {
      viewerId: id,
      category: isCategory(category) ? category : null,
      platform: isPlatform(platform) ? platform : null
    });
    if (q) {
      rows = rows.filter((c) =>
        normSearch(`${c.title} ${c.business_name} ${c.city} ${c.format} ${c.description}`).includes(q)
      );
    }
    return json({ campaigns: rows.map((c) => campaignOut(c, id)) });
  }

  // Yangi reklama e'loni (faqat biznes)
  if (method === 'POST' && path === '/api/campaigns') {
    requireRole(user, 'business');
    const data = validateCampaign(await readBody(request));
    if ((await countActiveCampaigns(db, id)) >= LIMITS.activeCampaigns) {
      throw new AppError('too_many_campaigns', 409, { limit: LIMITS.activeCampaigns });
    }
    const campaignId = await createCampaign(db, id, data);
    const created = await getCampaign(db, campaignId, id);
    // Adminga yangi e'lon haqida xabar va "yopish" tugmasi (moderatsiya)
    await notifyAdmins(ctx, (T) => ({
      text: T.adminNewCampaign({ ...created, business_contact: user.name }),
      extra: { reply_markup: { inline_keyboard: [[{ text: T.adminClose, callback_data: `adm:close:${created.id}` }]] } }
    }));
    return json({ campaign: campaignOut(created, id) }, 201);
  }

  if ((m = path.match(/^\/api\/campaigns\/(\d+)$/))) {
    const campaignId = Number(m[1]);

    if (method === 'GET') {
      const c = await getCampaign(db, campaignId, id);
      // Yopilgan e'lonni faqat egasi va so'rov yuborganlar ko'radi
      if (!c || (c.status !== 'active' && c.business_id !== id && !c.my_status)) throw new AppError('not_found', 404);
      return json({ campaign: campaignOut(c, id) });
    }

    // E'lonni yopish yoki qayta ochish
    if (method === 'PATCH') {
      requireRole(user, 'business');
      const { status } = await readBody(request);
      if (status !== 'active' && status !== 'closed') throw new AppError('invalid', 400);
      const current = await getCampaign(db, campaignId, id);
      if (!current || current.business_id !== id) throw new AppError('not_found', 404);
      if (status === 'active' && current.status !== 'active' && (await countActiveCampaigns(db, id)) >= LIMITS.activeCampaigns) {
        throw new AppError('too_many_campaigns', 409, { limit: LIMITS.activeCampaigns });
      }
      await setCampaignStatus(db, campaignId, id, status);
      return json({ campaign: campaignOut(await getCampaign(db, campaignId, id), id) });
    }
  }

  // E'lon rasmi: PUT — qo'yish yoki almashtirish, DELETE — olib tashlash (faqat egasi)
  if ((m = path.match(/^\/api\/campaigns\/(\d+)\/image$/)) && (method === 'PUT' || method === 'DELETE')) {
    requireRole(user, 'business');
    const campaignId = Number(m[1]);
    const current = await getCampaign(db, campaignId, id);
    if (!current || current.business_id !== id) throw new AppError('not_found', 404);

    if (method === 'DELETE') {
      await setCampaignImage(db, campaignId, id, null);
    } else {
      const image = await uploadImage(ctx, user, current, await readImage(request));
      await setCampaignImage(db, campaignId, id, image);
      // Adminga rasm ham ko'rinsin: e'lon joylangandan keyin almashtirilgan rasmlar ham moderatsiyadan o'tadi
      await notifyAdmins(ctx, (T) => ({
        photo: image.fileId,
        text: T.adminNewImage({ ...current, business_contact: user.name }),
        extra: { reply_markup: { inline_keyboard: [[{ text: T.adminClose, callback_data: `adm:close:${campaignId}` }]] } }
      }));
    }
    await forgetImage(ctx.origin, campaignId, current.image_key);
    return json({ campaign: campaignOut(await getCampaign(db, campaignId, id), id) });
  }

  // Bloger reklama e'loniga so'rov yuboradi
  if (method === 'POST' && (m = path.match(/^\/api\/campaigns\/(\d+)\/apply$/))) {
    requireRole(user, 'blogger');
    const body = await readBody(request);
    const message = text(body.message);
    if (message.length > LIMITS.messageMax) throw new AppError('invalid', 400, { fields: ['message'] });
    const result = await applyToCampaign(ctx, user, Number(m[1]), message);
    return json({ application: result }, 201);
  }

  if (method === 'GET' && path === '/api/my/campaigns') {
    requireRole(user, 'business');
    const rows = await listBusinessCampaigns(db, id);
    return json({ campaigns: rows.map((c) => campaignOut(c, id)) });
  }

  if (method === 'GET' && path === '/api/my/applications') {
    requireRole(user, 'blogger');
    const rows = await listBloggerApplications(db, id);
    return json({ applications: rows.map(myApplicationOut) });
  }

  if (method === 'GET' && path === '/api/requests') {
    requireRole(user, 'business');
    const rows = await listBusinessRequests(db, id);
    return json({ requests: rows.map(requestOut) });
  }

  // Biznes so'rovni qabul qiladi yoki rad etadi
  if (method === 'POST' && (m = path.match(/^\/api\/applications\/(\d+)\/decision$/))) {
    requireRole(user, 'business');
    const { decision } = await readBody(request);
    const map = { accept: 'accepted', accepted: 'accepted', reject: 'rejected', rejected: 'rejected' };
    if (!map[decision]) throw new AppError('invalid', 400);
    const result = await decide(ctx, user, Number(m[1]), map[decision]);
    return json({ application: result });
  }

  throw new AppError('not_found', 404);
}
