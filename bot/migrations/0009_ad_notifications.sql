-- Yangi reklama e'loni haqida blogerlarga xabar (src/broadcast.js).
--   users.notify_ads — 1: mos yangi e'lonlar haqida xabar keladi, 0: bloger o'chirgan (/xabarlar) yoki botni bloklagan.
--   ad_broadcasts    — tasdiqlangan har bir e'lon uchun bitta qator. Cron har daqiqada keyingi blogerlarga
--                      yuboradi: last_tg_id — oxirgi ko'rib chiqilgan bloger, done_at — hammasiga yuborildi.
--                      Tashqi kalit yo'q: e'lon o'chirilsa, cron qatorni o'zi yopadi.

ALTER TABLE users ADD COLUMN notify_ads INTEGER NOT NULL DEFAULT 1;

CREATE TABLE ad_broadcasts (
  campaign_id INTEGER PRIMARY KEY,
  last_tg_id INTEGER NOT NULL DEFAULT 0,
  sent INTEGER NOT NULL DEFAULT 0,
  done_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE INDEX ad_broadcasts_open ON ad_broadcasts (done_at, created_at);
CREATE INDEX users_role_moderation ON users (role, moderation, tg_id);
