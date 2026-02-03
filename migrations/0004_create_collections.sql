-- Collections table
-- Organizes artworks within a gallery

CREATE TABLE collections (
  id TEXT PRIMARY KEY,
  gallery_id TEXT REFERENCES galleries(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  hero_image_url TEXT,
  theme_id TEXT,
  is_default INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(gallery_id, slug)
);
