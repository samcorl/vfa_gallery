# 100-API-SEARCH.md

## Goal
Create the `GET /api/search` endpoint that performs full-text search on artwork titles, descriptions, and tags. Supports filtering by artist, category, and date range with pagination.

---

## Spec Extract

From Phase 18 requirements:
- **Authentication**: Public (no auth required)
- **Search Parameters**:
  - `q`: Search query (required if no other filters)
  - `artist`: Filter by artist username
  - `category`: Filter by category
  - `from`: Start date (ISO 8601)
  - `to`: End date (ISO 8601)
  - `page`: Page number (default: 1)
  - `limit`: Items per page (default: 20, max: 100)
- **Search Fields**: title, description, tags
- **Pagination**: Returns pagination metadata

---

## Prerequisites

**Must complete before starting:**
- **15-API-FOUNDATION.md** - Hono app and error handling
- **10-SCHEMA-ARTWORKS.md** - Artworks table with full-text search support
- **06-SCHEMA-GALLERIES.md** - Galleries table
- **05-SCHEMA-USERS.md** - Users table

---

## Steps

### Step 1: Add Search Functions to Browse Service

Update the browse service with full-text search capability.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/services/browse.service.ts`

Add these functions:

```typescript
export interface SearchFilters {
  q?: string
  artist?: string
  category?: string
  from?: string // ISO 8601 date
  to?: string // ISO 8601 date
  page?: number
  limit?: number
}

/**
 * Search artworks with full-text and filter support
 */
export async function searchArtworks(
  db: Database,
  filters: SearchFilters
): Promise<PaginatedResponse<ArtworkPreview>> {
  const {
    q = '',
    artist = null,
    category = null,
    from = null,
    to = null,
    page = 1,
    limit = 20,
  } = filters

  // At least one search criterion required
  if (!q && !artist && !category && !from && !to) {
    throw Errors.badRequest(
      'At least one search parameter is required (q, artist, category, from, or to)'
    )
  }

  // Validate pagination
  const validPage = Math.max(1, Math.min(page, Number.MAX_SAFE_INTEGER))
  const validLimit = Math.max(1, Math.min(limit, 100))
  const offset = (validPage - 1) * validLimit

  // Build WHERE clause
  let whereConditions = [
    'a.status = \'active\'',
    'g.status = \'active\'',
    'u.status = \'active\'',
  ]

  const params: any[] = []

  // Full-text search on title, description, tags
  if (q) {
    // Simple full-text search using LIKE
    whereConditions.push(
      '(a.title LIKE ? OR a.description LIKE ? OR a.tags LIKE ?)'
    )
    const searchPattern = `%${q}%`
    params.push(searchPattern, searchPattern, searchPattern)
  }

  // Filter by artist username
  if (artist) {
    whereConditions.push('u.username = ?')
    params.push(artist)
  }

  // Filter by category
  if (category) {
    whereConditions.push('a.category = ?')
    params.push(category)
  }

  // Filter by date range
  if (from) {
    whereConditions.push('a.created_at >= ?')
    params.push(from)
  }

  if (to) {
    whereConditions.push('a.created_at <= ?')
    params.push(to)
  }

  const whereClause = whereConditions.join(' AND ')

  // Get total count
  const countResult = await db
    .prepare(
      `
      SELECT COUNT(*) as total
      FROM artworks a
      JOIN galleries g ON a.gallery_id = g.id
      JOIN users u ON g.user_id = u.id
      WHERE ${whereClause}
      `
    )
    .bind(...params)
    .first<{ total: number }>()

  const total = countResult?.total || 0
  const pages = Math.ceil(total / validLimit)

  // Get paginated results
  const results = await db
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
      WHERE ${whereClause}
      ORDER BY a.created_at DESC, a.id DESC
      LIMIT ? OFFSET ?
      `
    )
    .bind(...params, validLimit, offset)
    .all<ArtworkPreview>()

  return {
    data: results?.results || [],
    pagination: {
      page: validPage,
      limit: validLimit,
      total,
      pages,
    },
  }
}
```

---

### Step 2: Create Search Route Handler

Add search endpoint handler to the browse routes.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/browse.ts`

Add this function:

```typescript
import { searchArtworks, SearchFilters } from '../services/browse.service'

/**
 * GET /api/search
 * Search artworks with full-text and filter support
 *
 * Query Parameters:
 * - q: string (search query - searches title, description, tags)
 * - artist: string (filter by artist username)
 * - category: string (filter by category)
 * - from: string (ISO 8601 date, filter from date)
 * - to: string (ISO 8601 date, filter to date)
 * - page: number (default: 1)
 * - limit: number (default: 20, max: 100)
 *
 * Authentication: Public (no auth required)
 * Response: PaginatedResponse<ArtworkPreview>
 */
export async function handleSearch(c: HonoContext) {
  try {
    const q = c.req.query('q') || undefined
    const artist = c.req.query('artist') || undefined
    const category = c.req.query('category') || undefined
    const from = c.req.query('from') || undefined
    const to = c.req.query('to') || undefined

    const page = Math.max(1, parseInt(c.req.query('page') || '1', 10))
    const limit = Math.max(
      1,
      Math.min(parseInt(c.req.query('limit') || '20', 10), 100)
    )

    // Validate date parameters
    if (from && isNaN(new Date(from).getTime())) {
      throw Errors.badRequest('Invalid "from" date format. Use ISO 8601.')
    }

    if (to && isNaN(new Date(to).getTime())) {
      throw Errors.badRequest('Invalid "to" date format. Use ISO 8601.')
    }

    // Validate page and limit
    if (isNaN(page) || isNaN(limit)) {
      throw Errors.badRequest('Page and limit must be valid numbers')
    }

    const filters: SearchFilters = {
      q,
      artist,
      category,
      from,
      to,
      page,
      limit,
    }

    const db = c.env.DB
    const result = await searchArtworks(db, filters)

    return c.json(result, {
      headers: {
        'Cache-Control': 'public, max-age=60', // Cache for 1 minute
      },
    })
  } catch (err) {
    if (err instanceof Error) {
      throw err
    }
    throw Errors.internal('Search failed')
  }
}
```

---

### Step 3: Add Full-Text Search Indexes

Optimize search performance with database indexes.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/schema/migrations.sql`

```sql
-- Add search index for full-text search
-- Note: SQLite doesn't have native full-text search like PostgreSQL
-- Using LIKE queries with indexes on relevant columns

CREATE INDEX IF NOT EXISTS idx_artworks_title
  ON artworks(title COLLATE NOCASE);

CREATE INDEX IF NOT EXISTS idx_artworks_tags
  ON artworks(tags COLLATE NOCASE);

CREATE INDEX IF NOT EXISTS idx_artworks_created_artist
  ON artworks(created_at DESC, artist_name);

-- Index for artist filtering in search
CREATE INDEX IF NOT EXISTS idx_galleries_user_status
  ON galleries(user_id, status);

CREATE INDEX IF NOT EXISTS idx_users_username
  ON users(username COLLATE NOCASE);
```

---

### Step 4: Register Search Route

Add the search endpoint to the main Hono app.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/index.ts`

Update the browse routes section:

```typescript
import {
  handleGetFeaturedContent,
  handleGetRecentArtworks,
  handleGetCategories,
  handleGetArtworksByCategory,
  handleSearch,
} from './routes/browse'

// ============================================
// Browse Routes (Phase 18)
// ============================================

app.get('/browse/featured', handleGetFeaturedContent)
app.get('/browse/recent', handleGetRecentArtworks)
app.get('/browse/categories', handleGetCategories)
app.get('/browse/categories/:category', handleGetArtworksByCategory)
app.get('/search', handleSearch)
```

---

## Files to Create/Modify

**Modified files:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/services/browse.service.ts` - Add search function
2. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/browse.ts` - Add search handler
3. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/index.ts` - Register GET /api/search
4. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/schema/migrations.sql` - Add search indexes

---

## Verification

### Test 1: Compile TypeScript

```bash
cd /Volumes/DataSSD/gitsrc/vfa_gallery
npx tsc --noEmit
```

Expected: No type errors

---

### Test 2: Search by Query

```bash
curl "http://localhost:8788/api/search?q=dragon"
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
      "created_at": "2026-01-10T14:30:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 5,
    "pages": 1
  }
}
```

---

### Test 3: Search with No Parameters

```bash
curl "http://localhost:8788/api/search"
```

Expected response (400):
```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "At least one search parameter is required (q, artist, category, from, or to)"
  }
}
```

---

### Test 4: Filter by Artist

```bash
curl "http://localhost:8788/api/search?artist=sam-corl"
```

Expected: Returns all artworks by sam-corl

---

### Test 5: Filter by Category

```bash
curl "http://localhost:8788/api/search?category=manga"
```

Expected: Returns all manga artworks

---

### Test 6: Combined Filters

```bash
curl "http://localhost:8788/api/search?q=dragon&artist=sam-corl&category=illustration"
```

Expected: Returns artworks matching all criteria

---

### Test 7: Date Range Filter (From)

```bash
curl "http://localhost:8788/api/search?from=2026-01-01"
```

Expected: Returns artworks created on or after 2026-01-01

---

### Test 8: Date Range Filter (To)

```bash
curl "http://localhost:8788/api/search?to=2026-01-31"
```

Expected: Returns artworks created on or before 2026-01-31

---

### Test 9: Date Range (From and To)

```bash
curl "http://localhost:8788/api/search?from=2026-01-01&to=2026-01-31"
```

Expected: Returns artworks within the month of January 2026

---

### Test 10: Invalid Date Format

```bash
curl "http://localhost:8788/api/search?from=invalid-date"
```

Expected response (400):
```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "Invalid \"from\" date format. Use ISO 8601."
  }
}
```

---

### Test 11: Pagination

```bash
curl "http://localhost:8788/api/search?q=art&page=1&limit=10"
curl "http://localhost:8788/api/search?q=art&page=2&limit=10"
```

Expected: First page returns 10 results, second page returns next 10

---

### Test 12: Limit Maximum

```bash
curl "http://localhost:8788/api/search?q=art&limit=200"
```

Expected: Returns maximum 100 results (limit capped)

---

### Test 13: Search in Title

Create artwork with title "Sunset Landscape":

```bash
curl "http://localhost:8788/api/search?q=sunset"
```

Expected: Returns artwork with matching title

---

### Test 14: Search in Description

Create artwork with description "This is a beautiful landscape":

```bash
curl "http://localhost:8788/api/search?q=beautiful"
```

Expected: Returns artwork with matching description

---

### Test 15: Search in Tags

Create artwork with tags "landscape,nature,forest":

```bash
curl "http://localhost:8788/api/search?q=forest"
```

Expected: Returns artwork with matching tag

---

### Test 16: Case Insensitive Search

```bash
curl "http://localhost:8788/api/search?q=DRAGON"
curl "http://localhost:8788/api/search?q=dragon"
```

Expected: Both queries return same results (case insensitive)

---

### Test 17: Partial Match

Create artwork "Dragon's Lair":

```bash
curl "http://localhost:8788/api/search?q=drag"
```

Expected: Returns artwork (partial word match)

---

### Test 18: No Results

```bash
curl "http://localhost:8788/api/search?q=xyznonexistent123"
```

Expected response (200):
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

### Test 19: Inactive Artworks Excluded

Create inactive artwork with matching query:

```bash
curl "http://localhost:8788/api/search?q=dragon"
```

Expected: Inactive artwork NOT in results

---

### Test 20: Results Ordering

Create multiple matching artworks with different created_at dates:

```bash
curl "http://localhost:8788/api/search?q=art"
```

Expected: Results ordered by created_at DESC (newest first)

---

## Summary

This build creates the `/api/search` endpoint with:

- Full-text search on title, description, and tags
- Filtering by artist, category, and date range
- Pagination support
- Case-insensitive search
- Partial word matching
- Status filtering (active only)
- Database indexes for performance
- Proper validation and error handling
- HTTP caching headers

The search endpoint enables users to discover artworks through multiple search criteria and filters.

---

**Next step:** Proceed to **101-UI-SEARCH-PAGE.md** to build the search UI.
