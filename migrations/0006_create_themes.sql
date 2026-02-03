-- Themes table
-- Customizable gallery themes (system and user-created)

CREATE TABLE themes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_by TEXT REFERENCES users(id),
  is_system INTEGER DEFAULT 0,
  is_public INTEGER DEFAULT 0,
  copied_from TEXT REFERENCES themes(id),
  styles TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
