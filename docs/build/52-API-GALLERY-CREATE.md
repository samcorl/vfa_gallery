# 52-API-GALLERY-CREATE.md

## Goal

Create the `POST /api/galleries` endpoint to allow authenticated users to create new galleries with automatic slug generation and validation against per-user gallery limits.

---

## Spec Extract

From TECHNICAL-SPEC.md - Gallery CRUD Operations:

- **Endpoint:** `POST /api/galleries`
- **Authentication:** Required (JWT token)
- **Request Body:**
  ```json
  {
    "name": "Fantasy Art",
    "description": "My fantasy artwork collection",
    "welcomeMessage": "Welcome to my fantasy gallery!"
  }
  ```
- **Response (201 Created):**
  ```json
  {
    "data": {
      "id": "gal_abc123def456",
      "userId": "user_xyz789",
      "slug": "fantasy-art",
      "name": "Fantasy Art",
      "description": "My fantasy artwork collection",
      "welcomeMessage": "Welcome to my fantasy gallery!",
      "themeId": null,
      "isDefault": false,
      "status": "active",
      "createdAt": "2026-01-18T12:00:00Z",
      "updatedAt": "2026-01-18T12:00:00Z"
    }
  }
  ```
- **Per-User Gallery Limit:** 500 galleries (configurable by admin)
- **Slug Uniqueness:** Unique per user (not global)
- **Slug Generation:** Auto-generated from name, must be URL-safe

---

## Prerequisites

**Must complete before starting:**
- **15-API-FOUNDATION.md** - Hono router and error handling setup
- **16-API-MIDDLEWARE-AUTH.md** - JWT authentication middleware
- **08-SCHEMA-GALLERIES.md** - Galleries table schema created

---

## Steps

### Step 1: Create Utilities for Slug Generation

Create a utility file for slug generation with conflict detection.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/utils/slug.ts`

```typescript
/**
 * Generate URL-safe slug from text
 * Converts to lowercase, removes special characters, replaces spaces with hyphens
 */
export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-')      // Replace spaces with hyphens
    .replace(/-+/g, '-')       // Replace multiple hyphens with single hyphen
    .replace(/^-+|-+$/g, '')   // Remove leading/trailing hyphens
}

/**
 * Generate unique slug for a user
 * If slug already exists for user, appends a numeric suffix
 * Example: "fantasy-art" -> "fantasy-art-1", "fantasy-art-2", etc.
 */
export async function generateUniqueSlug(
  db: any,
  userId: string,
  baseSlug: string
): Promise<string> {
  // Check if base slug already exists for user
  const existing = await db
    .prepare('SELECT slug FROM galleries WHERE user_id = ? AND slug = ?')
    .bind(userId, baseSlug)
    .first()

  if (!existing) {
    return baseSlug
  }

  // Find next available numbered slug
  let counter = 1
  let candidateSlug = `${baseSlug}-${counter}`

  while (true) {
    const conflict = await db
      .prepare('SELECT slug FROM galleries WHERE user_id = ? AND slug = ?')
      .bind(userId, candidateSlug)
      .first()

    if (!conflict) {
      return candidateSlug
    }

    counter++
    candidateSlug = `${baseSlug}-${counter}`

    // Safety limit to prevent infinite loop
    if (counter > 1000) {
      throw new Error('Unable to generate unique slug after 1000 attempts')
    }
  }
}
```

**Explanation:**
- `generateSlug()` converts text to URL-safe format (lowercase, hyphens instead of spaces)
- `generateUniqueSlug()` checks database for conflicts and appends numeric suffix if needed
- Prevents duplicate slugs for the same user
- Different users can have the same slug

---

### Step 2: Create Gallery Types

Define TypeScript types for gallery API responses.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/types/gallery.ts`

```typescript
/**
 * Gallery type for API responses
 * Matches database schema with camelCase property names
 */
export interface Gallery {
  id: string
  userId: string
  slug: string
  name: string
  description: string | null
  welcomeMessage: string | null
  themeId: string | null
  isDefault: boolean
  status: 'active' | 'archived' | 'draft'
  createdAt: string
  updatedAt: string
}

/**
 * Request body for creating a gallery
 */
export interface CreateGalleryRequest {
  name: string
  description?: string | null
  welcomeMessage?: string | null
}

/**
 * Database row type (snake_case from SQLite)
 */
export interface GalleryRow {
  id: string
  user_id: string
  slug: string
  name: string
  description: string | null
  welcome_message: string | null
  theme_id: string | null
  is_default: number
  status: string
  created_at: string
  updated_at: string
}

/**
 * Transform database row to API response
 */
export function galleryRowToApi(row: GalleryRow): Gallery {
  return {
    id: row.id,
    userId: row.user_id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    welcomeMessage: row.welcome_message,
    themeId: row.theme_id,
    isDefault: row.is_default === 1,
    status: row.status as 'active' | 'archived' | 'draft',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
```

**Explanation:**
- `Gallery` interface is the API response format (camelCase)
- `GalleryRow` matches SQLite schema (snake_case)
- `galleryRowToApi()` transforms database rows to API responses
- `isDefault` converts from INTEGER (0/1) to boolean

---

### Step 3: Create Gallery Routes File

Create the main galleries API routes file.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/galleries.ts`

```typescript
import { Hono } from 'hono'
import { nanoid } from 'nanoid'
import type { HonoEnv } from '../../../types/env'
import { ApiError, Errors } from '../errors'
import { requireAuth } from '../middleware/auth'
import { generateSlug, generateUniqueSlug } from '../utils/slug'
import {
  Gallery,
  CreateGalleryRequest,
  GalleryRow,
  galleryRowToApi,
} from '../../../types/gallery'

// Gallery limits and configuration
const GALLERY_LIMIT_DEFAULT = 500
const GALLERY_NAME_MIN = 1
const GALLERY_NAME_MAX = 255
const GALLERY_DESCRIPTION_MAX = 5000
const GALLERY_MESSAGE_MAX = 1000

export const galleriesRouter = new Hono<HonoEnv>()

/**
 * POST /galleries
 * Create a new gallery for the authenticated user
 */
galleriesRouter.post('/', requireAuth, async (c) => {
  const userId = c.get('userId') as string
  const db = c.env.DB

  // Parse and validate request body
  let body: CreateGalleryRequest
  try {
    body = await c.req.json()
  } catch (err) {
    throw Errors.badRequest('Invalid JSON in request body')
  }

  // Validate required field: name
  if (!body.name) {
    throw Errors.badRequest('Field "name" is required')
  }

  if (typeof body.name !== 'string') {
    throw Errors.badRequest('Field "name" must be a string')
  }

  const name = body.name.trim()

  // Validate name length
  if (name.length < GALLERY_NAME_MIN || name.length > GALLERY_NAME_MAX) {
    throw Errors.badRequest(
      `Gallery name must be between ${GALLERY_NAME_MIN} and ${GALLERY_NAME_MAX} characters`
    )
  }

  // Validate optional description
  const description = body.description ? body.description.trim() : null
  if (description && description.length > GALLERY_DESCRIPTION_MAX) {
    throw Errors.badRequest(
      `Description must not exceed ${GALLERY_DESCRIPTION_MAX} characters`
    )
  }

  // Validate optional welcome message
  const welcomeMessage = body.welcomeMessage ? body.welcomeMessage.trim() : null
  if (welcomeMessage && welcomeMessage.length > GALLERY_MESSAGE_MAX) {
    throw Errors.badRequest(
      `Welcome message must not exceed ${GALLERY_MESSAGE_MAX} characters`
    )
  }

  // Check gallery count for user
  const countResult = await db
    .prepare('SELECT COUNT(*) as count FROM galleries WHERE user_id = ?')
    .bind(userId)
    .first<{ count: number }>()

  const currentCount = countResult?.count || 0

  if (currentCount >= GALLERY_LIMIT_DEFAULT) {
    throw new ApiError(
      409,
      'GALLERY_LIMIT_EXCEEDED',
      `You have reached the maximum number of galleries (${GALLERY_LIMIT_DEFAULT})`
    )
  }

  // Generate slug from name
  const baseSlug = generateSlug(name)
  if (!baseSlug) {
    throw Errors.badRequest(
      'Gallery name must contain at least one alphanumeric character'
    )
  }

  // Ensure slug is unique for this user
  const slug = await generateUniqueSlug(db, userId, baseSlug)

  // Generate gallery ID
  const galleryId = `gal_${nanoid()}`

  // Create gallery record
  const now = new Date().toISOString()

  try {
    await db
      .prepare(
        `INSERT INTO galleries (id, user_id, slug, name, description, welcome_message, theme_id, is_default, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        galleryId,
        userId,
        slug,
        name,
        description,
        welcomeMessage,
        null, // theme_id
        0,    // is_default
        'active',
        now,
        now
      )
      .run()
  } catch (err: any) {
    console.error('[Gallery Create Error]', err)

    // Check for UNIQUE constraint violation (slug already exists)
    if (err.message?.includes('UNIQUE constraint failed')) {
      throw Errors.conflict(
        'A gallery with this name already exists for your account'
      )
    }

    throw Errors.internal('Failed to create gallery', { originalError: err.message })
  }

  // Fetch and return created gallery
  const createdRow = await db
    .prepare('SELECT * FROM galleries WHERE id = ?')
    .bind(galleryId)
    .first<GalleryRow>()

  if (!createdRow) {
    throw Errors.internal('Failed to retrieve created gallery')
  }

  const gallery = galleryRowToApi(createdRow)

  return c.json({ data: gallery }, 201)
})

export default galleriesRouter
```

**Explanation:**
- Validates required field `name` and optional fields `description` and `welcomeMessage`
- Enforces field length limits
- Checks if user has exceeded gallery limit (500)
- Generates URL-safe slug from name
- Ensures slug uniqueness per user
- Uses `nanoid()` for gallery ID generation
- Sets timestamps and default status
- Returns 201 Created with full gallery object
- Detailed error messages for validation failures

---

### Step 4: Register Gallery Routes in Main API

Add the galleries router to the main Hono app.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/index.ts`

Update the imports and routing section:

```typescript
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { HonoEnv } from '../../types/env'
import { apiErrorHandler } from './errors'
import { galleriesRouter } from './routes/galleries'  // Add this import

// Initialize Hono app with strict typing
export const app = new Hono<HonoEnv>()

// ... CORS middleware setup (unchanged) ...

// Health check endpoint
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Mount galleries routes
app.route('/galleries', galleriesRouter)  // Add this line

// Global error handler (must be last)
app.onError(apiErrorHandler)

export default app
```

**Explanation:**
- Imports the galleries router
- Mounts it at `/galleries` path, making routes accessible at `/api/galleries/*`
- Router inherits auth middleware and error handling from main app

---

### Step 5: Install nanoid Dependency

Add nanoid package for ID generation:

```bash
npm install nanoid
```

Verify installation:

```bash
npm list nanoid
```

Expected output: `nanoid@latest` or current version

---

## Files to Create/Modify

**New files to create:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/utils/slug.ts`
2. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/types/gallery.ts`
3. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/galleries.ts`

**Modified files:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/index.ts` - Add galleries router import and route mounting
2. `/Volumes/DataSSD/gitsrc/vfa_gallery/package.json` - Add `nanoid` dependency (via `npm install`)

---

## Verification

### Test 1: Verify Dependencies

```bash
npm list hono nanoid
```

Expected: Both `hono` and `nanoid` listed without errors

---

### Test 2: Verify TypeScript Compilation

```bash
npx tsc --noEmit
```

Expected: No errors

---

### Test 3: Create a Gallery (Missing Authentication)

Start the development server:

```bash
npx wrangler pages dev
```

In another terminal:

```bash
curl -X POST http://localhost:8788/api/galleries \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Fantasy Art",
    "description": "My fantasy artwork"
  }'
```

Expected response (401):
```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required"
  }
}
```

---

### Test 4: Create a Gallery (With Authentication)

First, obtain a valid JWT token from the authentication endpoint (requires completing 16-API-MIDDLEWARE-AUTH.md). Assuming you have a valid token:

```bash
curl -X POST http://localhost:8788/api/galleries \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>" \
  -d '{
    "name": "Fantasy Art",
    "description": "My fantasy artwork collection",
    "welcomeMessage": "Welcome to my fantasy gallery!"
  }'
```

Expected response (201):
```json
{
  "data": {
    "id": "gal_abc123def456",
    "userId": "user_xyz789",
    "slug": "fantasy-art",
    "name": "Fantasy Art",
    "description": "My fantasy artwork collection",
    "welcomeMessage": "Welcome to my fantasy gallery!",
    "themeId": null,
    "isDefault": false,
    "status": "active",
    "createdAt": "2026-01-18T12:00:00.000Z",
    "updatedAt": "2026-01-18T12:00:00.000Z"
  }
}
```

---

### Test 5: Slug Generation

Create multiple galleries and verify slug generation:

```bash
# First gallery
curl -X POST http://localhost:8788/api/galleries \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>" \
  -d '{"name": "Fantasy Art"}'

# Second gallery with same name (should get slug with suffix)
curl -X POST http://localhost:8788/api/galleries \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>" \
  -d '{"name": "Fantasy Art"}'
```

Expected slugs:
- First: `"slug": "fantasy-art"`
- Second: `"slug": "fantasy-art-1"`

---

### Test 6: Slug Special Characters

Create gallery with special characters in name:

```bash
curl -X POST http://localhost:8788/api/galleries \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>" \
  -d '{"name": "Fantasy & Art (2025)"}'
```

Expected: `"slug": "fantasy-art-2025"` (special characters removed, spaces converted to hyphens)

---

### Test 7: Validation - Missing Name Field

```bash
curl -X POST http://localhost:8788/api/galleries \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>" \
  -d '{"description": "No name provided"}'
```

Expected response (400):
```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "Field \"name\" is required"
  }
}
```

---

### Test 8: Validation - Name Too Long

```bash
curl -X POST http://localhost:8788/api/galleries \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>" \
  -d '{"name": "'$(printf 'A%.0s' {1..256})'"}'
```

Expected response (400):
```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "Gallery name must be between 1 and 255 characters"
  }
}
```

---

### Test 9: Validation - Invalid JSON

```bash
curl -X POST http://localhost:8788/api/galleries \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>" \
  -d 'invalid json'
```

Expected response (400):
```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "Invalid JSON in request body"
  }
}
```

---

### Test 10: Gallery Limit (After Creating 500 Galleries)

This test requires creating 500 galleries programmatically or using a script. After reaching the limit:

```bash
curl -X POST http://localhost:8788/api/galleries \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>" \
  -d '{"name": "Gallery 501"}'
```

Expected response (409):
```json
{
  "error": {
    "code": "GALLERY_LIMIT_EXCEEDED",
    "message": "You have reached the maximum number of galleries (500)"
  }
}
```

---

### Test 11: Database Verification

Verify gallery was created in database:

```bash
wrangler d1 execute vfa-gallery --command="SELECT * FROM galleries ORDER BY created_at DESC LIMIT 1;"
```

Expected: Shows the created gallery with all fields properly stored

---

## Success Criteria

- [ ] All files created with correct paths
- [ ] nanoid dependency installed
- [ ] TypeScript compilation succeeds
- [ ] POST /api/galleries endpoint responds with 401 without authentication
- [ ] POST /api/galleries endpoint creates gallery and returns 201 with authenticated request
- [ ] Slug is generated correctly from gallery name
- [ ] Slug conflicts are handled with numeric suffix
- [ ] Special characters in name are removed from slug
- [ ] Gallery limit (500) is enforced
- [ ] Validation errors return 400 with descriptive messages
- [ ] Gallery record is created in database with correct fields
- [ ] Gallery ID is unique (uses nanoid)
- [ ] Created/updated timestamps are set to current time
- [ ] New galleries default to status 'active' and isDefault false

---

## Next Steps

Once this build is verified, proceed to **53-API-GALLERY-LIST.md** to add pagination and listing functionality for user galleries.

