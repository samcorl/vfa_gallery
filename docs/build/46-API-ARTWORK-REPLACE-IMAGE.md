# 46-API-ARTWORK-REPLACE-IMAGE.md

## Goal
Implement the POST `/api/artworks/:id/replace-image` endpoint that allows artwork owners to replace the original image with a new one, update the image_key in the database, and optionally delete the old image from R2. Since we use Cloudflare Image Transformations for on-the-fly rendering, only the single image_key is stored in the DB; generated URLs are built dynamically.

---

## Spec Extract

From TECHNICAL-SPEC.md:
- **Image Storage**: R2 bucket stores only the original image via `image_key` (path to file in R2)
- **Image Transformations**: Cloudflare Image Transformations handles all variants (display, thumbnail, icon) dynamically
- **Image Replacement**: Update `image_key` and `updated_at` only; no separate variant files
- **Protection**: Only owners can replace images
- **Cleanup**: Optionally delete old image from R2 (single file, not multiple variants)

Request schema:
```json
{
  "imageKey": "originals/{userId}/{uuid}.jpg"
}
```

Response: Updated artwork object with newly generated image URLs.

---

## Prerequisites

**Must complete before starting:**
- **43-API-ARTWORK-GET.md** - GET endpoint and authorization patterns
- **36-WORKER-IMAGE-UPLOAD-URL.md** - R2 upload URL generation
- **Core Setup** - Hono router, D1 database, R2 binding, auth middleware

---

## Steps

### Step 1: Add Replace Image Endpoint to Artworks Router

Add the POST handler to the existing artworks router.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/artworks.ts` (Update existing file)

Append this handler:

```typescript
import { HonoEnv } from '../../../types/env'
import { Errors } from '../errors'
import { requireAuth, getCurrentUser } from '../middleware/auth'
import { Context } from 'hono'

/**
 * POST /api/artworks/:id/replace-image
 * Replace artwork's original image with a new one
 *
 * Request body:
 * {
 *   "imageKey": "originals/{userId}/{uuid}.jpg"
 * }
 *
 * Behavior:
 * 1. Verify authenticated user owns the artwork
 * 2. Validate new image exists in R2 via HEAD request
 * 3. Extract userId from imageKey path and validate it matches authenticated user
 * 4. Update image_key and updated_at in database
 * 5. Optionally delete old image from R2 (if oldImageKey provided)
 * 6. Return updated artwork with newly generated URLs
 *
 * Response:
 * {
 *   "id": "...",
 *   "image_key": "originals/{userId}/{uuid}.jpg",
 *   "thumbnail_url": "https://cdn.vfa.gallery/...",
 *   "icon_url": "https://cdn.vfa.gallery/...",
 *   "display_url": "https://cdn.vfa.gallery/...",
 *   ...
 * }
 *
 * Status codes:
 * - 200: Image replaced successfully
 * - 400: Invalid request, validation error, or new image doesn't exist
 * - 401: Not authenticated
 * - 403: Not authorized (don't own artwork)
 * - 404: Artwork not found
 * - 500: Server error
 */
export async function replaceImage(c: Context<HonoEnv>) {
  try {
    const user = await requireAuth(c)
    if (!user) {
      return c.json(Errors.unauthorized(), { status: 401 })
    }

    const artworkId = c.req.param('id')
    if (!artworkId) {
      return c.json(Errors.validation('Missing artwork ID in path'), { status: 400 })
    }

    // Parse request body
    let body: { imageKey?: string; oldImageKey?: string }
    try {
      body = await c.req.json()
    } catch {
      return c.json(Errors.validation('Invalid JSON body'), { status: 400 })
    }

    const { imageKey, oldImageKey } = body

    if (!imageKey || typeof imageKey !== 'string') {
      return c.json(Errors.validation('imageKey (string) is required'), { status: 400 })
    }

    // Validate image key format: originals/{userId}/{uuid}.{ext}
    const keyPattern = /^originals\/([a-zA-Z0-9_-]+)\/[a-f0-9-]{36}\.[a-z]+$/i
    const match = imageKey.match(keyPattern)
    if (!match) {
      return c.json(
        Errors.validation('Invalid imageKey format. Expected: originals/{userId}/{uuid}.extension'),
        { status: 400 }
      )
    }

    const userIdFromKey = match[1]

    // Verify userId in key matches authenticated user
    if (userIdFromKey !== user.id) {
      return c.json(
        Errors.validation('imageKey must belong to the authenticated user'),
        { status: 400 }
      )
    }

    // Get R2 bucket
    const bucket = c.env.IMAGE_BUCKET
    if (!bucket) {
      console.error('IMAGE_BUCKET binding not configured')
      return c.json(Errors.server('Image storage not available'), { status: 500 })
    }

    // Verify new image exists in R2
    try {
      const headResponse = await bucket.head(imageKey)
      if (!headResponse) {
        return c.json(
          Errors.validation('Specified image does not exist in R2'),
          { status: 400 }
        )
      }
    } catch (error) {
      console.error('Error checking image existence:', error)
      return c.json(
        Errors.validation('Specified image does not exist in R2'),
        { status: 400 }
      )
    }

    // Get artwork from database
    const db = c.env.DB
    const artwork = await db
      .prepare('SELECT id, user_id, image_key FROM artworks WHERE id = ?')
      .bind(artworkId)
      .first()

    if (!artwork) {
      return c.json(Errors.notFound('Artwork not found'), { status: 404 })
    }

    // Verify user owns this artwork
    if (artwork.user_id !== user.id) {
      return c.json(Errors.forbidden('Not authorized to update this artwork'), { status: 403 })
    }

    // Store old image key for potential cleanup
    const oldImage = artwork.image_key

    // Update artwork with new image_key and updated_at
    const now = new Date().toISOString()
    await db
      .prepare('UPDATE artworks SET image_key = ?, updated_at = ? WHERE id = ?')
      .bind(imageKey, now, artworkId)
      .run()

    // Optionally delete old image from R2
    // Only attempt if oldImageKey is provided or we have the stored old image
    if (oldImageKey || oldImage) {
      const keyToDelete = oldImageKey || oldImage
      try {
        await bucket.delete(keyToDelete)
        console.log(`Deleted old image from R2: ${keyToDelete}`)
      } catch (error) {
        console.warn(`Failed to delete old image ${keyToDelete}:`, error)
        // Don't fail the operation if cleanup fails
      }
    }

    // Fetch updated artwork for response
    const updated = await db
      .prepare('SELECT * FROM artworks WHERE id = ?')
      .bind(artworkId)
      .first()

    if (!updated) {
      return c.json(Errors.notFound('Artwork not found after update'), { status: 404 })
    }

    // Build response with generated image URLs
    const response = formatArtworkResponse(updated)

    return c.json(response, { status: 200 })
  } catch (error) {
    console.error('Error in POST /api/artworks/:id/replace-image:', error)
    return c.json(Errors.server('Failed to replace image'), { status: 500 })
  }
}

/**
 * Format artwork for API response with generated image URLs
 */
function formatArtworkResponse(artwork: any) {
  const imageKey = artwork.image_key
  const baseUrl = 'https://cdn.vfa.gallery'

  // Generate URLs using Cloudflare Image Transformations
  // Format: {baseUrl}/cdn-cgi/image/{options}/{imageKey}
  const displayUrl = `${baseUrl}/cdn-cgi/image/quality=90,width=1200/` + imageKey
  const thumbnailUrl = `${baseUrl}/cdn-cgi/image/quality=80,width=300,height=300,fit=cover/` + imageKey
  const iconUrl = `${baseUrl}/cdn-cgi/image/quality=80,width=100,height=100,fit=cover/` + imageKey

  return {
    id: artwork.id,
    user_id: artwork.user_id,
    slug: artwork.slug,
    title: artwork.title,
    description: artwork.description || null,
    materials: artwork.materials || null,
    dimensions: artwork.dimensions || null,
    created_date: artwork.created_date || null,
    category: artwork.category || null,
    tags: artwork.tags ? JSON.parse(artwork.tags) : [],
    image_key: imageKey,
    display_url: displayUrl,
    thumbnail_url: thumbnailUrl,
    icon_url: iconUrl,
    status: artwork.status,
    is_featured: artwork.is_featured || false,
    created_at: artwork.created_at,
    updated_at: artwork.updated_at
  }
}
```

### Step 2: Register Route Handler in Hono Router

Add the route to the artworks router.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/artworks.ts` (Update existing file)

Add this line to the router setup (adjust based on existing router pattern):

```typescript
// In the artworks router configuration:
router.post('/:id/replace-image', replaceImage)
```

---

## Files to Create/Modify

| Path | Type | Purpose |
|------|------|---------|
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/artworks.ts` | Modify | Add `replaceImage` handler and route registration |

---

## Verification

### Test 1: Replace Image Successfully
```bash
# Step 1: Get presigned URL for new image upload
curl -X POST http://localhost:5173/api/artworks/upload-url \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "filename": "new-artwork.jpg",
    "contentType": "image/jpeg"
  }'

# Response: { "uploadUrl": "...", "imageKey": "originals/{userId}/{uuid}.jpg" }

# Step 2: Upload new image to R2 via presigned URL
curl -X PUT "<uploadUrl>" \
  -H "Content-Type: image/jpeg" \
  --data-binary @new-artwork.jpg

# Step 3: Replace image in artwork
curl -X POST http://localhost:5173/api/artworks/art_abc123/replace-image \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "imageKey": "originals/{userId}/{newUuid}.jpg"
  }'

# Expected: 200 OK
# {
#   "id": "art_abc123",
#   "image_key": "originals/{userId}/{newUuid}.jpg",
#   "display_url": "https://cdn.vfa.gallery/cdn-cgi/image/quality=90,width=1200/originals/{userId}/{newUuid}.jpg",
#   "thumbnail_url": "https://cdn.vfa.gallery/cdn-cgi/image/quality=80,width=300,height=300,fit=cover/originals/{userId}/{newUuid}.jpg",
#   "icon_url": "https://cdn.vfa.gallery/cdn-cgi/image/quality=80,width=100,height=100,fit=cover/originals/{userId}/{newUuid}.jpg",
#   "updated_at": "2026-02-14T10:30:00Z",
#   ...
# }
```

### Test 2: Replace Image with Old Image Cleanup
```bash
curl -X POST http://localhost:5173/api/artworks/art_abc123/replace-image \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "imageKey": "originals/{userId}/{newUuid}.jpg",
    "oldImageKey": "originals/{userId}/{oldUuid}.jpg"
  }'

# Expected: 200 OK
# Verify in R2: old image should be deleted, new image remains
```

### Test 3: Image Does Not Exist in R2
```bash
curl -X POST http://localhost:5173/api/artworks/art_abc123/replace-image \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "imageKey": "originals/{userId}/nonexistent-uuid.jpg"
  }'

# Expected: 400 Bad Request
# "Specified image does not exist in R2"
```

### Test 4: Invalid Image Key Format
```bash
curl -X POST http://localhost:5173/api/artworks/art_abc123/replace-image \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "imageKey": "display/{userId}/uuid.jpg"
  }'

# Expected: 400 Bad Request
# "Invalid imageKey format. Expected: originals/{userId}/{uuid}.extension"
```

### Test 5: Non-Owner Cannot Replace
```bash
curl -X POST http://localhost:5173/api/artworks/art_abc123/replace-image \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <other-user-token>" \
  -d '{
    "imageKey": "originals/{otherUserId}/{uuid}.jpg"
  }'

# Expected: 403 Forbidden
# "Not authorized to update this artwork"
```

### Test 6: Metadata Unchanged
```bash
# Get artwork before replacement
curl -X GET http://localhost:5173/api/artworks/art_abc123 \
  -H "Authorization: Bearer <token>"

# Save: title, description, tags, category, created_at

# Replace image
curl -X POST http://localhost:5173/api/artworks/art_abc123/replace-image \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "imageKey": "originals/{userId}/{newUuid}.jpg"
  }'

# Get artwork after
curl -X GET http://localhost:5173/api/artworks/art_abc123 \
  -H "Authorization: Bearer <token>"

# Verify: title, description, tags, category unchanged
# Verify: created_at unchanged
# Verify: updated_at is newer
# Verify: image_key changed, all generated URLs reflect new key
```

### Test 7: Updated_at Timestamp Refreshed
```bash
# Before:
# "updated_at": "2026-02-10T08:00:00Z"

# After replace-image:
# "updated_at": "2026-02-14T10:30:00Z" (current time)

# created_at should remain unchanged
```

### Test 8: Generated URLs Correct
```bash
# Response image_key: "originals/{userId}/abc-123-def.jpg"
# Generated URLs should use Cloudflare Image Transformations:
# - display_url: https://cdn.vfa.gallery/cdn-cgi/image/quality=90,width=1200/originals/{userId}/abc-123-def.jpg
# - thumbnail_url: https://cdn.vfa.gallery/cdn-cgi/image/quality=80,width=300,height=300,fit=cover/originals/{userId}/abc-123-def.jpg
# - icon_url: https://cdn.vfa.gallery/cdn-cgi/image/quality=80,width=100,height=100,fit=cover/originals/{userId}/abc-123-def.jpg

# Test in browser: All URLs should render correctly
```

---

## Notes

- **No Variants**: Unlike previous implementations, we store only `image_key` in the database. Cloudflare Image Transformations generates all variants on-the-fly via query parameters.
- **Single File Deletion**: When replacing an image, only one file (the original) is deleted from R2. There are no separate variant files to manage.
- **URL Generation**: All image URLs are built dynamically in the endpoint response using the `image_key` and transformation parameters.
- **Key Validation**: The imageKey must follow the pattern `originals/{userId}/{uuid}.extension` and userId must match the authenticated user.
- **Atomic Database Update**: Database update is fast and atomic. R2 deletion is best-effort; failures don't block the main operation.
- **Optional Cleanup**: The `oldImageKey` parameter is optional. If not provided, the old image remains in R2. Callers can choose to manage cleanup separately.
- **Metadata Preservation**: Only `image_key` and `updated_at` are modified. All other fields (title, tags, category, etc.) remain unchanged.
- **Timestamps**: `updated_at` is refreshed to the current ISO timestamp. `created_at` is never modified.
- **Error Recovery**: If the new image doesn't exist in R2, the database is not modified and the old image_key remains active.
- **CDN Cache Invalidation**: When image URLs change, CDN caches may need invalidation depending on cache headers. Consider adding cache control headers to the response or configuring Cloudflare rules.
- **Auth via Middleware**: Uses the standard `requireAuth` middleware to get the authenticated user. The endpoint confirms the user owns the artwork before allowing replacement.
