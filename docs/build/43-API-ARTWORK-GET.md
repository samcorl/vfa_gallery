# 43-API-ARTWORK-GET.md

## Goal
Implement the GET `/api/artworks/:id` endpoint that retrieves a single artwork by ID with authorization checks, includes all associated collections, and returns 404 for unauthorized access to private artworks.

---

## Spec Extract

From TECHNICAL-SPEC.md:
- **URL Structure**: `/{artist-slug}/{gallery-slug}/{collection-slug}/{artwork-slug}` (public view)
- **Privacy**: Only usernames visible publicly, access control by ownership or public status
- **Status Values**: 'active' (public), 'draft' (private), 'deleted' (soft delete)
- **Collections**: Artworks can belong to multiple collections

From BUILD INDEX:
- Build 41: Artwork creation endpoint (prerequisite)
- Build 40: Image pipeline orchestration (prerequisite for understanding artwork structure)

Request examples:
```
GET /api/artworks/art_abc123
GET /api/artworks/art_abc123?include=collections
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
    "originalUrl": "https://cdn.vfa.gallery/originals/...",
    "displayUrl": "https://cdn.vfa.gallery/display/...",
    "thumbnailUrl": "https://cdn.vfa.gallery/thumbnails/...",
    "iconUrl": "https://cdn.vfa.gallery/icons/...",
    "status": "active",
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
}
```

---

## Prerequisites

**Must complete before starting:**
- **41-API-ARTWORK-CREATE.md** - Artwork creation endpoint and schema
- **16-API-MIDDLEWARE-AUTH.md** - Authentication middleware
- **09-SCHEMA-COLLECTIONS.md** - Collection schema

---

## Steps

### Step 1: Create Artwork Query Service

Create a service module for artwork queries with authorization logic.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/services/artworkQuery.ts`

```typescript
import type { D1Database } from '@cloudflare/workers-types'

/**
 * Artwork query result with collections
 */
export interface ArtworkWithCollections {
  id: string
  userId: string
  slug: string
  title: string
  description: string | null
  materials: string | null
  dimensions: string | null
  createdDate: string | null
  category: string | null
  tags: string[] | null
  originalUrl: string
  displayUrl: string
  thumbnailUrl: string
  iconUrl: string
  status: string
  isFeatured: boolean
  collections: Array<{
    id: string
    slug: string
    title: string
  }>
  createdAt: string
  updatedAt: string
}

/**
 * Authorization result
 */
export interface AuthorizationResult {
  allowed: boolean
  reason?: string
}

/**
 * Artwork query service
 */
export class ArtworkQueryService {
  private db: D1Database

  constructor(db: D1Database) {
    this.db = db
  }

  /**
   * Get artwork by ID with authorization check
   *
   * Authorization rules:
   * - Owner (user_id matches currentUserId) can always access
   * - Non-owner can only access if status = 'active'
   * - Deleted artworks (status = 'deleted') return 404
   *
   * @param artworkId - The artwork ID to retrieve
   * @param currentUserId - ID of user making request (null if not authenticated)
   * @param includeCollections - Whether to include collection associations
   * @returns Artwork data with authorization applied, or null if not found/unauthorized
   */
  async getArtworkById(
    artworkId: string,
    currentUserId: string | null,
    includeCollections: boolean = true
  ): Promise<ArtworkWithCollections | null> {
    try {
      // Query artwork by ID
      const artwork = await this.db
        .prepare(
          `SELECT
             id, user_id, slug, title, description, materials, dimensions,
             created_date, category, tags, original_url, display_url,
             thumbnail_url, icon_url, status, is_featured, created_at, updated_at
           FROM artworks
           WHERE id = ?
           LIMIT 1`
        )
        .bind(artworkId)
        .first()

      if (!artwork) {
        return null
      }

      // Check authorization
      const auth = this.checkAuthorization(artwork, currentUserId)
      if (!auth.allowed) {
        return null
      }

      // Parse and format response
      let result = this.formatArtwork(artwork)

      // Include collections if requested
      if (includeCollections) {
        result.collections = await this.getArtworkCollections(artworkId)
      }

      return result
    } catch (error) {
      console.error('Error fetching artwork:', error)
      throw error
    }
  }

  /**
   * Get artwork by slug within user's galleries
   * Used for public gallery/collection URLs
   *
   * @param artworkSlug - The artwork slug
   * @param userSlug - The artist's username slug
   * @param currentUserId - ID of user making request (null if not authenticated)
   * @returns Artwork data, or null if not found/unauthorized
   */
  async getArtworkBySlug(
    artworkSlug: string,
    userSlug: string,
    currentUserId: string | null
  ): Promise<ArtworkWithCollections | null> {
    try {
      // Get user by slug
      const user = await this.db
        .prepare('SELECT id FROM users WHERE slug = ? LIMIT 1')
        .bind(userSlug)
        .first()

      if (!user) {
        return null
      }

      // Get artwork by slug and user
      const artwork = await this.db
        .prepare(
          `SELECT
             id, user_id, slug, title, description, materials, dimensions,
             created_date, category, tags, original_url, display_url,
             thumbnail_url, icon_url, status, is_featured, created_at, updated_at
           FROM artworks
           WHERE user_id = ? AND slug = ?
           LIMIT 1`
        )
        .bind(user.id, artworkSlug)
        .first()

      if (!artwork) {
        return null
      }

      // Check authorization
      const auth = this.checkAuthorization(artwork, currentUserId)
      if (!auth.allowed) {
        return null
      }

      let result = this.formatArtwork(artwork)
      result.collections = await this.getArtworkCollections(artwork.id)

      return result
    } catch (error) {
      console.error('Error fetching artwork by slug:', error)
      throw error
    }
  }

  /**
   * Check if user can access artwork based on status
   */
  private checkAuthorization(artwork: any, currentUserId: string | null): AuthorizationResult {
    // Deleted artworks are never accessible
    if (artwork.status === 'deleted') {
      return { allowed: false, reason: 'Artwork has been deleted' }
    }

    // Owner can always access
    if (currentUserId && artwork.user_id === currentUserId) {
      return { allowed: true }
    }

    // Non-owner can only access active artworks
    if (artwork.status === 'active') {
      return { allowed: true }
    }

    // Non-owner cannot access draft or other non-active statuses
    return { allowed: false, reason: 'Artwork is not public' }
  }

  /**
   * Get all collections this artwork belongs to
   */
  private async getArtworkCollections(
    artworkId: string
  ): Promise<Array<{ id: string; slug: string; title: string }>> {
    try {
      const collections = await this.db
        .prepare(
          `SELECT c.id, c.slug, c.title
           FROM collections c
           INNER JOIN collection_artworks ca ON c.id = ca.collection_id
           WHERE ca.artwork_id = ?
           ORDER BY c.title ASC`
        )
        .bind(artworkId)
        .all()

      return collections.results || []
    } catch (error) {
      console.error('Error fetching artwork collections:', error)
      return []
    }
  }

  /**
   * Format artwork database record to API response
   */
  private formatArtwork(artwork: any): ArtworkWithCollections {
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
      tags: artwork.tags ? JSON.parse(artwork.tags) : null,
      originalUrl: artwork.original_url,
      displayUrl: artwork.display_url,
      thumbnailUrl: artwork.thumbnail_url,
      iconUrl: artwork.icon_url,
      status: artwork.status,
      isFeatured: artwork.is_featured,
      collections: [],
      createdAt: artwork.created_at,
      updatedAt: artwork.updated_at
    }
  }
}
```

### Step 2: Add GET Endpoint to Artworks Route

Create the GET handler for single artwork retrieval.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/artworks.ts` (Update existing file)

Add this handler:

```typescript
import { json, type RequestHandler } from '@sveltejs/kit'
import { auth } from '$lib/server/auth'
import { db } from '$lib/server/db'
import { ArtworkQueryService } from '$lib/api/services/artworkQuery'

/**
 * GET /api/artworks/:id
 * Retrieve a single artwork by ID
 *
 * Query parameters:
 * - include=collections (optional, default: true)
 *
 * Response codes:
 * - 200: Artwork found and authorized to access
 * - 404: Artwork not found or not authorized to access
 * - 500: Server error
 */
export const GET: RequestHandler = async ({ url, request, locals }) => {
  try {
    // Extract ID from URL path
    const pathParts = url.pathname.split('/')
    const artworkId = pathParts[pathParts.length - 1]

    if (!artworkId) {
      return json({ error: 'Missing artwork ID' }, { status: 400 })
    }

    // Get current user ID if authenticated
    const session = await auth.getSession(request)
    const currentUserId = session?.user?.id || null

    // Parse query parameters
    const includeCollections = url.searchParams.get('include') !== 'false'

    // Initialize service
    const queryService = new ArtworkQueryService(db)

    // Fetch artwork
    const artwork = await queryService.getArtworkById(
      artworkId,
      currentUserId,
      includeCollections
    )

    if (!artwork) {
      return json({ error: 'Artwork not found' }, { status: 404 })
    }

    return json({ data: artwork }, { status: 200 })
  } catch (error) {
    console.error('Error in GET /api/artworks/:id:', error)
    return json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

### Step 3: Create SvelteKit Route Handler

Wire up the GET handler in SvelteKit routing.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/routes/api/artworks/[id]/+server.ts`

```typescript
import { GET } from '$lib/api/routes/artworks'

export { GET }
```

### Step 4: Add Artwork Get Method to Query Service

Also support fetching by user slug and artwork slug for public URLs.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/services/artworkQuery.ts` (Add this export)

Already included in Step 1, but ensure this is exposed:

```typescript
export { ArtworkQueryService }
```

### Step 5: Create Client-Side Hook (Optional)

Create a React hook for client-side artwork fetching.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/hooks/useArtwork.ts` (Optional)

```typescript
import { useState, useEffect } from 'react'

export interface UseArtworkOptions {
  skip?: boolean
  include?: string
}

export function useArtwork(artworkId: string | null, options: UseArtworkOptions = {}) {
  const [artwork, setArtwork] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!artworkId || options.skip) {
      return
    }

    const fetchArtwork = async () => {
      setLoading(true)
      setError(null)

      try {
        const params = new URLSearchParams()
        if (options.include) {
          params.append('include', options.include)
        }

        const response = await fetch(`/api/artworks/${artworkId}?${params}`)

        if (!response.ok) {
          if (response.status === 404) {
            setError('Artwork not found')
          } else {
            setError('Failed to load artwork')
          }
          return
        }

        const { data } = await response.json()
        setArtwork(data)
      } catch (err) {
        setError('Error loading artwork')
        console.error('Artwork fetch error:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchArtwork()
  }, [artworkId, options.skip, options.include])

  return { artwork, loading, error }
}
```

---

## Files to Create/Modify

| Path | Type | Purpose |
|------|------|---------|
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/services/artworkQuery.ts` | Create | Artwork query service with authorization |
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/artworks.ts` | Modify | Add GET handler |
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/routes/api/artworks/[id]/+server.ts` | Create | SvelteKit route bridge |
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/hooks/useArtwork.ts` | Create | React hook (optional) |

---

## Verification

### Test 1: Get Artwork as Owner
```bash
# Owner retrieves their own artwork
curl -X GET http://localhost:5173/api/artworks/art_abc123 \
  -H "Authorization: Bearer <owner-token>"

# Expected: 200 OK with full artwork data
# {
#   "data": {
#     "id": "art_abc123",
#     "userId": "usr_owner123",
#     "title": "...",
#     ...
#   }
# }
```

### Test 2: Get Active Artwork as Non-Owner
```bash
# Non-owner retrieves public artwork
curl -X GET http://localhost:5173/api/artworks/art_public123

# Expected: 200 OK with artwork data (if status = 'active')
```

### Test 3: Get Draft Artwork as Non-Owner
```bash
# Non-owner tries to retrieve draft artwork
curl -X GET http://localhost:5173/api/artworks/art_draft123

# Expected: 404 Not Found
```

### Test 4: Get Deleted Artwork
```bash
# Any user tries to get deleted artwork
curl -X GET http://localhost:5173/api/artworks/art_deleted123 \
  -H "Authorization: Bearer <any-token>"

# Expected: 404 Not Found
```

### Test 5: With Collections
```bash
# Get artwork with associated collections
curl -X GET "http://localhost:5173/api/artworks/art_abc123?include=true"

# Expected: 200 OK with collections array populated
# {
#   "data": {
#     "id": "art_abc123",
#     "collections": [
#       { "id": "col_123", "slug": "fantasy", "title": "Fantasy Art" },
#       { "id": "col_456", "slug": " 2024", "title": "2024 Works" }
#     ],
#     ...
#   }
# }
```

### Test 6: Nonexistent Artwork
```bash
curl -X GET http://localhost:5173/api/artworks/art_nonexistent

# Expected: 404 Not Found with error message
```

### Test 7: Get by Slug
```bash
# Get artwork by user slug and artwork slug (public URL)
curl -X GET http://localhost:5173/api/artworks/dragon-artist/fantasy-gallery/dragons-dawn

# This would be a route like: /api/artworks/by-slug/:userSlug/:artworkSlug
# Expected: 200 OK with artwork data
```

### Test 8: Owner Accessing Draft
```bash
# Owner retrieves their own draft artwork
curl -X GET http://localhost:5173/api/artworks/art_draft_own \
  -H "Authorization: Bearer <owner-token>"

# Expected: 200 OK (owner can access their own drafts)
```

---

## Notes

- **Authorization First**: Check ownership/status before returning any artwork data
- **Soft Deletes**: Deleted artworks return 404 even to owners (design choice - can be changed to return 410 Gone)
- **Public Access**: Non-authenticated users can access active/public artworks
- **Collections Eager Loading**: Collections are fetched separately to avoid N+1 queries; pagination can be added later if needed
- **Slug-Based Access**: Can implement additional route for slug-based access (e.g., `/api/artworks/by-slug/:userSlug/:artworkSlug`) if needed
- **Performance**: Add database index on (user_id, slug) and status columns for faster queries
- **Caching**: Consider caching public artworks at CDN level (CloudFlare Pages)

