# 159-POLISH-SKELETON-LOADERS.md

## Goal

Create animated skeleton loader components (SkeletonCard, SkeletonText, SkeletonAvatar) to display during data loading, providing visual feedback and reducing perceived load time.

---

## Spec Extract

From TECHNICAL-SPEC.md and UX Requirements:

- **Skeleton Components:**
  - SkeletonCard - Placeholder for artwork cards
  - SkeletonText - Placeholder for text content
  - SkeletonAvatar - Placeholder for user avatars
  - SkeletonButton - Placeholder for action buttons

- **Animated Shimmer Effect:**
  - Gradient animation left-to-right
  - Smooth, continuous animation
  - Base color with lighter gradient sweep
  - Starts on page load, not on component mount

- **Loading States:**
  - Display during API data fetching
  - Replace with actual content when data arrives
  - Smooth transition between skeleton and content
  - No flash or layout shift

- **Accessibility:**
  - aria-busy="true" for loading state
  - Semantic HTML structure
  - Keyboard navigation support

---

## Prerequisites

**Must complete before starting:**
- **51-UI-ARTWORK-CARD.md** - Artwork card component established
- **27-REACT-LAYOUT-SHELL.md** - Layout structure in place

---

## Steps

### Step 1: Create Base Skeleton Component

Create the foundational skeleton component with shimmer effect.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/components/common/Skeleton.tsx`

```typescript
import React from 'react'

interface SkeletonProps {
  /**
   * Width of skeleton element
   * Can be specific size (e.g., "100px") or tailwind class
   */
  width?: string | number

  /**
   * Height of skeleton element
   * Can be specific size (e.g., "100px") or tailwind class
   */
  height?: string | number

  /**
   * Border radius
   * Default: 'rounded'
   */
  borderRadius?: string

  /**
   * Custom className
   */
  className?: string

  /**
   * Enable shimmer animation
   * Default: true
   */
  shimmer?: boolean

  /**
   * Animation speed in seconds
   * Default: 2
   */
  animationSpeed?: number
}

/**
 * Base Skeleton Component
 * Provides animated placeholder for loading states
 *
 * Features:
 * - Configurable dimensions
 * - Shimmer animation
 * - Customizable appearance
 * - Accessibility support
 *
 * Usage:
 * <Skeleton width="100%" height="200px" />
 */
export const Skeleton: React.FC<SkeletonProps> = ({
  width,
  height = '1rem',
  borderRadius = 'rounded',
  className = '',
  shimmer = true,
  animationSpeed = 2
}) => {
  const widthStyle = typeof width === 'string' ? width : width ? `${width}px` : 'w-full'
  const heightStyle = typeof height === 'string' ? height : height ? `${height}px` : 'h-4'

  const widthClass = typeof width === 'string' ? width : ''
  const heightClass = typeof height === 'string' ? height : ''

  const baseClass = heightClass ? heightClass : ''

  return (
    <div
      className={`
        bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200
        dark:from-gray-700 dark:via-gray-600 dark:to-gray-700
        ${borderRadius}
        ${className}
        ${shimmer ? 'animate-shimmer' : ''}
      `}
      style={{
        width: widthStyle !== 'w-full' ? widthStyle : undefined,
        height: heightStyle !== 'h-4' ? heightStyle : undefined,
        animation: shimmer ? `shimmer ${animationSpeed}s infinite` : undefined,
        backgroundSize: '200% 100%',
        backgroundPosition: '-200% 0'
      }}
      aria-busy={true}
      aria-label="Loading"
      role="status"
    />
  )
}

// Add this to your Tailwind CSS or global styles
const skeletonStyles = `
@keyframes shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

.animate-shimmer {
  animation: shimmer 2s infinite;
}
`
```

---

### Step 2: Create SkeletonCard Component

Create a skeleton for artwork cards.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/components/common/SkeletonCard.tsx`

```typescript
import React from 'react'
import { Skeleton } from './Skeleton'

interface SkeletonCardProps {
  /**
   * Number of skeleton cards to render
   * Default: 1
   */
  count?: number

  /**
   * Show artist name skeleton
   * Default: true
   */
  showArtist?: boolean

  /**
   * Custom className for container
   */
  className?: string

  /**
   * Animation speed in seconds
   * Default: 2
   */
  animationSpeed?: number
}

/**
 * SkeletonCard Component
 * Placeholder for artwork card while loading
 *
 * Features:
 * - Square aspect ratio matching ArtworkCard
 * - Title and optional artist name skeletons
 * - Shimmer animation
 * - Grid-friendly layout
 *
 * Usage:
 * <SkeletonCard count={4} showArtist={true} />
 */
export const SkeletonCard: React.FC<SkeletonCardProps> = ({
  count = 1,
  showArtist = true,
  className = '',
  animationSpeed = 2
}) => {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className={`${className}`}
          aria-busy={true}
        >
          {/* Image Skeleton */}
          <div className="aspect-square mb-3">
            <Skeleton
              width="100%"
              height="100%"
              borderRadius="rounded-lg"
              animationSpeed={animationSpeed}
            />
          </div>

          {/* Title Skeleton */}
          <div className="space-y-2">
            <Skeleton
              width="100%"
              height="0.875rem"
              borderRadius="rounded"
              animationSpeed={animationSpeed}
            />
            <Skeleton
              width="80%"
              height="0.875rem"
              borderRadius="rounded"
              animationSpeed={animationSpeed}
            />

            {/* Artist Skeleton */}
            {showArtist && (
              <div className="pt-1">
                <Skeleton
                  width="60%"
                  height="0.75rem"
                  borderRadius="rounded"
                  animationSpeed={animationSpeed}
                />
              </div>
            )}
          </div>
        </div>
      ))}
    </>
  )
}
```

---

### Step 3: Create SkeletonText Component

Create a skeleton for text content.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/components/common/SkeletonText.tsx`

```typescript
import React from 'react'
import { Skeleton } from './Skeleton'

interface SkeletonTextProps {
  /**
   * Number of lines to render
   * Default: 3
   */
  lines?: number

  /**
   * Width of last line (percentage)
   * Default: 80
   */
  lastLineWidth?: number

  /**
   * Gap between lines in pixels
   * Default: 8
   */
  gap?: number

  /**
   * Height of each line
   * Default: '1rem'
   */
  lineHeight?: string

  /**
   * Custom className
   */
  className?: string

  /**
   * Animation speed in seconds
   */
  animationSpeed?: number
}

/**
 * SkeletonText Component
 * Placeholder for text content while loading
 *
 * Features:
 * - Configurable number of lines
 * - Variable last line width for natural look
 * - Smooth shimmer animation
 * - Flexible dimensions
 *
 * Usage:
 * <SkeletonText lines={4} lastLineWidth={60} />
 */
export const SkeletonText: React.FC<SkeletonTextProps> = ({
  lines = 3,
  lastLineWidth = 80,
  gap = 8,
  lineHeight = '1rem',
  className = '',
  animationSpeed = 2
}) => {
  return (
    <div className={`space-y-[${gap}px] ${className}`} aria-busy={true}>
      {Array.from({ length: lines }).map((_, index) => {
        const isLastLine = index === lines - 1
        const width = isLastLine ? `${lastLineWidth}%` : '100%'

        return (
          <Skeleton
            key={index}
            width={width}
            height={lineHeight}
            borderRadius="rounded"
            animationSpeed={animationSpeed}
          />
        )
      })}
    </div>
  )
}
```

---

### Step 4: Create SkeletonAvatar Component

Create a skeleton for user avatars.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/components/common/SkeletonAvatar.tsx`

```typescript
import React from 'react'
import { Skeleton } from './Skeleton'

interface SkeletonAvatarProps {
  /**
   * Avatar size
   * 'sm' = 32px, 'md' = 48px, 'lg' = 64px
   * Default: 'md'
   */
  size?: 'sm' | 'md' | 'lg'

  /**
   * Show name skeleton next to avatar
   * Default: false
   */
  showName?: boolean

  /**
   * Custom className
   */
  className?: string

  /**
   * Animation speed in seconds
   */
  animationSpeed?: number
}

/**
 * SkeletonAvatar Component
 * Placeholder for user avatar while loading
 *
 * Features:
 * - Circular avatar placeholder
 * - Optional name text skeleton
 * - Multiple size options
 * - Flexible layout
 *
 * Usage:
 * <SkeletonAvatar size="lg" showName={true} />
 */
export const SkeletonAvatar: React.FC<SkeletonAvatarProps> = ({
  size = 'md',
  showName = false,
  className = '',
  animationSpeed = 2
}) => {
  const sizeMap = {
    sm: '32px',
    md: '48px',
    lg: '64px'
  }

  const avatarSize = sizeMap[size]

  return (
    <div className={`flex items-center gap-3 ${className}`} aria-busy={true}>
      {/* Avatar Circle */}
      <Skeleton
        width={avatarSize}
        height={avatarSize}
        borderRadius="rounded-full"
        animationSpeed={animationSpeed}
      />

      {/* Name Skeleton */}
      {showName && (
        <div className="flex-1 space-y-2">
          <Skeleton
            width="40%"
            height="0.875rem"
            borderRadius="rounded"
            animationSpeed={animationSpeed}
          />
          <Skeleton
            width="30%"
            height="0.75rem"
            borderRadius="rounded"
            animationSpeed={animationSpeed}
          />
        </div>
      )}
    </div>
  )
}
```

---

### Step 5: Create SkeletonButton Component

Create a skeleton for buttons.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/components/common/SkeletonButton.tsx`

```typescript
import React from 'react'
import { Skeleton } from './Skeleton'

interface SkeletonButtonProps {
  /**
   * Button size
   * 'sm' = small, 'md' = medium, 'lg' = large
   * Default: 'md'
   */
  size?: 'sm' | 'md' | 'lg'

  /**
   * Button width
   * Default: 100px
   */
  width?: string

  /**
   * Custom className
   */
  className?: string

  /**
   * Animation speed in seconds
   */
  animationSpeed?: number
}

/**
 * SkeletonButton Component
 * Placeholder for button while loading
 *
 * Features:
 * - Multiple size options
 * - Configurable width
 * - Shimmer animation
 * - Rounded appearance
 *
 * Usage:
 * <SkeletonButton size="lg" width="150px" />
 */
export const SkeletonButton: React.FC<SkeletonButtonProps> = ({
  size = 'md',
  width = '100px',
  className = '',
  animationSpeed = 2
}) => {
  const heightMap = {
    sm: '2rem',
    md: '2.5rem',
    lg: '3rem'
  }

  const height = heightMap[size]

  return (
    <Skeleton
      width={width}
      height={height}
      borderRadius="rounded-lg"
      className={className}
      animationSpeed={animationSpeed}
    />
  )
}
```

---

### Step 6: Create SkeletonGrid Component

Create a component for displaying skeleton grids.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/components/common/SkeletonGrid.tsx`

```typescript
import React from 'react'
import { SkeletonCard } from './SkeletonCard'

interface SkeletonGridProps {
  /**
   * Number of items in grid
   * Default: 8
   */
  count?: number

  /**
   * Grid columns on mobile
   * Default: 2
   */
  mobileColumns?: number

  /**
   * Grid columns on tablet
   * Default: 3
   */
  tabletColumns?: number

  /**
   * Grid columns on desktop
   * Default: 4
   */
  desktopColumns?: number

  /**
   * Gap between items in pixels
   * Default: 16
   */
  gap?: number

  /**
   * Show artist skeleton
   * Default: true
   */
  showArtist?: boolean

  /**
   * Custom className
   */
  className?: string

  /**
   * Animation speed in seconds
   */
  animationSpeed?: number
}

/**
 * SkeletonGrid Component
 * Displays a grid of skeleton cards for loading state
 *
 * Features:
 * - Responsive grid layout
 * - Configurable item count
 * - Matching ArtworkCard dimensions
 * - Smooth animations
 *
 * Usage:
 * <SkeletonGrid count={12} />
 */
export const SkeletonGrid: React.FC<SkeletonGridProps> = ({
  count = 8,
  mobileColumns = 2,
  tabletColumns = 3,
  desktopColumns = 4,
  gap = 16,
  showArtist = true,
  className = '',
  animationSpeed = 2
}) => {
  const gridCols = `grid-cols-${mobileColumns} md:grid-cols-${tabletColumns} lg:grid-cols-${desktopColumns}`
  const gapClass = `gap-${Math.round(gap / 4)}`

  return (
    <div
      className={`
        grid
        ${gridCols}
        ${gapClass}
        ${className}
      `}
      style={{
        gridTemplateColumns: `repeat(auto-fill, minmax(150px, 1fr))`,
        gap: `${gap}px`
      }}
      aria-busy={true}
      role="status"
      aria-label="Loading content"
    >
      <SkeletonCard
        count={count}
        showArtist={showArtist}
        animationSpeed={animationSpeed}
      />
    </div>
  )
}
```

---

### Step 7: Create Styles for Shimmer Animation

Add shimmer animation styles to your global stylesheet.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/styles/skeleton.css`

```css
/* Skeleton Loader Animations */

@keyframes shimmer {
  0% {
    background-position: -1000px 0;
  }
  100% {
    background-position: 1000px 0;
  }
}

.animate-shimmer {
  animation: shimmer 2s infinite;
  background-size: 200% 100%;
}

/* Alternative shimmer effect - more realistic */
@keyframes shimmerFlare {
  0% {
    background-position: -1200px 0;
  }
  100% {
    background-position: 1200px 0;
  }
}

.animate-shimmer-flare {
  animation: shimmerFlare 2s infinite;
  background-size: 200% 100%;
}

/* Skeleton base styles */
.skeleton {
  @apply bg-gray-200 dark:bg-gray-700;
  background-image: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0) 0,
    rgba(255, 255, 255, 0.2) 20%,
    rgba(255, 255, 255, 0.5) 60%,
    rgba(255, 255, 255, 0)
  );
}

.skeleton.dark {
  @apply dark:bg-gray-700;
  background-image: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0) 0,
    rgba(255, 255, 255, 0.1) 20%,
    rgba(255, 255, 255, 0.2) 60%,
    rgba(255, 255, 255, 0)
  );
}

/* Pulse animation for variety */
@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.animate-pulse-skeleton {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
```

---

### Step 8: Update Tailwind Configuration

Add animation to your Tailwind configuration.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/tailwind.config.js` (modify)

```javascript
module.exports = {
  theme: {
    extend: {
      animation: {
        shimmer: 'shimmer 2s infinite',
        'shimmer-flare': 'shimmerFlare 2s infinite',
        'pulse-skeleton': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
      },
      keyframes: {
        shimmer: {
          '0%': {
            backgroundPosition: '-1000px 0'
          },
          '100%': {
            backgroundPosition: '1000px 0'
          }
        },
        shimmerFlare: {
          '0%': {
            backgroundPosition: '-1200px 0'
          },
          '100%': {
            backgroundPosition: '1200px 0'
          }
        }
      }
    }
  }
}
```

---

### Step 9: Create Hook for Managing Skeleton State

Create a hook for simplified skeleton state management.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/hooks/useSkeleton.ts`

```typescript
import { useState, useEffect } from 'react'

interface UseSkeletonProps {
  /**
   * Whether data is currently loading
   */
  isLoading: boolean

  /**
   * Minimum time to show skeleton (ms)
   * Prevents skeleton from disappearing too quickly
   * Default: 300
   */
  minShowTime?: number

  /**
   * Delay before showing skeleton (ms)
   * Useful for fast loads
   * Default: 0
   */
  showDelay?: number
}

/**
 * useSkeleton Hook
 * Manages skeleton display timing
 *
 * Prevents skeleton flashing and ensures smooth transitions
 *
 * Usage:
 * const { showSkeleton } = useSkeleton({
 *   isLoading: data === null,
 *   minShowTime: 300
 * })
 */
export function useSkeleton({
  isLoading,
  minShowTime = 300,
  showDelay = 0
}: UseSkeletonProps) {
  const [showSkeleton, setShowSkeleton] = useState(isLoading)
  const [startTime, setStartTime] = useState<number | null>(null)

  useEffect(() => {
    if (isLoading) {
      // Start loading - set delay before showing skeleton
      const delayTimer = setTimeout(() => {
        setShowSkeleton(true)
        setStartTime(Date.now())
      }, showDelay)

      return () => clearTimeout(delayTimer)
    } else {
      // Stop loading - respect minimum show time
      if (startTime) {
        const elapsedTime = Date.now() - startTime
        const remainingTime = Math.max(0, minShowTime - elapsedTime)

        const timer = setTimeout(() => {
          setShowSkeleton(false)
          setStartTime(null)
        }, remainingTime)

        return () => clearTimeout(timer)
      } else {
        setShowSkeleton(false)
      }
    }
  }, [isLoading, minShowTime, showDelay, startTime])

  return { showSkeleton }
}
```

---

### Step 10: Create Example Usage Component

Create an example component showing how to use skeletons.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/components/examples/SkeletonExample.tsx`

```typescript
import React, { useState, useEffect } from 'react'
import { SkeletonCard } from '../common/SkeletonCard'
import { SkeletonText } from '../common/SkeletonText'
import { SkeletonAvatar } from '../common/SkeletonAvatar'
import { SkeletonButton } from '../common/SkeletonButton'
import { SkeletonGrid } from '../common/SkeletonGrid'
import { useSkeleton } from '../../hooks/useSkeleton'

/**
 * SkeletonExample Component
 * Demonstrates all skeleton component variations
 */
export const SkeletonExample: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true)
  const { showSkeleton } = useSkeleton({
    isLoading,
    minShowTime: 300
  })

  useEffect(() => {
    // Simulate data loading
    const timer = setTimeout(() => {
      setIsLoading(false)
    }, 2000)

    return () => clearTimeout(timer)
  }, [])

  if (showSkeleton) {
    return (
      <div className="space-y-6 p-6">
        <div>
          <h2 className="text-lg font-bold mb-4">Loading Profile</h2>
          <SkeletonAvatar size="lg" showName={true} />
        </div>

        <div>
          <h2 className="text-lg font-bold mb-4">Loading Text</h2>
          <SkeletonText lines={4} lastLineWidth={70} />
        </div>

        <div>
          <h2 className="text-lg font-bold mb-4">Loading Gallery</h2>
          <SkeletonGrid count={8} />
        </div>

        <div>
          <h2 className="text-lg font-bold mb-4">Loading Button</h2>
          <SkeletonButton size="lg" width="200px" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h2 className="text-lg font-bold mb-4">Content Loaded!</h2>
        <p>Data is now displayed instead of skeletons.</p>
      </div>
    </div>
  )
}
```

---

## Files to Create/Modify

1. **Create:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/components/common/Skeleton.tsx`
2. **Create:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/components/common/SkeletonCard.tsx`
3. **Create:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/components/common/SkeletonText.tsx`
4. **Create:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/components/common/SkeletonAvatar.tsx`
5. **Create:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/components/common/SkeletonButton.tsx`
6. **Create:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/components/common/SkeletonGrid.tsx`
7. **Create:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/styles/skeleton.css`
8. **Create:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/hooks/useSkeleton.ts`
9. **Create:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/components/examples/SkeletonExample.tsx` (optional)
10. **Modify:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/tailwind.config.js` - Add skeleton animations

---

## Verification

1. **Skeleton Display:**
   - Skeletons appear while data loads
   - Correct proportions for each component
   - No layout shift when content loads
   - Smooth fade transition

2. **Shimmer Animation:**
   - Gradient animation moves left-to-right
   - Animation loops continuously
   - Speed consistent and smooth
   - Works in all browsers

3. **SkeletonCard:**
   - Displays square image placeholder
   - Shows title lines (2 lines)
   - Shows artist name (if enabled)
   - Grid layout works with multiple cards

4. **SkeletonText:**
   - Correct number of lines render
   - Last line width shorter (natural look)
   - Proper spacing between lines
   - Handles variable line heights

5. **SkeletonAvatar:**
   - Circular placeholder appears
   - Correct size based on prop
   - Optional name skeleton works
   - Proper alignment

6. **SkeletonButton:**
   - Correct height for button size
   - Adjustable width
   - Rounded corners
   - Shimmer animation visible

7. **SkeletonGrid:**
   - Responsive column counts
   - Proper gap spacing
   - Multiple skeletons render
   - Matches ArtworkCard grid layout

8. **State Management:**
   - useSkeleton hook prevents flash
   - Minimum show time respected
   - Show delay works correctly
   - Smooth transitions

9. **Accessibility:**
   - aria-busy="true" on loading elements
   - role="status" where appropriate
   - aria-label provided
   - Keyboard accessible

10. **Dark Mode:**
    - Skeletons visible in dark theme
    - Shimmer gradient adjusted for dark
    - Colors match theme
    - Animation visible in both modes

11. **Performance:**
    - No layout shift when content loads
    - Animation runs smoothly
    - Memory usage stable
    - No console errors or warnings
