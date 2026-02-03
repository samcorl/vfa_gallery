-- Messages table
-- User-to-user messaging with moderation support

CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  sender_id TEXT REFERENCES users(id),
  recipient_id TEXT REFERENCES users(id),
  context_type TEXT,
  context_id TEXT,
  subject TEXT,
  body TEXT NOT NULL,
  status TEXT DEFAULT 'sent',
  tone_score REAL,
  flagged_reason TEXT,
  reviewed_by TEXT REFERENCES users(id),
  reviewed_at TEXT,
  read_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
