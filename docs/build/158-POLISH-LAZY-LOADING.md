# 158-POLISH-LAZY-LOADING.md

## Goal

Implement image lazy loading with native HTML `loading="lazy"` attribute and Intersection Observer API for below-fold content, plus blur-up placeholder technique for optimal perceived performance.

---

## Spec Extract

From TECHNICAL-SPEC.md and Performance Requirements:

- **Native Lazy Loading:**
  - Use `loading="lazy"` on all `<img>` tags
  - Automatic browser-based image deferred loading
  - Works without JavaScript

- **Intersection Observer for Below-Fold:**
  - Custom hook for advanced lazy loading scenarios
  - Trigger loading when element enters viewport
  - Configurable root margin for early load initiation
  - Unobserve after image loads

- **Blur-Up Placeholder:**
  - Low-quality image placeholder during load
  - Blur filter applied to placeholder
  - Smooth fade transition when high-quality loads
  - Base64-encoded placeholder images

- **Performance Goals:**
  - First Contentful Paint (FCP) improvement
  - Reduced initial bundle size
  - Deferred non-critical image loads
  - Lower bandwidth for below-fold images

---

## Prerequisites

**Must complete before starting:**
- **51-UI-ARTWORK-CARD.md** - Artwork card component with image display
- **27-REACT-LAYOUT-SHELL.md** - Layout structure established

---

## Steps

### Step 1: Create useIntersectionObserver Hook

Create a reusable hook for detecting when elements enter the viewport.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/hooks/useIntersectionObserver.ts`

```typescript
import { useEffect, useRef, useState } from 'react'

interface UseIntersectionObserverProps {
  /**
   * Root margin for triggering observation
   * Default: "50px" (triggers 50px before entering viewport)
   */
  rootMargin?: string

  /**
   * Intersection threshold
   * Default: 0.1 (triggers when 10% visible)
   */
  threshold?: number | number[]

  /**
   * Callback when element becomes visible
   */
  onVisible?: () => void

  /**
   * Callback when element becomes invisible
   */
  onHidden?: () => void

  /**
   * Whether to stop observing after first visibility
   * Default: false
   */
  once?: boolean
}

/**
 * useIntersectionObserver Hook
 * Detects when an element enters the viewport using Intersection Observer API
 *
 * Usage:
 * const { ref, isVisible } = useIntersectionObserver({
 *   rootMargin: '100px',
 *   onVisible: () => console.log('Element visible!')
 * })
 */
export function useIntersectionObserver({
  rootMargin = '50px',
  threshold = 0.1,
  onVisible,
  onHidden,
  once = false
}: UseIntersectionObserverProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)
  const [hasBeenVisible, setHasBeenVisible] = useState(false)

  useEffect(() => {
    if (!ref.current) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          setHasBeenVisible(true)
          onVisible?.()

          // Stop observing if once=true
          if (once) {
            observer.unobserve(entry.target)
          }
        } else {
          if (!once) {
            setIsVisible(false)
          }
          onHidden?.()
        }
      },
      {
        rootMargin,
        threshold
      }
    )

    observer.observe(ref.current)

    return () => {
      observer.disconnect()
    }
  }, [rootMargin, threshold, onVisible, onHidden, once])

  return {
    ref,
    isVisible,
    hasBeenVisible
  }
}
```

---

### Step 2: Create useLazyImage Hook

Create a specialized hook for lazy-loading images with blur-up placeholder support.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/hooks/useLazyImage.ts`

```typescript
import { useState, useEffect, useRef } from 'react'

interface UseLazyImageProps {
  /**
   * URL of the image to lazy-load
   */
  src: string

  /**
   * Placeholder image (base64 or URL)
   * Should be low-quality/blurred version
   */
  placeholder?: string

  /**
   * Alternative text
   */
  alt?: string

  /**
   * Timeout before showing error state (ms)
   * Default: 10000 (10 seconds)
   */
  timeout?: number

  /**
   * Callback when image loads successfully
   */
  onLoad?: () => void

  /**
   * Callback when image fails to load
   */
  onError?: () => void
}

interface LazyImageState {
  /**
   * Current displayed source
   * Either placeholder or actual image
   */
  src: string

  /**
   * Whether the main image has loaded
   */
  isLoaded: boolean

  /**
   * Whether an error occurred
   */
  hasError: boolean

  /**
   * Whether we're in loading state
   */
  isLoading: boolean
}

/**
 * useLazyImage Hook
 * Manages lazy image loading with blur-up placeholder
 *
 * Usage:
 * const { src, isLoaded } = useLazyImage({
 *   src: '/image-full.jpg',
 *   placeholder: 'data:image/jpeg;base64,...',
 *   onLoad: () => console.log('Image loaded!')
 * })
 *
 * Then: <img src={src} className={isLoaded ? '' : 'blur-sm'} />
 */
export function useLazyImage({
  src,
  placeholder,
  alt,
  timeout = 10000,
  onLoad,
  onError
}: UseLazyImageProps): LazyImageState {
  const [state, setState] = useState<LazyImageState>({
    src: placeholder || src,
    isLoaded: false,
    hasError: false,
    isLoading: true
  })

  const imageRef = useRef<HTMLImageElement | null>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    // Clean up previous image
    if (imageRef.current) {
      imageRef.current.onload = null
      imageRef.current.onerror = null
    }

    // Create new image element
    const img = new Image()

    const handleLoad = () => {
      setState({
        src,
        isLoaded: true,
        hasError: false,
        isLoading: false
      })
      onLoad?.()

      // Clear timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }

    const handleError = () => {
      setState({
        src: placeholder || src,
        isLoaded: false,
        hasError: true,
        isLoading: false
      })
      onError?.()

      // Clear timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }

    // Set timeout for load failure
    timeoutRef.current = setTimeout(() => {
      if (!state.isLoaded) {
        handleError()
      }
    }, timeout)

    img.onload = handleLoad
    img.onerror = handleError
    imageRef.current = img

    // Start loading
    img.src = src

    // Cleanup
    return () => {
      img.onload = null
      img.onerror = null
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [src, placeholder, timeout, onLoad, onError])

  return state
}
```

---

### Step 3: Create LazyImage Component

Create a reusable component that uses the lazy image hook.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/components/common/LazyImage.tsx`

```typescript
import React, { forwardRef } from 'react'
import { useLazyImage } from '../../hooks/useLazyImage'
import { useIntersectionObserver } from '../../hooks/useIntersectionObserver'

interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  /**
   * Image source URL
   */
  src: string

  /**
   * Alternative text
   */
  alt: string

  /**
   * Low-quality placeholder (base64 or URL)
   */
  placeholder?: string

  /**
   * Use Intersection Observer for additional control
   * Default: true
   */
  useObserver?: boolean

  /**
   * Root margin for Intersection Observer
   * Default: "50px"
   */
  observerMargin?: string

  /**
   * Callback when image loads
   */
  onLoadComplete?: () => void

  /**
   * Callback when image fails
   */
  onLoadError?: () => void

  /**
   * Custom class for loaded state
   */
  loadedClassName?: string

  /**
   * Custom class for loading state
   */
  loadingClassName?: string
}

/**
 * LazyImage Component
 * Intelligent lazy-loading image with blur-up placeholder
 *
 * Features:
 * - Native loading="lazy" attribute
 * - Intersection Observer for viewport detection
 * - Blur-up placeholder support
 * - Fade-in transition
 * - Error handling
 *
 * Usage:
 * <LazyImage
 *   src="/image.jpg"
 *   placeholder="data:image/jpeg;base64,..."
 *   alt="Description"
 *   className="w-full h-auto"
 *   loadedClassName="opacity-100"
 *   loadingClassName="opacity-50 blur-sm"
 * />
 */
export const LazyImage = forwardRef<HTMLImageElement, LazyImageProps>(
  (
    {
      src,
      alt,
      placeholder,
      useObserver = true,
      observerMargin = '50px',
      onLoadComplete,
      onLoadError,
      loadedClassName = 'opacity-100',
      loadingClassName = 'opacity-50 blur-sm',
      className = '',
      style,
      ...imgProps
    },
    ref
  ) => {
    // Intersection Observer to detect when element enters viewport
    const { ref: observerRef, isVisible } = useIntersectionObserver({
      rootMargin: observerMargin,
      threshold: 0.01,
      once: true
    })

    // Lazy image loading state
    const imageState = useLazyImage({
      src: useObserver && !isVisible ? placeholder || src : src,
      placeholder,
      alt,
      onLoad: onLoadComplete,
      onError: onLoadError
    })

    // Determine if we should show the main image or placeholder
    const displaySrc = imageState.src
    const isLoaded = imageState.isLoaded
    const hasError = imageState.hasError

    return (
      <div
        ref={observerRef}
        className="relative overflow-hidden"
      >
        <img
          ref={ref}
          src={displaySrc}
          alt={alt}
          loading="lazy"
          className={`transition-all duration-300 ${
            isLoaded ? loadedClassName : loadingClassName
          } ${className}`}
          style={style}
          {...imgProps}
        />

        {/* Error indicator */}
        {hasError && (
          <div className="absolute inset-0 bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
            <span className="text-gray-400 text-sm">Failed to load image</span>
          </div>
        )}
      </div>
    )
  }
)

LazyImage.displayName = 'LazyImage'
```

---

### Step 4: Update ArtworkCard Component

Integrate lazy loading into the existing ArtworkCard component.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/components/artwork/ArtworkCard.tsx` (modify)

Update the image section to use the lazy loading features:

```typescript
// Add to imports
import { useIntersectionObserver } from '../../hooks/useIntersectionObserver'

// Inside ArtworkCard component, update the image rendering:

// After const [imageLoaded, setImageLoaded] = useState(false), add:
const { ref: observerRef, isVisible } = useIntersectionObserver({
  rootMargin: '100px',
  threshold: 0.01,
  once: true
})

// In the JSX, update the image container:
<div
  ref={observerRef}
  className="relative w-full h-full"
>
  {/* Blurred placeholder (shown while loading) */}
  {!imageLoaded && (
    <div className="absolute inset-0 bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800 animate-pulse" />
  )}

  {/* Actual Image with native lazy loading */}
  <img
    src={artwork.thumbnail_url}
    alt={artwork.title}
    loading="lazy"
    onLoad={() => setImageLoaded(true)}
    className={`w-full h-full object-cover transition-opacity duration-300 ${
      imageLoaded ? 'opacity-100' : 'opacity-0'
    }`}
  />

  {/* Rest of the component... */}
</div>
```

---

### Step 5: Create Utility for Base64 Placeholder Generation

Create a utility to generate base64 placeholder images from URLs.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/utils/placeholderGenerator.ts`

```typescript
/**
 * Generate a simple base64 placeholder image
 * Used for blur-up effect while loading actual images
 */

/**
 * Create a base64 placeholder with specified color
 * Generates a simple 10x10 pixel PNG
 *
 * @param color - Hex color code (e.g., '#e0e0e0')
 * @returns Base64 encoded PNG
 */
export function createColorPlaceholder(color: string = '#e0e0e0'): string {
  // Simple 1x1 pixel PNG in base64
  // Can be extended to create gradient placeholders
  const colorHex = color.replace('#', '')
  const r = parseInt(colorHex.substring(0, 2), 16)
  const g = parseInt(colorHex.substring(2, 4), 16)
  const b = parseInt(colorHex.substring(4, 6), 16)

  // Create a simple canvas-based placeholder
  // For production, use a service like plaiceholder or similar
  return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10'%3E%3Crect fill='%23${colorHex}' width='10' height='10'/%3E%3C/svg%3E`
}

/**
 * Get placeholder for artwork based on dominant color
 * In production, this would be generated server-side and stored
 *
 * @param artworkId - ID of artwork
 * @param dominantColor - Dominant color of image
 * @returns Base64 placeholder URL
 */
export function getArtworkPlaceholder(
  artworkId: string,
  dominantColor: string = '#e0e0e0'
): string {
  // In a real implementation, this could:
  // 1. Fetch pre-generated placeholder from server
  // 2. Use color from artwork metadata
  // 3. Generate from image analysis

  return createColorPlaceholder(dominantColor)
}

/**
 * Get blur image URL from image service
 * Many modern image services support blur hashing
 *
 * @param imageUrl - Original image URL
 * @param quality - Quality level (1-10)
 * @returns Blurred image URL
 */
export function getBlurredImageUrl(
  imageUrl: string,
  quality: number = 2
): string {
  // Example using Cloudinary
  // This would be customized based on your image service
  const cloudinaryUrl = imageUrl.replace(
    '/upload/',
    `/upload/q_${quality},bl_300/`
  )
  return cloudinaryUrl
}

/**
 * Pre-generate placeholder for multiple images
 * Useful for batch processing in build step
 *
 * @param imageUrls - Array of image URLs
 * @returns Map of URL to placeholder
 */
export async function generatePlaceholders(
  imageUrls: string[]
): Promise<Map<string, string>> {
  const placeholders = new Map<string, string>()

  for (const url of imageUrls) {
    // In production, this would call an image processing service
    // For now, just use color placeholders
    placeholders.set(url, createColorPlaceholder('#e0e0e0'))
  }

  return placeholders
}
```

---

### Step 6: Create ImageLoader Component for Advanced Scenarios

Create a component for managing multiple image states.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/components/common/ImageLoader.tsx`

```typescript
import React, { ReactNode } from 'react'
import { useLazyImage } from '../../hooks/useLazyImage'
import { useIntersectionObserver } from '../../hooks/useIntersectionObserver'

interface ImageLoaderProps {
  /**
   * Image URL to load
   */
  src: string

  /**
   * Low-quality placeholder
   */
  placeholder?: string

  /**
   * Alternative text
   */
  alt: string

  /**
   * Render function for custom rendering
   */
  children: (state: {
    src: string
    isLoaded: boolean
    hasError: boolean
    isLoading: boolean
  }) => ReactNode

  /**
   * Custom className
   */
  className?: string

  /**
   * Use Intersection Observer
   */
  useObserver?: boolean

  /**
   * Observer margin
   */
  observerMargin?: string
}

/**
 * ImageLoader Component
 * Provides render-prop pattern for advanced image loading scenarios
 *
 * Usage:
 * <ImageLoader
 *   src="/image.jpg"
 *   placeholder="/placeholder.jpg"
 *   alt="Description"
 * >
 *   {({ src, isLoaded, isLoading }) => (
 *     <img
 *       src={src}
 *       className={isLoaded ? 'opacity-100' : 'opacity-50'}
 *     />
 *   )}
 * </ImageLoader>
 */
export const ImageLoader: React.FC<ImageLoaderProps> = ({
  src,
  placeholder,
  alt,
  children,
  className = '',
  useObserver = true,
  observerMargin = '50px'
}) => {
  const { ref: observerRef, isVisible } = useIntersectionObserver({
    rootMargin: observerMargin,
    threshold: 0.01,
    once: true
  })

  const imageState = useLazyImage({
    src: useObserver && !isVisible ? placeholder || src : src,
    placeholder,
    alt
  })

  return (
    <div ref={observerRef} className={className}>
      {children(imageState)}
    </div>
  )
}
```

---

### Step 7: Add Configuration Constants

Create configuration for lazy loading behavior.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/config/lazyLoad.ts`

```typescript
/**
 * Lazy Loading Configuration
 */

export const LAZY_LOAD_CONFIG = {
  /**
   * Root margin for Intersection Observer
   * Negative values trigger load before entering viewport
   * Positive values trigger after entering
   */
  rootMargin: '100px 0px 50px 0px',

  /**
   * Threshold for Intersection Observer
   * Percentage of element visible before triggering
   * 0.1 = 10% visible
   */
  threshold: 0.1,

  /**
   * Image load timeout (milliseconds)
   */
  timeout: 10000,

  /**
   * Enable blur-up effect
   */
  enableBlurUp: true,

  /**
   * Fade transition duration (milliseconds)
   */
  transitionDuration: 300,

  /**
   * Observer options for different scenarios
   */
  scenarios: {
    /**
     * For above-fold images
     * Load immediately, don't wait for visibility
     */
    aboveFold: {
      rootMargin: '0px',
      threshold: 0,
      timeout: 5000
    },

    /**
     * For grid layouts
     * Load when 50px before entering viewport
     */
    grid: {
      rootMargin: '50px',
      threshold: 0.1,
      timeout: 10000
    },

    /**
     * For lazy sections
     * Load only when scrolled into view
     */
    lazySection: {
      rootMargin: '-50px',
      threshold: 0,
      timeout: 15000
    }
  }
} as const
```

---

## Files to Create/Modify

1. **Create:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/hooks/useIntersectionObserver.ts`
2. **Create:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/hooks/useLazyImage.ts`
3. **Create:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/components/common/LazyImage.tsx`
4. **Create:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/components/common/ImageLoader.tsx`
5. **Create:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/utils/placeholderGenerator.ts`
6. **Create:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/config/lazyLoad.ts`
7. **Modify:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/components/artwork/ArtworkCard.tsx` - Add observer ref to image container

---

## Verification

1. **Native Lazy Loading:**
   - Inspect images in DevTools
   - Confirm `loading="lazy"` attribute present on all `<img>` tags
   - Scroll page and verify images load as they enter viewport
   - Use Network tab to confirm deferred loading

2. **Intersection Observer:**
   - Add console.log in observer callback
   - Scroll to sections with lazy-loaded images
   - Confirm observer fires at correct timing
   - Verify observer disconnects after image load

3. **Blur-Up Effect:**
   - Images show placeholder/blur initially
   - Smooth fade transition to full image
   - No layout shift during transition
   - Blur removed once main image loads

4. **Performance:**
   - First Contentful Paint (FCP) improved
   - Initial bundle size reduced
   - Network requests staggered (not all at once)
   - Memory usage stable on long pages

5. **Below-Fold Content:**
   - Images below fold don't load on page load
   - Images load only when scrolled into view
   - Root margin working correctly (early pre-load)
   - Verify with Network tab throttling

6. **Error Handling:**
   - Failed image loads handled gracefully
   - Error state displays (placeholder or error message)
   - Timeout works correctly
   - No console errors

7. **Browser Support:**
   - Works in Chrome/Edge (native + observer)
   - Works in Firefox (observer fallback)
   - Works in Safari (observer fallback)
   - Graceful degradation for older browsers

8. **Cross-Browser Testing:**
   - Test on desktop (Chrome, Firefox, Safari, Edge)
   - Test on mobile (iOS Safari, Chrome Android)
   - Verify no hover/focus issues on mobile
   - Test with slow 3G network simulation
