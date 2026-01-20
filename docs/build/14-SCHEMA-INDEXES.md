# Build 14: Database Schema - Performance Indexes

## Goal
Create all performance indexes across the complete database schema to optimize query performance for common access patterns and filtering operations.

## Spec Extract

This build creates a comprehensive set of indexes to optimize query performance across all tables created in Builds 06-13.

```sql
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
```

**Index Rationale:**

- **User indexes**: Support lookups by email (authentication), username (profile/search), and status filtering
- **Gallery indexes**: Enable efficient listing of user galleries and unique slug lookups per user
- **Collection indexes**: Speed up queries to fetch collections within a gallery
- **Artwork indexes**: Optimize lookups by owner, unique slug per user, category filtering, and featured status queries
- **Collection artworks indexes**: Improve queries for artworks within a collection
- **Message indexes**: Enable efficient inbox queries (recipient + timestamp) and sent message history
- **Activity log indexes**: Support audit trail queries by user and action type
- **Session indexes**: Optimize session lookups by user and expiration cleanup queries
- **Group indexes**: Enable slug-based lookups and member querying

## Prerequisites
- **Build 06**: Users table and related tables must exist
- **Build 08**: Galleries and collections tables must exist
- **Build 09**: Artworks table must exist
- **Build 10**: Collection artworks, groups, and group members tables must exist
- **Build 11**: Themes table must exist
- **Build 12**: Messages table must exist
- **Build 13**: Supporting tables (gallery_roles, activity_log, sessions) must exist

All schema tables from Builds 06-13 must be completed before creating indexes.

## Steps

### 1. Create Migration File

Create a new migration file in the migrations folder following Cloudflare D1 naming conventions:

```bash
File: migrations/[TIMESTAMP]_create_indexes.sql
```

The timestamp should be in the format `YYYYMMDDHHMMSS` and should be sequential after the supporting tables migration (e.g., `20260118220300`).

### 2. Migration Implementation

In the migration file, organize indexes by table/domain for clarity. Add all CREATE INDEX statements:

```sql
-- Performance indexes for VFA Gallery database
-- These indexes optimize the most common query patterns

-- User indexes for authentication and discovery
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_status ON users(status);

-- Gallery indexes for browsing and access control
CREATE INDEX idx_galleries_user ON galleries(user_id);
CREATE INDEX idx_galleries_slug ON galleries(user_id, slug);

-- Collection indexes for navigation
CREATE INDEX idx_collections_gallery ON collections(gallery_id);

-- Artwork indexes for discovery and filtering
CREATE INDEX idx_artworks_user ON artworks(user_id);
CREATE INDEX idx_artworks_slug ON artworks(user_id, slug);
CREATE INDEX idx_artworks_category ON artworks(category);
CREATE INDEX idx_artworks_featured ON artworks(is_featured) WHERE is_featured = 1;

-- Collection membership indexes
CREATE INDEX idx_collection_artworks_artwork ON collection_artworks(artwork_id);

-- Message indexes for efficient inbox/sent queries
CREATE INDEX idx_messages_recipient ON messages(recipient_id, created_at);
CREATE INDEX idx_messages_sender ON messages(sender_id, created_at);
CREATE INDEX idx_messages_status ON messages(status);

-- Activity log indexes for audit trail queries
CREATE INDEX idx_activity_user ON activity_log(user_id, created_at);
CREATE INDEX idx_activity_action ON activity_log(action, created_at);

-- Session indexes for security and cleanup
CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);

-- Group indexes for community features
CREATE INDEX idx_groups_slug ON groups(slug);
CREATE INDEX idx_group_members_user ON group_members(user_id);
```

### 3. Verify Migration File Structure

Ensure the migration file:
- Has a unique timestamp after all previous migrations
- Contains all CREATE INDEX statements organized by table/domain
- Contains only valid SQLite syntax
- Does not reference non-existent tables or columns
- Is placed in the `/migrations` directory at the project root
- Does not have any syntax errors

### 4. Apply Migration

Apply the migration using Wrangler:

```bash
cd /Volumes/DataSSD/gitsrc/vfa_gallery
wrangler d1 migrations apply vfa_gallery_db --local
```

Or for production:
```bash
wrangler d1 migrations apply vfa_gallery_db --remote
```

The migration may take a moment to complete as SQLite processes all existing data to build the indexes.

### 5. Verify Index Creation

After migration succeeds, verify all indexes were created:

```bash
wrangler d1 execute vfa_gallery_db --command "SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%' ORDER BY name;" --local
```

Expected result: 28 rows with index names (listed in alphabetical order below)

## Files to Create/Modify

### Create:
- `/Volumes/DataSSD/gitsrc/vfa_gallery/migrations/[TIMESTAMP]_create_indexes.sql`

### Modify:
- None

## Verification

### 1. Verify All Indexes Exist

Execute this command to list all created indexes:

```bash
wrangler d1 execute vfa_gallery_db --command "
SELECT name, tbl_name FROM sqlite_master
WHERE type='index' AND name LIKE 'idx_%'
ORDER BY tbl_name, name;
" --local
```

Expected result: 28 indexes across the following tables:
- activity_log: 2 indexes
- artworks: 4 indexes
- collection_artworks: 1 index
- collections: 1 index
- galleries: 2 indexes
- group_members: 1 index
- groups: 1 index
- messages: 3 indexes
- sessions: 2 indexes
- users: 3 indexes

### 2. Verify User Indexes

Verify all user-related indexes exist:

```bash
wrangler d1 execute vfa_gallery_db --command "
SELECT name, tbl_name, sql FROM sqlite_master
WHERE type='index' AND tbl_name='users'
ORDER BY name;
" --local
```

Expected indexes:
- idx_users_email
- idx_users_status
- idx_users_username

### 3. Verify Gallery Indexes

Verify gallery-related indexes:

```bash
wrangler d1 execute vfa_gallery_db --command "
SELECT name, tbl_name, sql FROM sqlite_master
WHERE type='index' AND tbl_name='galleries'
ORDER BY name;
" --local
```

Expected indexes:
- idx_galleries_slug
- idx_galleries_user

### 4. Verify Artwork Indexes

Verify artwork-related indexes:

```bash
wrangler d1 execute vfa_gallery_db --command "
SELECT name, tbl_name, sql FROM sqlite_master
WHERE type='index' AND tbl_name='artworks'
ORDER BY name;
" --local
```

Expected indexes:
- idx_artworks_category
- idx_artworks_featured
- idx_artworks_slug
- idx_artworks_user

### 5. Verify Message Indexes

Verify message-related indexes:

```bash
wrangler d1 execute vfa_gallery_db --command "
SELECT name, tbl_name, sql FROM sqlite_master
WHERE type='index' AND tbl_name='messages'
ORDER BY name;
" --local
```

Expected indexes:
- idx_messages_recipient
- idx_messages_sender
- idx_messages_status

### 6. Verify Activity Log Indexes

Verify activity log indexes:

```bash
wrangler d1 execute vfa_gallery_db --command "
SELECT name, tbl_name, sql FROM sqlite_master
WHERE type='index' AND tbl_name='activity_log'
ORDER BY name;
" --local
```

Expected indexes:
- idx_activity_action
- idx_activity_user

### 7. Verify Session Indexes

Verify session-related indexes:

```bash
wrangler d1 execute vfa_gallery_db --command "
SELECT name, tbl_name, sql FROM sqlite_master
WHERE type='index' AND tbl_name='sessions'
ORDER BY name;
" --local
```

Expected indexes:
- idx_sessions_expires
- idx_sessions_user

### 8. Verify Group Indexes

Verify group-related indexes:

```bash
wrangler d1 execute vfa_gallery_db --command "
SELECT name, tbl_name, sql FROM sqlite_master
WHERE type='index' AND tbl_name IN ('groups', 'group_members')
ORDER BY tbl_name, name;
" --local
```

Expected indexes:
- idx_group_members_user (on group_members)
- idx_groups_slug (on groups)

### 9. Test Index Usage for Email Lookup

Verify that the email index is used for authentication queries:

```bash
wrangler d1 execute vfa_gallery_db --command "
EXPLAIN QUERY PLAN
SELECT id FROM users WHERE email = 'test@example.com';
" --local
```

Expected output should show a SEARCH using the idx_users_email index.

### 10. Test Index Usage for User Galleries

Verify that composite index is used for gallery lookups:

```bash
wrangler d1 execute vfa_gallery_db --command "
EXPLAIN QUERY PLAN
SELECT id FROM galleries WHERE user_id = 'user-123' AND slug = 'my-gallery';
" --local
```

Expected output should show a SEARCH using the idx_galleries_slug index.

### 11. Test Index Usage for Inbox Queries

Verify that composite index is used for message inbox queries:

```bash
wrangler d1 execute vfa_gallery_db --command "
EXPLAIN QUERY PLAN
SELECT id FROM messages WHERE recipient_id = 'user-456' ORDER BY created_at DESC;
" --local
```

Expected output should show a SEARCH using the idx_messages_recipient index.

### 12. Test Partial Index on Featured Artworks

Verify that the partial index for featured artworks works correctly:

```bash
wrangler d1 execute vfa_gallery_db --command "
EXPLAIN QUERY PLAN
SELECT id FROM artworks WHERE is_featured = 1;
" --local
```

Expected output should show a SEARCH using the idx_artworks_featured index.

### 13. Test Index Performance (Optional)

Create test data and compare query performance. First, create sample users:

```bash
wrangler d1 execute vfa_gallery_db --command "
INSERT INTO users (id, email, username, password_hash, status)
VALUES ('test-user-1', 'test1@example.com', 'testuser1', 'hash1', 'active');
" --local
```

Then measure a query time (your database client may support timing):

```bash
wrangler d1 execute vfa_gallery_db --command "
SELECT id FROM users WHERE email = 'test1@example.com';
" --local
```

Queries using indexes should return quickly even with large datasets.

### 14. Verify Index Integrity

Check that no indexes are corrupted:

```bash
wrangler d1 execute vfa_gallery_db --command "PRAGMA integrity_check;" --local
```

Expected output: `ok` (indicating database integrity is sound)

## Notes

### Index Design Decisions

- **Composite Indexes**: `idx_galleries_slug`, `idx_artworks_slug`, `idx_messages_recipient`, `idx_messages_sender`, and `idx_activity_*` use multiple columns to support complex WHERE clauses and ORDER BY operations
- **Partial Index**: `idx_artworks_featured` uses a WHERE clause to index only featured artworks, reducing index size for better performance
- **Unique Constraints**: Email and username are not covered by unique constraint indexes (handled separately in table definitions), but search indexes are provided for queries
- **No Index on Foreign Keys**: SQLite does not automatically index foreign key columns; consider adding them if you frequently query by foreign key

### Performance Considerations

- Indexes consume storage space; these 28 indexes are chosen for the most common query patterns
- INSERT, UPDATE, and DELETE operations will be slightly slower due to index maintenance, but SELECT queries will be significantly faster
- For tables with millions of rows, these indexes will provide the most benefit
- Monitor query performance in production and add additional indexes if specific queries are slow

### Maintenance

- Indexes may become fragmented over time; periodically run `VACUUM` to optimize storage
- Review slow query logs periodically and create additional indexes if needed
- Consider dropping unused indexes to reduce storage overhead

### Future Index Considerations

If you add new features, consider creating indexes for:
- Comments table: index on artwork_id, user_id, created_at
- Likes/favorites: index on user_id, artwork_id
- Search: full-text search indexes on artwork titles and descriptions
- Reporting: indexes on flagged_reason, reviewed_by, reviewed_at columns

## Index Summary

Total indexes created: 28

| Table | Index Count | Indexes |
|-------|-------------|---------|
| users | 3 | email, username, status |
| galleries | 2 | user, user+slug |
| collections | 1 | gallery |
| artworks | 4 | user, user+slug, category, featured (partial) |
| collection_artworks | 1 | artwork |
| messages | 3 | recipient+created_at, sender+created_at, status |
| activity_log | 2 | user+created_at, action+created_at |
| sessions | 2 | user, expires_at |
| groups | 1 | slug |
| group_members | 1 | user |

**Total: 28 indexes optimizing query performance across the entire schema.**
