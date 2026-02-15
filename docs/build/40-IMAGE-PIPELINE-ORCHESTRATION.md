# 40-IMAGE-PIPELINE-ORCHESTRATION.md

## Goal

Implement the complete image upload-to-display pipeline using Cloudflare Image Transformations for on-the-fly variant generation. This spec covers the flow from client upload through artwork creation to final display, with all image variants (thumbnail, icon, watermarked display) generated on-demand at the edge without separate processing workers.

---

## Spec Extract

From TECHNICAL-SPEC.md:
- **Image Strategy**: On-the-fly transformations via Cloudflare Image Transformations (no separate processing workers)
- **Storage**: Original images stored in R2 at `originals/{userId}/{uuid}.{ext}`, artwork records store only the R2 key
- **Variants**: Generated on-demand from URL parameters:
  - Thumbnail: 300x300px fit
  - Icon: 128x128px fit
  - Display: Full-size with artist watermark overlay
- **CDN Domain**: `https://images.vfa.gallery` with Transform Rules blocking direct `originals/*` access
- **Caching**: Cloudflare Image Transformations cache variants automatically at edge

From BUILD INDEX:
- Build 36: Upload endpoint for presigned URL generation and direct-to-R2 upload
- Build 37: URL utility for generating variant URLs from R2 keys
- Build 40: This spec - complete pipeline orchestration and R2 configuration

---

## Prerequisites

**Must complete before starting:**
- **36-WORKER-IMAGE-UPLOAD-URL.md** - Presigned URL generation endpoint for client upload
- **37-WORKER-IMAGE-URL-UTILITY.md** - URL helper functions for generating variant URLs
- **15-API-FOUNDATION.md** - Database schema and API foundation
- **Cloudflare Pages setup** - Hono framework configured with R2 and D1 bindings

---

## Steps

### Step 1: Configure R2 Bucket Custom Domain

Create a custom domain for your R2 bucket at `images.vfa.gallery` with Cloudflare Image Transformations enabled.

**In Cloudflare Dashboard:**

1. Go to Storage → R2 → Your bucket → Settings → Custom Domain
2. Add custom domain: `images.vfa.gallery`
3. Enable "Cloudflare Image Transformations" for this domain
4. Save configuration

This enables all on-the-fly transformations to be served from the CDN domain.

### Step 2: Create R2 Transform Rule

Implement access control to block direct access to `originals/*` (only allow transformed versions).

**In Cloudflare Dashboard:**

1. Go to Transform Rules → Image Transformation Rules
2. Create new rule:
   - **If**: Path contains `originals/`
   - **Then**: Block request (403 Forbidden)

This prevents direct access to original images, forcing all requests through transformation endpoints which generate the variants on-demand.

### Step 3: Create URL Utility Service

Create a utility service that generates Cloudflare Image Transformation URLs from R2 keys.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/services/imageUrlService.ts`

```typescript
import type { HonoEnv } from '../../../types/env'

/**
 * Image variant dimensions and configurations
 */
export const IMAGE_VARIANTS = {
  thumbnail: {
    width: 300,
    height: 300,
    fit: 'scale-down' as const,
  },
  icon: {
    width: 128,
    height: 128,
    fit: 'scale-down' as const,
  },
  display: {
    quality: 85,
    fit: 'scale-down' as const,
  },
} as const

/**
 * Generate Cloudflare Image Transformation URL from R2 key
 *
 * @param key - R2 key (e.g., "originals/user-123/abc-def.jpg")
 * @param options - Transformation options (width, height, quality, etc.)
 * @returns Full CDN URL with transformation parameters
 */
export function generateImageUrl(
  key: string,
  options?: {
    width?: number
    height?: number
    quality?: number
    fit?: 'scale-down' | 'contain' | 'cover' | 'crop'
    format?: 'auto' | 'webp' | 'avif' | 'jpeg' | 'png'
  }
): string {
  const cdnDomain = 'https://images.vfa.gallery'

  if (!options || Object.keys(options).length === 0) {
    // No transformations - return original URL
    return `${cdnDomain}/${key}`
  }

  // Build transformation parameters
  const params = new URLSearchParams()

  if (options.width) params.append('width', String(options.width))
  if (options.height) params.append('height', String(options.height))
  if (options.quality) params.append('quality', String(options.quality))
  if (options.fit) params.append('fit', options.fit)
  if (options.format) params.append('format', options.format)

  const queryString = params.toString()
  return `${cdnDomain}/${key}${queryString ? '?' + queryString : ''}`
}

/**
 * Generate thumbnail URL (300x300px)
 *
 * @param key - R2 key of the original image
 * @returns Thumbnail image URL
 */
export function getThumbnailUrl(key: string): string {
  return generateImageUrl(key, {
    width: IMAGE_VARIANTS.thumbnail.width,
    height: IMAGE_VARIANTS.thumbnail.height,
    fit: IMAGE_VARIANTS.thumbnail.fit,
    format: 'auto',
  })
}

/**
 * Generate icon URL (128x128px)
 *
 * @param key - R2 key of the original image
 * @returns Icon image URL
 */
export function getIconUrl(key: string): string {
  return generateImageUrl(key, {
    width: IMAGE_VARIANTS.icon.width,
    height: IMAGE_VARIANTS.icon.height,
    fit: IMAGE_VARIANTS.icon.fit,
    format: 'auto',
  })
}

/**
 * Generate display URL (optimized for viewing, no watermark via URL)
 * Note: Watermark overlay is handled by separate image stored in R2
 * or applied via a dedicated endpoint if needed
 *
 * @param key - R2 key of the original image
 * @returns Display image URL
 */
export function getDisplayUrl(key: string): string {
  return generateImageUrl(key, {
    quality: IMAGE_VARIANTS.display.quality,
    fit: IMAGE_VARIANTS.display.fit,
    format: 'auto',
  })
}

/**
 * Generate watermarked display URL
 * Uses a pre-watermarked image stored separately in R2
 *
 * @param userId - User ID for watermarked image lookup
 * @param imageId - Image ID for watermarked image lookup
 * @returns URL to watermarked display image
 */
export function getWatermarkedDisplayUrl(userId: string, imageId: string): string {
  // Watermarked images stored at: watermarked/{userId}/{imageId}.jpg
  const watermarkedKey = `watermarked/${userId}/${imageId}.jpg`
  return generateImageUrl(watermarkedKey, {
    quality: IMAGE_VARIANTS.display.quality,
    format: 'auto',
  })
}
```

### Step 4: Update Artwork Schema

Ensure the artwork database table stores only the R2 key, not individual URLs.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/db/schema.ts` (Update if creating from scratch)

```typescript
// Artwork table structure - store R2 key, not URLs
CREATE TABLE IF NOT EXISTS artworks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  materials TEXT,
  dimensions TEXT,
  created_date TEXT,
  category TEXT NOT NULL DEFAULT 'other',
  tags TEXT, -- JSON array stored as string
  image_key TEXT NOT NULL, -- R2 key: "originals/{userId}/{uuid}.ext"
  is_public BOOLEAN NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'active',
  is_featured BOOLEAN NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,

  UNIQUE(user_id, slug)
);

-- Index for user lookups and status filtering
CREATE INDEX IF NOT EXISTS artworks_user_id_status ON artworks(user_id, status);
CREATE INDEX IF NOT EXISTS artworks_is_public_status ON artworks(is_public, status);
CREATE INDEX IF NOT EXISTS artworks_is_featured ON artworks(is_featured);
```

**Note**: The `image_key` column stores the R2 key (e.g., `"originals/user-123/abc-def.jpg"`). All variant URLs are generated on-demand at render time using the URL utility.

### Step 5: Create Upload Endpoint Handler

Create the Hono route handler for image uploads with presigned URL generation.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/artworks/upload.ts`

```typescript
import { Hono } from 'hono'
import { nanoid } from 'nanoid'
import type { HonoContext, HonoEnv } from '../../../../types/env'
import { Errors } from '../../errors'
import { requireAuth } from '../../middleware/auth'
import { requireCurrentUser } from '../../middleware/auth'

const uploadRouter = new Hono<HonoEnv>()

/**
 * Generate presigned URL for direct client-to-R2 upload
 *
 * POST /api/artworks/upload-url
 * Body: { filename: string, contentType: string }
 * Returns: { uploadUrl: string, key: string, expiresIn: number }
 */
uploadRouter.post('/upload-url', requireAuth, async (c: HonoContext) => {
  try {
    const user = requireCurrentUser(c)
    const body = await c.req.json().catch(() => ({}))

    const { filename, contentType } = body as {
      filename?: string
      contentType?: string
    }

    // Validate inputs
    if (!filename || !contentType) {
      throw Errors.badRequest('Missing filename or contentType', {
        required: ['filename', 'contentType'],
      })
    }

    // Validate content type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!validTypes.includes(contentType)) {
      throw Errors.badRequest('Invalid content type', {
        allowed: validTypes,
        received: contentType,
      })
    }

    // Validate filename
    if (!/^[a-zA-Z0-9._-]+$/.test(filename)) {
      throw Errors.badRequest('Invalid filename format')
    }

    // Extract file extension
    const ext = filename.split('.').pop()?.toLowerCase()
    if (!ext || !['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) {
      throw Errors.badRequest('Invalid file extension')
    }

    // Generate R2 key
    const fileId = nanoid()
    const imageKey = `originals/${user.userId}/${fileId}.${ext}`

    // Generate presigned URL (15 minutes validity)
    const presignedUrl = await c.env.IMAGE_BUCKET.createPresignedUrl(
      imageKey,
      {
        httpMethod: 'PUT',
        expirationTtl: 15 * 60, // 15 minutes
      },
      {
        contentType,
        cacheControl: 'max-age=31536000', // 1 year for immutable originals
      }
    )

    return c.json({
      uploadUrl: presignedUrl,
      key: imageKey,
      expiresIn: 15 * 60,
    }, 200)
  } catch (error) {
    console.error('[Upload] Error generating presigned URL:', error)
    if (error instanceof Errors.constructor) {
      throw error
    }
    throw Errors.internal('Failed to generate upload URL')
  }
})

export { uploadRouter }
```

### Step 6: Create Artwork Creation Endpoint

Create the endpoint that creates artwork records with image metadata.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/artworks/create.ts`

```typescript
import { Hono } from 'hono'
import { nanoid } from 'nanoid'
import type { HonoContext, HonoEnv } from '../../../../types/env'
import { Errors } from '../../errors'
import { requireAuth, requireCurrentUser } from '../../middleware/auth'
import { getThumbnailUrl, getIconUrl, getDisplayUrl } from '../../services/imageUrlService'

const createRouter = new Hono<HonoEnv>()

interface CreateArtworkPayload {
  title: string
  description?: string
  materials?: string
  dimensions?: string
  createdDate?: string
  category?: string
  tags?: string[]
  imageKey: string // R2 key from upload endpoint
}

/**
 * Create new artwork with image
 *
 * POST /api/artworks
 * Body: { title, description?, materials?, dimensions?, category?, tags?, imageKey }
 * Returns: Artwork object with image metadata
 */
createRouter.post('/', requireAuth, async (c: HonoContext) => {
  try {
    const user = requireCurrentUser(c)
    const body = await c.req.json().catch(() => ({})) as CreateArtworkPayload

    // Validate required fields
    if (!body.title || !body.imageKey) {
      throw Errors.badRequest('Missing required fields', {
        required: ['title', 'imageKey'],
      })
    }

    // Validate that image exists in R2
    try {
      await c.env.IMAGE_BUCKET.head(body.imageKey)
    } catch (err) {
      throw Errors.badRequest('Image not found in upload bucket', {
        imageKey: body.imageKey,
      })
    }

    // Check user artwork limit
    const userResult = await c.env.DB
      .prepare('SELECT artwork_limit, artwork_count FROM users WHERE id = ?')
      .bind(user.userId)
      .first<{ artwork_limit: number; artwork_count: number }>()

    if (!userResult) {
      throw Errors.notFound('User')
    }

    if (userResult.artwork_count >= userResult.artwork_limit) {
      throw Errors.rateLimited()
    }

    // Generate slug
    const baseSlug = generateSlug(body.title)
    const slug = await generateUniqueSlug(c, user.userId, baseSlug)

    // Create artwork record
    const artworkId = `art_${nanoid()}`
    const now = new Date().toISOString()

    const insertResult = await c.env.DB
      .prepare(
        `INSERT INTO artworks
         (id, user_id, slug, title, description, materials, dimensions,
          created_date, category, tags, image_key, is_public, status, is_featured,
          created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        artworkId,
        user.userId,
        slug,
        body.title,
        body.description || null,
        body.materials || null,
        body.dimensions || null,
        body.createdDate || null,
        body.category || 'other',
        body.tags ? JSON.stringify(body.tags) : null,
        body.imageKey,
        1, // is_public
        'active',
        0, // is_featured
        now,
        now
      )
      .run()

    if (!insertResult.success) {
      throw Errors.internal('Failed to create artwork')
    }

    // Increment user artwork count
    await c.env.DB
      .prepare('UPDATE users SET artwork_count = artwork_count + 1 WHERE id = ?')
      .bind(user.userId)
      .run()

    // Return artwork with generated image URLs
    return c.json({
      id: artworkId,
      userId: user.userId,
      slug,
      title: body.title,
      description: body.description || null,
      materials: body.materials || null,
      dimensions: body.dimensions || null,
      createdDate: body.createdDate || null,
      category: body.category || 'other',
      tags: body.tags || [],
      imageKey: body.imageKey,
      thumbnailUrl: getThumbnailUrl(body.imageKey),
      iconUrl: getIconUrl(body.imageKey),
      displayUrl: getDisplayUrl(body.imageKey),
      isPublic: true,
      status: 'active',
      isFeatured: false,
      createdAt: now,
      updatedAt: now,
    }, 201)
  } catch (error) {
    console.error('[Artwork Create] Error:', error)
    if (error instanceof Errors.constructor) {
      throw error
    }
    throw Errors.internal('Failed to create artwork')
  }
})

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 50)
}

async function generateUniqueSlug(
  c: HonoContext,
  userId: string,
  baseSlug: string
): Promise<string> {
  let slug = baseSlug
  let counter = 1

  while (true) {
    const existing = await c.env.DB
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

export { createRouter }
```

### Step 7: Create React Integration Example

Show how to use the URL utility in React components.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/ArtworkImage.tsx`

```typescript
import React from 'react'
import { getThumbnailUrl, getIconUrl, getDisplayUrl } from '../lib/api/services/imageUrlService'

interface ArtworkImageProps {
  imageKey: string
  title: string
  variant?: 'thumbnail' | 'icon' | 'display'
  className?: string
}

/**
 * Display artwork image with appropriate variant
 * Uses Cloudflare Image Transformations for on-the-fly sizing
 */
export function ArtworkImage({
  imageKey,
  title,
  variant = 'display',
  className,
}: ArtworkImageProps) {
  // Generate appropriate URL based on variant
  const getImageUrl = () => {
    switch (variant) {
      case 'thumbnail':
        return getThumbnailUrl(imageKey)
      case 'icon':
        return getIconUrl(imageKey)
      case 'display':
      default:
        return getDisplayUrl(imageKey)
    }
  }

  const imageUrl = getImageUrl()

  return (
    <img
      src={imageUrl}
      alt={title}
      className={className}
      loading="lazy"
      decoding="async"
    />
  )
}

/**
 * Example: Artwork gallery grid
 */
export function ArtworkGrid({ artworks }: { artworks: any[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {artworks.map((artwork) => (
        <div key={artwork.id} className="overflow-hidden rounded-lg">
          <ArtworkImage
            imageKey={artwork.imageKey}
            title={artwork.title}
            variant="thumbnail"
            className="w-full h-64 object-cover"
          />
          <div className="p-4">
            <h3 className="font-semibold text-lg">{artwork.title}</h3>
            <p className="text-sm text-gray-600">{artwork.description}</p>
          </div>
        </div>
      ))}
    </div>
}

/**
 * Example: Artwork detail page
 */
export function ArtworkDetail({ artwork }: { artwork: any }) {
  return (
    <div className="max-w-4xl mx-auto">
      <ArtworkImage
        imageKey={artwork.imageKey}
        title={artwork.title}
        variant="display"
        className="w-full rounded-lg shadow-lg"
      />
      <div className="mt-6">
        <h1 className="text-3xl font-bold">{artwork.title}</h1>
        <p className="text-gray-600 mt-2">{artwork.description}</p>
      </div>
    </div>
  )
}
```

### Step 8: Update wrangler.toml

Ensure R2 and D1 bindings are properly configured.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/wrangler.toml`

Verify these bindings exist:

```toml
[env.production]
name = "vfa-gallery"

# R2 Binding for image storage
[[r2_buckets]]
binding = "IMAGE_BUCKET"
bucket_name = "vfa-gallery-images"
jurisdiction = "us"

# D1 Database Binding
[[d1_databases]]
binding = "DB"
database_name = "vfa-gallery-db"
database_id = "your-database-id"

[env.production.env]
JWT_SECRET = "your-jwt-secret"
ENVIRONMENT = "production"
```

### Step 9: Create Data Flow Diagram

Document the complete flow from upload to display.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/docs/build/IMAGE-FLOW-DIAGRAM.txt`

```
COMPLETE IMAGE PIPELINE - ON-THE-FLY TRANSFORMATIONS

1. CLIENT UPLOAD FLOW
   ==================

   Client App
      │
      ├─ POST /api/artworks/upload-url
      │  └─ Returns: { uploadUrl, key, expiresIn }
      │
      ├─ PUT uploadUrl + file
      │  └─ Direct to R2: originals/{userId}/{uuid}.jpg
      │
      └─ POST /api/artworks
         ├─ Body: { title, imageKey, ... }
         └─ Creates D1 record with imageKey only


2. DATABASE STORAGE
   =================

   artworks table
   ─────────────────────────────────────
   id             | art_123
   user_id        | user_456
   title          | "My Painting"
   image_key      | originals/user_456/abc-def.jpg
   is_public      | 1
   created_at     | 2025-02-14T...
   (NO separate URL fields!)
   ─────────────────────────────────────


3. RUNTIME URL GENERATION
   =======================

   React Component calls:
   getThumbnailUrl(artwork.imageKey)
      │
      └─ Returns: https://images.vfa.gallery/originals/user_456/abc-def.jpg?width=300&height=300&fit=scale-down
         └─ Cloudflare Transform Rule intercepts
            └─ Generates 300x300px variant on-the-fly
            └─ Caches at edge (images.vfa.gallery CDN)
            └─ Returns to browser

   getDisplayUrl(artwork.imageKey)
      │
      └─ Returns: https://images.vfa.gallery/originals/user_456/abc-def.jpg?quality=85
         └─ Cloudflare generates optimized display version
         └─ Browser receives edge-cached variant


4. ACCESS CONTROL
   ===============

   Direct Access to originals/*
      │
      └─ Transform Rule blocks: 403 Forbidden
         └─ Enforces variant requests only


5. EDGE CACHING STRATEGY
   ======================

   First Request: https://images.vfa.gallery/originals/.../file.jpg?width=300&height=300
      │
      ├─ Cloudflare checks cache
      ├─ Cache MISS → Generate variant → Cache at edge → Return to browser
      │
   Subsequent Requests (same params):
      │
      ├─ Cloudflare checks cache
      ├─ Cache HIT → Return from edge (instant)


BENEFITS OF THIS APPROACH
=========================

✓ No separate processing workers needed
✓ Image variants stored only in browser cache + edge cache
✓ Original stored once in R2, never duplicated
✓ Variants generated on-demand (lazy)
✓ Automatic edge caching by Cloudflare
✓ Reduced storage costs (no variants in R2)
✓ Reduced compute costs (no worker fleet)
✓ Simplified architecture and debugging
✓ Better performance (edge-generated variants)
```

---

## Files to Create/Modify

| Path | Type | Purpose |
|------|------|---------|
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/services/imageUrlService.ts` | Create | URL generation utility for image variants |
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/artworks/upload.ts` | Create | Presigned URL generation endpoint |
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/artworks/create.ts` | Create | Artwork creation endpoint |
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/ArtworkImage.tsx` | Create | React component for displaying artwork images |
| `/Volumes/DataSSD/gitsrc/vfa_gallery/wrangler.toml` | Modify | Verify R2 and D1 bindings |
| `/Volumes/DataSSD/gitsrc/vfa_gallery/docs/build/IMAGE-FLOW-DIAGRAM.txt` | Create | Data flow documentation |

---

## Verification

### Test 1: Presigned URL Generation

```bash
# Get presigned upload URL
curl -X POST http://localhost:8787/api/artworks/upload-url \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <jwt-token>" \
  -d '{
    "filename": "my-artwork.jpg",
    "contentType": "image/jpeg"
  }'

# Expected response:
# {
#   "uploadUrl": "https://your-bucket.s3.us-east-1.amazonaws.com/...",
#   "key": "originals/user_123/abc-def.jpg",
#   "expiresIn": 900
# }
```

Verify:
- URL is valid and accessible for 15 minutes
- Response includes correct R2 key format

### Test 2: Direct-to-R2 Upload

```bash
# Upload file directly to R2 using presigned URL
curl -X PUT "https://your-bucket.s3.us-east-1.amazonaws.com/..." \
  -H "Content-Type: image/jpeg" \
  --data-binary @my-artwork.jpg

# Verify:
# - HTTP 200 response
# - File appears in R2 bucket at originals/user_123/abc-def.jpg
```

### Test 3: Create Artwork Record

```bash
# Create artwork with uploaded image
curl -X POST http://localhost:8787/api/artworks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <jwt-token>" \
  -d '{
    "title": "My Beautiful Painting",
    "description": "A landscape",
    "imageKey": "originals/user_123/abc-def.jpg",
    "category": "painting"
  }'

# Expected response:
# {
#   "id": "art_xyz",
#   "userId": "user_123",
#   "slug": "my-beautiful-painting",
#   "title": "My Beautiful Painting",
#   "imageKey": "originals/user_123/abc-def.jpg",
#   "thumbnailUrl": "https://images.vfa.gallery/originals/user_123/abc-def.jpg?width=300&height=300&fit=scale-down",
#   "iconUrl": "https://images.vfa.gallery/originals/user_123/abc-def.jpg?width=128&height=128&fit=scale-down",
#   "displayUrl": "https://images.vfa.gallery/originals/user_123/abc-def.jpg?quality=85",
#   ...
# }
```

Verify:
- Artwork record created in D1
- Only `image_key` stored, not URLs
- URLs are generated on response

### Test 4: On-the-Fly Image Transformation

```bash
# Request thumbnail variant
curl -I "https://images.vfa.gallery/originals/user_123/abc-def.jpg?width=300&height=300&fit=scale-down"

# Expected:
# - HTTP 200 OK
# - Content-Type: image/webp (or auto-optimized format)
# - Via header includes CF cache (X-Cache: HIT or MISS)
# - Response time < 100ms on cache hit
```

Verify with browser:
1. Open artwork detail page
2. Inspect Network tab
3. Thumbnail request shows `images.vfa.gallery` domain
4. First load: Cache MISS header, second load: Cache HIT
5. Image displays at correct size (300x300 for thumbnail)

### Test 5: Access Control

```bash
# Try to access original image directly (should be blocked)
curl -I "https://images.vfa.gallery/originals/user_123/abc-def.jpg"

# Expected: HTTP 403 Forbidden
# Transform Rule blocks direct originals/* access
```

### Test 6: Multiple Variants Cache

```bash
# Request same image in different sizes
curl -I "https://images.vfa.gallery/originals/user_123/abc-def.jpg?width=300&height=300"
curl -I "https://images.vfa.gallery/originals/user_123/abc-def.jpg?width=128&height=128"
curl -I "https://images.vfa.gallery/originals/user_123/abc-def.jpg?quality=85"

# Expected:
# - Three separate cache entries at Cloudflare edge
# - Each variant cached independently
# - Subsequent identical requests return cache HIT
```

### Test 7: React Component Integration

```typescript
// In your React component:
import { ArtworkImage } from '../components/ArtworkImage'

export function ArtworkPage({ artwork }) {
  return (
    <>
      <ArtworkImage
        imageKey={artwork.imageKey}
        title={artwork.title}
        variant="display"
        className="w-full"
      />
    </>
  )
}

// Verify:
// - Image loads from images.vfa.gallery
// - Correct variant URL generated
// - Image displays properly sized
```

### Test 8: Slug Uniqueness

```bash
# Create two artworks with same title, different users
curl -X POST http://localhost:8787/api/artworks \
  -H "Authorization: Bearer <user1-token>" \
  -d '{"title": "Untitled", "imageKey": "...", ...}'

curl -X POST http://localhost:8787/api/artworks \
  -H "Authorization: Bearer <user2-token>" \
  -d '{"title": "Untitled", "imageKey": "...", ...}'

# Both should succeed with slug "untitled" (unique per user, not global)
```

### Test 9: Artwork Limit Enforcement

```bash
# Create user with limit of 3
# Upload 3 artworks successfully
# Attempt 4th upload

curl -X POST http://localhost:8787/api/artworks \
  -H "Authorization: Bearer <token>" \
  -d '...'

# Expected: HTTP 429 Too Many Requests
```

---

## Notes

### Architecture Benefits

- **No Processing Workers**: Cloudflare Image Transformations handle all variant generation at the edge
- **Single Storage**: Only original images stored in R2; variants generated on-demand
- **Efficient Caching**: Cloudflare automatically caches variants at the edge based on URL parameters
- **Cost Reduction**: No compute cost for image processing, minimal storage (originals only)
- **Performance**: Edge-cached variants deliver faster than disk-stored variants

### R2 Key Organization

```
originals/
  └─ {userId}/
     └─ {uuid}.{ext}    # Original images only

No separate directories for thumbnails, icons, or display versions
(These are generated on-the-fly, not stored)
```

### Cloudflare Image Transformations

- Automatically serve WebP/AVIF to browsers that support it via `format=auto`
- Cache variants independently based on query parameters
- Resize, optimize, and convert on-the-fly
- Full documentation: https://developers.cloudflare.com/images/image-resizing/

### Database Schema

The `artworks` table stores only:
- `image_key` (R2 location of original)
- Not `thumbnail_url`, `display_url`, `icon_url` (these are generated)

This keeps the database simple and allows URL generation logic to change without migrations.

### URL Generation in React

Always use the `imageUrlService` utility:

```typescript
// Good - generates correct URL with transformations
const url = getThumbnailUrl(artwork.imageKey)

// Bad - would return original, not variant
const url = `https://images.vfa.gallery/${artwork.imageKey}`
```

### Cache Headers

Cloudflare Image Transformations set appropriate cache headers:
- Originals: `Cache-Control: max-age=31536000` (1 year, immutable)
- Variants: `Cache-Control: public, max-age=31536000` (cached at edge)

### Error Handling Flow

```
Client Upload
  ↓
1. Presigned URL fails → 400/500 error to client
2. R2 upload fails → Client retries or reports error
3. DB creation fails → Orphaned image in R2 (cleanup needed)
4. Image access fails → 403 if Transform Rule blocks, 404 if missing

Strategy: Implement cleanup job to remove orphaned images older than 1 hour
```

### Future Enhancements

- Pre-generate watermarked variants on upload (store separately in `watermarked/{userId}/{imageId}.jpg`)
- Implement image cleanup job for orphaned uploads
- Add image optimization queue if Transformations timeout
- Implement dynamic watermark text (artist name) via URL parameters
- Add support for animated images (GIF, WebP)

