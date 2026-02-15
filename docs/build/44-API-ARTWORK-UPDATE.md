# 44-API-ARTWORK-UPDATE.md

## Goal
Implement the PATCH `/api/artworks/:id` endpoint that allows artwork owners to update metadata fields including title, description, materials, dimensions, creation date, category, and tags. Automatically regenerate unique slugs when title changes, and enforce ownership restrictions.

---

## Spec Extract

From TECHNICAL-SPEC.md:
- **Slug Regeneration**: Slugs are auto-generated from title, must be unique per user
- **Status Field**: 'active' (public), 'draft' (private), 'deleted' (soft deleted)
- **Fields**: Editable after creation: title, description, materials, dimensions, createdDate, category, tags

Protected fields (NOT editable):
- `id` - Immutable primary key
- `userId` - Ownership immutable
- `status` - Use DELETE endpoint for deletion
- Image key (`imageKey`) - Use replace-image endpoint
- Timestamps (`createdAt`) - Auto-managed

Update timestamps:
- `updatedAt` - Always set to current time on any update

Request schema:
```json
{
  "title": "Updated Title",
  "description": "New description",
  "materials": "Oil on canvas",
  "dimensions": "500x600mm",
  "createdDate": "2023-06",
  "category": "painting",
  "tags": ["art", "modern"]
}
```

Response: Updated artwork object with all fields and generated image URLs

---

## Prerequisites

**Must complete before starting:**
- **43-API-ARTWORK-GET.md** - GET endpoint with authorization logic
- **41-API-ARTWORK-CREATE.md** - Artwork schema and basic operations

---

## Steps

### Step 1: Add PATCH Endpoint to Artworks Router

Add the PATCH handler to the existing artworks router. The router uses dynamic SET clause building (only updating provided fields) and generates image URLs at response time.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/artworks.ts` (Update existing file)

Add this handler to the router:

```typescript
/**
 * PATCH /:id
 * Update artwork metadata
 *
 * Allowed fields:
 * - title
 * - description
 * - materials
 * - dimensions
 * - createdDate
 * - category
 * - tags
 *
 * Protected fields (cannot be updated):
 * - id, userId, imageKey, status, timestamps
 *
 * Response codes:
 * - 200: Artwork updated successfully
 * - 400: Invalid request or validation error
 * - 401: Not authenticated
 * - 403: Not authorized (don't own artwork)
 * - 404: Artwork not found
 * - 500: Server error
 */
artworks.patch('/:id', requireAuth, async (c) => {
  try {
    const authUser = getCurrentUser(c)
    if (!authUser) {
      throw Errors.unauthorized()
    }

    const artworkId = c.req.param('id')
    if (!artworkId) {
      throw Errors.badRequest('Missing artwork ID')
    }

    let body: unknown
    try {
      body = await c.req.json()
    } catch {
      throw Errors.badRequest('Invalid JSON body')
    }

    const db = c.env.DB
    const data = body as Record<string, unknown>

    // Check for protected fields
    const protectedFields = [
      'id',
      'userId',
      'user_id',
      'imageKey',
      'image_key',
      'status',
      'isFeatured',
      'is_featured',
      'createdAt',
      'created_at',
      'updatedAt',
      'updated_at',
      'slug', // Slug is regenerated from title, not directly editable
    ]

    const providedFields = Object.keys(data)
    const protectedFieldsProvided = providedFields.filter(f => protectedFields.includes(f))

    if (protectedFieldsProvided.length > 0) {
      throw Errors.badRequest(`Cannot update protected fields: ${protectedFieldsProvided.join(', ')}`)
    }

    // Fetch current artwork to verify ownership
    const artwork = await db
      .prepare('SELECT * FROM artworks WHERE id = ? AND user_id = ?')
      .bind(artworkId, authUser.userId)
      .first<any>()

    if (!artwork) {
      throw Errors.notFound('Artwork')
    }

    // Validate input
    validateArtworkUpdate(data)

    // Build dynamic SET clause - only update provided fields
    const setClauses: string[] = ['updated_at = CURRENT_TIMESTAMP']
    const bindings: unknown[] = []

    // Handle title change - regenerate slug
    if (data.title !== undefined && data.title !== artwork.title) {
      const newSlug = await generateUniqueSlug(db, data.title as string, authUser.userId, artworkId)
      setClauses.push('slug = ?')
      bindings.push(newSlug)
    }

    // Add other updatable fields
    if (data.description !== undefined) {
      setClauses.push('description = ?')
      bindings.push(data.description)
    }

    if (data.materials !== undefined) {
      setClauses.push('materials = ?')
      bindings.push(data.materials)
    }

    if (data.dimensions !== undefined) {
      setClauses.push('dimensions = ?')
      bindings.push(data.dimensions)
    }

    if (data.createdDate !== undefined) {
      setClauses.push('created_date = ?')
      bindings.push(data.createdDate)
    }

    if (data.category !== undefined) {
      setClauses.push('category = ?')
      bindings.push(data.category)
    }

    if (data.tags !== undefined) {
      const tagsJson = Array.isArray(data.tags) && data.tags.length > 0 ? JSON.stringify(data.tags) : null
      setClauses.push('tags = ?')
      bindings.push(tagsJson)
    }

    // If only updated_at was set, no actual changes - just return current artwork
    if (setClauses.length === 1) {
      const formatted = formatArtwork(artwork)
      return c.json(formatted, 200)
    }

    // Execute update
    bindings.push(artworkId, authUser.userId)
    const query = `UPDATE artworks SET ${setClauses.join(', ')} WHERE id = ? AND user_id = ?`

    await db.prepare(query).bind(...bindings).run()

    // Fetch and return updated artwork
    const updated = await db
      .prepare('SELECT * FROM artworks WHERE id = ? AND user_id = ?')
      .bind(artworkId, authUser.userId)
      .first<any>()

    if (!updated) {
      throw Errors.internal('Failed to retrieve updated artwork')
    }

    const formatted = formatArtwork(updated)
    return c.json(formatted, 200)
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('not found') || error.message.includes('Artwork')) {
        throw Errors.notFound('Artwork')
      }
      if (error.message.includes('not owned') || error.message.includes('don\'t own')) {
        throw Errors.forbidden()
      }
      // Validation errors
      if (
        error.message.includes('must be') ||
        error.message.includes('cannot be') ||
        error.message.includes('must have') ||
        error.message.includes('format')
      ) {
        throw Errors.badRequest(error.message)
      }
    }
    throw error
  }
})

/**
 * Generate unique slug for title within user's artworks
 */
async function generateUniqueSlug(
  db: D1Database,
  title: string,
  userId: string,
  excludeArtworkId?: string
): Promise<string> {
  const baseSlug = generateSlug(title)
  let slug = baseSlug
  let counter = 1

  while (true) {
    const query = excludeArtworkId
      ? 'SELECT id FROM artworks WHERE user_id = ? AND slug = ? AND id != ? LIMIT 1'
      : 'SELECT id FROM artworks WHERE user_id = ? AND slug = ? LIMIT 1'

    const params = excludeArtworkId ? [userId, slug, excludeArtworkId] : [userId, slug]

    const existing = await db.prepare(query).bind(...params).first()

    if (!existing) {
      return slug
    }

    slug = `${baseSlug}-${counter}`
    counter++

    if (counter > 1000) {
      throw new Error('Unable to generate unique slug')
    }
  }
}

/**
 * Format artwork database record with generated image URLs
 */
function formatArtwork(artwork: any): any {
  const imageKey = artwork.image_key
  return {
    id: artwork.id,
    userId: artwork.user_id,
    slug: artwork.slug,
    title: artwork.title,
    description: artwork.description,
    materials: artwork.materials,
    dimensions: artwork.dimensions,
    createdDate: artwork.created_date,
    category: artwork.category,
    tags: artwork.tags ? JSON.parse(artwork.tags) : [],
    imageKey,
    thumbnailUrl: getThumbnailUrl(imageKey),
    iconUrl: getIconUrl(imageKey),
    displayUrl: getDisplayUrl(imageKey),
    status: artwork.status,
    isFeatured: artwork.is_featured,
    createdAt: artwork.created_at,
    updatedAt: artwork.updated_at,
  }
}
```

### Step 2: Add Artwork Update Validation

Add validation function for artwork updates.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/validation/artworks.ts` (Update existing file)

Add this validation function:

```typescript
/**
 * Validate artwork update input
 */
export function validateArtworkUpdate(data: Record<string, unknown>): void {
  // Title validation
  if (data.title !== undefined) {
    if (typeof data.title !== 'string') {
      throw new Error('Title must be a string')
    }
    if (data.title.trim().length === 0) {
      throw new Error('Title cannot be empty')
    }
    if (data.title.length > 500) {
      throw new Error('Title must be 500 characters or less')
    }
  }

  // Description validation
  if (data.description !== undefined) {
    if (data.description !== null && typeof data.description !== 'string') {
      throw new Error('Description must be a string or null')
    }
    if (data.description && typeof data.description === 'string' && data.description.length > 5000) {
      throw new Error('Description must be 5000 characters or less')
    }
  }

  // Materials validation
  if (data.materials !== undefined) {
    if (data.materials !== null && typeof data.materials !== 'string') {
      throw new Error('Materials must be a string or null')
    }
    if (data.materials && typeof data.materials === 'string' && data.materials.length > 500) {
      throw new Error('Materials must be 500 characters or less')
    }
  }

  // Dimensions validation
  if (data.dimensions !== undefined) {
    if (data.dimensions !== null && typeof data.dimensions !== 'string') {
      throw new Error('Dimensions must be a string or null')
    }
    if (data.dimensions && typeof data.dimensions === 'string' && data.dimensions.length > 200) {
      throw new Error('Dimensions must be 200 characters or less')
    }
  }

  // Created date validation
  if (data.createdDate !== undefined) {
    if (data.createdDate !== null && typeof data.createdDate !== 'string') {
      throw new Error('createdDate must be a string or null')
    }
    // Validate date format if provided (YYYY-MM or YYYY-MM-DD)
    if (data.createdDate && typeof data.createdDate === 'string') {
      if (!isValidDateString(data.createdDate)) {
        throw new Error('createdDate must be in format YYYY-MM or YYYY-MM-DD')
      }
    }
  }

  // Category validation
  if (data.category !== undefined) {
    const validCategories = ['manga', 'comic', 'illustration', 'concept-art', 'fan-art', 'other']
    if (!validCategories.includes(data.category as string)) {
      throw new Error(`Category must be one of: ${validCategories.join(', ')}`)
    }
  }

  // Tags validation
  if (data.tags !== undefined) {
    if (!Array.isArray(data.tags)) {
      throw new Error('Tags must be an array')
    }
    if (data.tags.length > 20) {
      throw new Error('Maximum 20 tags allowed')
    }
    for (const tag of data.tags) {
      if (typeof tag !== 'string' || tag.trim().length === 0) {
        throw new Error('Each tag must be a non-empty string')
      }
      if (tag.length > 50) {
        throw new Error('Each tag must be 50 characters or less')
      }
    }
  }
}

/**
 * Validate date string format
 */
function isValidDateString(dateStr: string): boolean {
  // Allow YYYY-MM or YYYY-MM-DD format
  const pattern = /^\d{4}-\d{2}(-\d{2})?$/
  return pattern.test(dateStr)
}
```

---

## Files to Create/Modify

| Path | Type | Purpose |
|------|------|---------|
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/artworks.ts` | Modify | Add PATCH /:id handler |
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/validation/artworks.ts` | Modify | Add validateArtworkUpdate function |

---

## Verification

### Test 1: Update Title (Triggers Slug Regeneration)
```bash
curl -X PATCH http://localhost:8787/api/artworks/art_abc123 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <owner-token>" \
  -d '{
    "title": "New Title For Artwork"
  }'

# Expected: 200 OK
# {
#   "id": "art_abc123",
#   "slug": "new-title-for-artwork",
#   "title": "New Title For Artwork",
#   "updatedAt": "2024-01-15T11:00:00Z",
#   ...
# }
```

### Test 2: Update Multiple Fields
```bash
curl -X PATCH http://localhost:8787/api/artworks/art_abc123 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <owner-token>" \
  -d '{
    "description": "Updated description",
    "materials": "Oil on canvas",
    "dimensions": "100x150cm",
    "category": "illustration"
  }'

# Expected: 200 OK with all fields updated
```

### Test 3: Update Tags
```bash
curl -X PATCH http://localhost:8787/api/artworks/art_abc123 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <owner-token>" \
  -d '{
    "tags": ["landscape", "nature", "mountains"]
  }'

# Expected: 200 OK with updated tags array
```

### Test 4: Slug Collision Handling
```bash
# Create artwork with title "Dragon Art"
# Create second artwork with title "Dragon Art" - gets slug "dragon-art-1"
# Update first artwork title to "Dragon Art Updated"
# Then update back to "Dragon Art" - should reclaim "dragon-art"

curl -X PATCH http://localhost:8787/api/artworks/art_first \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <owner-token>" \
  -d '{
    "title": "Dragon Art"
  }'

# Expected: 200 OK with slug "dragon-art"
```

### Test 5: Invalid Category
```bash
curl -X PATCH http://localhost:8787/api/artworks/art_abc123 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <owner-token>" \
  -d '{
    "category": "invalid-category"
  }'

# Expected: 400 Bad Request with error about valid categories
```

### Test 6: Protected Field Attempt
```bash
curl -X PATCH http://localhost:8787/api/artworks/art_abc123 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <owner-token>" \
  -d '{
    "title": "New Title",
    "status": "draft"
  }'

# Expected: 400 Bad Request
# "Cannot update protected fields: status"
```

### Test 7: Non-Owner Attempt
```bash
curl -X PATCH http://localhost:8787/api/artworks/art_abc123 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <other-user-token>" \
  -d '{
    "title": "Hacked Title"
  }'

# Expected: 403 Forbidden
```

### Test 8: Unauthenticated Request
```bash
curl -X PATCH http://localhost:8787/api/artworks/art_abc123 \
  -H "Content-Type: application/json" \
  -d '{
    "title": "New Title"
  }'

# Expected: 401 Unauthorized
```

### Test 9: Title Length Validation
```bash
curl -X PATCH http://localhost:8787/api/artworks/art_abc123 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <owner-token>" \
  -d '{
    "title": "'$(printf 'a%.0s' {1..501})'"
  }'

# Expected: 400 Bad Request
# "Title must be 500 characters or less"
```

### Test 10: Empty Title
```bash
curl -X PATCH http://localhost:8787/api/artworks/art_abc123 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <owner-token>" \
  -d '{
    "title": ""
  }'

# Expected: 400 Bad Request
# "Title cannot be empty"
```

### Test 11: Date Format Validation
```bash
# Valid format
curl -X PATCH http://localhost:8787/api/artworks/art_abc123 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <owner-token>" \
  -d '{
    "createdDate": "2023-06-15"
  }'

# Expected: 200 OK

# Invalid format
curl -X PATCH http://localhost:8787/api/artworks/art_abc123 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <owner-token>" \
  -d '{
    "createdDate": "06/15/2023"
  }'

# Expected: 400 Bad Request
```

### Test 12: Empty Update
```bash
curl -X PATCH http://localhost:8787/api/artworks/art_abc123 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <owner-token>" \
  -d '{}'

# Expected: 200 OK with current artwork (updatedAt refreshed)
```

### Test 13: Image URLs are Generated
```bash
curl -X PATCH http://localhost:8787/api/artworks/art_abc123 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <owner-token>" \
  -d '{
    "title": "Updated Title"
  }'

# Expected: 200 OK with response containing:
# {
#   "imageKey": "originals/user123/abc-def-ghi.jpg",
#   "thumbnailUrl": "https://images.vfa.gallery/...",
#   "iconUrl": "https://images.vfa.gallery/...",
#   "displayUrl": "https://images.vfa.gallery/...",
#   ...
# }
```

---

## Notes

- **Slug Regeneration**: Slugs are automatically regenerated when title changes, excluding the current artwork from uniqueness check
- **Timestamp Always Updated**: `updatedAt` is always refreshed via `CURRENT_TIMESTAMP`, even if only no-op updates
- **No Status Changes**: Use DELETE endpoint for deletion (sets status to 'deleted')
- **Image URL Protection**: Image keys cannot be updated directly; use replace-image endpoint instead
- **Partial Updates**: PATCH allows partial updates - only provided fields are updated
- **Dynamic SQL**: Uses dynamic SET clause building pattern (see `src/lib/db/users.ts` for reference)
- **Category Enum**: Hard-coded categories from spec: manga, comic, illustration, concept-art, fan-art, other
- **Tags Array**: Stored as JSON in database, validated as array in API
- **Image URLs Generated**: URLs are generated at response time from image_key using utility functions
- **Database Indexes**: Ensure (user_id, slug) is indexed for slug uniqueness checks
- **Error Handling**: Uses `Errors` factory for consistent HTTP responses
- **Auth**: Uses `requireAuth` middleware and `getCurrentUser(c)` to get current user
- **Type Safety**: Uses `HonoEnv` type for proper typing of Hono context
