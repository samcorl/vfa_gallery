# 66-API-COLLECTION-UPDATE.md

## Goal

Create the `PATCH /api/collections/:id` endpoint that allows users to update collection details including name, description, hero image URL, theme, and status. Implements proper ownership verification and slug regeneration for name changes.

---

## Spec Extract

From TECHNICAL-SPEC.md - Collection CRUD Operations:

- **Endpoint:** `PATCH /api/collections/:id`
- **Authentication:** Required (JWT token)
- **Path Parameters:**
  - `id` - Collection ID (required)
- **Request Body (all fields optional):**
  ```json
  {
    "name": "Updated Collection Name",
    "description": "Updated description",
    "heroImageUrl": "https://r2.example.com/...",
    "themeId": "theme_dark",
    "status": "active"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "data": {
      "id": "col_abc123",
      "galleryId": "gal_123",
      "slug": "updated-collection-name",
      "name": "Updated Collection Name",
      "description": "Updated description",
      "heroImageUrl": "https://r2.example.com/...",
      "themeId": "theme_dark",
      "isDefault": 0,
      "status": "active",
      "createdAt": "2026-01-18T12:00:00Z",
      "updatedAt": "2026-01-18T13:00:00Z"
    }
  }
  ```
- **Ownership:** Verify user owns gallery through collection -> gallery -> user chain
- **Slug Generation:** If name changes, regenerate slug and ensure uniqueness within gallery
- **Protected Fields:** `is_default` cannot be changed (system managed)
- **Status Values:** "active", "hidden", "archived"

---

## Prerequisites

**Must complete before starting:**
- **15-API-FOUNDATION.md** - Hono app and error handling
- **16-API-MIDDLEWARE-AUTH.md** - Authentication middleware
- **09-SCHEMA-COLLECTIONS.md** - Collections table schema
- **65-API-COLLECTION-GET.md** - Collection retrieval endpoint
- **63-API-COLLECTION-CREATE.md** - Collection creation (for reference)

---

## Steps

### Step 1: Create Collection Update Service Function

Add an update function to the collection service module.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/services/collection.service.ts`

Add this function to the existing file:

```typescript
export interface UpdateCollectionInput {
  name?: string
  description?: string
  heroImageUrl?: string
  themeId?: string
  status?: 'active' | 'hidden' | 'archived'
}

/**
 * Update a collection (ownership verified through gallery chain)
 */
export async function updateCollection(
  db: Database,
  collectionId: string,
  input: UpdateCollectionInput,
  userId: string
): Promise<Collection> {
  // Fetch collection to verify it exists
  const collection = await db
    .prepare('SELECT * FROM collections WHERE id = ?')
    .bind(collectionId)
    .first<Collection>()

  if (!collection) {
    throw Errors.notFound('Collection not found')
  }

  // Verify user owns the gallery through the collection -> gallery -> user chain
  const gallery = await db
    .prepare('SELECT user_id FROM galleries WHERE id = ?')
    .bind(collection.gallery_id)
    .first<{ user_id: string }>()

  if (!gallery) {
    throw Errors.notFound('Gallery not found')
  }

  if (gallery.user_id !== userId) {
    throw Errors.forbidden('You do not have permission to update this collection')
  }

  // Build update query dynamically
  const updates: string[] = []
  const values: any[] = []

  let slug = collection.slug

  // Handle name change (requires slug regeneration)
  if (input.name !== undefined) {
    if (typeof input.name !== 'string') {
      throw Errors.badRequest('Name must be a string')
    }

    if (input.name.trim().length === 0) {
      throw Errors.badRequest('Name cannot be empty')
    }

    if (input.name.length > 255) {
      throw Errors.badRequest('Name must be 255 characters or less')
    }

    updates.push('name = ?')
    values.push(input.name.trim())

    // Regenerate slug for the new name
    slug = await generateUniqueSlug(db, collection.gallery_id, input.name)
    updates.push('slug = ?')
    values.push(slug)
  }

  // Handle description
  if (input.description !== undefined) {
    if (input.description !== null && typeof input.description !== 'string') {
      throw Errors.badRequest('Description must be a string or null')
    }

    if (input.description && input.description.length > 1000) {
      throw Errors.badRequest('Description must be 1,000 characters or less')
    }

    updates.push('description = ?')
    values.push(input.description ? input.description.trim() : null)
  }

  // Handle hero image URL
  if (input.heroImageUrl !== undefined) {
    if (input.heroImageUrl !== null && typeof input.heroImageUrl !== 'string') {
      throw Errors.badRequest('Hero image URL must be a string or null')
    }

    updates.push('hero_image_url = ?')
    values.push(input.heroImageUrl || null)
  }

  // Handle theme ID
  if (input.themeId !== undefined) {
    if (input.themeId !== null && typeof input.themeId !== 'string') {
      throw Errors.badRequest('Theme ID must be a string or null')
    }

    // Verify theme exists if provided
    if (input.themeId) {
      const theme = await db
        .prepare('SELECT id FROM themes WHERE id = ?')
        .bind(input.themeId)
        .first<{ id: string }>()

      if (!theme) {
        throw Errors.badRequest('Theme not found')
      }
    }

    updates.push('theme_id = ?')
    values.push(input.themeId || null)
  }

  // Handle status
  if (input.status !== undefined) {
    const validStatuses = ['active', 'hidden', 'archived']
    if (!validStatuses.includes(input.status)) {
      throw Errors.badRequest(
        `Status must be one of: ${validStatuses.join(', ')}`
      )
    }

    updates.push('status = ?')
    values.push(input.status)
  }

  // Always update updated_at
  updates.push('updated_at = ?')
  values.push(new Date().toISOString())

  // Add collection ID to values for WHERE clause
  values.push(collectionId)

  // Execute update
  if (updates.length > 0) {
    await db
      .prepare(`UPDATE collections SET ${updates.join(', ')} WHERE id = ?`)
      .bind(...values)
      .run()
  }

  // Fetch and return updated collection
  const updated = await db
    .prepare('SELECT * FROM collections WHERE id = ?')
    .bind(collectionId)
    .first<Collection>()

  if (!updated) {
    throw Errors.internal('Failed to retrieve updated collection')
  }

  return updated
}
```

**Explanation:**
- Fetches existing collection to verify it exists
- Verifies user ownership through gallery chain (collection -> gallery -> user)
- Dynamically builds UPDATE query based on provided fields
- Regenerates slug if name changes (ensures uniqueness within gallery)
- Validates all input values (type, length, format)
- Validates theme exists if provided
- Prevents updates to `is_default` field (system managed)
- Sets `updated_at` to current timestamp
- Returns the fully updated collection record

---

### Step 2: Add Update Route to Collections Router

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/collections.ts`

Add this route handler after the create handler:

```typescript
import {
  updateCollection,
  type UpdateCollectionInput,
} from '../services/collection.service'

/**
 * PATCH /api/collections/:id
 * Update a collection
 *
 * Authentication: Required
 * Body: { name?, description?, heroImageUrl?, themeId?, status? }
 * Response: { data: Collection }
 */
export async function handleUpdateCollection(c: HonoContext) {
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

    const input: UpdateCollectionInput = {}

    // Validate and include optional fields
    if (body.name !== undefined) {
      input.name = body.name
    }

    if (body.description !== undefined) {
      input.description = body.description
    }

    if (body.heroImageUrl !== undefined) {
      input.heroImageUrl = body.heroImageUrl
    }

    if (body.themeId !== undefined) {
      input.themeId = body.themeId
    }

    if (body.status !== undefined) {
      input.status = body.status
    }

    // Update collection using service
    const db = c.env.DB
    const collection = await updateCollection(db, collectionId, input, user.id)

    // Return updated collection
    return c.json({ data: collection }, 200)
  } catch (err) {
    if (err instanceof ApiError) {
      throw err
    }
    throw Errors.internal('Failed to update collection')
  }
}
```

**Explanation:**
- Validates authentication token
- Extracts collection ID from path parameter
- Parses and validates request body (all fields optional)
- Calls service function to perform update
- Returns updated collection with 200 OK
- Proper error handling for all failure modes

---

### Step 3: Register Update Route in Main API Router

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/index.ts`

Register the PATCH route:

```typescript
import { handleUpdateCollection } from './routes/collections'

// ... existing collection routes ...

// Update collection
app.patch('/collections/:id', requireAuth, handleUpdateCollection)
```

---

### Step 4: Update Collection Response Types

Ensure the collection types include all fields that can be updated.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/types/collection.ts`

Verify the Collection interface includes these fields:

```typescript
export interface Collection {
  id: string
  galleryId: string
  slug: string
  name: string
  description: string | null
  heroImageUrl: string | null
  themeId: string | null
  isDefault: number
  status: string
  createdAt: string
  updatedAt: string
}
```

---

### Step 5: Add API Documentation to TypeScript Types

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/services/collection.service.ts`

Add JSDoc comments to the update function:

```typescript
/**
 * Update a collection with optional fields
 *
 * Allowed updates:
 * - name: String (255 chars max) - triggers slug regeneration
 * - description: String (1000 chars max) or null
 * - heroImageUrl: String or null - URL to R2-hosted image
 * - themeId: String or null - theme ID from themes table
 * - status: "active" | "hidden" | "archived"
 *
 * Protected fields (cannot be updated):
 * - is_default: Always preserved (system-managed)
 * - gallery_id: Cannot move collection to different gallery
 * - created_at: Immutable creation timestamp
 *
 * @param db Database connection
 * @param collectionId Collection to update
 * @param input Partial collection data
 * @param userId User making the update (ownership verified)
 * @returns Updated collection record
 * @throws NOT_FOUND if collection or gallery not found
 * @throws FORBIDDEN if user doesn't own the gallery
 * @throws BAD_REQUEST if input validation fails
 */
export async function updateCollection(
  db: Database,
  collectionId: string,
  input: UpdateCollectionInput,
  userId: string
): Promise<Collection> {
  // ... implementation ...
}
```

---

## Files to Create/Modify

**Files to modify:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/services/collection.service.ts` - Add `updateCollection()` function
2. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/collections.ts` - Add `handleUpdateCollection()` handler
3. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/index.ts` - Register PATCH route

---

## Verification

### Test 1: Route Compiles

```bash
cd /Volumes/DataSSD/gitsrc/vfa_gallery
npx tsc --noEmit
```

Expected: No type errors

---

### Test 2: Update Collection Name Only

```bash
curl -X PATCH http://localhost:8788/api/collections/col_test123 \
  -H "Authorization: Bearer <valid-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Dragon Collection"
  }'
```

Expected response (200):
```json
{
  "data": {
    "id": "col_test123",
    "galleryId": "gal_123",
    "slug": "updated-dragon-collection",
    "name": "Updated Dragon Collection",
    "description": "Previous description",
    "heroImageUrl": null,
    "themeId": null,
    "isDefault": 0,
    "status": "active",
    "createdAt": "2026-01-18T12:00:00.000Z",
    "updatedAt": "2026-01-18T13:00:00.000Z"
  }
}
```

---

### Test 3: Update Multiple Fields

```bash
curl -X PATCH http://localhost:8788/api/collections/col_test123 \
  -H "Authorization: Bearer <valid-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Fantasy Dragons",
    "description": "My best dragon artwork",
    "status": "active"
  }'
```

Expected response (200):
- All three fields updated
- Slug regenerated to "fantasy-dragons"
- Other fields preserved

---

### Test 4: Update Without Authentication

```bash
curl -X PATCH http://localhost:8788/api/collections/col_test123 \
  -H "Content-Type: application/json" \
  -d '{"name": "Unauthorized Update"}'
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

### Test 5: Update Non-Existent Collection

```bash
curl -X PATCH http://localhost:8788/api/collections/col_nonexistent \
  -H "Authorization: Bearer <valid-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test"}'
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

### Test 6: Update Collection in Non-Owned Gallery

1. Create gallery and collection with User A
2. Try to update with User B's token:

```bash
curl -X PATCH http://localhost:8788/api/collections/user-a-collection-id \
  -H "Authorization: Bearer <user-b-token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "Unauthorized Update"}'
```

Expected response (403):
```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "You do not have permission to update this collection"
  }
}
```

---

### Test 7: Slug Regeneration on Name Change

```bash
# Create collection with name "Dragons"
curl -X POST http://localhost:8788/api/galleries/gal_123/collections \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "Dragons"}'

# Response has slug: "dragons"

# Update name to "Flying Dragons"
curl -X PATCH http://localhost:8788/api/collections/col_test123 \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "Flying Dragons"}'

# Response should have slug: "flying-dragons"
```

Expected: Slug automatically updated based on new name

---

### Test 8: Slug Uniqueness After Update

```bash
# Create two collections:
# 1. "Dragons" with slug "dragons"
# 2. "Flying Dragons" with slug "flying-dragons"

# Update collection 1 to same name as collection 2
curl -X PATCH http://localhost:8788/api/collections/col_dragons \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "Flying Dragons"}'

# Response should have slug: "flying-dragons-2"
```

Expected: Slug gets number appended to ensure uniqueness

---

### Test 9: Update Status

```bash
curl -X PATCH http://localhost:8788/api/collections/col_test123 \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"status": "hidden"}'
```

Expected response (200):
- Status field updated to "hidden"
- All other fields preserved

---

### Test 10: Invalid Status Value

```bash
curl -X PATCH http://localhost:8788/api/collections/col_test123 \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"status": "invalid-status"}'
```

Expected response (400):
```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "Status must be one of: active, hidden, archived"
  }
}
```

---

### Test 11: Update Hero Image URL

```bash
curl -X PATCH http://localhost:8788/api/collections/col_test123 \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"heroImageUrl": "https://r2.example.com/image.jpg"}'
```

Expected response (200):
- heroImageUrl field updated
- Other fields preserved

---

### Test 12: Empty Update (No Fields)

```bash
curl -X PATCH http://localhost:8788/api/collections/col_test123 \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Expected response (200):
- Collection unchanged
- updated_at timestamp still updated to now

---

### Test 13: Protected Fields Cannot Be Updated

```bash
# Try to update is_default field
curl -X PATCH http://localhost:8788/api/collections/col_test123 \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"isDefault": true, "name": "Test"}'
```

Expected: Name is updated, but is_default remains unchanged

---

### Test 14: Verify Database Update

```bash
wrangler d1 execute vfa-gallery --command="SELECT * FROM collections WHERE id = 'col_test123';"
```

Expected: All fields match the response data, including updated_at timestamp

---

## Success Criteria

- [ ] PATCH /api/collections/:id requires authentication
- [ ] PATCH returns 404 for non-existent collections
- [ ] PATCH returns 403 for non-owned collections
- [ ] PATCH returns 200 with updated collection data
- [ ] Name changes trigger slug regeneration
- [ ] Regenerated slugs are unique within the gallery
- [ ] Description field can be updated
- [ ] Hero image URL field can be updated
- [ ] Theme ID field can be updated (with validation)
- [ ] Status field can be updated (with validation)
- [ ] is_default field cannot be changed (protected)
- [ ] updated_at timestamp is set to current time
- [ ] created_at timestamp is preserved
- [ ] Empty PATCH requests do not error
- [ ] All changes persist in database
- [ ] TypeScript compilation succeeds

---

## Next Steps

Once this build is verified, proceed to:
- **67-API-COLLECTION-DELETE.md** - Add collection delete endpoint
- **68-API-COLLECTION-COPY.md** - Add collection copy endpoint
- **70-UI-COLLECTION-MANAGER.md** - Collection management UI
