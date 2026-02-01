# Build 72: Remove Artwork from Collection Endpoint

## Goal

Create the `DELETE /api/collections/:id/artworks/:artworkId` endpoint to allow users to remove artworks from collections they own, without deleting the artwork itself from the library.

---

## Spec Extract

From TECHNICAL-SPEC.md - Collection-Artwork Management:

- **Endpoint:** `DELETE /api/collections/:id/artworks/:artworkId`
- **Authentication:** Required (JWT token)
- **URL Parameters:**
  - `id` (string): UUID of the collection
  - `artworkId` (string): UUID of the artwork to remove
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Artwork removed from collection"
  }
  ```
- **Important:** The artwork record itself is NOT deleted—only the relationship in the junction table is removed. The artwork remains in the user's library and can be added to other collections.
- **Error Responses:**
  - 401: User not authenticated
  - 403: User does not own the collection
  - 404: Collection or artwork relationship not found
  - 500: Database error

---

## Prerequisites

**Must complete before starting:**
- **71-API-COLLECTION-ARTWORKS-ADD.md** - Add artwork endpoint (ensures junction table exists)
- **16-API-MIDDLEWARE-AUTH.md** - JWT authentication middleware
- **65-API-COLLECTION-GET.md** - Collection retrieval

---

## Steps

### Step 1: Verify Collection Utilities Exist

Ensure the `userOwnsCollection` utility function from Build 71 is available.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/utils/collection.ts`

Should contain:
```typescript
export async function userOwnsCollection(
  db: any,
  userId: string,
  collectionId: string
): Promise<boolean>
```

If not present, add it from Build 71 before proceeding.

---

### Step 2: Create Helper Function for Artwork Removal

Add a function to safely remove artwork from collection while preserving the artwork.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/utils/collection.ts`

Append this function to the collection utilities file:

```typescript
/**
 * Remove an artwork from a collection
 * Only deletes the junction table entry, not the artwork itself
 * Returns true if removal was successful, false if relationship didn't exist
 */
export async function removeArtworkFromCollection(
  db: any,
  collectionId: string,
  artworkId: string
): Promise<boolean> {
  // Check if the relationship exists first
  const existing = await db
    .prepare(
      `SELECT id FROM collection_artworks
       WHERE collection_id = ? AND artwork_id = ?`
    )
    .bind(collectionId, artworkId)
    .first()

  if (!existing) {
    return false
  }

  // Delete the junction table entry
  const result = await db
    .prepare(
      `DELETE FROM collection_artworks
       WHERE collection_id = ? AND artwork_id = ?`
    )
    .bind(collectionId, artworkId)
    .run()

  return result.success ?? true
}

/**
 * Reorder positions after artwork removal
 * Shifts all remaining artworks to fill gaps in position sequence
 */
export async function reorderPositionsAfterRemoval(
  db: any,
  collectionId: string
): Promise<void> {
  // Get all artworks in this collection, ordered by position
  const artworks = await db
    .prepare(
      `SELECT id, artwork_id FROM collection_artworks
       WHERE collection_id = ?
       ORDER BY position ASC`
    )
    .bind(collectionId)
    .all()

  // Update each entry with new sequential position starting from 0
  for (let i = 0; i < artworks.results.length; i++) {
    const entry = artworks.results[i]
    await db
      .prepare(
        `UPDATE collection_artworks
         SET position = ?
         WHERE id = ?`
      )
      .bind(i, entry.id)
      .run()
  }
}
```

---

### Step 3: Add DELETE Route to Collections Router

Add the removal endpoint to the collections router.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/api/routes/collections.ts`

Add this route after the POST endpoint:

```typescript
/**
 * DELETE /api/collections/:id/artworks/:artworkId
 * Remove an artwork from a collection (does not delete the artwork)
 */
collectionsRouter.delete('/:id/artworks/:artworkId', requireAuth, async (c) => {
  const db = c.env.DB
  const userId = c.get('user').id
  const collectionId = c.req.param('id')
  const artworkId = c.req.param('artworkId')

  try {
    // Validate required parameters
    if (!collectionId || typeof collectionId !== 'string') {
      return c.json(
        { error: 'Collection ID is required' },
        400
      )
    }

    if (!artworkId || typeof artworkId !== 'string') {
      return c.json(
        { error: 'Artwork ID is required' },
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

    // Check if the artwork is in the collection
    const artworkInCollection = await db
      .prepare(
        `SELECT id FROM collection_artworks
         WHERE collection_id = ? AND artwork_id = ?`
      )
      .bind(collectionId, artworkId)
      .first()

    if (!artworkInCollection) {
      return c.json(
        { error: 'Artwork not found in this collection' },
        404
      )
    }

    // Remove the artwork from the collection
    // This only deletes the junction table entry, not the artwork itself
    await db
      .prepare(
        `DELETE FROM collection_artworks
         WHERE collection_id = ? AND artwork_id = ?`
      )
      .bind(collectionId, artworkId)
      .run()

    // Reorder remaining artworks to maintain sequential positions
    const remainingArtworks = await db
      .prepare(
        `SELECT id FROM collection_artworks
         WHERE collection_id = ?
         ORDER BY position ASC`
      )
      .bind(collectionId)
      .all()

    for (let i = 0; i < remainingArtworks.results.length; i++) {
      await db
        .prepare(
          `UPDATE collection_artworks
           SET position = ?
           WHERE id = ?`
        )
        .bind(i, remainingArtworks.results[i].id)
        .run()
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

    return c.json(
      {
        success: true,
        message: 'Artwork removed from collection',
      },
      200
    )
  } catch (error) {
    console.error('Error removing artwork from collection:', error)
    return c.json(
      { error: 'Failed to remove artwork from collection' },
      500
    )
  }
})
```

---

## Files to Create/Modify

**Modify:**
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/utils/collection.ts` (add helper functions)
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/api/routes/collections.ts` (add DELETE route)

---

## Verification

### Test 1: Setup Test Data

Use test data from Build 71 or create new:

```bash
cd /Volumes/DataSSD/gitsrc/vfa_gallery

# Verify collection has artworks (from Build 71)
wrangler d1 execute site --command="SELECT * FROM collection_artworks WHERE collection_id='col-71';"
```

Expected output: At least one artwork in the collection.

### Test 2: Successful Artwork Removal

Remove an artwork from collection:

```bash
curl -X DELETE http://localhost:8787/api/collections/col-71/artworks/art-71-1 \
  -H "Authorization: Bearer YOUR_TEST_JWT"
```

**Expected response (200):**
```json
{
  "success": true,
  "message": "Artwork removed from collection"
}
```

### Test 3: Verify Artwork Still Exists in Library

Confirm the artwork was not deleted, only removed from collection:

```bash
wrangler d1 execute site --command="SELECT id, title, status FROM artworks WHERE id='art-71-1';"
```

Expected output: Artwork still exists with status 'active'.

### Test 4: Verify Junction Table Entry Removed

Check that the relationship was deleted:

```bash
wrangler d1 execute site --command="SELECT * FROM collection_artworks WHERE collection_id='col-71' AND artwork_id='art-71-1';"
```

Expected output: No results (empty).

### Test 5: Position Reordering After Removal

Setup: Add 3 artworks with positions 0, 1, 2. Remove middle one (position 1).

```bash
# Create new test artworks
wrangler d1 execute site --command="INSERT INTO artworks (id, user_id, title, slug, status) VALUES ('art-72-1', 'user-71', 'Art 1', 'art-1', 'active');"
wrangler d1 execute site --command="INSERT INTO artworks (id, user_id, title, slug, status) VALUES ('art-72-2', 'user-71', 'Art 2', 'art-2', 'active');"
wrangler d1 execute site --command="INSERT INTO artworks (id, user_id, title, slug, status) VALUES ('art-72-3', 'user-71', 'Art 3', 'art-3', 'active');"

# Create new collection
wrangler d1 execute site --command="INSERT INTO collections (id, gallery_id, slug, name) VALUES ('col-72-pos', 'gal-71', 'pos-test', 'Position Test');"

# Add artworks manually with specific positions
wrangler d1 execute site --command="INSERT INTO collection_artworks (id, collection_id, artwork_id, position) VALUES ('ca-1', 'col-72-pos', 'art-72-1', 0);"
wrangler d1 execute site --command="INSERT INTO collection_artworks (id, collection_id, artwork_id, position) VALUES ('ca-2', 'col-72-pos', 'art-72-2', 1);"
wrangler d1 execute site --command="INSERT INTO collection_artworks (id, collection_id, artwork_id, position) VALUES ('ca-3', 'col-72-pos', 'art-72-3', 2);"

# Verify positions before removal
wrangler d1 execute site --command="SELECT artwork_id, position FROM collection_artworks WHERE collection_id='col-72-pos' ORDER BY position;"
```

Output should show positions: 0, 1, 2

```bash
# Remove middle artwork
curl -X DELETE http://localhost:8787/api/collections/col-72-pos/artworks/art-72-2 \
  -H "Authorization: Bearer YOUR_TEST_JWT"

# Verify positions after removal
wrangler d1 execute site --command="SELECT artwork_id, position FROM collection_artworks WHERE collection_id='col-72-pos' ORDER BY position;"
```

Expected output: Positions should now be 0, 1 (sequential without gaps).

### Test 6: Ownership Validation

Try removing artwork from collection owned by different user:

```bash
# Create second user's collection (from Build 71)
# Create art in first user's collection
wrangler d1 execute site --command="INSERT INTO artworks (id, user_id, title, slug, status) VALUES ('art-other', 'user-72', 'Other User Art', 'other-art', 'active');"
wrangler d1 execute site --command="INSERT INTO collection_artworks (id, collection_id, artwork_id, position) VALUES ('ca-other', 'col-72', 'art-other', 0);"

# Try to remove with user-71 token
curl -X DELETE http://localhost:8787/api/collections/col-72/artworks/art-other \
  -H "Authorization: Bearer USER_71_JWT"
```

**Expected response (403):**
```json
{
  "error": "You do not own this collection"
}
```

### Test 7: Non-Existent Artwork in Collection

Try removing artwork that's not in the collection:

```bash
curl -X DELETE http://localhost:8787/api/collections/col-71/artworks/art-nonexistent \
  -H "Authorization: Bearer YOUR_TEST_JWT"
```

**Expected response (404):**
```json
{
  "error": "Artwork not found in this collection"
}
```

### Test 8: Authentication Required

Send request without authentication:

```bash
curl -X DELETE http://localhost:8787/api/collections/col-71/artworks/art-71-2
```

**Expected response (401):**
```json
{
  "error": "Unauthorized"
}
```

### Test 9: Verify Collection Updated_At Changed

Check that the collection's updated_at timestamp changed:

```bash
wrangler d1 execute site --command="SELECT updated_at FROM collections WHERE id='col-71';"
```

Expected output: Timestamp is recent (should match deletion time).

### Test 10: Remove Last Artwork from Collection

Add and remove artwork until collection is empty:

```bash
# Create a test collection
wrangler d1 execute site --command="INSERT INTO collections (id, gallery_id, slug, name) VALUES ('col-empty', 'gal-71', 'empty-test', 'Empty Test');"
wrangler d1 execute site --command="INSERT INTO artworks (id, user_id, title, slug, status) VALUES ('art-single', 'user-71', 'Single Art', 'single', 'active');"
wrangler d1 execute site --command="INSERT INTO collection_artworks (id, collection_id, artwork_id, position) VALUES ('ca-single', 'col-empty', 'art-single', 0);"

# Remove the only artwork
curl -X DELETE http://localhost:8787/api/collections/col-empty/artworks/art-single \
  -H "Authorization: Bearer YOUR_TEST_JWT"

# Verify collection is now empty
wrangler d1 execute site --command="SELECT COUNT(*) as count FROM collection_artworks WHERE collection_id='col-empty';"
```

Expected output: count = 0 (collection is empty but still exists).

### Test 11: Add Artwork Again After Removal

Remove an artwork then add it back:

```bash
# Use artwork from Test 3
curl -X DELETE http://localhost:8787/api/collections/col-71/artworks/art-71-2 \
  -H "Authorization: Bearer YOUR_TEST_JWT"

# Add it back
curl -X POST http://localhost:8787/api/collections/col-71/artworks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TEST_JWT" \
  -d '{
    "artworkId": "art-71-2"
  }'
```

Expected: Both operations should succeed.

### Test 12: Database Integrity - Artwork Not Cascade Deleted

Verify artwork record is completely unaffected:

```bash
# Get artwork details before removal
wrangler d1 execute site --command="SELECT id, user_id, title, created_at, updated_at FROM artworks WHERE id='art-71-1';"

# Remove from collection
curl -X DELETE http://localhost:8787/api/collections/col-71/artworks/art-71-1 \
  -H "Authorization: Bearer YOUR_TEST_JWT"

# Get artwork details after removal
wrangler d1 execute site --command="SELECT id, user_id, title, created_at, updated_at FROM artworks WHERE id='art-71-1';"
```

Expected: Artwork details are identical before and after removal (only the collection_artworks entry was deleted).

---

## Success Criteria

- [ ] DELETE endpoint created at `/api/collections/:id/artworks/:artworkId`
- [ ] Collection ownership verified through gallery chain
- [ ] Artwork-collection relationship existence validated
- [ ] Junction table entry deleted successfully
- [ ] Artwork record NOT deleted (remains in library)
- [ ] Positions reordered to maintain sequential values
- [ ] Collection updated_at timestamp updated
- [ ] Response indicates success with message
- [ ] Ownership validation prevents unauthorized removal (403)
- [ ] Non-existent relationships return 404
- [ ] All error cases handled correctly
- [ ] All tests pass without errors

---

## Next Steps

Once verified, proceed to Build 73 to create the PATCH endpoint for batch reordering of artworks within collections. This uses the position reordering logic from this build.

