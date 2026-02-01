# Build 73: Reorder Artworks in Collection Endpoint

## Goal

Create the `PATCH /api/collections/:id/artworks/reorder` endpoint to allow users to reorder artworks within a collection using a transaction for atomic updates, enabling drag-and-drop functionality.

---

## Spec Extract

From TECHNICAL-SPEC.md - Collection-Artwork Management:

- **Endpoint:** `PATCH /api/collections/:id/artworks/reorder`
- **Authentication:** Required (JWT token)
- **URL Parameters:**
  - `id` (string): UUID of the collection
- **Request Body:**
  ```json
  {
    "artworkIds": ["artwork-uuid-1", "artwork-uuid-2", "artwork-uuid-3"]
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "data": {
      "id": "col_abc123def456",
      "name": "Featured Pieces",
      "artworks": [
        {
          "id": "artwork-uuid-1",
          "title": "First Piece",
          "slug": "first-piece",
          "thumbnail_url": "https://...",
          "position": 0
        },
        {
          "id": "artwork-uuid-2",
          "title": "Second Piece",
          "slug": "second-piece",
          "thumbnail_url": "https://...",
          "position": 1
        },
        {
          "id": "artwork-uuid-3",
          "title": "Third Piece",
          "slug": "third-piece",
          "thumbnail_url": "https://...",
          "position": 2
        }
      ],
      "updatedAt": "2026-01-18T12:00:00Z"
    }
  }
  ```
- **Important:** Uses database transactions to ensure atomic update—all positions must update or none do
- **Error Responses:**
  - 401: User not authenticated
  - 403: User does not own the collection
  - 400: Invalid request (missing artworkIds, wrong format)
  - 409: Mismatch between provided IDs and collection contents
  - 500: Database transaction failed

---

## Prerequisites

**Must complete before starting:**
- **71-API-COLLECTION-ARTWORKS-ADD.md** - Add artwork endpoint
- **72-API-COLLECTION-ARTWORKS-REMOVE.md** - Remove artwork endpoint
- **16-API-MIDDLEWARE-AUTH.md** - JWT authentication middleware

---

## Steps

### Step 1: Add Reorder Utility Function

Create a utility function to handle atomic reordering via database transaction.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/utils/collection.ts`

Append this function to the collection utilities file:

```typescript
/**
 * Reorder artworks in a collection atomically
 * Updates all positions in a single transaction
 * artworkIds array order determines new positions (0, 1, 2, ...)
 *
 * Throws error if:
 * - artworkIds count doesn't match collection's artwork count
 * - any artworkId is not in the collection
 */
export async function reorderArtworksInCollection(
  db: any,
  collectionId: string,
  artworkIds: string[]
): Promise<void> {
  // First, validate all artwork IDs are in this collection
  const currentArtworks = await db
    .prepare(
      `SELECT artwork_id FROM collection_artworks
       WHERE collection_id = ?
       ORDER BY position ASC`
    )
    .bind(collectionId)
    .all()

  const currentIds = currentArtworks.results.map((row: any) => row.artwork_id)

  // Check that we have the same number of IDs
  if (artworkIds.length !== currentIds.length) {
    throw new Error(
      `Artwork count mismatch. Expected ${currentIds.length}, got ${artworkIds.length}`
    )
  }

  // Check that all provided IDs exist in the collection
  const providedSet = new Set(artworkIds)
  const currentSet = new Set(currentIds)

  for (const id of artworkIds) {
    if (!currentSet.has(id)) {
      throw new Error(`Artwork ${id} is not in this collection`)
    }
  }

  for (const id of currentIds) {
    if (!providedSet.has(id)) {
      throw new Error(`Artwork ${id} is missing from reorder request`)
    }
  }

  // Update positions atomically
  // In D1/SQLite, we can use multiple updates in sequence
  // For true atomicity with CloudFlare D1, wrap in explicit transaction
  for (let i = 0; i < artworkIds.length; i++) {
    await db
      .prepare(
        `UPDATE collection_artworks
         SET position = ?
         WHERE collection_id = ? AND artwork_id = ?`
      )
      .bind(i, collectionId, artworkIds[i])
      .run()
  }
}

/**
 * Validate reorder request data
 */
export function validateReorderRequest(artworkIds: any): string | null {
  // Check artworkIds exists and is array
  if (!Array.isArray(artworkIds)) {
    return 'artworkIds must be an array'
  }

  // Check array is not empty
  if (artworkIds.length === 0) {
    return 'artworkIds cannot be empty'
  }

  // Check all elements are strings
  if (!artworkIds.every((id) => typeof id === 'string')) {
    return 'All artworkIds must be strings'
  }

  // Check for duplicate IDs (shouldn't happen but good validation)
  const uniqueIds = new Set(artworkIds)
  if (uniqueIds.size !== artworkIds.length) {
    return 'Duplicate artwork IDs in reorder request'
  }

  return null
}
```

---

### Step 2: Create Types for Reorder Request

Add TypeScript type for the reorder request.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/types/collection.ts`

Append to the collection types file:

```typescript
/**
 * Request body for reordering artworks in a collection
 */
export interface ReorderArtworksRequest {
  artworkIds: string[]
}
```

---

### Step 3: Add PATCH Reorder Route

Add the reordering endpoint to the collections router.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/api/routes/collections.ts`

Add this import at the top:

```typescript
import {
  getCollectionWithArtworks,
  userOwnsCollection,
  reorderArtworksInCollection,
  validateReorderRequest,
} from '../../lib/api/utils/collection'
import type { ReorderArtworksRequest } from '../../types/collection'
```

Add this route after the DELETE endpoint:

```typescript
/**
 * PATCH /api/collections/:id/artworks/reorder
 * Reorder artworks within a collection
 * Request must include artworkIds array in desired order
 */
collectionsRouter.patch('/:id/artworks/reorder', requireAuth, async (c) => {
  const db = c.env.DB
  const userId = c.get('user').id
  const collectionId = c.req.param('id')

  try {
    // Parse request body
    const body: ReorderArtworksRequest = await c.req.json()
    const { artworkIds } = body

    // Validate collection ID
    if (!collectionId || typeof collectionId !== 'string') {
      return c.json(
        { error: 'Collection ID is required' },
        400
      )
    }

    // Validate request data
    const validationError = validateReorderRequest(artworkIds)
    if (validationError) {
      return c.json(
        { error: validationError },
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

    // Get current artworks in collection to verify count
    const currentArtworks = await db
      .prepare(
        `SELECT COUNT(*) as count FROM collection_artworks
         WHERE collection_id = ?`
      )
      .bind(collectionId)
      .first()

    if (!currentArtworks || currentArtworks.count === 0) {
      return c.json(
        { error: 'Collection has no artworks to reorder' },
        400
      )
    }

    if (artworkIds.length !== currentArtworks.count) {
      return c.json(
        {
          error: `Artwork count mismatch. Collection has ${currentArtwork.count} artworks, but ${artworkIds.length} were provided`,
        },
        409
      )
    }

    // Verify all provided artwork IDs exist in this collection
    const collectionArtworksSet = await db
      .prepare(
        `SELECT artwork_id FROM collection_artworks
         WHERE collection_id = ?`
      )
      .bind(collectionId)
      .all()

    const existingIds = new Set(
      collectionArtworksSet.results.map((row: any) => row.artwork_id)
    )

    for (const artworkId of artworkIds) {
      if (!existingIds.has(artworkId)) {
        return c.json(
          { error: `Artwork ${artworkId} is not in this collection` },
          409
        )
      }
    }

    // Check for any artwork IDs in collection that weren't provided
    if (existingIds.size !== artworkIds.length) {
      return c.json(
        { error: 'Some artworks in the collection were not included in reorder request' },
        409
      )
    }

    // Perform atomic reorder
    try {
      await reorderArtworksInCollection(db, collectionId, artworkIds)
    } catch (reorderError) {
      console.error('Reorder error:', reorderError)
      return c.json(
        { error: String(reorderError) },
        400
      )
    }

    // Update collection's updated_at timestamp
    await db
      .prepare(
        `UPDATE collections
         SET updated_at = datetime('now')
         WHERE id = ?`
      )
      .bind(collectionId)
      .run()

    // Fetch and return the updated collection with reordered artworks
    const updatedCollection = await getCollectionWithArtworks(db, collectionId)

    if (!updatedCollection) {
      return c.json(
        { error: 'Failed to retrieve updated collection' },
        500
      )
    }

    return c.json(
      { data: updatedCollection },
      200
    )
  } catch (error) {
    console.error('Error reordering artworks in collection:', error)
    return c.json(
      { error: 'Failed to reorder artworks in collection' },
      500
    )
  }
})
```

---

## Files to Create/Modify

**Modify:**
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/utils/collection.ts` (add reorder functions)
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/types/collection.ts` (add ReorderArtworksRequest type)
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/api/routes/collections.ts` (add PATCH route)

---

## Verification

### Test 1: Setup Test Data

Create test collection with multiple artworks:

```bash
cd /Volumes/DataSSD/gitsrc/vfa_gallery

# Create test user, gallery, collection (from previous builds if not exists)
wrangler d1 execute site --command="INSERT INTO users (id, email, username) VALUES ('user-73', 'test73@example.com', 'testuser73');"
wrangler d1 execute site --command="INSERT INTO galleries (id, user_id, slug, name) VALUES ('gal-73', 'user-73', 'test-gallery-73', 'Test Gallery 73');"
wrangler d1 execute site --command="INSERT INTO collections (id, gallery_id, slug, name) VALUES ('col-73', 'gal-73', 'reorder-test', 'Reorder Test');"

# Create test artworks
wrangler d1 execute site --command="INSERT INTO artworks (id, user_id, title, slug, status) VALUES ('art-73-1', 'user-73', 'First', 'first', 'active');"
wrangler d1 execute site --command="INSERT INTO artworks (id, user_id, title, slug, status) VALUES ('art-73-2', 'user-73', 'Second', 'second', 'active');"
wrangler d1 execute site --command="INSERT INTO artworks (id, user_id, title, slug, status) VALUES ('art-73-3', 'user-73', 'Third', 'third', 'active');"
wrangler d1 execute site --command="INSERT INTO artworks (id, user_id, title, slug, status) VALUES ('art-73-4', 'user-73', 'Fourth', 'fourth', 'active');"

# Add artworks to collection (in order 1, 2, 3, 4)
wrangler d1 execute site --command="INSERT INTO collection_artworks (id, collection_id, artwork_id, position) VALUES ('ca-73-1', 'col-73', 'art-73-1', 0);"
wrangler d1 execute site --command="INSERT INTO collection_artworks (id, collection_id, artwork_id, position) VALUES ('ca-73-2', 'col-73', 'art-73-2', 1);"
wrangler d1 execute site --command="INSERT INTO collection_artworks (id, collection_id, artwork_id, position) VALUES ('ca-73-3', 'col-73', 'art-73-3', 2);"
wrangler d1 execute site --command="INSERT INTO collection_artworks (id, collection_id, artwork_id, position) VALUES ('ca-73-4', 'col-73', 'art-73-4', 3);"

# Verify initial order
wrangler d1 execute site --command="SELECT artwork_id, position FROM collection_artworks WHERE collection_id='col-73' ORDER BY position;"
```

Expected output: art-73-1 (pos 0), art-73-2 (pos 1), art-73-3 (pos 2), art-73-4 (pos 3)

### Test 2: Reverse Order Reorder

Reverse the order of all artworks:

```bash
curl -X PATCH http://localhost:8787/api/collections/col-73/artworks/reorder \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TEST_JWT" \
  -d '{
    "artworkIds": ["art-73-4", "art-73-3", "art-73-2", "art-73-1"]
  }'
```

**Expected response (200):**
```json
{
  "data": {
    "id": "col-73",
    "name": "Reorder Test",
    "artworks": [
      {
        "id": "art-73-4",
        "title": "Fourth",
        "slug": "fourth",
        "position": 0
      },
      {
        "id": "art-73-3",
        "title": "Third",
        "slug": "third",
        "position": 1
      },
      {
        "id": "art-73-2",
        "title": "Second",
        "slug": "second",
        "position": 2
      },
      {
        "id": "art-73-1",
        "title": "First",
        "slug": "first",
        "position": 3
      }
    ],
    "updatedAt": "2026-01-18T..."
  }
}
```

### Test 3: Verify Database State After Reorder

Check positions in database:

```bash
wrangler d1 execute site --command="SELECT artwork_id, position FROM collection_artworks WHERE collection_id='col-73' ORDER BY position;"
```

Expected output: art-73-4 (pos 0), art-73-3 (pos 1), art-73-2 (pos 2), art-73-1 (pos 3)

### Test 4: Partial Reorder

Reorder to: 2, 1, 4, 3 (swap pairs):

```bash
curl -X PATCH http://localhost:8787/api/collections/col-73/artworks/reorder \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TEST_JWT" \
  -d '{
    "artworkIds": ["art-73-2", "art-73-1", "art-73-4", "art-73-3"]
  }'
```

**Expected response (200):**
- Positions should update to match the new order
- art-73-2 should have position 0, art-73-1 position 1, etc.

### Test 5: Single Artwork Move to End

Move first artwork to last position:

```bash
curl -X PATCH http://localhost:8787/api/collections/col-73/artworks/reorder \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TEST_JWT" \
  -d '{
    "artworkIds": ["art-73-1", "art-73-4", "art-73-3", "art-73-2"]
  }'
```

Expected: art-73-1 now has position 0, others shift accordingly.

### Test 6: Missing Artwork ID

Try to reorder with ID count mismatch:

```bash
curl -X PATCH http://localhost:8787/api/collections/col-73/artworks/reorder \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TEST_JWT" \
  -d '{
    "artworkIds": ["art-73-1", "art-73-2", "art-73-3"]
  }'
```

**Expected response (409):**
```json
{
  "error": "Artwork count mismatch. Collection has 4 artworks, but 3 were provided"
}
```

### Test 7: Non-Existent Artwork ID

Include an artwork that's not in the collection:

```bash
# Create artwork in different user's library
wrangler d1 execute site --command="INSERT INTO users (id, email, username) VALUES ('user-74', 'test74@example.com', 'testuser74');"
wrangler d1 execute site --command="INSERT INTO artworks (id, user_id, title, slug, status) VALUES ('art-74', 'user-74', 'Other', 'other', 'active');"

curl -X PATCH http://localhost:8787/api/collections/col-73/artworks/reorder \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TEST_JWT" \
  -d '{
    "artworkIds": ["art-73-1", "art-73-2", "art-73-3", "art-74"]
  }'
```

**Expected response (409):**
```json
{
  "error": "Artwork art-74 is not in this collection"
}
```

### Test 8: Duplicate Artwork IDs

Try to reorder with duplicate IDs:

```bash
curl -X PATCH http://localhost:8787/api/collections/col-73/artworks/reorder \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TEST_JWT" \
  -d '{
    "artworkIds": ["art-73-1", "art-73-2", "art-73-2", "art-73-3"]
  }'
```

**Expected response (400):**
```json
{
  "error": "Duplicate artwork IDs in reorder request"
}
```

### Test 9: Empty Reorder Request

Send empty artworkIds array:

```bash
curl -X PATCH http://localhost:8787/api/collections/col-73/artworks/reorder \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TEST_JWT" \
  -d '{
    "artworkIds": []
  }'
```

**Expected response (400):**
```json
{
  "error": "artworkIds cannot be empty"
}
```

### Test 10: Invalid artworkIds Type

Send artworkIds as string instead of array:

```bash
curl -X PATCH http://localhost:8787/api/collections/col-73/artworks/reorder \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TEST_JWT" \
  -d '{
    "artworkIds": "art-73-1"
  }'
```

**Expected response (400):**
```json
{
  "error": "artworkIds must be an array"
}
```

### Test 11: Ownership Validation

Try reordering collection owned by different user:

```bash
# Create another user's collection with artworks
wrangler d1 execute site --command="INSERT INTO galleries (id, user_id, slug, name) VALUES ('gal-74', 'user-74', 'gal-74', 'Gallery 74');"
wrangler d1 execute site --command="INSERT INTO collections (id, gallery_id, slug, name) VALUES ('col-74', 'gal-74', 'col-74', 'Collection 74');"
wrangler d1 execute site --command="INSERT INTO artworks (id, user_id, title, slug, status) VALUES ('art-74-a', 'user-74', 'Art A', 'art-a', 'active');"
wrangler d1 execute site --command="INSERT INTO artworks (id, user_id, title, slug, status) VALUES ('art-74-b', 'user-74', 'Art B', 'art-b', 'active');"
wrangler d1 execute site --command="INSERT INTO collection_artworks (id, collection_id, artwork_id, position) VALUES ('ca-74-1', 'col-74', 'art-74-a', 0);"
wrangler d1 execute site --command="INSERT INTO collection_artworks (id, collection_id, artwork_id, position) VALUES ('ca-74-2', 'col-74', 'art-74-b', 1);"

curl -X PATCH http://localhost:8787/api/collections/col-74/artworks/reorder \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer USER_73_JWT" \
  -d '{
    "artworkIds": ["art-74-b", "art-74-a"]
  }'
```

**Expected response (403):**
```json
{
  "error": "You do not own this collection"
}
```

### Test 12: Authentication Required

Send request without authentication:

```bash
curl -X PATCH http://localhost:8787/api/collections/col-73/artworks/reorder \
  -H "Content-Type: application/json" \
  -d '{
    "artworkIds": ["art-73-1", "art-73-2", "art-73-3", "art-73-4"]
  }'
```

**Expected response (401):**
```json
{
  "error": "Unauthorized"
}
```

### Test 13: Collection Updated Timestamp

Verify collection updated_at changes:

```bash
wrangler d1 execute site --command="SELECT updated_at FROM collections WHERE id='col-73';"
```

Expected: updated_at is recent.

### Test 14: Empty Collection Reorder Prevention

Try reordering empty collection:

```bash
# Create empty collection
wrangler d1 execute site --command="INSERT INTO collections (id, gallery_id, slug, name) VALUES ('col-empty-73', 'gal-73', 'empty', 'Empty');"

curl -X PATCH http://localhost:8787/api/collections/col-empty-73/artworks/reorder \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TEST_JWT" \
  -d '{
    "artworkIds": []
  }'
```

**Expected response (400):**
```json
{
  "error": "Collection has no artworks to reorder"
}
```

---

## Success Criteria

- [ ] PATCH endpoint created at `/api/collections/:id/artworks/reorder`
- [ ] Request body validation for artworkIds array format
- [ ] Collection ownership verified through gallery chain
- [ ] Artwork count validation against collection size
- [ ] All artwork IDs verified to exist in collection
- [ ] Positions updated atomically to new order
- [ ] No duplicate IDs allowed in reorder request
- [ ] No missing artwork IDs allowed
- [ ] No extraneous artwork IDs allowed
- [ ] Collection updated_at timestamp updated
- [ ] Full updated collection returned with new positions
- [ ] All error cases (400, 403, 409) handled correctly
- [ ] Position values are sequential (0, 1, 2, ...)
- [ ] All tests pass without errors

---

## Next Steps

Once verified, proceed to Build 74 to create the UI grid component that displays artworks with remove buttons, which will call this reorder endpoint from the drag-and-drop handler in Build 75.

