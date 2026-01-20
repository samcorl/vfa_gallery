# 82-UI-PUBLIC-GALLERY-COLLECTIONS.md

## Goal
Create a collections grid component that displays on the public gallery page. Shows all collections in a gallery as clickable cards with hero images, names, and artwork counts, allowing visitors to navigate to individual collections.

---

## Spec Extract

From TECHNICAL-SPEC.md:
- **Location:** Gallery page (/:artist/:gallery)
- **Display:** Grid of collection cards
- **Card content:** Collection name, hero image (first artwork), artwork count
- **Interaction:** Click card to navigate to `/:artist/:gallery/:collection`
- **Pagination:** Support paginated collections list if gallery has many
- **Responsive:** 1 column mobile, 2-3 columns desktop
- **States:** Loading, empty (no collections), error
- **Images:** Hero image is first artwork in collection

---

## Prerequisites

**Must complete before starting:**
- **81-UI-PUBLIC-GALLERY.md** - Public gallery page
- **09-SCHEMA-COLLECTIONS.md** - Collections table with links to artworks
- **10-SCHEMA-ARTWORKS.md** - Artworks table with image URLs

**Reason:** Need gallery page and collections/artworks schema.

---

## Steps

### Step 1: Create Database Query Helper for Gallery Collections

Add to the galleries database module a function to fetch collections.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/db/galleries.ts` (update)

Add this interface at the top:

```typescript
/**
 * Public collection information for listing
 */
export interface PublicCollectionInfo {
  id: string
  slug: string
  name: string
  description: string | null
  heroImageUrl: string | null
  artworkCount: number
}
```

Add this function after the `getPublicGalleryDetails` function:

```typescript
/**
 * Fetch paginated list of public collections for a gallery
 * Returns only active collections with artwork counts
 * Collections are ordered by creation date (newest first)
 */
export async function getGalleryCollections(
  db: any,
  galleryId: string,
  page: number = 1,
  pageSize: number = 12
): Promise<{
  collections: PublicCollectionInfo[]
  total: number
}> {
  try {
    // Get total count of active collections for this gallery
    const countResult = await db
      .prepare(
        `
        SELECT COUNT(*) as count
        FROM collections
        WHERE galleryId = ? AND active = 1
        `
      )
      .bind(galleryId)
      .first()

    const total = countResult?.count || 0

    // Calculate offset
    const offset = (page - 1) * pageSize

    // Fetch collections with artwork counts and hero image
    const collections = await db
      .prepare(
        `
        SELECT
          c.id,
          c.slug,
          c.name,
          c.description,
          (
            SELECT imageUrl
            FROM artworks
            WHERE collectionId = c.id AND active = 1
            ORDER BY sequence ASC, createdAt ASC
            LIMIT 1
          ) as heroImageUrl,
          (
            SELECT COUNT(*)
            FROM artworks
            WHERE collectionId = c.id AND active = 1
          ) as artworkCount
        FROM collections c
        WHERE c.galleryId = ? AND c.active = 1
        ORDER BY c.createdAt DESC
        LIMIT ? OFFSET ?
        `
      )
      .bind(galleryId, pageSize, offset)
      .all()

    return {
      collections: collections.results?.map((c: any) => ({
        id: c.id,
        slug: c.slug,
        name: c.name,
        description: c.description,
        heroImageUrl: c.heroImageUrl,
        artworkCount: c.artworkCount || 0,
      })) || [],
      total,
    }
  } catch (error) {
    console.error('[getGalleryCollections] Database error:', error)
    throw error
  }
}
```

**Explanation:**
- Counts total active collections in gallery
- Paginates collections using LIMIT/OFFSET
- Uses subquery to get first artwork image as hero
- Counts artworks per collection with subquery
- Orders collections by creation date (newest first)
- Returns null for heroImageUrl if no artworks in collection

---

### Step 2: Create Collection Card Component

Create a reusable card component for displaying collection information.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/public/CollectionCard.tsx`

```typescript
import React from 'react'
import { Link } from 'react-router-dom'

export interface CollectionCardProps {
  artist: string
  gallery: string
  id: string
  slug: string
  name: string
  description: string | null
  heroImageUrl: string | null
  artworkCount: number
}

export default function CollectionCard({
  artist,
  gallery,
  id,
  slug,
  name,
  description,
  heroImageUrl,
  artworkCount,
}: CollectionCardProps) {
  const collectionUrl = `/${artist}/${gallery}/${slug}`

  return (
    <Link
      to={collectionUrl}
      className="group block overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow duration-200"
    >
      {/* Collection Hero Image */}
      <div className="relative w-full h-48 bg-gray-100 overflow-hidden">
        {heroImageUrl ? (
          <img
            src={heroImageUrl}
            alt={name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-200 to-gray-300">
            <span className="text-4xl text-gray-400">🎨</span>
          </div>
        )}
      </div>

      {/* Card Content */}
      <div className="p-4">
        {/* Collection Name */}
        <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors mb-2">
          {name}
        </h3>

        {/* Description Preview */}
        {description && (
          <p className="text-sm text-gray-600 mb-3 line-clamp-2">
            {description}
          </p>
        )}

        {/* Artwork Count */}
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span>🖼️</span>
          <span>
            {artworkCount} {artworkCount === 1 ? 'artwork' : 'artworks'}
          </span>
        </div>
      </div>
    </Link>
  )
}
```

**Explanation:**
- Link wraps entire card for easy navigation
- Hero image is first artwork in collection
- Placeholder with icon if no artworks
- Shows artwork count with icon
- Responsive with hover effects
- Uses `line-clamp-2` for description overflow

---

### Step 3: Create Collections Grid Component

Create a component for displaying paginated collections grid.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/public/CollectionsGrid.tsx`

```typescript
import React, { useState, useEffect } from 'react'
import CollectionCard from './CollectionCard'

interface Collection {
  id: string
  slug: string
  name: string
  description: string | null
  heroImageUrl: string | null
  artworkCount: number
}

interface CollectionsGridProps {
  artist: string
  gallery: string
  galleryId: string
  pageSize?: number
}

export default function CollectionsGrid({
  artist,
  gallery,
  galleryId,
  pageSize = 12,
}: CollectionsGridProps) {
  const [collections, setCollections] = useState<Collection[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  useEffect(() => {
    const fetchCollections = async () => {
      try {
        setLoading(true)
        setError(null)

        // Call collections API endpoint
        const url = new URL(`/api/g/${encodeURIComponent(artist)}/${encodeURIComponent(gallery)}/collections`, window.location.origin)
        url.searchParams.set('page', page.toString())
        url.searchParams.set('pageSize', pageSize.toString())

        const response = await fetch(url.toString())

        if (!response.ok) {
          throw new Error('Failed to load collections')
        }

        const data = await response.json()
        setCollections(data.data || [])
        setTotalPages(data.pagination?.totalPages || 1)
      } catch (err) {
        console.error('Error fetching collections:', err)
        setError('Failed to load collections')
        setCollections([])
      } finally {
        setLoading(false)
      }
    }

    fetchCollections()
  }, [artist, gallery, page, pageSize])

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(pageSize)].map((_, i) => (
          <div
            key={i}
            className="rounded-lg border border-gray-200 bg-white animate-pulse"
          >
            <div className="w-full h-48 bg-gray-200"></div>
            <div className="p-4 space-y-3">
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="h-3 bg-gray-200 rounded w-full"></div>
              <div className="h-3 bg-gray-200 rounded w-2/3"></div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
        <p className="text-gray-600 mb-4">{error}</p>
        <button
          onClick={() => setPage(1)}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
        >
          Try Again
        </button>
      </div>
    )
  }

  if (collections.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
        <p className="text-gray-600">No collections yet</p>
      </div>
    )
  }

  return (
    <div>
      {/* Collections Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {collections.map((collection) => (
          <CollectionCard
            key={collection.id}
            artist={artist}
            gallery={gallery}
            id={collection.id}
            slug={collection.slug}
            name={collection.name}
            description={collection.description}
            heroImageUrl={collection.heroImageUrl}
            artworkCount={collection.artworkCount}
          />
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="px-4 py-2 rounded border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Previous
          </button>

          {/* Page numbers */}
          <div className="flex gap-1">
            {[...Array(totalPages)].map((_, i) => {
              const pageNum = i + 1
              return (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={`px-3 py-2 rounded transition-colors ${
                    page === pageNum
                      ? 'bg-blue-500 text-white'
                      : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {pageNum}
                </button>
              )
            })}
          </div>

          <button
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 rounded border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
```

**Explanation:**
- Fetches collections from API on page change
- Displays loading skeleton grid
- Shows error with retry button
- Empty state if no collections
- Responsive grid (1, 2, 3 columns)
- Pagination controls
- Smooth loading states

---

### Step 4: Create Collections API Endpoint

Create the API endpoint to fetch collections for a gallery.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/routes/public/galleries.ts` (update)

Add this import at top:

```typescript
import { getGalleryCollections } from '../../lib/db/galleries'
import { parsePaginationParams } from '../../types/api'
```

Add this route handler (before the export):

```typescript
/**
 * GET /api/g/:artist/:gallery/collections
 * Fetch paginated collections for a gallery
 * No authentication required
 * Returns 404 if gallery not found
 */
publicGalleriesRouter.get('/:artist/:gallery/collections', async (c) => {
  const artist = c.req.param('artist')
  const gallery = c.req.param('gallery')

  // Validate parameters
  if (!artist || !gallery) {
    throw Errors.badRequest('Artist and gallery parameters are required')
  }

  // Parse pagination parameters
  const queryParams = c.req.query()
  const { page = 1, pageSize = 20 } = parsePaginationParams(
    queryParams as Record<string, string>
  )

  try {
    // First fetch gallery to verify it exists and get gallery ID
    const galleryDetails = await getPublicGalleryDetails(
      c.env.DB,
      artist,
      gallery
    )

    if (!galleryDetails) {
      throw Errors.notFound(`Gallery '${gallery}' not found`)
    }

    // Fetch collections for this gallery
    const { collections, total } = await getGalleryCollections(
      c.env.DB,
      galleryDetails.id,
      page,
      pageSize
    )

    const totalPages = Math.ceil(total / pageSize)

    // Return paginated response
    return c.json(
      {
        data: collections,
        pagination: {
          page,
          pageSize,
          total,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      },
      200
    )
  } catch (error) {
    // Re-throw ApiError instances
    if (error instanceof Error && 'statusCode' in error) {
      throw error
    }

    // Convert database errors to generic error
    console.error('[GET /api/g/:artist/:gallery/collections] Error:', error)
    throw Errors.internal('Failed to fetch collections')
  }
})
```

**Explanation:**
- Validates gallery exists before fetching collections
- Parses pagination parameters
- Calls database helper to fetch collections
- Returns 404 if gallery not found
- Returns paginated collection list with pagination metadata

---

### Step 5: Integrate Collections Grid into Gallery Page

Update the public gallery page to include the collections grid.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/pages/PublicGallery.tsx` (update)

Add import at top:

```typescript
import CollectionsGrid from '../components/public/CollectionsGrid'
```

Replace the collections section placeholder with:

```typescript
{/* Collections Section */}
<div className="max-w-6xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
  <h2 className="text-3xl font-bold mb-8">Collections</h2>
  <CollectionsGrid
    artist={artist}
    gallery={gallery}
    galleryId={galleryData.id}
    pageSize={12}
  />
</div>
```

**Explanation:**
- Replaces placeholder collections section
- Passes artist, gallery, and galleryId to grid
- 12 items per page (4 pages of 3 columns)

---

## Files to Create/Modify

**New files to create:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/public/CollectionCard.tsx`
2. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/public/CollectionsGrid.tsx`

**Files to modify:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/db/galleries.ts` - Add collection queries
2. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/routes/public/galleries.ts` - Add collections endpoint
3. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/pages/PublicGallery.tsx` - Integrate grid

---

## Verification

### Test 1: View Gallery with Collections

Navigate to gallery page:
```
http://localhost:5173/testuser/landscape-photography
```

Expected:
- Collections section displays
- Grid of collection cards shows
- Each card has name and artwork count
- Cards are clickable

---

### Test 2: Verify Hero Images

For collections with artworks:
- First artwork displays as hero image
- Image has hover scale effect
- Placeholder appears for empty collections

---

### Test 3: Verify Responsive Grid

Mobile viewport (< 640px):
- Collections in 1 column
- Cards full width

Tablet viewport (640px - 1024px):
- Collections in 2 columns

Desktop viewport (> 1024px):
- Collections in 3 columns

---

### Test 4: Click Collection Card

Click collection card:
- Should navigate to `/:artist/:gallery/:collection`
- Page loads (even if collection page not yet built)
- URL changes correctly

---

### Test 5: Test Empty State

For gallery with no collections:
- Shows "No collections yet" message
- No cards appear

---

### Test 6: Test Loading State

With network throttled to slow 3G:
- Shows skeleton loading grid
- Multiple placeholder cards
- Disappears when data loads

---

### Test 7: Test Error State

Mock API error:
- Shows "Failed to load collections" message
- Shows "Try Again" button
- Clicking retry refetches

---

### Test 8: Test Pagination (13+ collections)

Create 25 collections for test gallery:
- First page shows 12 collections
- Pagination controls appear
- Click "Next" shows page 2
- Page number buttons work
- Previous disabled on first page
- Next disabled on last page

---

### Test 9: Verify Artwork Counts

Collection has 5 artworks:
```bash
curl http://localhost:8788/api/g/testuser/landscape-photography/collections | jq '.data[0].artworkCount'
```

Expected: Returns 5 (or actual count).

---

### Test 10: Verify API Response Structure

```bash
curl http://localhost:8788/api/g/testuser/landscape-photography/collections
```

Expected response includes:
- `data` array of collections
- `pagination` object with total, page, pageSize, totalPages
- Each collection has: id, slug, name, description, heroImageUrl, artworkCount

---

## Summary

This build creates the collections grid for public gallery pages:
- Responsive grid layout (1-3 columns)
- Individual collection cards with hero images
- Pagination support for galleries with many collections
- Artwork counts per collection
- Loading skeleton for better UX
- Error handling with retry
- Empty state for galleries without collections
- Foundation for viewing individual collections

---

**Next step:** Proceed to **83-UI-GALLERY-MAP.md** to create the gallery navigation/sitemap component.
