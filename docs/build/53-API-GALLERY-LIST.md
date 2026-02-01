# 53-API-GALLERY-LIST.md

## Goal

Create the `GET /api/galleries` endpoint to return a paginated list of the authenticated user's galleries, including collection counts per gallery.

---

## Spec Extract

From TECHNICAL-SPEC.md - Gallery CRUD Operations:

- **Endpoint:** `GET /api/galleries`
- **Authentication:** Required (JWT token)
- **Query Parameters:**
  - `page` - Page number (default: 1, min: 1)
  - `pageSize` - Results per page (default: 20, max: 100)
  - `status` - Filter by status: 'active', 'archived', 'draft' (optional)
- **Response (200 OK):**
  ```json
  {
    "data": [
      {
        "id": "gal_abc123",
        "userId": "user_xyz",
        "slug": "fantasy-art",
        "name": "Fantasy Art",
        "description": "My fantasy artwork",
        "welcomeMessage": "Welcome!",
        "themeId": null,
        "isDefault": false,
        "status": "active",
        "collectionCount": 3,
        "createdAt": "2026-01-18T12:00:00Z",
        "updatedAt": "2026-01-18T12:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "total": 45,
      "totalPages": 3,
      "hasNextPage": true,
      "hasPreviousPage": false
    },
    "meta": {
      "timestamp": "2026-01-18T12:05:00Z"
    }
  }
  ```
- **Default Gallery:** Returned first in list (is_default = 1)
- **Ordering:** Default gallery first, then by created_at DESC
- **Collection Count:** Number of collections in each gallery

---

## Prerequisites

**Must complete before starting:**
- **52-API-GALLERY-CREATE.md** - Gallery creation endpoint
- **09-SCHEMA-COLLECTIONS.md** - Collections table schema (for counting)

---

## Steps

### Step 1: Create Gallery Response Type with Collections

Extend the gallery type to include collection count.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/types/gallery.ts`

Update the existing file to add new types:

```typescript
// ... existing types ...

/**
 * Gallery type for API responses with collection count
 */
export interface GalleryWithCollections extends Gallery {
  collectionCount: number
}

/**
 * Transform database row with count to API response
 */
export function galleryRowWithCountToApi(
  row: GalleryRow & { collectionCount: number }
): GalleryWithCollections {
  return {
    ...galleryRowToApi(row as GalleryRow),
    collectionCount: row.collectionCount,
  }
}
```

**Explanation:**
- `GalleryWithCollections` extends `Gallery` with collection count
- `galleryRowWithCountToApi()` transforms database results including count
- Maintains separation of concerns: count is optional and added when needed

---

### Step 2: Add List Route to Galleries Router

Update the galleries.ts routes file to add the GET endpoint.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/galleries.ts`

Add this code after the POST handler:

```typescript
// ... existing imports and POST route ...

/**
 * GET /galleries
 * Retrieve paginated list of galleries for authenticated user
 * Query params: page, pageSize, status
 */
galleriesRouter.get('/', requireAuth, async (c) => {
  const userId = c.get('userId') as string
  const db = c.env.DB

  // Parse query parameters
  const pageParam = c.req.query('page') || '1'
  const pageSizeParam = c.req.query('pageSize') || '20'
  const statusParam = c.req.query('status')

  // Validate and sanitize pagination params
  const page = Math.max(1, parseInt(pageParam, 10))
  if (isNaN(page)) {
    throw Errors.badRequest('Parameter "page" must be a valid number')
  }

  const pageSize = Math.min(100, Math.max(1, parseInt(pageSizeParam, 10)))
  if (isNaN(pageSize)) {
    throw Errors.badRequest('Parameter "pageSize" must be a valid number')
  }

  // Validate status filter if provided
  const validStatuses = ['active', 'archived', 'draft']
  if (statusParam && !validStatuses.includes(statusParam)) {
    throw Errors.badRequest(
      `Parameter "status" must be one of: ${validStatuses.join(', ')}`
    )
  }

  // Build WHERE clause
  let whereClause = 'WHERE user_id = ?'
  const bindParams: any[] = [userId]

  if (statusParam) {
    whereClause += ' AND status = ?'
    bindParams.push(statusParam)
  }

  // Get total count
  const countQuery = `SELECT COUNT(*) as total FROM galleries ${whereClause}`
  const countResult = await db
    .prepare(countQuery)
    .bind(...bindParams)
    .first<{ total: number }>()

  const total = countResult?.total || 0

  if (total === 0) {
    // Return empty paginated response
    return c.json({
      data: [],
      pagination: {
        page,
        pageSize,
        total: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: false,
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    })
  }

  // Calculate offset
  const offset = (page - 1) * pageSize

  // Fetch galleries with collection counts
  // Use LEFT JOIN to count collections, with default galleries first
  const listQuery = `
    SELECT
      g.id,
      g.user_id,
      g.slug,
      g.name,
      g.description,
      g.welcome_message,
      g.theme_id,
      g.is_default,
      g.status,
      g.created_at,
      g.updated_at,
      COUNT(c.id) as collectionCount
    FROM galleries g
    LEFT JOIN collections c ON c.gallery_id = g.id
    ${whereClause}
    GROUP BY g.id
    ORDER BY g.is_default DESC, g.created_at DESC
    LIMIT ? OFFSET ?
  `

  const bindParamsList = [...bindParams, pageSize, offset]

  const rows = await db
    .prepare(listQuery)
    .bind(...bindParamsList)
    .all<GalleryRow & { collectionCount: number }>()

  if (!rows?.results) {
    throw Errors.internal('Failed to fetch galleries')
  }

  // Import galleryRowWithCountToApi here (or at top)
  const { galleryRowWithCountToApi } = await import('../../../types/gallery')

  const galleries = rows.results.map(galleryRowWithCountToApi)

  // Calculate pagination info
  const totalPages = Math.ceil(total / pageSize)
  const hasNextPage = page < totalPages
  const hasPreviousPage = page > 1

  return c.json({
    data: galleries,
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
      hasNextPage,
      hasPreviousPage,
    },
    meta: {
      timestamp: new Date().toISOString(),
    },
  })
})

export default galleriesRouter
```

**Explanation:**
- Parses and validates `page`, `pageSize`, and optional `status` query parameters
- Enforces pagination limits (page >= 1, pageSize 1-100)
- Validates status filter against allowed values
- Uses LEFT JOIN with collections table to count collections per gallery
- Orders by is_default DESC first (default gallery first), then created_at DESC
- Calculates pagination metadata (total pages, hasNextPage, hasPreviousPage)
- Returns empty array if user has no galleries
- Groups by gallery ID to handle collection counts in JOIN

---

### Step 3: Update Imports in Gallery Router

Ensure all necessary imports are at the top of galleries.ts:

```typescript
import { Hono } from 'hono'
import { nanoid } from 'nanoid'
import type { HonoEnv } from '../../../types/env'
import { ApiError, Errors } from '../errors'
import { requireAuth } from '../middleware/auth'
import { generateSlug, generateUniqueSlug } from '../utils/slug'
import {
  Gallery,
  GalleryWithCollections,
  CreateGalleryRequest,
  GalleryRow,
  galleryRowToApi,
  galleryRowWithCountToApi,
} from '../../../types/gallery'

// ... rest of file ...
```

**Explanation:**
- Adds import for `GalleryWithCollections` type
- Adds import for `galleryRowWithCountToApi` helper function

---

### Step 4: Verify TypeScript Compilation

```bash
npx tsc --noEmit
```

Expected: No errors

---

## Files to Create/Modify

**Files to modify:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/types/gallery.ts` - Add `GalleryWithCollections` and `galleryRowWithCountToApi()`
2. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/galleries.ts` - Add GET handler, update imports

**No new files to create**

---

## Verification

### Test 1: List Galleries (No Galleries)

Create a new test user account (or use one with no galleries), then:

```bash
curl http://localhost:8788/api/galleries \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>"
```

Expected response (200):
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
  },
  "meta": {
    "timestamp": "2026-01-18T12:05:00.000Z"
  }
}
```

---

### Test 2: List Galleries (With Data)

First create a few galleries using the POST endpoint from 52-API-GALLERY-CREATE.md, then list them:

```bash
curl http://localhost:8788/api/galleries \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>"
```

Expected response (200) showing galleries with collectionCount:
```json
{
  "data": [
    {
      "id": "gal_abc123",
      "userId": "user_xyz",
      "slug": "fantasy-art",
      "name": "Fantasy Art",
      "description": "My fantasy artwork",
      "welcomeMessage": "Welcome!",
      "themeId": null,
      "isDefault": false,
      "status": "active",
      "collectionCount": 0,
      "createdAt": "2026-01-18T12:00:00.000Z",
      "updatedAt": "2026-01-18T12:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 1,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPreviousPage": false
  },
  "meta": {
    "timestamp": "2026-01-18T12:05:00.000Z"
  }
}
```

---

### Test 3: Pagination - Page Parameter

```bash
curl http://localhost:8788/api/galleries?page=2&pageSize=5 \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>"
```

Expected response (200):
- Returns second page of 5 results
- `pagination.page` = 2
- `pagination.pageSize` = 5
- `pagination.hasPreviousPage` = true

---

### Test 4: Pagination - Invalid Page Number

```bash
curl http://localhost:8788/api/galleries?page=invalid \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>"
```

Expected response (400):
```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "Parameter \"page\" must be a valid number"
  }
}
```

---

### Test 5: Pagination - PageSize Limit

```bash
curl http://localhost:8788/api/galleries?pageSize=500 \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>"
```

Expected response (200):
- Actual pageSize is capped at 100 (not 500)
- `pagination.pageSize` = 100

---

### Test 6: Status Filter - Active Only

Create one active and one archived gallery. Then filter:

```bash
curl http://localhost:8788/api/galleries?status=active \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>"
```

Expected response (200):
- Returns only galleries with status 'active'
- `pagination.total` shows only active galleries count

---

### Test 7: Status Filter - Invalid Status

```bash
curl http://localhost:8788/api/galleries?status=invalid \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>"
```

Expected response (400):
```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "Parameter \"status\" must be one of: active, archived, draft"
  }
}
```

---

### Test 8: Default Gallery Ordering

Create multiple galleries where one is marked as default (is_default = 1). Then list:

```bash
curl http://localhost:8788/api/galleries \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>"
```

Expected response (200):
- First item in data array has `"isDefault": true`
- Other galleries follow in reverse chronological order (most recent first)

---

### Test 9: Collection Count

Create a gallery, then create collections inside it (requires completing 09-SCHEMA-COLLECTIONS.md and the collection API endpoints). Then list galleries:

```bash
curl http://localhost:8788/api/galleries \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>"
```

Expected response (200):
```json
{
  "data": [
    {
      ...gallery fields...,
      "collectionCount": 3
    }
  ]
}
```

---

### Test 10: Authentication Required

```bash
curl http://localhost:8788/api/galleries
```

Expected response (401):
```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required"
  }
}
```

---

### Test 11: User Isolation

Create galleries with two different user accounts. When listing galleries with User A's token, verify only User A's galleries are returned.

With User A token:
```bash
curl http://localhost:8788/api/galleries \
  -H "Authorization: Bearer <USER_A_TOKEN>"
```

Expected: Only User A's galleries in response

With User B token:
```bash
curl http://localhost:8788/api/galleries \
  -H "Authorization: Bearer <USER_B_TOKEN>"
```

Expected: Only User B's galleries in response, different set from User A

---

### Test 12: Database Verification

```bash
wrangler d1 execute site --command="SELECT g.id, g.name, g.user_id, COUNT(c.id) as collection_count FROM galleries g LEFT JOIN collections c ON c.gallery_id = g.id GROUP BY g.id;"
```

Expected: Shows all galleries with accurate collection counts

---

## Success Criteria

- [ ] GET /api/galleries endpoint returns 401 without authentication
- [ ] GET /api/galleries endpoint returns galleries list with 200 status when authenticated
- [ ] Empty list returns properly formatted response with zero pagination
- [ ] Pagination metadata is accurate (page, pageSize, total, totalPages, hasNextPage, hasPreviousPage)
- [ ] Page parameter works correctly and is validated
- [ ] PageSize parameter works correctly and is capped at 100
- [ ] Status filter returns only galleries with matching status
- [ ] Invalid status filter returns 400 error
- [ ] Default gallery (isDefault: true) appears first in list
- [ ] Other galleries ordered by created_at DESC
- [ ] Collection count is accurate for each gallery
- [ ] User can only see their own galleries
- [ ] Response includes all required fields (id, userId, slug, name, etc.)
- [ ] Response includes meta.timestamp
- [ ] TypeScript compilation succeeds

---

## Next Steps

Once this build is verified, proceed to **54-API-GALLERY-GET.md** to add the endpoint for retrieving a single gallery with details.

