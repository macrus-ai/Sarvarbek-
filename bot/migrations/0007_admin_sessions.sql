-- Admin panelga kirish: botdagi /admin bir martalik havola beradi (kind = 'login', 10 daqiqa),
-- havola ochilgach brauzerga sessiya beriladi (kind = 'session', 30 kun).
-- Tokenning o'zi emas, SHA-256 xeshi saqlanadi.
CREATE TABLE admin_tokens (
  token_hash TEXT PRIMARY KEY,
  admin_id INTEGER NOT NULL,
  kind TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX admin_tokens_expires ON admin_tokens (expires_at);
