// D1 (SQLite) bazasi bilan ishlash

import { FOLLOWERS } from './constants.js';
import { now } from './util.js';

const USER_FIELDS = [
  'first_name', 'username', 'lang', 'role', 'reg_step', 'name', 'phone', 'company',
  'category', 'platform', 'profile', 'followers', 'niche', 'region', 'registered_at',
  'moderation', 'moderated_by', 'moderated_at', 'reach', 'reels_reach', 'reels_views', 'posts_views',
  'accounts_reached', 'stats_file_id', 'stats_key', 'notify_ads'
];

/* ---------- Foydalanuvchilar ---------- */

export function getUser(db, id) {
  return db.prepare('SELECT * FROM users WHERE tg_id = ?1').bind(id).first();
}

// Foydalanuvchi qatorini yaratadi (yo'q bo'lsa) va Telegram ismi/username ni yangilaydi
export async function touchUser(db, from, lang) {
  const ts = now();
  await db
    .prepare(
      `INSERT INTO users (tg_id, first_name, username, lang, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?5)
       ON CONFLICT (tg_id) DO UPDATE SET
         first_name = excluded.first_name,
         username = excluded.username,
         updated_at = excluded.updated_at`
    )
    .bind(from.id, from.first_name ?? null, from.username ?? null, lang, ts)
    .run();
  return getUser(db, from.id);
}

export async function updateUser(db, id, fields) {
  const keys = Object.keys(fields).filter((k) => USER_FIELDS.includes(k));
  if (!keys.length) return;
  const sets = keys.map((k, i) => `${k} = ?${i + 1}`).join(', ');
  const values = keys.map((k) => fields[k] ?? null);
  await db
    .prepare(`UPDATE users SET ${sets}, updated_at = ?${keys.length + 1} WHERE tg_id = ?${keys.length + 2}`)
    .bind(...values, now(), id)
    .run();
}

/* ---------- Moderatsiya ---------- */

// Qaror faqat holat haqiqatan o'zgarsa yoziladi: ikki moderator bir vaqtda bossa, biri "allaqachon" oladi.
export async function setModeration(db, id, status, moderatorId) {
  const res = await db
    .prepare(
      `UPDATE users SET moderation = ?1, moderated_by = ?2, moderated_at = ?3, updated_at = ?3
       WHERE tg_id = ?4 AND reg_step = 'done' AND (moderation IS NULL OR moderation != ?1)`
    )
    .bind(status, moderatorId ?? null, now(), id)
    .run();
  return res.meta.changes > 0;
}

// E'lon bo'yicha qaror (holat haqiqatan o'zgarsagina)
export async function setCampaignModeration(db, id, status, moderatorId) {
  const res = await db
    .prepare(
      `UPDATE campaigns SET moderation = ?1, moderated_by = ?2, moderated_at = ?3, updated_at = ?3
       WHERE id = ?4 AND (moderation IS NULL OR moderation != ?1)`
    )
    .bind(status, moderatorId ?? null, now(), id)
    .run();
  return res.meta.changes > 0;
}

export async function listPendingCampaigns(db, limit = 15) {
  const { results } = await db
    .prepare(`${CAMPAIGN_SELECT} WHERE c.moderation = 'pending' AND c.status = 'active' ORDER BY c.created_at, c.id LIMIT ?2`)
    .bind(0, limit)
    .all();
  return results;
}

export async function listPendingUsers(db, limit = 15) {
  const { results } = await db
    .prepare(
      `SELECT * FROM users WHERE moderation = 'pending' AND reg_step = 'done'
       ORDER BY registered_at, tg_id LIMIT ?1`
    )
    .bind(limit)
    .all();
  return results;
}

/* ---------- Sozlamalar ---------- */

export async function getSetting(db, key) {
  const row = await db.prepare('SELECT value FROM settings WHERE key = ?1').bind(key).first();
  return row ? row.value : null;
}

export async function setSetting(db, key, value) {
  await db
    .prepare(
      `INSERT INTO settings (key, value, updated_at) VALUES (?1, ?2, ?3)
       ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    )
    .bind(key, String(value), now())
    .run();
}

/* ---------- Reklama e'lonlari (jadvalda: campaigns) ---------- */

// ?1 — ko'rayotgan foydalanuvchi (uning so'rovi holatini qo'shish uchun)
const CAMPAIGN_SELECT = `
  SELECT c.*, u.company AS business_name,
    (SELECT COUNT(*) FROM applications a WHERE a.campaign_id = c.id AND a.status = 'accepted') AS accepted,
    (SELECT COUNT(*) FROM applications a WHERE a.campaign_id = c.id AND a.status = 'pending') AS pending,
    (SELECT a.status FROM applications a WHERE a.campaign_id = c.id AND a.blogger_id = ?1) AS my_status
  FROM campaigns c
  JOIN users u ON u.tg_id = c.business_id`;

const CAMPAIGN_ORDER = {
  new: 'c.created_at DESC, c.id DESC',
  value: 'c.value DESC, c.created_at DESC, c.id DESC'
};

// region: shu hudud uchun e'lonlar va butun O'zbekiston uchun e'lonlar ('all')
export async function listActiveCampaigns(db, { viewerId, category, platform, region, sort = 'new' }) {
  const where = ["c.status = 'active'", "c.moderation = 'approved'"];
  const args = [viewerId];
  if (category) {
    args.push(category);
    where.push(`c.category = ?${args.length}`);
  }
  if (platform) {
    args.push(platform);
    where.push(`instr(',' || c.platforms || ',', ',' || ?${args.length} || ',') > 0`);
  }
  if (region) {
    args.push(region);
    where.push(`(c.region = ?${args.length} OR c.region = 'all')`);
  }
  const order = CAMPAIGN_ORDER[sort] || CAMPAIGN_ORDER.new;
  const { results } = await db
    .prepare(`${CAMPAIGN_SELECT} WHERE ${where.join(' AND ')} ORDER BY ${order} LIMIT 300`)
    .bind(...args)
    .all();
  return results;
}

export function getCampaign(db, id, viewerId) {
  return db.prepare(`${CAMPAIGN_SELECT} WHERE c.id = ?2`).bind(viewerId, id).first();
}

export async function listBusinessCampaigns(db, businessId) {
  const { results } = await db
    .prepare(`${CAMPAIGN_SELECT} WHERE c.business_id = ?1 ORDER BY (c.status = 'active') DESC, c.created_at DESC, c.id DESC LIMIT 200`)
    .bind(businessId)
    .all();
  return results;
}

export function countActiveCampaigns(db, businessId) {
  return db
    .prepare("SELECT COUNT(*) AS n FROM campaigns WHERE business_id = ?1 AND status = 'active'")
    .bind(businessId)
    .first('n');
}

export async function createCampaign(db, businessId, c) {
  const ts = now();
  const row = await db
    .prepare(
      `INSERT INTO campaigns
         (business_id, title, category, value, platforms, format, min_followers, days, slots, city, description,
          region, moderation, status, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, 'active', ?14, ?14)
       RETURNING id`
    )
    .bind(
      businessId, c.title, c.category, c.value, c.platforms.join(','), c.format,
      c.minFollowers, c.days, c.slots, c.city || null, c.description || null, c.region || 'all',
      c.moderation || 'pending', ts
    )
    .first();
  return row.id;
}

export async function setCampaignStatus(db, id, businessId, status) {
  const res = await db
    .prepare('UPDATE campaigns SET status = ?1, updated_at = ?2 WHERE id = ?3 AND business_id = ?4')
    .bind(status, now(), id, businessId)
    .run();
  return res.meta.changes;
}

export function closeBusinessCampaigns(db, businessId) {
  return db
    .prepare("UPDATE campaigns SET status = 'closed', updated_at = ?1 WHERE business_id = ?2 AND status = 'active'")
    .bind(now(), businessId)
    .run();
}

/* ---------- So'rovlar ---------- */

// Takroriy so'rov bo'lsa null qaytaradi
export function insertApplication(db, campaignId, bloggerId, message) {
  const ts = now();
  return db
    .prepare(
      `INSERT OR IGNORE INTO applications (campaign_id, blogger_id, message, status, created_at, updated_at)
       VALUES (?1, ?2, ?3, 'pending', ?4, ?4)
       RETURNING id`
    )
    .bind(campaignId, bloggerId, message || null, ts)
    .first();
}

export function getApplicationFull(db, id) {
  return db
    .prepare(
      `SELECT a.*, c.title, c.business_id, c.slots, c.format, c.status AS campaign_status,
         b.name AS business_contact, b.company, b.phone AS business_phone, b.username AS business_username, b.lang AS business_lang,
         g.name AS blogger_name, g.phone AS blogger_phone, g.username AS blogger_username, g.lang AS blogger_lang,
         g.platform, g.profile, g.followers, g.niche, g.region, g.reach, g.reels_reach, g.reels_views, g.posts_views,
         g.accounts_reached, g.stats_file_id
       FROM applications a
       JOIN campaigns c ON c.id = a.campaign_id
       JOIN users b ON b.tg_id = c.business_id
       JOIN users g ON g.tg_id = a.blogger_id
       WHERE a.id = ?1`
    )
    .bind(id)
    .first();
}

// Faqat kampaniya egasi va faqat "pending" holatdagi so'rov uchun ishlaydi.
// Qabul qilishda bo'sh o'rin borligi ham shu yerda tekshiriladi.
export async function decideApplication(db, id, businessId, status) {
  const res = await db
    .prepare(
      `UPDATE applications SET status = ?1, updated_at = ?2
       WHERE id = ?3 AND status = 'pending'
         AND campaign_id IN (SELECT id FROM campaigns WHERE business_id = ?4)
         AND (?1 = 'rejected' OR
           (SELECT COUNT(*) FROM applications a2 WHERE a2.campaign_id = applications.campaign_id AND a2.status = 'accepted')
             < (SELECT c.slots FROM campaigns c WHERE c.id = applications.campaign_id))`
    )
    .bind(status, now(), id, businessId)
    .run();
  return res.meta.changes;
}

export function setApplicationNotify(db, id, chatId, messageId) {
  return db
    .prepare('UPDATE applications SET notify_chat_id = ?1, notify_message_id = ?2 WHERE id = ?3')
    .bind(chatId, messageId, id)
    .run();
}

// Blogerning so'rovlari. Biznes bilan aloqa ma'lumotlari faqat qabul qilinganda beriladi.
// Rasmni qo'yadi yoki (image = null) olib tashlaydi. Faqat e'lon egasi uchun ishlaydi.
export async function setCampaignImage(db, id, businessId, image) {
  const res = await db
    .prepare('UPDATE campaigns SET image_file_id = ?1, image_thumb_id = ?2, image_key = ?3, updated_at = ?4 WHERE id = ?5 AND business_id = ?6')
    .bind(image?.fileId ?? null, image?.thumbId ?? null, image?.key ?? null, now(), id, businessId)
    .run();
  return res.meta.changes > 0;
}

export async function listBloggerApplications(db, bloggerId) {
  const { results } = await db
    .prepare(
      `SELECT a.id, a.status, a.message, a.created_at, a.updated_at,
         c.id AS campaign_id, c.title, c.value, c.format, c.days, c.city, c.region, c.status AS campaign_status,
         c.image_file_id, c.image_key,
         b.company,
         CASE WHEN a.status = 'accepted' THEN b.name END AS contact_name,
         CASE WHEN a.status = 'accepted' THEN b.phone END AS contact_phone,
         CASE WHEN a.status = 'accepted' THEN b.username END AS contact_username
       FROM applications a
       JOIN campaigns c ON c.id = a.campaign_id
       JOIN users b ON b.tg_id = c.business_id
       WHERE a.blogger_id = ?1
       ORDER BY a.created_at DESC, a.id DESC
       LIMIT 200`
    )
    .bind(bloggerId)
    .all();
  return results;
}

// Biznesga kelgan so'rovlar. Bloger telefoni faqat qabul qilinganda beriladi.
export async function listBusinessRequests(db, businessId) {
  const { results } = await db
    .prepare(
      `SELECT a.id, a.status, a.message, a.created_at,
         c.id AS campaign_id, c.title,
         g.tg_id AS blogger_id, g.name, g.platform, g.profile, g.followers, g.niche, g.region,
         g.reach, g.reels_reach, g.reels_views, g.posts_views, g.accounts_reached,
         CASE WHEN g.stats_file_id IS NOT NULL THEN g.stats_key END AS stats_key,
         CASE WHEN a.status = 'accepted' THEN g.username END AS username,
         CASE WHEN a.status = 'accepted' THEN g.phone END AS phone
       FROM applications a
       JOIN campaigns c ON c.id = a.campaign_id
       JOIN users g ON g.tg_id = a.blogger_id
       WHERE c.business_id = ?1
       ORDER BY (a.status = 'pending') DESC, a.created_at DESC, a.id DESC
       LIMIT 300`
    )
    .bind(businessId)
    .all();
  return results;
}

export function getStats(db) {
  return db
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM users WHERE role = 'business' AND reg_step = 'done') AS businesses,
         (SELECT COUNT(*) FROM users WHERE role = 'blogger' AND reg_step = 'done') AS bloggers,
         (SELECT COUNT(*) FROM campaigns WHERE status = 'active') AS active,
         (SELECT COUNT(*) FROM applications) AS applications,
         (SELECT COUNT(*) FROM applications WHERE status = 'accepted') AS accepted,
         (SELECT COUNT(*) FROM users WHERE moderation = 'pending' AND reg_step = 'done') AS pending,
         (SELECT COUNT(*) FROM campaigns WHERE moderation = 'pending' AND status = 'active') AS pending_ads`
    )
    .first();
}

/* ---------- Ma'lumotlarni o'chirish va moderatsiya ---------- */

// Foydalanuvchining barcha ma'lumotlari: profili, kampaniyalari va so'rovlari
export async function deleteUserData(db, id) {
  await db
    .prepare('DELETE FROM applications WHERE blogger_id = ?1 OR campaign_id IN (SELECT id FROM campaigns WHERE business_id = ?1)')
    .bind(id)
    .run();
  await db.prepare('DELETE FROM ad_broadcasts WHERE campaign_id IN (SELECT id FROM campaigns WHERE business_id = ?1)').bind(id).run();
  await db.prepare('DELETE FROM campaigns WHERE business_id = ?1').bind(id).run();
  await db.prepare('DELETE FROM users WHERE tg_id = ?1').bind(id).run();
}

/* ---------- Yangi e'lon haqida blogerlarga xabar (src/broadcast.js) ---------- */

// E'lon tasdiqlanganda navbatga qo'yiladi. Bir e'lon faqat bir marta (qayta ochilsa ham takrorlanmaydi).
export function enqueueAdBroadcast(db, campaignId) {
  return db
    .prepare('INSERT OR IGNORE INTO ad_broadcasts (campaign_id, created_at) VALUES (?1, ?2)')
    .bind(campaignId, now())
    .run();
}

export async function openAdBroadcasts(db, limit) {
  const { results } = await db
    .prepare('SELECT * FROM ad_broadcasts WHERE done_at IS NULL ORDER BY created_at, campaign_id LIMIT ?1')
    .bind(limit)
    .all();
  return results;
}

// Obunachilar oralig'ining yuqori chegarasi (services.js dagi followersOk bilan bir xil qoida):
// oraliq noma'lum yoki chegarasiz ('100000+') bo'lsa — talabga mos deb hisoblanadi.
const FOLLOWERS_MAX_SQL = `(CASE u.followers ${FOLLOWERS.map((f) => `WHEN '${f.id}' THEN ${f.max ?? 'NULL'}`).join(' ')} ELSE NULL END)`;

// E'longa mos keyingi blogerlar (tg_id bo'yicha, afterId dan keyin):
// tasdiqlangan, xabarlarni o'chirmagan, platformasi e'londa bor, auditoriya hududi mos
// (yoki e'lon butun O'zbekiston uchun), obunachilari yetadi va hali so'rov yubormagan.
export async function adBroadcastTargets(db, c, afterId, limit) {
  const { results } = await db
    .prepare(
      `SELECT u.tg_id, u.lang FROM users u
       WHERE u.role = 'blogger' AND u.reg_step = 'done' AND u.moderation = 'approved' AND u.notify_ads = 1
         AND u.tg_id > ?1
         AND instr(',' || ?2 || ',', ',' || u.platform || ',') > 0
         AND (?3 = 'all' OR u.region = ?3)
         AND (?4 <= 0 OR ${FOLLOWERS_MAX_SQL} IS NULL OR ${FOLLOWERS_MAX_SQL} >= ?4)
         AND NOT EXISTS (SELECT 1 FROM applications a WHERE a.campaign_id = ?5 AND a.blogger_id = u.tg_id)
       ORDER BY u.tg_id
       LIMIT ?6`
    )
    .bind(afterId, String(c.platforms || ''), c.region || 'all', Number(c.min_followers) || 0, c.id, limit)
    .all();
  return results;
}

// Navbatni oldinga suradi. done: true — bu e'lon bo'yicha xabarlar tugadi.
export function advanceAdBroadcast(db, campaignId, lastId, sent, done) {
  return db
    .prepare(
      `UPDATE ad_broadcasts SET last_tg_id = MAX(last_tg_id, ?1), sent = sent + ?2,
         done_at = CASE WHEN ?3 THEN ?4 ELSE done_at END
       WHERE campaign_id = ?5`
    )
    .bind(lastId, sent, done ? 1 : 0, now(), campaignId)
    .run();
}

// Botni bloklagan blogerlarga boshqa yuborilmaydi
export function disableAdNotifications(db, ids) {
  if (!ids.length) return null;
  const marks = ids.map((_, i) => `?${i + 1}`).join(', ');
  return db.prepare(`UPDATE users SET notify_ads = 0 WHERE tg_id IN (${marks})`).bind(...ids).run();
}

// Admin kampaniyani yopadi (egasidan qat'i nazar). Yopilgan kampaniyani qaytaradi.
export async function closeCampaignByAdmin(db, id) {
  const res = await db
    .prepare("UPDATE campaigns SET status = 'closed', updated_at = ?1 WHERE id = ?2 AND status = 'active'")
    .bind(now(), id)
    .run();
  const row = await db
    .prepare('SELECT c.id, c.title, c.business_id, u.lang AS business_lang FROM campaigns c JOIN users u ON u.tg_id = c.business_id WHERE c.id = ?1')
    .bind(id)
    .first();
  return { changed: res.meta.changes > 0, campaign: row };
}
