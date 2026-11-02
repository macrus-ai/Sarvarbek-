-- Moderatsiya: yangi bloger va biznes jamoa tasdiqlagandan keyin platformadan foydalanadi.
--   users.moderation — 'pending' (kutilmoqda) | 'approved' (tasdiqlangan) | 'rejected' (rad etilgan yoki bloklangan)
-- settings — bot sozlamalari, masalan moderatsiya guruhlari (chat_blogger, chat_business)

ALTER TABLE users ADD COLUMN moderation TEXT;
ALTER TABLE users ADD COLUMN moderated_by INTEGER;
ALTER TABLE users ADD COLUMN moderated_at INTEGER;

-- Avval ro'yxatdan o'tganlar platformada qoladi
UPDATE users SET moderation = 'approved' WHERE registered_at IS NOT NULL;

CREATE INDEX users_moderation ON users (moderation, registered_at);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
