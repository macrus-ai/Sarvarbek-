-- Xavfsiz barter: qabul qilingan so'rov bo'yicha natija (src/results.js)
--   applications.result_status — NULL (natija hali yuborilmagan) | 'submitted' (bloger yubordi, biznes tekshiradi)
--                                | 'confirmed' (biznes "Bajarildi" dedi) | 'disputed' (biznes "Muammo bor" dedi)
--   post_url, result_views, result_note — blogerning post havolasi, ko'rishlar soni va izohi
--   review, rating                     — biznesning fikri va bahosi (1–5), ixtiyoriy
--   dispute_note                       — biznes muammoni qisqacha yozadi
--   case_hidden                        — 1: jamoa keysni saytdan yashirgan
-- users.public_id — saytdagi keys sahifasi manzili (miqyos.uz/keyslar.html?b=...). Telegram ID ko'rinmasin.

ALTER TABLE applications ADD COLUMN result_status TEXT;
ALTER TABLE applications ADD COLUMN post_url TEXT;
ALTER TABLE applications ADD COLUMN result_views INTEGER;
ALTER TABLE applications ADD COLUMN result_note TEXT;
ALTER TABLE applications ADD COLUMN result_at INTEGER;
ALTER TABLE applications ADD COLUMN confirmed_at INTEGER;
ALTER TABLE applications ADD COLUMN review TEXT;
ALTER TABLE applications ADD COLUMN rating INTEGER;
ALTER TABLE applications ADD COLUMN dispute_note TEXT;
ALTER TABLE applications ADD COLUMN case_hidden INTEGER NOT NULL DEFAULT 0;

CREATE INDEX applications_result ON applications (result_status, confirmed_at);

ALTER TABLE users ADD COLUMN public_id TEXT;
CREATE UNIQUE INDEX users_public_id ON users (public_id);
