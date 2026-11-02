-- Reklama e'lonlari moderatsiyasi va blogerning statistikasi
--   campaigns.moderation — 'pending' | 'approved' | 'rejected': blogerlar faqat tasdiqlangan e'lonni ko'radi
--   users.reach          — o'rtacha ko'rishlar oralig'i (src/constants.js dagi REACH)
--   users.stats_file_id  — statistika skrinshoti (Telegram file_id), stats_key — uning manzilidagi kalit

ALTER TABLE campaigns ADD COLUMN moderation TEXT;
ALTER TABLE campaigns ADD COLUMN moderated_by INTEGER;
ALTER TABLE campaigns ADD COLUMN moderated_at INTEGER;

-- Hozirgi e'lonlar blogerlarga ko'rinishda qoladi
UPDATE campaigns SET moderation = 'approved';

CREATE INDEX campaigns_moderation ON campaigns (moderation, status);

ALTER TABLE users ADD COLUMN reach TEXT;
ALTER TABLE users ADD COLUMN stats_file_id TEXT;
ALTER TABLE users ADD COLUMN stats_key TEXT;
