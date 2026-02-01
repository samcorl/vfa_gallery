# 04-D1-DATABASE-INIT.md
## Create D1 Database and Configure Migrations

**Goal:** Set up a CloudFlare D1 SQLite database, configure the D1 binding in `wrangler.toml`, create the migrations folder structure, and verify migration tooling works.

---

## Spec Extract

From **01-TECHNICAL-SPEC.md**:
- **Database:** CloudFlare D1 (SQLite-compatible)

---

## Prerequisites

**Must Complete First:**
- 01-PROJECT-SCAFFOLD.md ✓
- 02-TAILWIND-SETUP.md ✓
- 03-CLOUDFLARE-PAGES-INIT.md ✓

---

## Steps

### Step 1: Create D1 Database

From the project root (`/site`), run:

```bash
npx wrangler d1 create site-db
```

This command will:
1. Create a new SQLite database in your CloudFlare account
2. Output the database ID (a UUID)
3. Provide instructions for binding the database

**Example output:**
```
✔ Creating database...
✨ Database successfully created with ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
Binding name: DB
```

Save the database ID - you'll need it in the next step.

### Step 2: Add D1 Binding to wrangler.toml

Edit `/site/wrangler.toml` and add a `[[d1_databases]]` section. Replace `DATABASE_ID` with the actual ID from Step 1:

```toml
name = "site"
type = "javascript"
compatibility_date = "2024-01-01"
compatibility_flags = ["nodejs_compat"]

[build]
command = "npm run build"
cwd = "."
watch_paths = ["src/**/*.ts", "src/**/*.tsx"]

[build.upload]
format = "service-worker"

# D1 Database Binding
[[d1_databases]]
binding = "DB"
database_name = "site-db"
database_id = "YOUR_DATABASE_ID_HERE"

[env.production]
name = "site"

[[env.production.d1_databases]]
binding = "DB"
database_name = "site-db"
database_id = "YOUR_DATABASE_ID_HERE"

[env.preview]
name = "site-preview"

[[env.preview.d1_databases]]
binding = "DB"
database_name = "site-db"
database_id = "YOUR_DATABASE_ID_HERE"
```

**What this does:**
- `binding = "DB"` - Variable name to use in Worker code (e.g., `env.DB`)
- `database_name` - Human-readable name
- `database_id` - The UUID from Step 1 (same for all environments for now)

### Step 3: Create Migrations Folder Structure

Create a migrations directory at the project root:

```bash
mkdir -p migrations
```

Wrangler automatically looks for migrations in this directory when you run migration commands.

### Step 4: Create Initial Migration File

Create an empty migration file to test the setup. Wrangler migrations use timestamp-based naming:

```bash
touch migrations/0000_initial.sql
```

Edit `/site/migrations/0000_initial.sql` and add a placeholder comment:

```sql
-- VFA.gallery Database Initialization
-- Phase 1: Foundation (no tables yet, just testing migration system)
-- Tables will be added in Phase 2 (SCHEMA-* build files)

-- Placeholder: This migration ensures the migration system is working
```

### Step 5: Verify Migration Configuration

List all migrations to verify the file was created:

```bash
npx wrangler d1 migrations list site-db
```

This should output:
```
Current migrations:
  ✓ 0000_initial.sql
```

If you get an error about "migrations to be applied", the migration is not yet executed locally. This is expected - we're just verifying the file exists.

### Step 6: Apply Migrations Locally (Optional Testing)

To test migrations locally, use the `--local` flag:

```bash
npx wrangler d1 execute site-db --file migrations/0000_initial.sql --local
```

This should complete without errors (since the migration is just a comment).

Output should show:
```
✔ Executed 1 migration
```

### Step 7: Create Migration Helper Documentation

Create a file `/site/docs/MIGRATIONS-GUIDE.md` for future reference:

```markdown
# Database Migration Guide

## Running Migrations

### Development (Local)
```bash
npx wrangler d1 migrations apply site-db --local
```

### Production
```bash
npx wrangler d1 migrations apply site-db --remote
```

## Creating New Migrations

1. Create a new file in `/migrations/` with timestamp-based naming:
   ```bash
   # Example: migrations/0001_create_users_table.sql
   ```

2. Write SQL statements in the file (multi-statement supported):
   ```sql
   CREATE TABLE users (
     id INTEGER PRIMARY KEY,
     username TEXT NOT NULL UNIQUE
   );
   ```

3. Apply locally to test:
   ```bash
   npx wrangler d1 execute site-db --file migrations/0001_create_users_table.sql --local
   ```

4. Once tested, push to main branch for production deployment

## Viewing Database Schema

### Local
```bash
npx wrangler d1 execute site-db "SELECT sql FROM sqlite_master WHERE type='table';" --local
```

### Remote
```bash
npx wrangler d1 execute site-db "SELECT sql FROM sqlite_master WHERE type='table';" --remote
```
```

Place this file at `/site/docs/MIGRATIONS-GUIDE.md`.

### Step 8: Verify D1 Binding in wrangler.toml

Run a quick check to ensure the configuration is valid:

```bash
npx wrangler d1 info site-db
```

This should output information about the database:
```
Database Details
- Name: site-db
- ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

### Step 9: Test Local Development with D1

Start Wrangler in local mode to test the D1 binding:

```bash
npx wrangler pages dev dist/ --local
```

The command should start without D1-related errors. The database binding is now available to CloudFlare Workers and Pages Functions.

---

## Files to Create/Modify

**Created:**
- `/site/migrations/` - Migrations directory
- `/site/migrations/0000_initial.sql` - Initial migration file
- `/site/docs/MIGRATIONS-GUIDE.md` - Migration documentation

**Modified:**
- `/site/wrangler.toml` - Added `[[d1_databases]]` binding section and environment configs

---

## Verification Checklist

- [ ] `npx wrangler d1 create site-db` completes and outputs database ID
- [ ] Database ID is added to `wrangler.toml` in all three sections (root, production, preview)
- [ ] `migrations/` directory exists
- [ ] `migrations/0000_initial.sql` file exists with SQL comment
- [ ] `npx wrangler d1 migrations list site-db` shows the initial migration
- [ ] `npx wrangler d1 execute site-db --file migrations/0000_initial.sql --local` succeeds
- [ ] `npx wrangler d1 info site-db` outputs database details
- [ ] `npx wrangler pages dev dist/ --local` starts without D1 errors
- [ ] `/site/docs/MIGRATIONS-GUIDE.md` exists

Once all items checked, proceed to **05-R2-BUCKET-INIT.md**.
