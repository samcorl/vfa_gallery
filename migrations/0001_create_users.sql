-- Users table: foundational user entity
-- Auth: Google SSO only (no password field)

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  website TEXT,
  phone TEXT,
  socials TEXT,
  status TEXT DEFAULT 'pending',
  role TEXT DEFAULT 'user',
  gallery_limit INTEGER DEFAULT 500,
  collection_limit INTEGER DEFAULT 1000,
  artwork_limit INTEGER DEFAULT 5000,
  daily_upload_limit INTEGER DEFAULT 10,
  email_verified_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  last_login_at TEXT
);
