# Build 11: Database Schema - Themes Table

## Goal
Create the `themes` table in the D1 database to support customizable gallery themes and user-created theme variants.

## Spec Extract

The themes table stores theme definitions with styling information. Themes can be system-provided or user-created, and users can create copies of existing themes.

```sql
CREATE TABLE themes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_by TEXT REFERENCES users(id),
  is_system INTEGER DEFAULT 0,
  is_public INTEGER DEFAULT 0,
  copied_from TEXT REFERENCES themes(id),
  styles TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

**Field Definitions:**
- `id`: Unique identifier for the theme (primary key)
- `name`: Display name of the theme (required)
- `description`: Optional description of the theme's purpose or design
- `created_by`: References the user who created this theme (NULL for system themes)
- `is_system`: Flag indicating if this is a built-in system theme (0=user theme, 1=system theme)
- `is_public`: Flag indicating if theme is publicly discoverable (0=private, 1=public)
- `copied_from`: If this theme is a copy, references the original theme's ID
- `styles`: JSON object stored as TEXT containing all CSS variables and theme properties
- `created_at`: Timestamp of theme creation (auto-generated)
- `updated_at`: Timestamp of last modification (auto-generated)

## Prerequisites
- **Build 06**: Database initialization and users table must exist before creating themes

## Steps

### 1. Create Migration File

Create a new migration file in the migrations folder. Follow Cloudflare D1 naming conventions:

```bash
File: migrations/[TIMESTAMP]_create_themes_table.sql
```

The timestamp should be in the format `YYYYMMDDHHMMSS` (e.g., `20260118220000`).

### 2. Migration Implementation

In the migration file, add the CREATE TABLE statement:

```sql
-- Create themes table for storing gallery theme definitions
CREATE TABLE themes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_by TEXT REFERENCES users(id),
  is_system INTEGER DEFAULT 0,
  is_public INTEGER DEFAULT 0,
  copied_from TEXT REFERENCES themes(id),
  styles TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Add comment explaining styles field
-- styles field stores JSON as TEXT with format: {"primary":"#color","secondary":"#color",...}
```

### 3. Verify Migration File Structure

Ensure the migration file:
- Has a unique timestamp that hasn't been used before
- Contains only valid SQLite syntax
- Includes the complete CREATE TABLE statement
- Is placed in the `/migrations` directory at the project root

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

### 5. Verify Table Structure

After migration succeeds, verify the table was created correctly:

```bash
wrangler d1 execute vfa_gallery_db --command "SELECT sql FROM sqlite_master WHERE type='table' AND name='themes';" --local
```

Expected output should show the complete CREATE TABLE statement.

## Files to Create/Modify

### Create:
- `/Volumes/DataSSD/gitsrc/vfa_gallery/migrations/[TIMESTAMP]_create_themes_table.sql`

### Modify:
- None

## Verification

### 1. Verify Table Exists

Execute this command to confirm the themes table was created:

```bash
wrangler d1 execute vfa_gallery_db --command "SELECT name FROM sqlite_master WHERE type='table' AND name='themes';" --local
```

Expected result: One row with value `themes`

### 2. Verify Column Structure

Verify all columns exist with correct types:

```bash
wrangler d1 execute vfa_gallery_db --command "PRAGMA table_info(themes);" --local
```

Expected columns in order:
- id (TEXT)
- name (TEXT)
- description (TEXT)
- created_by (TEXT)
- is_system (INT)
- is_public (INT)
- copied_from (TEXT)
- styles (TEXT)
- created_at (TEXT)
- updated_at (TEXT)

### 3. Verify Foreign Keys

Check that foreign key constraints are properly configured:

```bash
wrangler d1 execute vfa_gallery_db --command "PRAGMA foreign_key_list(themes);" --local
```

Expected: Foreign key references to `users(id)` for `created_by` column and `themes(id)` for `copied_from` column

### 4. Test Insert (Optional)

If you want to verify the table is fully functional, insert a test system theme:

```bash
wrangler d1 execute vfa_gallery_db --command "
INSERT INTO themes (id, name, description, is_system, styles)
VALUES ('theme-system-light', 'System Light', 'Default light theme', 1, '{\"primary\":\"#000000\"}');
" --local
```

Then verify it was inserted:

```bash
wrangler d1 execute vfa_gallery_db --command "SELECT id, name, is_system FROM themes WHERE id='theme-system-light';" --local
```

### 5. Verify Constraints

Test that foreign key constraints work by attempting an invalid insert:

```bash
wrangler d1 execute vfa_gallery_db --command "
INSERT INTO themes (id, name, created_by, styles)
VALUES ('theme-invalid', 'Invalid', 'nonexistent-user-id', '{}');
" --local
```

This should fail with a foreign key constraint error if constraints are enabled.

## Notes

- The `styles` field stores JSON as plain TEXT. In application code, parse this as JSON after retrieval
- System themes have `is_system=1` and `created_by=NULL`
- Themes can be made public for discovery by other users with `is_public=1`
- The `copied_from` field creates an audit trail showing theme inheritance
- Consider adding additional indexes in Build 14 for performance optimization
- The `CURRENT_TIMESTAMP` default uses SQLite's default format (YYYY-MM-DD HH:MM:SS)
