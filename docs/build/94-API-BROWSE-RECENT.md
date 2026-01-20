# 94-API-BROWSE-RECENT.md

## Goal
Create the `GET /api/browse/recent` endpoint that returns a paginated list of recently posted artworks. This endpoint powers infinite scroll on the browse page, allowing users to discover new artwork in chronological order.

---

## Spec Extract

From Phase 18 requirements:
- **Authentication**: Public (no auth required)
- **Pagination**: Supports page and limit parameters
- **Ordering**: Newest artworks first (by created_at DESC)
- **Filters**: Only active artworks from active galleries
- **Response**: Includes pagination metadata

---

## Prerequisites

**Must complete before starting:**
- **15-API-FOUNDATION.md** - Hono app and error handling
- **06-SCHEMA-GALLERIES.md** - Galleries table
- **10-SCHEMA-ARTWORKS.md** - Artworks table with created_at and status
- **05-SCHEMA-USERS.md** - Users table for artist names

---

## Steps

### Step 1: Add Recent Artwork Query to Browse Service

Update the browse service with pagination support.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/services/browse.service.ts`

Add these interfaces and functions:

```typescript
export interface ArtworkPreview {
  id: string
  slug: string
  title: string
  artist_name: string
  artist_username: string
  category: string | null
  image_url: string
  thumbnail_url: string | null
  gallery_id: string
  created_at: string
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

/**
 * Get paginated recent artworks
 * Ordered by created_at DESC (newest first)
 */
export async function getRecentArtworks(
  db: Database,
  page: number = 1,
  limit: number = 20
): Promise<PaginatedResponse<ArtworkPreview>> {
  // Validate pagination parameters
  page = Math.max(1, Math.min(page, Number.MAX_SAFE_INTEGER))
  limit = Math.max(1, Math.min(limit, 100)) // Max 100 per request

  const offset = (page - 1) * limit

  // Get total count
  const countResult = await db
    .prepare(
      `
      SELECT COUNT(*) as total
      FROM artworks a
      JOIN galleries g ON a.gallery_id = g.id
      JOIN users u ON g.user_id = u.id
      WHERE a.status = 'active'
      AND g.status = 'active'
      AND u.status = 'active'
      `
    )
    .first<{ total: number }>()

  const total = countResult?.total || 0
  const pages = Math.ceil(total / limit)

  // Get paginated artworks
  const artworks = await db
    .prepare(
      `
      SELECT
        a.id,
        a.slug,
        a.title,
        a.artist_name,
        u.username as artist_username,
        a.category,
        a.image_url,
        a.thumbnail_url,
        a.gallery_id,
        a.created_at
      FROM artworks a
      JOIN galleries g ON a.gallery_id = g.id
      JOIN users u ON g.user_id = u.id
      WHERE a.status = 'active'
      AND g.status = 'active'
      AND u.status = 'active'
      ORDER BY a.created_at DESC, a.id DESC
      LIMIT ? OFFSET ?
      `
    )
    .bind(limit, offset)
    .all<ArtworkPreview>()

  return {
    data: artworks?.results || [],
    pagination: {
      page,
      limit,
      total,
      pages,
    },
  }
}
```

---

### Step 2: Create Recent Artwork Route Handler

Add handler to the browse routes file.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/browse.ts`

Add this function:

```typescript
import { getRecentArtworks, PaginatedResponse, ArtworkPreview } from '../services/browse.service'

/**
 * GET /api/browse/recent
 * Get paginated list of recently posted artworks
 *
 * Query Parameters:
 * - page: number (default: 1)
 * - limit: number (default: 20, max: 100)
 *
 * Authentication: Public (no auth required)
 * Response: PaginatedResponse<ArtworkPreview>
 */
export async function handleGetRecentArtworks(c: HonoContext) {
  try {
    const page = Math.max(1, parseInt(c.req.query('page') || '1', 10))
    const limit = Math.max(
      1,
      Math.min(parseInt(c.req.query('limit') || '20', 10), 100)
    )

    // Validate parameters
    if (isNaN(page) || isNaN(limit)) {
      throw Errors.badRequest('Page and limit must be valid numbers')
    }

    const db = c.env.DB

    const result = await getRecentArtworks(db, page, limit)

    return c.json(result, {
      headers: {
        'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
      },
    })
  } catch (err) {
    if (err instanceof Error) {
      throw err
    }
    throw Errors.internal('Failed to retrieve recent artworks')
  }
}
```

---

### Step 3: Register Recent Route

Add the route to the main Hono app.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/index.ts`

Update the browse routes section:

```typescript
import { handleGetFeaturedContent, handleGetRecentArtworks } from './routes/browse'

// ============================================
// Browse Routes (Phase 18)
// ============================================

app.get('/browse/featured', handleGetFeaturedContent)
app.get('/browse/recent', handleGetRecentArtworks)
```

---

### Step 4: Add Database Indexes

Optimize query performance for recent artworks.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/schema/migrations.sql`

```sql
-- Index for recent artworks query
CREATE INDEX IF NOT EXISTS idx_artworks_created_status
  ON artworks(status, created_at DESC, id DESC);

-- Index for joining with galleries
CREATE INDEX IF NOT EXISTS idx_galleries_status
  ON galleries(id, status);
```

---

## Files to Create/Modify

**Modified files:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/services/browse.service.ts` - Add recent artworks query
2. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/browse.ts` - Add recent artworks handler
3. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/index.ts` - Register GET /api/browse/recent
4. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/schema/migrations.sql` - Add indexes

---

## Verification

### Test 1: Compile TypeScript

```bash
cd /Volumes/DataSSD/gitsrc/vfa_gallery
npx tsc --noEmit
```

Expected: No type errors

---

### Test 2: Get Recent Artworks (Default Pagination)

```bash
curl http://localhost:8788/api/browse/recent
```

Expected response (200):
```json
{
  "data": [
    {
      "id": "art_001",
      "slug": "dragon-portrait",
      "title": "Dragon Portrait",
      "artist_name": "Sam Corl",
      "artist_username": "sam-corl",
      "category": "illustration",
      "image_url": "https://r2.example.com/dragon-portrait.jpg",
      "thumbnail_url": "https://r2.example.com/dragon-portrait-thumb.jpg",
      "gallery_id": "gal_123",
      "created_at": "2026-01-19T10:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "pages": 8
  }
}
```

---

### Test 3: Get Specific Page

```bash
curl "http://localhost:8788/api/browse/recent?page=2&limit=10"
```

Expected response: Second page with 10 items (if available)

---

### Test 4: Custom Limit

```bash
curl "http://localhost:8788/api/browse/recent?limit=50"
```

Expected: Returns up to 50 items (respects limit parameter)

---

### Test 5: Limit Maximum Enforcement

```bash
curl "http://localhost:8788/api/browse/recent?limit=200"
```

Expected: Returns maximum 100 items (limit capped at 100)

---

### Test 6: Invalid Page Parameter

```bash
curl "http://localhost:8788/api/browse/recent?page=abc"
```

Expected response (400):
```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "Page and limit must be valid numbers"
  }
}
```

---

### Test 7: Out of Range Page

```bash
curl "http://localhost:8788/api/browse/recent?page=999"
```

Expected response (200): Empty data array with correct pagination

---

### Test 8: Ordering by Created Date

Create 3 artworks with created_at timestamps: 2026-01-19, 2026-01-18, 2026-01-17

```bash
curl "http://localhost:8788/api/browse/recent?limit=3"
```

Expected: Artworks ordered newest first (2026-01-19, 2026-01-18, 2026-01-17)

---

### Test 9: Inactive Artworks Excluded

Create an active and inactive artwork. Get recent:

```bash
curl "http://localhost:8788/api/browse/recent"
```

Expected: Only active artwork appears

---

### Test 10: Inactive Gallery Excluded

Create artwork in inactive gallery. Get recent:

```bash
curl "http://localhost:8788/api/browse/recent"
```

Expected: Artwork from inactive gallery does NOT appear

---

### Test 11: Inactive User Excluded

Create artwork from user with status='inactive'. Get recent:

```bash
curl "http://localhost:8788/api/browse/recent"
```

Expected: Artwork from inactive user does NOT appear

---

### Test 12: Pagination Accuracy

Create exactly 25 artworks. Get with limit=10:

```bash
curl "http://localhost:8788/api/browse/recent?limit=10"
# Page 1
curl "http://localhost:8788/api/browse/recent?page=2&limit=10"
# Page 2
curl "http://localhost:8788/api/browse/recent?page=3&limit=10"
# Page 3
```

Expected:
- Page 1: 10 items, pages=3
- Page 2: 10 items
- Page 3: 5 items

---

### Test 13: Total Count Accuracy

Create 42 artworks:

```bash
curl "http://localhost:8788/api/browse/recent" | jq '.pagination.total'
```

Expected: `42`

---

### Test 14: Artist Username Present

Get recent artworks and verify artist_username field:

```bash
curl "http://localhost:8788/api/browse/recent" | jq '.data[0].artist_username'
```

Expected: Valid username string (not null)

---

### Test 15: Cache Headers

```bash
curl -i "http://localhost:8788/api/browse/recent"
```

Expected headers:
- `Cache-Control: public, max-age=300`
- `Content-Type: application/json`

---

### Test 16: Empty Results

Create database with no active artworks:

```bash
curl "http://localhost:8788/api/browse/recent"
```

Expected:
```json
{
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "pages": 0
  }
}
```

---

## Summary

This build creates the `/api/browse/recent` endpoint that returns paginated recent artworks. Key features:

- Public endpoint with no authentication required
- Pagination support with page and limit parameters
- Respects status filters (active artwork in active gallery by active user)
- Ordered by created_at DESC (newest first)
- Caching headers for client-side caching
- Efficient database queries with proper indexes
- Pagination metadata (total, pages, current page)

The endpoint enables infinite scroll on the browse page, allowing users to discover new artwork as it's posted.

---

**Next step:** Proceed to **95-API-BROWSE-CATEGORIES.md** to add category filtering.
