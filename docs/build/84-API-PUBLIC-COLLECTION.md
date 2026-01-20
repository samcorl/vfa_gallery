# Build 84: GET /api/g/:artist/:gallery/:collection Endpoint

## Goal

Create the `GET /api/g/:artist/:gallery/:collection` public endpoint that resolves the full slug path to return a collection with metadata, including parent gallery/artist context, previous/next navigation, and artwork preview grid. This is the foundational API for public collection viewing.

---

## Spec Extract

**Public Collection Endpoint:**
- **Route:** `GET /api/g/:artist/:gallery/:collection`
- **Authentication:** Not required (public endpoint)
- **Path Parameters:**
  - `artist` - Artist username slug (lowercase alphanumeric + hyphens)
  - `gallery` - Gallery slug within that artist
  - `collection` - Collection slug within that gallery

**Response (200 OK):**
```json
{
  "data": {
    "id": "col_abc123",
    "slug": "collection-name",
    "name": "Collection Name",
    "description": "Description of the collection",
    "heroImageUrl": "https://cdn.vfa.gallery/...",
    "artworkCount": 42,
    "status": "active",
    "theme": {
      "id": "theme_xyz",
      "name": "Dark Modern",
      "config": {}
    },
    "parent": {
      "artist": {
        "id": "user_xyz",
        "username": "artist-username",
        "displayName": "Artist Display Name",
        "avatarUrl": "https://..."
      },
      "gallery": {
        "id": "gal_abc",
        "slug": "gallery-slug",
        "name": "Gallery Name"
      }
    },
    "navigation": {
      "previousCollection": {
        "slug": "previous-collection",
        "name": "Previous Collection"
      },
      "nextCollection": {
        "slug": "next-collection",
        "name": "Next Collection"
      }
    },
    "artworkPreview": [
      {
        "id": "art_xyz",
        "slug": "artwork-title",
        "title": "Artwork Title",
        "thumbnailUrl": "https://..."
      }
    ],
    "createdAt": "2026-01-01T00:00:00Z",
    "updatedAt": "2026-01-15T12:30:00Z"
  }
}
```

**Error Responses:**
- **404 Not Found:** If artist doesn't exist, gallery doesn't belong to artist, or collection doesn't belong to gallery
- **410 Gone:** If collection is archived/deleted but slug can be reconstructed (optional enhancement)

**Behavior:**
- Resolve full slug chain: artist → gallery → collection
- Return 404 if any link in the chain is broken
- Include theme from gallery if set
- Include previous/next collection in same gallery
- Include artwork preview (first 12 artworks)
- Public data only (no ownership info, no draft artworks)

---

## Prerequisites

**Must complete before starting:**
- **80-API-PUBLIC-ARTIST.md** - Artist profile endpoint (for slug resolution)
- **09-SCHEMA-COLLECTIONS.md** - Collections table schema
- **10-SCHEMA-ARTWORKS.md** - Artworks table schema for preview grid
- **11-SCHEMA-THEMES.md** - Themes table for collection theming

**Reason:** This endpoint depends on resolving the full slug path and fetching related data.

---

## Steps

### Step 1: Create Public Collection Response Types

Create types for public collection API responses:

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/types/public.ts` (create if not exists)

```typescript
/**
 * Public collection response for shared URLs
 * Contains all public-facing collection metadata
 */
export interface PublicCollectionResponse {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  heroImageUrl: string | null;
  artworkCount: number;
  status: string;
  theme: {
    id: string;
    name: string;
    config: Record<string, any>;
  } | null;
  parent: {
    artist: {
      id: string;
      username: string;
      displayName: string | null;
      avatarUrl: string | null;
    };
    gallery: {
      id: string;
      slug: string;
      name: string;
    };
  };
  navigation: {
    previousCollection: {
      slug: string;
      name: string;
    } | null;
    nextCollection: {
      slug: string;
      name: string;
    } | null;
  };
  artworkPreview: Array<{
    id: string;
    slug: string;
    title: string;
    thumbnailUrl: string | null;
  }>;
  createdAt: string;
  updatedAt: string;
}

/**
 * Helper type for slug resolution chain
 */
export interface SlugResolutionChain {
  artist: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
  gallery: {
    id: string;
    userId: string;
    slug: string;
    name: string;
    themeId: string | null;
  };
  collection: {
    id: string;
    galleryId: string;
    slug: string;
    name: string;
    description: string | null;
    heroImageUrl: string | null;
    status: string;
    createdAt: string;
    updatedAt: string;
  };
  theme: {
    id: string;
    name: string;
    config: Record<string, any>;
  } | null;
}
```

### Step 2: Create Database Query Functions for Slug Resolution

Create utility functions for resolving the full slug path:

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/db/public-collections.ts`

```typescript
import type { D1Database } from '@cloudflare/workers-types';
import type { PublicCollectionResponse, SlugResolutionChain } from '../../types/public';

/**
 * Resolve full slug path: artist → gallery → collection
 * Returns null if any part of the chain is broken
 */
export async function resolveCollectionSlugChain(
  db: D1Database,
  artistSlug: string,
  gallerySlug: string,
  collectionSlug: string
): Promise<SlugResolutionChain | null> {
  try {
    // Step 1: Resolve artist by username slug
    const artistResult = await db
      .prepare(`
        SELECT id, username, display_name, avatar_url
        FROM users
        WHERE LOWER(username) = LOWER(?1)
          AND status = 'active'
      `)
      .bind(artistSlug)
      .first<any>();

    if (!artistResult) {
      return null;
    }

    // Step 2: Resolve gallery by slug within artist
    const galleryResult = await db
      .prepare(`
        SELECT id, user_id, slug, name, theme_id, status
        FROM galleries
        WHERE LOWER(slug) = LOWER(?1)
          AND user_id = ?2
          AND status = 'active'
      `)
      .bind(gallerySlug, artistResult.id)
      .first<any>();

    if (!galleryResult) {
      return null;
    }

    // Step 3: Resolve collection by slug within gallery
    const collectionResult = await db
      .prepare(`
        SELECT id, gallery_id, slug, name, description, hero_image_url, status, created_at, updated_at
        FROM collections
        WHERE LOWER(slug) = LOWER(?1)
          AND gallery_id = ?2
          AND status = 'active'
      `)
      .bind(collectionSlug, galleryResult.id)
      .first<any>();

    if (!collectionResult) {
      return null;
    }

    // Step 4: Load theme if gallery has one
    let theme = null;
    if (galleryResult.theme_id) {
      const themeResult = await db
        .prepare(`
          SELECT id, name, config
          FROM themes
          WHERE id = ?1
        `)
        .bind(galleryResult.theme_id)
        .first<any>();

      if (themeResult) {
        theme = {
          id: themeResult.id,
          name: themeResult.name,
          config: typeof themeResult.config === 'string'
            ? JSON.parse(themeResult.config)
            : themeResult.config,
        };
      }
    }

    return {
      artist: {
        id: artistResult.id,
        username: artistResult.username,
        displayName: artistResult.display_name,
        avatarUrl: artistResult.avatar_url,
      },
      gallery: {
        id: galleryResult.id,
        userId: galleryResult.user_id,
        slug: galleryResult.slug,
        name: galleryResult.name,
        themeId: galleryResult.theme_id,
      },
      collection: {
        id: collectionResult.id,
        galleryId: collectionResult.gallery_id,
        slug: collectionResult.slug,
        name: collectionResult.name,
        description: collectionResult.description,
        heroImageUrl: collectionResult.hero_image_url,
        status: collectionResult.status,
        createdAt: collectionResult.created_at,
        updatedAt: collectionResult.updated_at,
      },
      theme,
    };
  } catch (error) {
    console.error('Error resolving collection slug chain:', error);
    return null;
  }
}

/**
 * Get previous and next collections in the same gallery
 * Orders by creation date
 */
export async function getAdjacentCollections(
  db: D1Database,
  galleryId: string,
  currentCollectionId: string
): Promise<{
  previous: { slug: string; name: string } | null;
  next: { slug: string; name: string } | null;
}> {
  try {
    // Get the current collection's created_at for ordering
    const currentCollection = await db
      .prepare(`
        SELECT created_at FROM collections WHERE id = ?1
      `)
      .bind(currentCollectionId)
      .first<any>();

    if (!currentCollection) {
      return { previous: null, next: null };
    }

    // Get previous collection
    const previousResult = await db
      .prepare(`
        SELECT slug, name
        FROM collections
        WHERE gallery_id = ?1
          AND created_at < ?2
          AND status = 'active'
        ORDER BY created_at DESC
        LIMIT 1
      `)
      .bind(galleryId, currentCollection.created_at)
      .first<any>();

    // Get next collection
    const nextResult = await db
      .prepare(`
        SELECT slug, name
        FROM collections
        WHERE gallery_id = ?1
          AND created_at > ?2
          AND status = 'active'
        ORDER BY created_at ASC
        LIMIT 1
      `)
      .bind(galleryId, currentCollection.created_at)
      .first<any>();

    return {
      previous: previousResult
        ? { slug: previousResult.slug, name: previousResult.name }
        : null,
      next: nextResult
        ? { slug: nextResult.slug, name: nextResult.name }
        : null,
    };
  } catch (error) {
    console.error('Error fetching adjacent collections:', error);
    return { previous: null, next: null };
  }
}

/**
 * Get artwork preview for collection (first 12, ordered by creation)
 */
export async function getCollectionArtworkPreview(
  db: D1Database,
  collectionId: string,
  limit: number = 12
): Promise<Array<{
  id: string;
  slug: string;
  title: string;
  thumbnailUrl: string | null;
}>> {
  try {
    const results = await db
      .prepare(`
        SELECT id, slug, title, thumbnail_url
        FROM artworks
        WHERE collection_id = ?1
          AND status = 'active'
        ORDER BY created_at ASC
        LIMIT ?2
      `)
      .bind(collectionId, limit)
      .all<any>();

    return results.results?.map((row) => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      thumbnailUrl: row.thumbnail_url,
    })) || [];
  } catch (error) {
    console.error('Error fetching artwork preview:', error);
    return [];
  }
}

/**
 * Get total artwork count for collection
 */
export async function getCollectionArtworkCount(
  db: D1Database,
  collectionId: string
): Promise<number> {
  try {
    const result = await db
      .prepare(`
        SELECT COUNT(*) as count
        FROM artworks
        WHERE collection_id = ?1
          AND status = 'active'
      `)
      .bind(collectionId)
      .first<any>();

    return result?.count || 0;
  } catch (error) {
    console.error('Error fetching artwork count:', error);
    return 0;
  }
}

/**
 * Build complete public collection response
 */
export async function buildPublicCollectionResponse(
  db: D1Database,
  chain: SlugResolutionChain,
  adjacentCollections: { previous: any; next: any },
  artworkCount: number,
  artworkPreview: any[]
): Promise<PublicCollectionResponse> {
  return {
    id: chain.collection.id,
    slug: chain.collection.slug,
    name: chain.collection.name,
    description: chain.collection.description,
    heroImageUrl: chain.collection.heroImageUrl,
    artworkCount,
    status: chain.collection.status,
    theme: chain.theme,
    parent: {
      artist: {
        id: chain.artist.id,
        username: chain.artist.username,
        displayName: chain.artist.displayName,
        avatarUrl: chain.artist.avatarUrl,
      },
      gallery: {
        id: chain.gallery.id,
        slug: chain.gallery.slug,
        name: chain.gallery.name,
      },
    },
    navigation: {
      previousCollection: adjacentCollections.previous,
      nextCollection: adjacentCollections.next,
    },
    artworkPreview,
    createdAt: chain.collection.createdAt,
    updatedAt: chain.collection.updatedAt,
  };
}
```

### Step 3: Create API Endpoint Handler

Create the public collection endpoint:

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/functions/api/g/[artist]/[gallery]/[collection]/index.ts`

```typescript
import { Hono } from 'hono';
import type { HonoEnv } from '../../../../../../../src/types/env';
import { errorResponse } from '../../../../../../../src/lib/api/errors';
import {
  resolveCollectionSlugChain,
  getAdjacentCollections,
  getCollectionArtworkPreview,
  getCollectionArtworkCount,
  buildPublicCollectionResponse,
} from '../../../../../../../src/lib/db/public-collections';

const app = new Hono<HonoEnv>();

/**
 * GET /api/g/:artist/:gallery/:collection
 * Public collection endpoint
 * Resolves full slug path and returns collection metadata
 */
app.get('/', async (c) => {
  try {
    const artist = c.req.param('artist');
    const gallery = c.req.param('gallery');
    const collection = c.req.param('collection');

    if (!artist || !gallery || !collection) {
      return errorResponse(c, 400, 'INVALID_PARAMS', 'Missing required path parameters');
    }

    const db = c.env.DB;

    // Resolve full slug chain
    const chain = await resolveCollectionSlugChain(db, artist, gallery, collection);

    if (!chain) {
      return errorResponse(c, 404, 'NOT_FOUND', 'Collection not found');
    }

    // Get adjacent collections for navigation
    const adjacent = await getAdjacentCollections(db, chain.gallery.id, chain.collection.id);

    // Get artwork preview and count
    const [artworkPreview, artworkCount] = await Promise.all([
      getCollectionArtworkPreview(db, chain.collection.id, 12),
      getCollectionArtworkCount(db, chain.collection.id),
    ]);

    // Build response
    const response = await buildPublicCollectionResponse(
      db,
      chain,
      adjacent,
      artworkCount,
      artworkPreview
    );

    return c.json({ data: response });
  } catch (error) {
    console.error('GET /api/g/:artist/:gallery/:collection error:', error);
    return errorResponse(c, 500, 'INTERNAL_ERROR', 'Failed to fetch collection');
  }
});

export const onRequest = app.fetch;
```

### Step 4: Update Route Configuration

Ensure the file is in the correct location for Cloudflare Pages routing:

```bash
mkdir -p /Volumes/DataSSD/gitsrc/vfa_gallery/site/functions/api/g/[artist]/[gallery]/[collection]
```

### Step 5: Test the Endpoint Locally

Start the development server:

```bash
cd /Volumes/DataSSD/gitsrc/vfa_gallery/site
npm run dev
```

In another terminal, test the endpoint:

```bash
curl -X GET http://localhost:8787/api/g/artist-username/gallery-slug/collection-slug \
  -H "Content-Type: application/json"
```

Expected output: JSON object matching the spec with collection data, parent context, and navigation.

---

## Files to Create/Modify

**Create:**
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/types/public.ts` - Public API response types
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/db/public-collections.ts` - Collection database queries
- `/Volumes/DataSSD/gitsrc/vfa_gallery/site/functions/api/g/[artist]/[gallery]/[collection]/index.ts` - Endpoint handler

**Modify:**
- None

---

## Verification

### Test 1: Collection Slug Resolution Works

```bash
curl -X GET http://localhost:8787/api/g/samcorl/digital-art/landscapes \
  -H "Content-Type: application/json" | jq '.data.id'
```

Expected: Returns a collection ID string.

### Test 2: Full Slug Chain Returns All Parent Context

```bash
curl -X GET http://localhost:8787/api/g/samcorl/digital-art/landscapes \
  -H "Content-Type: application/json" | jq '.data.parent'
```

Expected: Object with `artist` and `gallery` properties containing full context.

### Test 3: Returns 404 for Non-Existent Artist

```bash
curl -X GET http://localhost:8787/api/g/nonexistent-artist/gallery/collection \
  -H "Content-Type: application/json" | jq '.error'
```

Expected: 404 status with error message.

### Test 4: Returns 404 if Gallery Doesn't Belong to Artist

```bash
curl -X GET http://localhost:8787/api/g/samcorl/other-artists-gallery/collection \
  -H "Content-Type: application/json" | jq '.error'
```

Expected: 404 status (hidden ownership).

### Test 5: Returns Navigation Data

```bash
curl -X GET http://localhost:8787/api/g/samcorl/digital-art/landscapes \
  -H "Content-Type: application/json" | jq '.data.navigation'
```

Expected: Object with `previousCollection` and `nextCollection` (can be null if at boundaries).

### Test 6: Returns Artwork Preview

```bash
curl -X GET http://localhost:8787/api/g/samcorl/digital-art/landscapes \
  -H "Content-Type: application/json" | jq '.data.artworkPreview | length'
```

Expected: Number between 0-12 depending on collection size.

### Test 7: Returns Theme if Set

Create a test gallery with a theme and verify:

```bash
curl -X GET http://localhost:8787/api/g/samcorl/themed-gallery/collection \
  -H "Content-Type: application/json" | jq '.data.theme'
```

Expected: Theme object with `id`, `name`, and `config` properties (or null if no theme).

### Test 8: Handles Case-Insensitive Slugs

```bash
curl -X GET http://localhost:8787/api/g/SAMCORL/DIGITAL-ART/LANDSCAPES \
  -H "Content-Type: application/json" | jq '.data.id'
```

Expected: Same result as lowercase version.

---

## Success Criteria

- [ ] Public collection types created in `src/types/public.ts`
- [ ] Database query functions created in `src/lib/db/public-collections.ts`
- [ ] Endpoint handler created at correct route
- [ ] Slug chain resolution works (artist → gallery → collection)
- [ ] Returns 404 if any part of chain is broken
- [ ] Returns full parent context (artist and gallery data)
- [ ] Returns navigation data (previous/next collections)
- [ ] Returns artwork preview grid (max 12)
- [ ] Returns artwork count
- [ ] Includes theme if set on gallery
- [ ] All 8 test cases pass
- [ ] Case-insensitive slug handling works

---

## Next Steps

Once verified, proceed to:
- **Build 85:** Public collection page UI component
- **Build 88:** Public artwork detail endpoint
