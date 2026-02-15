-- Verification tokens table for email verification, password reset, etc.
CREATE TABLE IF NOT EXISTS verification_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_verification_tokens_token_hash ON verification_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_verification_tokens_user_type ON verification_tokens(user_id, type);
CREATE INDEX IF NOT EXISTS idx_verification_tokens_expires ON verification_tokens(expires_at);
