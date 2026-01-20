# 77-API-PUBLIC-USER-GALLERIES.md

## Goal
Create the `GET /api/users/:username/galleries` endpoint that returns a paginated list of public galleries for a specific user. This endpoint displays only active galleries with their collection counts, allowing anyone to browse an artist's gallery collection.

---

## Spec Extract

From TECHNICAL-SPEC.md:
- **Endpoint:** `GET /api/users/:username/galleries`
- **Public Access:** No authentication required
- **Pagination:** page and pageSize query parameters
- **Response:** Array of gallery objects with basic info
- **Fields per gallery:** id, slug, name, welcome, theme, collectionCount
- **Filters:** Only active galleries
- **Error handling:** Return 404 if user not found
- **Return:** Paginated response with total count

---

## Prerequisites

**Must complete before starting:**
- **76-API-PUBLIC-USER.md** - Public user profile endpoint
- **08-SCHEMA-GALLERIES.md** - Galleries table with slug and active fields
- **09-SCHEMA-COLLECTIONS.md** - Collections table linked to galleries

**Reason:** Need public user endpoint for validation and galleries schema for queries.

---

## Steps

### Step 1: Create Database Query Helper for User's Galleries

Add to the users database module to fetch public galleries for a user.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/db/users.ts`

Add this interface at the top of the file:

```typescript
/**
 * Public gallery information for listing
 */
export interface PublicGalleryInfo {
  id: string
  slug: string
  name: string
  welcome: string | null
  theme: string | null
  collectionCount: number
}
```

Add this function after the `getPublicUserProfile` function:

```typescript
/**
 * Fetch paginated list of public galleries for a user
 * Returns only active galleries with collection counts
 * Returns empty array if user not found
 */
export async function getPublicUserGalleries(
  db: any,
  username: string,
  page: number = 1,
  pageSize: number = 20
): Promise<{
  galleries: PublicGalleryInfo[]
  total: number
}> {
  try {
    // First, get the user ID by username
    const user = await db
      .prepare('SELECT id FROM users WHERE username = ? AND status = "active" LIMIT 1')
      .bind(username)
      .first()

    if (!user) {
      return {
        galleries: [],
        total: 0,
      }
    }

    // Get total count of active galleries for this user
    const countResult = await db
      .prepare(
        `
        SELECT COUNT(*) as count
        FROM galleries
        WHERE userId = ? AND active = 1
        `
      )
      .bind(user.id)
      .first()

    const total = countResult?.count || 0

    // Calculate offset
    const offset = (page - 1) * pageSize

    // Fetch galleries for this page
    const galleries = await db
      .prepare(
        `
        SELECT
          g.id,
          g.slug,
          g.name,
          g.welcome,
          g.themeId,
          (SELECT COUNT(*) FROM collections WHERE galleryId = g.id AND active = 1) as collectionCount
        FROM galleries g
        WHERE g.userId = ? AND g.active = 1
        ORDER BY g.createdAt DESC
        LIMIT ? OFFSET ?
        `
      )
      .bind(user.id, pageSize, offset)
      .all()

    return {
      galleries: galleries.results?.map((g: any) => ({
        id: g.id,
        slug: g.slug,
        name: g.name,
        welcome: g.welcome,
        theme: g.themeId,
        collectionCount: g.collectionCount || 0,
      })) || [],
      total,
    }
  } catch (error) {
    console.error('[getPublicUserGalleries] Database error:', error)
    throw error
  }
}
```

**Explanation:**
- Validates user exists and is active
- Returns empty array if user not found (no 404 in query, handled by endpoint)
- Counts total active galleries for user
- Paginates results using LIMIT/OFFSET
- Counts collections per gallery using subquery
- Returns galleries ordered by creation date (newest first)

---

### Step 2: Create Paginated Galleries Endpoint

Add the galleries endpoint to the public users router.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/routes/public/users.ts`

Add these imports at the top:

```typescript
import {
  getPublicUserProfile,
  getPublicUserGalleries,
  type PublicGalleryInfo,
} from '../../lib/db/users'
import { parsePaginationParams } from '../../types/api'
```

Add this route to the publicUsersRouter (before the export):

```typescript
/**
 * GET /api/users/:username/galleries
 * Fetch paginated list of public galleries for a user
 * No authentication required
 * Returns 404 if user not found or inactive
 */
publicUsersRouter.get('/:username/galleries', async (c) => {
  const username = c.req.param('username')

  // Validate username parameter
  if (!username || username.trim().length === 0) {
    throw Errors.badRequest('Username is required')
  }

  // Parse pagination parameters from query string
  const queryParams = c.req.query()
  const { page = 1, pageSize = 20 } = parsePaginationParams(
    queryParams as Record<string, string>
  )

  try {
    // First verify user exists and is active
    const userProfile = await getPublicUserProfile(c.env.DB, username)

    if (!userProfile) {
      throw Errors.notFound(`User '${username}' not found`)
    }

    // Fetch paginated galleries
    const { galleries, total } = await getPublicUserGalleries(
      c.env.DB,
      username,
      page,
      pageSize
    )

    const totalPages = Math.ceil(total / pageSize)

    // Return paginated response
    return c.json(
      {
        data: galleries,
        pagination: {
          page,
          pageSize,
          total,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      },
      200
    )
  } catch (error) {
    // Re-throw ApiError instances
    if (error instanceof Error && 'statusCode' in error) {
      throw error
    }

    // Convert database errors to generic error
    console.error('[GET /api/users/:username/galleries] Error:', error)
    throw Errors.internal('Failed to fetch user galleries')
  }
})
```

**Explanation:**
- Route parameter `:username` captures username from URL
- Parses pagination parameters (page, pageSize) from query string
- Verifies user exists before fetching galleries
- Returns 404 if user not found
- Returns paginated gallery list with pagination metadata
- Galleries include id, slug, name, welcome, theme, collectionCount

---

### Step 3: Update Type Exports

Add gallery types to the type exports file.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/types/user.ts`

Add these interfaces:

```typescript
/**
 * Public gallery information for listing
 */
export interface PublicGalleryInfo {
  id: string
  slug: string
  name: string
  welcome: string | null
  theme: string | null
  collectionCount: number
}

/**
 * Paginated galleries response
 */
export interface PublicGalleriesResponse {
  data: PublicGalleryInfo[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
    hasNextPage: boolean
    hasPreviousPage: boolean
  }
  meta?: {
    timestamp?: string
  }
}
```

**Explanation:**
- Centralizes type definitions for consistency
- PublicGalleryInfo matches database query response
- PublicGalleriesResponse wraps data with pagination metadata

---

### Step 4: Create Integration Tests Helper

Create a test utility to verify the endpoint integration.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/test-helpers.ts`

```typescript
/**
 * Test helper: Fetch public galleries for a user
 * Used in tests and development
 */
export async function testFetchPublicGalleries(
  username: string,
  page: number = 1,
  pageSize: number = 20
) {
  const url = new URL(
    `http://localhost:8788/api/users/${encodeURIComponent(username)}/galleries`
  )
  url.searchParams.set('page', page.toString())
  url.searchParams.set('pageSize', pageSize.toString())

  const response = await fetch(url.toString())
  return response.json()
}
```

**Explanation:**
- Helper function for manual testing
- Constructs proper URL with pagination parameters
- Can be used in curl commands or test scripts

---

## Files to Create/Modify

**Files to modify:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/db/users.ts` - Add gallery query function and type
2. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/routes/public/users.ts` - Add galleries endpoint
3. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/types/user.ts` - Add gallery type exports

---

## Verification

### Test 1: Verify Endpoint with Valid User (No Pagination)

Assuming a test user has 3 active galleries:

```bash
curl "http://localhost:8788/api/users/testuser/galleries"
```

Expected response (200):
```json
{
  "data": [
    {
      "id": "gal_1",
      "slug": "landscape-photography",
      "name": "Landscape Photography",
      "welcome": "My landscape collection",
      "theme": null,
      "collectionCount": 4
    },
    {
      "id": "gal_2",
      "slug": "portraits",
      "name": "Portraits",
      "welcome": "People photography",
      "theme": "theme_dark",
      "collectionCount": 2
    },
    {
      "id": "gal_3",
      "slug": "street-art",
      "name": "Street Art",
      "welcome": null,
      "theme": null,
      "collectionCount": 1
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 3,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPreviousPage": false
  },
  "meta": {
    "timestamp": "2026-01-19T12:00:00.000Z"
  }
}
```

---

### Test 2: Verify Pagination Works

Assuming a user has 25 galleries:

```bash
curl "http://localhost:8788/api/users/testuser/galleries?page=1&pageSize=10"
```

Expected:
- `data` array has 10 items
- `pagination.total` is 25
- `pagination.totalPages` is 3
- `hasNextPage` is true
- `hasPreviousPage` is false

```bash
curl "http://localhost:8788/api/users/testuser/galleries?page=2&pageSize=10"
```

Expected:
- `data` array has 10 items
- `pagination.page` is 2
- `hasNextPage` is true
- `hasPreviousPage` is true

```bash
curl "http://localhost:8788/api/users/testuser/galleries?page=3&pageSize=10"
```

Expected:
- `data` array has 5 items
- `pagination.page` is 3
- `hasNextPage` is false
- `hasPreviousPage` is true

---

### Test 3: Verify 404 for Non-Existent User

```bash
curl "http://localhost:8788/api/users/nonexistentuser/galleries"
```

Expected response (404):
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "User 'nonexistentuser' not found"
  }
}
```

---

### Test 4: Verify Only Active Galleries Returned

Create a gallery for test user, mark it as `active = 0` in database, then:

```bash
curl "http://localhost:8788/api/users/testuser/galleries"
```

Expected: Inactive gallery does NOT appear in results.

---

### Test 5: Verify Collection Counts Are Accurate

For a gallery with 3 active collections:

```bash
curl "http://localhost:8788/api/users/testuser/galleries" | jq '.data[0].collectionCount'
```

Expected: Returns 3 (or actual count of active collections in database).

---

### Test 6: Verify Public Access (No Auth Required)

```bash
curl "http://localhost:8788/api/users/testuser/galleries"
```

Expected: Returns 200 without Authorization header required.

---

### Test 7: Verify Default Pagination Values

```bash
curl "http://localhost:8788/api/users/testuser/galleries"
```

Expected:
- `pagination.page` is 1
- `pagination.pageSize` is 20

---

## Summary

This build creates the public user galleries endpoint:
- Fetches paginated list of galleries for any user
- Returns only active galleries
- Includes collection count per gallery
- Full pagination metadata included
- Returns 404 if user not found or inactive
- No authentication required
- Foundation for displaying artist's galleries on public profile

---

**Next step:** Proceed to **78-UI-PUBLIC-ARTIST.md** to create the React component for displaying public artist profiles.
