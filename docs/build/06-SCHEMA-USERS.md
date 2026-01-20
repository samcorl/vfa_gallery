# Build 06: Create Users Table Schema

## Goal
Create the `users` table migration using CloudFlare D1 with wrangler. This is the foundational user entity table that all other entities reference.

## Spec Extract

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  website TEXT,
  phone TEXT,
  socials TEXT,  -- JSON string
  status TEXT DEFAULT 'pending',
  role TEXT DEFAULT 'user',
  gallery_limit INTEGER DEFAULT 500,
  collection_limit INTEGER DEFAULT 1000,
  artwork_limit INTEGER DEFAULT 5000,
  daily_upload_limit INTEGER DEFAULT 10,
  email_verified_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  last_login_at TEXT
);
```

## Key Implementation Notes

- **D1 SQLite Constraints**: D1 uses SQLite which doesn't support `JSONB`, so `socials` is stored as a TEXT field containing JSON strings
- **Timestamps**: All timestamps use TEXT fields with ISO 8601 format (handled by `CURRENT_TIMESTAMP` or application layer)
- **Booleans**: D1 uses INTEGER (0/1) for boolean fields, but this table only stores status via TEXT enum
- **Unique Fields**: Email and username both have UNIQUE constraints to prevent duplicates
- **Defaults**: Status defaults to 'pending', role to 'user', limits to specific values

## Prerequisites

**Must complete before this build:**
- Build 04: Wrangler CLI Setup and Configuration

**Reason:** D1 database must be initialized and wrangler must be configured to run migrations.

## Steps

### Step 1: Verify Wrangler Configuration
```bash
cd /Volumes/DataSSD/gitsrc/vfa_gallery
wrangler d1 info vfa-gallery
```

Expected output: Shows database ID and name. If error, complete Build 04 first.

### Step 2: Create Migration File
Create a new migration file with the naming convention `NNNN_description.sql`:

```bash
touch migrations/0001_create_users.sql
```

### Step 3: Add SQL to Migration File
Edit `/Volumes/DataSSD/gitsrc/vfa_gallery/migrations/0001_create_users.sql` and paste the complete SQL schema:

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  website TEXT,
  phone TEXT,
  socials TEXT,
  status TEXT DEFAULT 'pending',
  role TEXT DEFAULT 'user',
  gallery_limit INTEGER DEFAULT 500,
  collection_limit INTEGER DEFAULT 1000,
  artwork_limit INTEGER DEFAULT 5000,
  daily_upload_limit INTEGER DEFAULT 10,
  email_verified_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  last_login_at TEXT
);
```

### Step 4: Execute Migration
```bash
wrangler d1 execute vfa-gallery --file=migrations/0001_create_users.sql
```

Expected output: Success message indicating the migration was applied.

### Step 5: Verify Table Creation
```bash
wrangler d1 execute vfa-gallery --command="SELECT sql FROM sqlite_master WHERE type='table' AND name='users';"
```

Expected output: Shows the CREATE TABLE statement confirming the table exists.

## Files to Create/Modify

**Create:**
- `/Volumes/DataSSD/gitsrc/vfa_gallery/migrations/0001_create_users.sql`

## Verification

### Test 1: Table Exists
```bash
wrangler d1 execute vfa-gallery --command=".tables"
```
Confirm: `users` table appears in the output.

### Test 2: Schema Matches
```bash
wrangler d1 execute vfa-gallery --command="PRAGMA table_info(users);"
```
Confirm: All columns appear with correct types (TEXT, INTEGER).

### Test 3: Unique Constraints Work
```bash
wrangler d1 execute vfa-gallery --command="INSERT INTO users (id, email, username) VALUES ('1', 'test@example.com', 'testuser');"
wrangler d1 execute vfa-gallery --command="INSERT INTO users (id, email, username) VALUES ('2', 'test@example.com', 'otheruser');"
```
Confirm: Second insert fails with UNIQUE constraint error on email.

### Test 4: Defaults Work
```bash
wrangler d1 execute vfa-gallery --command="INSERT INTO users (id, email, username) VALUES ('3', 'default@example.com', 'defaultuser');"
wrangler d1 execute vfa-gallery --command="SELECT status, role FROM users WHERE id='3';"
```
Confirm: Returns `status='pending'` and `role='user'`.

### Test 5: Timestamps Work
```bash
wrangler d1 execute vfa-gallery --command="SELECT created_at FROM users WHERE id='3';"
```
Confirm: Returns ISO 8601 timestamp (e.g., `2026-01-18T...`).

## Rollback (If Needed)

To rollback this migration, create a new migration file:

```bash
touch migrations/0002_rollback_users.sql
```

Add this content:
```sql
DROP TABLE IF EXISTS users;
```

Then execute:
```bash
wrangler d1 execute vfa-gallery --file=migrations/0002_rollback_users.sql
```

## Success Criteria

- [ ] Migration file created at `/Volumes/DataSSD/gitsrc/vfa_gallery/migrations/0001_create_users.sql`
- [ ] Migration executes without errors
- [ ] `users` table appears in database
- [ ] All columns exist with correct types
- [ ] UNIQUE constraints enforced on email and username
- [ ] Default values applied correctly
- [ ] Timestamps generated automatically

## Next Steps

Once verified, proceed to Build 07 to create the groups and group_members tables, which reference the users table via foreign keys.
