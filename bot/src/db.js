// D1 (SQLite) bazasi bilan ishlash

import { now } from './util.js';

const USER_FIELDS = [
  'first_name', 'username', 'lang', 'role', 'reg_step', 'name', 'phone', 'company',
  'category', 'platform', 'profile', 'followers', 'niche', 'registered_at'
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

/* ---------- Reklama e'lonlari (jadvalda: campaigns) ---------- */

// ?1 — ko'rayotgan foydalanuvchi (uning so'rovi holatini qo'shish uchun)
const CAMPAIGN_SELECT = `
  SELECT c.*, u.company AS business_name,
    (SELECT COUNT(*) FROM applications a WHERE a.campaign_id = c.id AND a.status = 'accepted') AS accepted,
    (SELECT COUNT(*) FROM applications a WHERE a.campaign_id = c.id AND a.status = 'pending') AS pending,
    (SELECT a.status FROM applications a WHERE a.campaign_id = c.id AND a.blogger_id = ?1) AS my_status
  FROM campaigns c
  JOIN users u ON u.tg_id = c.business_id`;

export async function listActiveCampaigns(db, { viewerId, category, platform }) {
  const where = ["c.status = 'active'"];
  const args = [viewerId];
  if (category) {
    args.push(category);
    where.push(`c.category = ?${args.length}`);
  }
  if (platform) {
    args.push(platform);
    where.push(`instr(',' || c.platforms || ',', ',' || ?${args.length} || ',') > 0`);
  }
  const { results } = await db
    .prepare(`${CAMPAIGN_SELECT} WHERE ${where.join(' AND ')} ORDER BY c.created_at DESC, c.id DESC LIMIT 300`)
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
         (business_id, title, category, value, platforms, format, min_followers, days, slots, city, description, status, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, 'active', ?12, ?12)
       RETURNING id`
    )
    .bind(
      businessId, c.title, c.category, c.value, c.platforms.join(','), c.format,
      c.minFollowers, c.days, c.slots, c.city || null, c.description || null, ts
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
         g.platform, g.profile, g.followers, g.niche
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
         c.id AS campaign_id, c.title, c.value, c.format, c.days, c.city, c.status AS campaign_status,
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
         g.tg_id AS blogger_id, g.name, g.username, g.platform, g.profile, g.followers, g.niche,
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
         (SELECT COUNT(*) FROM applications WHERE status = 'accepted') AS accepted`
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
  await db.prepare('DELETE FROM campaigns WHERE business_id = ?1').bind(id).run();
  await db.prepare('DELETE FROM users WHERE tg_id = ?1').bind(id).run();
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
