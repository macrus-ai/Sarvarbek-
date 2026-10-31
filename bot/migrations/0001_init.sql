-- Ovoza: foydalanuvchilar, kampaniyalar va so'rovlar

CREATE TABLE users (
  tg_id INTEGER PRIMARY KEY,
  first_name TEXT,
  username TEXT,
  lang TEXT NOT NULL DEFAULT 'uz',
  role TEXT CHECK (role IN ('business', 'blogger')),
  reg_step TEXT,
  name TEXT,
  phone TEXT,
  company TEXT,
  category TEXT,
  platform TEXT,
  profile TEXT,
  followers TEXT,
  niche TEXT,
  registered_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE campaigns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id INTEGER NOT NULL REFERENCES users (tg_id),
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  value INTEGER NOT NULL,
  platforms TEXT NOT NULL,
  format TEXT NOT NULL,
  min_followers INTEGER NOT NULL DEFAULT 0,
  days INTEGER NOT NULL,
  slots INTEGER NOT NULL,
  city TEXT,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX campaigns_status_created ON campaigns (status, created_at);
CREATE INDEX campaigns_business ON campaigns (business_id);

CREATE TABLE applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER NOT NULL REFERENCES campaigns (id),
  blogger_id INTEGER NOT NULL REFERENCES users (tg_id),
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  notify_chat_id INTEGER,
  notify_message_id INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (campaign_id, blogger_id)
);

CREATE INDEX applications_blogger ON applications (blogger_id, created_at);
CREATE INDEX applications_campaign ON applications (campaign_id, status);
