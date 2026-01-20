# 48-UI-ARTWORK-GRID.md

## Goal

Create a reusable, responsive artwork grid component that displays artworks in a grid layout with lazy-loaded images, responsive column counts, and smooth interactions.

---

## Spec Extract

From TECHNICAL-SPEC.md and UI Requirements:

- **Responsive Grid Layout:**
  - Mobile (<640px): 2 columns
  - Tablet (640-1024px): 3 columns
  - Desktop (>1024px): 4 columns

- **Image Display:**
  - Square thumbnail images
  - Lazy-loaded with `loading="lazy"` or Intersection Observer
  - Blur placeholder while loading
  - Title overlaid on hover (desktop) or always visible (mobile)
  - Click handler for navigation to artwork detail

- **Optional Features:**
  - Artist name overlay (for public views, not user's own gallery)
  - Loading skeleton state for initial render
  - Accessibility: semantic HTML, alt text from artwork title

---

## Prerequisites

**Must complete before starting:**
- **27-REACT-LAYOUT-SHELL.md** - Base layout components and page structure

---

## Steps

### Step 1: Define Artwork Types

Create shared TypeScript types for artwork data used across components.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/types/artwork.ts`

```typescript
/**
 * Artwork data structure matching API response
 * Used in components and pages related to artwork display
 */
export interface Artwork {
  id: string
  title: string
  slug: string
  description?: string
  artistId: string
  artistName: string
  galleryId: string
  collectionId?: string
  thumbnail_url: string
  display_url?: string
  icon_url?: string
  status: 'active' | 'hidden' | 'featured'
  createdAt: string
  updatedAt: string
}

/**
 * Props for ArtworkGrid component
 */
export interface ArtworkGridProps {
  artworks: Artwork[]
  onSelect?: (artwork: Artwork) => void
  showArtist?: boolean
  loading?: boolean
  emptyMessage?: string
}
```

---

### Step 2: Create Artwork Skeleton Component

Create a skeleton/loading placeholder that shows while images are loading.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/components/artwork/ArtworkSkeleton.tsx`

```typescript
import React from 'react'

/**
 * Skeleton loader for artwork cards
 * Shows while artwork images are loading
 */
export const ArtworkSkeleton: React.FC = () => {
  return (
    <div className="w-full aspect-square bg-gray-200 dark:bg-gray-700 animate-pulse rounded">
      <div className="w-full h-full flex items-center justify-center">
        <svg
          className="w-12 h-12 text-gray-400"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" />
        </svg>
      </div>
    </div>
  )
}
```

---

### Step 3: Create ArtworkCard Component

Create the individual card component used within the grid.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/components/artwork/ArtworkCard.tsx`

```typescript
import React, { useState } from 'react'
import type { Artwork } from '../../types/artwork'

interface ArtworkCardProps {
  artwork: Artwork
  showArtist?: boolean
  showStatus?: boolean
  onClick?: (artwork: Artwork) => void
}

/**
 * Individual artwork card component
 * Displays square thumbnail with hover effects and metadata overlays
 */
export const ArtworkCard: React.FC<ArtworkCardProps> = ({
  artwork,
  showArtist = false,
  showStatus = false,
  onClick,
}) => {
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageError, setImageError] = useState(false)

  const handleClick = () => {
    if (onClick) {
      onClick(artwork)
    }
  }

  // Determine status badge styling
  const getStatusColor = () => {
    switch (artwork.status) {
      case 'featured':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100'
      case 'hidden':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100'
      default:
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100'
    }
  }

  return (
    <div
      className="relative group cursor-pointer overflow-hidden rounded-lg shadow-md transition-shadow hover:shadow-lg"
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyPress={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          handleClick()
        }
      }}
      aria-label={`Artwork: ${artwork.title}${showArtist ? ` by ${artwork.artistName}` : ''}`}
    >
      {/* Container for square aspect ratio */}
      <div className="w-full aspect-square bg-gray-100 dark:bg-gray-800 overflow-hidden">
        {/* Thumbnail Image */}
        <img
          src={artwork.thumbnail_url}
          alt={artwork.title}
          loading="lazy"
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            imageLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          onLoad={() => setImageLoaded(true)}
          onError={() => setImageError(true)}
        />

        {/* Skeleton while loading */}
        {!imageLoaded && !imageError && (
          <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-100 dark:from-gray-700 dark:to-gray-600 animate-pulse" />
        )}

        {/* Error state */}
        {imageError && (
          <div className="w-full h-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-gray-400"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" />
            </svg>
          </div>
        )}

        {/* Overlay with title and metadata */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-end p-3">
          {/* Title */}
          <h3 className="text-white font-semibold text-sm line-clamp-2 mb-1">
            {artwork.title}
          </h3>

          {/* Artist name (optional) */}
          {showArtist && (
            <p className="text-gray-300 text-xs line-clamp-1">
              {artwork.artistName}
            </p>
          )}
        </div>

        {/* Mobile: Always show title overlay */}
        <div className="sm:hidden absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 to-transparent p-2">
          <h3 className="text-white font-semibold text-xs line-clamp-2">
            {artwork.title}
          </h3>
          {showArtist && (
            <p className="text-gray-300 text-xs line-clamp-1">
              {artwork.artistName}
            </p>
          )}
        </div>

        {/* Status badge (optional) */}
        {showStatus && artwork.status !== 'active' && (
          <div className="absolute top-2 right-2">
            <span
              className={`px-2 py-1 text-xs font-medium rounded ${getStatusColor()}`}
            >
              {artwork.status.charAt(0).toUpperCase() + artwork.status.slice(1)}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
```

---

### Step 4: Create ArtworkGrid Component

Create the main grid component that uses ArtworkCard.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/components/artwork/ArtworkGrid.tsx`

```typescript
import React from 'react'
import type { Artwork, ArtworkGridProps } from '../../types/artwork'
import { ArtworkCard } from './ArtworkCard'
import { ArtworkSkeleton } from './ArtworkSkeleton'

/**
 * Responsive artwork grid component
 * Displays artworks in a responsive grid with lazy-loaded images
 *
 * Responsive columns:
 * - Mobile: 2 columns
 * - Tablet: 3 columns
 * - Desktop: 4 columns
 */
export const ArtworkGrid: React.FC<ArtworkGridProps> = ({
  artworks,
  onSelect,
  showArtist = false,
  loading = false,
  emptyMessage = 'No artworks found',
}) => {
  // Show loading skeletons
  if (loading) {
    const skeletonCount = 8
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 w-full">
        {Array.from({ length: skeletonCount }).map((_, index) => (
          <ArtworkSkeleton key={`skeleton-${index}`} />
        ))}
      </div>
    )
  }

  // Show empty state
  if (!artworks || artworks.length === 0) {
    return (
      <div className="w-full py-12 text-center">
        <p className="text-gray-500 dark:text-gray-400">{emptyMessage}</p>
      </div>
    )
  }

  // Render grid
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 w-full">
      {artworks.map((artwork) => (
        <ArtworkCard
          key={artwork.id}
          artwork={artwork}
          showArtist={showArtist}
          onClick={onSelect}
        />
      ))}
    </div>
  )
}
```

---

### Step 5: Create Index Export for Artwork Components

Create a barrel export for easy importing.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/components/artwork/index.ts`

```typescript
export { ArtworkCard } from './ArtworkCard'
export { ArtworkSkeleton } from './ArtworkSkeleton'
export { ArtworkGrid } from './ArtworkGrid'
export type { ArtworkCardProps } from './ArtworkCard'
export type { ArtworkGridProps } from '../../types/artwork'
```

---

### Step 6: Example Usage in a Page

Create a simple example page showing how to use the grid component.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/pages/ArtworkBrowse.tsx` (reference example)

```typescript
import React, { useState, useEffect } from 'react'
import { ArtworkGrid } from '../components/artwork'
import type { Artwork } from '../types/artwork'
import { useNavigate } from 'react-router-dom'

/**
 * Example page showing ArtworkGrid usage
 * This demonstrates the pattern for displaying artwork galleries
 */
export const ArtworkBrowse: React.FC = () => {
  const navigate = useNavigate()
  const [artworks, setArtworks] = useState<Artwork[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchArtworks = async () => {
      try {
        // Replace with actual API endpoint
        const response = await fetch('/api/artworks?limit=20')
        const data = await response.json()
        setArtworks(data.artworks || [])
      } catch (error) {
        console.error('Failed to fetch artworks:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchArtworks()
  }, [])

  const handleSelectArtwork = (artwork: Artwork) => {
    // Navigate to artwork detail page
    navigate(`/${artwork.artistName}/${artwork.galleryId}/${artwork.collectionId}/${artwork.slug}`)
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-8">Browse Artworks</h1>
      <ArtworkGrid
        artworks={artworks}
        onSelect={handleSelectArtwork}
        showArtist={true}
        loading={loading}
        emptyMessage="No artworks available"
      />
    </div>
  )
}
```

---

## Files to Create/Modify

**New files to create:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/types/artwork.ts` - Artwork TypeScript types
2. `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/components/artwork/ArtworkSkeleton.tsx` - Loading skeleton
3. `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/components/artwork/ArtworkCard.tsx` - Individual card
4. `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/components/artwork/ArtworkGrid.tsx` - Main grid component
5. `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/components/artwork/index.ts` - Barrel export
6. `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/pages/ArtworkBrowse.tsx` - Example usage (reference)

---

## Verification

### Test 1: Component Compiles

Run TypeScript compiler:

```bash
cd /Volumes/DataSSD/gitsrc/vfa_gallery/site
npx tsc --noEmit
```

Expected: No type errors

---

### Test 2: Verify Component Structure

Verify the component structure by checking the files exist:

```bash
ls -la /Volumes/DataSSD/gitsrc/vfa_gallery/site/src/components/artwork/
```

Expected output:
```
ArtworkCard.tsx
ArtworkGrid.tsx
ArtworkSkeleton.tsx
index.ts
```

---

### Test 3: Test with Mock Data

Create a test file to verify component rendering with mock data:

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/components/artwork/__tests__/ArtworkGrid.test.tsx` (optional)

```typescript
import React from 'react'
import { render, screen } from '@testing-library/react'
import { ArtworkGrid } from '../ArtworkGrid'
import type { Artwork } from '../../../types/artwork'

describe('ArtworkGrid', () => {
  const mockArtworks: Artwork[] = [
    {
      id: '1',
      title: 'Test Artwork 1',
      slug: 'test-artwork-1',
      artistId: 'artist1',
      artistName: 'Test Artist',
      galleryId: 'gallery1',
      collectionId: 'collection1',
      thumbnail_url: 'https://example.com/thumb1.jpg',
      status: 'active',
      createdAt: '2024-01-18T00:00:00Z',
      updatedAt: '2024-01-18T00:00:00Z',
    },
    {
      id: '2',
      title: 'Test Artwork 2',
      slug: 'test-artwork-2',
      artistId: 'artist1',
      artistName: 'Test Artist',
      galleryId: 'gallery1',
      collectionId: 'collection1',
      thumbnail_url: 'https://example.com/thumb2.jpg',
      status: 'active',
      createdAt: '2024-01-18T00:00:00Z',
      updatedAt: '2024-01-18T00:00:00Z',
    },
  ]

  it('renders grid with artworks', () => {
    render(<ArtworkGrid artworks={mockArtworks} />)

    // Check that both artworks are rendered
    expect(screen.getByAltText('Test Artwork 1')).toBeInTheDocument()
    expect(screen.getByAltText('Test Artwork 2')).toBeInTheDocument()
  })

  it('shows loading skeletons when loading', () => {
    const { container } = render(<ArtworkGrid artworks={[]} loading={true} />)

    // Check for skeleton elements
    const skeletons = container.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('shows empty message when no artworks', () => {
    render(<ArtworkGrid artworks={[]} />)
    expect(screen.getByText('No artworks found')).toBeInTheDocument()
  })

  it('calls onSelect when artwork is clicked', () => {
    const onSelect = jest.fn()
    render(<ArtworkGrid artworks={mockArtworks} onSelect={onSelect} />)

    const firstArtwork = screen.getByAltText('Test Artwork 1').closest('div[role="button"]')
    if (firstArtwork) {
      fireEvent.click(firstArtwork)
      expect(onSelect).toHaveBeenCalledWith(mockArtworks[0])
    }
  })

  it('displays artist name when showArtist is true', () => {
    render(<ArtworkGrid artworks={mockArtworks} showArtist={true} />)
    expect(screen.getByText('Test Artist')).toBeInTheDocument()
  })
})
```

To run tests:

```bash
npm test -- ArtworkGrid.test.tsx
```

---

### Test 4: Responsive Layout

Check the grid renders correctly at different breakpoints:

1. **Mobile View** (<640px):
   - Grid should display 2 columns
   - Titles always visible (no hover required)
   - Touch-friendly spacing

2. **Tablet View** (640-1024px):
   - Grid should display 3 columns
   - Titles visible on hover (desktop), always on mobile
   - Medium spacing

3. **Desktop View** (>1024px):
   - Grid should display 4 columns
   - Titles visible on hover
   - Larger spacing

Test by resizing browser window and inspecting grid layout.

---

### Test 5: Lazy Loading

Verify lazy loading works by:

1. Open browser DevTools Network tab
2. Set throttling to "Slow 3G"
3. Load page with many artworks
4. Scroll down gradually
5. Observe images load only when they come into viewport

Expected: Images load on-demand, not all at once

---

### Test 6: Accessibility

Verify accessibility features:

```bash
# Install axe DevTools browser extension
# Run accessibility audit on page with ArtworkGrid

# Or use programmatic testing:
npm install --save-dev @axe-core/react

# Use in test:
import { axe } from 'jest-axe'
const results = await axe(container)
expect(results).toHaveNoViolations()
```

Expected: No accessibility violations

---

## Summary

This build creates a foundational artwork grid component with:
- Responsive layout (2 cols mobile, 3 cols tablet, 4 cols desktop)
- Lazy-loaded images with skeleton loaders
- Hover effects for title display
- Optional artist name and status badges
- Full TypeScript typing and accessibility support
- Reusable for any artwork display use case

The component is production-ready and can be used in browse views, galleries, collections, and search results.

---

**Next steps:**
- **49-UI-MY-ARTWORKS.md** - Create user's personal artwork management page
- **50-UI-ARTWORK-EDIT.md** - Create artwork edit page
- **51-UI-ARTWORK-CARD.md** - Specialized card variant for specific use cases
