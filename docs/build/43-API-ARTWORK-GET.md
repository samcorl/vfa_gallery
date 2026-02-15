# 43-API-ARTWORK-GET.md

## Goal
Implement the GET `/api/artworks/:id` endpoint that retrieves a single artwork by ID with authorization checks, optional collection associations, and returns 404 for unauthorized access to private artworks.

---

## Spec Extract

From TECHNICAL-SPEC.md:
- **Privacy**: Only usernames visible publicly, access control by ownership or public status
- **Status Values**: 'active' (public), 'draft' (private), 'deleted' (soft delete)
- **Collections**: Artworks can belong to multiple collections

Endpoint: `GET /api/artworks/:id`

Query parameters:
- `include=collections` (optional) - Include collection associations in response

Request examples:
```
GET /api/artworks/art_abc123
GET /api/artworks/art_abc123?include=collections
```

Response schema:
```json
{
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
  "imageKey": "artworks/art_abc123/original.png",
  "displayUrl": "https://cdn.vfa.gallery/display/...",
  "thumbnailUrl": "https://cdn.vfa.gallery/thumbnails/...",
  "iconUrl": "https://cdn.vfa.gallery/icons/...",
  "status": "active",
  "isPublic": true,
  "isFeatured": false,
  "collections": [
    {
      "id": "col_123",
      "slug": "fantasy-art",
      "title": "Fantasy Art Collection"
    }
  ],
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

Authorization rules:
- Owner (user_id matches currentUserId) can see all statuses
- Non-owner can only see 'active' status + is_public=1 artworks
- Deleted artworks return 404 to all users

---

## Prerequisites

**Must complete before starting:**
- **41-API-ARTWORK-CREATE.md** - Artwork creation endpoint and schema
- **16-API-MIDDLEWARE-AUTH.md** - Authentication middleware with `requireAuth` and `getCurrentUser`
- **09-SCHEMA-COLLECTIONS.md** - Collection schema
- **D1 Database** - Artworks and collections tables configured

---

## Steps

### Step 1: Add GET Endpoint to Artworks Router

Add the GET handler to the existing artworks router. This is the core endpoint implementation.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/artworks.ts` (Update existing file)

Add this handler function to the router:

```typescript
import { Hono } from 'hono'
import type { HonoEnv } from '../../../types/env'
import { Errors } from '../errors'
import { requireAuth } from '../middleware/auth'
import { getCurrentUser } from '../middleware/auth'
import {
  getThumbnailUrl,
  getIconUrl,
  getDisplayUrl
} from '../../utils/imageUrls'

const artworks = new Hono<{ Bindings: HonoEnv }>()

/**
 * GET /:id
 * Retrieve a single artwork by ID
 *
 * Query parameters:
 * - include=collections (optional) - Include collection associations
 *
 * Response codes:
 * - 200: Artwork found and authorized to access
 * - 401: Authentication required
 * - 404: Artwork not found or not authorized to access
 * - 500: Server error
 */
artworks.get('/:id', requireAuth, async (c) => {
  try {
    const artworkId = c.req.param('id')
    const includeCollections = c.req.query('include') === 'collections'

    if (!artworkId) {
      return c.json(
        Errors.BadRequest('Missing artwork ID'),
        400
      )
    }

    const db = c.env.DB
    const currentUser = await getCurrentUser(c)
    const currentUserId = currentUser?.id || null

    // Fetch artwork from database
    const artwork = await db
      .prepare(
        `SELECT
           id, user_id, slug, title, description, materials, dimensions,
           created_date, category, tags, image_key, status, is_public,
           is_featured, created_at, updated_at
         FROM artworks
         WHERE id = ?
         LIMIT 1`
      )
      .bind(artworkId)
      .first()

    if (!artwork) {
      return c.json(
        Errors.NotFound('Artwork not found'),
        404
      )
    }

    // Check authorization
    const isOwner = currentUserId && artwork.user_id === currentUserId
    const isDeleted = artwork.status === 'deleted'
    const isAccessible = isOwner || (artwork.status === 'active' && artwork.is_public === 1)

    if (!isAccessible || isDeleted) {
      return c.json(
        Errors.NotFound('Artwork not found'),
        404
      )
    }

    // Format artwork response with generated URLs
    const imageKey = artwork.image_key as string
    let response: any = {
      id: artwork.id,
      userId: artwork.user_id,
      slug: artwork.slug,
      title: artwork.title,
      description: artwork.description,
      materials: artwork.materials,
      dimensions: artwork.dimensions,
      createdDate: artwork.created_date,
      category: artwork.category,
      tags: artwork.tags ? JSON.parse(artwork.tags as string) : null,
      imageKey: imageKey,
      displayUrl: getDisplayUrl(imageKey),
      thumbnailUrl: getThumbnailUrl(imageKey),
      iconUrl: getIconUrl(imageKey),
      status: artwork.status,
      isPublic: artwork.is_public === 1,
      isFeatured: artwork.is_featured === 1,
      createdAt: artwork.created_at,
      updatedAt: artwork.updated_at
    }

    // Fetch collections if requested
    if (includeCollections) {
      const collections = await db
        .prepare(
          `SELECT c.id, c.slug, c.title
           FROM collections c
           INNER JOIN collection_artworks ca ON c.id = ca.collection_id
           WHERE ca.artwork_id = ?
           ORDER BY c.title ASC`
        )
        .bind(artworkId)
        .all()

      response.collections = collections.results || []
    } else {
      response.collections = []
    }

    return c.json(response, 200)
  } catch (error) {
    console.error('Error in GET /api/artworks/:id:', error)
    return c.json(
      Errors.InternalServerError('Failed to fetch artwork'),
      500
    )
  }
})

export default artworks
```

---

## Files to Create/Modify

| Path | Type | Purpose |
|------|------|---------|
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/artworks.ts` | Modify | Add GET /:id handler |

---

## Verification

### Test 1: Get Artwork as Owner
```bash
# Owner retrieves their own artwork
curl -X GET http://localhost:8787/api/artworks/art_abc123 \
  -H "Authorization: Bearer <owner-token>"

# Expected: 200 OK with full artwork data
# {
#   "id": "art_abc123",
#   "userId": "usr_owner123",
#   "title": "Dragon's Dawn",
#   "displayUrl": "https://cdn.vfa.gallery/display/...",
#   "thumbnailUrl": "https://cdn.vfa.gallery/thumbnails/...",
#   "collections": []
# }
```

### Test 2: Get Active Public Artwork as Non-Owner
```bash
# Non-owner retrieves public artwork
curl -X GET http://localhost:8787/api/artworks/art_public123 \
  -H "Authorization: Bearer <user-token>"

# Expected: 200 OK if status='active' and is_public=1
```

### Test 3: Get Draft Artwork as Non-Owner
```bash
# Non-owner tries to retrieve draft artwork
curl -X GET http://localhost:8787/api/artworks/art_draft123 \
  -H "Authorization: Bearer <user-token>"

# Expected: 404 Not Found
```

### Test 4: Get Deleted Artwork
```bash
# Any user tries to get deleted artwork (even owner)
curl -X GET http://localhost:8787/api/artworks/art_deleted123 \
  -H "Authorization: Bearer <owner-token>"

# Expected: 404 Not Found
```

### Test 5: Get Artwork Without Authentication
```bash
# Unauthenticated request
curl -X GET http://localhost:8787/api/artworks/art_abc123

# Expected: 401 Unauthorized (requireAuth middleware)
```

### Test 6: With Collections
```bash
# Get artwork with associated collections
curl -X GET "http://localhost:8787/api/artworks/art_abc123?include=collections" \
  -H "Authorization: Bearer <token>"

# Expected: 200 OK with collections array populated
# {
#   "id": "art_abc123",
#   "collections": [
#     { "id": "col_123", "slug": "fantasy", "title": "Fantasy Art" }
#   ],
#   ...
# }
```

### Test 7: Nonexistent Artwork
```bash
curl -X GET http://localhost:8787/api/artworks/art_nonexistent \
  -H "Authorization: Bearer <token>"

# Expected: 404 Not Found
```

### Test 8: Owner Accessing Own Draft
```bash
# Owner retrieves their own draft artwork
curl -X GET http://localhost:8787/api/artworks/art_draft_own \
  -H "Authorization: Bearer <owner-token>"

# Expected: 200 OK (owner can access their own drafts)
```

### Test 9: Image URLs Generated Correctly
```bash
# Verify image URLs are generated from image_key
curl -X GET http://localhost:8787/api/artworks/art_abc123 \
  -H "Authorization: Bearer <token>" | jq '.imageKey, .displayUrl, .thumbnailUrl, .iconUrl'

# Expected: imageKey present, and all URLs properly generated
# "artworks/art_abc123/original.png"
# "https://cdn.vfa.gallery/display/artworks/art_abc123/original.png"
# "https://cdn.vfa.gallery/thumbnails/artworks/art_abc123/original.png"
# "https://cdn.vfa.gallery/icons/artworks/art_abc123/original.png"
```

---

## Notes

- **Authentication Required**: All requests must include valid Bearer token via `requireAuth` middleware
- **Authorization Model**: Owner sees all statuses; non-owner sees only 'active' + is_public=1
- **Soft Deletes**: Deleted artworks return 404 to all users including owners (design choice)
- **Database Columns**: Uses `image_key` (stores key, not URL), `status`, `is_public` flags
- **URL Generation**: Display, thumbnail, and icon URLs generated at response time using utility functions
- **Image Key Format**: Typically `artworks/{artworkId}/original.{ext}`
- **Collections Lazy Loading**: Collections fetched separately to avoid N+1; only included when requested via query param
- **Performance**: Add database index on (user_id, slug, status, is_public) for faster queries
- **Error Handling**: Uses `Errors` factory for consistent error responses
- **Type Safety**: Leverages `HonoEnv` type for proper D1 database access

---

## Related Builds

- **41-API-ARTWORK-CREATE.md** - Creates artworks
- **42-API-ARTWORK-UPDATE.md** - Updates artworks
- **44-API-ARTWORK-DELETE.md** - Deletes artworks
- **16-API-MIDDLEWARE-AUTH.md** - Authentication and authorization
