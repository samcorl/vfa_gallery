-- Performance indexes for common query patterns

-- User indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_status ON users(status);

-- Gallery indexes
CREATE INDEX idx_galleries_user ON galleries(user_id);
CREATE INDEX idx_galleries_slug ON galleries(user_id, slug);

-- Collection indexes
CREATE INDEX idx_collections_gallery ON collections(gallery_id);

-- Artwork indexes
CREATE INDEX idx_artworks_user ON artworks(user_id);
CREATE INDEX idx_artworks_slug ON artworks(user_id, slug);
CREATE INDEX idx_artworks_category ON artworks(category);
CREATE INDEX idx_artworks_featured ON artworks(is_featured) WHERE is_featured = 1;

-- Collection artworks indexes
CREATE INDEX idx_collection_artworks_artwork ON collection_artworks(artwork_id);

-- Message indexes
CREATE INDEX idx_messages_recipient ON messages(recipient_id, created_at);
CREATE INDEX idx_messages_sender ON messages(sender_id, created_at);
CREATE INDEX idx_messages_status ON messages(status);

-- Activity log indexes
CREATE INDEX idx_activity_user ON activity_log(user_id, created_at);
CREATE INDEX idx_activity_action ON activity_log(action, created_at);

-- Session indexes
CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);

-- Group indexes
CREATE INDEX idx_groups_slug ON groups(slug);
CREATE INDEX idx_group_members_user ON group_members(user_id);
