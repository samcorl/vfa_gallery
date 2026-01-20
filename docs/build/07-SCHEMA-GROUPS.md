# Build 07: Create Groups and Group Members Tables Schema

## Goal
Create the `groups` and `group_members` tables migrations using CloudFlare D1. These tables enable multi-user group functionality where users can belong to artist groups, studios, or galleries.

## Spec Extract

```sql
CREATE TABLE groups (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  website TEXT,
  email TEXT,
  phone TEXT,
  socials TEXT,
  logo_url TEXT,
  created_by TEXT REFERENCES users(id),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE group_members (
  group_id TEXT REFERENCES groups(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member',
  joined_at TEXT DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (group_id, user_id)
);
```

## Key Implementation Notes

- **Foreign Keys**: Both tables reference `users(id)`. Group creation requires a user exists.
- **Cascade Deletes**: `ON DELETE CASCADE` ensures member records are deleted when a group or user is deleted
- **Composite Primary Key**: `group_members` uses a composite key of (group_id, user_id) to prevent duplicate memberships
- **Slug Field**: Groups have unique slugs for URL-friendly identifiers (e.g., `/group/my-studio`)
- **JSON Storage**: `socials` stored as TEXT (JSON string) as D1 doesn't support JSONB
- **Role Flexibility**: Group member roles can vary (owner, manager, member, etc.) stored as TEXT

## Prerequisites

**Must complete before this build:**
- Build 06: Create Users Table Schema

**Reason:** Both `groups.created_by` and `group_members.user_id` reference the `users` table. Foreign key constraints will fail if the users table doesn't exist first.

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
touch migrations/0002_create_groups.sql
```

### Step 3: Add SQL to Migration File
Edit `/Volumes/DataSSD/gitsrc/vfa_gallery/migrations/0002_create_groups.sql` and paste the complete SQL schema:

```sql
CREATE TABLE groups (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  website TEXT,
  email TEXT,
  phone TEXT,
  socials TEXT,
  logo_url TEXT,
  created_by TEXT REFERENCES users(id),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE group_members (
  group_id TEXT REFERENCES groups(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member',
  joined_at TEXT DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (group_id, user_id)
);
```

### Step 4: Execute Migration
```bash
wrangler d1 execute vfa-gallery --file=migrations/0002_create_groups.sql
```

Expected output: Success message indicating both tables were created.

### Step 5: Verify Table Creation
```bash
wrangler d1 execute vfa-gallery --command=".tables"
```

Expected output: Now shows both `groups` and `group_members` tables.

## Files to Create/Modify

**Create:**
- `/Volumes/DataSSD/gitsrc/vfa_gallery/migrations/0002_create_groups.sql`

## Verification

### Test 1: Tables Exist
```bash
wrangler d1 execute vfa-gallery --command="SELECT name FROM sqlite_master WHERE type='table' AND name IN ('groups', 'group_members');"
```
Confirm: Returns both table names.

### Test 2: Groups Schema Matches
```bash
wrangler d1 execute vfa-gallery --command="PRAGMA table_info(groups);"
```
Confirm: All columns present: id, slug, name, website, email, phone, socials, logo_url, created_by, created_at, updated_at.

### Test 3: Group Members Schema Matches
```bash
wrangler d1 execute vfa-gallery --command="PRAGMA table_info(group_members);"
```
Confirm: All columns present: group_id, user_id, role, joined_at.

### Test 4: Foreign Key Constraint (created_by)
```bash
wrangler d1 execute vfa-gallery --command="INSERT INTO groups (id, slug, name, created_by) VALUES ('grp-1', 'test-group', 'Test Group', 'nonexistent-user');"
```
Confirm: Insert fails with foreign key constraint error (or succeeds if FK constraints are not enforced by default in D1).

Note: D1 may require enabling foreign key constraints. If the insert succeeds, this is expected behavior in some SQLite configurations.

### Test 5: Foreign Key Constraint with Valid User
First, create a test user:
```bash
wrangler d1 execute vfa-gallery --command="INSERT INTO users (id, email, username) VALUES ('user-1', 'creator@example.com', 'creator');"
```

Then create a group with this user:
```bash
wrangler d1 execute vfa-gallery --command="INSERT INTO groups (id, slug, name, created_by) VALUES ('grp-1', 'test-group', 'Test Group', 'user-1');"
```
Confirm: Insert succeeds.

### Test 6: Group Member Unique Constraint
Add a member to the group:
```bash
wrangler d1 execute vfa-gallery --command="INSERT INTO group_members (group_id, user_id) VALUES ('grp-1', 'user-1');"
```

Try adding the same member again:
```bash
wrangler d1 execute vfa-gallery --command="INSERT INTO group_members (group_id, user_id) VALUES ('grp-1', 'user-1');"
```
Confirm: Second insert fails with PRIMARY KEY constraint error.

### Test 7: Group Member Defaults
Check the inserted member:
```bash
wrangler d1 execute vfa-gallery --command="SELECT role, joined_at FROM group_members WHERE group_id='grp-1' AND user_id='user-1';"
```
Confirm: Returns `role='member'` and a timestamp in `joined_at`.

### Test 8: Cascade Delete - User Deletion
```bash
wrangler d1 execute vfa-gallery --command="DELETE FROM users WHERE id='user-1';"
wrangler d1 execute vfa-gallery --command="SELECT COUNT(*) FROM group_members WHERE user_id='user-1';"
```
Confirm: Member records are deleted (count returns 0).

### Test 9: Cascade Delete - Group Deletion
Create another group and add members:
```bash
wrangler d1 execute vfa-gallery --command="INSERT INTO users (id, email, username) VALUES ('user-2', 'another@example.com', 'another');"
wrangler d1 execute vfa-gallery --command="INSERT INTO groups (id, slug, name, created_by) VALUES ('grp-2', 'another-group', 'Another Group', 'user-2');"
wrangler d1 execute vfa-gallery --command="INSERT INTO group_members (group_id, user_id) VALUES ('grp-2', 'user-2');"
```

Delete the group:
```bash
wrangler d1 execute vfa-gallery --command="DELETE FROM groups WHERE id='grp-2';"
wrangler d1 execute vfa-gallery --command="SELECT COUNT(*) FROM group_members WHERE group_id='grp-2';"
```
Confirm: Member records are deleted (count returns 0).

### Test 10: Slug Uniqueness
Try inserting two groups with the same slug:
```bash
wrangler d1 execute vfa-gallery --command="INSERT INTO groups (id, slug, name) VALUES ('grp-3', 'unique-slug', 'First Group');"
wrangler d1 execute vfa-gallery --command="INSERT INTO groups (id, slug, name) VALUES ('grp-4', 'unique-slug', 'Second Group');"
```
Confirm: Second insert fails with UNIQUE constraint error.

## Rollback (If Needed)

To rollback this migration, create a new migration file:

```bash
touch migrations/0003_rollback_groups.sql
```

Add this content:
```sql
DROP TABLE IF EXISTS group_members;
DROP TABLE IF EXISTS groups;
```

Then execute:
```bash
wrangler d1 execute vfa-gallery --file=migrations/0003_rollback_groups.sql
```

## Success Criteria

- [ ] Migration file created at `/Volumes/DataSSD/gitsrc/vfa_gallery/migrations/0002_create_groups.sql`
- [ ] Migration executes without errors
- [ ] `groups` table exists with all columns
- [ ] `group_members` table exists with all columns
- [ ] Unique constraint on `groups.slug` is enforced
- [ ] Composite primary key on `group_members` prevents duplicate memberships
- [ ] Foreign key references to `users` table are correct
- [ ] Cascade deletes work as expected
- [ ] Default values (role='member') are applied correctly

## Next Steps

Once verified, proceed to Build 08 to create the galleries table, which references the users table for ownership.
