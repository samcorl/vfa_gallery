# Database Migration Guide

## Running Migrations

### Development (Local)
```bash
CLOUDFLARE_API_TOKEN="$CLOUDFLARE_D1_TOKEN" wrangler d1 migrations apply vfa-gallery-db --local
```

### Production
```bash
CLOUDFLARE_API_TOKEN="$CLOUDFLARE_D1_TOKEN" wrangler d1 migrations apply vfa-gallery-db --remote
```

## Creating New Migrations

1. Create a new file in `/migrations/` with sequential naming:
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
   CLOUDFLARE_API_TOKEN="$CLOUDFLARE_D1_TOKEN" wrangler d1 execute vfa-gallery-db --file migrations/0001_create_users_table.sql --local
   ```

4. Once tested, apply to production

## Viewing Database Schema

### Local
```bash
CLOUDFLARE_API_TOKEN="$CLOUDFLARE_D1_TOKEN" wrangler d1 execute vfa-gallery-db "SELECT sql FROM sqlite_master WHERE type='table';" --local
```

### Remote
```bash
CLOUDFLARE_API_TOKEN="$CLOUDFLARE_D1_TOKEN" wrangler d1 execute vfa-gallery-db "SELECT sql FROM sqlite_master WHERE type='table';" --remote
```
