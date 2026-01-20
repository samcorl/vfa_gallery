# 79-UI-PUBLIC-ARTIST-GALLERIES.md

## Goal
Create a galleries grid component that displays on the public artist profile page. Shows all artist's galleries as clickable cards with collection counts and welcome text, allowing visitors to navigate to each gallery.

---

## Spec Extract

From TECHNICAL-SPEC.md:
- **Location:** Artist profile page (/:artist)
- **Display:** Grid of gallery cards
- **Card content:** Gallery name, collection count, welcome text preview
- **Interaction:** Click card to navigate to `/:artist/:gallery`
- **Pagination:** Support paginated gallery lists if artist has many galleries
- **Responsive:** 1 column mobile, 2-3 columns desktop
- **States:** Loading, empty (no galleries), error

---

## Prerequisites

**Must complete before starting:**
- **78-UI-PUBLIC-ARTIST.md** - Public artist profile page
- **77-API-PUBLIC-USER-GALLERIES.md** - Public galleries list endpoint
- **61-UI-GALLERY-CARD.md** - Basic gallery card component (if available)

**Reason:** Need artist profile page and galleries API endpoint.

---

## Steps

### Step 1: Create Gallery Card Component

Create a reusable card component for displaying gallery information.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/public/GalleryCard.tsx`

```typescript
import React from 'react'
import { Link } from 'react-router-dom'

export interface GalleryCardProps {
  artist: string
  id: string
  slug: string
  name: string
  welcome: string | null
  collectionCount: number
  heroImageUrl?: string | null
}

export default function GalleryCard({
  artist,
  id,
  slug,
  name,
  welcome,
  collectionCount,
  heroImageUrl,
}: GalleryCardProps) {
  const galleryUrl = `/${artist}/${slug}`

  return (
    <Link
      to={galleryUrl}
      className="group block overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow duration-200"
    >
      {/* Gallery Image or Placeholder */}
      <div className="relative w-full h-48 bg-gray-100 overflow-hidden">
        {heroImageUrl ? (
          <img
            src={heroImageUrl}
            alt={name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-200 to-gray-300">
            <span className="text-4xl text-gray-400">🖼️</span>
          </div>
        )}
      </div>

      {/* Card Content */}
      <div className="p-4">
        {/* Gallery Name */}
        <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors mb-2">
          {name}
        </h3>

        {/* Welcome Text Preview */}
        {welcome && (
          <p className="text-sm text-gray-600 mb-3 line-clamp-2">
            {welcome}
          </p>
        )}

        {/* Collection Count */}
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span>📚</span>
          <span>
            {collectionCount} {collectionCount === 1 ? 'collection' : 'collections'}
          </span>
        </div>
      </div>
    </Link>
  )
}
```

**Explanation:**
- Link wraps entire card for easy navigation
- Hero image with hover scale effect
- Placeholder with icon if no image
- Shows collection count with icon
- Responsive with shadow effects
- Uses `line-clamp-2` for welcome text overflow

---

### Step 2: Create Gallery Grid Component

Create a component for displaying paginated gallery grid.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/public/GalleryGrid.tsx`

```typescript
import React, { useState, useEffect } from 'react'
import GalleryCard from './GalleryCard'

interface Gallery {
  id: string
  slug: string
  name: string
  welcome: string | null
  theme: string | null
  collectionCount: number
}

interface GalleryGridProps {
  artist: string
  pageSize?: number
}

export default function GalleryGrid({
  artist,
  pageSize = 12,
}: GalleryGridProps) {
  const [galleries, setGalleries] = useState<Gallery[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  useEffect(() => {
    const fetchGalleries = async () => {
      try {
        setLoading(true)
        setError(null)

        const url = new URL(
          `/api/users/${encodeURIComponent(artist)}/galleries`,
          window.location.origin
        )
        url.searchParams.set('page', page.toString())
        url.searchParams.set('pageSize', pageSize.toString())

        const response = await fetch(url.toString())

        if (!response.ok) {
          throw new Error('Failed to load galleries')
        }

        const data = await response.json()
        setGalleries(data.data || [])
        setTotalPages(data.pagination?.totalPages || 1)
      } catch (err) {
        console.error('Error fetching galleries:', err)
        setError('Failed to load galleries')
        setGalleries([])
      } finally {
        setLoading(false)
      }
    }

    fetchGalleries()
  }, [artist, page, pageSize])

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

  if (galleries.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
        <p className="text-gray-600">No galleries yet</p>
      </div>
    )
  }

  return (
    <div>
      {/* Gallery Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {galleries.map((gallery) => (
          <GalleryCard
            key={gallery.id}
            artist={artist}
            id={gallery.id}
            slug={gallery.slug}
            name={gallery.name}
            welcome={gallery.welcome}
            collectionCount={gallery.collectionCount}
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
- Fetches galleries from API on page change
- Displays loading skeleton grid
- Shows error with retry button
- Empty state if no galleries
- Responsive grid (1, 2, 3 columns)
- Pagination controls with page numbers
- Smooth loading states

---

### Step 3: Integrate Gallery Grid into Artist Profile

Update the public artist profile page to include the gallery grid.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/pages/PublicArtist.tsx`

Add import at top:

```typescript
import GalleryGrid from '../components/public/GalleryGrid'
```

Replace the galleries section (the placeholder div) with:

```typescript
{/* Galleries Section */}
<div className="max-w-6xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
  <h2 className="text-3xl font-bold text-gray-900 mb-8">Galleries</h2>
  <GalleryGrid artist={artist} pageSize={12} />
</div>
```

So the complete return statement becomes:

```typescript
return (
  <ErrorBoundary>
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row gap-8 items-start">
            {/* Avatar */}
            <PublicAvatar
              avatarUrl={profile.avatarUrl}
              displayName={profile.displayName}
              username={profile.username}
              size="lg"
            />

            {/* Profile Info */}
            <div className="flex-1">
              {/* Name and Username */}
              <div className="mb-4">
                <h1 className="text-4xl font-bold text-gray-900">
                  {profile.displayName || profile.username}
                </h1>
                <p className="text-lg text-gray-600">@{profile.username}</p>
              </div>

              {/* Bio */}
              {profile.bio && (
                <p className="text-gray-700 mb-6 text-lg leading-relaxed">
                  {profile.bio}
                </p>
              )}

              {/* Website */}
              {profile.website && (
                <p className="mb-6">
                  <a
                    href={profile.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:underline flex items-center gap-2"
                  >
                    <span>🔗</span>
                    {profile.website.replace(/^https?:\/\/(www\.)?/, '')}
                  </a>
                </p>
              )}

              {/* Social Links */}
              <SocialLinks socials={profile.socials} className="mb-8" />

              {/* Stats */}
              <div className="flex gap-8">
                <div>
                  <p className="text-2xl font-bold text-gray-900">
                    {profile.galleriesCount}
                  </p>
                  <p className="text-gray-600">
                    {profile.galleriesCount === 1 ? 'Gallery' : 'Galleries'}
                  </p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">
                    {profile.artworksCount}
                  </p>
                  <p className="text-gray-600">
                    {profile.artworksCount === 1 ? 'Artwork' : 'Artworks'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Galleries Section */}
      <div className="max-w-6xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-8">Galleries</h2>
        <GalleryGrid artist={artist} pageSize={12} />
      </div>
    </div>
  </ErrorBoundary>
)
```

**Explanation:**
- Replaces placeholder gallery section
- Passes artist username to grid component
- Uses 12 items per page (4 pages of 3 columns)
- Increased max-width to accommodate gallery grid

---

## Files to Create/Modify

**New files to create:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/public/GalleryCard.tsx`
2. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/public/GalleryGrid.tsx`

**Files to modify:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/pages/PublicArtist.tsx` - Integrate gallery grid

---

## Verification

### Test 1: View Artist Profile with Galleries

Navigate to:
```
http://localhost:5173/testuser
```

Expected:
- Hero section displays
- "Galleries" heading appears
- Grid of gallery cards displays
- Each card shows gallery name and collection count
- Cards are clickable

---

### Test 2: Verify Responsive Grid

Mobile viewport (< 640px):
- Cards display in 1 column
- Cards are full width with padding

Tablet viewport (640px - 1024px):
- Cards display in 2 columns
- Gap between cards is visible

Desktop viewport (> 1024px):
- Cards display in 3 columns
- Grid is centered with max-width
- Balanced layout

---

### Test 3: Click Gallery Card

Click any gallery card:
- Should navigate to `/:artist/:gallery` (will need next build)
- Browser URL changes
- Loading state appears for next page

---

### Test 4: Test Empty State

For an artist with no galleries:
- Grid displays "No galleries yet" message
- No cards appear

---

### Test 5: Test Loading State

With network throttled to slow 3G:
- Should show skeleton loading grid
- Shows multiple placeholder cards
- Disappears when data loads

---

### Test 6: Test Error State

Mock API error by temporarily breaking the endpoint:
- Shows "Failed to load galleries" message
- Shows "Try Again" button
- Clicking retry refetches data

---

### Test 7: Test Pagination (if artist has 13+ galleries)

Create 25 galleries for test artist:
- First page shows 12 galleries
- Pagination controls appear
- Click "Next" button
- Shows page 2 with remaining galleries
- Page number buttons highlight current page
- Previous button disabled on first page
- Next button disabled on last page

---

### Test 8: Verify Gallery Statistics Match

Count galleries in database:
- User profile shows gallery count
- Pagination total matches count
- No galleries missing or duplicated

---

## Summary

This build creates the galleries grid for public artist profiles:
- Responsive grid layout (1-3 columns)
- Individual gallery cards with collection counts
- Pagination support for artists with many galleries
- Loading skeleton for better UX
- Error handling with retry
- Empty state for artists without galleries
- Foundation for viewing artist's complete portfolio

---

**Next step:** Proceed to **80-API-PUBLIC-GALLERY.md** to create the endpoint for fetching a specific public gallery.
