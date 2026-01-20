# 93-API-BROWSE-FEATURED.md

## Goal
Create the `GET /api/browse/featured` endpoint that returns a curated list of featured artists and their featured artworks. This endpoint powers the featured section on the homepage and browse page, showcasing artists and artworks marked as featured by admins.

---

## Spec Extract

From Phase 18 requirements:
- **Authentication**: Public (no auth required)
- **Response Content**:
  - Featured artists (max 10) with avatar and artwork count
  - Featured artworks (max 20) with full metadata
  - Both filtered by `is_featured=true` flag
- **Ordering**: Featured items should be ordered by featured date or admin-set position
- **Caching**: Results can be cached (low update frequency)

---

## Prerequisites

**Must complete before starting:**
- **15-API-FOUNDATION.md** - Hono app and error handling
- **05-SCHEMA-USERS.md** - Users table with is_featured flag
- **06-SCHEMA-GALLERIES.md** - Galleries table
- **10-SCHEMA-ARTWORKS.md** - Artworks table with is_featured flag

---

## Steps

### Step 1: Create Browse Service

Create a new service file for browse-related operations.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/services/browse.service.ts`

```typescript
import { Database } from '@cloudflare/d1'
import { Errors } from '../error'

export interface FeaturedArtistPreview {
  id: string
  username: string
  display_name: string
  avatar_url: string | null
  artworks_count: number
  featured_at: string
}

export interface FeaturedArtworkPreview {
  id: string
  slug: string
  title: string
  artist_name: string
  artist_username: string
  category: string | null
  image_url: string
  thumbnail_url: string | null
  created_at: string
  featured_at: string
}

export interface FeaturedContent {
  artists: FeaturedArtistPreview[]
  artworks: FeaturedArtworkPreview[]
}

/**
 * Get featured artists and artworks
 * Returns admins' curated selection for homepage and browse
 */
export async function getFeaturedContent(
  db: Database
): Promise<FeaturedContent> {
  // Get featured artists (max 10)
  const featuredArtists = await db
    .prepare(
      `
      SELECT
        u.id,
        u.username,
        u.display_name,
        u.avatar_url,
        COUNT(DISTINCT a.id) as artworks_count,
        u.featured_at
      FROM users u
      LEFT JOIN galleries g ON u.id = g.user_id
      LEFT JOIN artworks a ON g.id = a.gallery_id
      WHERE u.is_featured = 1
      AND u.status = 'active'
      GROUP BY u.id
      ORDER BY u.featured_at DESC, u.created_at DESC
      LIMIT 10
      `
    )
    .all<FeaturedArtistPreview>()

  // Get featured artworks (max 20)
  const featuredArtworks = await db
    .prepare(
      `
      SELECT
        a.id,
        a.slug,
        a.title,
        a.artist_name,
        u.username as artist_username,
        a.category,
        a.image_url,
        a.thumbnail_url,
        a.created_at,
        a.featured_at
      FROM artworks a
      JOIN galleries g ON a.gallery_id = g.id
      JOIN users u ON g.user_id = u.id
      WHERE a.is_featured = 1
      AND a.status = 'active'
      AND u.status = 'active'
      ORDER BY a.featured_at DESC, a.created_at DESC
      LIMIT 20
      `
    )
    .all<FeaturedArtworkPreview>()

  return {
    artists: featuredArtists?.results || [],
    artworks: featuredArtworks?.results || [],
  }
}

/**
 * Get featured content with caching
 * Caches for 1 hour since featured items don't change frequently
 */
export async function getFeaturedContentCached(
  db: Database,
  cache: any
): Promise<FeaturedContent> {
  const cacheKey = 'featured_content'
  const cachedContent = await cache.get(cacheKey)

  if (cachedContent) {
    return JSON.parse(cachedContent)
  }

  const content = await getFeaturedContent(db)

  // Cache for 1 hour (3600 seconds)
  await cache.set(cacheKey, JSON.stringify(content), {
    expirationTtl: 3600,
  })

  return content
}
```

---

### Step 2: Create Browse Route Handler

Create the route handler for the featured endpoint.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/browse.ts`

```typescript
import { Context } from 'hono'
import { getFeaturedContent } from '../services/browse.service'
import { Errors } from '../error'

export type HonoContext = Context<{
  Bindings: {
    DB: any
    CACHE?: any
  }
}>

/**
 * GET /api/browse/featured
 * Get featured artists and artworks
 *
 * Authentication: Public (no auth required)
 * Response: { data: FeaturedContent }
 * Caching: 1 hour
 */
export async function handleGetFeaturedContent(c: HonoContext) {
  try {
    const db = c.env.DB
    const cache = c.env.CACHE

    let content

    // Try cache first if available
    if (cache) {
      const cacheKey = 'featured_content'
      try {
        const cached = await cache.get(cacheKey)
        if (cached) {
          content = JSON.parse(cached)
          return c.json(
            {
              data: content,
              cached: true,
            },
            {
              headers: {
                'Cache-Control': 'public, max-age=3600',
              },
            }
          )
        }
      } catch (cacheErr) {
        // Ignore cache errors, proceed with DB query
      }
    }

    // Fetch from database
    content = await getFeaturedContent(db)

    // Try to cache the result
    if (cache) {
      try {
        await cache.set('featured_content', JSON.stringify(content), {
          expirationTtl: 3600,
        })
      } catch (cacheErr) {
        // Ignore cache write errors
      }
    }

    return c.json(
      {
        data: content,
        cached: false,
      },
      {
        headers: {
          'Cache-Control': 'public, max-age=3600',
        },
      }
    )
  } catch (err) {
    if (err instanceof Error) {
      throw err
    }
    throw Errors.internal('Failed to retrieve featured content')
  }
}
```

---

### Step 3: Add is_featured Flags to Schema

Verify or add the `is_featured` flag to both users and artworks tables. This should have been done in earlier schema builds, but confirm it exists.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/schema/migrations.sql`

Add these column definitions if not already present:

```sql
-- For users table (if not already added)
ALTER TABLE users ADD COLUMN is_featured INTEGER DEFAULT 0 CHECK (is_featured IN (0, 1));
ALTER TABLE users ADD COLUMN featured_at TEXT;

-- For artworks table (if not already added)
ALTER TABLE artworks ADD COLUMN is_featured INTEGER DEFAULT 0 CHECK (is_featured IN (0, 1));
ALTER TABLE artworks ADD COLUMN featured_at TEXT;

-- Create index for fast queries
CREATE INDEX IF NOT EXISTS idx_users_is_featured ON users(is_featured, featured_at DESC);
CREATE INDEX IF NOT EXISTS idx_artworks_is_featured ON artworks(is_featured, featured_at DESC);
```

---

### Step 4: Register Browse Route

Add the route to the main Hono app.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/index.ts`

```typescript
import { handleGetFeaturedContent } from './routes/browse'

// ============================================
// Browse Routes (Phase 18)
// ============================================

app.get('/browse/featured', handleGetFeaturedContent)
```

---

## Files to Create/Modify

**Created files:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/services/browse.service.ts` - Browse service

**Modified files:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/browse.ts` - Browse route handlers
2. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/index.ts` - Register GET /api/browse/featured
3. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/schema/migrations.sql` - Add is_featured columns (if needed)

---

## Verification

### Test 1: Compile TypeScript

```bash
cd /Volumes/DataSSD/gitsrc/vfa_gallery
npx tsc --noEmit
```

Expected: No type errors

---

### Test 2: Get Featured Content (Unauthenticated)

```bash
curl http://localhost:8788/api/browse/featured
```

Expected response (200):
```json
{
  "data": {
    "artists": [
      {
        "id": "usr_123abc",
        "username": "sam-corl",
        "display_name": "Sam Corl",
        "avatar_url": "https://r2.example.com/avatars/sam-corl.jpg",
        "artworks_count": 25,
        "featured_at": "2026-01-15T10:00:00.000Z"
      }
    ],
    "artworks": [
      {
        "id": "art_456def",
        "slug": "dragon-portrait",
        "title": "Dragon Portrait",
        "artist_name": "Sam Corl",
        "artist_username": "sam-corl",
        "category": "illustration",
        "image_url": "https://r2.example.com/artworks/dragon-portrait.jpg",
        "thumbnail_url": "https://r2.example.com/artworks/dragon-portrait-thumb.jpg",
        "created_at": "2026-01-10T14:30:00.000Z",
        "featured_at": "2026-01-15T10:00:00.000Z"
      }
    ],
    "cached": false
  }
}
```

---

### Test 3: Verify Caching

Call the endpoint twice in quick succession:

```bash
curl http://localhost:8788/api/browse/featured
curl http://localhost:8788/api/browse/featured
```

Expected: Second request shows `"cached": true` if cache is enabled

---

### Test 4: Artist Count Accuracy

Create a test artist with 5 artworks, mark artist as featured. Get featured content:

```bash
curl http://localhost:8788/api/browse/featured
```

Expected: Artist appears in artists array with `artworks_count: 5`

---

### Test 5: Inactive Artists Excluded

Mark an artist as featured but set status to 'inactive'. Get featured content:

```bash
curl http://localhost:8788/api/browse/featured
```

Expected: Artist does NOT appear in artists array

---

### Test 6: Inactive Artworks Excluded

Mark an artwork as featured but set status to 'inactive'. Get featured content:

```bash
curl http://localhost:8788/api/browse/featured
```

Expected: Artwork does NOT appear in artworks array

---

### Test 7: Empty Featured Content

Create database with no featured items. Get featured content:

```bash
curl http://localhost:8788/api/browse/featured
```

Expected response (200):
```json
{
  "data": {
    "artists": [],
    "artworks": [],
    "cached": false
  }
}
```

---

### Test 8: Featured Ordering

Create 3 featured artists with different featured_at dates. Get featured content:

```bash
curl http://localhost:8788/api/browse/featured
```

Expected: Artists ordered by featured_at DESC (most recent first)

---

### Test 9: Artist Avatar Present

Create featured artist with avatar_url. Get featured content:

```bash
curl http://localhost:8788/api/browse/featured | jq '.data.artists[0].avatar_url'
```

Expected: Returns valid URL string

---

### Test 10: Artwork Metadata Completeness

Get featured content and verify all fields present:

```bash
curl http://localhost:8788/api/browse/featured | jq '.data.artworks[0]'
```

Expected: All fields (id, slug, title, artist_name, artist_username, category, image_url, thumbnail_url, created_at, featured_at) are present

---

### Test 11: HTTP Headers

```bash
curl -i http://localhost:8788/api/browse/featured
```

Expected headers:
- `Cache-Control: public, max-age=3600`
- `Content-Type: application/json`

---

### Test 12: Maximum Limits

Create 15 featured artists and 25 featured artworks. Get featured content:

```bash
curl http://localhost:8788/api/browse/featured
```

Expected: Response contains exactly 10 artists and 20 artworks (not all)

---

## Summary

This build creates the `/api/browse/featured` endpoint that returns curated featured artists and artworks. Key features:

- Public endpoint with no authentication required
- Returns up to 10 featured artists with artwork counts
- Returns up to 20 featured artworks with metadata
- Filters by is_featured flag and active status
- Includes optional caching for performance
- Proper HTTP caching headers for client-side caching
- Ordered by featured_at timestamp (newest first)

The endpoint enables the featured sections on the homepage and browse page, showcasing the best content on the platform.

---

**Next step:** Proceed to **94-API-BROWSE-RECENT.md** to add recent artworks endpoint.
