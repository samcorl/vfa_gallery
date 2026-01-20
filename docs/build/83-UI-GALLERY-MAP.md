# 83-UI-GALLERY-MAP.md

## Goal
Create a hierarchical gallery navigation/sitemap component that displays the structure of a gallery (Gallery > Collections > Artwork counts). Shows a collapsible tree view allowing quick navigation and understanding of gallery organization.

---

## Spec Extract

From TECHNICAL-SPEC.md:
- **Display:** Hierarchical tree structure
- **Levels:** Gallery (root), Collections (expandable), Artwork counts
- **Interaction:** Click to collapse/expand collections
- **Navigation:** Quick links to each collection
- **Placement:** Sidebar on gallery page (optional) or dedicated view
- **Styling:** Indentation shows hierarchy, icons for expand/collapse
- **Responsive:** Sticky sidebar on desktop, collapsible panel on mobile

---

## Prerequisites

**Must complete before starting:**
- **81-UI-PUBLIC-GALLERY.md** - Public gallery page
- **82-UI-PUBLIC-GALLERY-COLLECTIONS.md** - Collections grid (for data context)

**Reason:** Gallery map enhances navigation on gallery pages.

---

## Steps

### Step 1: Create Gallery Structure Helper

Create a utility to build hierarchical gallery structure from API data.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/gallery-structure.ts`

```typescript
/**
 * Gallery structure node for hierarchical display
 */
export interface GalleryNode {
  type: 'gallery'
  id: string
  name: string
  slug: string
  artist: string
  collections: CollectionNode[]
  totalArtworks: number
}

export interface CollectionNode {
  type: 'collection'
  id: string
  name: string
  slug: string
  artworkCount: number
}

/**
 * Build gallery structure from API data
 * Combines gallery info with collections
 */
export function buildGalleryStructure(
  galleryData: any,
  collectionsData: any[]
): GalleryNode {
  // Count total artworks across all collections
  const totalArtworks = collectionsData.reduce(
    (sum, c) => sum + (c.artworkCount || 0),
    0
  )

  // Transform collections to nodes
  const collections: CollectionNode[] = collectionsData.map((c) => ({
    type: 'collection',
    id: c.id,
    name: c.name,
    slug: c.slug,
    artworkCount: c.artworkCount,
  }))

  return {
    type: 'gallery',
    id: galleryData.id,
    name: galleryData.name,
    slug: galleryData.slug,
    artist: galleryData.artist.username,
    collections,
    totalArtworks,
  }
}

/**
 * Get flat list of all items for search/filter
 */
export function flattenGalleryStructure(node: GalleryNode): Array<{
  type: 'gallery' | 'collection'
  id: string
  name: string
  level: number
  parent?: string
}> {
  const items: Array<{
    type: 'gallery' | 'collection'
    id: string
    name: string
    level: number
    parent?: string
  }> = [
    {
      type: 'gallery',
      id: node.id,
      name: node.name,
      level: 0,
    },
  ]

  node.collections.forEach((collection) => {
    items.push({
      type: 'collection',
      id: collection.id,
      name: collection.name,
      level: 1,
      parent: node.id,
    })
  })

  return items
}
```

**Explanation:**
- Defines hierarchical structure types
- `buildGalleryStructure` combines gallery and collections data
- `flattenGalleryStructure` creates searchable list
- Counts total artworks across collections

---

### Step 2: Create Gallery Map Node Component

Create a component for individual tree nodes.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/public/GalleryMapNode.tsx`

```typescript
import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { GalleryNode, CollectionNode } from '../../lib/gallery-structure'

interface GalleryMapNodeProps {
  node: GalleryNode
  artist: string
  gallery: string
  currentCollection?: string
}

export default function GalleryMapNode({
  node,
  artist,
  gallery,
  currentCollection,
}: GalleryMapNodeProps) {
  const [expanded, setExpanded] = useState(true)

  return (
    <div className="font-sans">
      {/* Gallery Root Node */}
      <div className="mb-4 pb-4 border-b">
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={() => setExpanded(!expanded)}
            className="inline-flex items-center justify-center w-6 h-6 rounded hover:bg-gray-100 transition-colors"
            title={expanded ? 'Collapse' : 'Expand'}
          >
            <span className={`transition-transform ${expanded ? 'rotate-90' : ''}`}>
              ▶️
            </span>
          </button>
          <span className="text-sm font-semibold text-gray-700">
            📚 {node.name}
          </span>
        </div>

        {/* Gallery Stats */}
        <div className="ml-8 text-sm text-gray-600 space-y-1">
          <p>
            📂 {node.collections.length}{' '}
            {node.collections.length === 1 ? 'collection' : 'collections'}
          </p>
          <p>
            🖼️ {node.totalArtworks}{' '}
            {node.totalArtworks === 1 ? 'artwork' : 'artworks'}
          </p>
        </div>
      </div>

      {/* Collections List */}
      {expanded && node.collections.length > 0 && (
        <div className="space-y-2 ml-2">
          {node.collections.map((collection) => (
            <CollectionMapNode
              key={collection.id}
              collection={collection}
              artist={artist}
              gallery={gallery}
              isActive={currentCollection === collection.slug}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Individual collection node component
 */
interface CollectionMapNodeProps {
  collection: CollectionNode
  artist: string
  gallery: string
  isActive: boolean
}

function CollectionMapNode({
  collection,
  artist,
  gallery,
  isActive,
}: CollectionMapNodeProps) {
  const collectionUrl = `/${artist}/${gallery}/${collection.slug}`

  return (
    <Link
      to={collectionUrl}
      className={`
        flex items-center gap-2 px-3 py-2 rounded transition-colors
        ${
          isActive
            ? 'bg-blue-100 text-blue-700 font-semibold'
            : 'text-gray-700 hover:bg-gray-100'
        }
      `}
    >
      <span>📁</span>
      <span className="flex-1 truncate">{collection.name}</span>
      <span className="text-xs text-gray-500">
        {collection.artworkCount}
      </span>
    </Link>
  )
}
```

**Explanation:**
- Displays gallery root with expand/collapse button
- Shows collection count and total artworks
- Renders collections as clickable links
- Highlights current collection
- Hierarchical indentation via styling
- Responsive with truncated text

---

### Step 3: Create Gallery Map Component

Create the main gallery map/sidebar component.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/public/GalleryMap.tsx`

```typescript
import React, { useState, useEffect } from 'react'
import GalleryMapNode from './GalleryMapNode'
import {
  GalleryNode,
  buildGalleryStructure,
} from '../../lib/gallery-structure'

interface GalleryMapProps {
  artist: string
  gallery: string
  galleryId: string
  currentCollection?: string
  className?: string
}

export default function GalleryMap({
  artist,
  gallery,
  galleryId,
  currentCollection,
  className = '',
}: GalleryMapProps) {
  const [structure, setStructure] = useState<GalleryNode | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    const fetchStructure = async () => {
      try {
        setLoading(true)
        setError(null)

        // Fetch gallery details (already have this)
        const galleryResponse = await fetch(
          `/api/g/${encodeURIComponent(artist)}/${encodeURIComponent(gallery)}`
        )

        if (!galleryResponse.ok) {
          throw new Error('Failed to load gallery')
        }

        const galleryData = await galleryResponse.json()

        // Fetch collections
        const url = new URL(
          `/api/g/${encodeURIComponent(artist)}/${encodeURIComponent(gallery)}/collections`,
          window.location.origin
        )
        url.searchParams.set('pageSize', '100') // Get all collections

        const collectionsResponse = await fetch(url.toString())

        if (!collectionsResponse.ok) {
          throw new Error('Failed to load collections')
        }

        const collectionsData = await collectionsResponse.json()

        // Build structure
        const galleryStructure = buildGalleryStructure(
          galleryData.data,
          collectionsData.data || []
        )

        setStructure(galleryStructure)
      } catch (err) {
        console.error('Error fetching gallery structure:', err)
        setError('Failed to load gallery map')
      } finally {
        setLoading(false)
      }
    }

    fetchStructure()
  }, [artist, gallery])

  if (loading) {
    return (
      <div
        className={`${className} p-4 bg-white rounded-lg border border-gray-200`}
      >
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-3 bg-gray-200 rounded w-full"></div>
          <div className="h-3 bg-gray-200 rounded w-5/6"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div
        className={`${className} p-4 bg-white rounded-lg border border-gray-200`}
      >
        <p className="text-sm text-gray-600">{error}</p>
      </div>
    )
  }

  if (!structure) {
    return null
  }

  return (
    <div className={`${className}`}>
      {/* Mobile Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="md:hidden w-full mb-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2"
      >
        <span>🗺️</span>
        <span>{isOpen ? 'Hide' : 'Show'} Gallery Map</span>
      </button>

      {/* Gallery Map Content */}
      <div
        className={`
          bg-white rounded-lg border border-gray-200 p-4
          ${isOpen ? 'block' : 'hidden'} md:block
        `}
      >
        <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
          <span>🗺️</span>
          Gallery Structure
        </h3>

        <GalleryMapNode
          node={structure}
          artist={artist}
          gallery={gallery}
          currentCollection={currentCollection}
        />
      </div>
    </div>
  )
}
```

**Explanation:**
- Fetches gallery and collections data on mount
- Builds hierarchical structure
- Displays gallery map with collapsible collections
- Mobile toggle button for responsive design
- Sticky positioning available via className
- Shows current collection highlight
- Loading and error states

---

### Step 4: Create Sidebar Layout for Gallery Page

Update the gallery page to include the sidebar with gallery map.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/pages/PublicGallery.tsx` (update)

Add import:

```typescript
import GalleryMap from '../components/public/GalleryMap'
```

Wrap the collections section in a grid layout:

```typescript
{/* Main Content with Sidebar */}
<div className="max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-4 gap-8">
  {/* Collections Grid - 3 columns on desktop */}
  <div className="lg:col-span-3">
    <h2 className="text-3xl font-bold mb-8">Collections</h2>
    <CollectionsGrid
      artist={artist}
      gallery={gallery}
      galleryId={galleryData.id}
      pageSize={12}
    />
  </div>

  {/* Gallery Map Sidebar - 1 column on desktop */}
  <aside className="lg:col-span-1">
    <div className="sticky top-4">
      <GalleryMap
        artist={artist}
        gallery={gallery}
        galleryId={galleryData.id}
        currentCollection={undefined}
      />
    </div>
  </aside>
</div>
```

Replace the old collections section with this new layout.

**Explanation:**
- Creates two-column layout (collections 3 cols, map 1 col)
- Map stays sticky on scroll on desktop
- Mobile: full width toggle
- Improves navigation and discoverability

---

### Step 5: Add Gallery Map to Artist Profile

Optionally add a simpler gallery map to the artist profile page.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/pages/PublicArtist.tsx` (optional update)

This is optional - gallery map might be too much for artist page. Can add a simpler collection tree if desired.

---

## Files to Create/Modify

**New files to create:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/gallery-structure.ts`
2. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/public/GalleryMapNode.tsx`
3. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/public/GalleryMap.tsx`

**Files to modify:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/pages/PublicGallery.tsx` - Integrate sidebar layout

---

## Verification

### Test 1: View Gallery with Map

Navigate to gallery page:
```
http://localhost:5173/testuser/landscape-photography
```

Expected:
- Gallery map appears on right sidebar (desktop)
- Shows gallery name with statistics
- Collections listed below
- Mobile: toggle button to show/hide map

---

### Test 2: Expand/Collapse Gallery Node

Click expand/collapse button on gallery name:
- Arrow rotates
- Collections list toggles
- Map state persists on same page

---

### Test 3: Click Collection Link

Click any collection in map:
- Navigates to collection page
- Current collection highlighted in map

---

### Test 4: View Map Stats

For gallery with 3 collections and 10 artworks:
- Map shows: "3 collections"
- Map shows: "10 artworks"
- Stats are accurate

---

### Test 5: Mobile View

On mobile viewport (< 1024px):
- Map is hidden by default
- Shows "Show Gallery Map" button
- Click button reveals map
- Click again hides map
- Map is full width when visible

---

### Test 6: Desktop Sticky Positioning

On desktop with long collection list:
- Scroll down page
- Map stays at top of viewport
- Map doesn't overlap content
- Scrolls off top when sidebar scrolls

---

### Test 7: Empty Gallery

For gallery with no collections:
- Map shows "0 collections"
- Map shows "0 artworks"
- Collections list is empty

---

### Test 8: Large Gallery

For gallery with 50+ collections:
- Map displays all collections
- Can scroll within map on desktop
- Mobile shows scrollable list when toggled

---

### Test 9: Test with Different Gallery

Navigate between galleries:
- `/testuser/gallery1`
- `/testuser/gallery2`
- `/different-artist/gallery3`

Verify:
- Map updates correctly
- Collections list changes
- Stats are accurate for each gallery

---

### Test 10: Verify Responsive Behavior

Test at different breakpoints:
- 320px (mobile): Toggle button visible
- 768px (tablet): Smaller layout
- 1024px (desktop): Full sidebar layout
- 1440px (large desktop): Full featured

---

## Summary

This build creates the gallery navigation/sitemap component:
- Hierarchical tree view of gallery structure
- Collapsible collections list
- Gallery statistics (collections, artworks)
- Quick navigation to any collection
- Sticky sidebar on desktop
- Responsive toggle on mobile
- Loading and error states
- Improves gallery discoverability and navigation

---

**Summary of Phases 14-15 Complete**

All 8 build instruction files for public views (artist & gallery) have been created:

1. **76-API-PUBLIC-USER.md** - Public user profile endpoint
2. **77-API-PUBLIC-USER-GALLERIES.md** - Public galleries list endpoint
3. **78-UI-PUBLIC-ARTIST.md** - Artist profile page
4. **79-UI-PUBLIC-ARTIST-GALLERIES.md** - Galleries grid on artist page
5. **80-API-PUBLIC-GALLERY.md** - Gallery details endpoint
6. **81-UI-PUBLIC-GALLERY.md** - Gallery page with theme support
7. **82-UI-PUBLIC-GALLERY-COLLECTIONS.md** - Collections grid on gallery page
8. **83-UI-GALLERY-MAP.md** - Gallery navigation/sitemap component

These files provide the complete infrastructure for public-facing artist portfolios and gallery views, with full pagination, theme support, and responsive design.
