# 41-API-ARTWORK-CREATE.md

## Goal
Document the POST `/api/artworks` endpoint that allows authenticated users to create new artwork records. The endpoint validates metadata, verifies image existence in R2, generates unique slugs per user, and returns complete artwork data with on-the-fly generated image URLs.

---

## Spec Extract

From TECHNICAL-SPEC.md:
- **Artworks Table**: Stores artwork metadata with user ownership
- **Image Storage**: Uses R2 with `image_key` column storing object key (e.g., `originals/{userId}/{uuid}.jpg`)
- **URL Generation**: On-the-fly using Cloudflare Image Transformations via `getThumbnailUrl()`, `getIconUrl()`, `getDisplayUrl()` from utils
- **CDN Domain**: `https://images.vfa.gallery`
- **Slug Generation**: Auto-generated from title, must be unique per user (not globally)
- **User Limits**: Check `users.artwork_limit` before allowing creation
- **Status**: Default 'active' for new artworks
- **Tags**: Stored as JSON string in database

Request body schema:
```json
{
  "title": "Dragon's Dawn",
  "description": "A fierce dragon breathing fire at dawn.",
  "materials": "Digital, Procreate",
  "dimensions": "3000x4000px",
  "createdDate": "2024-01",
  "category": "illustration",
  "tags": ["dragon", "fantasy"],
  "imageKey": "originals/user-id/uuid.jpg"
}
```

Response schema:
```json
{
  "data": {
    "id": "uuid",
    "userId": "user-id",
    "slug": "dragons-dawn",
    "title": "Dragon's Dawn",
    "description": "A fierce dragon breathing fire at dawn.",
    "materials": "Digital, Procreate",
    "dimensions": "3000x4000px",
    "createdDate": "2024-01",
    "category": "illustration",
    "tags": ["dragon", "fantasy"],
    "imageKey": "originals/user-id/uuid.jpg",
    "thumbnailUrl": "https://images.vfa.gallery/cdn-cgi/image/width=200,quality=80,format=auto/originals/user-id/uuid.jpg",
    "iconUrl": "https://images.vfa.gallery/cdn-cgi/image/width=80,quality=80,format=auto/originals/user-id/uuid.jpg",
    "displayUrl": "https://images.vfa.gallery/cdn-cgi/image/width=800,quality=80,format=auto/originals/user-id/uuid.jpg",
    "status": "active",
    "isFeatured": false,
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  }
}
```

---

## Prerequisites

**Must complete before starting:**
- **10-SCHEMA-ARTWORKS.md** - Artworks table schema created (with `image_key` column, no separate URL columns)
- **16-API-MIDDLEWARE-AUTH.md** - Authentication middleware with `requireAuth` and `getCurrentUser()`
- Image exists in R2 bucket at the provided key

---

## Implementation Status

This endpoint is **ALREADY IMPLEMENTED** in the codebase at `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/artworks.ts` as the `POST /` handler on the artworks router.

### Current Implementation Details

**Location:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/artworks.ts`

The implemented endpoint:
1. Requires authentication via `requireAuth` middleware + `getCurrentUser(c)`
2. Validates input with `validateArtworkCreate()` from validation module
3. Verifies image exists in R2 via `c.env.IMAGE_BUCKET.head(imageKey)`
4. Checks artwork limit against `users.artwork_limit`
5. Generates unique slug per user using collision detection
6. Inserts into artworks table with `image_key` column only (no separate URL columns)
7. Returns artwork with URLs generated on-the-fly using utility functions

### Key Implementation Details

**Hono Integration:**
```typescript
// Router instance exported by artworks.ts
const router = new Hono<HonoEnv>()
router.post('/', requireAuth, async (c) => { ... })
```

**Environment Bindings:**
```typescript
// Access via c.env bindings (NOT process.env)
c.env.DB           // D1 database
c.env.IMAGE_BUCKET // R2 bucket binding
```

**Error Handling:**
Uses `Errors` factory from `../errors`:
- `Errors.badRequest()` - Validation failures
- `Errors.unauthorized()` - Auth failures
- `Errors.notFound()` - Resource not found
- `Errors.internal()` - Server errors

**Image URLs Generated On-the-Fly:**
```typescript
// At response time, using utility functions
const thumbnail = getThumbnailUrl(imageKey)
const icon = getIconUrl(imageKey)
const display = getDisplayUrl(imageKey)

// Format: https://images.vfa.gallery/cdn-cgi/image/width=X,quality=80,format=auto/originals/{userId}/{uuid}.jpg
```

**Database Schema Expected:**
```
artworks table columns:
- id (TEXT PRIMARY KEY)
- user_id (TEXT NOT NULL)
- slug (TEXT NOT NULL)
- title (TEXT NOT NULL)
- description (TEXT)
- materials (TEXT)
- dimensions (TEXT)
- created_date (TEXT)
- category (TEXT)
- tags (TEXT) -- JSON string
- image_key (TEXT NOT NULL) -- R2 object key
- status (TEXT) -- 'active', 'processing', 'deleted'
- is_featured (INTEGER)
- created_at (TEXT)
- updated_at (TEXT)
- UNIQUE(user_id, slug)
```

**ID Generation:**
Uses `crypto.randomUUID()` (Cloudflare Workers native, no external package required)

---

## Files Involved

**Primary Implementation:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/artworks.ts` - Route handler
2. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/validation/artworks.ts` - Input validation
3. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/utils/imageUrls.ts` - URL generation utilities
4. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/errors.ts` - Error factory
5. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/middleware/auth.ts` - Auth middleware
6. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/types/env.ts` - HonoEnv type definition

---

## Verification

### Test 1: Verify TypeScript Compilation

```bash
npx tsc --noEmit
```

Expected: No type errors.

---

### Test 2: Test Artwork Creation Without Authentication

Send POST request without token:

```bash
curl -X POST http://localhost:8788/api/artworks \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Artwork",
    "imageKey": "originals/user-123/image.jpg"
  }'
```

Expected response (401 Unauthorized):
```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required"
  }
}
```

---

### Test 3: Test Artwork Creation With Missing Required Fields

First, create a valid JWT token for testing (token must include userId claim).

Then send POST request with missing required fields:

```bash
curl -X POST http://localhost:8788/api/artworks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <valid-token>" \
  -d '{
    "description": "No title here"
  }'
```

Expected response (400 Bad Request):
```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "title is required and must be a string"
  }
}
```

---

### Test 4: Test Image Verification in R2

Send POST request with valid auth but non-existent image in R2:

```bash
curl -X POST http://localhost:8788/api/artworks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <valid-token>" \
  -d '{
    "title": "Test Artwork",
    "imageKey": "originals/user-123/nonexistent.jpg"
  }'
```

Expected response (400 Bad Request):
```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "Image not found in R2 bucket"
  }
}
```

---

### Test 5: Test Successful Artwork Creation

Prerequisites:
- Image exists in R2 at `originals/user-id/abc123def456.jpg`
- User has no artwork limit or hasn't reached it

Send valid POST request:

```bash
curl -X POST http://localhost:8788/api/artworks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <valid-token>" \
  -d '{
    "title": "Dragon'"'"'s Dawn",
    "description": "A fierce dragon breathing fire at dawn",
    "materials": "Digital, Procreate",
    "dimensions": "3000x4000px",
    "createdDate": "2024-01",
    "category": "illustration",
    "tags": ["dragon", "fantasy"],
    "imageKey": "originals/user-id/abc123def456.jpg"
  }'
```

Expected response (201 Created):
```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "userId": "user-id",
    "slug": "dragons-dawn",
    "title": "Dragon's Dawn",
    "description": "A fierce dragon breathing fire at dawn",
    "materials": "Digital, Procreate",
    "dimensions": "3000x4000px",
    "createdDate": "2024-01",
    "category": "illustration",
    "tags": ["dragon", "fantasy"],
    "imageKey": "originals/user-id/abc123def456.jpg",
    "thumbnailUrl": "https://images.vfa.gallery/cdn-cgi/image/width=200,quality=80,format=auto/originals/user-id/abc123def456.jpg",
    "iconUrl": "https://images.vfa.gallery/cdn-cgi/image/width=80,quality=80,format=auto/originals/user-id/abc123def456.jpg",
    "displayUrl": "https://images.vfa.gallery/cdn-cgi/image/width=800,quality=80,format=auto/originals/user-id/abc123def456.jpg",
    "status": "active",
    "isFeatured": false,
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  }
}
```

---

### Test 6: Test Slug Uniqueness Per User

Create two artworks with the same title by the same user:

```bash
# First artwork
curl -X POST http://localhost:8788/api/artworks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <valid-token>" \
  -d '{
    "title": "My Artwork",
    "imageKey": "originals/user-id/image1.jpg"
  }'

# Second artwork with same title
curl -X POST http://localhost:8788/api/artworks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <valid-token>" \
  -d '{
    "title": "My Artwork",
    "imageKey": "originals/user-id/image2.jpg"
  }'
```

Expected: First returns slug "my-artwork", second returns slug "my-artwork-2".

---

### Test 7: Test Invalid Category

Send POST request with invalid category:

```bash
curl -X POST http://localhost:8788/api/artworks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <valid-token>" \
  -d '{
    "title": "Test",
    "category": "invalid-category",
    "imageKey": "originals/user-id/image.jpg"
  }'
```

Expected response (400 Bad Request):
```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "Invalid category. Must be one of: manga, comic, illustration, concept art, fan art, other"
  }
}
```

---

### Test 8: Test Artwork Limit Exceeded

Setup: First update a test user to have artwork_limit = 1:

```bash
wrangler d1 execute site --command="UPDATE users SET artwork_limit = 1 WHERE id = 'user-limited';"
```

Then try to create 2 artworks with the same user:

```bash
# First artwork (succeeds)
curl -X POST http://localhost:8788/api/artworks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token-for-user-limited>" \
  -d '{"title": "Artwork 1", "imageKey": "originals/user-limited/img1.jpg"}'

# Second artwork (should fail)
curl -X POST http://localhost:8788/api/artworks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token-for-user-limited>" \
  -d '{"title": "Artwork 2", "imageKey": "originals/user-limited/img2.jpg"}'
```

Expected on second request (400 Bad Request):
```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "Artwork limit exceeded",
    "details": {
      "limit": 1,
      "current": 1
    }
  }
}
```

---

### Test 9: Test Tags Array Validation

Send POST with too many tags:

```bash
curl -X POST http://localhost:8788/api/artworks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <valid-token>" \
  -d '{
    "title": "Test",
    "imageKey": "originals/user-id/image.jpg",
    "tags": ["tag1", "tag2", "tag3", "tag4", "tag5", "tag6", "tag7", "tag8", "tag9", "tag10", "tag11", "tag12", "tag13", "tag14", "tag15", "tag16", "tag17", "tag18", "tag19", "tag20", "tag21"]
  }'
```

Expected response (400 Bad Request):
```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "maximum 20 tags allowed"
  }
}
```

---

### Test 10: Verify Artwork Record in Database

Query the database to confirm artwork was created:

```bash
wrangler d1 execute site --command="SELECT id, slug, title, user_id, status, image_key FROM artworks WHERE user_id = 'user-id' LIMIT 5;"
```

Expected: Shows the created artwork records with `image_key` column populated.

---

### Test 11: Verify Database Schema

Confirm the artworks table schema matches expectations:

```bash
wrangler d1 execute site --command=".schema artworks"
```

Expected output should show:
- `image_key TEXT NOT NULL` column
- NO `original_url`, `display_url`, `thumbnail_url`, `icon_url` columns
- `UNIQUE(user_id, slug)` constraint

---

## Implementation Notes

### Stack Details

**Framework:** Hono on Cloudflare Pages
- Router exports `new Hono<HonoEnv>()` instance
- Mounted at `/api/artworks` in main app

**Database:** D1 via `c.env.DB`
- Accessed as environment binding
- No separate URL columns (URLs generated on-the-fly)
- `image_key` column stores R2 object path

**R2 Integration:** Native binding `c.env.IMAGE_BUCKET`
- Endpoint verifies image exists before creating record
- Used via `.head()` method for existence check

**URL Generation:** Cloudflare Image Transformations
- CDN domain: `https://images.vfa.gallery`
- Format: `/cdn-cgi/image/width=X,quality=80,format=auto/originals/{userId}/{uuid}.jpg`
- Generated at response time using utility functions
- No URL fields stored in database

**Authentication:** `requireAuth` middleware + `getCurrentUser(c)`
- Returns user object with `userId` property
- Applies to POST route via middleware composition

**Error Handling:** `Errors` factory from `../errors`
- Centralized error creation: `Errors.badRequest()`, `Errors.unauthorized()`, etc.
- Consistent error response format across API

**ID Generation:** `crypto.randomUUID()`
- Cloudflare Workers native API (no external packages)
- Generates RFC 4122 UUIDs

**Types:** `HonoEnv` from `../../../types/env`
- Provides type safety for `c.env` bindings
- Includes D1Database, R2Bucket, other environment variables

### Design Decisions

1. **Image URLs Generated On-the-Fly**: Database stores only `image_key`, URLs are generated at response time using utility functions. This allows changing URL format/CDN without database migration.

2. **Slug Uniqueness Per User**: Slug is unique per user_id + slug combination, not globally. Allows users with same title to coexist with different slugs.

3. **Image Existence Verification**: Endpoint checks image exists in R2 before creating artwork record. Prevents database entries for missing images.

4. **No Image Processing Trigger**: Endpoint does not trigger image processing pipeline. Images must exist in R2 before endpoint call.

5. **Cloudflare Image Transformations**: Uses on-the-fly transformation format rather than pre-generated variants. Reduces storage and allows dynamic optimization.

---

## Related Build Steps

This endpoint depends on:
- **10-SCHEMA-ARTWORKS.md** - Table schema
- **16-API-MIDDLEWARE-AUTH.md** - Authentication
- Validation module with `validateArtworkCreate()`
- Image URL utility functions (`getThumbnailUrl()`, etc.)

---

## Summary

The artwork creation endpoint is fully implemented in the codebase, following Cloudflare Pages/Hono patterns with:
- Authentication requirement via middleware
- Input validation with comprehensive error messages
- Automatic unique slug generation per user
- Image verification in R2
- Artwork limit enforcement
- URLs generated on-the-fly using Cloudflare Image Transformations
- Proper HTTP status codes (201 for success, 4xx for errors)
- Database storage using only `image_key` column (no separate URL fields)

The endpoint is production-ready and integrated with the main Hono app.
