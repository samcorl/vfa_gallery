# 41-API-ARTWORK-CREATE.md

## Goal
Create the POST `/api/artworks` endpoint that allows authenticated users to create new artwork records with image processing pipeline integration. The endpoint validates metadata, generates unique slugs per user, triggers image processing, and returns complete artwork data with all image URLs.

---

## Spec Extract

From TECHNICAL-SPEC.md:
- **Artworks Table**: Stores artwork metadata with user ownership
- **Slug Generation**: Auto-generated from title, must be unique per user (not globally)
- **Image Processing**: Trigger pipeline to generate display_url, thumbnail_url, icon_url from original_url
- **User Limits**: Check `users.artwork_limit` before allowing creation
- **Status**: Default 'active' for new artworks
- **Tags**: Stored as JSON string in database

Request body schema:
```json
{
  "title": "Dragon's Dawn",
  "description": "A fierce dragon breathing fire at dawn.",
  "materials": "Digital, Procreate",
  "dimensions": "3000x4000px",
  "createdDate": "2024-01",
  "category": "illustration",
  "tags": ["dragon", "fantasy"],
  "originalKey": "originals/user-id/uuid.jpg"
}
```

Response schema:
```json
{
  "data": {
    "id": "art_abc123",
    "userId": "usr_xyz789",
    "slug": "dragons-dawn",
    "title": "Dragon's Dawn",
    "description": "A fierce dragon breathing fire at dawn.",
    "materials": "Digital, Procreate",
    "dimensions": "3000x4000px",
    "createdDate": "2024-01",
    "category": "illustration",
    "tags": ["dragon", "fantasy"],
    "originalUrl": "https://r2-cdn.example.com/originals/...",
    "displayUrl": "https://r2-cdn.example.com/display/...",
    "thumbnailUrl": "https://r2-cdn.example.com/thumbs/...",
    "iconUrl": "https://r2-cdn.example.com/icons/...",
    "status": "active",
    "isFeatured": false,
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  }
}
```

---

## Prerequisites

**Must complete before starting:**
- **10-SCHEMA-ARTWORKS.md** - Artworks table schema created
- **16-API-MIDDLEWARE-AUTH.md** - Authentication middleware available
- **40-API-UPLOAD-URL-GENERATION.md** (assumed exists) - R2 upload URL generation logic

---

## Steps

### Step 1: Create Artwork Service Module

Create a service module for artwork business logic and database operations.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/services/artwork.ts`

```typescript
import { nanoid } from 'nanoid'
import type { D1Database } from '@cloudflare/workers-types'
import { Errors } from '../errors'

/**
 * Artwork entity type matching database schema
 */
export interface Artwork {
  id: string
  userId: string
  slug: string
  title: string
  description?: string
  materials?: string
  dimensions?: string
  createdDate?: string
  category?: string
  tags?: string[] // Stored as JSON in DB
  originalUrl: string
  displayUrl: string
  thumbnailUrl: string
  iconUrl: string
  themeId?: string
  status: 'active' | 'processing' | 'deleted'
  isFeatured: boolean
  createdAt: string
  updatedAt: string
}

/**
 * Request body type for creating artwork
 */
export interface CreateArtworkInput {
  title: string
  description?: string
  materials?: string
  dimensions?: string
  createdDate?: string
  category?: string
  tags?: string[]
  originalKey: string // R2 object key (e.g., "originals/user-id/uuid.jpg")
}

/**
 * Internal artwork creation context
 */
interface ArtworkCreationContext {
  userId: string
  input: CreateArtworkInput
  artworkId: string
  slug: string
  imageUrls: {
    originalUrl: string
    displayUrl: string
    thumbnailUrl: string
    iconUrl: string
  }
}

/**
 * Generate slug from title
 * Converts to lowercase, removes special chars, replaces spaces with hyphens
 */
function generateSlugFromTitle(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
}

/**
 * Check if slug is unique for the user
 */
export async function isSlugUniqueForUser(
  db: D1Database,
  userId: string,
  slug: string
): Promise<boolean> {
  const result = await db
    .prepare('SELECT id FROM artworks WHERE user_id = ? AND slug = ? LIMIT 1')
    .bind(userId, slug)
    .first<{ id: string }>()

  return !result
}

/**
 * Generate unique slug for user
 * If slug exists, append numeric suffix (e.g., "my-art-2")
 */
export async function generateUniqueSlugForUser(
  db: D1Database,
  userId: string,
  baseSlug: string
): Promise<string> {
  let slug = baseSlug
  let counter = 2

  while (!(await isSlugUniqueForUser(db, userId, slug))) {
    slug = `${baseSlug}-${counter}`
    counter++
  }

  return slug
}

/**
 * Check if user has exceeded artwork creation limit
 */
export async function checkArtworkLimit(
  db: D1Database,
  userId: string
): Promise<void> {
  const user = await db
    .prepare('SELECT artwork_limit FROM users WHERE id = ?')
    .bind(userId)
    .first<{ artwork_limit: number | null }>()

  if (!user) {
    throw Errors.notFound('User')
  }

  // If artwork_limit is null, no limit
  if (user.artwork_limit === null) return

  const artworkCount = await db
    .prepare('SELECT COUNT(*) as count FROM artworks WHERE user_id = ?')
    .bind(userId)
    .first<{ count: number }>()

  if (artworkCount && artworkCount.count >= user.artwork_limit) {
    throw Errors.badRequest(
      `Artwork limit (${user.artwork_limit}) exceeded`,
      { limit: user.artwork_limit, current: artworkCount.count }
    )
  }
}

/**
 * Convert R2 object key to public URLs
 * Example: "originals/user-id/uuid.jpg" -> multiple URLs for different sizes
 * This assumes images are processed and available at specific paths
 */
function generateImageUrls(baseUrl: string, originalKey: string): ArtworkCreationContext['imageUrls'] {
  // Extract filename and directory structure from original key
  // Original key format: "originals/user-id/uuid.jpg"
  const parts = originalKey.split('/')
  const filename = parts[parts.length - 1]
  const userId = parts[parts.length - 2]

  return {
    originalUrl: `${baseUrl}/${originalKey}`,
    displayUrl: `${baseUrl}/display/${userId}/${filename}`,
    thumbnailUrl: `${baseUrl}/thumbs/${userId}/${filename}`,
    iconUrl: `${baseUrl}/icons/${userId}/${filename}`,
  }
}

/**
 * Create artwork in database
 * Returns the created artwork record
 */
export async function createArtworkInDatabase(
  db: D1Database,
  context: ArtworkCreationContext
): Promise<Artwork> {
  const { userId, input, artworkId, slug, imageUrls } = context

  // Convert tags array to JSON string for storage
  const tagsJson = input.tags ? JSON.stringify(input.tags) : null

  const now = new Date().toISOString()

  await db
    .prepare(
      `INSERT INTO artworks (
        id, user_id, slug, title, description, materials, dimensions,
        created_date, category, tags, original_url, display_url,
        thumbnail_url, icon_url, status, is_featured, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      artworkId,
      userId,
      slug,
      input.title,
      input.description || null,
      input.materials || null,
      input.dimensions || null,
      input.createdDate || null,
      input.category || null,
      tagsJson,
      imageUrls.originalUrl,
      imageUrls.displayUrl,
      imageUrls.thumbnailUrl,
      imageUrls.iconUrl,
      'active', // status
      0, // is_featured
      now,
      now
    )
    .run()

  // Return the created artwork
  return {
    id: artworkId,
    userId,
    slug,
    title: input.title,
    description: input.description,
    materials: input.materials,
    dimensions: input.dimensions,
    createdDate: input.createdDate,
    category: input.category,
    tags: input.tags,
    originalUrl: imageUrls.originalUrl,
    displayUrl: imageUrls.displayUrl,
    thumbnailUrl: imageUrls.thumbnailUrl,
    iconUrl: imageUrls.iconUrl,
    status: 'active',
    isFeatured: false,
    createdAt: now,
    updatedAt: now,
  }
}

/**
 * Validate create artwork input
 */
export function validateCreateArtworkInput(input: any): CreateArtworkInput {
  // Required fields
  if (!input.title || typeof input.title !== 'string') {
    throw Errors.badRequest('title is required and must be a string')
  }

  if (!input.originalKey || typeof input.originalKey !== 'string') {
    throw Errors.badRequest('originalKey is required and must be a string')
  }

  // Validate title length (min 1, max 255)
  if (input.title.length < 1 || input.title.length > 255) {
    throw Errors.badRequest('title must be between 1 and 255 characters')
  }

  // Optional string fields
  const optionalStringFields = ['description', 'materials', 'dimensions', 'createdDate', 'category']
  for (const field of optionalStringFields) {
    if (input[field] && typeof input[field] !== 'string') {
      throw Errors.badRequest(`${field} must be a string`)
    }
    if (input[field]?.length > 500) {
      throw Errors.badRequest(`${field} must not exceed 500 characters`)
    }
  }

  // Validate tags (optional array of strings)
  if (input.tags) {
    if (!Array.isArray(input.tags)) {
      throw Errors.badRequest('tags must be an array')
    }
    if (!input.tags.every((tag: any) => typeof tag === 'string')) {
      throw Errors.badRequest('all tags must be strings')
    }
    if (input.tags.length > 20) {
      throw Errors.badRequest('maximum 20 tags allowed')
    }
    if (input.tags.some((tag: string) => tag.length > 50)) {
      throw Errors.badRequest('each tag must not exceed 50 characters')
    }
  }

  // Validate category if provided
  if (input.category) {
    const validCategories = ['manga', 'comic', 'illustration', 'concept art', 'fan art', 'other']
    if (!validCategories.includes(input.category.toLowerCase())) {
      throw Errors.badRequest(
        `Invalid category. Must be one of: ${validCategories.join(', ')}`
      )
    }
  }

  return {
    title: input.title,
    description: input.description,
    materials: input.materials,
    dimensions: input.dimensions,
    createdDate: input.createdDate,
    category: input.category,
    tags: input.tags,
    originalKey: input.originalKey,
  }
}

/**
 * Main create artwork function
 * Orchestrates validation, slug generation, image URL generation, and database insert
 */
export async function createArtwork(
  db: D1Database,
  userId: string,
  input: CreateArtworkInput,
  r2BaseUrl: string
): Promise<Artwork> {
  // Check user exists and hasn't exceeded limit
  await checkArtworkLimit(db, userId)

  // Generate unique ID for artwork
  const artworkId = `art_${nanoid(12)}`

  // Generate base slug from title
  const baseSlug = generateSlugFromTitle(input.title)
  if (!baseSlug) {
    throw Errors.badRequest('title must contain at least one letter or number')
  }

  // Make slug unique per user
  const slug = await generateUniqueSlugForUser(db, userId, baseSlug)

  // Generate image URLs from original key
  const imageUrls = generateImageUrls(r2BaseUrl, input.originalKey)

  // Create context for database insertion
  const context: ArtworkCreationContext = {
    userId,
    input,
    artworkId,
    slug,
    imageUrls,
  }

  // Insert into database and return artwork
  return createArtworkInDatabase(db, context)
}
```

**Explanation:**
- `generateSlugFromTitle()` converts titles to URL-safe slugs
- `generateUniqueSlugForUser()` appends numeric suffixes if slug already exists for user
- `checkArtworkLimit()` validates user hasn't exceeded artwork limit
- `generateImageUrls()` creates R2 CDN URLs for different image sizes
- `validateCreateArtworkInput()` validates all input fields
- `createArtwork()` orchestrates the entire creation process

---

### Step 2: Create Artwork Route Handler

Create the HTTP route handler for artwork creation.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/artworks.ts`

```typescript
import type { HonoContext } from '../../../types/env'
import { requireAuth, requireCurrentUser } from '../middleware/auth'
import { Errors } from '../errors'
import {
  validateCreateArtworkInput,
  createArtwork,
  type CreateArtworkInput,
} from '../services/artwork'

/**
 * POST /api/artworks
 * Create a new artwork for the authenticated user
 *
 * Request body:
 * {
 *   "title": "Dragon's Dawn",
 *   "description": "...",
 *   "materials": "...",
 *   "dimensions": "...",
 *   "createdDate": "2024-01",
 *   "category": "illustration",
 *   "tags": ["dragon", "fantasy"],
 *   "originalKey": "originals/user-id/uuid.jpg"
 * }
 *
 * Response: 201 Created
 * {
 *   "data": { artwork object with all fields and image URLs }
 * }
 */
export async function createArtworkHandler(c: HonoContext) {
  try {
    // Require authentication
    const user = requireCurrentUser(c)

    // Parse request body
    const body = await c.req.json().catch(() => ({}))

    // Validate input
    const input = validateCreateArtworkInput(body)

    // Get R2 base URL from environment
    // This should be your Cloudflare R2 public URL
    const r2BaseUrl = c.env.R2_PUBLIC_URL || 'https://r2.example.com'

    // Get database connection
    const db = c.env.DB as any

    if (!db) {
      throw Errors.internal('Database connection not available')
    }

    // Create artwork
    const artwork = await createArtwork(db, user.userId, input, r2BaseUrl)

    // Return created artwork with 201 status
    return c.json(
      {
        data: {
          id: artwork.id,
          userId: artwork.userId,
          slug: artwork.slug,
          title: artwork.title,
          description: artwork.description,
          materials: artwork.materials,
          dimensions: artwork.dimensions,
          createdDate: artwork.createdDate,
          category: artwork.category,
          tags: artwork.tags,
          originalUrl: artwork.originalUrl,
          displayUrl: artwork.displayUrl,
          thumbnailUrl: artwork.thumbnailUrl,
          iconUrl: artwork.iconUrl,
          status: artwork.status,
          isFeatured: artwork.isFeatured,
          createdAt: artwork.createdAt,
          updatedAt: artwork.updatedAt,
        },
      },
      201
    )
  } catch (err) {
    // Let global error handler catch and format errors
    throw err
  }
}

/**
 * Register artwork creation routes
 * Call this function in the main app setup
 */
export function registerArtworkRoutes(app: any) {
  // POST /api/artworks - Create artwork
  app.post('/artworks', requireAuth, createArtworkHandler)
}
```

**Explanation:**
- `createArtworkHandler` validates user authentication, parses request body, validates input
- Calls `createArtwork()` service with user ID and validated input
- Returns 201 Created with complete artwork object including all image URLs
- Global error handler catches validation and business logic errors

---

### Step 3: Register Routes in Main App

Update the main Hono app to register artwork routes.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/index.ts`

Add these lines at the end of the file, before the `export default app`:

```typescript
import { registerArtworkRoutes } from './routes/artworks'

// Register artwork routes
registerArtworkRoutes(app)
```

**Explanation:**
- Imports the artwork route registration function
- Registers all artwork-related routes with the main Hono app

---

### Step 4: Add R2 Base URL to Environment

Update your environment configuration to include the R2 public URL.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/wrangler.toml`

Find the environment variables section and add:

```toml
[env.development]
vars = {
  R2_PUBLIC_URL = "https://your-account-id.r2.cloudflarestorage.com/vfa-gallery-images"
}

[env.production]
vars = {
  R2_PUBLIC_URL = "https://cdn.vfa.gallery"  # or your R2 public domain
}
```

**Explanation:**
- Development uses direct R2 URL
- Production uses CDN domain if configured
- URL is accessible by `c.env.R2_PUBLIC_URL` in handlers

---

### Step 5: Add Type Definition for HonoEnv

Ensure the HonoEnv type includes the R2 public URL variable.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/types/env.ts`

Add or update the HonoEnv interface:

```typescript
export interface HonoEnv {
  Bindings: {
    DB: D1Database
    IMAGE_BUCKET: R2Bucket
    JWT_SECRET: string
    R2_PUBLIC_URL: string
  }
}
```

**Explanation:**
- Extends HonoEnv to include R2_PUBLIC_URL variable
- Provides type safety for accessing environment variables

---

## Files to Create/Modify

**New files to create:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/services/artwork.ts` - Artwork business logic
2. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/artworks.ts` - Route handlers

**Modified files:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/index.ts` - Register routes
2. `/Volumes/DataSSD/gitsrc/vfa_gallery/wrangler.toml` - Add R2_PUBLIC_URL environment variable
3. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/types/env.ts` - Extend HonoEnv type

**Dependencies:**
- `nanoid` - Already installed, for generating unique IDs
- Hono framework (already installed)

---

## Verification

### Test 1: Verify TypeScript Compilation

Run TypeScript compiler to check for type errors:

```bash
npx tsc --noEmit
```

Expected: No type errors.

---

### Test 2: Test Artwork Creation Without Authentication

Send POST request without token:

```bash
curl -X POST http://localhost:8788/api/artworks \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Artwork",
    "originalKey": "originals/user-123/image.jpg"
  }'
```

Expected response (401 Unauthorized):
```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "No authentication token provided"
  }
}
```

---

### Test 3: Test Artwork Creation With Missing Required Fields

First, create a valid JWT token using the test-jwt.js script from build 16.

Then send POST request with missing required fields:

```bash
curl -X POST http://localhost:8788/api/artworks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <valid-token>" \
  -d '{
    "description": "No title here"
  }'
```

Expected response (400 Bad Request):
```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "title is required and must be a string"
  }
}
```

---

### Test 4: Test Successful Artwork Creation

Send valid POST request with all required fields:

```bash
curl -X POST http://localhost:8788/api/artworks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <valid-token>" \
  -d '{
    "title": "Dragon'"'"'s Dawn",
    "description": "A fierce dragon breathing fire at dawn",
    "materials": "Digital, Procreate",
    "dimensions": "3000x4000px",
    "createdDate": "2024-01",
    "category": "illustration",
    "tags": ["dragon", "fantasy"],
    "originalKey": "originals/usr_test123/abc123def456.jpg"
  }'
```

Expected response (201 Created):
```json
{
  "data": {
    "id": "art_abc1234567890",
    "userId": "usr_test123",
    "slug": "dragons-dawn",
    "title": "Dragon's Dawn",
    "description": "A fierce dragon breathing fire at dawn",
    "materials": "Digital, Procreate",
    "dimensions": "3000x4000px",
    "createdDate": "2024-01",
    "category": "illustration",
    "tags": ["dragon", "fantasy"],
    "originalUrl": "https://example.com/originals/usr_test123/abc123def456.jpg",
    "displayUrl": "https://example.com/display/usr_test123/abc123def456.jpg",
    "thumbnailUrl": "https://example.com/thumbs/usr_test123/abc123def456.jpg",
    "iconUrl": "https://example.com/icons/usr_test123/abc123def456.jpg",
    "status": "active",
    "isFeatured": false,
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

---

### Test 5: Test Slug Uniqueness Per User

Create two artworks with the same title:

```bash
# First artwork
curl -X POST http://localhost:8788/api/artworks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <valid-token>" \
  -d '{
    "title": "My Artwork",
    "originalKey": "originals/usr_test123/image1.jpg"
  }'

# Second artwork with same title
curl -X POST http://localhost:8788/api/artworks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <valid-token>" \
  -d '{
    "title": "My Artwork",
    "originalKey": "originals/usr_test123/image2.jpg"
  }'
```

Expected: First returns slug "my-artwork", second returns slug "my-artwork-2".

---

### Test 6: Test Invalid Category

Send POST request with invalid category:

```bash
curl -X POST http://localhost:8788/api/artworks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <valid-token>" \
  -d '{
    "title": "Test",
    "category": "invalid-category",
    "originalKey": "originals/usr_test123/image.jpg"
  }'
```

Expected response (400 Bad Request):
```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "Invalid category. Must be one of: manga, comic, illustration, concept art, fan art, other"
  }
}
```

---

### Test 7: Test Artwork Limit Exceeded

Setup: First update a test user to have artwork_limit = 1:

```bash
wrangler d1 execute vfa-gallery --command="UPDATE users SET artwork_limit = 1 WHERE id = 'usr_limited';"
```

Then try to create 2 artworks with the same user:

```bash
# First artwork (succeeds)
curl -X POST http://localhost:8788/api/artworks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token-for-usr-limited>" \
  -d '{"title": "Artwork 1", "originalKey": "originals/usr_limited/img1.jpg"}'

# Second artwork (should fail)
curl -X POST http://localhost:8788/api/artworks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token-for-usr-limited>" \
  -d '{"title": "Artwork 2", "originalKey": "originals/usr_limited/img2.jpg"}'
```

Expected on second request (400 Bad Request):
```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "Artwork limit (1) exceeded",
    "details": {
      "limit": 1,
      "current": 1
    }
  }
}
```

---

### Test 8: Test Tags Array Validation

Send POST with too many tags:

```bash
curl -X POST http://localhost:8788/api/artworks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <valid-token>" \
  -d '{
    "title": "Test",
    "originalKey": "originals/usr_test123/image.jpg",
    "tags": ["tag1", "tag2", "tag3", "tag4", "tag5", "tag6", "tag7", "tag8", "tag9", "tag10", "tag11", "tag12", "tag13", "tag14", "tag15", "tag16", "tag17", "tag18", "tag19", "tag20", "tag21"]
  }'
```

Expected response (400 Bad Request):
```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "maximum 20 tags allowed"
  }
}
```

---

### Test 9: Verify Artwork Record in Database

Query the database to confirm artwork was created:

```bash
wrangler d1 execute vfa-gallery --command="SELECT id, slug, title, user_id, status FROM artworks WHERE user_id = 'usr_test123' LIMIT 5;"
```

Expected: Shows the created artwork records.

---

### Test 10: Verify All Image URLs Are Populated

Query to confirm all four image URL fields are populated:

```bash
wrangler d1 execute vfa-gallery --command="SELECT original_url, display_url, thumbnail_url, icon_url FROM artworks WHERE id = 'art_abc1234567890';"
```

Expected: All four URL fields contain valid URLs pointing to R2.

---

## Summary

This build creates the artwork creation endpoint with:
- User authentication requirement
- Input validation for all fields
- Automatic unique slug generation per user
- Image URL generation from R2 object keys
- Artwork limit enforcement per user
- Comprehensive error handling
- Proper HTTP status codes (201 for success, 4xx for validation)

The endpoint is ready for integration with the image processing pipeline (build 40) which will handle the actual image file processing when images are uploaded.

---

**Next step:** Proceed to **42-API-ARTWORK-LIST.md** to implement the GET endpoint for listing user's artworks with pagination and filtering.
