-- Reklama e'loni rasmi. Rasmning o'zi Telegram serverida turadi, bazada faqat uning ID'lari:
--   image_file_id  — katta o'lcham (e'lon sahifasi uchun)
--   image_thumb_id — kichikroq o'lcham (ro'yxatdagi kartalar uchun)
--   image_key      — rasm manzilidagi tasodifiy kalit; har yangi rasmda o'zgaradi

ALTER TABLE campaigns ADD COLUMN image_file_id TEXT;
ALTER TABLE campaigns ADD COLUMN image_thumb_id TEXT;
ALTER TABLE campaigns ADD COLUMN image_key TEXT;
