# 80-API-PUBLIC-GALLERY.md

## Goal
Create the `GET /api/g/:artist/:gallery` endpoint that fetches detailed information about a specific gallery by artist username and gallery slug. Returns public gallery data including theme, welcome message, and collection count.

---

## Spec Extract

From TECHNICAL-SPEC.md:
- **Endpoint:** `GET /api/g/:artist/:gallery`
- **Parameters:** `:artist` (username), `:gallery` (slug)
- **Public Access:** No authentication required
- **Response:** Gallery object with all public fields
- **Fields included:** id, slug, name, welcome, theme, artist info (name, username, avatar), collectionCount
- **Error handling:** Return 404 if gallery not found or not active
- **Lookup:** Resolve by username + gallery slug
- **Return:** Single gallery object with artist details

---

## Prerequisites

**Must complete before starting:**
- **76-API-PUBLIC-USER.md** - Public user profile endpoint
- **08-SCHEMA-GALLERIES.md** - Galleries table with slug and active fields
- **09-SCHEMA-COLLECTIONS.md** - Collections table for counting

**Reason:** Need gallery schema and user lookups for endpoint implementation.

---

## Steps

### Step 1: Create Database Query Helper for Public Gallery

Add to the users database module a function to fetch gallery details.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/db/galleries.ts` (new file)

```typescript
import type { HonoContext } from '../../types/env'
import { Errors } from '../api/errors'

/**
 * Artist information included in gallery response
 */
export interface ArtistInfo {
  username: string
  displayName: string | null
  avatarUrl: string | null
}

/**
 * Public gallery details
 */
export interface PublicGalleryDetails {
  id: string
  slug: string
  name: string
  welcome: string | null
  theme: string | null
  collectionCount: number
  artist: ArtistInfo
}

/**
 * Fetch public gallery by artist username and gallery slug
 * Returns null if gallery not found, not active, or artist not found
 */
export async function getPublicGalleryDetails(
  db: any,
  artistUsername: string,
  gallerySlug: string
): Promise<PublicGalleryDetails | null> {
  try {
    // Query gallery with artist information in one query
    const gallery = await db
      .prepare(
        `
        SELECT
          g.id,
          g.slug,
          g.name,
          g.welcome,
          g.themeId,
          u.username,
          u.displayName,
          u.avatarUrl
        FROM galleries g
        JOIN users u ON g.userId = u.id
        WHERE g.slug = ?
          AND u.username = ?
          AND g.active = 1
          AND u.status = 'active'
        LIMIT 1
        `
      )
      .bind(gallerySlug, artistUsername)
      .first()

    if (!gallery) {
      return null
    }

    // Count active collections in this gallery
    const collectionResult = await db
      .prepare(
        `
        SELECT COUNT(*) as count
        FROM collections
        WHERE galleryId = ? AND active = 1
        `
      )
      .bind(gallery.id)
      .first()

    const collectionCount = collectionResult?.count || 0

    // Build response object
    return {
      id: gallery.id,
      slug: gallery.slug,
      name: gallery.name,
      welcome: gallery.welcome,
      theme: gallery.themeId,
      collectionCount,
      artist: {
        username: gallery.username,
        displayName: gallery.displayName,
        avatarUrl: gallery.avatarUrl,
      },
    }
  } catch (error) {
    console.error('[getPublicGalleryDetails] Database error:', error)
    throw error
  }
}
```

**Explanation:**
- Joins galleries and users tables for single query
- Filters by gallery slug, artist username, both active
- Counts active collections with subquery
- Returns null if any condition fails
- Includes artist information in response

---

### Step 2: Create Public Galleries API Router

Create a new router for public gallery endpoints.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/routes/public/galleries.ts`

```typescript
import { Hono } from 'hono'
import type { HonoContext } from '../../types/env'
import { Errors } from '../../lib/api/errors'
import { getPublicGalleryDetails } from '../../lib/db/galleries'

const publicGalleriesRouter = new Hono<HonoContext['Bindings']>()

/**
 * GET /api/g/:artist/:gallery
 * Fetch public gallery details by artist username and gallery slug
 * No authentication required
 * Returns 404 if gallery not found or not active
 */
publicGalleriesRouter.get('/:artist/:gallery', async (c) => {
  const artist = c.req.param('artist')
  const gallery = c.req.param('gallery')

  // Validate parameters
  if (!artist || artist.trim().length === 0) {
    throw Errors.badRequest('Artist username is required')
  }

  if (!gallery || gallery.trim().length === 0) {
    throw Errors.badRequest('Gallery slug is required')
  }

  if (artist.length > 50) {
    throw Errors.badRequest('Artist username must be 50 characters or less')
  }

  if (gallery.length > 100) {
    throw Errors.badRequest('Gallery slug must be 100 characters or less')
  }

  try {
    // Fetch gallery details
    const galleryDetails = await getPublicGalleryDetails(
      c.env.DB,
      artist,
      gallery
    )

    // Return 404 if gallery not found
    if (!galleryDetails) {
      throw Errors.notFound(`Gallery '${gallery}' not found`)
    }

    // Return gallery with cache headers (optional 1 hour cache)
    return c.json(
      {
        data: galleryDetails,
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
    console.error('[GET /api/g/:artist/:gallery] Error:', error)
    throw Errors.internal('Failed to fetch gallery')
  }
})

export { publicGalleriesRouter }
```

**Explanation:**
- Route parameters `:artist` and `:gallery` capture URL parts
- Validates both parameters are present and reasonable length
- Calls database helper to fetch gallery details
- Returns 404 if gallery not found or not active
- Returns 200 with gallery object including artist info
- Converts database errors to generic error

---

### Step 3: Register Public Galleries Router in Main API

Update the main API app to include the public galleries router.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/index.ts`

Add this import at the top:

```typescript
import { publicGalleriesRouter } from '../../routes/public/galleries'
```

Add this route registration after the users router:

```typescript
// Public API routes (no authentication required)
app.route('/users', publicUsersRouter)
app.route('/g', publicGalleriesRouter)
```

**Explanation:**
- `/g` route prefix for "gallery"
- Requests to `/api/g/:artist/:gallery` are routed to the handler
- Registered as public route (no auth)

---

### Step 4: Create TypeScript Type Exports

Export the gallery types for use in components.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/types/gallery.ts` (update if exists)

```typescript
/**
 * Artist information embedded in gallery responses
 */
export interface GalleryArtist {
  username: string
  displayName: string | null
  avatarUrl: string | null
}

/**
 * Public gallery details
 */
export interface PublicGalleryDetails {
  id: string
  slug: string
  name: string
  welcome: string | null
  theme: string | null
  collectionCount: number
  artist: GalleryArtist
}

/**
 * API response envelope for gallery details
 */
export interface PublicGalleryResponse {
  data: PublicGalleryDetails
  meta?: {
    timestamp?: string
  }
}
```

**Explanation:**
- Centralizes gallery type definitions
- Can be imported in frontend components
- Ensures consistency across codebase

---

### Step 5: Create Test Helper Function

Create a utility function for testing the endpoint.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/test-helpers.ts` (update if exists)

Add this function:

```typescript
/**
 * Test helper: Fetch public gallery details
 * Used in tests and development
 */
export async function testFetchPublicGallery(
  artistUsername: string,
  gallerySlug: string
) {
  const url = `/api/g/${encodeURIComponent(artistUsername)}/${encodeURIComponent(
    gallerySlug
  )}`
  const response = await fetch(url)
  return response.json()
}
```

**Explanation:**
- Helper function for manual testing
- Properly encodes URL parameters
- Can be used in curl commands or test scripts

---

## Files to Create/Modify

**New files to create:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/db/galleries.ts`
2. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/routes/public/galleries.ts`
3. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/types/gallery.ts`

**Files to modify:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/index.ts` - Register public galleries router
2. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/test-helpers.ts` - Add test helper (if file exists)

---

## Verification

### Test 1: Verify Endpoint with Valid Gallery

Assuming test user "testuser" has gallery with slug "landscape-photography":

```bash
curl http://localhost:8788/api/g/testuser/landscape-photography
```

Expected response (200):
```json
{
  "data": {
    "id": "gal_1",
    "slug": "landscape-photography",
    "name": "Landscape Photography",
    "welcome": "My landscape collection from around the world",
    "theme": null,
    "collectionCount": 4,
    "artist": {
      "username": "testuser",
      "displayName": "Test User",
      "avatarUrl": "https://example.com/avatar.jpg"
    }
  },
  "meta": {
    "timestamp": "2026-01-19T12:00:00.000Z"
  }
}
```

---

### Test 2: Verify 404 for Non-Existent Gallery

```bash
curl http://localhost:8788/api/g/testuser/nonexistent-gallery
```

Expected response (404):
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Gallery 'nonexistent-gallery' not found"
  }
}
```

---

### Test 3: Verify 404 for Non-Existent Artist

```bash
curl http://localhost:8788/api/g/nonexistentuser/any-gallery
```

Expected response (404):
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Gallery 'any-gallery' not found"
  }
}
```

---

### Test 4: Verify Inactive Gallery Returns 404

Mark a gallery as `active = 0` in database:

```bash
curl http://localhost:8788/api/g/testuser/inactive-gallery
```

Expected response (404):
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Gallery 'inactive-gallery' not found"
  }
}
```

---

### Test 5: Verify Artist Information Is Included

```bash
curl http://localhost:8788/api/g/testuser/landscape-photography | jq '.data.artist'
```

Expected: Object with username, displayName, and avatarUrl.

---

### Test 6: Verify Collection Count Is Accurate

Gallery has 3 active collections:

```bash
curl http://localhost:8788/api/g/testuser/landscape-photography | jq '.data.collectionCount'
```

Expected: Returns 3 (or actual count in database).

---

### Test 7: Verify Parameter Validation

Test with missing artist parameter:

```bash
curl http://localhost:8788/api/g//landscape-photography
```

Expected response (400):
```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "Artist username is required"
  }
}
```

---

### Test 8: Verify Public Access (No Auth Required)

```bash
curl http://localhost:8788/api/g/testuser/landscape-photography
```

Expected: Returns 200 without Authorization header required.

---

### Test 9: Verify Case Sensitivity

Create gallery with slug "landscape-photography":

```bash
curl http://localhost:8788/api/g/testuser/Landscape-Photography
```

Expected: Either 404 (if slug is case-sensitive) or 200 (depends on database collation).

---

### Test 10: Verify URL Encoding

Test with artist containing special characters:

```bash
curl http://localhost:8788/api/g/test%40user/gallery-slug
```

Expected: Properly decoded and handled.

---

## Summary

This build creates the public gallery endpoint:
- Fetches gallery details by artist username and slug
- Includes artist information in response
- Returns collection count per gallery
- 404 for non-existent or inactive galleries
- No authentication required
- Single efficient database query with join
- Foundation for displaying individual gallery pages

---

**Next step:** Proceed to **81-UI-PUBLIC-GALLERY.md** to create the React component for displaying a specific gallery.
