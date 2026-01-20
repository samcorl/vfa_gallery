# 69-API-COLLECTION-DEFAULT.md

## Goal

Document the default collection behavior and implementation. Each user automatically receives a default collection when their default gallery is created. This documentation ensures the feature is properly implemented across all relevant endpoints and provides context for dependent features.

---

## Spec Extract

From TECHNICAL-SPEC.md - Collection Architecture:

**Default Collection Overview:**
- Automatically created when a user's default gallery is created
- Marked with `is_default = true` (INTEGER 1 in SQLite)
- Provides users with an immediate place to organize artworks on signup
- Cannot be deleted (protected by delete endpoint)
- Can be renamed by the user
- Appears first in gallery's collections list
- Cannot be marked as non-default

**Default Collection Details:**
- **Name:** "My Collection"
- **Slug:** "my-collection"
- **Description:** null (empty)
- **Status:** "active"
- **Theme ID:** null (inherits gallery theme)
- **Hero Image URL:** null
- **Gallery ID:** Links to user's default gallery

---

## Prerequisites

**Must complete before starting:**
- **57-API-GALLERY-DEFAULT.md** - Default gallery creation (must create default collection)
- **63-API-COLLECTION-CREATE.md** - Collection creation logic
- **65-API-COLLECTION-GET.md** - Collection retrieval
- **67-API-COLLECTION-DELETE.md** - Delete endpoint (must protect default)

**Related builds:**
- **66-API-COLLECTION-UPDATE.md** - Allow renaming default collection
- **62-UI-GALLERY-MANAGER.md** - Display default collection

---

## Steps

### Step 1: Verify Default Gallery Creates Default Collection

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/galleries.ts`

Ensure the default gallery creation endpoint creates a default collection. Check the existing `POST /api/galleries/default` handler or equivalent:

```typescript
/**
 * Create user's default gallery with default collection
 * Called on user signup or first access
 */
export async function handleCreateDefaultGallery(c: HonoContext) {
  try {
    const user = c.get('user')
    if (!user) {
      throw Errors.unauthorized('Authentication required')
    }

    const db = c.env.DB

    // Check if user already has a default gallery
    const existing = await db
      .prepare('SELECT id FROM galleries WHERE user_id = ? AND is_default = 1')
      .bind(user.id)
      .first<{ id: string }>()

    if (existing) {
      throw Errors.conflict('Default gallery already exists')
    }

    // Create default gallery
    const galleryId = generateGalleryId()
    const now = new Date().toISOString()

    await db
      .prepare(
        `
        INSERT INTO galleries (
          id, user_id, slug, name, description,
          welcome_message, is_default, status,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
      )
      .bind(
        galleryId,
        user.id,
        'my-gallery', // Slug for default gallery
        'My Gallery', // Name for default gallery
        null, // No description
        'Welcome to my gallery!', // Default welcome message
        1, // is_default = true
        'active',
        now,
        now
      )
      .run()

    // CREATE DEFAULT COLLECTION
    const collectionId = generateCollectionId()

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
        collectionId,
        galleryId,
        'my-collection', // Default collection slug
        'My Collection', // Default collection name
        null, // No description
        1, // is_default = true (IMPORTANT: mark as default)
        'active',
        now,
        now
      )
      .run()

    // Fetch and return the created gallery with collection
    const gallery = await db
      .prepare('SELECT * FROM galleries WHERE id = ?')
      .bind(galleryId)
      .first<GalleryRow>()

    if (!gallery) {
      throw Errors.internal('Failed to create default gallery')
    }

    const collections = await db
      .prepare('SELECT * FROM collections WHERE gallery_id = ?')
      .bind(galleryId)
      .all<Collection>()

    return c.json(
      {
        data: {
          ...galleryRowToApi(gallery),
          collections: collections?.results || [],
        },
      },
      201
    )
  } catch (err) {
    if (err instanceof ApiError) {
      throw err
    }
    throw Errors.internal('Failed to create default gallery')
  }
}
```

**Key Points:**
- Default gallery is created with `is_default = 1`
- Default collection is created with `is_default = 1` inside the gallery
- Default collection has fixed name "My Collection"
- Default collection has fixed slug "my-collection"
- Both are created in the same transaction

---

### Step 2: Verify Delete Endpoint Protects Default Collection

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/services/collection.service.ts`

Ensure the delete function has this protection (from 67-API-COLLECTION-DELETE.md):

```typescript
/**
 * Delete a collection (but prevent deletion of default collection)
 */
export async function deleteCollection(
  db: Database,
  collectionId: string,
  userId: string
): Promise<void> {
  // ... ownership checks ...

  // Prevent deletion of default collection
  if (collection.is_default === 1 || collection.is_default === true) {
    throw Errors.badRequest('Cannot delete the default collection')
  }

  // ... rest of deletion logic ...
}
```

---

### Step 3: Verify Update Endpoint Allows Renaming

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/services/collection.service.ts`

Ensure the update function does NOT protect the name field (from 66-API-COLLECTION-UPDATE.md):

```typescript
/**
 * Update a collection
 * Default collections can be renamed but not deleted or have is_default changed
 */
export async function updateCollection(
  db: Database,
  collectionId: string,
  input: UpdateCollectionInput,
  userId: string
): Promise<Collection> {
  // ... fetch and ownership checks ...

  // Allow name to be updated even for default collections
  if (input.name !== undefined) {
    // Validate and update name
    if (input.name.trim().length === 0) {
      throw Errors.badRequest('Name cannot be empty')
    }
    updates.push('name = ?')
    values.push(input.name.trim())

    // Regenerate slug for new name
    slug = await generateUniqueSlug(db, collection.gallery_id, input.name)
    updates.push('slug = ?')
    values.push(slug)
  }

  // ... rest of update logic ...
}
```

**Important:** Default collections can be renamed by users, but the `is_default` flag cannot be changed.

---

### Step 4: Document Default Collection in GET Gallery Response

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/galleries.ts`

Ensure the GET /api/galleries/:id endpoint returns collections with the `isDefault` field:

```typescript
/**
 * GET /api/galleries/:id
 * Returns gallery with all collections, including default collection
 */
galleriesRouter.get('/:id', requireAuth, async (c) => {
  // ... fetch gallery and collections ...

  // Collections response should include is_default flag
  const collectionsResult = await db
    .prepare(
      `
      SELECT
        c.id,
        c.gallery_id,
        c.slug,
        c.name,
        c.description,
        c.is_default,
        COUNT(a.id) as artworkCount,
        c.created_at,
        c.updated_at
      FROM collections c
      LEFT JOIN artworks a ON a.collection_id = c.id
      WHERE c.gallery_id = ?
      GROUP BY c.id
      ORDER BY c.is_default DESC, c.created_at ASC
      `
    )
    .bind(galleryId)
    .all<CollectionRow & { artworkCount: number }>()

  // When returning, transform is_default (1/0) to boolean
  // ... rest of logic ...
})
```

**Ordering:** Default collection appears first in the list (ORDER BY is_default DESC)

---

### Step 5: Document Default Collection User Flow

**File:** This documentation

When a new user signs up:

1. **Authentication:** User authenticates via Google SSO (file 18-20)
2. **User Created:** User record created in database (file 30)
3. **Session Created:** JWT token generated (file 20)
4. **Default Gallery:** POST /api/galleries/default called (file 57)
5. **Default Collection:** Created automatically with the gallery (this file)
6. **User Profile:** User sees gallery at /profile/galleries with default collection
7. **First Artwork:** User can add artworks to default collection immediately

---

## Documentation Summary

### Default Collection Guarantees

**On Creation:**
- Name: "My Collection"
- Slug: "my-collection"
- is_default: true (1)
- status: "active"
- description: null
- heroImageUrl: null
- themeId: null (inherits gallery theme)

**User Operations:**
- ✅ Can rename (name and slug are mutable)
- ✅ Can add artworks to it
- ✅ Can upload hero image
- ✅ Can change status (hidden/archived)
- ❌ Cannot delete (is_default = true prevents deletion)
- ❌ Cannot change is_default flag

**Gallery Operations:**
- Default collection is created with default gallery
- Default collection cannot be deleted even if gallery is deleted
- Default collection appears first in collections list
- One default collection per gallery
- One default gallery per user

### API Endpoints Affected

**File 57 - Gallery Creation:**
- Creates default collection with default gallery

**File 63 - Collection Create:**
- Regular create endpoint (non-default collections only)

**File 65 - Collection Get:**
- Returns is_default flag in response
- Collections ordered with default first

**File 66 - Collection Update:**
- Allows renaming default collection
- Prevents changing is_default flag

**File 67 - Collection Delete:**
- Returns 400 error if trying to delete is_default = true

**File 68 - Collection Copy:**
- New collections are never default (is_default = 0)
- Can copy default collection to create non-default copies

---

## Files to Create/Modify

**This is primarily a documentation file.**

Files that must be verified/modified:
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/galleries.ts` - Verify default gallery creation includes default collection
2. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/services/collection.service.ts` - Verify delete protects default
3. Database schema (file 09-SCHEMA-COLLECTIONS.md) - Verify is_default column exists

---

## Verification

### Test 1: New User Gets Default Gallery and Collection

```bash
# Sign up a new user (or use test user)
# Check for default gallery and collection

curl http://localhost:8788/api/galleries \
  -H "Authorization: Bearer <new-user-token>"

# Response should include gallery with is_default: true
# and collection with name: "My Collection"
```

Expected response (200):
```json
{
  "data": [
    {
      "id": "gal_123",
      "name": "My Gallery",
      "isDefault": true,
      "collections": [
        {
          "id": "col_123",
          "name": "My Collection",
          "slug": "my-collection",
          "isDefault": true,
          "status": "active",
          "artworkCount": 0
        }
      ]
    }
  ]
}
```

---

### Test 2: Default Collection Appears First

```bash
# Create a gallery with a default collection
# Add a non-default collection

# Fetch gallery
curl http://localhost:8788/api/galleries/gal_123 \
  -H "Authorization: Bearer <token>"

# Collections should be ordered with default first
```

Expected: Default collection (is_default: true) appears before other collections

---

### Test 3: Cannot Delete Default Collection

```bash
# Try to delete the default collection
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

### Test 4: Can Rename Default Collection

```bash
# Update default collection name
curl -X PATCH http://localhost:8788/api/collections/col_default \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "All My Art"}'
```

Expected response (200):
```json
{
  "data": {
    "id": "col_default",
    "name": "All My Art",
    "slug": "all-my-art",
    "isDefault": true,
    "status": "active"
  }
}
```

---

### Test 5: Default Collection Slug Unique per Gallery

```bash
# Create multiple default galleries
# Each should have "my-collection" slug within its gallery
# But slugs are only unique per gallery, so this is fine

# User A gallery has collection with slug "my-collection"
# User B gallery also has collection with slug "my-collection"
# Both are allowed (unique within their galleries)
```

Expected: No slug conflicts (slugs are only unique per gallery)

---

### Test 6: Can Add Artworks to Default Collection

```bash
# Create artwork
# Add it to default collection

curl -X POST http://localhost:8788/api/artworks/art_123/collection \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"collectionId": "col_default"}'

# Should succeed
```

Expected: 200 OK, artwork added to default collection

---

### Test 7: Default Collection Inherited in Gallery Fetch

```bash
# Fetch gallery with all its data
curl http://localhost:8788/api/galleries/gal_123 \
  -H "Authorization: Bearer <token>"

# Should include default collection in collections array
```

Expected: Default collection appears in collections with is_default: true

---

### Test 8: Database Verification

```bash
# Query galleries table
wrangler d1 execute vfa-gallery --command="SELECT id, name, is_default FROM galleries WHERE is_default = 1 LIMIT 1;"

# Query collections table
wrangler d1 execute vfa-gallery --command="SELECT id, name, slug, is_default FROM collections WHERE is_default = 1 LIMIT 1;"
```

Expected:
- Default gallery has is_default = 1
- Default collection has is_default = 1
- Default collection slug is "my-collection"

---

## Success Criteria

- [ ] New users receive default gallery on signup
- [ ] Default gallery has is_default = true
- [ ] Default gallery includes default collection
- [ ] Default collection has name "My Collection"
- [ ] Default collection has slug "my-collection"
- [ ] Default collection has is_default = true
- [ ] Default collection appears first in collections list
- [ ] Default collection can be renamed
- [ ] Default collection cannot be deleted
- [ ] Artworks can be added to default collection
- [ ] Default collection is returned in GET /api/galleries/:id
- [ ] is_default flag is included in all collection responses
- [ ] Only one default collection per gallery
- [ ] Only one default gallery per user

---

## Related Documentation

- **File 57:** Default gallery creation process
- **File 63:** Collection creation (non-default)
- **File 65:** Collection retrieval
- **File 66:** Collection updates
- **File 67:** Collection deletion protection
- **File 68:** Collection copying (creates non-default copies)
- **File 62:** Gallery manager UI (displays default collection)
- **File 70:** Collection manager UI

---

## Next Steps

Once this documentation is complete and verified, proceed to:
- **70-UI-COLLECTION-MANAGER.md** - Collection detail/management page
