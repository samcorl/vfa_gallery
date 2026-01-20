# 40-IMAGE-PIPELINE-ORCHESTRATION.md

## Goal
Orchestrate the complete image upload and processing flow by implementing the core image processing pipeline service that coordinates presigned URL generation, direct R2 uploads, parallel worker execution for all three image variants (thumbnail, icon, watermark), and artwork record creation with full URL persistence.

---

## Spec Extract

From TECHNICAL-SPEC.md:
- **Image Processing Pipeline**: Three generated assets per upload
  - Display version (watermarked with artist username)
  - Thumbnail (for gallery grids)
  - Icon (for navigation/previews)
- **Processing Strategy**: CloudFlare Workers for server-side processing
- **Storage**: All URLs persisted in artworks table
- **Flow**: Upload presigned URL → Client uploads to R2 → Server processes all variants in parallel → Create artwork record

From BUILD INDEX:
- Build 36: Presigned URL generation
- Build 37: Thumbnail worker
- Build 38: Icon worker
- Build 39: Watermark worker

---

## Prerequisites

**Must complete before starting:**
- **36-WORKER-IMAGE-UPLOAD-URL.md** - Presigned URL generation endpoint
- **37-WORKER-IMAGE-THUMBNAIL.md** - Thumbnail generation worker
- **38-WORKER-IMAGE-ICON.md** - Icon generation worker
- **39-WORKER-IMAGE-WATERMARK.md** - Watermark generation worker
- **15-API-FOUNDATION.md** - Database and API foundation

---

## Steps

### Step 1: Create Image Processing Service

Create the core image processor service that orchestrates all three workers in parallel.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/services/imageProcessor.ts`

```typescript
import type { D1Database } from '@cloudflare/workers-types'
import { Errors } from '../errors'

/**
 * Image processing pipeline result
 */
export interface ImageProcessingResult {
  originalUrl: string
  displayUrl: string
  thumbnailUrl: string
  iconUrl: string
  processedAt: string
}

/**
 * Image processor service for orchestrating parallel image processing
 */
export class ImageProcessorService {
  private db: D1Database
  private namespace: KVNamespace
  private workerApiBaseUrl: string

  constructor(db: D1Database, namespace: KVNamespace, workerApiBaseUrl: string) {
    this.db = db
    this.namespace = namespace
    this.workerApiBaseUrl = workerApiBaseUrl
  }

  /**
   * Main orchestration function: triggers parallel image processing workers
   *
   * @param originalKey - The R2 key of the uploaded original image (e.g., "originals/user-id/uuid.jpg")
   * @param userId - The user ID who uploaded the image
   * @param username - The username for watermark generation
   * @returns Promise resolving to all generated image URLs
   * @throws ProcessingError if any worker fails or times out
   */
  async processUploadedImage(
    originalKey: string,
    userId: string,
    username: string
  ): Promise<ImageProcessingResult> {
    try {
      // Validate input
      if (!originalKey || !userId || !username) {
        throw new Errors.ValidationError('Missing required parameters for image processing')
      }

      // Generate output keys for all variants
      const outputKeys = this.generateOutputKeys(originalKey, userId)

      // Execute all three workers in parallel
      const [displayResult, thumbnailResult, iconResult] = await Promise.all([
        this.triggerWatermarkWorker(originalKey, outputKeys.display, username),
        this.triggerThumbnailWorker(originalKey, outputKeys.thumbnail),
        this.triggerIconWorker(originalKey, outputKeys.icon)
      ])

      // Validate all results completed successfully
      if (!displayResult.success || !thumbnailResult.success || !iconResult.success) {
        throw new Errors.ProcessingError(
          `Image processing failed: display=${displayResult.success}, ` +
          `thumbnail=${thumbnailResult.success}, icon=${iconResult.success}`
        )
      }

      // Convert keys to public CDN URLs
      const result: ImageProcessingResult = {
        originalUrl: this.keyToCdnUrl(originalKey),
        displayUrl: this.keyToCdnUrl(outputKeys.display),
        thumbnailUrl: this.keyToCdnUrl(outputKeys.thumbnail),
        iconUrl: this.keyToCdnUrl(outputKeys.icon),
        processedAt: new Date().toISOString()
      }

      return result
    } catch (error) {
      console.error('Image processing orchestration failed:', error)
      throw error
    }
  }

  /**
   * Generate R2 output keys for processed image variants
   */
  private generateOutputKeys(originalKey: string, userId: string): {
    display: string
    thumbnail: string
    icon: string
  } {
    // Extract base filename without extension from original
    const match = originalKey.match(/\/([^/]+)$/)
    const filename = match ? match[1] : 'image'
    const nameWithoutExt = filename.replace(/\.[^.]+$/, '')

    return {
      display: `display/${userId}/${nameWithoutExt}.jpg`,
      thumbnail: `thumbnails/${userId}/${nameWithoutExt}.jpg`,
      icon: `icons/${userId}/${nameWithoutExt}.jpg`
    }
  }

  /**
   * Convert R2 key to public CDN URL
   * Assumes R2 bucket is publicly accessible via CDN domain
   */
  private keyToCdnUrl(key: string): string {
    const cdnDomain = process.env.R2_CDN_DOMAIN || 'https://cdn.vfa.gallery'
    return `${cdnDomain}/${key}`
  }

  /**
   * Trigger watermark worker via HTTP request
   */
  private async triggerWatermarkWorker(
    sourceKey: string,
    outputKey: string,
    username: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.workerApiBaseUrl}/process-watermark`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.WORKER_AUTH_TOKEN}`
        },
        body: JSON.stringify({
          sourceKey,
          outputKey,
          username,
          timestamp: new Date().toISOString()
        })
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Watermark worker error: ${response.status} - ${error}`)
      }

      const result = await response.json()
      return { success: result.success ?? true }
    } catch (error) {
      console.error('Watermark worker call failed:', error)
      return { success: false, error: String(error) }
    }
  }

  /**
   * Trigger thumbnail worker via HTTP request
   */
  private async triggerThumbnailWorker(
    sourceKey: string,
    outputKey: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.workerApiBaseUrl}/process-thumbnail`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.WORKER_AUTH_TOKEN}`
        },
        body: JSON.stringify({
          sourceKey,
          outputKey,
          width: 300,
          height: 300,
          timestamp: new Date().toISOString()
        })
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Thumbnail worker error: ${response.status} - ${error}`)
      }

      const result = await response.json()
      return { success: result.success ?? true }
    } catch (error) {
      console.error('Thumbnail worker call failed:', error)
      return { success: false, error: String(error) }
    }
  }

  /**
   * Trigger icon worker via HTTP request
   */
  private async triggerIconWorker(
    sourceKey: string,
    outputKey: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.workerApiBaseUrl}/process-icon`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.WORKER_AUTH_TOKEN}`
        },
        body: JSON.stringify({
          sourceKey,
          outputKey,
          size: 128,
          timestamp: new Date().toISOString()
        })
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Icon worker error: ${response.status} - ${error}`)
      }

      const result = await response.json()
      return { success: result.success ?? true }
    } catch (error) {
      console.error('Icon worker call failed:', error)
      return { success: false, error: String(error) }
    }
  }

  /**
   * Wait for image processing with timeout and retry logic
   * Useful for ensuring all variants are ready before creating artwork record
   */
  async waitForProcessing(
    outputKeys: { display: string; thumbnail: string; icon: string },
    maxRetries: number = 30,
    retryDelayMs: number = 1000
  ): Promise<boolean> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Check KV namespace for processing completion flags
        const displayReady = await this.namespace.get(`ready:${outputKeys.display}`)
        const thumbnailReady = await this.namespace.get(`ready:${outputKeys.thumbnail}`)
        const iconReady = await this.namespace.get(`ready:${outputKeys.icon}`)

        if (displayReady && thumbnailReady && iconReady) {
          return true
        }

        if (attempt < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, retryDelayMs))
        }
      } catch (error) {
        console.error('Error checking processing status:', error)
        if (attempt < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, retryDelayMs))
        }
      }
    }

    return false
  }
}
```

### Step 2: Update Artwork Create Endpoint to Use Pipeline

Modify the artwork creation endpoint to use the image processor service.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/artworks.ts` (Update existing POST handler)

```typescript
import { json, type RequestHandler } from '@sveltejs/kit'
import { nanoid } from 'nanoid'
import { auth } from '$lib/server/auth'
import { db } from '$lib/server/db'
import { ImageProcessorService } from '$lib/api/services/imageProcessor'
import { Errors } from '../errors'

/**
 * POST /api/artworks
 * Create new artwork with image processing pipeline
 */
export const POST: RequestHandler = async ({ request, locals, platform }) => {
  try {
    // Authenticate user
    const session = await auth.getSession(request)
    if (!session?.user?.id) {
      return json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id
    const username = session.user.username

    // Parse request body
    const body = await request.json().catch(() => ({}))
    const {
      title,
      description,
      materials,
      dimensions,
      createdDate,
      category,
      tags = [],
      originalKey
    } = body

    // Validate required fields
    if (!title || !originalKey) {
      return json(
        { error: 'Missing required fields: title, originalKey' },
        { status: 400 }
      )
    }

    // Check user artwork limit
    const userResult = await db
      .prepare('SELECT artwork_limit, artwork_count FROM users WHERE id = ?')
      .bind(userId)
      .first()

    if (!userResult) {
      return json({ error: 'User not found' }, { status: 404 })
    }

    if (userResult.artwork_count >= userResult.artwork_limit) {
      return json(
        { error: 'Artwork limit reached' },
        { status: 429 }
      )
    }

    // Initialize image processor
    const imageProcessor = new ImageProcessorService(
      db,
      platform.env.KV,
      process.env.WORKER_API_BASE_URL || 'https://workers.example.com'
    )

    // Trigger parallel image processing
    const imageResult = await imageProcessor.processUploadedImage(
      originalKey,
      userId,
      username
    )

    // Generate unique slug
    const baseSlug = generateSlug(title)
    const slug = await generateUniqueSlug(baseSlug, userId)

    // Create artwork record with all URLs
    const artworkId = `art_${nanoid()}`
    const now = new Date().toISOString()

    const artworkData = {
      id: artworkId,
      user_id: userId,
      slug,
      title,
      description: description || null,
      materials: materials || null,
      dimensions: dimensions || null,
      created_date: createdDate || null,
      category: category || 'other',
      tags: tags.length > 0 ? JSON.stringify(tags) : null,
      original_url: imageResult.originalUrl,
      display_url: imageResult.displayUrl,
      thumbnail_url: imageResult.thumbnailUrl,
      icon_url: imageResult.iconUrl,
      status: 'active',
      is_featured: false,
      created_at: now,
      updated_at: now
    }

    await db
      .prepare(
        `INSERT INTO artworks
         (id, user_id, slug, title, description, materials, dimensions,
          created_date, category, tags, original_url, display_url,
          thumbnail_url, icon_url, status, is_featured, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        artworkData.id,
        artworkData.user_id,
        artworkData.slug,
        artworkData.title,
        artworkData.description,
        artworkData.materials,
        artworkData.dimensions,
        artworkData.created_date,
        artworkData.category,
        artworkData.tags,
        artworkData.original_url,
        artworkData.display_url,
        artworkData.thumbnail_url,
        artworkData.icon_url,
        artworkData.status,
        artworkData.is_featured,
        artworkData.created_at,
        artworkData.updated_at
      )
      .run()

    // Increment user artwork count
    await db
      .prepare('UPDATE users SET artwork_count = artwork_count + 1 WHERE id = ?')
      .bind(userId)
      .run()

    return json({ data: formatArtworkResponse(artworkData) }, { status: 201 })
  } catch (error) {
    console.error('Artwork creation error:', error)

    if (error instanceof Errors.ValidationError) {
      return json({ error: error.message }, { status: 400 })
    }

    if (error instanceof Errors.ProcessingError) {
      return json(
        { error: 'Image processing failed. Please try again.' },
        { status: 500 }
      )
    }

    return json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * Generate slug from title
 */
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 50)
}

/**
 * Ensure slug is unique per user
 */
async function generateUniqueSlug(baseSlug: string, userId: string): Promise<string> {
  let slug = baseSlug
  let counter = 1

  while (true) {
    const existing = await db
      .prepare('SELECT id FROM artworks WHERE user_id = ? AND slug = ?')
      .bind(userId, slug)
      .first()

    if (!existing) {
      return slug
    }

    slug = `${baseSlug}-${counter}`
    counter++
  }
}

/**
 * Format artwork response
 */
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

### Step 3: Add Worker Configuration

Update environment variables to enable worker communication.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/.env.example`

Add these variables:

```
# Image Processing Workers
WORKER_API_BASE_URL=https://workers.example.com
WORKER_AUTH_TOKEN=your_worker_auth_token_here
R2_CDN_DOMAIN=https://cdn.vfa.gallery
```

### Step 4: Create Error Classes

Add processing error handling.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/errors.ts` (Update if exists, or create)

```typescript
export class Errors {
  static ValidationError = class extends Error {
    constructor(message: string) {
      super(message)
      this.name = 'ValidationError'
    }
  }

  static ProcessingError = class extends Error {
    constructor(message: string) {
      super(message)
      this.name = 'ProcessingError'
    }
  }

  static AuthenticationError = class extends Error {
    constructor(message: string) {
      super(message)
      this.name = 'AuthenticationError'
    }
  }
}
```

---

## Files to Create/Modify

| Path | Type | Purpose |
|------|------|---------|
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/services/imageProcessor.ts` | Create | Image processing orchestration service |
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/artworks.ts` | Modify | Update POST endpoint to use image processor |
| `/Volumes/DataSSD/gitsrc/vfa_gallery/.env.example` | Modify | Add worker configuration variables |
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/errors.ts` | Create/Modify | Error handling classes |

---

## Verification

### Test 1: Full Upload Flow
```bash
# Step 1: Get presigned URL
curl -X POST http://localhost:5173/api/artworks/upload-url \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "filename": "test-artwork.jpg",
    "contentType": "image/jpeg"
  }'

# Save the returned uploadUrl and key

# Step 2: Upload to R2 using presigned URL
curl -X PUT "<uploadUrl>" \
  -H "Content-Type: image/jpeg" \
  --data-binary @test-artwork.jpg

# Step 3: Create artwork via API (triggers pipeline)
curl -X POST http://localhost:5173/api/artworks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "title": "Test Artwork",
    "description": "A test artwork",
    "category": "illustration",
    "originalKey": "originals/<userId>/<uuid>.jpg"
  }'

# Expected Response:
# {
#   "data": {
#     "id": "art_...",
#     "userId": "usr_...",
#     "slug": "test-artwork",
#     "title": "Test Artwork",
#     "originalUrl": "https://cdn.vfa.gallery/originals/...",
#     "displayUrl": "https://cdn.vfa.gallery/display/...",
#     "thumbnailUrl": "https://cdn.vfa.gallery/thumbnails/...",
#     "iconUrl": "https://cdn.vfa.gallery/icons/...",
#     ...
#   }
# }
```

### Test 2: Parallel Worker Execution
- Monitor CloudFlare Worker logs during artwork creation
- Verify all three workers (watermark, thumbnail, icon) execute in parallel
- Check that all three complete within 10 seconds

### Test 3: Image URL Verification
- Check that returned URLs resolve to correct images
- Verify display version has watermark with username
- Verify thumbnail is 300x300px
- Verify icon is 128x128px

### Test 4: Partial Failure Handling
- Artificially fail one worker (e.g., stop watermark service)
- Create artwork
- Verify entire operation fails with appropriate error message
- Restore service and retry

### Test 5: Concurrent Uploads
- Upload 3 artworks simultaneously
- Verify all process correctly with no conflicts
- Check database has all 3 records with correct data

### Test 6: User Limit Enforcement
- Create user with artwork_limit = 2
- Upload 2 artworks successfully
- Attempt 3rd upload
- Verify 429 status and "Artwork limit reached" error

---

## Notes

- **Parallel Processing**: All three workers execute simultaneously via `Promise.all()`, reducing total processing time
- **Failure Handling**: If any worker fails, the entire operation fails and artwork is not created
- **CDN URLs**: Assumes R2 bucket is configured with public CDN domain for URL generation
- **Worker Communication**: Workers are called via HTTP with JWT token authentication
- **Retry Logic**: Database operations automatically retry on transient failures
- **Slug Uniqueness**: Slugs are unique per user, not globally unique, allowing same title across different users
- **Rate Limiting**: Image processing is subject to worker rate limits defined in worker configuration
- **Storage Organization**: All images stored in organized directories (originals/, display/, thumbnails/, icons/)

