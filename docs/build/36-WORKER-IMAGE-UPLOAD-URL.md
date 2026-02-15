# 36-WORKER-IMAGE-UPLOAD-URL.md

## Goal
Handle artwork image uploads directly through a Hono API endpoint that stores originals to Cloudflare R2. Variant images (thumbnails, icons, displays) are generated on-the-fly via Cloudflare Image Transformations using URL parameters—no separate storage needed.

## Spec Extract
- **API Endpoint**: POST /api/artworks/upload
- **Accepted Content Types**: image/jpeg, image/png, image/gif, image/webp
- **Upload Limit**: 10MB per image
- **Storage Path Pattern**: originals/{userId}/{uuid}.{ext}
- **R2 Bucket**: Native binding `c.env.IMAGE_BUCKET`
- **CDN Domain**: https://images.vfa.gallery
- **Image Variants**: Generated on-the-fly via Cloudflare Image Transformations (no presigned URLs, no storage overhead)

## Prerequisites
- Build 15: Database schema for artworks table
- Build 05: Environment configuration with R2 bucket binding
- Build 30+: HonoEnv type and auth middleware setup
- Cloudflare Image Transformations enabled on R2 bucket

## Steps

### 1. Create Artworks Router with Upload Endpoint

**File**: `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/artworks.ts`

```typescript
import { Hono } from 'hono'
import type { HonoEnv } from '../../../types/env'
import { Errors } from '../errors'
import { requireAuth, getCurrentUser } from '../middleware/auth'
import { createArtwork } from '../../db/artworks'

const artworks = new Hono<HonoEnv>()

// Allowed MIME types for uploads
const ALLOWED_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp'
]

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

function validateContentType(contentType: string): boolean {
  return ALLOWED_CONTENT_TYPES.includes(contentType)
}

function getFileExtension(contentType: string): string {
  const typeMap: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp'
  }
  return typeMap[contentType] || 'jpg'
}

/**
 * POST /api/artworks/upload
 * Upload artwork image to R2
 */
artworks.post('/upload', requireAuth, async (c) => {
  const authUser = getCurrentUser(c)
  if (!authUser) {
    throw Errors.unauthorized()
  }

  // Parse form data
  let formData: FormData
  try {
    formData = await c.req.formData()
  } catch {
    throw Errors.badRequest('Invalid form data')
  }

  const file = formData.get('file')
  if (!file || !(file instanceof File)) {
    throw Errors.badRequest('File is required', { field: 'file' })
  }

  // Validate content type
  if (!validateContentType(file.type)) {
    throw Errors.badRequest('Invalid content type. Allowed: image/jpeg, image/png, image/gif, image/webp', {
      field: 'file',
      contentType: file.type
    })
  }

  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    throw Errors.badRequest('File size exceeds 10MB limit', {
      field: 'file',
      maxSize: MAX_FILE_SIZE,
      actualSize: file.size
    })
  }

  // Upload to R2
  const bucket = c.env.IMAGE_BUCKET
  if (!bucket) {
    throw Errors.internal('Image bucket not configured')
  }

  try {
    // Generate unique filename using crypto.randomUUID
    const uuid = crypto.randomUUID()
    const extension = getFileExtension(file.type)
    const key = `originals/${authUser.userId}/${uuid}.${extension}`

    // Read file as ArrayBuffer
    const arrayBuffer = await file.arrayBuffer()

    // Upload to R2
    await bucket.put(key, arrayBuffer, {
      httpMetadata: {
        contentType: file.type,
        cacheControl: 'public, max-age=31536000'
      }
    })

    // Build public CDN URL
    const cdnUrl = `https://images.vfa.gallery/${key}`

    return c.json({
      key,
      cdnUrl,
      contentType: file.type,
      size: file.size
    })
  } catch (err) {
    if (err instanceof Error) {
      console.error('[Artwork Upload] Error:', err.message)
    }
    throw Errors.internal('Failed to upload image')
  }
})

export { artworks }
```

### 2. Mount Artworks Router in Main App

**File**: `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/index.ts`

Add the artworks router to your main Hono app instance:

```typescript
import { artworks } from './routes/artworks'

// ... other imports and setup

// Mount routers
app.route('/artworks', artworks)
```

### 3. Image Transformation URL Patterns (For Client Use)

Since Cloudflare Image Transformations handles variants on-the-fly, clients use the base URL with optional transformation parameters:

```typescript
// Base original (full size)
const originalUrl = 'https://images.vfa.gallery/originals/{userId}/{uuid}.jpg'

// Thumbnail (e.g., 200x200)
const thumbnailUrl = 'https://images.vfa.gallery/originals/{userId}/{uuid}.jpg?width=200&height=200&fit=cover'

// Icon (e.g., 64x64)
const iconUrl = 'https://images.vfa.gallery/originals/{userId}/{uuid}.jpg?width=64&height=64&fit=cover'

// Display (e.g., 800x600, optimized)
const displayUrl = 'https://images.vfa.gallery/originals/{userId}/{uuid}.jpg?width=800&height=600&fit=scale-down'
```

No separate variant files are stored. Cloudflare Image Transformations generates them on-the-fly and caches the results.

### 4. Validation Module

**File**: `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/validation/artworks.ts`

```typescript
const ALLOWED_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp'
]

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

export function validateArtworkImageUpload(file: File): string[] {
  const errors: string[] = []

  if (!file) {
    errors.push('File is required')
    return errors
  }

  if (!ALLOWED_CONTENT_TYPES.includes(file.type)) {
    errors.push(`Invalid content type: ${file.type}. Allowed: image/jpeg, image/png, image/gif, image/webp`)
  }

  if (file.size > MAX_FILE_SIZE) {
    errors.push(`File size exceeds 10MB limit (current: ${Math.round(file.size / 1024 / 1024)}MB)`)
  }

  return errors
}
```

### 5. Update Environment Configuration

**File**: `/Volumes/DataSSD/gitsrc/vfa_gallery/wrangler.toml`

Ensure R2 bucket binding is configured:

```toml
[[r2_buckets]]
binding = "IMAGE_BUCKET"
bucket_name = "your-bucket-name"
preview = true
```

**File**: `/Volumes/DataSSD/gitsrc/vfa_gallery/src/types/env.ts`

Ensure HonoEnv includes the R2 bucket binding:

```typescript
export type CloudFlareEnv = {
  DB: D1Database
  IMAGE_BUCKET: R2Bucket
  // ... other bindings
}

export type HonoEnv = {
  Bindings: CloudFlareEnv
}
```

## Files to Create/Modify

| Path | Type | Purpose |
|------|------|---------|
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/artworks.ts` | Create | Hono router with upload endpoint |
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/validation/artworks.ts` | Create | File validation utilities |
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/index.ts` | Modify | Mount artworks router |
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/types/env.ts` | Verify | Ensure HonoEnv has IMAGE_BUCKET binding |
| `/Volumes/DataSSD/gitsrc/vfa_gallery/wrangler.toml` | Verify | Ensure R2 bucket binding exists |

## Verification

### Test 1: Upload Image
```bash
# Create a test image file first
echo "fake image data" > test-image.jpg

curl -X POST http://localhost:8787/api/artworks/upload \
  -H "Authorization: Bearer <valid-token>" \
  -F "file=@test-image.jpg"

# Expected Response (200 OK):
# {
#   "key": "originals/<userId>/<uuid>.jpg",
#   "cdnUrl": "https://images.vfa.gallery/originals/<userId>/<uuid>.jpg",
#   "contentType": "image/jpeg",
#   "size": 15
# }
```

### Test 2: Verify Image Accessibility
```bash
# Use cdnUrl from Test 1
curl -I https://images.vfa.gallery/originals/<userId>/<uuid>.jpg

# Expected: 200 OK with content-type: image/jpeg
```

### Test 3: Test Image Transformation
```bash
# Request thumbnail variant
curl -I "https://images.vfa.gallery/originals/<userId>/<uuid>.jpg?width=200&height=200&fit=cover"

# Expected: 200 OK (Cloudflare transforms and caches the result)
```

### Test 4: Invalid Content Type
```bash
# Create a text file
echo "not an image" > test-file.txt

curl -X POST http://localhost:8787/api/artworks/upload \
  -H "Authorization: Bearer <valid-token>" \
  -F "file=@test-file.txt"

# Expected: 400 Bad Request with error about invalid content type
```

### Test 5: File Size Validation
```bash
# Create a large file (e.g., 11MB)
dd if=/dev/zero of=large-file.jpg bs=1M count=11

curl -X POST http://localhost:8787/api/artworks/upload \
  -H "Authorization: Bearer <valid-token>" \
  -F "file=@large-file.jpg"

# Expected: 400 Bad Request with error about size limit
```

### Test 6: Missing Authentication
```bash
curl -X POST http://localhost:8787/api/artworks/upload \
  -F "file=@test-image.jpg"

# Expected: 401 Unauthorized
```

## Notes
- Files are stored at `originals/{userId}/{uuid}.{ext}` for organization and deduplication
- UUIDs (via `crypto.randomUUID()`) prevent filename collisions
- Cloudflare Image Transformations generates variants on-the-fly—no separate files stored
- CDN caching header set to 1 year (public immutable content)
- Client passes multipart form data with `file` field containing the image
- Endpoint validates both content type and file size before uploading to R2
- Error handling uses the `Errors` factory for consistent response format
- Authentication is required via `requireAuth` middleware
- All responses include the R2 key and public CDN URL for immediate use
