# 42-API-ARTWORK-LIST.md

## Goal
Create the GET `/api/artworks` endpoint that returns a paginated list of artworks belonging to the authenticated user. The endpoint supports filtering by category, status, and collection membership with efficient database queries.

---

## Spec Extract

From TECHNICAL-SPEC.md:
- **User Scoping**: Returns only artworks belonging to authenticated user
- **Pagination**: page and limit query parameters (default page=1, limit=20, max=100)
- **Filtering**: Optional category, status, and inCollection filters
- **Ordering**: Results ordered by created_at DESC (newest first)
- **Collection Filter**: Check if artwork is in any collection using collection_artworks join

Query parameters:
```
GET /api/artworks?page=1&limit=20&category=illustration&status=active&inCollection=true
```

Response schema:
```json
{
  "data": [
    {
      "id": "art_abc123",
      "userId": "usr_xyz789",
      "slug": "dragons-dawn",
      "title": "Dragon's Dawn",
      "description": "...",
      "materials": "...",
      "dimensions": "...",
      "createdDate": "2024-01",
      "category": "illustration",
      "tags": ["dragon", "fantasy"],
      "originalUrl": "...",
      "displayUrl": "...",
      "thumbnailUrl": "...",
      "iconUrl": "...",
      "status": "active",
      "isFeatured": false,
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 42,
    "totalPages": 3,
    "hasNextPage": true,
    "hasPreviousPage": false
  }
}
```

---

## Prerequisites

**Must complete before starting:**
- **41-API-ARTWORK-CREATE.md** - Artwork service and models defined
- **10-SCHEMA-ARTWORKS.md** - Artworks table created
- **09-SCHEMA-COLLECTIONS.md** - Collections table created (for collection_artworks join)

---

## Steps

### Step 1: Add List and Query Functions to Artwork Service

Update the artwork service module with list and query functions.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/services/artwork.ts`

Add these functions at the end of the file (before the main export functions):

```typescript
/**
 * Query parameters for listing artworks
 */
export interface ListArtworksParams {
  page: number
  pageSize: number
  category?: string
  status?: string
  inCollection?: boolean
}

/**
 * Result of listing artworks with pagination
 */
export interface ListArtworksResult {
  artworks: Artwork[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
    hasNextPage: boolean
    hasPreviousPage: boolean
  }
}

/**
 * Parse and validate list query parameters
 */
export function parseListParams(queryParams: Record<string, string>): ListArtworksParams {
  const page = Math.max(1, parseInt(queryParams.page || '1', 10))
  const pageSize = Math.min(100, Math.max(1, parseInt(queryParams.limit || '20', 10)))
  const category = queryParams.category?.trim() || undefined
  const status = queryParams.status?.trim() || undefined
  const inCollection = queryParams.inCollection === 'true'

  return { page, pageSize, category, status, inCollection }
}

/**
 * Get total count of artworks matching filters
 */
async function getArtworkCount(
  db: D1Database,
  userId: string,
  filters: Partial<ListArtworksParams>
): Promise<number> {
  let query = 'SELECT COUNT(*) as count FROM artworks WHERE user_id = ?'
  const params: any[] = [userId]

  // Filter by status
  if (filters.status) {
    query += ' AND status = ?'
    params.push(filters.status)
  }

  // Filter by category
  if (filters.category) {
    query += ' AND LOWER(category) = LOWER(?)'
    params.push(filters.category)
  }

  // Filter by collection membership
  if (filters.inCollection) {
    query += ' AND id IN (SELECT artwork_id FROM collection_artworks)'
  }

  const result = await db.prepare(query).bind(...params).first<{ count: number }>()
  return result?.count || 0
}

/**
 * List artworks for user with filters and pagination
 */
export async function listArtworks(
  db: D1Database,
  userId: string,
  params: ListArtworksParams
): Promise<ListArtworksResult> {
  const { page, pageSize, category, status, inCollection } = params

  // Get total count first
  const total = await getArtworkCount(db, userId, { category, status, inCollection })

  // Calculate pagination values
  const offset = (page - 1) * pageSize
  const totalPages = Math.ceil(total / pageSize)

  // Build main query
  let query = `
    SELECT
      id, user_id, slug, title, description, materials, dimensions,
      created_date, category, tags, original_url, display_url,
      thumbnail_url, icon_url, status, is_featured, created_at, updated_at
    FROM artworks
    WHERE user_id = ?
  `
  const params_arr: any[] = [userId]

  // Filter by status
  if (status) {
    query += ' AND status = ?'
    params_arr.push(status)
  }

  // Filter by category
  if (category) {
    query += ' AND LOWER(category) = LOWER(?)'
    params_arr.push(category)
  }

  // Filter by collection membership
  if (inCollection) {
    query += ' AND id IN (SELECT artwork_id FROM collection_artworks)'
  }

  // Order by created_at DESC (newest first)
  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
  params_arr.push(pageSize, offset)

  // Execute query
  const results = await db.prepare(query).bind(...params_arr).all<any>()

  // Convert database rows to Artwork objects
  const artworks: Artwork[] = results.results.map((row: any) => ({
    id: row.id,
    userId: row.user_id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    materials: row.materials,
    dimensions: row.dimensions,
    createdDate: row.created_date,
    category: row.category,
    tags: row.tags ? JSON.parse(row.tags) : undefined,
    originalUrl: row.original_url,
    displayUrl: row.display_url,
    thumbnailUrl: row.thumbnail_url,
    iconUrl: row.icon_url,
    status: row.status,
    isFeatured: Boolean(row.is_featured),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }))

  return {
    artworks,
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
  }
}
```

**Explanation:**
- `parseListParams()` validates and normalizes query parameters with sensible defaults
- `getArtworkCount()` counts artworks matching filters for pagination
- `listArtworks()` queries paginated artworks with optional filters
- Supports filtering by category (case-insensitive), status, and collection membership
- Results ordered by created_at DESC for consistency
- Pagination includes hasNextPage and hasPreviousPage for UI navigation

---

### Step 2: Add List Handler to Routes

Update the artwork routes file to add the list endpoint.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/artworks.ts`

Add this function before the `registerArtworkRoutes` function:

```typescript
import {
  validateCreateArtworkInput,
  createArtwork,
  parseListParams,
  listArtworks,
  type CreateArtworkInput,
} from '../services/artwork'

/**
 * GET /api/artworks
 * List artworks for the authenticated user with pagination and filtering
 *
 * Query parameters:
 * - page: number (default: 1) - Page number for pagination
 * - limit: number (default: 20, max: 100) - Items per page
 * - category: string (optional) - Filter by category (manga, comic, illustration, etc.)
 * - status: string (optional) - Filter by status (active, processing, deleted)
 * - inCollection: boolean (optional) - Only show artworks in collections (true/false)
 *
 * Example: GET /api/artworks?page=1&limit=20&category=illustration&inCollection=true
 *
 * Response: 200 OK
 * {
 *   "data": [ { artwork objects } ],
 *   "pagination": { page, pageSize, total, totalPages, hasNextPage, hasPreviousPage }
 * }
 */
export async function listArtworksHandler(c: HonoContext) {
  try {
    // Require authentication
    const user = requireCurrentUser(c)

    // Get database connection
    const db = c.env.DB as any

    if (!db) {
      throw Errors.internal('Database connection not available')
    }

    // Parse and validate query parameters
    const query = Object.fromEntries(c.req.query())
    const params = parseListParams(query)

    // Fetch artworks
    const result = await listArtworks(db, user.userId, params)

    // Return paginated response
    return c.json({
      data: result.artworks.map(art => ({
        id: art.id,
        userId: art.userId,
        slug: art.slug,
        title: art.title,
        description: art.description,
        materials: art.materials,
        dimensions: art.dimensions,
        createdDate: art.createdDate,
        category: art.category,
        tags: art.tags,
        originalUrl: art.originalUrl,
        displayUrl: art.displayUrl,
        thumbnailUrl: art.thumbnailUrl,
        iconUrl: art.iconUrl,
        status: art.status,
        isFeatured: art.isFeatured,
        createdAt: art.createdAt,
        updatedAt: art.updatedAt,
      })),
      pagination: result.pagination,
    })
  } catch (err) {
    throw err
  }
}
```

**Explanation:**
- Validates user authentication
- Parses and validates query parameters (page, limit, filters)
- Calls service to fetch paginated artworks
- Returns data array with pagination metadata

---

### Step 3: Update Route Registration

Update the `registerArtworkRoutes` function to include the list endpoint.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/artworks.ts`

Replace the `registerArtworkRoutes` function:

```typescript
/**
 * Register artwork creation routes
 * Call this function in the main app setup
 */
export function registerArtworkRoutes(app: any) {
  // GET /api/artworks - List user's artworks
  app.get('/artworks', requireAuth, listArtworksHandler)

  // POST /api/artworks - Create artwork
  app.post('/artworks', requireAuth, createArtworkHandler)
}
```

**Explanation:**
- GET endpoint for listing artworks (must come before POST to avoid routing conflicts)
- Both endpoints require authentication
- Handlers are chained after authentication middleware

---

## Files to Create/Modify

**Modified files:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/services/artwork.ts` - Add list functions
2. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/artworks.ts` - Add list handler and update route registration

**No new files needed** - Updates are to existing files from build 41.

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
    "message": "No authentication token provided"
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
    "totalPages": 0,
    "hasNextPage": false,
    "hasPreviousPage": false
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

Expected response (200 OK):
```json
{
  "data": [
    {
      "id": "art_abc123",
      "userId": "usr_test123",
      "slug": "dragons-dawn",
      "title": "Dragon's Dawn",
      "description": "A fierce dragon...",
      "materials": "Digital, Procreate",
      "dimensions": "3000x4000px",
      "createdDate": "2024-01",
      "category": "illustration",
      "tags": ["dragon", "fantasy"],
      "originalUrl": "https://...",
      "displayUrl": "https://...",
      "thumbnailUrl": "https://...",
      "iconUrl": "https://...",
      "status": "active",
      "isFeatured": false,
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 1,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPreviousPage": false
  }
}
```

---

### Test 5: Test Pagination With Multiple Results

Create 25+ artworks, then test pagination:

```bash
# First page
curl "http://localhost:8788/api/artworks?page=1&limit=20" \
  -H "Authorization: Bearer <valid-token>"

# Second page
curl "http://localhost:8788/api/artworks?page=2&limit=20" \
  -H "Authorization: Bearer <valid-token>"
```

Expected:
- Page 1: returns 20 items, hasNextPage=true, hasPreviousPage=false
- Page 2: returns remaining items, hasNextPage=false, hasPreviousPage=true

---

### Test 6: Test Category Filter

Create artworks with different categories:

```bash
curl -X POST http://localhost:8788/api/artworks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <valid-token>" \
  -d '{"title": "Comic 1", "category": "comic", "originalKey": "originals/usr_test123/comic1.jpg"}'

curl -X POST http://localhost:8788/api/artworks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <valid-token>" \
  -d '{"title": "Illustration 1", "category": "illustration", "originalKey": "originals/usr_test123/ill1.jpg"}'
```

Then filter:

```bash
# Get only comics
curl "http://localhost:8788/api/artworks?category=comic" \
  -H "Authorization: Bearer <valid-token>"

# Get only illustrations
curl "http://localhost:8788/api/artworks?category=illustration" \
  -H "Authorization: Bearer <valid-token>"
```

Expected: Returns only artworks matching the specified category.

---

### Test 7: Test Status Filter

Create artworks and update some to processing:

```bash
curl "http://localhost:8788/api/artworks?status=active" \
  -H "Authorization: Bearer <valid-token>"
```

Expected: Returns only artworks with status='active'.

---

### Test 8: Test Collection Filter

First, add an artwork to a collection:

```bash
wrangler d1 execute vfa-gallery --command="
INSERT INTO collection_artworks (collection_id, artwork_id, position)
VALUES ('col-1', 'art_abc123', 1);"
```

Then filter:

```bash
curl "http://localhost:8788/api/artworks?inCollection=true" \
  -H "Authorization: Bearer <valid-token>"
```

Expected: Returns only artworks that are in at least one collection.

---

### Test 9: Test Combined Filters

Request with multiple filters:

```bash
curl "http://localhost:8788/api/artworks?category=illustration&status=active&page=1&limit=10" \
  -H "Authorization: Bearer <valid-token>"
```

Expected: Returns paginated results matching all filters.

---

### Test 10: Test Page Size Limits

Request with invalid page size:

```bash
# Request with limit=1000 (exceeds max of 100)
curl "http://localhost:8788/api/artworks?limit=1000" \
  -H "Authorization: Bearer <valid-token>"
```

Expected: Returns results with pageSize capped at 100.

---

### Test 11: Test Invalid Page Number

Request with invalid page:

```bash
curl "http://localhost:8788/api/artworks?page=0" \
  -H "Authorization: Bearer <valid-token>"

curl "http://localhost:8788/api/artworks?page=-5" \
  -H "Authorization: Bearer <valid-token>"
```

Expected: Both default to page=1.

---

### Test 12: Test User Isolation

Create artworks with user1, then request with user2's token:

```bash
curl "http://localhost:8788/api/artworks" \
  -H "Authorization: Bearer <user2-token>"
```

Expected: Returns empty list. User2 cannot see User1's artworks.

---

### Test 13: Test Ordering (Newest First)

Create 3 artworks with delays between them. Request list:

```bash
curl "http://localhost:8788/api/artworks" \
  -H "Authorization: Bearer <valid-token>"
```

Expected: Results are ordered by created_at DESC (newest artwork first).

---

### Test 14: Verify Tags Are Parsed Correctly

Query database to confirm tags are stored as JSON:

```bash
wrangler d1 execute vfa-gallery --command="
SELECT id, tags FROM artworks WHERE id = 'art_abc123';"
```

Expected: tags column contains JSON string like `["dragon", "fantasy"]`.

Then verify the API response parses it back to array:

```bash
curl "http://localhost:8788/api/artworks" \
  -H "Authorization: Bearer <valid-token>" | jq '.data[0].tags'
```

Expected: Shows array `["dragon", "fantasy"]` not string.

---

## Summary

This build adds the artwork list endpoint with:
- User authentication and isolation
- Pagination with configurable page size (max 100)
- Filtering by category, status, and collection membership
- Case-insensitive category matching
- Newest-first ordering for better UX
- Comprehensive error handling
- Full TypeScript type safety

The endpoint efficiently queries the database with appropriate filters and returns consistent pagination metadata for UI navigation.

---

**Next step:** Proceed to **43-API-ARTWORK-GET.md** to implement fetching individual artwork details.
