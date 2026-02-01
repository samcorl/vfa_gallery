# Build 10: Create Artworks and Collection Artworks Tables Schema

## Goal
Create the `artworks` and `collection_artworks` tables migrations using CloudFlare D1. These tables form the core content entities of VFA.gallery, enabling users to store artwork metadata and organize pieces into collections.

## Spec Extract

```sql
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
```

## Key Implementation Notes

- **Artworks Table**:
  - Foreign key to `users(id)` for ownership tracking
  - Composite unique constraint on (user_id, slug) ensures unique artwork slugs per user
  - Multiple URL fields for different image sizes: original_url, display_url, thumbnail_url, icon_url
  - Tags stored as TEXT (JSON string) since D1 doesn't support JSONB
  - is_featured uses INTEGER (0/1) for boolean semantics
  - status controls artwork visibility and processing state

- **Collection Artworks Table**:
  - Junction table with foreign keys to both `collections` and `artworks`
  - Composite primary key (collection_id, artwork_id) prevents duplicate collection memberships
  - position field allows explicit ordering of artworks within collections
  - Cascade deletes ensure cleanup when collection or artwork is deleted

- **Image Storage Strategy**: Four URL fields accommodate different display scenarios (full resolution, web-optimized, thumbnail, favicon-sized)

## Prerequisites

**Must complete before this build:**
- Build 06: Create Users Table Schema
- Build 09: Create Collections Table Schema

**Reason:**
- `artworks.user_id` references the `users` table
- `collection_artworks.collection_id` references the `collections` table
- `collection_artworks.artwork_id` references the `artworks` table
All parent tables must exist before this migration runs.

## Steps

### Step 1: Verify Prerequisite Tables Exist
```bash
cd /Volumes/DataSSD/gitsrc/vfa_gallery
wrangler d1 execute site --command="SELECT name FROM sqlite_master WHERE type='table' AND name IN ('users', 'collections');"
```

Expected output: Shows both `users` and `collections` table names. If either is missing, complete the prerequisite builds first.

### Step 2: Create Migration File
Create a new migration file with the next sequence number:

```bash
touch migrations/0005_create_artworks.sql
```

### Step 3: Add SQL to Migration File
Edit `/Volumes/DataSSD/gitsrc/vfa_gallery/migrations/0005_create_artworks.sql` and paste the complete SQL schema:

```sql
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
```

### Step 4: Execute Migration
```bash
wrangler d1 execute site --file=migrations/0005_create_artworks.sql
```

Expected output: Success message indicating both tables were created.

### Step 5: Verify Table Creation
```bash
wrangler d1 execute site --command=".tables"
```

Expected output: Shows both `artworks` and `collection_artworks` tables.

## Files to Create/Modify

**Create:**
- `/Volumes/DataSSD/gitsrc/vfa_gallery/migrations/0005_create_artworks.sql`

## Verification

### Test 1: Tables Exist
```bash
wrangler d1 execute site --command="SELECT name FROM sqlite_master WHERE type='table' AND name IN ('artworks', 'collection_artworks');"
```
Confirm: Returns both table names.

### Test 2: Artworks Schema Matches
```bash
wrangler d1 execute site --command="PRAGMA table_info(artworks);"
```
Confirm: All columns present: id, user_id, slug, title, description, materials, dimensions, created_date, category, tags, original_url, display_url, thumbnail_url, icon_url, theme_id, status, is_featured, created_at, updated_at.

### Test 3: Collection Artworks Schema Matches
```bash
wrangler d1 execute site --command="PRAGMA table_info(collection_artworks);"
```
Confirm: All columns present: collection_id, artwork_id, position, added_at.

### Test 4: Setup Test Data
Create test user, gallery, and collection:
```bash
wrangler d1 execute site --command="INSERT INTO users (id, email, username) VALUES ('user-1', 'artwork@example.com', 'artworkuser');"
wrangler d1 execute site --command="INSERT INTO galleries (id, user_id, slug, name) VALUES ('gal-1', 'user-1', 'main', 'Main Gallery');"
wrangler d1 execute site --command="INSERT INTO collections (id, gallery_id, slug, name) VALUES ('col-1', 'gal-1', 'paintings', 'Paintings');"
```

### Test 5: Create Artwork with All URLs
```bash
wrangler d1 execute site --command="INSERT INTO artworks (id, user_id, slug, title, original_url, display_url, thumbnail_url, icon_url) VALUES ('art-1', 'user-1', 'sunset', 'Sunset Over Mountains', 'https://example.com/original.jpg', 'https://example.com/display.jpg', 'https://example.com/thumb.jpg', 'https://example.com/icon.jpg');"
```
Confirm: Insert succeeds.

### Test 6: Verify Required URL Fields
Try creating an artwork without one of the required URL fields:
```bash
wrangler d1 execute site --command="INSERT INTO artworks (id, user_id, slug, title, original_url, display_url, thumbnail_url) VALUES ('art-2', 'user-1', 'incomplete', 'Incomplete Artwork', 'https://example.com/orig.jpg', 'https://example.com/disp.jpg', 'https://example.com/th.jpg');"
```
Confirm: Insert fails due to NOT NULL constraint on icon_url.

### Test 7: Composite Unique Constraint (Same User, Different Slug)
```bash
wrangler d1 execute site --command="INSERT INTO artworks (id, user_id, slug, title, original_url, display_url, thumbnail_url, icon_url) VALUES ('art-2', 'user-1', 'moonlight', 'Moonlight Sonata', 'https://example.com/orig.jpg', 'https://example.com/disp.jpg', 'https://example.com/th.jpg', 'https://example.com/ic.jpg');"
```
Confirm: Insert succeeds (same user, different slug is allowed).

### Test 8: Composite Unique Constraint (Different User, Same Slug)
Create another user:
```bash
wrangler d1 execute site --command="INSERT INTO users (id, email, username) VALUES ('user-2', 'another@example.com', 'anotheruser');"
wrangler d1 execute site --command="INSERT INTO artworks (id, user_id, slug, title, original_url, display_url, thumbnail_url, icon_url) VALUES ('art-3', 'user-2', 'sunset', 'My Sunset', 'https://example.com/o.jpg', 'https://example.com/d.jpg', 'https://example.com/t.jpg', 'https://example.com/i.jpg');"
```
Confirm: Insert succeeds (different users can have artworks with the same slug).

### Test 9: Composite Unique Constraint (Same User, Same Slug)
Try creating another artwork for user-1 with slug 'sunset':
```bash
wrangler d1 execute site --command="INSERT INTO artworks (id, user_id, slug, title, original_url, display_url, thumbnail_url, icon_url) VALUES ('art-4', 'user-1', 'sunset', 'Another Sunset', 'https://example.com/o.jpg', 'https://example.com/d.jpg', 'https://example.com/t.jpg', 'https://example.com/i.jpg');"
```
Confirm: Insert fails with UNIQUE constraint error.

### Test 10: Default Values in Artworks
Check the artwork created in Test 5:
```bash
wrangler d1 execute site --command="SELECT status, is_featured, created_at FROM artworks WHERE id='art-1';"
```
Confirm: Returns `status='active'`, `is_featured=0`, and a timestamp in `created_at`.

### Test 11: Optional Metadata Fields
Create an artwork with full metadata:
```bash
wrangler d1 execute site --command="INSERT INTO artworks (id, user_id, slug, title, description, materials, dimensions, created_date, category, tags, original_url, display_url, thumbnail_url, icon_url, theme_id) VALUES ('art-5', 'user-1', 'sculpture', 'Bronze Sculpture', 'A beautiful abstract sculpture', 'Bronze, Steel', '2ft x 3ft x 1.5ft', '2024-06-15', 'sculpture', '[\"abstract\", \"metal\", \"modern\"]', 'https://example.com/o.jpg', 'https://example.com/d.jpg', 'https://example.com/t.jpg', 'https://example.com/i.jpg', 'theme-modern');"
wrangler d1 execute site --command="SELECT description, materials, dimensions, category, tags FROM artworks WHERE id='art-5';"
```
Confirm: All fields stored and retrieved correctly.

### Test 12: Featured Artwork
Update an artwork to be featured:
```bash
wrangler d1 execute site --command="UPDATE artworks SET is_featured=1 WHERE id='art-1';"
wrangler d1 execute site --command="SELECT is_featured FROM artworks WHERE id='art-1';"
```
Confirm: Returns `is_featured=1`.

### Test 13: Add Artwork to Collection
Add the artwork from Test 5 to the collection:
```bash
wrangler d1 execute site --command="INSERT INTO collection_artworks (collection_id, artwork_id, position) VALUES ('col-1', 'art-1', 1);"
```
Confirm: Insert succeeds.

### Test 14: Collection Artworks Unique Constraint
Try adding the same artwork to the same collection again:
```bash
wrangler d1 execute site --command="INSERT INTO collection_artworks (collection_id, artwork_id, position) VALUES ('col-1', 'art-1', 2);"
```
Confirm: Insert fails with PRIMARY KEY constraint error.

### Test 15: Add Multiple Artworks to Collection
```bash
wrangler d1 execute site --command="INSERT INTO collection_artworks (collection_id, artwork_id, position) VALUES ('col-1', 'art-2', 2);"
wrangler d1 execute site --command="INSERT INTO collection_artworks (collection_id, artwork_id, position) VALUES ('col-1', 'art-5', 3);"
wrangler d1 execute site --command="SELECT COUNT(*) FROM collection_artworks WHERE collection_id='col-1';"
```
Confirm: Count returns 3.

### Test 16: Position Ordering
Query artworks in a collection ordered by position:
```bash
wrangler d1 execute site --command="SELECT artwork_id, position FROM collection_artworks WHERE collection_id='col-1' ORDER BY position;"
```
Confirm: Returns artworks in order (1, 2, 3).

### Test 17: Cascade Delete - User Deletion
Delete user-1:
```bash
wrangler d1 execute site --command="DELETE FROM users WHERE id='user-1';"
wrangler d1 execute site --command="SELECT COUNT(*) FROM artworks WHERE user_id='user-1';"
```
Confirm: All artworks for that user are deleted (count returns 0).

### Test 18: Cascade Delete - Collection Deletion
Create new test data:
```bash
wrangler d1 execute site --command="INSERT INTO users (id, email, username) VALUES ('user-3', 'cascade@example.com', 'cascadeuser');"
wrangler d1 execute site --command="INSERT INTO galleries (id, user_id, slug, name) VALUES ('gal-2', 'user-3', 'test', 'Test Gallery');"
wrangler d1 execute site --command="INSERT INTO collections (id, gallery_id, slug, name) VALUES ('col-2', 'gal-2', 'test', 'Test Collection');"
wrangler d1 execute site --command="INSERT INTO artworks (id, user_id, slug, title, original_url, display_url, thumbnail_url, icon_url) VALUES ('art-6', 'user-3', 'test', 'Test Art', 'https://example.com/o.jpg', 'https://example.com/d.jpg', 'https://example.com/t.jpg', 'https://example.com/i.jpg');"
wrangler d1 execute site --command="INSERT INTO collection_artworks (collection_id, artwork_id, position) VALUES ('col-2', 'art-6', 1);"
```

Delete the collection:
```bash
wrangler d1 execute site --command="DELETE FROM collections WHERE id='col-2';"
wrangler d1 execute site --command="SELECT COUNT(*) FROM collection_artworks WHERE collection_id='col-2';"
```
Confirm: Collection artwork records are deleted (count returns 0).

### Test 19: Cascade Delete - Artwork Deletion
Try deleting artwork art-6 (which may already be deleted from Test 18):
```bash
wrangler d1 execute site --command="INSERT INTO collection_artworks (collection_id, artwork_id, position) VALUES ('col-2', 'art-6', 1);"
wrangler d1 execute site --command="DELETE FROM artworks WHERE id='art-6';"
wrangler d1 execute site --command="SELECT COUNT(*) FROM collection_artworks WHERE artwork_id='art-6';"
```
Confirm: Collection artwork records are deleted (count returns 0).

### Test 20: Default added_at Timestamp
Query collection_artworks to verify timestamp:
```bash
wrangler d1 execute site --command="INSERT INTO users (id, email, username) VALUES ('user-4', 'timestamp@example.com', 'timestampuser');"
wrangler d1 execute site --command="INSERT INTO galleries (id, user_id, slug, name) VALUES ('gal-3', 'user-4', 'ts', 'Timestamp Gallery');"
wrangler d1 execute site --command="INSERT INTO collections (id, gallery_id, slug, name) VALUES ('col-3', 'gal-3', 'ts', 'Timestamp Collection');"
wrangler d1 execute site --command="INSERT INTO artworks (id, user_id, slug, title, original_url, display_url, thumbnail_url, icon_url) VALUES ('art-7', 'user-4', 'ts', 'Timestamp Art', 'https://example.com/o.jpg', 'https://example.com/d.jpg', 'https://example.com/t.jpg', 'https://example.com/i.jpg');"
wrangler d1 execute site --command="INSERT INTO collection_artworks (collection_id, artwork_id, position) VALUES ('col-3', 'art-7', 1);"
wrangler d1 execute site --command="SELECT added_at FROM collection_artworks WHERE collection_id='col-3' AND artwork_id='art-7';"
```
Confirm: Returns a timestamp in `added_at`.

## Rollback (If Needed)

To rollback this migration, create a new migration file:

```bash
touch migrations/0006_rollback_artworks.sql
```

Add this content:
```sql
DROP TABLE IF EXISTS collection_artworks;
DROP TABLE IF EXISTS artworks;
```

Then execute:
```bash
wrangler d1 execute site --file=migrations/0006_rollback_artworks.sql
```

## Success Criteria

- [ ] Migration file created at `/Volumes/DataSSD/gitsrc/vfa_gallery/migrations/0005_create_artworks.sql`
- [ ] Migration executes without errors
- [ ] `artworks` table exists with all columns
- [ ] `collection_artworks` table exists with all columns
- [ ] Foreign key references are correct
- [ ] Composite UNIQUE constraint on `artworks(user_id, slug)` is enforced
- [ ] Composite PRIMARY KEY on `collection_artworks(collection_id, artwork_id)` is enforced
- [ ] Cascade deletes work for user, collection, and artwork deletions
- [ ] Default values (status='active', is_featured=0) are applied correctly
- [ ] All URL fields are required and stored correctly
- [ ] Optional metadata fields (description, materials, dimensions, category, tags) can store values
- [ ] Position field orders artworks within collections
- [ ] Timestamps (created_at, updated_at, added_at) are generated automatically

## Next Steps

Phase 2 Database Schema (first half) is complete. You have successfully created the foundational data model with:
- Users (Build 06)
- Groups and Group Members (Build 07)
- Galleries (Build 08)
- Collections (Build 09)
- Artworks and Collection Artworks (Build 10)

Next phase (second half) will include additional schema for themes, analytics, and relational data structures as defined in the full technical specification.
