-- Add missing columns to match application code

-- Users: is_featured flag for featured artists on browse page
ALTER TABLE users ADD COLUMN is_featured INTEGER DEFAULT 0;

-- Artworks: image_key for R2 object key (used to construct CDN URLs)
ALTER TABLE artworks ADD COLUMN image_key TEXT;
