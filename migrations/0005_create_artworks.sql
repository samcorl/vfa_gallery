-- Artworks and collection_artworks tables
-- Core content entities for the gallery

CREATE TABLE artworks (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  materials TEXT,
  dimensions TEXT,
  created_date TEXT,
  category TEXT,
  tags TEXT,
  original_url TEXT NOT NULL,
  display_url TEXT NOT NULL,
  thumbnail_url TEXT NOT NULL,
  icon_url TEXT NOT NULL,
  theme_id TEXT,
  status TEXT DEFAULT 'active',
  is_featured INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, slug)
);

CREATE TABLE collection_artworks (
  collection_id TEXT REFERENCES collections(id) ON DELETE CASCADE,
  artwork_id TEXT REFERENCES artworks(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  added_at TEXT DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (collection_id, artwork_id)
);
