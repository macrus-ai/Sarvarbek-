-- Referal kod: foydalanuvchi qaysi reklama havolasi orqali kelgan (masalan, t.me/miqyosbot?start=blogger-uz-ref-dildora → "dildora").
-- Faqat birinchi marta saqlanadi (ro'yxatdan o'tmagan foydalanuvchi uchun), keyin o'zgarmaydi.
ALTER TABLE users ADD COLUMN ref TEXT;
