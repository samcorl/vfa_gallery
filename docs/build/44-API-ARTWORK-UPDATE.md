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
- Image URLs (`originalUrl`, `displayUrl`, `thumbnailUrl`, `iconUrl`) - Use replace-image endpoint
- Timestamps (`createdAt`) - Auto-managed

Update timestamps:
- `updatedAt` - Always set to current time on any update
- `updatedBy` - Optional, can track which user made the change

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

Response: Updated artwork object with all fields

---

## Prerequisites

**Must complete before starting:**
- **43-API-ARTWORK-GET.md** - GET endpoint with authorization logic
- **41-API-ARTWORK-CREATE.md** - Artwork schema and basic operations

---

## Steps

### Step 1: Create Artwork Update Service

Build service module for update operations with validation and slug regeneration.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/services/artworkUpdate.ts`

```typescript
import type { D1Database } from '@cloudflare/workers-types'

/**
 * Update request payload
 */
export interface ArtworkUpdateInput {
  title?: string
  description?: string
  materials?: string
  dimensions?: string
  createdDate?: string
  category?: string
  tags?: string[]
}

/**
 * Artwork update service
 */
export class ArtworkUpdateService {
  private db: D1Database

  constructor(db: D1Database) {
    this.db = db
  }

  /**
   * Update artwork metadata
   *
   * @param artworkId - The artwork ID to update
   * @param userId - The user ID (must own the artwork)
   * @param updates - Fields to update
   * @returns Updated artwork object
   * @throws Error if artwork not found, not owned, or validation fails
   */
  async updateArtwork(
    artworkId: string,
    userId: string,
    updates: ArtworkUpdateInput
  ): Promise<any> {
    try {
      // Fetch current artwork to verify ownership
      const artwork = await this.db
        .prepare('SELECT * FROM artworks WHERE id = ? AND user_id = ?')
        .bind(artworkId, userId)
        .first()

      if (!artwork) {
        throw new Error('Artwork not found or not owned by user')
      }

      // Validate input
      this.validateInput(updates)

      // Prepare update object
      const updateData: any = {}
      const updateFields: string[] = []

      // Handle title change - regenerate slug
      if (updates.title !== undefined && updates.title !== artwork.title) {
        const newSlug = await this.generateUniqueSlug(updates.title, userId, artworkId)
        updateData.slug = newSlug
        updateFields.push('slug')
      }

      // Add other updatable fields
      if (updates.description !== undefined) {
        updateData.description = updates.description
        updateFields.push('description')
      }

      if (updates.materials !== undefined) {
        updateData.materials = updates.materials
        updateFields.push('materials')
      }

      if (updates.dimensions !== undefined) {
        updateData.dimensions = updates.dimensions
        updateFields.push('dimensions')
      }

      if (updates.createdDate !== undefined) {
        updateData.created_date = updates.createdDate
        updateFields.push('created_date')
      }

      if (updates.category !== undefined) {
        updateData.category = updates.category
        updateFields.push('category')
      }

      if (updates.tags !== undefined) {
        updateData.tags = updates.tags.length > 0 ? JSON.stringify(updates.tags) : null
        updateFields.push('tags')
      }

      // Always update timestamp
      updateData.updated_at = new Date().toISOString()
      updateFields.push('updated_at')

      if (updateFields.length === 1) {
        // Only updated_at changed, return current artwork
        return this.formatArtwork(artwork)
      }

      // Build UPDATE query
      const setClause = updateFields.map(f => `${f} = ?`).join(', ')
      const values = updateFields.map(f => updateData[f])
      values.push(artworkId, userId)

      const query = `
        UPDATE artworks
        SET ${setClause}
        WHERE id = ? AND user_id = ?
      `

      await this.db.prepare(query).bind(...values).run()

      // Fetch and return updated artwork
      const updated = await this.db
        .prepare('SELECT * FROM artworks WHERE id = ? AND user_id = ?')
        .bind(artworkId, userId)
        .first()

      return this.formatArtwork(updated)
    } catch (error) {
      console.error('Error updating artwork:', error)
      throw error
    }
  }

  /**
   * Validate update input
   */
  private validateInput(updates: ArtworkUpdateInput): void {
    // Title validation
    if (updates.title !== undefined) {
      if (typeof updates.title !== 'string') {
        throw new Error('Title must be a string')
      }
      if (updates.title.trim().length === 0) {
        throw new Error('Title cannot be empty')
      }
      if (updates.title.length > 500) {
        throw new Error('Title must be 500 characters or less')
      }
    }

    // Description validation
    if (updates.description !== undefined) {
      if (updates.description !== null && typeof updates.description !== 'string') {
        throw new Error('Description must be a string or null')
      }
      if (updates.description && updates.description.length > 5000) {
        throw new Error('Description must be 5000 characters or less')
      }
    }

    // Materials validation
    if (updates.materials !== undefined) {
      if (updates.materials !== null && typeof updates.materials !== 'string') {
        throw new Error('Materials must be a string or null')
      }
      if (updates.materials && updates.materials.length > 500) {
        throw new Error('Materials must be 500 characters or less')
      }
    }

    // Dimensions validation
    if (updates.dimensions !== undefined) {
      if (updates.dimensions !== null && typeof updates.dimensions !== 'string') {
        throw new Error('Dimensions must be a string or null')
      }
      if (updates.dimensions && updates.dimensions.length > 200) {
        throw new Error('Dimensions must be 200 characters or less')
      }
    }

    // Created date validation
    if (updates.createdDate !== undefined) {
      if (updates.createdDate !== null && typeof updates.createdDate !== 'string') {
        throw new Error('createdDate must be a string or null')
      }
      // Validate date format if provided (YYYY-MM or YYYY-MM-DD)
      if (updates.createdDate && !this.isValidDateString(updates.createdDate)) {
        throw new Error('createdDate must be in format YYYY-MM or YYYY-MM-DD')
      }
    }

    // Category validation
    if (updates.category !== undefined) {
      const validCategories = ['manga', 'comic', 'illustration', 'concept-art', 'fan-art', 'other']
      if (!validCategories.includes(updates.category)) {
        throw new Error(`Category must be one of: ${validCategories.join(', ')}`)
      }
    }

    // Tags validation
    if (updates.tags !== undefined) {
      if (!Array.isArray(updates.tags)) {
        throw new Error('Tags must be an array')
      }
      if (updates.tags.length > 20) {
        throw new Error('Maximum 20 tags allowed')
      }
      for (const tag of updates.tags) {
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
   * Generate unique slug for title within user's artworks
   */
  private async generateUniqueSlug(
    title: string,
    userId: string,
    excludeArtworkId?: string
  ): Promise<string> {
    const baseSlug = this.generateSlug(title)
    let slug = baseSlug
    let counter = 1

    while (true) {
      const query = excludeArtworkId
        ? 'SELECT id FROM artworks WHERE user_id = ? AND slug = ? AND id != ? LIMIT 1'
        : 'SELECT id FROM artworks WHERE user_id = ? AND slug = ? LIMIT 1'

      const params = excludeArtworkId ? [userId, slug, excludeArtworkId] : [userId, slug]

      const existing = await this.db.prepare(query).bind(...params).first()

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
   * Generate slug from title
   */
  private generateSlug(title: string): string {
    return title
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 50)
  }

  /**
   * Validate date string format
   */
  private isValidDateString(dateStr: string): boolean {
    // Allow YYYY-MM or YYYY-MM-DD format
    const pattern = /^\d{4}-\d{2}(-\d{2})?$/
    return pattern.test(dateStr)
  }

  /**
   * Format artwork database record
   */
  private formatArtwork(artwork: any): any {
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
      originalUrl: artwork.original_url,
      displayUrl: artwork.display_url,
      thumbnailUrl: artwork.thumbnail_url,
      iconUrl: artwork.icon_url,
      status: artwork.status,
      isFeatured: artwork.is_featured,
      createdAt: artwork.created_at,
      updatedAt: artwork.updated_at
    }
  }
}
```

### Step 2: Add PATCH Endpoint to Artworks Route

Create the PATCH handler for artwork updates.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/artworks.ts` (Update existing file)

Add this handler:

```typescript
import { json, type RequestHandler } from '@sveltejs/kit'
import { auth } from '$lib/server/auth'
import { db } from '$lib/server/db'
import { ArtworkUpdateService, type ArtworkUpdateInput } from '$lib/api/services/artworkUpdate'

/**
 * PATCH /api/artworks/:id
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
 * - id, userId, status, originalUrl, displayUrl, thumbnailUrl, iconUrl
 *
 * Response codes:
 * - 200: Artwork updated successfully
 * - 400: Invalid request or validation error
 * - 401: Not authenticated
 * - 403: Not authorized (don't own artwork)
 * - 404: Artwork not found
 * - 500: Server error
 */
export const PATCH: RequestHandler = async ({ url, request }) => {
  try {
    // Authenticate user
    const session = await auth.getSession(request)
    if (!session?.user?.id) {
      return json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id

    // Extract artwork ID from URL
    const pathParts = url.pathname.split('/')
    const artworkId = pathParts[pathParts.length - 1]

    if (!artworkId) {
      return json({ error: 'Missing artwork ID' }, { status: 400 })
    }

    // Parse request body
    const body = await request.json().catch(() => ({}))

    // Check for protected fields
    const protectedFields = [
      'id',
      'userId',
      'user_id',
      'status',
      'originalUrl',
      'original_url',
      'displayUrl',
      'display_url',
      'thumbnailUrl',
      'thumbnail_url',
      'iconUrl',
      'icon_url',
      'createdAt',
      'created_at',
      'isFeatured',
      'is_featured'
    ]

    const providedFields = Object.keys(body)
    const protectedFieldsProvided = providedFields.filter(f => protectedFields.includes(f))

    if (protectedFieldsProvided.length > 0) {
      return json(
        {
          error: `Cannot update protected fields: ${protectedFieldsProvided.join(', ')}`
        },
        { status: 400 }
      )
    }

    // Initialize update service
    const updateService = new ArtworkUpdateService(db)

    // Perform update
    const updated = await updateService.updateArtwork(artworkId, userId, body as ArtworkUpdateInput)

    return json({ data: updated }, { status: 200 })
  } catch (error) {
    console.error('Error in PATCH /api/artworks/:id:', error)

    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return json({ error: 'Artwork not found' }, { status: 404 })
      }
      if (error.message.includes('not owned')) {
        return json({ error: 'Not authorized to update this artwork' }, { status: 403 })
      }
      if (error.message.includes('must be')) {
        return json({ error: error.message }, { status: 400 })
      }
    }

    return json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

### Step 3: Update SvelteKit Route Handler

Wire up the PATCH handler in SvelteKit routing.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/routes/api/artworks/[id]/+server.ts` (Update)

```typescript
import { GET, PATCH } from '$lib/api/routes/artworks'

export { GET, PATCH }
```

---

## Files to Create/Modify

| Path | Type | Purpose |
|------|------|---------|
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/services/artworkUpdate.ts` | Create | Artwork update service with validation |
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/artworks.ts` | Modify | Add PATCH handler |
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/routes/api/artworks/[id]/+server.ts` | Modify | Export PATCH handler |

---

## Verification

### Test 1: Update Title (Triggers Slug Regeneration)
```bash
curl -X PATCH http://localhost:5173/api/artworks/art_abc123 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <owner-token>" \
  -d '{
    "title": "New Title For Artwork"
  }'

# Expected: 200 OK
# {
#   "data": {
#     "id": "art_abc123",
#     "slug": "new-title-for-artwork",
#     "title": "New Title For Artwork",
#     "updatedAt": "2024-01-15T11:00:00Z",
#     ...
#   }
# }
```

### Test 2: Update Multiple Fields
```bash
curl -X PATCH http://localhost:5173/api/artworks/art_abc123 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <owner-token>" \
  -d '{
    "description": "Updated description",
    "materials": "Oil on canvas",
    "dimensions": "100x150cm",
    "category": "painting"
  }'

# Expected: 200 OK with all fields updated
```

### Test 3: Update Tags
```bash
curl -X PATCH http://localhost:5173/api/artworks/art_abc123 \
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

curl -X PATCH http://localhost:5173/api/artworks/art_first \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <owner-token>" \
  -d '{
    "title": "Dragon Art"
  }'

# Expected: 200 OK with slug "dragon-art"
```

### Test 5: Invalid Category
```bash
curl -X PATCH http://localhost:5173/api/artworks/art_abc123 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <owner-token>" \
  -d '{
    "category": "invalid-category"
  }'

# Expected: 400 Bad Request with error about valid categories
```

### Test 6: Protected Field Attempt
```bash
curl -X PATCH http://localhost:5173/api/artworks/art_abc123 \
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
curl -X PATCH http://localhost:5173/api/artworks/art_abc123 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <other-user-token>" \
  -d '{
    "title": "Hacked Title"
  }'

# Expected: 403 Forbidden
# "Not authorized to update this artwork"
```

### Test 8: Unauthenticated Request
```bash
curl -X PATCH http://localhost:5173/api/artworks/art_abc123 \
  -H "Content-Type: application/json" \
  -d '{
    "title": "New Title"
  }'

# Expected: 401 Unauthorized
```

### Test 9: Title Length Validation
```bash
curl -X PATCH http://localhost:5173/api/artworks/art_abc123 \
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
curl -X PATCH http://localhost:5173/api/artworks/art_abc123 \
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
curl -X PATCH http://localhost:5173/api/artworks/art_abc123 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <owner-token>" \
  -d '{
    "createdDate": "2023-06-15"
  }'

# Expected: 200 OK

# Invalid format
curl -X PATCH http://localhost:5173/api/artworks/art_abc123 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <owner-token>" \
  -d '{
    "createdDate": "06/15/2023"
  }'

# Expected: 400 Bad Request
```

### Test 12: Empty Update
```bash
curl -X PATCH http://localhost:5173/api/artworks/art_abc123 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <owner-token>" \
  -d '{}'

# Expected: 200 OK with current artwork (updatedAt refreshed)
```

---

## Notes

- **Slug Regeneration**: Slugs are automatically regenerated when title changes, excluding the current artwork from uniqueness check
- **Timestamp Always Updated**: `updatedAt` is always refreshed, even if only empty or no-op updates
- **No Status Changes**: Use DELETE endpoint for deletion (sets status to 'deleted')
- **Image URL Protection**: Image URLs cannot be updated directly; use replace-image endpoint instead
- **Partial Updates**: PATCH allows partial updates - only provided fields are updated
- **Category Enum**: Hard-coded categories from spec: manga, comic, illustration, concept-art, fan-art, other
- **Tags Array**: Stored as JSON in database, validated as array in API
- **Database Indexes**: Ensure (user_id, slug) is indexed for slug uniqueness checks
- **Audit Trail**: Consider adding `updatedBy` field to track who made the change

