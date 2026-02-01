# 67-API-COLLECTION-DELETE.md

## Goal

Create the `DELETE /api/collections/:id` endpoint that allows users to delete collections they own. Includes cascade deletion of collection-artwork associations while preserving artwork records. Prevents deletion of default collections.

---

## Spec Extract

From TECHNICAL-SPEC.md - Collection CRUD Operations:

- **Endpoint:** `DELETE /api/collections/:id`
- **Authentication:** Required (JWT token)
- **Path Parameters:**
  - `id` - Collection ID (required)
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Collection deleted successfully"
  }
  ```
- **Error: Default Collection (400 Bad Request):**
  ```json
  {
    "error": {
      "code": "BAD_REQUEST",
      "message": "Cannot delete the default collection"
    }
  }
  ```
- **Ownership:** Verify user owns gallery through collection -> gallery -> user chain
- **Cascade Behavior:**
  - Delete all entries in `collection_artworks` junction table
  - Artworks themselves are NOT deleted (remain in user's library)
  - Delete the collection record itself
- **Protected Collections:** Collections with `is_default = true` cannot be deleted

---

## Prerequisites

**Must complete before starting:**
- **15-API-FOUNDATION.md** - Hono app and error handling
- **16-API-MIDDLEWARE-AUTH.md** - Authentication middleware
- **09-SCHEMA-COLLECTIONS.md** - Collections table schema
- **10-SCHEMA-ARTWORKS.md** - Artworks and junction tables
- **65-API-COLLECTION-GET.md** - Collection retrieval endpoint
- **63-API-COLLECTION-CREATE.md** - Collection creation (for reference)

---

## Steps

### Step 1: Create Collection Delete Service Function

Add a delete function to the collection service module.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/services/collection.service.ts`

Add this function to the existing file:

```typescript
/**
 * Delete a collection and cascade-delete associated artwork references
 *
 * Behavior:
 * - Verifies user owns the gallery through collection -> gallery -> user chain
 * - Prevents deletion of default collection (is_default = true)
 * - Deletes all entries in collection_artworks junction table
 * - Artworks are NOT deleted, just removed from this collection
 * - Deletes the collection record
 *
 * @param db Database connection
 * @param collectionId Collection to delete
 * @param userId User making the delete (ownership verified)
 * @throws NOT_FOUND if collection not found
 * @throws FORBIDDEN if user doesn't own the gallery
 * @throws BAD_REQUEST if collection is default (cannot delete)
 */
export async function deleteCollection(
  db: Database,
  collectionId: string,
  userId: string
): Promise<void> {
  // Fetch collection to verify it exists and get details
  const collection = await db
    .prepare('SELECT * FROM collections WHERE id = ?')
    .bind(collectionId)
    .first<Collection>()

  if (!collection) {
    throw Errors.notFound('Collection not found')
  }

  // Verify user owns the gallery through collection -> gallery -> user chain
  const gallery = await db
    .prepare('SELECT user_id FROM galleries WHERE id = ?')
    .bind(collection.gallery_id)
    .first<{ user_id: string }>()

  if (!gallery) {
    throw Errors.notFound('Gallery not found')
  }

  if (gallery.user_id !== userId) {
    throw Errors.forbidden(
      'You do not have permission to delete this collection'
    )
  }

  // Prevent deletion of default collection
  if (collection.is_default === 1 || collection.is_default === true) {
    throw Errors.badRequest('Cannot delete the default collection')
  }

  // Start transaction for cascading deletes
  // First, delete all collection_artworks entries for this collection
  await db
    .prepare('DELETE FROM collection_artworks WHERE collection_id = ?')
    .bind(collectionId)
    .run()

  // Then delete the collection itself
  await db
    .prepare('DELETE FROM collections WHERE id = ?')
    .bind(collectionId)
    .run()
}
```

**Explanation:**
- Fetches collection to verify existence and get details
- Verifies ownership through gallery chain (collection -> gallery -> user)
- Checks `is_default` flag and prevents deletion if true
- Cascades delete to `collection_artworks` junction table
- Preserves artwork records (they remain in user's library)
- Deletes the collection record itself
- Uses proper error codes for all failure modes

---

### Step 2: Add Delete Route to Collections Router

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/collections.ts`

Add this route handler after the update handler:

```typescript
import { deleteCollection } from '../services/collection.service'

/**
 * DELETE /api/collections/:id
 * Delete a collection (cascade deletes artwork associations only)
 *
 * Authentication: Required
 * Response: { success: true }
 *
 * Returns 400 if collection is default (cannot delete)
 * Returns 403 if user doesn't own the gallery
 * Returns 404 if collection not found
 */
export async function handleDeleteCollection(c: HonoContext) {
  try {
    const user = c.get('user')
    if (!user) {
      throw Errors.unauthorized('Authentication required')
    }

    const collectionId = c.req.param('id')
    if (!collectionId) {
      throw Errors.badRequest('Collection ID is required')
    }

    // Delete collection using service
    const db = c.env.DB
    await deleteCollection(db, collectionId, user.id)

    // Return success response
    return c.json(
      {
        success: true,
        message: 'Collection deleted successfully',
      },
      200
    )
  } catch (err) {
    if (err instanceof ApiError) {
      throw err
    }
    throw Errors.internal('Failed to delete collection')
  }
}
```

**Explanation:**
- Validates authentication token
- Extracts collection ID from path parameter
- Calls service function to perform cascading delete
- Returns success message with 200 OK
- Proper error handling for all failure modes

---

### Step 3: Register Delete Route in Main API Router

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/index.ts`

Register the DELETE route:

```typescript
import { handleDeleteCollection } from './routes/collections'

// ... existing collection routes ...

// Delete collection
app.delete('/collections/:id', requireAuth, handleDeleteCollection)
```

---

### Step 4: Add TypeScript Documentation

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/services/collection.service.ts`

Add comprehensive JSDoc comments to the delete function:

```typescript
/**
 * Delete a collection and cascade-delete associated artwork references
 *
 * Deletion Process:
 * 1. Verify collection exists
 * 2. Verify user owns the gallery through ownership chain
 * 3. Prevent deletion if collection is marked as default
 * 4. Delete all entries in collection_artworks junction table
 *    - This removes the artwork from this collection
 *    - Artwork records are preserved and remain in user's library
 *    - Other collections containing the same artwork are unaffected
 * 5. Delete the collection record itself
 *
 * Protected Collections:
 * - Collections with is_default = true cannot be deleted
 * - Each gallery has one default collection created at gallery creation time
 * - Prevents leaving users without a default collection
 *
 * Artworks:
 * - Artwork records are NEVER deleted
 * - Only the association in collection_artworks is removed
 * - Artwork can exist in multiple collections or no collections
 *
 * @param db Database connection
 * @param collectionId Collection to delete
 * @param userId User making the delete (ownership verified)
 * @returns Promise that resolves when deletion is complete
 * @throws NOT_FOUND if collection or gallery not found
 * @throws FORBIDDEN if user doesn't own the gallery
 * @throws BAD_REQUEST if trying to delete default collection
 */
export async function deleteCollection(
  db: Database,
  collectionId: string,
  userId: string
): Promise<void> {
  // ... implementation ...
}
```

---

## Files to Create/Modify

**Files to modify:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/services/collection.service.ts` - Add `deleteCollection()` function
2. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/collections.ts` - Add `handleDeleteCollection()` handler
3. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/index.ts` - Register DELETE route

---

## Verification

### Test 1: Route Compiles

```bash
cd /Volumes/DataSSD/gitsrc/vfa_gallery
npx tsc --noEmit
```

Expected: No type errors

---

### Test 2: Delete Collection (Success Case)

```bash
# Create a collection first
curl -X POST http://localhost:8788/api/galleries/gal_123/collections \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "Temporary Collection"}'

# Response includes collection ID: col_temp123

# Delete the collection
curl -X DELETE http://localhost:8788/api/collections/col_temp123 \
  -H "Authorization: Bearer <token>"
```

Expected response (200):
```json
{
  "success": true,
  "message": "Collection deleted successfully"
}
```

---

### Test 3: Delete Non-Existent Collection

```bash
curl -X DELETE http://localhost:8788/api/collections/col_nonexistent \
  -H "Authorization: Bearer <token>"
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

### Test 4: Delete Without Authentication

```bash
curl -X DELETE http://localhost:8788/api/collections/col_test123
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

### Test 5: Delete Collection in Non-Owned Gallery

1. Create gallery and collection with User A
2. Try to delete with User B's token:

```bash
curl -X DELETE http://localhost:8788/api/collections/user-a-collection-id \
  -H "Authorization: Bearer <user-b-token>"
```

Expected response (403):
```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "You do not have permission to delete this collection"
  }
}
```

---

### Test 6: Prevent Default Collection Deletion

```bash
# Get default collection ID from gallery fetch
curl http://localhost:8788/api/galleries/gal_123 \
  -H "Authorization: Bearer <token>"
# Look for collection with is_default: true

# Try to delete it
curl -X DELETE http://localhost:8788/api/collections/col_default \
  -H "Authorization: Bearer <token>"
```

Expected response (400):
```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "Cannot delete the default collection"
  }
}
```

---

### Test 7: Cascade Delete Collection-Artworks Junction

```bash
# Create a collection and add an artwork to it
# (requires collection and artwork creation APIs)

# Verify artwork exists in collection_artworks
wrangler d1 execute site --command="SELECT * FROM collection_artworks WHERE collection_id = 'col_test123';"
# Should return one or more rows

# Delete the collection
curl -X DELETE http://localhost:8788/api/collections/col_test123 \
  -H "Authorization: Bearer <token>"

# Verify collection_artworks entries are deleted
wrangler d1 execute site --command="SELECT * FROM collection_artworks WHERE collection_id = 'col_test123';"
# Should return zero rows (empty result)
```

Expected: All collection_artworks entries deleted

---

### Test 8: Artworks Preserved After Collection Delete

```bash
# Create a collection with an artwork
# Get the artwork ID, e.g., art_123

# Delete the collection
curl -X DELETE http://localhost:8788/api/collections/col_test123 \
  -H "Authorization: Bearer <token>"

# Verify artwork still exists
wrangler d1 execute site --command="SELECT * FROM artworks WHERE id = 'art_123';"
# Should still return the artwork record
```

Expected: Artwork record is preserved, only association is removed

---

### Test 9: Artwork in Multiple Collections

```bash
# Create two collections: col_A and col_B
# Add same artwork (art_123) to both collections

# Verify artwork is in both
wrangler d1 execute site --command="SELECT * FROM collection_artworks WHERE artwork_id = 'art_123';"
# Should return 2 rows

# Delete collection A
curl -X DELETE http://localhost:8788/api/collections/col_A \
  -H "Authorization: Bearer <token>"

# Verify artwork is still in collection B
wrangler d1 execute site --command="SELECT * FROM collection_artworks WHERE artwork_id = 'art_123';"
# Should return 1 row (for col_B only)
```

Expected: Artwork remains in other collections

---

### Test 10: Verify Collection Deletion in Database

```bash
# After deleting a collection
wrangler d1 execute site --command="SELECT * FROM collections WHERE id = 'col_test123';"
```

Expected: Returns no rows (collection record deleted)

---

### Test 11: Delete Collection, Re-create with Same Name

```bash
# Create collection with name "Dragons"
# Delete it
# Create another collection with same name "Dragons"

# Both should succeed
# Second collection should get same slug or unique slug depending on implementation
```

Expected: Can reuse names/slugs after deletion

---

### Test 12: Gallery Still Exists After Collection Delete

```bash
# Create gallery with multiple collections
# Delete one collection

# Verify gallery still exists
curl http://localhost:8788/api/galleries/gal_123 \
  -H "Authorization: Bearer <token>"

# Should return 200 with remaining collections
```

Expected: Gallery is unaffected, only the specific collection is deleted

---

## Success Criteria

- [ ] DELETE /api/collections/:id requires authentication
- [ ] DELETE returns 404 for non-existent collections
- [ ] DELETE returns 403 for non-owned collections
- [ ] DELETE returns 400 for default collections
- [ ] DELETE returns 200 with success message
- [ ] Collection record is deleted from database
- [ ] collection_artworks entries are cascade-deleted
- [ ] Artwork records are preserved
- [ ] Artworks remain in user's library
- [ ] Other collections with same artwork are unaffected
- [ ] Gallery record is preserved
- [ ] Can re-create collection with deleted name/slug
- [ ] TypeScript compilation succeeds

---

## Next Steps

Once this build is verified, proceed to:
- **68-API-COLLECTION-COPY.md** - Add collection copy endpoint
- **70-UI-COLLECTION-MANAGER.md** - Collection management UI
