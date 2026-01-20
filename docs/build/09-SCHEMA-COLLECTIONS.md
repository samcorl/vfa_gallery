# Build 09: Create Collections Table Schema

## Goal
Create the `collections` table migration using CloudFlare D1. Collections organize artworks within a gallery, providing another layer of curation and allowing users to group related pieces with different themes or presentations.

## Spec Extract

```sql
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
```

## Key Implementation Notes

- **Foreign Key**: References `galleries(id)` with `ON DELETE CASCADE` to clean up collections when gallery is deleted
- **Composite Unique Constraint**: `UNIQUE(gallery_id, slug)` ensures each gallery can't have duplicate collection slugs, but different galleries can share the same slug
- **Slug Field**: Used for URL-friendly collection identifiers (e.g., `/user/gallery/collection-slug`)
- **Boolean Field**: `is_default` uses INTEGER (0 or 1) to mark the primary collection in a gallery
- **Hero Image**: `hero_image_url` stores the collection's display image
- **Theme Support**: `theme_id` allows collections to have distinct visual themes
- **Status Field**: Controls collection visibility and behavior (active, archived, draft, etc.)

## Prerequisites

**Must complete before this build:**
- Build 08: Create Galleries Table Schema

**Reason:** The `collections.gallery_id` column references the `galleries` table. Foreign key constraints will fail if the galleries table doesn't exist first.

## Steps

### Step 1: Verify Galleries Table Exists
```bash
cd /Volumes/DataSSD/gitsrc/vfa_gallery
wrangler d1 execute vfa-gallery --command="SELECT name FROM sqlite_master WHERE type='table' AND name='galleries';"
```

Expected output: Shows `galleries` table name. If no output, complete Build 08 first.

### Step 2: Create Migration File
Create a new migration file with the next sequence number:

```bash
touch migrations/0004_create_collections.sql
```

### Step 3: Add SQL to Migration File
Edit `/Volumes/DataSSD/gitsrc/vfa_gallery/migrations/0004_create_collections.sql` and paste the complete SQL schema:

```sql
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
```

### Step 4: Execute Migration
```bash
wrangler d1 execute vfa-gallery --file=migrations/0004_create_collections.sql
```

Expected output: Success message indicating the table was created.

### Step 5: Verify Table Creation
```bash
wrangler d1 execute vfa-gallery --command=".tables"
```

Expected output: Shows `collections` table in the list.

## Files to Create/Modify

**Create:**
- `/Volumes/DataSSD/gitsrc/vfa_gallery/migrations/0004_create_collections.sql`

## Verification

### Test 1: Table Exists
```bash
wrangler d1 execute vfa-gallery --command="SELECT name FROM sqlite_master WHERE type='table' AND name='collections';"
```
Confirm: Returns `collections` table name.

### Test 2: Schema Matches
```bash
wrangler d1 execute vfa-gallery --command="PRAGMA table_info(collections);"
```
Confirm: All columns present: id, gallery_id, slug, name, description, hero_image_url, theme_id, is_default, status, created_at, updated_at.

### Test 3: Column Types Correct
```bash
wrangler d1 execute vfa-gallery --command="PRAGMA table_info(collections);"
```
Confirm:
- `id`, `gallery_id`, `slug`, `name`, `description`, `hero_image_url`, `theme_id`, `status`, `created_at`, `updated_at` are TEXT
- `is_default` is INTEGER

### Test 4: Setup Test Data
Create a test user and gallery to reference:
```bash
wrangler d1 execute vfa-gallery --command="INSERT INTO users (id, email, username) VALUES ('user-1', 'collections@example.com', 'collectionuser');"
wrangler d1 execute vfa-gallery --command="INSERT INTO galleries (id, user_id, slug, name) VALUES ('gal-1', 'user-1', 'main', 'Main Gallery');"
```

### Test 5: Foreign Key Constraint
Create a collection with the gallery from Test 4:
```bash
wrangler d1 execute vfa-gallery --command="INSERT INTO collections (id, gallery_id, slug, name) VALUES ('col-1', 'gal-1', 'featured', 'Featured Works');"
```
Confirm: Insert succeeds.

### Test 6: Foreign Key Constraint Validation
Try creating a collection with a non-existent gallery:
```bash
wrangler d1 execute vfa-gallery --command="INSERT INTO collections (id, gallery_id, slug, name) VALUES ('col-2', 'nonexistent-gallery', 'invalid', 'Invalid Collection');"
```
Confirm: Insert fails with foreign key constraint error (or succeeds if FK constraints not enforced, which is acceptable in D1).

### Test 7: Composite Unique Constraint (Same Gallery, Different Slug)
```bash
wrangler d1 execute vfa-gallery --command="INSERT INTO collections (id, gallery_id, slug, name) VALUES ('col-2', 'gal-1', 'secondary', 'Secondary Works');"
```
Confirm: Insert succeeds (same gallery, different slug is allowed).

### Test 8: Composite Unique Constraint (Different Gallery, Same Slug)
Create another gallery and collection with the same slug:
```bash
wrangler d1 execute vfa-gallery --command="INSERT INTO galleries (id, user_id, slug, name) VALUES ('gal-2', 'user-1', 'secondary', 'Secondary Gallery');"
wrangler d1 execute vfa-gallery --command="INSERT INTO collections (id, gallery_id, slug, name) VALUES ('col-3', 'gal-2', 'featured', 'Featured Works for Gallery 2');"
```
Confirm: Insert succeeds (different galleries can have collections with the same slug).

### Test 9: Composite Unique Constraint (Same Gallery, Same Slug)
Try creating another collection for gallery-1 with slug 'featured':
```bash
wrangler d1 execute vfa-gallery --command="INSERT INTO collections (id, gallery_id, slug, name) VALUES ('col-4', 'gal-1', 'featured', 'Duplicate Featured Works');"
```
Confirm: Insert fails with UNIQUE constraint error.

### Test 10: Default Values
Check the collection created in Test 5:
```bash
wrangler d1 execute vfa-gallery --command="SELECT is_default, status, created_at FROM collections WHERE id='col-1';"
```
Confirm: Returns `is_default=0`, `status='active'`, and a timestamp in `created_at`.

### Test 11: Boolean Field (is_default)
Update the collection to be the default:
```bash
wrangler d1 execute vfa-gallery --command="UPDATE collections SET is_default=1 WHERE id='col-1';"
wrangler d1 execute vfa-gallery --command="SELECT is_default FROM collections WHERE id='col-1';"
```
Confirm: Returns `is_default=1`.

### Test 12: Cascade Delete - Gallery Deletion
Delete the gallery from Test 4:
```bash
wrangler d1 execute vfa-gallery --command="DELETE FROM galleries WHERE id='gal-1';"
wrangler d1 execute vfa-gallery --command="SELECT COUNT(*) FROM collections WHERE gallery_id='gal-1';"
```
Confirm: All collections for that gallery are deleted (count returns 0).

### Test 13: Full Collection Details
Create a collection with complete information:
```bash
wrangler d1 execute vfa-gallery --command="INSERT INTO collections (id, gallery_id, slug, name, description, hero_image_url, theme_id, status) VALUES ('col-5', 'gal-2', 'paintings', 'Oil Paintings', 'A collection of original oil paintings', 'https://example.com/hero.jpg', 'theme-classic', 'active');"
wrangler d1 execute vfa-gallery --command="SELECT description, hero_image_url, theme_id FROM collections WHERE id='col-5';"
```
Confirm: All fields are stored and retrieved correctly.

### Test 14: Status Field Variations
Update the status to archived:
```bash
wrangler d1 execute vfa-gallery --command="UPDATE collections SET status='archived' WHERE id='col-5';"
wrangler d1 execute vfa-gallery --command="SELECT status FROM collections WHERE id='col-5';"
```
Confirm: Returns `status='archived'`.

### Test 15: Query Collections by Gallery
Query all collections for a gallery:
```bash
wrangler d1 execute vfa-gallery --command="SELECT id, slug, name FROM collections WHERE gallery_id='gal-2' ORDER BY created_at;"
```
Confirm: Returns all collections for that gallery.

## Rollback (If Needed)

To rollback this migration, create a new migration file:

```bash
touch migrations/0005_rollback_collections.sql
```

Add this content:
```sql
DROP TABLE IF EXISTS collections;
```

Then execute:
```bash
wrangler d1 execute vfa-gallery --file=migrations/0005_rollback_collections.sql
```

## Success Criteria

- [ ] Migration file created at `/Volumes/DataSSD/gitsrc/vfa_gallery/migrations/0004_create_collections.sql`
- [ ] Migration executes without errors
- [ ] `collections` table exists with all columns
- [ ] Foreign key reference to `galleries` table is correct
- [ ] Cascade delete works when gallery is deleted
- [ ] Composite UNIQUE constraint on (gallery_id, slug) is enforced
- [ ] Same slug can be used by different galleries
- [ ] Default values (is_default=0, status='active') are applied correctly
- [ ] Boolean field (is_default) accepts 0 and 1 values
- [ ] All optional fields (description, hero_image_url, theme_id) can store values

## Next Steps

Once verified, proceed to Build 10 to create the artworks and collection_artworks tables, which complete the core data model for VFA.gallery Phase 2.
