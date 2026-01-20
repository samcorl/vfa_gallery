# 51-UI-ARTWORK-CARD.md

## Goal

Create a reusable artwork card component for displaying individual artworks in grid layouts, featuring lazy-loaded images, hover effects, optional overlays, and accessible navigation.

---

## Spec Extract

From TECHNICAL-SPEC.md and UI Requirements:

- **Image Display:**
  - Square thumbnail using `thumbnail_url`
  - Lazy-loaded with `loading="lazy"` attribute
  - Blur-up placeholder during load
  - Smooth fade-in transition

- **Hover Interaction (Desktop):**
  - Title overlay appears on hover with semi-transparent background
  - Smooth opacity transition
  - Mobile: Title always visible or shown on tap

- **Optional Overlays:**
  - Artist name below title (optional, configurable)
  - Status badge in corner for 'hidden' or 'featured' status
  - Badge positioning: top-right corner

- **Navigation:**
  - Click handler for custom navigation logic
  - Semantically accessible with proper alt text
  - Focus state for keyboard navigation

- **Accessibility:**
  - Alt text from artwork title
  - Keyboard focusable
  - Screen reader friendly

---

## Prerequisites

**Must complete before starting:**
- **48-UI-ARTWORK-GRID.md** - Artwork types defined, grid layout established

---

## Steps

### Step 1: Create Artwork Card Component

Create the reusable card component with all interactive features.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/components/artwork/ArtworkCard.tsx`

```typescript
import React, { useState } from 'react'
import { Artwork } from '../../types/artwork'

interface ArtworkCardProps {
  /**
   * Artwork data to display
   */
  artwork: Artwork

  /**
   * Show artist name below title
   * Default: false
   */
  showArtist?: boolean

  /**
   * Show status badge (hidden, featured)
   * Default: true
   */
  showStatus?: boolean

  /**
   * Custom click handler
   * If provided, card becomes clickable
   * If not provided, card is display-only
   */
  onClick?: (artwork: Artwork) => void

  /**
   * Alternative to onClick: href for link behavior
   */
  href?: string

  /**
   * Optional className for custom styling
   */
  className?: string

  /**
   * Show loading skeleton
   * Default: false
   */
  isLoading?: boolean
}

/**
 * Artwork Card Component
 * Displays a single artwork in a grid with image, title, optional artist name, and status badge
 *
 * Features:
 * - Lazy-loaded images with blur-up placeholder
 * - Hover state with title overlay (desktop)
 * - Optional status badge
 * - Accessible keyboard navigation
 * - Responsive to mobile/desktop
 *
 * Usage:
 * <ArtworkCard
 *   artwork={artwork}
 *   showArtist={true}
 *   onClick={(art) => navigate(`/artworks/${art.id}`)}
 * />
 */
export const ArtworkCard: React.FC<ArtworkCardProps> = ({
  artwork,
  showArtist = false,
  showStatus = true,
  onClick,
  href,
  className = '',
  isLoading = false
}) => {
  const [imageLoaded, setImageLoaded] = useState(false)
  const [hovering, setHovering] = useState(false)

  /**
   * Handle card click
   * Supports both custom onClick handler and href navigation
   */
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (onClick) {
      e.preventDefault()
      onClick(artwork)
    }
  }

  /**
   * Handle keyboard navigation
   * Space/Enter keys trigger click behavior
   */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if ((e.key === 'Enter' || e.key === ' ') && (onClick || href)) {
      e.preventDefault()
      if (onClick) {
        onClick(artwork)
      } else if (href) {
        window.location.href = href
      }
    }
  }

  /**
   * Determine status badge label and color
   */
  const getStatusBadge = () => {
    if (artwork.status === 'hidden') {
      return {
        label: 'Hidden',
        color: 'bg-gray-500'
      }
    }
    if (artwork.status === 'featured') {
      return {
        label: 'Featured',
        color: 'bg-yellow-500'
      }
    }
    return null
  }

  const statusBadge = showStatus ? getStatusBadge() : null

  // Loading skeleton
  if (isLoading) {
    return (
      <div className={`aspect-square bg-gray-200 dark:bg-gray-700 animate-pulse rounded overflow-hidden ${className}`}>
        <div className="w-full h-full flex items-center justify-center">
          <div className="text-gray-400 dark:text-gray-500">
            <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
              <path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" />
            </svg>
          </div>
        </div>
      </div>
    )
  }

  /**
   * Wrapper component - can be link or div
   */
  const WrapperComponent = href ? 'a' : 'div'
  const wrapperProps = href ? { href } : {}

  return (
    <div className={className}>
      <WrapperComponent
        {...wrapperProps}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        tabIndex={onClick || href ? 0 : undefined}
        role={!href ? 'button' : undefined}
        aria-label={`${artwork.title}${showArtist ? ` by ${artwork.artistName}` : ''}`}
        className={`group block relative aspect-square overflow-hidden rounded bg-gray-100 dark:bg-gray-800 transition-transform ${
          onClick || href ? 'cursor-pointer hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900' : ''
        }`}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
      >
        {/* Image Container */}
        <div className="relative w-full h-full">
          {/* Blurred placeholder (shown while loading) */}
          {!imageLoaded && (
            <div className="absolute inset-0 bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800 animate-pulse" />
          )}

          {/* Actual Image */}
          <img
            src={artwork.thumbnail_url}
            alt={artwork.title}
            loading="lazy"
            onLoad={() => setImageLoaded(true)}
            className={`w-full h-full object-cover transition-opacity duration-300 ${
              imageLoaded ? 'opacity-100' : 'opacity-0'
            }`}
          />

          {/* Title Overlay - always visible on mobile, hover on desktop */}
          <div
            className={`absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex flex-col justify-end p-3 transition-opacity duration-200 ${
              hovering ? 'opacity-100' : 'opacity-0 md:opacity-100'
            }`}
          >
            {/* Title */}
            <h3 className="text-white font-medium text-sm line-clamp-2 leading-tight mb-1">
              {artwork.title}
            </h3>

            {/* Artist Name */}
            {showArtist && artwork.artistName && (
              <p className="text-gray-200 text-xs opacity-90">
                by {artwork.artistName}
              </p>
            )}
          </div>

          {/* Status Badge */}
          {statusBadge && (
            <div className="absolute top-2 right-2">
              <span
                className={`inline-flex items-center px-2 py-1 rounded text-white text-xs font-medium ${statusBadge.color}`}
              >
                {statusBadge.label}
              </span>
            </div>
          )}

          {/* Focus indicator for accessibility */}
          <div className="absolute inset-0 pointer-events-none rounded border-2 border-transparent group-focus:border-blue-500 transition-colors" />
        </div>
      </WrapperComponent>
    </div>
  )
}
```

---

### Step 2: Create Card Container Component (Optional)

Create a container component that wraps the card for consistent spacing.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/components/artwork/ArtworkCardContainer.tsx`

```typescript
import React from 'react'
import { Artwork } from '../../types/artwork'
import { ArtworkCard } from './ArtworkCard'

interface ArtworkCardContainerProps {
  artwork: Artwork
  showArtist?: boolean
  showStatus?: boolean
  onClick?: (artwork: Artwork) => void
  href?: string
  isLoading?: boolean
}

/**
 * Artwork Card Container
 * Wraps ArtworkCard with consistent spacing and responsive behavior
 * Used in grid layouts to ensure proper spacing
 */
export const ArtworkCardContainer: React.FC<ArtworkCardContainerProps> = (props) => {
  return (
    <div className="aspect-square">
      <ArtworkCard
        {...props}
        className="w-full h-full"
      />
    </div>
  )
}
```

---

### Step 3: Create Card Stories for Testing (Optional)

Create Storybook stories for the card component to test different states.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/components/artwork/ArtworkCard.stories.tsx`

```typescript
import type { Meta, StoryObj } from '@storybook/react'
import { ArtworkCard } from './ArtworkCard'
import { Artwork } from '../../types/artwork'

const meta = {
  title: 'Components/Artwork/Card',
  component: ArtworkCard,
  parameters: {
    layout: 'centered'
  },
  tags: ['autodocs']
} satisfies Meta<typeof ArtworkCard>

export default meta
type Story = StoryObj<typeof meta>

// Sample artwork data
const sampleArtwork: Artwork = {
  id: 'art_123',
  title: "Dragon's Dawn",
  slug: 'dragons-dawn',
  description: 'A fierce dragon breathing fire at dawn',
  artistId: 'user_456',
  artistName: 'Jane Artist',
  galleryId: 'gal_789',
  collectionId: 'col_101',
  thumbnail_url: 'https://via.placeholder.com/400x400?text=Dragon+Artwork',
  display_url: 'https://via.placeholder.com/1200x1200?text=Dragon+Full',
  icon_url: 'https://via.placeholder.com/128x128?text=Dragon+Icon',
  status: 'active',
  createdAt: '2024-01-15T10:00:00Z',
  updatedAt: '2024-01-15T10:00:00Z'
}

/**
 * Default card with basic information
 */
export const Default: Story = {
  args: {
    artwork: sampleArtwork
  }
}

/**
 * Card with artist name displayed
 */
export const WithArtist: Story = {
  args: {
    artwork: sampleArtwork,
    showArtist: true
  }
}

/**
 * Card with featured status badge
 */
export const Featured: Story = {
  args: {
    artwork: {
      ...sampleArtwork,
      status: 'featured'
    },
    showStatus: true
  }
}

/**
 * Card with hidden status badge
 */
export const Hidden: Story = {
  args: {
    artwork: {
      ...sampleArtwork,
      status: 'hidden'
    },
    showStatus: true
  }
}

/**
 * Loading skeleton state
 */
export const Loading: Story = {
  args: {
    artwork: sampleArtwork,
    isLoading: true
  }
}

/**
 * Card with click handler
 */
export const Clickable: Story = {
  args: {
    artwork: sampleArtwork,
    showArtist: true,
    onClick: (artwork) => {
      alert(`Clicked: ${artwork.title}`)
    }
  }
}

/**
 * Card as a link
 */
export const AsLink: Story = {
  args: {
    artwork: sampleArtwork,
    showArtist: true,
    href: `/artworks/${sampleArtwork.id}`
  }
}

/**
 * Multiple cards in grid
 */
export const Grid: Story = {
  render: () => (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-4 w-screen">
      {[1, 2, 3, 4, 5, 6, 7, 8].map((num) => (
        <ArtworkCard
          key={num}
          artwork={{
            ...sampleArtwork,
            id: `art_${num}`,
            title: `Artwork #${num}`
          }}
          showArtist
          onClick={(art) => console.log('Clicked:', art)}
        />
      ))}
    </div>
  )
}
```

---

## Files to Create/Modify

1. **Create:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/components/artwork/ArtworkCard.tsx`
2. **Create:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/components/artwork/ArtworkCardContainer.tsx` (optional)
3. **Create:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/components/artwork/ArtworkCard.stories.tsx` (optional, if using Storybook)

---

## CSS Requirements

The component uses Tailwind CSS classes. Ensure the following are available:

- `aspect-square` - Square aspect ratio
- `animate-pulse` - Loading animation
- `line-clamp-2` - Text truncation
- `group` - Parent selector for hover states
- `group-focus` - Focus state within group
- Focus ring classes: `focus:ring-2`, `focus:ring-blue-500`, `focus:ring-offset-2`

---

## Verification

1. **Basic Display:**
   - Card renders with thumbnail image
   - Title is visible
   - Aspect ratio is square (1:1)

2. **Image Loading:**
   - Placeholder shows while image loads
   - Fade-in transition when image loads
   - Lazy loading attribute is set on img tag

3. **Desktop Hover:**
   - Title overlay appears on mouse hover
   - Artist name shows (if showArtist=true)
   - Smooth opacity transition
   - Card scales up slightly on hover

4. **Mobile Display:**
   - Title overlay always visible (no hover)
   - Touch-friendly, no hover artifacts
   - Proper spacing on small screens

5. **Status Badge:**
   - Badge appears in top-right corner
   - Correct label for status ('Featured', 'Hidden', or none)
   - Correct colors (yellow for featured, gray for hidden)
   - Badge doesn't obstruct image

6. **Artist Name:**
   - Appears below title when showArtist=true
   - Doesn't appear when showArtist=false
   - Properly formatted as "by [name]"

7. **Keyboard Navigation:**
   - Card is focusable with Tab key
   - Focus ring is visible
   - Enter/Space keys trigger onClick handler
   - Proper aria-label for screen readers

8. **Link Behavior:**
   - When href is provided, card renders as <a> tag
   - Click navigates to specified URL
   - Maintains proper link semantics

9. **Click Handler:**
   - When onClick is provided, card triggers handler on click
   - Handler receives correct artwork object
   - Works with keyboard navigation

10. **Grid Layout:**
    - Multiple cards display in proper grid
    - Spacing and alignment consistent
    - Responsive column counts (2 mobile, 3 tablet, 4 desktop)

11. **Loading State:**
    - isLoading=true shows skeleton
    - Skeleton animates with pulse effect
    - Transitions smoothly to loaded state
