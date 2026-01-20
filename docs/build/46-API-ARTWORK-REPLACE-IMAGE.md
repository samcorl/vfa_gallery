# 46-API-ARTWORK-REPLACE-IMAGE.md

## Goal
Implement the POST `/api/artworks/:id/replace-image` endpoint that allows artwork owners to replace the original image with a new one, triggers the complete image processing pipeline for all variants, and updates all image URLs while optionally cleaning up old images from R2.

---

## Spec Extract

From TECHNICAL-SPEC.md:
- **Image Processing Pipeline**: Generates display (watermarked), thumbnail, and icon variants
- **Image Replacement**: Update original and all derived images without affecting metadata
- **Storage**: R2 bucket with organized paths (originals/, display/, thumbnails/, icons/)
- **Protection**: Only owners can replace images

Request schema:
```json
{
  "originalKey": "originals/user-id/new-uuid.jpg"
}
```

Response: Updated artwork object with new image URLs

---

## Prerequisites

**Must complete before starting:**
- **40-IMAGE-PIPELINE-ORCHESTRATION.md** - Image processing orchestration service
- **43-API-ARTWORK-GET.md** - GET endpoint and authorization patterns
- **36-WORKER-IMAGE-UPLOAD-URL.md** - R2 upload URL generation

---

## Steps

### Step 1: Create Image Replacement Service

Build service module for image replacement with pipeline orchestration.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/services/imageReplacement.ts`

```typescript
import type { D1Database } from '@cloudflare/workers-types'
import { ImageProcessorService, type ImageProcessingResult } from './imageProcessor'

/**
 * Image replacement result
 */
export interface ImageReplacementResult {
  success: boolean
  artworkId: string
  newImageUrls: ImageProcessingResult
  oldImageUrls: {
    originalUrl: string
    displayUrl: string
    thumbnailUrl: string
    iconUrl: string
  }
  timestamp: string
}

/**
 * Image replacement service
 */
export class ImageReplacementService {
  private db: D1Database
  private imageProcessor: ImageProcessorService

  constructor(db: D1Database, imageProcessor: ImageProcessorService) {
    this.db = db
    this.imageProcessor = imageProcessor
  }

  /**
   * Replace artwork image with new one
   *
   * Process:
   * 1. Verify artwork exists and is owned by user
   * 2. Validate new image key exists in R2
   * 3. Trigger image processing pipeline
   * 4. Update artwork with new URLs
   * 5. Optionally delete old images from R2
   *
   * @param artworkId - The artwork ID to update
   * @param userId - The user ID (must own the artwork)
   * @param newOriginalKey - R2 key of new original image
   * @param deleteOldImages - Whether to delete old images from R2 (default: false)
   * @returns Replacement result with old and new URLs
   * @throws Error if artwork not found, not owned, or processing fails
   */
  async replaceImage(
    artworkId: string,
    userId: string,
    newOriginalKey: string,
    deleteOldImages: boolean = false,
    username: string
  ): Promise<ImageReplacementResult> {
    try {
      // Validate input
      if (!artworkId || !userId || !newOriginalKey) {
        throw new Error('Missing required parameters')
      }

      // Fetch artwork to verify ownership and get current URLs
      const artwork = await this.db
        .prepare(
          `SELECT
             id, user_id, original_url, display_url, thumbnail_url, icon_url
           FROM artworks
           WHERE id = ? AND user_id = ?`
        )
        .bind(artworkId, userId)
        .first()

      if (!artwork) {
        throw new Error('Artwork not found or not owned by user')
      }

      // Store old URLs for response and deletion
      const oldImageUrls = {
        originalUrl: artwork.original_url,
        displayUrl: artwork.display_url,
        thumbnailUrl: artwork.thumbnail_url,
        iconUrl: artwork.icon_url
      }

      // Validate new image key format
      this.validateImageKey(newOriginalKey)

      // Trigger image processing pipeline for new image
      console.log(`Processing new image: ${newOriginalKey}`)
      const newImageUrls = await this.imageProcessor.processUploadedImage(
        newOriginalKey,
        userId,
        username
      )

      // Update artwork with new URLs
      const now = new Date().toISOString()
      await this.db
        .prepare(
          `UPDATE artworks
           SET original_url = ?,
               display_url = ?,
               thumbnail_url = ?,
               icon_url = ?,
               updated_at = ?
           WHERE id = ? AND user_id = ?`
        )
        .bind(
          newImageUrls.originalUrl,
          newImageUrls.displayUrl,
          newImageUrls.thumbnailUrl,
          newImageUrls.iconUrl,
          now,
          artworkId,
          userId
        )
        .run()

      // Optionally delete old images from R2
      if (deleteOldImages) {
        await this.deleteOldImages(oldImageUrls, userId)
      }

      return {
        success: true,
        artworkId,
        newImageUrls,
        oldImageUrls,
        timestamp: now
      }
    } catch (error) {
      console.error('Error replacing artwork image:', error)
      throw error
    }
  }

  /**
   * Validate image key format
   */
  private validateImageKey(key: string): void {
    // Should match pattern: originals/userId/uuid.ext
    const pattern = /^originals\/[a-zA-Z0-9_-]+\/[a-f0-9-]{36}\.[a-z]+$/i

    if (!pattern.test(key)) {
      throw new Error(
        'Invalid image key format. Expected: originals/userId/uuid.extension'
      )
    }
  }

  /**
   * Convert CDN URL back to R2 key
   */
  private urlToKey(url: string): string {
    // Extract path from URL
    // e.g., https://cdn.vfa.gallery/display/user-id/uuid.jpg -> display/user-id/uuid.jpg
    const match = url.match(/cdn\.vfa\.gallery\/(.+)$/)
    return match ? match[1] : url
  }

  /**
   * Delete old image variants from R2
   */
  private async deleteOldImages(
    imageUrls: {
      originalUrl: string
      displayUrl: string
      thumbnailUrl: string
      iconUrl: string
    },
    userId: string
  ): Promise<void> {
    try {
      const keysToDelete = [
        this.urlToKey(imageUrls.originalUrl),
        this.urlToKey(imageUrls.displayUrl),
        this.urlToKey(imageUrls.thumbnailUrl),
        this.urlToKey(imageUrls.iconUrl)
      ]

      console.log(`Deleting old images for user ${userId}:`, keysToDelete)

      // Call R2 deletion worker or API
      for (const key of keysToDelete) {
        await this.deleteFromR2(key)
      }
    } catch (error) {
      console.warn('Error deleting old images from R2:', error)
      // Don't fail the operation if cleanup fails
    }
  }

  /**
   * Delete a single image from R2
   */
  private async deleteFromR2(key: string): Promise<void> {
    try {
      const response = await fetch(`${process.env.WORKER_API_BASE_URL}/delete-file`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.WORKER_AUTH_TOKEN}`
        },
        body: JSON.stringify({
          key,
          timestamp: new Date().toISOString()
        })
      })

      if (!response.ok) {
        console.warn(`Failed to delete R2 key ${key}: ${response.status}`)
      }
    } catch (error) {
      console.warn(`Error deleting R2 key ${key}:`, error)
    }
  }

  /**
   * Get current image URLs for artwork
   */
  async getCurrentImageUrls(artworkId: string, userId: string): Promise<any> {
    const artwork = await this.db
      .prepare(
        `SELECT original_url, display_url, thumbnail_url, icon_url
         FROM artworks
         WHERE id = ? AND user_id = ?`
      )
      .bind(artworkId, userId)
      .first()

    if (!artwork) {
      throw new Error('Artwork not found')
    }

    return {
      originalUrl: artwork.original_url,
      displayUrl: artwork.display_url,
      thumbnailUrl: artwork.thumbnail_url,
      iconUrl: artwork.icon_url
    }
  }
}
```

### Step 2: Add Replace Image Endpoint

Create the POST handler for image replacement.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/artworks.ts` (Update existing file)

Add this handler:

```typescript
import { json, type RequestHandler } from '@sveltejs/kit'
import { auth } from '$lib/server/auth'
import { db } from '$lib/server/db'
import { ImageProcessorService } from '$lib/api/services/imageProcessor'
import { ImageReplacementService } from '$lib/api/services/imageReplacement'

/**
 * POST /api/artworks/:id/replace-image
 * Replace artwork image with a new one
 *
 * Request body:
 * {
 *   "originalKey": "originals/user-id/new-uuid.jpg",
 *   "deleteOldImages": false (optional, default: false)
 * }
 *
 * Process:
 * 1. Validate new image exists in R2
 * 2. Trigger processing pipeline for new image
 * 3. Update artwork URLs
 * 4. Optionally delete old images
 *
 * Response codes:
 * - 200: Image replaced successfully
 * - 400: Invalid request or validation error
 * - 401: Not authenticated
 * - 403: Not authorized (don't own artwork)
 * - 404: Artwork not found
 * - 500: Server error
 */
export const replaceImageHandler: RequestHandler = async ({ url, request, platform }) => {
  try {
    // Authenticate user
    const session = await auth.getSession(request)
    if (!session?.user?.id) {
      return json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id
    const username = session.user.username

    // Extract artwork ID from URL
    const pathParts = url.pathname.split('/')
    const artworkId = pathParts[pathParts.length - 2] // /api/artworks/:id/replace-image

    if (!artworkId) {
      return json({ error: 'Missing artwork ID' }, { status: 400 })
    }

    // Parse request body
    const body = await request.json().catch(() => ({}))
    const { originalKey, deleteOldImages = false } = body

    if (!originalKey) {
      return json({ error: 'Missing originalKey in request body' }, { status: 400 })
    }

    // Initialize services
    const imageProcessor = new ImageProcessorService(
      db,
      platform.env.KV,
      process.env.WORKER_API_BASE_URL || 'https://workers.example.com'
    )

    const replacementService = new ImageReplacementService(db, imageProcessor)

    // Perform replacement
    const result = await replacementService.replaceImage(
      artworkId,
      userId,
      originalKey,
      deleteOldImages === true,
      username
    )

    // Fetch updated artwork for response
    const artwork = await db
      .prepare(
        `SELECT * FROM artworks WHERE id = ? AND user_id = ?`
      )
      .bind(artworkId, userId)
      .first()

    if (!artwork) {
      return json({ error: 'Artwork not found' }, { status: 404 })
    }

    return json(
      {
        success: true,
        message: 'Image replaced successfully',
        data: formatArtworkResponse(artwork),
        replacement: {
          newImageUrls: result.newImageUrls,
          oldImageUrls: result.oldImageUrls,
          oldImagesDeleted: deleteOldImages,
          timestamp: result.timestamp
        }
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error in POST /api/artworks/:id/replace-image:', error)

    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return json({ error: 'Artwork not found' }, { status: 404 })
      }
      if (error.message.includes('not owned')) {
        return json(
          { error: 'Not authorized to update this artwork' },
          { status: 403 }
        )
      }
      if (error.message.includes('Invalid')) {
        return json({ error: error.message }, { status: 400 })
      }
    }

    return json(
      { error: 'Image processing failed. Please try again.' },
      { status: 500 }
    )
  }
}

function formatArtworkResponse(artwork: any) {
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
```

### Step 3: Add Route Handler

Create SvelteKit route for replace-image endpoint.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/routes/api/artworks/[id]/replace-image/+server.ts`

```typescript
import { replaceImageHandler as POST } from '$lib/api/routes/artworks'

export { POST }
```

### Step 4: Create R2 Deletion Worker (Optional)

If not already implemented, create a worker to handle R2 file deletion.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/workers/delete-file.ts` (Optional)

```typescript
/**
 * DELETE /delete-file
 * Cloudflare Worker to delete files from R2
 */

interface DeleteRequest {
  key: string
  timestamp: string
}

export interface Env {
  BUCKET: R2Bucket
  WORKER_AUTH_TOKEN: string
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Verify authentication
    const authHeader = request.headers.get('Authorization')
    if (authHeader !== `Bearer ${env.WORKER_AUTH_TOKEN}`) {
      return new Response('Unauthorized', { status: 401 })
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 })
    }

    try {
      const body: DeleteRequest = await request.json()
      const { key } = body

      if (!key) {
        return new Response(JSON.stringify({ error: 'Missing key' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      // Delete from R2
      await env.BUCKET.delete(key)

      return new Response(
        JSON.stringify({
          success: true,
          key,
          deleted: true
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    } catch (error) {
      console.error('Error deleting file:', error)
      return new Response(
        JSON.stringify({
          success: false,
          error: String(error)
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }
  }
}
```

---

## Files to Create/Modify

| Path | Type | Purpose |
|------|------|---------|
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/services/imageReplacement.ts` | Create | Image replacement service |
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/artworks.ts` | Modify | Add replace-image handler |
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/routes/api/artworks/[id]/replace-image/+server.ts` | Create | SvelteKit route |
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/workers/delete-file.ts` | Create | R2 deletion worker (optional) |

---

## Verification

### Test 1: Replace Image
```bash
# Step 1: Get presigned URL for new image
curl -X POST http://localhost:5173/api/artworks/upload-url \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "filename": "new-artwork.jpg",
    "contentType": "image/jpeg"
  }'

# Save returned key: originals/user-id/new-uuid.jpg

# Step 2: Upload new image to R2
curl -X PUT "<uploadUrl>" \
  -H "Content-Type: image/jpeg" \
  --data-binary @new-artwork.jpg

# Step 3: Replace image in artwork
curl -X POST http://localhost:5173/api/artworks/art_abc123/replace-image \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "originalKey": "originals/user-id/new-uuid.jpg"
  }'

# Expected: 200 OK with updated artwork
# {
#   "success": true,
#   "data": {
#     "id": "art_abc123",
#     "originalUrl": "https://cdn.vfa.gallery/originals/user-id/new-uuid.jpg",
#     "displayUrl": "https://cdn.vfa.gallery/display/user-id/new-uuid.jpg",
#     "thumbnailUrl": "https://cdn.vfa.gallery/thumbnails/user-id/new-uuid.jpg",
#     "iconUrl": "https://cdn.vfa.gallery/icons/user-id/new-uuid.jpg",
#     ...
#   },
#   "replacement": {
#     "oldImageUrls": { ... },
#     "newImageUrls": { ... }
#   }
# }
```

### Test 2: Replace Image with Cleanup
```bash
curl -X POST http://localhost:5173/api/artworks/art_abc123/replace-image \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "originalKey": "originals/user-id/new-uuid.jpg",
    "deleteOldImages": true
  }'

# Expected: 200 OK
# Verify old images are deleted from R2
```

### Test 3: Invalid Image Key
```bash
curl -X POST http://localhost:5173/api/artworks/art_abc123/replace-image \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "originalKey": "display/user-id/uuid.jpg"
  }'

# Expected: 400 Bad Request
# "Invalid image key format. Expected: originals/userId/uuid.extension"
```

### Test 4: Non-Owner Cannot Replace
```bash
curl -X POST http://localhost:5173/api/artworks/art_abc123/replace-image \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <other-user-token>" \
  -d '{
    "originalKey": "originals/other-user-id/uuid.jpg"
  }'

# Expected: 403 Forbidden
```

### Test 5: Metadata Unchanged
```bash
# Get artwork before replacement
curl -X GET http://localhost:5173/api/artworks/art_abc123

# Save title, description, tags, etc.

# Replace image
curl -X POST http://localhost:5173/api/artworks/art_abc123/replace-image \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "originalKey": "originals/user-id/new-uuid.jpg"
  }'

# Get artwork after replacement
curl -X GET http://localhost:5173/api/artworks/art_abc123

# Verify: title, description, tags, category all unchanged
# Only image URLs changed
```

### Test 6: Processing Pipeline Executed
```bash
# Monitor CloudFlare Worker logs during replace-image call
# Verify all three workers execute:
# - Watermark worker for display image
# - Thumbnail worker
# - Icon worker

# All should complete within 10 seconds
```

### Test 7: Timestamps Updated
```bash
# Get artwork before replacement
curl -X GET http://localhost:5173/api/artworks/art_abc123
# Note: updatedAt timestamp

# Replace image
curl -X POST http://localhost:5173/api/artworks/art_abc123/replace-image \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"originalKey": "originals/user-id/new-uuid.jpg"}'

# Get artwork after
curl -X GET http://localhost:5173/api/artworks/art_abc123
# Verify: updatedAt is newer
# createdAt should be unchanged
```

---

## Notes

- **Pipeline Integration**: Reuses existing image processing pipeline (Build 40)
- **Optional Cleanup**: Old images can be kept (safer) or deleted immediately
- **Atomic Operations**: Database update and R2 deletion are not transactional; cleanup failures don't block main operation
- **URL Reconstruction**: Service converts CDN URLs back to R2 keys for deletion
- **Key Validation**: Validates image key format before processing
- **Worker Communication**: Calls workers via HTTP with token authentication
- **Metadata Preservation**: Only image URLs updated; all metadata (title, tags, etc.) preserved
- **Timestamps**: `updatedAt` refreshed but `createdAt` stays same
- **Rate Limiting**: Subject to image processing worker rate limits
- **Error Recovery**: If processing fails, old URLs remain unchanged

