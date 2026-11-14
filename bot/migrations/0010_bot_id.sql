-- Foydalanuvchi qaysi bot orqali yozgan: Telegram bot ID (tokenning boshidagi raqam).
--
-- 2026-11 da platforma @Ovozauz_bot dan @miqyosbot ga ko'chdi. Telegram botlar foydalanuvchiga
-- birinchi bo'lib yoza olmaydi: yangi botga hali yozmaganlarga (bot_id bo'sh yoki eski bot) yangi
-- bot xabar yubora olmaydi. Shuning uchun e'lon xabarlari faqat yangi botga yozganlarga yuboriladi.
ALTER TABLE users ADD COLUMN bot_id INTEGER;
