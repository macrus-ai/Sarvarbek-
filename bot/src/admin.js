// Admin panel (sayt ko'rinishida, /admin/):
//   - botda /admin — admin bir martalik kirish havolasini oladi (10 daqiqa);
//   - GET /admin/login?t=... — havola ochilganda brauzerga sessiya cookie'si beriladi (30 kun);
//   - /api/admin/* — panel API'si (faqat ADMIN_IDS dagilar uchun).

import { closeCampaignByAdmin, deleteUserData, getSetting, getStats, getUser, setSetting } from './db.js';
import { catLabel, followersLabel, nicheLabel, reachLabel, reelsLabel, regionLabel, tr } from './i18n.js';
import { imageOut, statsImageUrl } from './images.js';
import { AppError, MOD_CHAT_KEYS, moderate, moderateCampaign } from './services.js';
import { sha256Hex } from './telegram.js';
import { formatPhone, isAdmin, json, now, profileUrl } from './util.js';

const LOGIN_TTL = 10 * 60;
const SESSION_TTL = 30 * 24 * 3600;
const COOKIE = 'ovoza_admin';
const PAGE_SIZE = 50;
const TOKEN_RE = /^[0-9a-f]{64}$/;

const randomToken = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, '0')).join('');

/* ---------- Kirish ---------- */

// Botdagi /admin buyrug'i uchun: bir martalik kirish havolasi
export async function createLoginLink(ctx, adminId) {
  const token = randomToken();
  const ts = now();
  await ctx.db.prepare('DELETE FROM admin_tokens WHERE expires_at < ?1').bind(ts).run();
  await ctx.db
    .prepare('INSERT INTO admin_tokens (token_hash, admin_id, kind, expires_at, created_at) VALUES (?1, ?2, ?3, ?4, ?5)')
    .bind(await sha256Hex(token), adminId, 'login', ts + LOGIN_TTL, ts)
    .run();
  return `${ctx.origin}/admin/login?t=${token}`;
}

const page = (title, body, extraHead = '') => `<!doctype html>
<html lang="uz"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>${title}</title>${extraHead}
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:system-ui,sans-serif;background:#EEF1F8;color:#0C1430;padding:16px}
main{max-width:420px;background:#fff;border-radius:16px;padding:28px;text-align:center;box-shadow:0 10px 30px rgba(8,16,60,.12)}
h1{font-size:20px;margin:0 0 10px}p{margin:0;color:#687190;line-height:1.5}a{color:#1E3CCB}</style></head>
<body><main>${body}</main></body></html>`;

const htmlHeaders = (extra = {}) => ({
  'content-type': 'text/html; charset=utf-8',
  'cache-control': 'no-store',
  'referrer-policy': 'no-referrer',
  'x-frame-options': 'DENY',
  ...extra
});

const cookie = (value, maxAge) => `${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;

function loginFailed() {
  return new Response(
    page('Kirish havolasi eskirgan', '<h1>Havola eskirgan</h1><p>Bu havola ishlatilgan yoki muddati tugagan. Botga <b>/admin</b> yuborib, yangi havola oling.</p>'),
    { status: 400, headers: htmlHeaders() }
  );
}

async function login(ctx, url) {
  const token = url.searchParams.get('t') || '';
  if (!TOKEN_RE.test(token)) return loginFailed();
  const hash = await sha256Hex(token);
  const row = await ctx.db.prepare("SELECT admin_id, expires_at FROM admin_tokens WHERE token_hash = ?1 AND kind = 'login'").bind(hash).first();
  // Havola bir martalik: topilsa darhol o'chiriladi
  if (row) await ctx.db.prepare('DELETE FROM admin_tokens WHERE token_hash = ?1').bind(hash).run();
  if (!row || row.expires_at < now() || !isAdmin(row.admin_id, ctx.env)) return loginFailed();

  const session = randomToken();
  const ts = now();
  await ctx.db
    .prepare('INSERT INTO admin_tokens (token_hash, admin_id, kind, expires_at, created_at) VALUES (?1, ?2, ?3, ?4, ?5)')
    .bind(await sha256Hex(session), row.admin_id, 'session', ts + SESSION_TTL, ts)
    .run();
  // Panelga o'z sahifamizdan o'tamiz (SameSite=Strict cookie keyingi so'rovlarda yuboriladi)
  return new Response(
    page(
      'Ovoza admin',
      '<h1>Kirildi</h1><p>Admin panel ochilmoqda… Ochilmasa, <a href="/admin/">shu yerni bosing</a>.</p>',
      '<meta http-equiv="refresh" content="0;url=/admin/">'
    ),
    { headers: htmlHeaders({ 'set-cookie': cookie(session, SESSION_TTL) }) }
  );
}

function readCookie(request, name) {
  for (const part of String(request.headers.get('cookie') || '').split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=');
  }
  return null;
}

async function sessionAdmin(request, ctx) {
  const token = readCookie(request, COOKIE);
  if (!token || !TOKEN_RE.test(token)) return null;
  const hash = await sha256Hex(token);
  const row = await ctx.db
    .prepare("SELECT admin_id, expires_at FROM admin_tokens WHERE token_hash = ?1 AND kind = 'session'")
    .bind(hash)
    .first();
  // ADMIN_IDS dan olib tashlangan admin darhol kira olmaydi
  if (!row || row.expires_at < now() || !isAdmin(row.admin_id, ctx.env)) return null;
  return { id: row.admin_id, hash };
}

let botUsername = null;
async function getBotUsername(ctx) {
  if (botUsername) return botUsername;
  try {
    botUsername = (await ctx.tg.call('getMe')).username || null;
  } catch {
    /* kirish sahifasi botsiz ham ishlaydi */
  }
  return botUsername;
}

/* ---------- Javob shakllari ---------- */

const UZ = 'uz';

function userOut(u) {
  const business = u.role === 'business';
  return {
    id: u.tg_id,
    name: u.name || u.first_name || '',
    username: u.username || null,
    phone: u.phone ? formatPhone(u.phone) : null,
    lang: u.lang,
    role: u.role || null,
    registered: u.reg_step === 'done',
    step: u.reg_step || null,
    moderation: u.moderation || null,
    registeredAt: u.registered_at || null,
    createdAt: u.created_at,
    company: business ? u.company || '' : null,
    category: business ? catLabel(u.category, UZ) : null,
    platform: business ? null : u.platform || null,
    profile: business ? null : u.profile || null,
    profileUrl: business ? null : profileUrl(u.platform, u.profile),
    followers: business ? null : followersLabel(u.followers),
    reach: u.reach ? reachLabel(u.reach, UZ) : null,
    reels: u.reels_reach ? reelsLabel(u.reels_reach, UZ) : null,
    niche: business ? null : nicheLabel(u.niche, UZ) || null,
    region: u.region ? regionLabel(u.region, UZ) : null,
    statsImage: u.stats_file_id ? statsImageUrl(u.tg_id, u.stats_key) : null,
    campaigns: u.campaigns_count ?? null,
    applications: u.applications_count ?? null
  };
}

function campaignOut(c) {
  return {
    id: c.id,
    title: c.title,
    business: { id: c.business_id, company: c.business_name || '', contact: c.business_contact || '' },
    category: catLabel(c.category, UZ),
    region: c.region ? regionLabel(c.region, UZ) : null,
    city: c.city || '',
    value: c.value,
    platforms: String(c.platforms || '').split(',').filter(Boolean),
    format: c.format,
    minFollowers: c.min_followers,
    days: c.days,
    slots: c.slots,
    description: c.description || '',
    status: c.status,
    moderation: c.moderation || 'approved',
    image: imageOut(c.id, c),
    applications: Number(c.applications) || 0,
    accepted: Number(c.accepted) || 0,
    pending: Number(c.pending) || 0,
    createdAt: c.created_at
  };
}

function applicationOut(a) {
  return {
    id: a.id,
    status: a.status,
    message: a.message || '',
    createdAt: a.created_at,
    campaign: { id: a.campaign_id, title: a.title },
    business: { id: a.business_id, company: a.company || '' },
    blogger: {
      id: a.blogger_id,
      name: a.blogger_name || '',
      platform: a.platform,
      followers: followersLabel(a.followers),
      profileUrl: profileUrl(a.platform, a.profile)
    }
  };
}

/* ---------- So'rovlar (SQL) ---------- */

const pageOf = (url) => Math.max(1, Math.min(1000, Number(url.searchParams.get('page')) || 1));
const like = (q) => `%${String(q).trim().replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

async function listUsers(db, url) {
  const where = [];
  const args = [];
  const add = (sql, value) => {
    args.push(value);
    where.push(sql.replaceAll('?', `?${args.length}`));
  };
  const role = url.searchParams.get('role');
  const status = url.searchParams.get('status');
  const q = (url.searchParams.get('q') || '').trim();
  if (status === 'incomplete') where.push("(reg_step IS NULL OR reg_step != 'done')");
  else where.push("reg_step = 'done'");
  if (role === 'blogger' || role === 'business') add('role = ?', role);
  if (['pending', 'approved', 'rejected'].includes(status)) add('moderation = ?', status);
  if (q) {
    // Ism, kompaniya, username, profil; telefon — faqat raqamlari bo'yicha; Telegram ID — aniq
    args.push(like(q));
    const text = args.length;
    const digits = q.replace(/\D/g, '');
    args.push(digits.length >= 3 ? like(digits) : '\u0000');
    const phone = args.length;
    args.push(digits || '-');
    const id = args.length;
    where.push(
      `(name LIKE ?${text} ESCAPE '\\' OR first_name LIKE ?${text} ESCAPE '\\' OR company LIKE ?${text} ESCAPE '\\'` +
        ` OR username LIKE ?${text} ESCAPE '\\' OR profile LIKE ?${text} ESCAPE '\\' OR phone LIKE ?${phone} ESCAPE '\\'` +
        ` OR CAST(tg_id AS TEXT) = ?${id})`
    );
  }
  const whereSql = where.join(' AND ');
  const pageNo = pageOf(url);
  const total = (await db.prepare(`SELECT COUNT(*) AS n FROM users WHERE ${whereSql}`).bind(...args).first()).n;
  const { results } = await db
    .prepare(
      `SELECT u.*,
         (SELECT COUNT(*) FROM campaigns c WHERE c.business_id = u.tg_id) AS campaigns_count,
         (SELECT COUNT(*) FROM applications a WHERE a.blogger_id = u.tg_id) AS applications_count
       FROM users u WHERE ${whereSql}
       ORDER BY (u.moderation = 'pending') DESC, COALESCE(u.registered_at, u.created_at) DESC, u.tg_id DESC
       LIMIT ${PAGE_SIZE} OFFSET ${(pageNo - 1) * PAGE_SIZE}`
    )
    .bind(...args)
    .all();
  return { users: results.map(userOut), total, page: pageNo, pageSize: PAGE_SIZE };
}

const CAMPAIGN_ADMIN_SELECT = `
  SELECT c.*, u.company AS business_name, u.name AS business_contact,
    (SELECT COUNT(*) FROM applications a WHERE a.campaign_id = c.id) AS applications,
    (SELECT COUNT(*) FROM applications a WHERE a.campaign_id = c.id AND a.status = 'accepted') AS accepted,
    (SELECT COUNT(*) FROM applications a WHERE a.campaign_id = c.id AND a.status = 'pending') AS pending
  FROM campaigns c JOIN users u ON u.tg_id = c.business_id`;

async function listCampaigns(db, url, { businessId = null } = {}) {
  const where = ['1 = 1'];
  const args = [];
  const add = (sql, value) => {
    args.push(value);
    where.push(sql.replaceAll('?', `?${args.length}`));
  };
  const moderation = url?.searchParams.get('moderation');
  const status = url?.searchParams.get('status');
  const q = (url?.searchParams.get('q') || '').trim();
  if (businessId) add('c.business_id = ?', businessId);
  if (['pending', 'approved', 'rejected'].includes(moderation)) add('c.moderation = ?', moderation);
  if (status === 'active' || status === 'closed') add('c.status = ?', status);
  if (q) add("(c.title LIKE ? ESCAPE '\\' OR u.company LIKE ? ESCAPE '\\' OR c.city LIKE ? ESCAPE '\\')", like(q));
  const whereSql = where.join(' AND ');
  const pageNo = url ? pageOf(url) : 1;
  const total = (
    await db.prepare(`SELECT COUNT(*) AS n FROM campaigns c JOIN users u ON u.tg_id = c.business_id WHERE ${whereSql}`).bind(...args).first()
  ).n;
  const { results } = await db
    .prepare(
      `${CAMPAIGN_ADMIN_SELECT} WHERE ${whereSql}
       ORDER BY (c.moderation = 'pending' AND c.status = 'active') DESC, c.created_at DESC, c.id DESC
       LIMIT ${PAGE_SIZE} OFFSET ${(pageNo - 1) * PAGE_SIZE}`
    )
    .bind(...args)
    .all();
  return { campaigns: results.map(campaignOut), total, page: pageNo, pageSize: PAGE_SIZE };
}

async function listApplications(db, url, { bloggerId = null, campaignId = null } = {}) {
  const where = ['1 = 1'];
  const args = [];
  const status = url?.searchParams.get('status');
  if (['pending', 'accepted', 'rejected'].includes(status)) {
    args.push(status);
    where.push(`a.status = ?${args.length}`);
  }
  if (bloggerId) {
    args.push(bloggerId);
    where.push(`a.blogger_id = ?${args.length}`);
  }
  if (campaignId) {
    args.push(campaignId);
    where.push(`a.campaign_id = ?${args.length}`);
  }
  const whereSql = where.join(' AND ');
  const pageNo = url ? pageOf(url) : 1;
  const total = (await db.prepare(`SELECT COUNT(*) AS n FROM applications a WHERE ${whereSql}`).bind(...args).first()).n;
  const { results } = await db
    .prepare(
      `SELECT a.id, a.status, a.message, a.created_at, a.campaign_id, a.blogger_id,
         c.title, c.business_id, b.company,
         g.name AS blogger_name, g.platform, g.profile, g.followers
       FROM applications a
       JOIN campaigns c ON c.id = a.campaign_id
       JOIN users b ON b.tg_id = c.business_id
       JOIN users g ON g.tg_id = a.blogger_id
       WHERE ${whereSql}
       ORDER BY a.created_at DESC, a.id DESC
       LIMIT ${PAGE_SIZE} OFFSET ${(pageNo - 1) * PAGE_SIZE}`
    )
    .bind(...args)
    .all();
  return { applications: results.map(applicationOut), total, page: pageNo, pageSize: PAGE_SIZE };
}

async function dashboardStats(db) {
  const base = await getStats(db);
  const week = now() - 7 * 24 * 3600;
  const extra = await db
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM users WHERE reg_step = 'done' AND registered_at >= ?1) AS new_users,
         (SELECT COUNT(*) FROM campaigns WHERE created_at >= ?1) AS new_ads,
         (SELECT COUNT(*) FROM applications WHERE created_at >= ?1) AS new_applications,
         (SELECT COUNT(*) FROM applications WHERE status = 'pending') AS waiting_applications,
         (SELECT COUNT(*) FROM users WHERE reg_step IS NOT NULL AND reg_step != 'done') AS incomplete`
    )
    .bind(week)
    .first();
  return {
    bloggers: base.bloggers,
    businesses: base.businesses,
    pendingUsers: base.pending,
    pendingAds: base.pending_ads,
    activeAds: base.active,
    applications: base.applications,
    accepted: base.accepted,
    waitingApplications: extra.waiting_applications,
    incomplete: extra.incomplete,
    week: { users: extra.new_users, ads: extra.new_ads, applications: extra.new_applications }
  };
}

async function settings(ctx) {
  const groups = {};
  for (const [kind, key] of Object.entries(MOD_CHAT_KEYS)) {
    const id = Number(await getSetting(ctx.db, key)) || null;
    let title = null;
    if (id) {
      try {
        title = (await ctx.tg.call('getChat', { chat_id: id })).title || null;
      } catch {
        /* bot guruhdan chiqarilgan bo'lishi mumkin */
      }
    }
    groups[kind] = id ? { id, title } : null;
  }
  return { groups, bot: await getBotUsername(ctx) };
}

/* ---------- Marshrutlar ---------- */

async function readJson(request) {
  try {
    const body = await request.json();
    if (body && typeof body === 'object') return body;
  } catch {
    /* pastda */
  }
  throw new AppError('invalid', 400);
}

export async function handleAdmin(request, ctx) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '');
  const method = request.method.toUpperCase();

  if (path === '/admin/login') return method === 'GET' ? login(ctx, url) : new Response('Method not allowed', { status: 405 });

  const admin = await sessionAdmin(request, ctx);
  if (!admin) return json({ error: 'unauthorized', bot: await getBotUsername(ctx) }, 401);
  // O'zgartiruvchi so'rovlar faqat panelning o'zidan keladi (boshqa saytdan yuborib bo'lmaydi)
  if (method !== 'GET' && request.headers.get('x-ovoza-admin') !== '1') return json({ error: 'forbidden' }, 403);

  try {
    return await route(ctx, admin, method, path, url, request);
  } catch (e) {
    if (!(e instanceof AppError)) throw e;
    const status = { gone: 404, already: 409 }[e.code] || e.status;
    return json({ error: e.code === 'gone' ? 'not_found' : e.code, ...e.extra }, status);
  }
}

async function route(ctx, admin, method, path, url, request) {
  const { db } = ctx;
  let m;

  if (method === 'GET' && path === '/api/admin/me') {
    const me = await getUser(db, admin.id);
    return json({ admin: { id: admin.id, name: me?.name || me?.first_name || '' } });
  }

  if (method === 'POST' && path === '/api/admin/logout') {
    await db.prepare('DELETE FROM admin_tokens WHERE token_hash = ?1').bind(admin.hash).run();
    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'content-type': 'application/json; charset=utf-8', 'set-cookie': cookie('', 0), 'cache-control': 'no-store' }
    });
  }

  if (method === 'GET' && path === '/api/admin/stats') return json(await dashboardStats(db));
  if (method === 'GET' && path === '/api/admin/users') return json(await listUsers(db, url));
  if (method === 'GET' && path === '/api/admin/campaigns') return json(await listCampaigns(db, url));
  if (method === 'GET' && path === '/api/admin/applications') return json(await listApplications(db, url));
  if (method === 'GET' && path === '/api/admin/settings') return json(await settings(ctx));

  // Foydalanuvchi: batafsil, moderatsiya qarori, o'chirish
  if ((m = path.match(/^\/api\/admin\/users\/(\d+)(\/moderation)?$/))) {
    const id = Number(m[1]);
    if (m[2]) {
      if (method !== 'POST') throw new AppError('not_found', 404);
      const { action } = await readJson(request);
      const code = { approve: 'a', reject: 'r', block: 'b' }[action];
      if (!code) throw new AppError('invalid', 400);
      await moderate(ctx, admin.id, id, code);
    } else if (method === 'DELETE') {
      if (!(await getUser(db, id))) throw new AppError('not_found', 404);
      await deleteUserData(db, id);
      return json({ ok: true });
    } else if (method !== 'GET') {
      throw new AppError('not_found', 404);
    }
    const row = await db
      .prepare(
        `SELECT u.*,
           (SELECT COUNT(*) FROM campaigns c WHERE c.business_id = u.tg_id) AS campaigns_count,
           (SELECT COUNT(*) FROM applications a WHERE a.blogger_id = u.tg_id) AS applications_count
         FROM users u WHERE u.tg_id = ?1`
      )
      .bind(id)
      .first();
    if (!row) throw new AppError('not_found', 404);
    const user = userOut(row);
    const related =
      row.role === 'business'
        ? { campaigns: (await listCampaigns(db, null, { businessId: id })).campaigns }
        : { applications: (await listApplications(db, null, { bloggerId: id })).applications };
    return json({ user, ...related });
  }

  // E'lon: batafsil (kelgan so'rovlari bilan)
  if (method === 'GET' && (m = path.match(/^\/api\/admin\/campaigns\/(\d+)$/))) {
    const id = Number(m[1]);
    const row = await db.prepare(`${CAMPAIGN_ADMIN_SELECT} WHERE c.id = ?1`).bind(id).first();
    if (!row) throw new AppError('not_found', 404);
    const { applications } = await listApplications(db, null, { campaignId: id });
    return json({ campaign: campaignOut(row), applications });
  }

  // E'lon: moderatsiya qarori va yopish
  if (method === 'POST' && (m = path.match(/^\/api\/admin\/campaigns\/(\d+)\/(moderation|close)$/))) {
    const id = Number(m[1]);
    if (m[2] === 'moderation') {
      const { action } = await readJson(request);
      const code = { approve: 'a', reject: 'r' }[action];
      if (!code) throw new AppError('invalid', 400);
      await moderateCampaign(ctx, admin.id, id, code);
    } else {
      const { changed, campaign } = await closeCampaignByAdmin(db, id);
      if (!campaign) throw new AppError('not_found', 404);
      if (!changed) throw new AppError('already', 409);
      try {
        await ctx.tg.send(campaign.business_id, tr(campaign.business_lang).toBusinessClosed(campaign.title));
      } catch (e) {
        console.warn('notify business failed:', e.message);
      }
    }
    const row = await db.prepare(`${CAMPAIGN_ADMIN_SELECT} WHERE c.id = ?1`).bind(id).first();
    return json({ campaign: campaignOut(row) });
  }

  // Moderatsiya guruhini uzish
  if (method === 'DELETE' && (m = path.match(/^\/api\/admin\/settings\/groups\/(blogger|business|ads)$/))) {
    await setSetting(db, MOD_CHAT_KEYS[m[1]], '');
    return json(await settings(ctx));
  }

  throw new AppError('not_found', 404);
}
