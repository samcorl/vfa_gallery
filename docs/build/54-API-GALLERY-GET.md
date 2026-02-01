# 54-API-GALLERY-GET.md

## Goal

Create the `GET /api/galleries/:id` endpoint to retrieve a single gallery's detailed information including nested collections and theme, with ownership verification.

---

## Spec Extract

From TECHNICAL-SPEC.md - Gallery CRUD Operations:

- **Endpoint:** `GET /api/galleries/:id`
- **Authentication:** Required (JWT token)
- **Path Parameters:**
  - `id` - Gallery ID (required)
- **Response (200 OK):**
  ```json
  {
    "data": {
      "id": "gal_abc123",
      "userId": "user_xyz",
      "slug": "fantasy-art",
      "name": "Fantasy Art",
      "description": "My fantasy artwork",
      "welcomeMessage": "Welcome!",
      "themeId": "theme_dark",
      "isDefault": false,
      "status": "active",
      "theme": {
        "id": "theme_dark",
        "name": "Dark Mode",
        "config": {...}
      },
      "collections": [
        {
          "id": "col_abc123",
          "slug": "landscapes",
          "name": "Landscapes",
          "artworkCount": 12
        }
      ],
      "createdAt": "2026-01-18T12:00:00Z",
      "updatedAt": "2026-01-18T12:00:00Z"
    }
  }
  ```
- **Ownership:** Verify user_id matches JWT token (return 403 if not owner, or 404 to hide existence)
- **Nested Data:** Include full collection list with artwork counts
- **Theme Optional:** Include theme object only if themeId is set

---

## Prerequisites

**Must complete before starting:**
- **52-API-GALLERY-CREATE.md** - Gallery creation endpoint
- **09-SCHEMA-COLLECTIONS.md** - Collections table schema

---

## Steps

### Step 1: Create Collection Response Types

Create types for collections used in gallery detail response.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/types/collection.ts` (new file)

```typescript
/**
 * Collection type for API responses
 * Returned as nested data within galleries
 */
export interface Collection {
  id: string
  galleryId: string
  slug: string
  name: string
  description: string | null
  artworkCount: number
  createdAt: string
  updatedAt: string
}

/**
 * Database row type for collections (snake_case from SQLite)
 */
export interface CollectionRow {
  id: string
  gallery_id: string
  slug: string
  name: string
  description: string | null
  created_at: string
  updated_at: string
}

/**
 * Transform database row to API response
 */
export function collectionRowToApi(
  row: CollectionRow & { artworkCount: number }
): Collection {
  return {
    id: row.id,
    galleryId: row.gallery_id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    artworkCount: row.artworkCount,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
```

**Explanation:**
- `Collection` interface matches API response format (camelCase)
- `CollectionRow` matches SQLite schema (snake_case)
- `collectionRowToApi()` transforms with artwork count
- Includes artwork count per collection for summary info

---

### Step 2: Create Theme Response Types

Create types for themes used in gallery detail response.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/types/theme.ts` (new file)

```typescript
/**
 * Theme type for API responses
 * Returned as optional nested data within galleries
 */
export interface Theme {
  id: string
  name: string
  description?: string
  config?: Record<string, any>
  createdAt?: string
  updatedAt?: string
}

/**
 * Database row type for themes (snake_case from SQLite)
 */
export interface ThemeRow {
  id: string
  name: string
  description?: string
  config?: string // JSON string from database
  created_at?: string
  updated_at?: string
}

/**
 * Transform database row to API response
 */
export function themeRowToApi(row: ThemeRow): Theme {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    config: row.config ? JSON.parse(row.config) : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
```

**Explanation:**
- `Theme` interface for API response (camelCase)
- `ThemeRow` matches SQLite schema with config as JSON string
- `themeRowToApi()` parses JSON config field
- Theme is optional (only included if gallery has themeId)

---

### Step 3: Extend Gallery Type for Detailed Response

Update the gallery types to support nested collections and theme.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/types/gallery.ts`

Add these new types to the existing file:

```typescript
import type { Collection } from './collection'
import type { Theme } from './theme'

// ... existing types ...

/**
 * Gallery type with nested collections and theme
 * Used for detailed gallery GET response
 */
export interface GalleryDetail extends Gallery {
  collections?: Collection[]
  theme?: Theme
}

/**
 * Combine gallery with nested data
 */
export function createGalleryDetail(
  gallery: Gallery,
  collections?: Collection[],
  theme?: Theme
): GalleryDetail {
  return {
    ...gallery,
    collections,
    theme,
  }
}
```

**Explanation:**
- `GalleryDetail` extends `Gallery` with optional nested arrays/objects
- `createGalleryDetail()` helper combines gallery with related data
- Maintains separation: base gallery type unchanged, detail is an extension

---

### Step 4: Add Get Route to Galleries Router

Add the GET by ID handler to galleries.ts.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/galleries.ts`

Add this code after the POST and GET (list) handlers:

```typescript
// ... existing imports and POST/list routes ...

/**
 * GET /galleries/:id
 * Retrieve a single gallery with collections and theme
 * Requires ownership of the gallery
 */
galleriesRouter.get('/:id', requireAuth, async (c) => {
  const userId = c.get('userId') as string
  const galleryId = c.req.param('id')
  const db = c.env.DB

  if (!galleryId) {
    throw Errors.badRequest('Gallery ID is required')
  }

  // Fetch gallery by ID
  const gallery = await db
    .prepare('SELECT * FROM galleries WHERE id = ?')
    .bind(galleryId)
    .first<GalleryRow>()

  if (!gallery) {
    // Return 404 to hide existence from unauthorized users
    throw Errors.notFound('Gallery')
  }

  // Verify ownership: user_id must match JWT token
  if (gallery.user_id !== userId) {
    // Return 403 Forbidden (user is authenticated but not the owner)
    throw Errors.forbidden('You do not have permission to access this gallery')
  }

  // Convert gallery row to API response
  const galleryApi = galleryRowToApi(gallery)

  // Fetch nested collections with artwork counts
  const collectionsResult = await db
    .prepare(
      `
      SELECT
        c.id,
        c.gallery_id,
        c.slug,
        c.name,
        c.description,
        c.created_at,
        c.updated_at,
        COUNT(a.id) as artworkCount
      FROM collections c
      LEFT JOIN artworks a ON a.collection_id = c.id
      WHERE c.gallery_id = ?
      GROUP BY c.id
      ORDER BY c.created_at ASC
      `
    )
    .bind(galleryId)
    .all<CollectionRow & { artworkCount: number }>()

  let collections: Collection[] = []
  if (collectionsResult?.results) {
    const { collectionRowToApi } = await import('../../../types/collection')
    collections = collectionsResult.results.map(collectionRowToApi)
  }

  // Fetch theme if themeId is set
  let theme: Theme | undefined
  if (gallery.theme_id) {
    const themeResult = await db
      .prepare('SELECT * FROM themes WHERE id = ?')
      .bind(gallery.theme_id)
      .first<ThemeRow>()

    if (themeResult) {
      const { themeRowToApi } = await import('../../../types/theme')
      theme = themeRowToApi(themeResult)
    }
  }

  // Build detail response with nested data
  const { createGalleryDetail } = await import('../../../types/gallery')
  const galleryDetail = createGalleryDetail(galleryApi, collections, theme)

  return c.json({ data: galleryDetail }, 200)
})

export default galleriesRouter
```

**Explanation:**
- Validates galleryId parameter exists
- Fetches gallery by ID
- Returns 404 if gallery doesn't exist
- Verifies ownership: gallery.user_id must match JWT userId
- Returns 403 if user is authenticated but not the owner
- Fetches collections with LEFT JOIN to count artworks
- Fetches theme if gallery has themeId
- Combines all data into GalleryDetail response
- Includes all nested collections and theme information

---

### Step 5: Update Imports in Gallery Router

Update the imports at the top of galleries.ts to include new types:

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
  GalleryDetail,
  CreateGalleryRequest,
  GalleryRow,
  galleryRowToApi,
  galleryRowWithCountToApi,
  createGalleryDetail,
} from '../../../types/gallery'
import type { Collection, CollectionRow } from '../../../types/collection'
import type { Theme, ThemeRow } from '../../../types/theme'

// ... rest of file ...
```

**Explanation:**
- Adds imports for Collection, Theme, and GalleryDetail types
- Adds import for createGalleryDetail helper
- Enables type checking for nested data structures

---

### Step 6: Verify TypeScript Compilation

```bash
npx tsc --noEmit
```

Expected: No errors

---

## Files to Create/Modify

**New files to create:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/types/collection.ts`
2. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/types/theme.ts`

**Files to modify:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/types/gallery.ts` - Add `GalleryDetail` and `createGalleryDetail()`
2. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/galleries.ts` - Add GET by ID handler, update imports

---

## Verification

### Test 1: Get Non-Existent Gallery

```bash
curl http://localhost:8788/api/galleries/gal_nonexistent \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>"
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

### Test 2: Get Gallery Without Authentication

```bash
curl http://localhost:8788/api/galleries/gal_abc123
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

### Test 3: Get Gallery As Non-Owner

Create a gallery with User A. Then attempt to fetch it with User B's token:

```bash
# With User B token:
curl http://localhost:8788/api/galleries/gal_abc123 \
  -H "Authorization: Bearer <USER_B_TOKEN>"
```

Expected response (403):
```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "You do not have permission to access this gallery"
  }
}
```

---

### Test 4: Get Gallery As Owner (No Collections)

Create a gallery using 52-API-GALLERY-CREATE.md, then fetch it:

```bash
curl http://localhost:8788/api/galleries/gal_abc123 \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>"
```

Expected response (200):
```json
{
  "data": {
    "id": "gal_abc123",
    "userId": "user_xyz",
    "slug": "fantasy-art",
    "name": "Fantasy Art",
    "description": "My fantasy artwork",
    "welcomeMessage": "Welcome!",
    "themeId": null,
    "isDefault": false,
    "status": "active",
    "collections": [],
    "theme": null,
    "createdAt": "2026-01-18T12:00:00.000Z",
    "updatedAt": "2026-01-18T12:00:00.000Z"
  }
}
```

---

### Test 5: Get Gallery With Collections

Create collections inside a gallery (requires collection API endpoints), then fetch the gallery:

```bash
curl http://localhost:8788/api/galleries/gal_abc123 \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>"
```

Expected response (200):
```json
{
  "data": {
    "id": "gal_abc123",
    ...gallery fields...,
    "collections": [
      {
        "id": "col_abc",
        "galleryId": "gal_abc123",
        "slug": "landscapes",
        "name": "Landscapes",
        "description": "Landscape artwork",
        "artworkCount": 5,
        "createdAt": "2026-01-18T12:00:00.000Z",
        "updatedAt": "2026-01-18T12:00:00.000Z"
      }
    ]
  }
}
```

---

### Test 6: Get Gallery With Theme

Update gallery to have a theme (requires admin or theme assignment API), then fetch:

```bash
# First update gallery with theme_id in database:
wrangler d1 execute site --command="UPDATE galleries SET theme_id = 'theme_dark' WHERE id = 'gal_abc123';"

# Then fetch:
curl http://localhost:8788/api/galleries/gal_abc123 \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>"
```

Expected response (200):
```json
{
  "data": {
    "id": "gal_abc123",
    ...gallery fields...,
    "themeId": "theme_dark",
    "theme": {
      "id": "theme_dark",
      "name": "Dark Mode",
      "description": "A dark theme for galleries",
      "config": {...theme config...}
    }
  }
}
```

---

### Test 7: Collections Ordered by Created Time

Create multiple collections, then fetch gallery:

```bash
curl http://localhost:8788/api/galleries/gal_abc123 \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>"
```

Expected:
- Collections in `data.collections` array
- Ordered by `created_at` ascending (oldest first)

---

### Test 8: Artwork Count Accuracy

Create collections and artworks, then verify counts:

```bash
# Create collection with 3 artworks
# Then fetch gallery:
curl http://localhost:8788/api/galleries/gal_abc123 \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>"
```

Expected: Each collection has `artworkCount` matching number of artworks in that collection

---

### Test 9: Gallery Fields Complete

Fetch a gallery created with full details:

```bash
curl http://localhost:8788/api/galleries/gal_abc123 \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>"
```

Expected response includes all fields:
- id, userId, slug, name
- description, welcomeMessage
- themeId, isDefault, status
- collections, theme
- createdAt, updatedAt

---

### Test 10: Case Sensitivity

Create gallery with ID, then fetch with different case:

```bash
# Created with ID: gal_abc123
curl http://localhost:8788/api/galleries/GAL_ABC123 \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>"
```

Expected: Returns 404 (IDs are case-sensitive)

---

### Test 11: Database Verification

Query gallery directly in database:

```bash
wrangler d1 execute site --command="SELECT * FROM galleries WHERE id = 'gal_abc123';"
```

Expected: Returns gallery record with all fields matching API response

---

## Success Criteria

- [ ] GET /api/galleries/:id returns 401 without authentication
- [ ] GET /api/galleries/:id returns 404 for non-existent galleries
- [ ] GET /api/galleries/:id returns 403 when user is not the owner
- [ ] GET /api/galleries/:id returns 200 with full gallery data for owner
- [ ] Response includes nested collections array
- [ ] Collections include artwork counts
- [ ] Collections ordered by created_at ascending
- [ ] Theme object included when themeId is set
- [ ] Theme object omitted/null when themeId is not set
- [ ] All gallery fields present (id, userId, slug, name, description, welcomeMessage, etc.)
- [ ] isDefault converts from INTEGER to boolean
- [ ] createdAt and updatedAt are ISO format timestamps
- [ ] TypeScript compilation succeeds
- [ ] User can only access their own galleries

---

## Next Steps

Once this build is verified, proceed to **55-API-GALLERY-UPDATE.md** to add the endpoint for updating gallery details.

