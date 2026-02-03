# CloudFlare Stack Configuration

## Services Configured

### 1. Pages (Hosting)
- **Service:** CloudFlare Pages
- **Build:** `npm run build`
- **Output:** `dist/` directory
- **Local Dev:** `wrangler pages dev dist/`

### 2. D1 (Database)
- **Service:** CloudFlare D1 (SQLite)
- **Database Name:** vfa-gallery-db
- **Database ID:** acb8312e-d127-452e-9cac-ee1fb878deb3
- **Binding:** DB
- **Migrations:** `/migrations/`
- **Docs:** See MIGRATIONS-GUIDE.md

### 3. R2 (Image Storage)
- **Service:** CloudFlare R2 (S3-compatible)
- **Bucket Name:** vfa-gallery-images
- **Binding:** IMAGE_BUCKET
- **Docs:** See R2-STORAGE-GUIDE.md

## Local Development

Start all services locally:

```bash
npm run build
wrangler pages dev dist/ --local
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
4. Push to main branch -> automatic build and deploy

No manual deployment steps required after initial setup.
