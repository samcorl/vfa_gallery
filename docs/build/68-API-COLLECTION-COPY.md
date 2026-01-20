# 68-API-COLLECTION-COPY.md

## Goal

Create the `POST /api/collections/:id/copy` endpoint that allows users to copy a collection (including all its artwork associations) to a different gallery. Supports copying own collections or public collections with proper ownership verification.

---

## Spec Extract

From TECHNICAL-SPEC.md - Collection Operations:

- **Endpoint:** `POST /api/collections/:id/copy`
- **Authentication:** Required (JWT token)
- **Path Parameters:**
  - `id` - Collection to copy (required)
- **Request Body:**
  ```json
  {
    "galleryId": "gal_target123"
  }
  ```
- **Response (201 Created):**
  ```json
  {
    "data": {
      "id": "col_new456",
      "galleryId": "gal_target123",
      "slug": "original-collection-name-copy",
      "name": "Original Collection Name (Copy)",
      "description": "Original description",
      "heroImageUrl": null,
      "themeId": null,
      "isDefault": 0,
      "status": "active",
      "createdAt": "2026-01-18T13:00:00Z",
      "updatedAt": "2026-01-18T13:00:00Z"
    }
  }
  ```
- **Copy Behavior:**
  - Creates new collection with " (Copy)" suffix on name
  - Generates unique slug within target gallery
  - Copies all artwork associations (user must own the artworks)
  - Sets copied collection status to "active"
  - Does NOT copy theme_id (user selects theme for new gallery)
  - Does NOT copy hero_image_url (starts blank)
  - Does NOT copy default status (new collection never default)

---

## Prerequisites

**Must complete before starting:**
- **15-API-FOUNDATION.md** - Hono app and error handling
- **16-API-MIDDLEWARE-AUTH.md** - Authentication middleware
- **09-SCHEMA-COLLECTIONS.md** - Collections table schema
- **10-SCHEMA-ARTWORKS.md** - Artworks and junction tables
- **52-API-GALLERY-CREATE.md** - Gallery creation
- **63-API-COLLECTION-CREATE.md** - Collection creation (for reference)
- **65-API-COLLECTION-GET.md** - Collection retrieval (for reference)

---

## Steps

### Step 1: Create Collection Copy Service Function

Add a copy function to the collection service module.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/services/collection.service.ts`

Add this function to the existing file:

```typescript
export interface CopyCollectionInput {
  galleryId: string
}

/**
 * Copy a collection to another gallery
 *
 * Behavior:
 * - User can copy their own collections or public collections
 * - New collection gets name + " (Copy)" suffix
 * - Slug is generated uniquely for target gallery
 * - All artwork associations are copied (must own artworks)
 * - Theme and hero image are NOT copied
 * - New collection always has is_default = false
 * - New collection always has status = "active"
 *
 * @param db Database connection
 * @param collectionId Collection to copy
 * @param input Target gallery ID
 * @param userId User making the copy (must own target gallery)
 * @returns New copied collection
 * @throws NOT_FOUND if source collection or target gallery not found
 * @throws FORBIDDEN if user can't copy this collection
 * @throws BAD_REQUEST if target gallery is not owned by user
 */
export async function copyCollection(
  db: Database,
  collectionId: string,
  input: CopyCollectionInput,
  userId: string
): Promise<Collection> {
  if (!input.galleryId) {
    throw Errors.badRequest('Target gallery ID is required')
  }

  // Fetch source collection
  const sourceCollection = await db
    .prepare('SELECT * FROM collections WHERE id = ?')
    .bind(collectionId)
    .first<Collection>()

  if (!sourceCollection) {
    throw Errors.notFound('Collection to copy not found')
  }

  // Fetch source collection's gallery for ownership check
  const sourceGallery = await db
    .prepare('SELECT id, user_id FROM galleries WHERE id = ?')
    .bind(sourceCollection.gallery_id)
    .first<{ id: string; user_id: string }>()

  if (!sourceGallery) {
    throw Errors.notFound('Source gallery not found')
  }

  // Verify user either owns source collection or collection is public
  // For now, only allow if user owns the source
  // (Can be extended to allow copying public collections)
  if (sourceGallery.user_id !== userId) {
    throw Errors.forbidden(
      'You can only copy collections you own (public collection copying not yet enabled)'
    )
  }

  // Fetch target gallery
  const targetGallery = await db
    .prepare('SELECT id, user_id FROM galleries WHERE id = ?')
    .bind(input.galleryId)
    .first<{ id: string; user_id: string }>()

  if (!targetGallery) {
    throw Errors.notFound('Target gallery not found')
  }

  // Verify user owns the target gallery
  if (targetGallery.user_id !== userId) {
    throw Errors.forbidden('You do not own the target gallery')
  }

  // Check collection limit for user
  const exceedsLimit = await checkCollectionLimit(db, userId)
  if (exceedsLimit) {
    throw Errors.conflict('Collection limit exceeded (max 1,000 per user)')
  }

  // Generate new name with " (Copy)" suffix
  const newName = `${sourceCollection.name} (Copy)`

  // Generate unique slug in target gallery
  const newSlug = await generateUniqueSlug(db, input.galleryId, newName)

  // Create new collection
  const newId = generateCollectionId()
  const now = new Date().toISOString()

  await db
    .prepare(
      `
      INSERT INTO collections (
        id, gallery_id, slug, name, description,
        is_default, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    )
    .bind(
      newId,
      input.galleryId,
      newSlug,
      newName,
      sourceCollection.description || null,
      0, // is_default = false
      'active', // status = active
      now,
      now
    )
    .run()

  // Copy all artwork associations from source to new collection
  const artworks = await db
    .prepare(
      `
      SELECT ca.artwork_id, ca.position
      FROM collection_artworks ca
      WHERE ca.collection_id = ?
      ORDER BY ca.position
      `
    )
    .bind(collectionId)
    .all<{ artwork_id: string; position: number }>()

  if (artworks?.results && artworks.results.length > 0) {
    for (const artwork of artworks.results) {
      // Verify user owns this artwork before copying
      const artworkRecord = await db
        .prepare('SELECT user_id FROM artworks WHERE id = ?')
        .bind(artwork.artwork_id)
        .first<{ user_id: string }>()

      if (artworkRecord && artworkRecord.user_id === userId) {
        // User owns this artwork, safe to copy
        await db
          .prepare(
            `
            INSERT INTO collection_artworks (
              id, collection_id, artwork_id, position, created_at
            ) VALUES (?, ?, ?, ?, ?)
            `
          )
          .bind(
            `ca_${nanoid(12)}`,
            newId,
            artwork.artwork_id,
            artwork.position,
            now
          )
          .run()
      }
      // If user doesn't own the artwork, skip it (don't copy unauthorized artworks)
    }
  }

  // Fetch and return the new collection
  const newCollection = await db
    .prepare('SELECT * FROM collections WHERE id = ?')
    .bind(newId)
    .first<Collection>()

  if (!newCollection) {
    throw Errors.internal('Failed to retrieve copied collection')
  }

  return newCollection
}
```

**Explanation:**
- Fetches source collection to verify existence
- Verifies ownership through source gallery
- Verifies user owns target gallery
- Checks collection limit
- Creates new collection with " (Copy)" name suffix
- Generates unique slug for target gallery
- Copies only owned artworks (security check)
- Sets new collection to active status with is_default = false
- Returns newly created copied collection

---

### Step 2: Add Copy Route to Collections Router

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/collections.ts`

Add this route handler after the delete handler:

```typescript
import { copyCollection, type CopyCollectionInput } from '../services/collection.service'
import { nanoid } from 'nanoid'

/**
 * POST /api/collections/:id/copy
 * Copy a collection to a target gallery
 *
 * Authentication: Required
 * Body: { galleryId: string }
 * Response: { data: Collection } with 201 Created status
 */
export async function handleCopyCollection(c: HonoContext) {
  try {
    const user = c.get('user')
    if (!user) {
      throw Errors.unauthorized('Authentication required')
    }

    const collectionId = c.req.param('id')
    if (!collectionId) {
      throw Errors.badRequest('Collection ID is required')
    }

    // Parse request body
    const body = await c.req.json()

    if (!body.galleryId || typeof body.galleryId !== 'string') {
      throw Errors.badRequest('Target gallery ID is required and must be a string')
    }

    const input: CopyCollectionInput = {
      galleryId: body.galleryId.trim(),
    }

    // Copy collection using service
    const db = c.env.DB
    const newCollection = await copyCollection(db, collectionId, input, user.id)

    // Return new collection with 201 Created status
    return c.json({ data: newCollection }, 201)
  } catch (err) {
    if (err instanceof ApiError) {
      throw err
    }
    throw Errors.internal('Failed to copy collection')
  }
}
```

**Explanation:**
- Validates authentication token
- Extracts source collection ID from path parameter
- Parses and validates target gallery ID from request body
- Calls service function to perform copy
- Returns new collection with 201 Created status
- Proper error handling for all failure modes

---

### Step 3: Register Copy Route in Main API Router

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/index.ts`

Register the POST copy route:

```typescript
import { handleCopyCollection } from './routes/collections'

// ... existing collection routes ...

// Copy collection
app.post('/collections/:id/copy', requireAuth, handleCopyCollection)
```

---

### Step 4: Update Collections Router Imports

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/collections.ts`

Ensure proper imports at top of file:

```typescript
import { nanoid } from 'nanoid'
import {
  copyCollection,
  type CopyCollectionInput,
} from '../services/collection.service'
import { Errors, ApiError } from '../errors'
```

---

## Files to Create/Modify

**Files to modify:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/services/collection.service.ts` - Add `copyCollection()` function
2. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/collections.ts` - Add `handleCopyCollection()` handler and imports
3. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/index.ts` - Register POST copy route

---

## Verification

### Test 1: Route Compiles

```bash
cd /Volumes/DataSSD/gitsrc/vfa_gallery
npx tsc --noEmit
```

Expected: No type errors

---

### Test 2: Copy Collection (Success Case)

```bash
# Create a source collection
curl -X POST http://localhost:8788/api/galleries/gal_source/collections \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "Dragons", "description": "Dragon artwork"}'

# Response includes id: col_source123

# Create a target gallery
curl -X POST http://localhost:8788/api/galleries \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "Second Gallery"}'

# Response includes id: gal_target123

# Copy the collection
curl -X POST http://localhost:8788/api/collections/col_source123/copy \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"galleryId": "gal_target123"}'
```

Expected response (201):
```json
{
  "data": {
    "id": "col_new456",
    "galleryId": "gal_target123",
    "slug": "dragons-copy",
    "name": "Dragons (Copy)",
    "description": "Dragon artwork",
    "heroImageUrl": null,
    "themeId": null,
    "isDefault": 0,
    "status": "active",
    "createdAt": "2026-01-18T13:00:00.000Z",
    "updatedAt": "2026-01-18T13:00:00.000Z"
  }
}
```

---

### Test 3: Copy Collection Without Auth

```bash
curl -X POST http://localhost:8788/api/collections/col_123/copy \
  -H "Content-Type: application/json" \
  -d '{"galleryId": "gal_456"}'
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

### Test 4: Copy Non-Existent Collection

```bash
curl -X POST http://localhost:8788/api/collections/col_nonexistent/copy \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"galleryId": "gal_456"}'
```

Expected response (404):
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Collection to copy not found"
  }
}
```

---

### Test 5: Copy to Non-Existent Target Gallery

```bash
curl -X POST http://localhost:8788/api/collections/col_123/copy \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"galleryId": "gal_nonexistent"}'
```

Expected response (404):
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Target gallery not found"
  }
}
```

---

### Test 6: Copy to Gallery Not Owned

1. User A creates Gallery A with Collection A
2. User B creates Gallery B
3. User A tries to copy Collection A to Gallery B:

```bash
curl -X POST http://localhost:8788/api/collections/col_from_user_a/copy \
  -H "Authorization: Bearer <user-a-token>" \
  -H "Content-Type: application/json" \
  -d '{"galleryId": "gal_from_user_b"}'
```

Expected response (403):
```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "You do not own the target gallery"
  }
}
```

---

### Test 7: Name Suffix Applied

```bash
# Copy collection with name "Dragons"
# New collection should have name "Dragons (Copy)"

curl -X POST http://localhost:8788/api/collections/col_dragons/copy \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"galleryId": "gal_target"}'

# Response should have name: "Dragons (Copy)"
```

Expected: New collection name has " (Copy)" suffix

---

### Test 8: Slug Generated for Target Gallery

```bash
# Copy collection to target gallery
# Check response slug matches target gallery

curl -X GET http://localhost:8788/api/galleries/gal_target \
  -H "Authorization: Bearer <token>"

# Should find the copied collection in the collections array
```

Expected: Copied collection appears in target gallery's collections

---

### Test 9: Artworks Copied

```bash
# Create source collection with artwork
# Add artwork to source collection

# Copy collection
curl -X POST http://localhost:8788/api/collections/col_source/copy \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"galleryId": "gal_target"}'

# Response includes id of new collection: col_new123

# Verify artworks are in new collection
wrangler d1 execute vfa-gallery --command="SELECT * FROM collection_artworks WHERE collection_id = 'col_new123';"
```

Expected: Artworks are copied to collection_artworks for new collection

---

### Test 10: Multiple Copies of Same Collection

```bash
# Copy collection A to gallery B (creates col_copy1)
# Copy collection A again to gallery B (should create col_copy2)

# First copy
curl -X POST http://localhost:8788/api/collections/col_A/copy \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"galleryId": "gal_B"}'

# Second copy (same source to same target)
curl -X POST http://localhost:8788/api/collections/col_A/copy \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"galleryId": "gal_B"}'

# Both should succeed with different names/slugs
```

Expected:
- First: name "Dragons (Copy)", slug "dragons-copy"
- Second: name "Dragons (Copy) (Copy)" or slug "dragons-copy-2"

---

### Test 11: Artwork Ownership Verification

```bash
# User A creates artwork and adds to collection
# User A copies collection to another gallery
# Artwork should be copied (User A owns it)

# User B creates artwork and adds to User A's collection
# User A copies collection
# Artwork from User B should NOT be copied
```

Expected: Only artworks owned by the copying user are copied

---

### Test 12: New Collection Status is Active

```bash
# Copy collection
curl -X POST http://localhost:8788/api/collections/col_source/copy \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"galleryId": "gal_target"}'

# Response should have status: "active"
```

Expected: Copied collection always has status "active"

---

### Test 13: Theme NOT Copied

```bash
# Create collection with theme_id set
# Copy it

# Response should have themeId: null
```

Expected: New collection doesn't inherit theme from source

---

### Test 14: Hero Image NOT Copied

```bash
# Create collection with hero_image_url set
# Copy it

# Response should have heroImageUrl: null
```

Expected: New collection starts with no hero image

---

### Test 15: Default Status NOT Copied

```bash
# Create default collection (is_default = true)
# Copy it

# Response should have isDefault: 0
```

Expected: Copied collection never has is_default = true

---

### Test 16: Missing Target Gallery ID

```bash
curl -X POST http://localhost:8788/api/collections/col_123/copy \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Expected response (400):
```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "Target gallery ID is required and must be a string"
  }
}
```

---

## Success Criteria

- [ ] POST /api/collections/:id/copy requires authentication
- [ ] POST returns 404 for non-existent source collection
- [ ] POST returns 404 for non-existent target gallery
- [ ] POST returns 403 if user doesn't own source collection
- [ ] POST returns 403 if user doesn't own target gallery
- [ ] POST returns 201 with new collection data
- [ ] New collection name includes " (Copy)" suffix
- [ ] New collection slug is unique within target gallery
- [ ] New collection has status "active"
- [ ] New collection has isDefault = false
- [ ] Artworks are copied to new collection
- [ ] Only owned artworks are copied (security)
- [ ] Artwork records are not duplicated (only associations)
- [ ] Theme is NOT copied (new collection has no theme)
- [ ] Hero image URL is NOT copied
- [ ] Multiple copies of same collection can be made
- [ ] TypeScript compilation succeeds

---

## Next Steps

Once this build is verified, proceed to:
- **69-API-COLLECTION-DEFAULT.md** - Document default collection behavior
- **70-UI-COLLECTION-MANAGER.md** - Collection management UI
