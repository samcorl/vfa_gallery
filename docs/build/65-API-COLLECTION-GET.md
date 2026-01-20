# 65-API-COLLECTION-GET.md

## Goal
Create the `GET /api/collections/:id` endpoint that retrieves a single collection with all its details including nested artworks, their positions, and associated theme information. Supports both public access (active collections) and authenticated owner access (any status).

---

## Spec Extract

From Phase 12 requirements:
- **Authentication**: Optional (behaves differently for owner vs. public)
- **Access Control**:
  - Gallery owner can see their collection regardless of status
  - Non-owner can only see 'active' collections
- **Response Includes**:
  - Complete collection metadata (name, description, hero_image, theme)
  - List of artworks in collection with positions
  - Artwork details (id, slug, title, image URLs)
  - Related theme information if set

---

## Prerequisites

**Must complete before starting:**
- **15-API-FOUNDATION.md** - Hono app and error handling
- **16-API-MIDDLEWARE-AUTH.md** - Optional authentication middleware
- **63-API-COLLECTION-CREATE.md** - Collection creation
- **64-API-COLLECTION-LIST.md** - Collection listing (for reference)
- **09-SCHEMA-COLLECTIONS.md** - Collections table
- **10-SCHEMA-ARTWORKS.md** - Artworks and collection_artworks tables

---

## Steps

### Step 1: Add Get Collection Functions to Service

Update the collection service with single collection retrieval.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/services/collection.service.ts`

Add these functions at the end of the existing file:

```typescript
export interface CollectionArtwork {
  id: string
  artwork_id: string
  collection_id: string
  position: number
  added_at: string
  // Nested artwork details
  artwork: {
    id: string
    slug: string
    title: string
    description?: string
    image_url: string
    thumbnail_url?: string
    artist_name: string
    created_at: string
  }
}

export interface CollectionDetail extends Collection {
  artworks: CollectionArtwork[]
  theme?: {
    id: string
    name: string
    primary_color?: string
    secondary_color?: string
  }
}

/**
 * Get a single collection by ID with all nested data
 * Verifies ownership through gallery chain
 */
export async function getCollectionById(
  db: Database,
  collectionId: string,
  userId: string | null // null if not authenticated
): Promise<CollectionDetail> {
  // Get collection
  const collection = await db
    .prepare('SELECT * FROM collections WHERE id = ?')
    .bind(collectionId)
    .first<Collection>()

  if (!collection) {
    throw Errors.notFound('Collection not found')
  }

  // Check access permissions
  const gallery = await db
    .prepare('SELECT user_id FROM galleries WHERE id = ?')
    .bind(collection.gallery_id)
    .first<{ user_id: string }>()

  if (!gallery) {
    throw Errors.notFound('Gallery not found')
  }

  const isOwner = userId && userId === gallery.user_id

  // Non-owner can only see active collections
  if (!isOwner && collection.status !== 'active') {
    throw Errors.forbidden('This collection is not publicly available')
  }

  // Get all artworks in collection with their details
  const collectionArtworks = await db
    .prepare(
      `
      SELECT
        ca.id,
        ca.artwork_id,
        ca.collection_id,
        ca.position,
        ca.added_at,
        a.id as 'artwork.id',
        a.slug as 'artwork.slug',
        a.title as 'artwork.title',
        a.description as 'artwork.description',
        a.image_url as 'artwork.image_url',
        a.thumbnail_url as 'artwork.thumbnail_url',
        a.artist_name as 'artwork.artist_name',
        a.created_at as 'artwork.created_at'
      FROM collection_artworks ca
      JOIN artworks a ON ca.artwork_id = a.id
      WHERE ca.collection_id = ?
      ORDER BY ca.position ASC, ca.added_at DESC
      `
    )
    .bind(collectionId)
    .all<any>()

  // Transform flat result to nested structure
  const artworks: CollectionArtwork[] = (collectionArtworks?.results || []).map(
    (row: any) => ({
      id: row.id,
      artwork_id: row.artwork_id,
      collection_id: row.collection_id,
      position: row.position,
      added_at: row.added_at,
      artwork: {
        id: row['artwork.id'],
        slug: row['artwork.slug'],
        title: row['artwork.title'],
        description: row['artwork.description'],
        image_url: row['artwork.image_url'],
        thumbnail_url: row['artwork.thumbnail_url'],
        artist_name: row['artwork.artist_name'],
        created_at: row['artwork.created_at'],
      },
    })
  )

  // Get theme if set
  let theme: any = null
  if (collection.theme_id) {
    theme = await db
      .prepare('SELECT id, name, primary_color, secondary_color FROM themes WHERE id = ?')
      .bind(collection.theme_id)
      .first<any>()
  }

  return {
    ...collection,
    artworks,
    theme: theme || undefined,
  }
}

/**
 * Get collection by slug within a specific gallery
 * Useful for public URLs like /artist/gallery/collection-slug
 */
export async function getCollectionBySlug(
  db: Database,
  galleryId: string,
  slug: string,
  userId: string | null
): Promise<CollectionDetail> {
  const collection = await db
    .prepare(
      `
      SELECT * FROM collections
      WHERE gallery_id = ? AND slug = ?
      LIMIT 1
      `
    )
    .bind(galleryId, slug)
    .first<Collection>()

  if (!collection) {
    throw Errors.notFound('Collection not found')
  }

  // Verify owner or active status
  const gallery = await db
    .prepare('SELECT user_id FROM galleries WHERE id = ?')
    .bind(galleryId)
    .first<{ user_id: string }>()

  if (!gallery) {
    throw Errors.notFound('Gallery not found')
  }

  const isOwner = userId && userId === gallery.user_id
  if (!isOwner && collection.status !== 'active') {
    throw Errors.forbidden('This collection is not publicly available')
  }

  // Recursively call getCollectionById to get nested data
  return getCollectionById(db, collection.id, userId)
}
```

---

### Step 2: Create Get Collection Route Handler

Add the get endpoint to the collections route handler.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/collections.ts`

Add this function to the existing file:

```typescript
import { getCollectionById } from '../services/collection.service'

/**
 * GET /api/collections/:id
 * Get a single collection with all nested artworks and details
 *
 * Authentication: Optional
 * Response: { data: CollectionDetail }
 */
export async function handleGetCollection(c: HonoContext) {
  try {
    const collectionId = c.req.param('id')

    if (!collectionId) {
      throw Errors.badRequest('Collection ID is required')
    }

    // Get current user (may be null if not authenticated)
    const currentUser = c.get('user')
    const userId = currentUser?.userId || null

    // Get collection using service
    const db = c.env.DB
    const collection = await getCollectionById(db, collectionId, userId)

    return c.json({
      data: collection,
    })
  } catch (err) {
    if (err instanceof Error) {
      throw err
    }
    throw Errors.internal('Failed to retrieve collection')
  }
}

/**
 * GET /api/galleries/:galleryId/collections/:slug
 * Get a single collection by slug (for public URLs)
 *
 * Authentication: Optional
 * Response: { data: CollectionDetail }
 */
export async function handleGetCollectionBySlug(c: HonoContext) {
  try {
    const galleryId = c.req.param('galleryId')
    const slug = c.req.param('slug')

    if (!galleryId || !slug) {
      throw Errors.badRequest('Gallery ID and collection slug are required')
    }

    // Get current user (may be null if not authenticated)
    const currentUser = c.get('user')
    const userId = currentUser?.userId || null

    // Get collection using service
    const db = c.env.DB
    const collection = await getCollectionBySlug(db, galleryId, slug, userId)

    return c.json({
      data: collection,
    })
  } catch (err) {
    if (err instanceof Error) {
      throw err
    }
    throw Errors.internal('Failed to retrieve collection')
  }
}
```

---

### Step 3: Register Get Routes

Update the main Hono app to register both get endpoints.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/index.ts`

Update the collection routes section:

```typescript
import { optionalAuth } from './middleware/auth'
import {
  handleCreateCollection,
  handleListCollections,
  handleGetCollection,
  handleGetCollectionBySlug,
} from './routes/collections'

// ============================================
// Collection Routes (Phase 12)
// ============================================

app.post('/galleries/:galleryId/collections', requireAuth, handleCreateCollection)
app.get('/galleries/:galleryId/collections', optionalAuth, handleListCollections)
app.get('/galleries/:galleryId/collections/:slug', optionalAuth, handleGetCollectionBySlug)
app.get('/collections/:id', optionalAuth, handleGetCollection)
```

**Important**: Register the slug route BEFORE the generic ID route so slug matches first.

---

### Step 4: Verify Artworks Table Structure

Ensure the artworks table has all required fields (from Build 10).

Expected columns:
- `id` - Primary key
- `slug` - URL-friendly identifier
- `title` - Artwork title
- `description` - Optional description
- `image_url` - Main image URL
- `thumbnail_url` - Optional thumbnail
- `artist_name` - Artist's display name
- `created_at` - Timestamp

If missing any fields, update accordingly or adjust the query in Step 1.

---

## Files to Create/Modify

**Modified files:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/services/collection.service.ts` - Add get functions
2. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/collections.ts` - Add get handlers
3. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/index.ts` - Register GET routes (both ID and slug patterns)

---

## Verification

### Test 1: Compile TypeScript

```bash
cd /Volumes/DataSSD/gitsrc/vfa_gallery
npx tsc --noEmit
```

Expected: No type errors

---

### Test 2: Get Collection by ID (Unauthenticated)

Get an active collection:

```bash
curl http://localhost:8788/api/collections/col_abc123def456
```

Expected response (200):
```json
{
  "data": {
    "id": "col_abc123def456",
    "gallery_id": "gal_test123",
    "slug": "dragon-series",
    "name": "Dragon Series",
    "description": "All my dragon artwork",
    "hero_image_url": "https://r2.example.com/hero.jpg",
    "theme_id": "theme_classic",
    "is_default": 0,
    "status": "active",
    "created_at": "2026-01-18T20:00:00.000Z",
    "updated_at": "2026-01-18T20:00:00.000Z",
    "artworks": [
      {
        "id": "ca_001",
        "artwork_id": "art_xyz789",
        "collection_id": "col_abc123def456",
        "position": 1,
        "added_at": "2026-01-18T20:05:00.000Z",
        "artwork": {
          "id": "art_xyz789",
          "slug": "dragon-portrait",
          "title": "Dragon Portrait",
          "description": "A detailed portrait of a dragon",
          "image_url": "https://r2.example.com/dragon-portrait.jpg",
          "thumbnail_url": "https://r2.example.com/dragon-portrait-thumb.jpg",
          "artist_name": "Artist Name",
          "created_at": "2026-01-18T19:00:00.000Z"
        }
      }
    ],
    "theme": {
      "id": "theme_classic",
      "name": "Classic",
      "primary_color": "#000000",
      "secondary_color": "#FFFFFF"
    }
  }
}
```

---

### Test 3: Get Collection by Slug (Unauthenticated)

```bash
curl http://localhost:8788/api/galleries/gal_test123/collections/dragon-series
```

Expected response: Same as Test 2

---

### Test 4: Get Non-Existent Collection by ID

```bash
curl http://localhost:8788/api/collections/col_nonexistent
```

Expected response (404):
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Collection not found"
  }
}
```

---

### Test 5: Get Non-Existent Collection by Slug

```bash
curl http://localhost:8788/api/galleries/gal_test123/collections/nonexistent-slug
```

Expected response (404):
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Collection not found"
  }
}
```

---

### Test 6: Get Archived Collection (Unauthenticated)

Create an archived collection, then try to get it without auth:

```bash
curl http://localhost:8788/api/collections/col_archived
```

Expected response (403):
```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "This collection is not publicly available"
  }
}
```

---

### Test 7: Get Archived Collection (As Owner)

Get the same archived collection with owner JWT:

```bash
curl -H "Authorization: Bearer <owner-jwt-token>" \
  http://localhost:8788/api/collections/col_archived
```

Expected response (200): Returns full collection data including archived status

---

### Test 8: Get Collection with No Artworks

Create an empty collection and retrieve it:

```bash
curl http://localhost:8788/api/collections/col_empty
```

Expected response (200):
```json
{
  "data": {
    "id": "col_empty",
    "gallery_id": "gal_test123",
    "slug": "empty-collection",
    "name": "Empty Collection",
    "description": null,
    "hero_image_url": null,
    "theme_id": null,
    "is_default": 0,
    "status": "active",
    "created_at": "2026-01-18T20:00:00.000Z",
    "updated_at": "2026-01-18T20:00:00.000Z",
    "artworks": [],
    "theme": null
  }
}
```

---

### Test 9: Artwork Ordering by Position

Add multiple artworks to a collection with specific positions (1, 3, 2), then retrieve:

```bash
curl http://localhost:8788/api/collections/col_abc123def456
```

Expected: Artworks appear in order: position 1, 2, 3 (regardless of added_at)

---

### Test 10: Get Collection with Theme

Create a collection with a theme_id, retrieve it:

```bash
curl http://localhost:8788/api/collections/col_themed
```

Expected: Response includes theme object with id, name, and colors

---

### Test 11: Get Collection Without Theme

Create a collection without theme_id, retrieve it:

```bash
curl http://localhost:8788/api/collections/col_no_theme
```

Expected: Response includes `"theme": null` or `"theme"` field is omitted

---

### Test 12: Wrong Gallery for Slug Lookup

Gallery 1 has collection with slug "featured", Gallery 2 also has "featured"

Request Gallery 1's featured:

```bash
curl http://localhost:8788/api/galleries/gal_gallery1/collections/featured
```

Expected: Returns Gallery 1's collection

Request Gallery 2's featured:

```bash
curl http://localhost:8788/api/galleries/gal_gallery2/collections/featured
```

Expected: Returns Gallery 2's collection (different from above)

---

### Test 13: Invalid Gallery ID for Slug Lookup

```bash
curl http://localhost:8788/api/galleries/nonexistent/collections/featured
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

### Test 14: Artwork Details Completeness

Add an artwork with all fields to a collection, retrieve collection:

```bash
curl http://localhost:8788/api/collections/col_abc123def456
```

Expected: Nested artwork object includes:
- id, slug, title, description
- image_url, thumbnail_url
- artist_name, created_at

All fields properly populated

---

### Test 15: Large Collection (Performance)

Add 100+ artworks to a collection, retrieve it:

```bash
curl http://localhost:8788/api/collections/col_large
```

Expected: Response returns all artworks, ordered correctly, within reasonable time (<2s)

---

## Summary

This build adds single collection retrieval functionality:
- Get collection by ID or slug
- Access control (owner sees all, non-owner sees active only)
- Nested artwork data with correct ordering by position
- Theme information inclusion
- Support for both private and public collection views
- Efficient database queries with proper joins

The endpoint enables detailed collection views for both UI display and public sharing.

---

**Next step:** Proceed to **66-API-COLLECTION-UPDATE.md** to add collection modification capabilities.
