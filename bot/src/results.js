// Xavfsiz barter: qabul qilingan so'rov bo'yicha natija va saytdagi keyslar
//
//   1. Biznes so'rovni qabul qiladi, mahsulot yoki xizmatni blogerga beradi.
//   2. Bloger reklamani joylab, mini ilovada post havolasini (va xohlasa ko'rishlar sonini) yuboradi.
//   3. Biznesga bot orqali xabar boradi: "✅ Bajarildi" yoki "⚠️ Muammo bor".
//      Bajarildi — natija tasdiqlanadi va saytdagi "Real keyslar" bo'limida chiqadi (biznes fikri bilan).
//      Muammo bor — blogerga va jamoaga xabar boradi, bloger tuzatib qayta yuboradi.
//   4. Jamoa keysni saytdan yashira oladi (guruhdagi tugma).
//
// Ochiq API (kirishsiz, sayt uchun): GET /public/cases va GET /public/cases/<public_id>

import { DEFAULT_SITE_URL, LIMITS, PLATFORM_HOSTS, sectorOfCategory } from './constants.js';
import {
  decideResult, ensurePublicId, getApplicationFull, getCaseBusiness, listCaseBusinesses, listCaseCampaigns,
  listCaseResults, saveResult, saveReview, setCaseHidden
} from './db.js';
import { catLabel, regionLabel, tr } from './i18n.js';
import { imageOut } from './images.js';
import { AppError, appUrl, deliver, notifyAdmins } from './services.js';
import { isApproved, json, profileUrl } from './util.js';

export const siteUrl = (env) => String(env?.SITE_URL || DEFAULT_SITE_URL).replace(/\/+$/, '');
export const caseUrl = (env, publicId) => `${siteUrl(env)}/keyslar.html?b=${encodeURIComponent(publicId)}`;

/* ---------- Tekshiruvlar ---------- */

const text = (v) => (typeof v === 'string' ? v.trim() : '');

// Post havolasi: http(s) manzil. Platforma sayti bo'lsa yaxshi, lekin boshqa sayt ham qabul qilinadi
// (masalan, Telegram'dagi post havolasi yoki YouTube Shorts).
export function normalizePostUrl(input) {
  let s = text(input);
  if (!s || s.length > LIMITS.postUrlMax) return null;
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  let url;
  try {
    url = new URL(s);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(url.hostname) || url.username || url.password) return null;
  return url.toString();
}

export const postPlatform = (postUrl) => {
  try {
    const host = new URL(postUrl).hostname.toLowerCase().replace(/^www\.|^m\./, '');
    return Object.entries(PLATFORM_HOSTS).find(([, hosts]) => hosts.some((h) => host === h || host.endsWith(`.${h}`)))?.[0] || null;
  } catch {
    return null;
  }
};

function optionalInt(v, max) {
  if (v === '' || v == null) return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[\s  ]/g, ''));
  return Number.isInteger(n) && n >= 0 && n <= max ? n : NaN;
}

export function validateResult(b) {
  const errors = [];
  const postUrl = normalizePostUrl(b.postUrl);
  const views = optionalInt(b.views, LIMITS.viewsMax);
  const note = text(b.note);
  if (!postUrl) errors.push('postUrl');
  if (Number.isNaN(views)) errors.push('views');
  if (note.length > LIMITS.resultNoteMax) errors.push('note');
  if (errors.length) throw new AppError('invalid', 400, { fields: errors });
  return { postUrl, views, note };
}

export function validateReview(b) {
  const review = text(b.review);
  const rating = optionalInt(b.rating, 5);
  const errors = [];
  if (review.length > LIMITS.reviewMax) errors.push('review');
  if (Number.isNaN(rating) || rating === 0) errors.push('rating');
  if (errors.length) throw new AppError('invalid', 400, { fields: errors });
  return { review: review || null, rating };
}

// Saytdagi keys sahifasi manzili uchun tasodifiy id (Telegram ID ko'rinmasin)
export function newPublicId() {
  const abc = 'abcdefghijkmnpqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(bytes, (b) => abc[b % abc.length]).join('');
}

/* ---------- Bot xabarlari ---------- */

export const resultKeyboard = (T, a) => {
  const rows = [[
    { text: T.resultConfirm, callback_data: `rs:c:${a.id}` },
    { text: T.resultDispute, callback_data: `rs:d:${a.id}` }
  ]];
  if (a.post_url) rows.push([{ text: T.resultOpenPost, url: a.post_url }]);
  return { inline_keyboard: rows };
};

export const caseKeyboard = (T, a, hidden) => ({
  inline_keyboard: [[
    hidden
      ? { text: T.caseShow, callback_data: `cs:s:${a.id}` }
      : { text: T.caseHide, callback_data: `cs:h:${a.id}` }
  ]]
});

/* ---------- Bloger natijani yuboradi ---------- */

export async function submitResult(ctx, blogger, appId, body) {
  if (!isApproved(blogger) || blogger.role !== 'blogger') throw new AppError('forbidden', 403);
  const data = validateResult(body);
  const before = await getApplicationFull(ctx.db, appId);
  if (!before || before.blogger_id !== blogger.tg_id) throw new AppError('not_found', 404);
  if (before.status !== 'accepted') throw new AppError('not_accepted', 409);
  if (before.result_status === 'confirmed') throw new AppError('result_confirmed', 409);
  if (!(await saveResult(ctx.db, appId, blogger.tg_id, data))) throw new AppError('result_confirmed', 409);

  const a = await getApplicationFull(ctx.db, appId);
  const T = tr(a.business_lang);
  try {
    await deliver(ctx, a.business_id, {
      text: T.resultSubmitted(a, before.result_status === 'disputed' || before.result_status === 'submitted'),
      extra: { reply_markup: resultKeyboard(T, a) }
    });
  } catch (e) {
    // Biznes botni bloklagan bo'lsa ham natija ilovada ko'rinadi
    console.warn('notify business about result failed:', e.message);
  }
  return resultOut(a);
}

/* ---------- Biznes natija bo'yicha qaror qiladi ---------- */

// decision: 'confirmed' | 'disputed'. extra: { review, rating } (tasdiqlashda) yoki { note } (muammoda)
export async function decideResultBy(ctx, business, appId, decision, extra = {}) {
  if (decision !== 'confirmed' && decision !== 'disputed') throw new AppError('invalid', 400);
  if (!isApproved(business) || business.role !== 'business') throw new AppError('forbidden', 403);
  const before = await getApplicationFull(ctx.db, appId);
  if (!before || before.business_id !== business.tg_id) throw new AppError('not_found', 404);

  const changed = await decideResult(ctx.db, appId, business.tg_id, decision, extra);
  if (!changed) {
    throw new AppError(before.result_status === 'confirmed' || before.result_status === 'disputed' ? 'result_decided' : 'result_missing', 409);
  }
  const a = await getApplicationFull(ctx.db, appId);

  if (decision === 'confirmed') {
    const publicId = await ensurePublicId(ctx.db, a.business_id, newPublicId);
    const link = publicId ? caseUrl(ctx.env, publicId) : null;
    const TG = tr(a.blogger_lang);
    try {
      await ctx.tg.send(a.blogger_id, TG.toBloggerResultConfirmed(a, link));
    } catch (e) {
      console.warn('notify blogger about confirmation failed:', e.message);
    }
    await notifyAdmins(
      ctx,
      (T) => ({
        text: T.caseNew(a, link),
        extra: { reply_markup: caseKeyboard(T, a, false) }
      }),
      'ads'
    );
  } else {
    const TG = tr(a.blogger_lang);
    try {
      await ctx.tg.send(a.blogger_id, TG.toBloggerResultDisputed(a), {
        reply_markup: { inline_keyboard: [[{ text: TG.openApp, web_app: { url: appUrl(ctx, 'mine') } }]] }
      });
    } catch (e) {
      console.warn('notify blogger about dispute failed:', e.message);
    }
    // Jamoa ikki tomon bilan bog'lanib, kelishmovchilikni hal qiladi
    await notifyAdmins(ctx, (T) => ({ text: T.caseDisputed(a), extra: {} }), 'ads');
  }
  return resultOut(a);
}

// Tasdiqlangan natijaga fikr va baho (mini ilovadan, keyinroq ham)
export async function reviewResult(ctx, business, appId, body) {
  if (!isApproved(business) || business.role !== 'business') throw new AppError('forbidden', 403);
  const data = validateReview(body);
  if (!(await saveReview(ctx.db, appId, business.tg_id, data))) throw new AppError('not_found', 404);
  return resultOut(await getApplicationFull(ctx.db, appId));
}

// Jamoa keysni saytdan yashiradi yoki qaytaradi
export async function hideCase(ctx, appId, hidden) {
  const changed = await setCaseHidden(ctx.db, appId, hidden);
  const a = await getApplicationFull(ctx.db, appId);
  if (!a || a.result_status !== 'confirmed') throw new AppError('gone', 404);
  if (!changed) throw new AppError('already', 409);
  return a;
}

export function resultOut(a) {
  if (!a?.result_status) return null;
  return {
    status: a.result_status,
    postUrl: a.post_url || null,
    views: a.result_views ?? null,
    note: a.result_note || '',
    disputeNote: a.dispute_note || '',
    review: a.review || '',
    rating: a.rating ?? null
  };
}

/* ---------- Ochiq API: saytdagi "Real keyslar" ---------- */

const PUBLIC_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
  // Brauzer 1 daqiqa saqlaydi: biznes tasdiqlagan keys saytda tez paydo bo'lsin
  'cache-control': 'public, max-age=60'
};

const label = (fn, id) => ({ uz: fn(id, 'uz') || '', ru: fn(id, 'ru') || '' });

function abs(origin, img) {
  return img ? { url: `${origin}${img.url}`, thumb: `${origin}${img.thumb}` } : null;
}

function businessOut(b) {
  const sector = sectorOfCategory(b.category);
  return {
    id: b.public_id,
    name: b.company || '',
    category: label(catLabel, b.category),
    sector: sector ? { id: sector.id, uz: sector.uz, ru: sector.ru } : null,
    region: b.region ? label(regionLabel, b.region) : null
  };
}

export async function handlePublic(request, ctx) {
  const headers = PUBLIC_HEADERS;
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'GET') return json({ error: 'method' }, 405);
  const path = new URL(request.url).pathname.replace(/\/+$/, '');
  const withHeaders = (res) => {
    Object.entries(headers).forEach(([k, v]) => res.headers.set(k, v));
    return res;
  };

  if (path === '/public/cases') {
    const rows = await listCaseBusinesses(ctx.db);
    const businesses = await Promise.all(
      rows.map(async (b) => {
        let cover = null;
        if (b.cover_id) {
          const c = await ctx.db.prepare('SELECT id, image_file_id, image_key FROM campaigns WHERE id = ?1').bind(b.cover_id).first();
          cover = c ? abs(ctx.origin, imageOut(c.id, c)) : null;
        }
        return {
          ...businessOut(b),
          cases: Number(b.cases) || 0,
          campaigns: Number(b.campaigns) || 0,
          bloggers: Number(b.bloggers) || 0,
          views: Number(b.views) || 0,
          lastAt: b.last_at,
          cover
        };
      })
    );
    const totals = businesses.reduce(
      (t, b) => ({ businesses: t.businesses + 1, cases: t.cases + b.cases, views: t.views + b.views }),
      { businesses: 0, cases: 0, views: 0 }
    );
    return withHeaders(json({ businesses, totals }));
  }

  const m = path.match(/^\/public\/cases\/([a-z0-9]{6,20})$/);
  if (m) {
    const b = await getCaseBusiness(ctx.db, m[1]);
    if (!b) return withHeaders(json({ error: 'not_found' }, 404));
    const [campaigns, results] = await Promise.all([listCaseCampaigns(ctx.db, b.tg_id), listCaseResults(ctx.db, b.tg_id)]);
    if (!results.length) return withHeaders(json({ error: 'not_found' }, 404));
    const byCampaign = new Map();
    for (const r of results) {
      if (!byCampaign.has(r.campaign_id)) byCampaign.set(r.campaign_id, []);
      byCampaign.get(r.campaign_id).push({
        blogger: {
          name: r.blogger_name || '',
          platform: r.platform || null,
          profileUrl: profileUrl(r.platform, r.profile),
          followers: r.followers || null
        },
        postUrl: r.post_url,
        postPlatform: postPlatform(r.post_url),
        views: r.result_views ?? null,
        note: r.result_note || '',
        review: r.review || '',
        rating: r.rating ?? null,
        confirmedAt: r.confirmed_at
      });
    }
    const out = campaigns.map((c) => {
      const list = byCampaign.get(c.id) || [];
      return {
        id: c.id,
        title: c.title,
        category: label(catLabel, c.category),
        value: c.value,
        platforms: String(c.platforms || '').split(',').filter(Boolean),
        format: c.format,
        region: c.region && c.region !== 'all' ? label(regionLabel, c.region) : null,
        city: c.city || '',
        active: c.status === 'active',
        image: abs(ctx.origin, imageOut(c.id, c)),
        createdAt: c.created_at,
        accepted: Number(c.accepted) || 0,
        views: list.reduce((s, r) => s + (r.views || 0), 0),
        results: list
      };
    });
    // Natijasi bor e'lonlar birinchi
    out.sort((x, y) => (y.results.length > 0) - (x.results.length > 0) || y.createdAt - x.createdAt);
    const ratings = results.map((r) => r.rating).filter((n) => n >= 1);
    return withHeaders(
      json({
        business: {
          ...businessOut(b),
          cases: results.length,
          campaigns: out.filter((c) => c.results.length).length,
          bloggers: new Set(results.map((r) => `${r.platform}:${r.profile}`)).size,
          views: results.reduce((s, r) => s + (r.result_views || 0), 0),
          rating: ratings.length ? Math.round((ratings.reduce((s, n) => s + n, 0) / ratings.length) * 10) / 10 : null
        },
        campaigns: out
      })
    );
  }
  return withHeaders(json({ error: 'not_found' }, 404));
}
