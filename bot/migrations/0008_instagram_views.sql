-- Instagram blogeri: to'rtta alohida ko'rsatkich (src/constants.js dagi oraliqlar id'lari).
-- users.reach Instagramda istoriya (storis) ko'rishlari bo'lib qoladi.
-- Eski users.reels_reach ("Reels va postlar") o'chirilmaydi va yangi ustunlarga ko'chirilmaydi.
ALTER TABLE users ADD COLUMN reels_views TEXT;      -- reels o'rtacha ko'rishlari (REELS_REACH)
ALTER TABLE users ADD COLUMN posts_views TEXT;      -- postlar o'rtacha ko'rishlari (REACH)
ALTER TABLE users ADD COLUMN accounts_reached TEXT; -- qamrov: oxirgi 30 kunda qamrab olingan akkauntlar (ACCOUNTS_REACHED)
