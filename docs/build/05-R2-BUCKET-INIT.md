# 05-R2-BUCKET-INIT.md
## Create R2 Bucket for Image Storage

**Goal:** Create a CloudFlare R2 bucket for image storage, configure the R2 binding in `wrangler.toml`, and verify bucket accessibility.

---

## Spec Extract

From **01-TECHNICAL-SPEC.md**:
- **Image Storage:** CloudFlare R2 (S3-compatible)
- **Upload Limit:** 5MB per image
- **Generated Assets:** Display version, thumbnail, icon

---

## Prerequisites

**Must Complete First:**
- 01-PROJECT-SCAFFOLD.md ✓
- 02-TAILWIND-SETUP.md ✓
- 03-CLOUDFLARE-PAGES-INIT.md ✓
- 04-D1-DATABASE-INIT.md ✓

---

## Steps

### Step 1: Create R2 Bucket

From the project root (`/site`), run:

```bash
npx wrangler r2 bucket create site-images
```

This command will:
1. Create a new R2 bucket in your CloudFlare account
2. Return the bucket name (should be `site-images`)
3. Make it accessible for file storage

**Example output:**
```
✨ Successfully created bucket 'site-images'.
```

If you get an error about account limits, verify your CloudFlare account has R2 enabled (available on all plans).

### Step 2: Verify Bucket Creation

List all R2 buckets to confirm creation:

```bash
npx wrangler r2 bucket list
```

Should output:
```
Buckets:
  site-images
```

### Step 3: Add R2 Binding to wrangler.toml

Edit `/site/wrangler.toml` and add an `[[r2_buckets]]` section. Find the existing D1 configuration and add the R2 binding after it:

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

# R2 Bucket Binding
[[r2_buckets]]
binding = "IMAGE_BUCKET"
bucket_name = "site-images"

[env.production]
name = "site"

[[env.production.d1_databases]]
binding = "DB"
database_name = "site-db"
database_id = "YOUR_DATABASE_ID_HERE"

[[env.production.r2_buckets]]
binding = "IMAGE_BUCKET"
bucket_name = "site-images"

[env.preview]
name = "site-preview"

[[env.preview.d1_databases]]
binding = "DB"
database_name = "site-db"
database_id = "YOUR_DATABASE_ID_HERE"

[[env.preview.r2_buckets]]
binding = "IMAGE_BUCKET"
bucket_name = "site-images"
```

**What this does:**
- `binding = "IMAGE_BUCKET"` - Variable name to use in Worker code (e.g., `env.IMAGE_BUCKET`)
- `bucket_name = "site-images"` - The R2 bucket name from Step 1
- Adds R2 bindings to all environments (development, production, preview)

### Step 4: Test R2 Bucket with Wrangler

Upload a test file to verify the bucket works:

```bash
echo "test content" > test.txt
npx wrangler r2 object put test.txt test.txt --bucket site-images
```

This should output:
```
✨ Uploaded test.txt to site-images.
```

### Step 5: List Objects in Bucket

Verify the test file was uploaded:

```bash
npx wrangler r2 object list site-images
```

Should output:
```
Object List:
  test.txt
```

### Step 6: Delete Test File

Clean up the test file:

```bash
npx wrangler r2 object delete test.txt --bucket site-images
rm test.txt
```

Verify deletion:

```bash
npx wrangler r2 object list site-images
```

Should now show an empty bucket (or no output).

### Step 7: Create R2 Configuration Documentation

Create a file `/site/docs/R2-STORAGE-GUIDE.md` for reference:

```markdown
# R2 Storage Configuration Guide

## Bucket Details

**Bucket Name:** site-images
**Binding Name:** IMAGE_BUCKET
**Access:** Internal (CloudFlare Workers only) + Public URLs via subdomain

## Folder Structure

Organize R2 objects with consistent naming:

```
/artworks/
  {artwork_id}/
    original.jpg          # Original uploaded image
    display.jpg           # Display version (watermarked)
    thumbnail.jpg         # Thumbnail (for grids)
    icon.jpg             # Icon (for navigation)

/users/
  {user_id}/
    avatar_original.jpg
    avatar_thumbnail.jpg
```

## Accessing Images

### In CloudFlare Workers

```typescript
const bucket = env.IMAGE_BUCKET;

// Upload
await bucket.put('artworks/123/original.jpg', imageData);

// Download
const file = await bucket.get('artworks/123/display.jpg');
const arrayBuffer = await file.arrayBuffer();
```

### Public URLs

CloudFlare R2 provides public URLs via custom subdomain:

```
https://cdn.site.com/artworks/123/display.jpg
```

(Configure custom domain in CloudFlare dashboard)

## Image Sizes and Quotas

- **Max upload:** 5MB per image
- **Storage quota:** Varies by CloudFlare plan
- **Bandwidth:** Included in CloudFlare plan

## Cleanup

To delete old/unused images:

```bash
npx wrangler r2 object delete {key} --bucket site-images
```

For bulk operations, use CloudFlare API or worker script.
```

Place this file at `/site/docs/R2-STORAGE-GUIDE.md`.

### Step 8: Verify Complete CloudFlare Stack

Check that all three CloudFlare services are configured:

```bash
# List D1 databases
npx wrangler d1 list

# List R2 buckets
npx wrangler r2 bucket list

# Show wrangler configuration
npx wrangler info
```

All three commands should complete without errors.

### Step 9: Test Local Development with R2

Start Wrangler in local mode to verify R2 binding:

```bash
npx wrangler pages dev dist/ --local
```

The command should start without R2-related errors. The R2 bucket is now accessible to CloudFlare Workers and Pages Functions.

### Step 10: Document CloudFlare Stack Summary

Update `/site/docs/CLOUDFLARE-STACK.md` (create if missing):

```markdown
# CloudFlare Stack Configuration

## Services Configured

### 1. Pages (Hosting)
- **Service:** CloudFlare Pages
- **Build:** `npm run build`
- **Output:** `dist/` directory
- **Local Dev:** `npx wrangler pages dev dist/`

### 2. D1 (Database)
- **Service:** CloudFlare D1 (SQLite)
- **Database Name:** site-db
- **Binding:** DB
- **Migrations:** `/migrations/`
- **Docs:** See MIGRATIONS-GUIDE.md

### 3. R2 (Image Storage)
- **Service:** CloudFlare R2 (S3-compatible)
- **Bucket Name:** site-images
- **Binding:** IMAGE_BUCKET
- **Docs:** See R2-STORAGE-GUIDE.md

## Local Development

Start all services locally:

```bash
npm run build
npx wrangler pages dev dist/ --local
```

Then navigate to the provided local URL (typically `http://localhost:8788`).

## Environment Access

In CloudFlare Worker/Pages Functions code:

```typescript
// Access D1
const db = env.DB;
const result = await db.prepare('SELECT * FROM users').all();

// Access R2
const bucket = env.IMAGE_BUCKET;
await bucket.put('test.txt', 'content');
```

## Deployment

CloudFlare automatically deploys on git push:

1. Connect repository to CloudFlare Pages dashboard
2. Specify build command and output directory
3. Set environment variables in CloudFlare dashboard (if needed)
4. Push to main branch → automatic build and deploy

No manual deployment steps required after initial setup.
```

Place this file at `/site/docs/CLOUDFLARE-STACK.md`.

---

## Files to Create/Modify

**Created:**
- R2 bucket `site-images` (via CloudFlare dashboard/Wrangler)
- `/site/docs/R2-STORAGE-GUIDE.md` - R2 storage documentation
- `/site/docs/CLOUDFLARE-STACK.md` - CloudFlare stack overview

**Modified:**
- `/site/wrangler.toml` - Added `[[r2_buckets]]` binding section and environment configs

---

## Verification Checklist

- [ ] `npx wrangler r2 bucket create site-images` completes successfully
- [ ] `npx wrangler r2 bucket list` shows `site-images` bucket
- [ ] R2 bucket binding added to `wrangler.toml` (root and both environments)
- [ ] Test file upload succeeds: `npx wrangler r2 object put test.txt test.txt --bucket site-images`
- [ ] `npx wrangler r2 object list site-images` shows test file
- [ ] Test file deletion succeeds
- [ ] `/site/docs/R2-STORAGE-GUIDE.md` exists
- [ ] `/site/docs/CLOUDFLARE-STACK.md` exists
- [ ] `npx wrangler pages dev dist/ --local` starts without R2 errors
- [ ] All CloudFlare services verified: D1, R2, Pages

---

## Phase 1 Complete!

All 5 files for **Phase 1: Project Foundation** are now complete:

✓ 01-PROJECT-SCAFFOLD.md - Vite + React + TypeScript
✓ 02-TAILWIND-SETUP.md - Tailwind CSS with breakpoints
✓ 03-CLOUDFLARE-PAGES-INIT.md - CloudFlare Pages setup
✓ 04-D1-DATABASE-INIT.md - D1 database and migrations
✓ 05-R2-BUCKET-INIT.md - R2 bucket for images

**Next Steps:** Proceed to Phase 2 (Database Schema) starting with `06-SCHEMA-USERS.md`.
