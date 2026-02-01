# 63-API-COLLECTION-CREATE.md

## Goal
Create the `POST /api/galleries/:galleryId/collections` endpoint that allows authenticated users to create a new collection in a gallery they own. Collections are organizational containers within galleries that group related artworks with consistent themes or presentations.

---

## Spec Extract

From TECHNICAL-SPEC.md and Phase 12 requirements:
- **Authentication**: JWT token required (authentication middleware)
- **Ownership Check**: User must own the gallery to create collections in it
- **Per-User Limit**: User cannot exceed 1,000 total collections
- **Collection Slug**: Auto-generated from name, must be unique within that gallery
- **Default Collection**: First collection in a gallery can be marked as default
- **Request Body**:
  ```json
  {
    "name": "Dragon Series",
    "description": "All my dragon artwork"
  }
  ```
- **Response**: Returns newly created collection object with all fields populated

---

## Prerequisites

**Must complete before starting:**
- **15-API-FOUNDATION.md** - Hono app and error handling
- **16-API-MIDDLEWARE-AUTH.md** - Authentication middleware
- **09-SCHEMA-COLLECTIONS.md** - Collections table exists in database
- **54-API-GALLERY-CREATE.md** - Gallery creation endpoint (for context)
- **56-API-GALLERY-GET.md** - Gallery retrieval endpoint (for context)

---

## Steps

### Step 1: Create Collection ID Generation Utility

Create a utility module for generating collection identifiers and slugs.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/utils/id-generator.ts`

```typescript
import { nanoid } from 'nanoid'

/**
 * Generate a unique collection ID with 'col_' prefix
 * Example: col_abc123def456
 */
export function generateCollectionId(): string {
  return `col_${nanoid(12)}`
}

/**
 * Generate a URL-friendly slug from name
 * Rules:
 * - Lowercase
 * - Replace spaces and special chars with hyphens
 * - Remove consecutive hyphens
 * - Trim hyphens from start/end
 * - Max 50 chars
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Remove consecutive hyphens
    .replace(/^-+|-+$/g, '') // Trim hyphens from start/end
    .slice(0, 50)
}
```

Install nanoid if not already present:

```bash
npm install nanoid
```

---

### Step 2: Create Collection Service Module

Create business logic for collection operations.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/services/collection.service.ts`

```typescript
import type { Database } from '@cloudflare/workers-types'
import { generateCollectionId, generateSlug } from '../utils/id-generator'
import { Errors } from '../errors'

export interface CreateCollectionInput {
  name: string
  description?: string
}

export interface Collection {
  id: string
  gallery_id: string
  slug: string
  name: string
  description?: string
  hero_image_url?: string
  theme_id?: string
  is_default: number
  status: string
  created_at: string
  updated_at: string
}

/**
 * Check if user has already created the maximum number of collections
 */
export async function checkCollectionLimit(
  db: Database,
  userId: string,
  limit: number = 1000
): Promise<boolean> {
  const result = await db
    .prepare(
      `
      SELECT COUNT(*) as count
      FROM collections c
      JOIN galleries g ON c.gallery_id = g.id
      WHERE g.user_id = ?
      `
    )
    .bind(userId)
    .first<{ count: number }>()

  if (!result) {
    throw Errors.internal('Failed to check collection limit')
  }

  return result.count >= limit
}

/**
 * Verify user owns the gallery
 */
export async function verifyGalleryOwnership(
  db: Database,
  galleryId: string,
  userId: string
): Promise<boolean> {
  const gallery = await db
    .prepare('SELECT user_id FROM galleries WHERE id = ?')
    .bind(galleryId)
    .first<{ user_id: string }>()

  if (!gallery) {
    throw Errors.notFound('Gallery not found')
  }

  return gallery.user_id === userId
}

/**
 * Generate a unique slug for the collection within the gallery
 * If slug already exists, append incrementing number
 */
export async function generateUniqueSlug(
  db: Database,
  galleryId: string,
  name: string
): Promise<string> {
  let slug = generateSlug(name)

  if (!slug || slug.length === 0) {
    slug = 'untitled-collection'
  }

  // Check if slug already exists in this gallery
  let counter = 1
  let finalSlug = slug
  let maxAttempts = 100

  while (maxAttempts > 0) {
    const existing = await db
      .prepare(
        `
        SELECT id FROM collections
        WHERE gallery_id = ? AND slug = ?
        LIMIT 1
        `
      )
      .bind(galleryId, finalSlug)
      .first<{ id: string }>()

    if (!existing) {
      return finalSlug
    }

    counter++
    finalSlug = `${slug}-${counter}`
    maxAttempts--
  }

  throw Errors.internal('Could not generate unique collection slug')
}

/**
 * Create a new collection in the database
 */
export async function createCollection(
  db: Database,
  galleryId: string,
  input: CreateCollectionInput,
  userId: string
): Promise<Collection> {
  // Verify ownership
  const ownsGallery = await verifyGalleryOwnership(db, galleryId, userId)
  if (!ownsGallery) {
    throw Errors.forbidden('You do not own this gallery')
  }

  // Check collection limit
  const exceedsLimit = await checkCollectionLimit(db, userId)
  if (exceedsLimit) {
    throw Errors.conflict('Collection limit exceeded (max 1,000 per user)')
  }

  // Generate unique slug
  const slug = await generateUniqueSlug(db, galleryId, input.name)

  // Generate ID
  const id = generateCollectionId()
  const now = new Date().toISOString()

  // Insert collection
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
      id,
      galleryId,
      slug,
      input.name,
      input.description || null,
      0, // is_default starts as false
      'active', // status
      now,
      now
    )
    .run()

  // Return the created collection
  const collection = await db
    .prepare('SELECT * FROM collections WHERE id = ?')
    .bind(id)
    .first<Collection>()

  if (!collection) {
    throw Errors.internal('Failed to retrieve created collection')
  }

  return collection
}
```

---

### Step 3: Create Collection Create API Route

Create the route handler for creating collections.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/collections.ts`

```typescript
import type { HonoContext } from '../../../types/env'
import { Errors } from '../errors'
import { requireCurrentUser } from '../middleware/auth'
import {
  createCollection,
  type CreateCollectionInput,
  type Collection,
} from '../services/collection.service'

/**
 * POST /api/galleries/:galleryId/collections
 * Create a new collection in the specified gallery
 *
 * Authentication: Required
 * Body: { name: string, description?: string }
 * Response: { data: Collection }
 */
export async function handleCreateCollection(c: HonoContext) {
  try {
    const user = requireCurrentUser(c)
    const galleryId = c.req.param('galleryId')

    if (!galleryId) {
      throw Errors.badRequest('Gallery ID is required')
    }

    // Parse and validate request body
    const body = await c.req.json()

    if (!body.name || typeof body.name !== 'string') {
      throw Errors.badRequest('Collection name is required and must be a string')
    }

    if (body.name.trim().length === 0) {
      throw Errors.badRequest('Collection name cannot be empty')
    }

    if (body.name.length > 255) {
      throw Errors.badRequest('Collection name must be 255 characters or less')
    }

    if (body.description && typeof body.description !== 'string') {
      throw Errors.badRequest('Description must be a string')
    }

    if (body.description && body.description.length > 1000) {
      throw Errors.badRequest('Description must be 1,000 characters or less')
    }

    const input: CreateCollectionInput = {
      name: body.name.trim(),
      description: body.description ? body.description.trim() : undefined,
    }

    // Create collection using service
    const db = c.env.DB
    const collection = await createCollection(db, galleryId, input, user.userId)

    // Return created collection with 201 Created status
    return c.json(
      {
        data: collection,
      },
      201
    )
  } catch (err) {
    if (err instanceof Error) {
      throw err
    }
    throw Errors.internal('Failed to create collection')
  }
}
```

---

### Step 4: Register Collection Routes

Add the collection routes to the main Hono app.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/index.ts`

Update this file to include the collection routes. Find the existing app setup and add:

```typescript
import { requireAuth } from './middleware/auth'
import { handleCreateCollection } from './routes/collections'

// ... existing code ...

// Collection routes
app.post('/galleries/:galleryId/collections', requireAuth, handleCreateCollection)
```

If this file doesn't have route registrations yet, add this section before the error handler:

```typescript
// ============================================
// Collection Routes (Phase 12)
// ============================================

app.post('/galleries/:galleryId/collections', requireAuth, handleCreateCollection)
```

---

### Step 5: Update Types

Ensure the environment types include Database support.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/types/env.ts`

Add or verify this type exists:

```typescript
import type { Context } from 'hono'

export interface HonoEnv {
  Bindings: {
    DB: Database
    BUCKET: R2Bucket
    JWT_SECRET: string
    ENVIRONMENT: 'development' | 'staging' | 'production'
  }
}

export type HonoContext = Context<HonoEnv>
```

---

## Files to Create/Modify

**New files to create:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/utils/id-generator.ts`
2. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/services/collection.service.ts`
3. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/collections.ts`

**Modified files:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/index.ts` - Register POST collection route

**Dependencies:**
- `nanoid` - For unique ID generation (npm install nanoid)

---

## Verification

### Test 1: Route Compiles

Verify TypeScript compilation:

```bash
cd /Volumes/DataSSD/gitsrc/vfa_gallery
npx tsc --noEmit
```

Expected: No type errors

---

### Test 2: Create Collection (Success Case)

First, you need a valid JWT token and gallery ID. Create test data:

```bash
# Start the development server
npx wrangler pages dev
```

In another terminal, create a test user and gallery (using test tokens or direct DB access), then:

```bash
curl -X POST http://localhost:8788/api/galleries/gal_test123/collections \
  -H "Authorization: Bearer <valid-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Dragon Series",
    "description": "All my dragon artwork"
  }'
```

Expected response (201):
```json
{
  "data": {
    "id": "col_abc123def456",
    "gallery_id": "gal_test123",
    "slug": "dragon-series",
    "name": "Dragon Series",
    "description": "All my dragon artwork",
    "hero_image_url": null,
    "theme_id": null,
    "is_default": 0,
    "status": "active",
    "created_at": "2026-01-18T20:00:00.000Z",
    "updated_at": "2026-01-18T20:00:00.000Z"
  }
}
```

---

### Test 3: Create Collection Without Auth

```bash
curl -X POST http://localhost:8788/api/galleries/gal_test123/collections \
  -H "Content-Type: application/json" \
  -d '{"name": "Test"}'
```

Expected response (401):
```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "No authentication token provided"
  }
}
```

---

### Test 4: Create Collection Without Name

```bash
curl -X POST http://localhost:8788/api/galleries/gal_test123/collections \
  -H "Authorization: Bearer <valid-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{"description": "No name provided"}'
```

Expected response (400):
```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "Collection name is required and must be a string"
  }
}
```

---

### Test 5: Create Collection in Non-Owned Gallery

Using a valid token from User B, attempt to create collection in User A's gallery:

```bash
curl -X POST http://localhost:8788/api/galleries/user-a-gallery-id/collections \
  -H "Authorization: Bearer <user-b-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "Unauthorized Collection"}'
```

Expected response (403):
```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "You do not own this gallery"
  }
}
```

---

### Test 6: Create Collection with Non-Existent Gallery

```bash
curl -X POST http://localhost:8788/api/galleries/nonexistent-gallery/collections \
  -H "Authorization: Bearer <valid-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Collection"}'
```

Expected response (404):
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Gallery not found"
  }
}
```

---

### Test 7: Collection Slug Generation

Create two collections with similar names to verify slug uniqueness:

First:
```bash
curl -X POST http://localhost:8788/api/galleries/gal_test123/collections \
  -H "Authorization: Bearer <valid-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "Dragon Series"}'
```

Response includes `"slug": "dragon-series"`

Then create another:
```bash
curl -X POST http://localhost:8788/api/galleries/gal_test123/collections \
  -H "Authorization: Bearer <valid-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "Dragon Series"}'
```

Expected: Second collection gets `"slug": "dragon-series-2"` (different from first)

---

### Test 8: Verify Slug Uniqueness Per Gallery

Create a collection in Gallery A with slug "featured", then in Gallery B:

```bash
curl -X POST http://localhost:8788/api/galleries/gal_gallery-b/collections \
  -H "Authorization: Bearer <valid-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "Featured Works"}'
```

Expected: Also gets `"slug": "featured"` (allowed because different gallery)

---

### Test 9: Collection Limit (1000 per user)

Create 999 collections successfully in various galleries, then try the 1000th:

```bash
# The 1000th attempt should fail
curl -X POST http://localhost:8788/api/galleries/gal_test123/collections \
  -H "Authorization: Bearer <valid-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "Over Limit Collection"}'
```

Expected response (409):
```json
{
  "error": {
    "code": "CONFLICT",
    "message": "Collection limit exceeded (max 1,000 per user)"
  }
}
```

---

### Test 10: Verify Collection in Database

Query the database directly:

```bash
wrangler d1 execute site --command="SELECT * FROM collections WHERE name='Dragon Series' LIMIT 1;"
```

Confirm: All fields are populated correctly with appropriate defaults (is_default=0, status='active')

---

## Summary

This build creates the foundation for the Collection CRUD API:
- Collection creation with ownership verification
- Per-user collection limit enforcement (1,000)
- Automatic slug generation with uniqueness per gallery
- Proper error handling and validation
- Full TypeScript type safety

The endpoint is now ready for listing, retrieving, updating, and deleting collections in subsequent builds.

---

**Next step:** Proceed to **64-API-COLLECTION-LIST.md** to add collection listing functionality.
