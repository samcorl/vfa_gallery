# 42-API-ARTWORK-LIST.md

## Goal
Create the GET `/api/artworks` endpoint that returns a paginated list of artworks belonging to the authenticated user. The endpoint supports filtering by category and status with efficient D1 database queries.

---

## Spec Extract

**Endpoint:** `GET /api/artworks`

**Authentication:** Required (returns only authenticated user's artworks)

Query parameters:
```
GET /api/artworks?page=1&limit=20&category=illustration&status=active
```

- `page` (optional, default=1) - Page number for pagination
- `limit` (optional, default=20, max=100) - Items per page
- `category` (optional) - Filter by artwork category
- `status` (optional, default='active') - Filter by artwork status

Response schema:
```json
{
  "data": [
    {
      "id": "art_abc123",
      "userId": "usr_xyz789",
      "slug": "dragons-dawn",
      "title": "Dragon's Dawn",
      "description": "A fierce dragon in morning light",
      "materials": "Digital, Procreate",
      "dimensions": "3000x4000px",
      "createdDate": "2024-01",
      "category": "illustration",
      "tags": ["dragon", "fantasy"],
      "imageKey": "originals/usr_xyz789/abc123.jpg",
      "thumbnailUrl": "https://images.vfa.gallery/cdn-cgi/image/width=400,quality=80,format=auto/originals/usr_xyz789/abc123.jpg",
      "iconUrl": "https://images.vfa.gallery/cdn-cgi/image/width=128,height=128,fit=cover,quality=80,format=auto/originals/usr_xyz789/abc123.jpg",
      "displayUrl": "https://images.vfa.gallery/cdn-cgi/image/width=1200,quality=85,format=auto/originals/usr_xyz789/abc123.jpg",
      "isPublic": true,
      "status": "active",
      "isFeatured": false,
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 42,
    "totalPages": 3
  }
}
```

**Key behaviors:**
- Returns only artworks belonging to authenticated user
- Ordered by `created_at DESC` (newest first)
- Uses parameterized queries (NOT string interpolation)
- Generates image URLs at response time from stored `image_key`
- Pagination: valid pages 1 to totalPages, invalid page defaults to 1
- Max limit is 100 items per page

---

## Prerequisites

**Must complete before starting:**
- **41-API-ARTWORK-CREATE.md** - Artwork creation endpoint working
- **10-SCHEMA-ARTWORKS.md** - Artworks table created with proper columns
- Auth middleware configured and working

**Prerequisites already in place:**
- `HonoEnv` type defined at `/Volumes/DataSSD/gitsrc/vfa_gallery/src/types/env.ts`
- `Errors` factory at `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/errors.ts`
- Auth middleware (`requireAuth`, `getCurrentUser`) at `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/middleware/auth.ts`
- Image URL generators at `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/utils/imageUrls.ts`
- Existing artworks router at `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/artworks.ts`

---

## Steps

### Step 1: Add the List Handler to Artworks Router

Update the existing artworks router to include the GET / handler.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/artworks.ts`

Add this handler before the `export { artworks }` statement at the end of the file:

```typescript
/**
 * GET /api/artworks
 * List artworks for the authenticated user with pagination and filtering
 *
 * Query parameters:
 * - page: number (default: 1) - Page number for pagination
 * - limit: number (default: 20, max: 100) - Items per page
 * - category: string (optional) - Filter by category (manga, comic, illustration, etc.)
 * - status: string (optional, default: 'active') - Filter by status (active, processing, deleted)
 *
 * Example: GET /api/artworks?page=1&limit=20&category=illustration&status=active
 *
 * Returns 200 OK with paginated response
 */
artworks.get('/', requireAuth, async (c) => {
  const authUser = getCurrentUser(c)
  if (!authUser) {
    throw Errors.unauthorized('Authentication required')
  }

  const db = c.env.DB
  if (!db) {
    throw Errors.internal('Database connection not available')
  }

  // Parse and validate query parameters
  const page = Math.max(1, parseInt(c.req.query('page') || '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt(c.req.query('limit') || '20', 10)))
  const category = c.req.query('category')?.trim() || undefined
  const status = c.req.query('status')?.trim() || 'active'

  // Calculate pagination
  const offset = (page - 1) * limit

  // Build the COUNT query to get total
  let countQuery = 'SELECT COUNT(*) as count FROM artworks WHERE user_id = ?'
  const countParams: unknown[] = [authUser.userId]

  if (status) {
    countQuery += ' AND status = ?'
    countParams.push(status)
  }

  if (category) {
    countQuery += ' AND LOWER(category) = LOWER(?)'
    countParams.push(category)
  }

  // Execute count query
  const countResult = await db
    .prepare(countQuery)
    .bind(...countParams)
    .first<{ count: number }>()

  const total = countResult?.count || 0
  const totalPages = Math.ceil(total / limit)

  // Build the main SELECT query
  let selectQuery = `
    SELECT
      id, user_id, slug, title, description, materials, dimensions,
      created_date, category, tags, image_key, is_public, status,
      is_featured, created_at, updated_at
    FROM artworks
    WHERE user_id = ?
  `
  const selectParams: unknown[] = [authUser.userId]

  if (status) {
    selectQuery += ' AND status = ?'
    selectParams.push(status)
  }

  if (category) {
    selectQuery += ' AND LOWER(category) = LOWER(?)'
    selectParams.push(category)
  }

  // Order by created_at DESC and apply pagination
  selectQuery += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
  selectParams.push(limit, offset)

  // Execute select query
  const result = await db
    .prepare(selectQuery)
    .bind(...selectParams)
    .all<any>()

  // Map database rows to response objects with generated URLs
  const artworks_data = (result.results || []).map((row: any) => ({
    id: row.id,
    userId: row.user_id,
    slug: row.slug,
    title: row.title,
    description: row.description || null,
    materials: row.materials || null,
    dimensions: row.dimensions || null,
    createdDate: row.created_date || null,
    category: row.category,
    tags: row.tags ? JSON.parse(row.tags) : [],
    imageKey: row.image_key,
    thumbnailUrl: getThumbnailUrl(row.image_key),
    iconUrl: getIconUrl(row.image_key),
    displayUrl: getDisplayUrl(row.image_key),
    isPublic: Boolean(row.is_public),
    status: row.status,
    isFeatured: Boolean(row.is_featured),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }))

  return c.json({
    data: artworks_data,
    pagination: {
      page,
      pageSize: limit,
      total,
      totalPages,
    },
  })
})
```

**Explanation:**
- `requireAuth` middleware ensures only authenticated users can access the endpoint
- `getCurrentUser(c)` retrieves the authenticated user from context
- Query parameters are parsed with sensible defaults (page=1, limit=20, status='active')
- Limit is capped at 100 items per page
- Two separate queries: COUNT for pagination metadata, SELECT for the actual data
- Parameterized queries prevent SQL injection
- Image URLs are generated at response time using the three URL helper functions
- Results ordered by `created_at DESC` for newest-first display
- Tags stored as JSON in DB are parsed back to arrays in response

---

## Files to Create/Modify

**Modified files:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/artworks.ts` - Add GET / handler

**No new files needed** - The handler is added directly to the existing artworks router.

---

## Verification

### Test 1: Verify TypeScript Compilation

```bash
npx tsc --noEmit
```

Expected: No type errors.

---

### Test 2: Test List Without Authentication

Request without token:

```bash
curl http://localhost:8788/api/artworks
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

### Test 3: Test List With Empty Results

With valid token, request when user has no artworks:

```bash
curl http://localhost:8788/api/artworks \
  -H "Authorization: Bearer <valid-token>"
```

Expected response (200 OK):
```json
{
  "data": [],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 0,
    "totalPages": 0
  }
}
```

---

### Test 4: Test List With Artworks

First, create some artworks using build 41. Then request:

```bash
curl http://localhost:8788/api/artworks \
  -H "Authorization: Bearer <valid-token>"
```

Expected response (200 OK) includes artworks with generated URLs:
- `thumbnailUrl` contains `/cdn-cgi/image/width=400,quality=80,format=auto/`
- `iconUrl` contains `/cdn-cgi/image/width=128,height=128,fit=cover,quality=80,format=auto/`
- `displayUrl` contains `/cdn-cgi/image/width=1200,quality=85,format=auto/`

---

### Test 5: Test Pagination

Create 25+ artworks, then test pagination:

```bash
# First page (20 items default)
curl "http://localhost:8788/api/artworks?page=1&limit=20" \
  -H "Authorization: Bearer <valid-token>" | jq '.pagination'

# Second page
curl "http://localhost:8788/api/artworks?page=2&limit=20" \
  -H "Authorization: Bearer <valid-token>" | jq '.pagination'
```

Expected:
- Page 1: `pageSize: 20, total: 25+, totalPages: 2+`
- Page 2: Returns remaining items
- Both show correct `page` number

---

### Test 6: Test Page Size Limits

Request with invalid page size:

```bash
# Request with limit=1000 (exceeds max of 100)
curl "http://localhost:8788/api/artworks?limit=1000" \
  -H "Authorization: Bearer <valid-token>" | jq '.pagination.pageSize'
```

Expected: `pageSize: 100` (capped at max)

---

### Test 7: Test Category Filter

Create artworks with different categories, then filter:

```bash
# Get only illustrations
curl "http://localhost:8788/api/artworks?category=illustration" \
  -H "Authorization: Bearer <valid-token>" | jq '.data | length'
```

Expected: Returns only artworks matching the category (case-insensitive).

---

### Test 8: Test Status Filter

Create artworks with different statuses, then filter:

```bash
# Get only active artworks
curl "http://localhost:8788/api/artworks?status=active" \
  -H "Authorization: Bearer <valid-token>" | jq '.data[0].status'
```

Expected: All returned artworks have `status: 'active'`.

---

### Test 9: Test Combined Filters

Request with multiple filters:

```bash
curl "http://localhost:8788/api/artworks?category=illustration&status=active&page=1&limit=10" \
  -H "Authorization: Bearer <valid-token>" | jq '.pagination'
```

Expected: Returns paginated results matching all filters.

---

### Test 10: Test Ordering (Newest First)

Create 3 artworks with delays between them. Request list:

```bash
curl "http://localhost:8788/api/artworks" \
  -H "Authorization: Bearer <valid-token>" | jq '.data | map(.createdAt)'
```

Expected: Results are in descending order by `createdAt` (newest first).

---

### Test 11: Test User Isolation

Create artworks with user1, then request with user2's token:

```bash
curl "http://localhost:8788/api/artworks" \
  -H "Authorization: Bearer <user2-token>" | jq '.data | length'
```

Expected: Returns empty list or only user2's artworks. User2 cannot see User1's artworks.

---

### Test 12: Test Image URLs Generation

Get an artwork and verify the URLs:

```bash
curl "http://localhost:8788/api/artworks" \
  -H "Authorization: Bearer <valid-token>" | jq '.data[0] | {imageKey, thumbnailUrl, iconUrl, displayUrl}'
```

Expected output shows:
```json
{
  "imageKey": "originals/usr_xyz789/abc123.jpg",
  "thumbnailUrl": "https://images.vfa.gallery/cdn-cgi/image/width=400,quality=80,format=auto/originals/usr_xyz789/abc123.jpg",
  "iconUrl": "https://images.vfa.gallery/cdn-cgi/image/width=128,height=128,fit=cover,quality=80,format=auto/originals/usr_xyz789/abc123.jpg",
  "displayUrl": "https://images.vfa.gallery/cdn-cgi/image/width=1200,quality=85,format=auto/originals/usr_xyz789/abc123.jpg"
}
```

---

### Test 13: Test Tags Parsing

Verify tags are properly parsed from JSON:

```bash
curl "http://localhost:8788/api/artworks" \
  -H "Authorization: Bearer <valid-token>" | jq '.data[0].tags'
```

Expected: Shows array like `["dragon", "fantasy"]` (not a string).

---

## Notes

**D1 Query Details:**
- Uses `.first()` for COUNT queries (returns single row with count aggregate)
- Uses `.all()` for SELECT queries (returns array of results)
- Parameterized binding prevents SQL injection
- LOWER() function ensures case-insensitive category matching

**Performance Considerations:**
- Two queries per request (COUNT + SELECT) to support pagination
- Could be optimized with WINDOW functions if D1 supports them
- Consider indexing on `user_id`, `status`, `category` columns for large datasets

**Image URL Generation:**
- URLs are generated at response time from the stored `image_key`
- No database modification needed
- Three preset sizes cover common use cases: thumbnail (400px), icon (128x128), display (1200px)
- URLs use Cloudflare Image Resizing API for efficient transformation

**Error Handling:**
- 401 if not authenticated
- 500 if DB connection unavailable
- All other validation errors logged at server

---

## Summary

This build adds the artwork list endpoint with:
- User authentication and isolation
- Pagination with configurable page size (max 100)
- Filtering by category and status
- Case-insensitive category matching
- Newest-first ordering
- Generated image URLs at response time
- Full TypeScript type safety
- Parameterized SQL queries

The endpoint efficiently queries D1 with pagination support and returns consistent metadata for client-side navigation.

---

**Next step:** Proceed to **43-API-ARTWORK-GET.md** to implement fetching individual artwork details.
