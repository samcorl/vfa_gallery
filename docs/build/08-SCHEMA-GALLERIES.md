# Build 08: Create Galleries Table Schema

## Goal
Create the `galleries` table migration using CloudFlare D1. Galleries are the primary container for artworks owned by a user, enabling users to organize multiple named galleries with different themes.

## Spec Extract

```sql
CREATE TABLE galleries (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  welcome_message TEXT,
  theme_id TEXT,
  is_default INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, slug)
);
```

## Key Implementation Notes

- **Foreign Key**: References `users(id)` with `ON DELETE CASCADE` to clean up galleries when user is deleted
- **Boolean Field**: `is_default` uses INTEGER (0 or 1) as D1 doesn't support native BOOLEAN
- **Composite Unique Constraint**: `UNIQUE(user_id, slug)` ensures each user can't have duplicate gallery slugs, but different users can share the same slug
- **Slug Field**: Used for URL-friendly gallery identifiers (e.g., `/user/gallery-slug`)
- **Theme Support**: `theme_id` is a TEXT field that references a theme record (allows for future theme management)
- **Status Field**: Text-based status to control gallery visibility and behavior (active, archived, draft, etc.)

## Prerequisites

**Must complete before this build:**
- Build 06: Create Users Table Schema

**Reason:** The `galleries.user_id` column references the `users` table. Foreign key constraints will fail if the users table doesn't exist first.

## Steps

### Step 1: Verify Users Table Exists
```bash
cd /Volumes/DataSSD/gitsrc/vfa_gallery
wrangler d1 execute vfa-gallery --command="SELECT name FROM sqlite_master WHERE type='table' AND name='users';"
```

Expected output: Shows `users` table name. If no output, complete Build 06 first.

### Step 2: Create Migration File
Create a new migration file with the next sequence number:

```bash
touch migrations/0003_create_galleries.sql
```

### Step 3: Add SQL to Migration File
Edit `/Volumes/DataSSD/gitsrc/vfa_gallery/migrations/0003_create_galleries.sql` and paste the complete SQL schema:

```sql
CREATE TABLE galleries (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  welcome_message TEXT,
  theme_id TEXT,
  is_default INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, slug)
);
```

### Step 4: Execute Migration
```bash
wrangler d1 execute vfa-gallery --file=migrations/0003_create_galleries.sql
```

Expected output: Success message indicating the table was created.

### Step 5: Verify Table Creation
```bash
wrangler d1 execute vfa-gallery --command=".tables"
```

Expected output: Shows `galleries` table in the list.

## Files to Create/Modify

**Create:**
- `/Volumes/DataSSD/gitsrc/vfa_gallery/migrations/0003_create_galleries.sql`

## Verification

### Test 1: Table Exists
```bash
wrangler d1 execute vfa-gallery --command="SELECT name FROM sqlite_master WHERE type='table' AND name='galleries';"
```
Confirm: Returns `galleries` table name.

### Test 2: Schema Matches
```bash
wrangler d1 execute vfa-gallery --command="PRAGMA table_info(galleries);"
```
Confirm: All columns present: id, user_id, slug, name, description, welcome_message, theme_id, is_default, status, created_at, updated_at.

### Test 3: Column Types Correct
```bash
wrangler d1 execute vfa-gallery --command="PRAGMA table_info(galleries);"
```
Confirm:
- `id`, `user_id`, `slug`, `name`, `description`, `welcome_message`, `theme_id`, `status`, `created_at`, `updated_at` are TEXT
- `is_default` is INTEGER

### Test 4: Foreign Key Constraint
First, create a test user:
```bash
wrangler d1 execute vfa-gallery --command="INSERT INTO users (id, email, username) VALUES ('user-1', 'gallery@example.com', 'galleryuser');"
```

Create a gallery with this user:
```bash
wrangler d1 execute vfa-gallery --command="INSERT INTO galleries (id, user_id, slug, name) VALUES ('gal-1', 'user-1', 'main', 'Main Gallery');"
```
Confirm: Insert succeeds.

### Test 5: Composite Unique Constraint (Same User, Different Slug)
```bash
wrangler d1 execute vfa-gallery --command="INSERT INTO galleries (id, user_id, slug, name) VALUES ('gal-2', 'user-1', 'secondary', 'Secondary Gallery');"
```
Confirm: Insert succeeds (same user, different slug is allowed).

### Test 6: Composite Unique Constraint (Different User, Same Slug)
Create another test user:
```bash
wrangler d1 execute vfa-gallery --command="INSERT INTO users (id, email, username) VALUES ('user-2', 'another@example.com', 'anotheruser');"
```

Create a gallery with the same slug but different user:
```bash
wrangler d1 execute vfa-gallery --command="INSERT INTO galleries (id, user_id, slug, name) VALUES ('gal-3', 'user-2', 'main', 'Another Main Gallery');"
```
Confirm: Insert succeeds (different users can have galleries with the same slug).

### Test 7: Composite Unique Constraint (Same User, Same Slug)
Try creating another gallery for user-1 with slug 'main':
```bash
wrangler d1 execute vfa-gallery --command="INSERT INTO galleries (id, user_id, slug, name) VALUES ('gal-4', 'user-1', 'main', 'Duplicate Main Gallery');"
```
Confirm: Insert fails with UNIQUE constraint error.

### Test 8: Default Values
Check the gallery created in Test 4:
```bash
wrangler d1 execute vfa-gallery --command="SELECT is_default, status, created_at FROM galleries WHERE id='gal-1';"
```
Confirm: Returns `is_default=0`, `status='active'`, and a timestamp in `created_at`.

### Test 9: Boolean Field (is_default)
Update the gallery to be the default:
```bash
wrangler d1 execute vfa-gallery --command="UPDATE galleries SET is_default=1 WHERE id='gal-1';"
wrangler d1 execute vfa-gallery --command="SELECT is_default FROM galleries WHERE id='gal-1';"
```
Confirm: Returns `is_default=1`.

### Test 10: Cascade Delete
Delete the user:
```bash
wrangler d1 execute vfa-gallery --command="DELETE FROM users WHERE id='user-1';"
wrangler d1 execute vfa-gallery --command="SELECT COUNT(*) FROM galleries WHERE user_id='user-1';"
```
Confirm: All galleries for that user are deleted (count returns 0).

### Test 11: Theme and Description Fields
Create a gallery with full details:
```bash
wrangler d1 execute vfa-gallery --command="INSERT INTO galleries (id, user_id, slug, name, description, welcome_message, theme_id, status) VALUES ('gal-5', 'user-2', 'portfolio', 'My Portfolio', 'A curated collection of my work', 'Welcome to my gallery!', 'theme-dark', 'active');"
wrangler d1 execute vfa-gallery --command="SELECT description, welcome_message, theme_id FROM galleries WHERE id='gal-5';"
```
Confirm: All fields are stored and retrieved correctly.

### Test 12: Status Field Variations
Update the status to archived:
```bash
wrangler d1 execute vfa-gallery --command="UPDATE galleries SET status='archived' WHERE id='gal-5';"
wrangler d1 execute vfa-gallery --command="SELECT status FROM galleries WHERE id='gal-5';"
```
Confirm: Returns `status='archived'`.

## Rollback (If Needed)

To rollback this migration, create a new migration file:

```bash
touch migrations/0004_rollback_galleries.sql
```

Add this content:
```sql
DROP TABLE IF EXISTS galleries;
```

Then execute:
```bash
wrangler d1 execute vfa-gallery --file=migrations/0004_rollback_galleries.sql
```

## Success Criteria

- [ ] Migration file created at `/Volumes/DataSSD/gitsrc/vfa_gallery/migrations/0003_create_galleries.sql`
- [ ] Migration executes without errors
- [ ] `galleries` table exists with all columns
- [ ] Foreign key reference to `users` table is correct
- [ ] Cascade delete works when user is deleted
- [ ] Composite UNIQUE constraint on (user_id, slug) is enforced
- [ ] Same slug can be used by different users
- [ ] Default values (is_default=0, status='active') are applied correctly
- [ ] Boolean field (is_default) accepts 0 and 1 values

## Next Steps

Once verified, proceed to Build 09 to create the collections table, which references the galleries table for organization.
