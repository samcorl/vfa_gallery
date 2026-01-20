# Build 13: Database Schema - Supporting Tables

## Goal
Create three supporting tables (`gallery_roles`, `activity_log`, and `sessions`) in the D1 database to manage gallery access control, audit logging, and user session management.

## Spec Extract

This build creates three essential supporting tables for role-based access control, activity auditing, and session management.

### gallery_roles Table
```sql
CREATE TABLE gallery_roles (
  gallery_id TEXT REFERENCES galleries(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  granted_at TEXT DEFAULT CURRENT_TIMESTAMP,
  granted_by TEXT REFERENCES users(id),
  PRIMARY KEY (gallery_id, user_id)
);
```

### activity_log Table
```sql
CREATE TABLE activity_log (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  metadata TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

### sessions Table
```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT UNIQUE NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  last_used_at TEXT
);
```

**Field Definitions for gallery_roles:**
- `gallery_id`: References the gallery (cascades on delete)
- `user_id`: References the user who has the role (cascades on delete)
- `role`: The role type (e.g., 'owner', 'editor', 'viewer', 'contributor')
- `granted_at`: When the role was assigned (auto-generated)
- `granted_by`: References the user who granted this role (typically an owner)
- `PRIMARY KEY`: Composite key (gallery_id, user_id) ensures one role per user per gallery

**Field Definitions for activity_log:**
- `id`: Unique identifier for the log entry (primary key)
- `user_id`: References the user who performed the action (can be NULL for system actions)
- `action`: The action performed (e.g., 'create', 'update', 'delete', 'publish', 'flag')
- `entity_type`: Type of entity affected (e.g., 'artwork', 'gallery', 'user', 'comment')
- `entity_id`: ID of the affected entity
- `metadata`: Optional JSON stored as TEXT with additional context
- `ip_address`: IP address of the request
- `user_agent`: Browser/client user agent string
- `created_at`: When the action occurred (auto-generated)

**Field Definitions for sessions:**
- `id`: Unique identifier for the session (primary key)
- `user_id`: References the user who owns this session (cascades on delete)
- `token_hash`: SHA256 hash of the session token (stored securely, not the token itself)
- `expires_at`: When this session token expires (required, no default)
- `created_at`: When the session was created (auto-generated)
- `last_used_at`: Timestamp of last activity (updated on each request)

## Prerequisites
- **Build 06**: Users table must exist
- **Build 08**: Galleries table must exist

## Steps

### 1. Create Migration File

Create a new migration file in the migrations folder following Cloudflare D1 naming conventions:

```bash
File: migrations/[TIMESTAMP]_create_supporting_tables.sql
```

The timestamp should be in the format `YYYYMMDDHHMMSS` and should be sequential after previous migrations (e.g., `20260118220200`).

### 2. Migration Implementation

In the migration file, add all three CREATE TABLE statements. They should be in this order to respect foreign key dependencies:

```sql
-- Create gallery_roles table for role-based access control
CREATE TABLE gallery_roles (
  gallery_id TEXT REFERENCES galleries(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  granted_at TEXT DEFAULT CURRENT_TIMESTAMP,
  granted_by TEXT REFERENCES users(id),
  PRIMARY KEY (gallery_id, user_id)
);

-- Create activity_log table for audit trail
CREATE TABLE activity_log (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  metadata TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Create sessions table for user session management
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT UNIQUE NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  last_used_at TEXT
);

-- Notes:
-- gallery_roles: ON DELETE CASCADE ensures roles are removed when gallery/user is deleted
-- activity_log: user_id is nullable for system-initiated actions, no cascade to preserve audit history
-- sessions: ON DELETE CASCADE removes expired sessions when user is deleted
```

### 3. Verify Migration File Structure

Ensure the migration file:
- Has a unique timestamp after all previous migrations
- Contains all three CREATE TABLE statements
- Contains only valid SQLite syntax
- Properly references all dependent tables (users, galleries)
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

### 5. Verify Table Structures

After migration succeeds, verify all three tables were created correctly:

```bash
wrangler d1 execute vfa_gallery_db --command "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('gallery_roles', 'activity_log', 'sessions') ORDER BY name;" --local
```

Expected result: Three rows with values `activity_log`, `gallery_roles`, `sessions`

## Files to Create/Modify

### Create:
- `/Volumes/DataSSD/gitsrc/vfa_gallery/migrations/[TIMESTAMP]_create_supporting_tables.sql`

### Modify:
- None

## Verification

### 1. Verify All Tables Exist

Execute this command to confirm all three tables were created:

```bash
wrangler d1 execute vfa_gallery_db --command "
SELECT name FROM sqlite_master
WHERE type='table' AND name IN ('gallery_roles', 'activity_log', 'sessions')
ORDER BY name;
" --local
```

Expected result: Three rows: `activity_log`, `gallery_roles`, `sessions`

### 2. Verify gallery_roles Structure

Verify gallery_roles columns and primary key:

```bash
wrangler d1 execute vfa_gallery_db --command "PRAGMA table_info(gallery_roles);" --local
```

Expected columns in order:
- gallery_id (TEXT)
- user_id (TEXT)
- role (TEXT)
- granted_at (TEXT)
- granted_by (TEXT)

Verify the composite primary key:

```bash
wrangler d1 execute vfa_gallery_db --command "PRAGMA table_info(gallery_roles);" --local | grep -i pk
```

Both `gallery_id` and `user_id` should have `pk` values of 1 and 2.

### 3. Verify activity_log Structure

Verify activity_log columns:

```bash
wrangler d1 execute vfa_gallery_db --command "PRAGMA table_info(activity_log);" --local
```

Expected columns in order:
- id (TEXT)
- user_id (TEXT)
- action (TEXT)
- entity_type (TEXT)
- entity_id (TEXT)
- metadata (TEXT)
- ip_address (TEXT)
- user_agent (TEXT)
- created_at (TEXT)

### 4. Verify sessions Structure

Verify sessions columns:

```bash
wrangler d1 execute vfa_gallery_db --command "PRAGMA table_info(sessions);" --local
```

Expected columns in order:
- id (TEXT)
- user_id (TEXT)
- token_hash (TEXT)
- expires_at (TEXT)
- created_at (TEXT)
- last_used_at (TEXT)

### 5. Verify Foreign Keys for gallery_roles

Check foreign key configuration:

```bash
wrangler d1 execute vfa_gallery_db --command "PRAGMA foreign_key_list(gallery_roles);" --local
```

Expected: Three foreign key references:
- gallery_id → galleries(id) with ON DELETE CASCADE
- user_id → users(id) with ON DELETE CASCADE
- granted_by → users(id)

### 6. Verify Foreign Keys for activity_log

Check foreign key configuration:

```bash
wrangler d1 execute vfa_gallery_db --command "PRAGMA foreign_key_list(activity_log);" --local
```

Expected: One foreign key reference:
- user_id → users(id) (no cascade, to preserve audit trail)

### 7. Verify Foreign Keys for sessions

Check foreign key configuration:

```bash
wrangler d1 execute vfa_gallery_db --command "PRAGMA foreign_key_list(sessions);" --local
```

Expected: One foreign key reference:
- user_id → users(id) with ON DELETE CASCADE

### 8. Test gallery_roles Insert

Insert a test role assignment:

```bash
wrangler d1 execute vfa_gallery_db --command "
INSERT INTO gallery_roles (gallery_id, user_id, role, granted_by)
VALUES (
  (SELECT id FROM galleries LIMIT 1),
  (SELECT id FROM users LIMIT 1),
  'editor',
  (SELECT id FROM users LIMIT 1)
);
" --local
```

Query to verify:

```bash
wrangler d1 execute vfa_gallery_db --command "SELECT role FROM gallery_roles LIMIT 1;" --local
```

Expected: One row with value `editor`

### 9. Test activity_log Insert

Insert a test activity log entry:

```bash
wrangler d1 execute vfa_gallery_db --command "
INSERT INTO activity_log (id, user_id, action, entity_type, entity_id, ip_address)
VALUES ('log-001', (SELECT id FROM users LIMIT 1), 'create', 'artwork', 'art-001', '192.168.1.1');
" --local
```

Query to verify:

```bash
wrangler d1 execute vfa_gallery_db --command "SELECT action, entity_type FROM activity_log WHERE id='log-001';" --local
```

Expected: One row with action='create' and entity_type='artwork'

### 10. Test sessions Insert

Insert a test session:

```bash
wrangler d1 execute vfa_gallery_db --command "
INSERT INTO sessions (id, user_id, token_hash, expires_at)
VALUES ('sess-001', (SELECT id FROM users LIMIT 1), 'abc123def456', datetime('now', '+7 days'));
" --local
```

Query to verify:

```bash
wrangler d1 execute vfa_gallery_db --command "SELECT token_hash FROM sessions WHERE id='sess-001';" --local
```

Expected: One row with token_hash='abc123def456'

### 11. Test Cascade Delete

Verify that ON DELETE CASCADE works for gallery_roles:

```bash
wrangler d1 execute vfa_gallery_db --command "
SELECT COUNT(*) FROM gallery_roles;
" --local
```

Record the count, then delete a gallery:

```bash
wrangler d1 execute vfa_gallery_db --command "
DELETE FROM galleries WHERE id=(SELECT gallery_id FROM gallery_roles LIMIT 1);
" --local
```

Check that associated roles were deleted:

```bash
wrangler d1 execute vfa_gallery_db --command "SELECT COUNT(*) FROM gallery_roles;" --local
```

The count should be reduced by at least 1.

### 12. Test Unique Constraint on sessions

Verify that token_hash must be unique:

```bash
wrangler d1 execute vfa_gallery_db --command "
INSERT INTO sessions (id, user_id, token_hash, expires_at)
VALUES ('sess-002', (SELECT id FROM users LIMIT 1), 'abc123def456', datetime('now', '+7 days'));
" --local
```

This should fail with a UNIQUE constraint violation since the same token_hash already exists.

## Notes

- **gallery_roles**: Use ON DELETE CASCADE to automatically clean up roles when a gallery or user is deleted
- **activity_log**: Intentionally does NOT cascade on user deletion to preserve the audit trail for compliance/investigation
- **sessions**: Can be pruned regularly by deleting rows where expires_at < CURRENT_TIMESTAMP
- The **metadata** field in activity_log stores JSON as TEXT - parse as JSON in application code
- The **token_hash** field in sessions should never store the actual token - always store the hash for security
- Consider adding indexes in Build 14 for improved query performance on common operations
- All three tables use TEXT for timestamps to maintain consistency with other tables
