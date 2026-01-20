# Build 71: Add Artwork to Collection Endpoint

## Goal

Create the `POST /api/collections/:id/artworks` endpoint to allow authenticated users to add artworks to a collection they own, with validation that the user owns both the collection and the artwork, and prevention of duplicate artwork additions.

---

## Spec Extract

From TECHNICAL-SPEC.md - Collection-Artwork Management:

- **Endpoint:** `POST /api/collections/:id/artworks`
- **Authentication:** Required (JWT token)
- **URL Parameters:**
  - `id` (string): UUID of the collection
- **Request Body:**
  ```json
  {
    "artworkId": "artwork-uuid"
  }
  ```
- **Response (201 Created):**
  ```json
  {
    "data": {
      "id": "col_abc123def456",
      "name": "Featured Pieces",
      "artworks": [
        {
          "id": "art_xyz789",
          "title": "Dragon Study",
          "slug": "dragon-study",
          "thumbnail_url": "https://...",
          "position": 0
        },
        {
          "id": "artwork-uuid",
          "title": "Sunset Landscape",
          "slug": "sunset-landscape",
          "thumbnail_url": "https://...",
          "position": 1
        }
      ],
      "updatedAt": "2026-01-18T12:00:00Z"
    }
  }
  ```
- **Error Responses:**
  - 401: User not authenticated
  - 403: User does not own the collection or artwork
  - 404: Collection or artwork not found
  - 409: Artwork already in collection

---

## Prerequisites

**Must complete before starting:**
- **15-API-FOUNDATION.md** - Hono router and error handling setup
- **16-API-MIDDLEWARE-AUTH.md** - JWT authentication middleware
- **43-API-ARTWORK-GET.md** - Artwork retrieval endpoint (to verify artwork structure)
- **65-API-COLLECTION-GET.md** - Collection retrieval endpoint (validates structure)

---

## Steps

### Step 1: Verify Database Schema

Ensure the `collection_artworks` junction table exists with the correct schema.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/migrations/0010_create_collection_artworks.sql`

Verify it contains:
```sql
CREATE TABLE IF NOT EXISTS collection_artworks (
  id TEXT PRIMARY KEY,
  collection_id TEXT REFERENCES collections(id) ON DELETE CASCADE,
  artwork_id TEXT REFERENCES artworks(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(collection_id, artwork_id)
);
```

**Verification:**
```bash
cd /Volumes/DataSSD/gitsrc/vfa_gallery
wrangler d1 execute vfa-gallery --command="PRAGMA table_info(collection_artworks);"
```

Expected output: Shows columns: id, collection_id, artwork_id, position, created_at

---

### Step 2: Create Types for Collection-Artwork Operations

Define TypeScript types for the add artwork endpoint.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/types/collection.ts`

Add these types (append to existing file if it exists):

```typescript
/**
 * Artwork within a collection with position information
 */
export interface CollectionArtwork {
  id: string
  title: string
  slug: string
  thumbnail_url: string
  display_url?: string
  position: number
  createdAt: string
  updatedAt: string
}

/**
 * Collection with full artwork list
 */
export interface CollectionWithArtworks {
  id: string
  galleryId: string
  slug: string
  name: string
  description?: string | null
  heroImageUrl?: string | null
  themeId?: string | null
  artworks: CollectionArtwork[]
  createdAt: string
  updatedAt: string
}

/**
 * Request body for adding artwork to collection
 */
export interface AddArtworkRequest {
  artworkId: string
}
```

---

### Step 3: Create Helper Function to Get Collection with Artworks

Create a utility function to fetch collection data with its artworks in correct order.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/utils/collection.ts`

```typescript
import type { CollectionWithArtworks } from '../../../types/collection'

/**
 * Fetch a collection with all its artworks in position order
 * Used after adding/removing/reordering artworks
 */
export async function getCollectionWithArtworks(
  db: any,
  collectionId: string
): Promise<CollectionWithArtworks | null> {
  // First, get the collection base data
  const collection = await db
    .prepare(
      `SELECT id, gallery_id, slug, name, description, hero_image_url,
              theme_id, created_at, updated_at
       FROM collections
       WHERE id = ?`
    )
    .bind(collectionId)
    .first()

  if (!collection) {
    return null
  }

  // Then, get artworks in position order
  const artworks = await db
    .prepare(
      `SELECT
         a.id, a.title, a.slug, a.thumbnail_url, a.display_url,
         ca.position, a.created_at, a.updated_at
       FROM collection_artworks ca
       JOIN artworks a ON ca.artwork_id = a.id
       WHERE ca.collection_id = ?
       ORDER BY ca.position ASC`
    )
    .bind(collectionId)
    .all()

  return {
    id: collection.id,
    galleryId: collection.gallery_id,
    slug: collection.slug,
    name: collection.name,
    description: collection.description,
    heroImageUrl: collection.hero_image_url,
    themeId: collection.theme_id,
    artworks: artworks.results.map((row: any) => ({
      id: row.id,
      title: row.title,
      slug: row.slug,
      thumbnail_url: row.thumbnail_url,
      display_url: row.display_url,
      position: row.position,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
    createdAt: collection.created_at,
    updatedAt: collection.updated_at,
  }
}

/**
 * Check if user owns a collection through the gallery ownership chain
 */
export async function userOwnsCollection(
  db: any,
  userId: string,
  collectionId: string
): Promise<boolean> {
  const result = await db
    .prepare(
      `SELECT c.id
       FROM collections c
       JOIN galleries g ON c.gallery_id = g.id
       WHERE c.id = ? AND g.user_id = ?`
    )
    .bind(collectionId, userId)
    .first()

  return !!result
}
```

---

### Step 4: Create Helper Function for Ownership Validation

Add a function to check artwork ownership.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/utils/artwork.ts`

Add this function (append if file exists):

```typescript
/**
 * Check if user owns an artwork
 */
export async function userOwnsArtwork(
  db: any,
  userId: string,
  artworkId: string
): Promise<boolean> {
  const result = await db
    .prepare(
      `SELECT id FROM artworks
       WHERE id = ? AND user_id = ?`
    )
    .bind(artworkId, userId)
    .first()

  return !!result
}
```

---

### Step 5: Create the Add Artwork Endpoint

Create the main route handler for adding artworks to collections.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/api/routes/collections.ts`

Add this route to the collections router (if file doesn't exist, create it):

```typescript
import { Hono } from 'hono'
import { createId } from '@paralleldrive/cuid2'
import type { AddArtworkRequest, CollectionWithArtworks } from '../../types/collection'
import { requireAuth } from '../middleware/auth'
import { getCollectionWithArtworks, userOwnsCollection } from '../../lib/api/utils/collection'
import { userOwnsArtwork } from '../../lib/api/utils/artwork'

const collectionsRouter = new Hono()

/**
 * POST /api/collections/:id/artworks
 * Add an artwork to a collection
 */
collectionsRouter.post('/:id/artworks', requireAuth, async (c) => {
  const db = c.env.DB
  const userId = c.get('user').id
  const collectionId = c.req.param('id')

  try {
    // Parse request body
    const body: AddArtworkRequest = await c.req.json()
    const { artworkId } = body

    // Validate required fields
    if (!artworkId || typeof artworkId !== 'string') {
      return c.json(
        { error: 'artworkId is required and must be a string' },
        400
      )
    }

    if (!collectionId || typeof collectionId !== 'string') {
      return c.json(
        { error: 'Collection ID is required' },
        400
      )
    }

    // Verify user owns the collection (through gallery ownership chain)
    const ownsCollection = await userOwnsCollection(db, userId, collectionId)
    if (!ownsCollection) {
      return c.json(
        { error: 'You do not own this collection' },
        403
      )
    }

    // Verify user owns the artwork
    const ownsArtwork = await userOwnsArtwork(db, userId, artworkId)
    if (!ownsArtwork) {
      return c.json(
        { error: 'You do not own this artwork' },
        403
      )
    }

    // Verify artwork exists and is not deleted
    const artwork = await db
      .prepare(
        `SELECT id, status FROM artworks
         WHERE id = ? AND user_id = ? AND status != 'deleted'`
      )
      .bind(artworkId, userId)
      .first()

    if (!artwork) {
      return c.json(
        { error: 'Artwork not found or has been deleted' },
        404
      )
    }

    // Check if artwork is already in collection
    const existingEntry = await db
      .prepare(
        `SELECT id FROM collection_artworks
         WHERE collection_id = ? AND artwork_id = ?`
      )
      .bind(collectionId, artworkId)
      .first()

    if (existingEntry) {
      return c.json(
        { error: 'Artwork is already in this collection' },
        409
      )
    }

    // Get max position in collection
    const maxPositionResult = await db
      .prepare(
        `SELECT MAX(position) as max_position FROM collection_artworks
         WHERE collection_id = ?`
      )
      .bind(collectionId)
      .first()

    const newPosition = (maxPositionResult?.max_position ?? -1) + 1

    // Create collection_artworks junction table entry
    const caId = createId()
    await db
      .prepare(
        `INSERT INTO collection_artworks (id, collection_id, artwork_id, position)
         VALUES (?, ?, ?, ?)`
      )
      .bind(caId, collectionId, artworkId, newPosition)
      .run()

    // Update collection's updated_at timestamp
    await db
      .prepare(
        `UPDATE collections
         SET updated_at = datetime('now')
         WHERE id = ?`
      )
      .bind(collectionId)
      .run()

    // Fetch and return the updated collection with all artworks
    const updatedCollection = await getCollectionWithArtworks(db, collectionId)

    if (!updatedCollection) {
      return c.json(
        { error: 'Failed to retrieve updated collection' },
        500
      )
    }

    return c.json(
      { data: updatedCollection },
      201
    )
  } catch (error) {
    console.error('Error adding artwork to collection:', error)
    return c.json(
      { error: 'Failed to add artwork to collection' },
      500
    )
  }
})

export { collectionsRouter }
```

---

### Step 6: Register Collections Router in Main API

Ensure the collections router is registered in the main API setup.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/api/index.ts`

Add this import and route registration (if not already present):

```typescript
import { collectionsRouter } from './routes/collections'

// Register the router
api.route('/collections', collectionsRouter)
```

---

## Files to Create/Modify

**Create:**
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/types/collection.ts` (new types)
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/utils/collection.ts` (new utilities)

**Modify:**
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/utils/artwork.ts` (add ownership check)
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/api/routes/collections.ts` (add POST endpoint)
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/api/index.ts` (register router)

---

## Verification

### Test 1: Setup Test Data

Create test user, gallery, collection, and artworks:

```bash
cd /Volumes/DataSSD/gitsrc/vfa_gallery

# Create test user
wrangler d1 execute vfa-gallery --command="INSERT INTO users (id, email, username) VALUES ('user-71', 'test71@example.com', 'testuser71');"

# Create test gallery
wrangler d1 execute vfa-gallery --command="INSERT INTO galleries (id, user_id, slug, name) VALUES ('gal-71', 'user-71', 'test-gallery', 'Test Gallery');"

# Create test collection
wrangler d1 execute vfa-gallery --command="INSERT INTO collections (id, gallery_id, slug, name) VALUES ('col-71', 'gal-71', 'featured', 'Featured Works');"

# Create test artwork 1
wrangler d1 execute vfa-gallery --command="INSERT INTO artworks (id, user_id, title, slug, status) VALUES ('art-71-1', 'user-71', 'Dragon Study', 'dragon-study', 'active');"

# Create test artwork 2
wrangler d1 execute vfa-gallery --command="INSERT INTO artworks (id, user_id, title, slug, status) VALUES ('art-71-2', 'user-71', 'Sunset Landscape', 'sunset-landscape', 'active');"
```

### Test 2: Successful Artwork Addition

Add an artwork to the collection:

```bash
curl -X POST http://localhost:8787/api/collections/col-71/artworks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TEST_JWT" \
  -d '{
    "artworkId": "art-71-1"
  }'
```

**Expected response (201):**
```json
{
  "data": {
    "id": "col-71",
    "name": "Featured Works",
    "artworks": [
      {
        "id": "art-71-1",
        "title": "Dragon Study",
        "slug": "dragon-study",
        "thumbnail_url": null,
        "position": 0
      }
    ],
    "updatedAt": "2026-01-18T..."
  }
}
```

### Test 3: Add Second Artwork (Position Increment)

Add a second artwork:

```bash
curl -X POST http://localhost:8787/api/collections/col-71/artworks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TEST_JWT" \
  -d '{
    "artworkId": "art-71-2"
  }'
```

**Expected response (201):**
- Second artwork should have `position: 1`
- Collection should now contain both artworks in order

### Test 4: Verify Database State

Check collection_artworks table:

```bash
wrangler d1 execute vfa-gallery --command="SELECT * FROM collection_artworks WHERE collection_id='col-71' ORDER BY position;"
```

Expected output:
```
id         | collection_id | artwork_id | position
xxxxxxxxxxx col-71         art-71-1    0
xxxxxxxxxxx col-71         art-71-2    1
```

### Test 5: Duplicate Artwork Prevention

Try adding the same artwork again:

```bash
curl -X POST http://localhost:8787/api/collections/col-71/artworks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TEST_JWT" \
  -d '{
    "artworkId": "art-71-1"
  }'
```

**Expected response (409):**
```json
{
  "error": "Artwork is already in this collection"
}
```

### Test 6: Ownership Validation - Non-Owner

Create another user and artwork, try adding with first user:

```bash
# Create second user and artwork
wrangler d1 execute vfa-gallery --command="INSERT INTO users (id, email, username) VALUES ('user-72', 'test72@example.com', 'testuser72');"
wrangler d1 execute vfa-gallery --command="INSERT INTO artworks (id, user_id, title, slug, status) VALUES ('art-72', 'user-72', 'Other Art', 'other-art', 'active');"

# Try to add artwork owned by user-72 to collection owned by user-71
curl -X POST http://localhost:8787/api/collections/col-71/artworks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer USER_71_JWT" \
  -d '{
    "artworkId": "art-72"
  }'
```

**Expected response (403):**
```json
{
  "error": "You do not own this artwork"
}
```

### Test 7: Collection Ownership Validation

Try adding artwork to collection owned by different user:

```bash
# Create collection for user-72
wrangler d1 execute vfa-gallery --command="INSERT INTO galleries (id, user_id, slug, name) VALUES ('gal-72', 'user-72', 'other-gallery', 'Other Gallery');"
wrangler d1 execute vfa-gallery --command="INSERT INTO collections (id, gallery_id, slug, name) VALUES ('col-72', 'gal-72', 'other-collection', 'Other Collection');"

# Try to add artwork from user-71 to collection owned by user-72
curl -X POST http://localhost:8787/api/collections/col-72/artworks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer USER_71_JWT" \
  -d '{
    "artworkId": "art-71-1"
  }'
```

**Expected response (403):**
```json
{
  "error": "You do not own this collection"
}
```

### Test 8: Deleted Artwork Prevention

Soft-delete an artwork and try to add it:

```bash
# Soft delete the artwork
wrangler d1 execute vfa-gallery --command="UPDATE artworks SET status='deleted' WHERE id='art-71-1';"

# Create a new collection
wrangler d1 execute vfa-gallery --command="INSERT INTO collections (id, gallery_id, slug, name) VALUES ('col-71-test', 'gal-71', 'test-col', 'Test Collection');"

# Try to add deleted artwork
curl -X POST http://localhost:8787/api/collections/col-71-test/artworks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TEST_JWT" \
  -d '{
    "artworkId": "art-71-1"
  }'
```

**Expected response (404):**
```json
{
  "error": "Artwork not found or has been deleted"
}
```

### Test 9: Missing Required Field

Send request without artworkId:

```bash
curl -X POST http://localhost:8787/api/collections/col-71/artworks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TEST_JWT" \
  -d '{}'
```

**Expected response (400):**
```json
{
  "error": "artworkId is required and must be a string"
}
```

### Test 10: Authentication Required

Send request without authentication:

```bash
curl -X POST http://localhost:8787/api/collections/col-71/artworks \
  -H "Content-Type: application/json" \
  -d '{
    "artworkId": "art-71-1"
  }'
```

**Expected response (401):**
```json
{
  "error": "Unauthorized"
}
```

---

## Success Criteria

- [ ] POST endpoint created and accessible at `/api/collections/:id/artworks`
- [ ] Request body validation for `artworkId`
- [ ] User ownership of collection verified through gallery chain
- [ ] User ownership of artwork verified
- [ ] Duplicate artwork prevention (409 error)
- [ ] Deleted artwork prevention (404 error)
- [ ] New position automatically calculated (max + 1)
- [ ] Junction table entry created correctly
- [ ] Collection updated_at timestamp updated
- [ ] Full collection with artworks returned in response
- [ ] All error cases (403, 404, 409) handled correctly
- [ ] All tests pass without errors

---

## Next Steps

Once verified, proceed to Build 72 to create the DELETE endpoint for removing artworks from collections. This endpoint will use the position tracking created in this build to maintain proper ordering.

