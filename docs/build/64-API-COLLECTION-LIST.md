# 64-API-COLLECTION-LIST.md

## Goal
Create the `GET /api/galleries/:galleryId/collections` endpoint that returns a paginated list of collections in a gallery. Supports both authenticated users (who can see all their collections) and public access (who see only active/published collections).

---

## Spec Extract

From Phase 12 requirements:
- **Authentication**: Optional (behaves differently for owner vs. public)
- **Access Control**:
  - Gallery owner can see all their collections regardless of status
  - Non-owner can only see 'active' collections
- **Pagination**: Supports `page` and `limit` query parameters
- **Filtering**: Optional `status` query parameter to filter by status
- **Response**: List of collections with artwork count per collection
- **Ordering**: By position (if available) or created_at (newest first by default)

---

## Prerequisites

**Must complete before starting:**
- **15-API-FOUNDATION.md** - Hono app and error handling
- **16-API-MIDDLEWARE-AUTH.md** - Optional authentication middleware
- **63-API-COLLECTION-CREATE.md** - Collection creation (for reference)
- **09-SCHEMA-COLLECTIONS.md** - Collections table exists
- **10-SCHEMA-ARTWORKS.md** - collection_artworks junction table

---

## Steps

### Step 1: Update Collection Service with List Operations

Add collection list functionality to the service module.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/services/collection.service.ts`

Add these functions at the end of the existing file:

```typescript
export interface CollectionWithArtworkCount extends Collection {
  artwork_count: number
}

export interface PaginatedCollections {
  data: CollectionWithArtworkCount[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasMore: boolean
  }
}

/**
 * Get collections for a gallery with pagination
 * Owner can see all statuses, non-owner only sees 'active'
 */
export async function listCollections(
  db: Database,
  galleryId: string,
  userId: string | null, // null if not authenticated
  page: number = 1,
  limit: number = 20,
  status?: string
): Promise<PaginatedCollections> {
  // Validate pagination params
  if (page < 1) page = 1
  if (limit < 1) limit = 1
  if (limit > 100) limit = 100

  // Check gallery existence and ownership
  const gallery = await db
    .prepare('SELECT user_id FROM galleries WHERE id = ?')
    .bind(galleryId)
    .first<{ user_id: string }>()

  if (!gallery) {
    throw Errors.notFound('Gallery not found')
  }

  const isOwner = userId && userId === gallery.user_id

  // Build WHERE clause
  let whereConditions = ['c.gallery_id = ?']
  let bindParams: any[] = [galleryId]

  // If not owner, only show active collections
  if (!isOwner) {
    whereConditions.push("c.status = 'active'")
  }

  // If status filter provided and user is owner, apply it
  if (status && isOwner) {
    whereConditions.push('c.status = ?')
    bindParams.push(status)
  }

  const whereClause = whereConditions.join(' AND ')

  // Get total count
  const countResult = await db
    .prepare(
      `
      SELECT COUNT(*) as total
      FROM collections c
      WHERE ${whereClause}
      `
    )
    .bind(...bindParams)
    .first<{ total: number }>()

  const total = countResult?.total || 0
  const totalPages = Math.ceil(total / limit)

  // Get paginated results with artwork counts
  const offset = (page - 1) * limit

  const collections = await db
    .prepare(
      `
      SELECT
        c.id,
        c.gallery_id,
        c.slug,
        c.name,
        c.description,
        c.hero_image_url,
        c.theme_id,
        c.is_default,
        c.status,
        c.created_at,
        c.updated_at,
        COUNT(ca.id) as artwork_count
      FROM collections c
      LEFT JOIN collection_artworks ca ON c.id = ca.collection_id
      WHERE ${whereClause}
      GROUP BY c.id
      ORDER BY c.created_at DESC
      LIMIT ? OFFSET ?
      `
    )
    .bind(...bindParams, limit, offset)
    .all<CollectionWithArtworkCount>()

  if (!collections) {
    throw Errors.internal('Failed to fetch collections')
  }

  return {
    data: collections.results || [],
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasMore: page < totalPages,
    },
  }
}

/**
 * Get default collection for a gallery
 * Useful for redirects or quick access
 */
export async function getDefaultCollection(
  db: Database,
  galleryId: string
): Promise<Collection | null> {
  const collection = await db
    .prepare(
      `
      SELECT * FROM collections
      WHERE gallery_id = ? AND is_default = 1
      LIMIT 1
      `
    )
    .bind(galleryId)
    .first<Collection>()

  return collection || null
}
```

---

### Step 2: Create List Collection Route Handler

Add the list endpoint to the collections route handler.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/collections.ts`

Add this function to the existing file:

```typescript
import { listCollections } from '../services/collection.service'

/**
 * GET /api/galleries/:galleryId/collections
 * List collections in a gallery with pagination
 *
 * Query Parameters:
 * - page: number (default: 1, min: 1)
 * - limit: number (default: 20, min: 1, max: 100)
 * - status: string (optional, only works for gallery owner)
 *
 * Authentication: Optional
 * Response: { data: CollectionWithArtworkCount[], pagination: PaginationInfo }
 */
export async function handleListCollections(c: HonoContext) {
  try {
    const galleryId = c.req.param('galleryId')

    if (!galleryId) {
      throw Errors.badRequest('Gallery ID is required')
    }

    // Get current user (may be null if not authenticated)
    const currentUser = c.get('user')
    const userId = currentUser?.userId || null

    // Parse query parameters
    let page = 1
    let limit = 20
    let status: string | undefined

    const pageParam = c.req.query('page')
    if (pageParam) {
      const parsed = parseInt(pageParam, 10)
      if (isNaN(parsed)) {
        throw Errors.badRequest('page must be a valid number')
      }
      page = parsed
    }

    const limitParam = c.req.query('limit')
    if (limitParam) {
      const parsed = parseInt(limitParam, 10)
      if (isNaN(parsed)) {
        throw Errors.badRequest('limit must be a valid number')
      }
      limit = parsed
    }

    const statusParam = c.req.query('status')
    if (statusParam) {
      // Only allow certain status values
      const allowedStatuses = ['active', 'archived', 'draft']
      if (!allowedStatuses.includes(statusParam)) {
        throw Errors.badRequest(
          `status must be one of: ${allowedStatuses.join(', ')}`
        )
      }
      status = statusParam
    }

    // Get collections using service
    const db = c.env.DB
    const result = await listCollections(db, galleryId, userId, page, limit, status)

    return c.json(result)
  } catch (err) {
    if (err instanceof Error) {
      throw err
    }
    throw Errors.internal('Failed to list collections')
  }
}
```

---

### Step 3: Register List Route

Update the main Hono app to register the list endpoint.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/index.ts`

Add to the collection routes section (or create if not present):

```typescript
import { optionalAuth } from './middleware/auth'
import { handleCreateCollection, handleListCollections } from './routes/collections'

// ============================================
// Collection Routes (Phase 12)
// ============================================

app.post('/galleries/:galleryId/collections', requireAuth, handleCreateCollection)
app.get('/galleries/:galleryId/collections', optionalAuth, handleListCollections)
```

---

### Step 4: Verify Database Junction Table

Ensure the `collection_artworks` junction table exists (should be from Build 10).

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/migrations/0005_create_collection_artworks.sql` (or similar)

Should contain:

```sql
CREATE TABLE collection_artworks (
  id TEXT PRIMARY KEY,
  collection_id TEXT REFERENCES collections(id) ON DELETE CASCADE,
  artwork_id TEXT REFERENCES artworks(id) ON DELETE CASCADE,
  position INTEGER,
  added_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(collection_id, artwork_id)
);
```

If this table doesn't exist, create it before testing this endpoint.

---

## Files to Create/Modify

**Modified files:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/services/collection.service.ts` - Add list functions
2. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/collections.ts` - Add list handler
3. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/index.ts` - Register GET route with optionalAuth

---

## Verification

### Test 1: Compile TypeScript

```bash
cd /Volumes/DataSSD/gitsrc/vfa_gallery
npx tsc --noEmit
```

Expected: No type errors

---

### Test 2: List Collections (Unauthenticated)

```bash
curl http://localhost:8788/api/galleries/gal_test123/collections
```

Expected response (200):
```json
{
  "data": [
    {
      "id": "col_abc123def456",
      "gallery_id": "gal_test123",
      "slug": "dragon-series",
      "name": "Dragon Series",
      "description": "All my dragon artwork",
      "hero_image_url": null,
      "theme_id": null,
      "is_default": 0,
      "status": "active",
      "created_at": "2026-01-18T20:00:00.000Z",
      "updated_at": "2026-01-18T20:00:00.000Z",
      "artwork_count": 5
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1,
    "hasMore": false
  }
}
```

---

### Test 3: List Collections (Authenticated as Owner)

```bash
curl -H "Authorization: Bearer <owner-jwt-token>" \
  http://localhost:8788/api/galleries/gal_test123/collections
```

Expected: Same as Test 2 if all collections are 'active'. If owner has archived collections, they appear here too.

---

### Test 4: List Collections with Pagination

```bash
curl "http://localhost:8788/api/galleries/gal_test123/collections?page=2&limit=10"
```

Expected response (200):
```json
{
  "data": [
    // Next 10 collections...
  ],
  "pagination": {
    "page": 2,
    "limit": 10,
    "total": 25,
    "totalPages": 3,
    "hasMore": true
  }
}
```

---

### Test 5: List with Invalid Page Number

```bash
curl "http://localhost:8788/api/galleries/gal_test123/collections?page=invalid"
```

Expected response (400):
```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "page must be a valid number"
  }
}
```

---

### Test 6: List with Limit > 100

```bash
curl "http://localhost:8788/api/galleries/gal_test123/collections?limit=200"
```

Expected: Limit is capped at 100, returns up to 100 results

---

### Test 7: List with Status Filter (Non-Owner)

Non-owner attempts to use status filter:

```bash
curl "http://localhost:8788/api/galleries/gal_test123/collections?status=draft"
```

Expected: Status filter ignored, only 'active' collections returned

---

### Test 8: List with Status Filter (Owner)

Owner filters by specific status:

```bash
curl -H "Authorization: Bearer <owner-jwt-token>" \
  "http://localhost:8788/api/galleries/gal_test123/collections?status=archived"
```

Expected: Only archived collections returned

---

### Test 9: Non-Owner Sees Only Active Collections

Create multiple collections with different statuses (as owner):
- "Active Collection" (status: active)
- "Archived Collection" (status: archived)
- "Draft Collection" (status: draft)

List as non-owner:

```bash
curl http://localhost:8788/api/galleries/gal_test123/collections
```

Expected: Only "Active Collection" appears

List as owner:

```bash
curl -H "Authorization: Bearer <owner-jwt-token>" \
  http://localhost:8788/api/galleries/gal_test123/collections
```

Expected: All three collections appear

---

### Test 10: Artwork Count Calculation

Create collections and add artworks to them via collection_artworks table (or via Phase 13 APIs when available).

List collections:

```bash
curl http://localhost:8788/api/galleries/gal_test123/collections
```

Expected: Each collection shows correct `artwork_count` in response

---

### Test 11: Default Limit and Page

Request without pagination parameters:

```bash
curl http://localhost:8788/api/galleries/gal_test123/collections
```

Expected: Pagination shows `page: 1`, `limit: 20`

---

### Test 12: Non-Existent Gallery

```bash
curl http://localhost:8788/api/galleries/nonexistent/collections
```

Expected response (404):
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Gallery not found"
  }
}
```

---

### Test 13: Ordering by Created Date

Create collections in order: First, Second, Third

List collections:

```bash
curl http://localhost:8788/api/galleries/gal_test123/collections
```

Expected: Collections appear in reverse chronological order (Third, Second, First)

---

### Test 14: hasMore Flag

Create 25 collections, request with limit=10:

```bash
curl "http://localhost:8788/api/galleries/gal_test123/collections?limit=10&page=1"
```

Expected: `hasMore: true`

Page 3:

```bash
curl "http://localhost:8788/api/galleries/gal_test123/collections?limit=10&page=3"
```

Expected: `hasMore: false`

---

### Test 15: Empty Collection List

Delete all collections from a gallery, then list:

```bash
curl http://localhost:8788/api/galleries/gal_test123/collections
```

Expected response (200):
```json
{
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 0,
    "hasMore": false
  }
}
```

---

## Summary

This build adds collection listing functionality:
- Paginated collection retrieval with configurable page/limit
- Access control (owner sees all, non-owner sees only active)
- Artwork count aggregation per collection
- Optional authentication for different visibility levels
- Robust error handling and validation

The endpoint integrates with optional authentication to provide both public and personalized views of collections.

---

**Next step:** Proceed to **65-API-COLLECTION-GET.md** to add single collection retrieval with nested artworks.
