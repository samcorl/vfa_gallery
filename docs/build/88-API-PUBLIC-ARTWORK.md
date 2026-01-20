# Build 88: GET /api/g/:artist/:gallery/:collection/:artwork Endpoint

## Goal

Create the `GET /api/g/:artist/:gallery/:collection/:artwork` public endpoint that resolves the full slug path and returns artwork detail with display URL (not original), metadata, artist credit, and navigation context (previous/next artworks).

---

## Spec Extract

**Public Artwork Endpoint:**
- **Route:** `GET /api/g/:artist/:gallery/:collection/:artwork`
- **Authentication:** Not required (public endpoint)
- **Path Parameters:**
  - `artist` - Artist username slug
  - `gallery` - Gallery slug
  - `collection` - Collection slug
  - `artwork` - Artwork slug

**Response (200 OK):**
```json
{
  "data": {
    "id": "art_abc123",
    "slug": "artwork-title",
    "title": "Artwork Title",
    "description": "Detailed artwork description",
    "displayUrl": "https://cdn.vfa.gallery/display/...",
    "thumbnailUrl": "https://cdn.vfa.gallery/thumb/...",
    "status": "active",
    "metadata": {
      "width": 1920,
      "height": 1080,
      "mimeType": "image/png",
      "uploadedAt": "2026-01-15T12:00:00Z"
    },
    "artist": {
      "id": "user_xyz",
      "username": "artist-username",
      "displayName": "Artist Display Name",
      "avatarUrl": "https://..."
    },
    "parent": {
      "gallery": {
        "id": "gal_abc",
        "slug": "gallery-slug",
        "name": "Gallery Name"
      },
      "collection": {
        "id": "col_abc",
        "slug": "collection-slug",
        "name": "Collection Name"
      }
    },
    "navigation": {
      "previousArtwork": {
        "slug": "previous-artwork",
        "title": "Previous Artwork"
      },
      "nextArtwork": {
        "slug": "next-artwork",
        "title": "Next Artwork"
      }
    },
    "createdAt": "2026-01-01T00:00:00Z",
    "updatedAt": "2026-01-15T12:30:00Z"
  }
}
```

**Critical Security:**
- Return `displayUrl` NEVER original upload URL
- Display URL includes artist watermark
- Thumbnail for preview only
- Full slug chain validation required

**Error Responses:**
- **404 Not Found:** If any part of slug chain is broken

---

## Prerequisites

**Must complete before starting:**
- **84-API-PUBLIC-COLLECTION.md** - Full slug chain resolution pattern
- **10-SCHEMA-ARTWORKS.md** - Artworks table schema
- **40-IMAGE-PIPELINE-ORCHESTRATION.md** - Image processing (display URLs with watermark)

**Reason:** This endpoint builds on collection slug resolution and needs image pipeline context.

---

## Steps

### Step 1: Extend Public Types

Add artwork types to the public types file:

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/types/public.ts` (add to existing file)

```typescript
/**
 * Public artwork response for detail view
 * Contains all public-facing artwork data
 * CRITICAL: displayUrl is watermarked, never original
 */
export interface PublicArtworkResponse {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  displayUrl: string; // ALWAYS watermarked version, never original
  thumbnailUrl: string | null;
  status: string;
  metadata: {
    width: number | null;
    height: number | null;
    mimeType: string | null;
    uploadedAt: string;
  };
  artist: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
  parent: {
    gallery: {
      id: string;
      slug: string;
      name: string;
    };
    collection: {
      id: string;
      slug: string;
      name: string;
    };
  };
  navigation: {
    previousArtwork: {
      slug: string;
      title: string;
    } | null;
    nextArtwork: {
      slug: string;
      title: string;
    } | null;
  };
  createdAt: string;
  updatedAt: string;
}

/**
 * Slug resolution chain for artwork
 * Includes full hierarchy: artist → gallery → collection → artwork
 */
export interface ArtworkSlugResolutionChain extends SlugResolutionChain {
  artwork: {
    id: string;
    collectionId: string;
    slug: string;
    title: string;
    description: string | null;
    displayUrl: string;
    originalUrl: string | null;
    thumbnailUrl: string | null;
    imageWidth: number | null;
    imageHeight: number | null;
    imageMimeType: string | null;
    uploadedAt: string;
    status: string;
    createdAt: string;
    updatedAt: string;
  };
}
```

### Step 2: Create Artwork Database Query Functions

Create database functions for artwork resolution:

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/db/public-artworks.ts`

```typescript
import type { D1Database } from '@cloudflare/workers-types';
import type { PublicArtworkResponse, ArtworkSlugResolutionChain } from '../../types/public';
import { resolveCollectionSlugChain } from './public-collections';

/**
 * Resolve full artwork slug chain including parent context
 */
export async function resolveArtworkSlugChain(
  db: D1Database,
  artistSlug: string,
  gallerySlug: string,
  collectionSlug: string,
  artworkSlug: string
): Promise<ArtworkSlugResolutionChain | null> {
  try {
    // First resolve the collection chain (art → gallery → collection)
    const collectionChain = await resolveCollectionSlugChain(
      db,
      artistSlug,
      gallerySlug,
      collectionSlug
    );

    if (!collectionChain) {
      return null;
    }

    // Now resolve the artwork within that collection
    const artworkResult = await db
      .prepare(`
        SELECT
          id,
          collection_id,
          slug,
          title,
          description,
          display_url,
          original_url,
          thumbnail_url,
          image_width,
          image_height,
          image_mime_type,
          uploaded_at,
          status,
          created_at,
          updated_at
        FROM artworks
        WHERE LOWER(slug) = LOWER(?1)
          AND collection_id = ?2
          AND status = 'active'
      `)
      .bind(artworkSlug, collectionChain.collection.id)
      .first<any>();

    if (!artworkResult) {
      return null;
    }

    // CRITICAL: Verify we have a display URL (watermarked)
    if (!artworkResult.display_url) {
      console.warn(`Artwork ${artworkResult.id} missing display_url, needs image processing`);
      return null;
    }

    return {
      ...collectionChain,
      artwork: {
        id: artworkResult.id,
        collectionId: artworkResult.collection_id,
        slug: artworkResult.slug,
        title: artworkResult.title,
        description: artworkResult.description,
        displayUrl: artworkResult.display_url,
        originalUrl: artworkResult.original_url,
        thumbnailUrl: artworkResult.thumbnail_url,
        imageWidth: artworkResult.image_width,
        imageHeight: artworkResult.image_height,
        imageMimeType: artworkResult.image_mime_type,
        uploadedAt: artworkResult.uploaded_at,
        status: artworkResult.status,
        createdAt: artworkResult.created_at,
        updatedAt: artworkResult.updated_at,
      },
    };
  } catch (error) {
    console.error('Error resolving artwork slug chain:', error);
    return null;
  }
}

/**
 * Get previous and next artworks in the same collection
 * Orders by creation date
 */
export async function getAdjacentArtworks(
  db: D1Database,
  collectionId: string,
  currentArtworkId: string
): Promise<{
  previous: { slug: string; title: string } | null;
  next: { slug: string; title: string } | null;
}> {
  try {
    // Get the current artwork's created_at for ordering
    const currentArtwork = await db
      .prepare(`SELECT created_at FROM artworks WHERE id = ?1`)
      .bind(currentArtworkId)
      .first<any>();

    if (!currentArtwork) {
      return { previous: null, next: null };
    }

    // Get previous artwork
    const previousResult = await db
      .prepare(`
        SELECT slug, title
        FROM artworks
        WHERE collection_id = ?1
          AND created_at < ?2
          AND status = 'active'
        ORDER BY created_at DESC
        LIMIT 1
      `)
      .bind(collectionId, currentArtwork.created_at)
      .first<any>();

    // Get next artwork
    const nextResult = await db
      .prepare(`
        SELECT slug, title
        FROM artworks
        WHERE collection_id = ?1
          AND created_at > ?2
          AND status = 'active'
        ORDER BY created_at ASC
        LIMIT 1
      `)
      .bind(collectionId, currentArtwork.created_at)
      .first<any>();

    return {
      previous: previousResult
        ? { slug: previousResult.slug, title: previousResult.title }
        : null,
      next: nextResult
        ? { slug: nextResult.slug, title: nextResult.title }
        : null,
    };
  } catch (error) {
    console.error('Error fetching adjacent artworks:', error);
    return { previous: null, next: null };
  }
}

/**
 * Build complete public artwork response
 * CRITICAL: Never returns original_url
 */
export async function buildPublicArtworkResponse(
  chain: ArtworkSlugResolutionChain,
  adjacentArtworks: { previous: any; next: any }
): Promise<PublicArtworkResponse> {
  return {
    id: chain.artwork.id,
    slug: chain.artwork.slug,
    title: chain.artwork.title,
    description: chain.artwork.description,
    displayUrl: chain.artwork.displayUrl, // Watermarked only
    thumbnailUrl: chain.artwork.thumbnailUrl,
    status: chain.artwork.status,
    metadata: {
      width: chain.artwork.imageWidth,
      height: chain.artwork.imageHeight,
      mimeType: chain.artwork.imageMimeType,
      uploadedAt: chain.artwork.uploadedAt,
    },
    artist: {
      id: chain.artist.id,
      username: chain.artist.username,
      displayName: chain.artist.displayName,
      avatarUrl: chain.artist.avatarUrl,
    },
    parent: {
      gallery: {
        id: chain.gallery.id,
        slug: chain.gallery.slug,
        name: chain.gallery.name,
      },
      collection: {
        id: chain.collection.id,
        slug: chain.collection.slug,
        name: chain.collection.name,
      },
    },
    navigation: {
      previousArtwork: adjacentArtworks.previous,
      nextArtwork: adjacentArtworks.next,
    },
    createdAt: chain.artwork.createdAt,
    updatedAt: chain.artwork.updatedAt,
  };
}
```

### Step 3: Create API Endpoint Handler

Create the public artwork endpoint:

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/functions/api/g/[artist]/[gallery]/[collection]/[artwork]/index.ts`

```typescript
import { Hono } from 'hono';
import type { HonoEnv } from '../../../../../../../../src/types/env';
import { errorResponse } from '../../../../../../../../src/lib/api/errors';
import {
  resolveArtworkSlugChain,
  getAdjacentArtworks,
  buildPublicArtworkResponse,
} from '../../../../../../../../src/lib/db/public-artworks';

const app = new Hono<HonoEnv>();

/**
 * GET /api/g/:artist/:gallery/:collection/:artwork
 * Public artwork detail endpoint
 * Returns display URL (watermarked), never original
 */
app.get('/', async (c) => {
  try {
    const artist = c.req.param('artist');
    const gallery = c.req.param('gallery');
    const collection = c.req.param('collection');
    const artwork = c.req.param('artwork');

    if (!artist || !gallery || !collection || !artwork) {
      return errorResponse(c, 400, 'INVALID_PARAMS', 'Missing required path parameters');
    }

    const db = c.env.DB;

    // Resolve full slug chain
    const chain = await resolveArtworkSlugChain(db, artist, gallery, collection, artwork);

    if (!chain) {
      return errorResponse(c, 404, 'NOT_FOUND', 'Artwork not found');
    }

    // Get adjacent artworks for navigation
    const adjacent = await getAdjacentArtworks(db, chain.collection.id, chain.artwork.id);

    // Build response
    const response = await buildPublicArtworkResponse(chain, adjacent);

    return c.json({ data: response });
  } catch (error) {
    console.error('GET /api/g/:artist/:gallery/:collection/:artwork error:', error);
    return errorResponse(c, 500, 'INTERNAL_ERROR', 'Failed to fetch artwork');
  }
});

export const onRequest = app.fetch;
```

### Step 4: Create Route Directory Structure

Ensure correct directory structure:

```bash
mkdir -p /Volumes/DataSSD/gitsrc/vfa_gallery/site/functions/api/g/[artist]/[gallery]/[collection]/[artwork]
```

### Step 5: Test the Endpoint

Start the development server:

```bash
cd /Volumes/DataSSD/gitsrc/vfa_gallery/site
npm run dev
```

Test the endpoint:

```bash
curl -X GET http://localhost:8787/api/g/samcorl/digital-art/landscapes/mountain-sunset \
  -H "Content-Type: application/json"
```

---

## Files to Create/Modify

**Create:**
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/db/public-artworks.ts` - Artwork database queries
- `/Volumes/DataSSD/gitsrc/vfa_gallery/site/functions/api/g/[artist]/[gallery]/[collection]/[artwork]/index.ts` - Endpoint handler

**Modify:**
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/types/public.ts` - Add artwork response types

---

## Verification

### Test 1: Artwork Slug Resolution Works

```bash
curl -X GET http://localhost:8787/api/g/samcorl/digital-art/landscapes/mountain-sunset \
  -H "Content-Type: application/json" | jq '.data.id'
```

Expected: Returns an artwork ID string.

### Test 2: Returns Display URL, Never Original

```bash
curl -X GET http://localhost:8787/api/g/samcorl/digital-art/landscapes/mountain-sunset \
  -H "Content-Type: application/json" | jq '.data.displayUrl'
```

Expected: URL with watermark parameters, not original_url.

### Test 3: Full Slug Chain Returns All Parent Context

```bash
curl -X GET http://localhost:8787/api/g/samcorl/digital-art/landscapes/mountain-sunset \
  -H "Content-Type: application/json" | jq '.data.parent'
```

Expected: Object with `gallery` and `collection` properties.

### Test 4: Returns Artist Credit

```bash
curl -X GET http://localhost:8787/api/g/samcorl/digital-art/landscapes/mountain-sunset \
  -H "Content-Type: application/json" | jq '.data.artist'
```

Expected: Object with `id`, `username`, `displayName`, `avatarUrl`.

### Test 5: Returns 404 for Non-Existent Artwork

```bash
curl -X GET http://localhost:8787/api/g/samcorl/digital-art/landscapes/nonexistent \
  -H "Content-Type: application/json" | jq '.error'
```

Expected: 404 status.

### Test 6: Returns 404 if Artwork Doesn't Belong to Collection

```bash
curl -X GET http://localhost:8787/api/g/samcorl/digital-art/wrong-collection/artwork-slug \
  -H "Content-Type: application/json" | jq '.error'
```

Expected: 404 status.

### Test 7: Returns Navigation Data

```bash
curl -X GET http://localhost:8787/api/g/samcorl/digital-art/landscapes/mountain-sunset \
  -H "Content-Type: application/json" | jq '.data.navigation'
```

Expected: Object with `previousArtwork` and `nextArtwork` (can be null).

### Test 8: Returns Image Metadata

```bash
curl -X GET http://localhost:8787/api/g/samcorl/digital-art/landscapes/mountain-sunset \
  -H "Content-Type: application/json" | jq '.data.metadata'
```

Expected: Object with `width`, `height`, `mimeType`, `uploadedAt`.

---

## Success Criteria

- [ ] Artwork types added to `src/types/public.ts`
- [ ] Database query functions created in `src/lib/db/public-artworks.ts`
- [ ] Endpoint handler created at correct route
- [ ] Slug chain resolution works (artist → gallery → collection → artwork)
- [ ] Returns 404 if any part of chain is broken
- [ ] Returns display URL (watermarked), never original
- [ ] Returns full parent context (gallery and collection data)
- [ ] Returns artist credit information
- [ ] Returns navigation data (previous/next artworks)
- [ ] Returns image metadata (width, height, mime type)
- [ ] All 8 test cases pass
- [ ] Case-insensitive slug handling works

---

## Next Steps

Once verified, proceed to:
- **Build 89:** Public artwork detail page UI
- **Build 90:** Artwork zoom/pan viewer component
