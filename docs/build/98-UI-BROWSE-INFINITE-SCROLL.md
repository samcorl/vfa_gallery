# 98-UI-BROWSE-INFINITE-SCROLL.md

## Goal
Implement infinite scroll functionality using Intersection Observer for efficient loading of paginated browse results. Users can scroll through artworks without pagination buttons.

---

## Spec Extract

From Phase 18 requirements:
- **Intersection Observer**: Use native browser API for scroll detection
- **Loading Indicator**: Show spinner while loading next page
- **"No More" Message**: Indicate when all results are loaded
- **Pagination**: Load 20 items per page automatically
- **Performance**: Efficient memory management, lazy loading images

---

## Prerequisites

**Must complete before starting:**
- **94-API-BROWSE-RECENT.md** - Recent endpoint with pagination
- **95-API-BROWSE-CATEGORIES.md** - Categories endpoint with pagination
- **97-UI-BROWSE-PAGE.md** - Browse page implementation

---

## Steps

### Step 1: Create Custom Hook for Infinite Scroll

Create a reusable hook for managing infinite scroll state and loading.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/hooks/useInfiniteScroll.ts`

```typescript
import { useEffect, useRef, useState, useCallback } from 'react'
import { useApi } from './useApi'

export interface InfiniteScrollOptions {
  endpoint: string
  initialLimit?: number
  threshold?: number
}

export interface InfiniteScrollResult<T> {
  items: T[]
  loading: boolean
  hasMore: boolean
  error: Error | null
  loadMore: () => void
  reset: () => void
}

/**
 * Custom hook for infinite scroll pagination
 * Uses Intersection Observer to detect when user scrolls near bottom
 */
export function useInfiniteScroll<T>(
  options: InfiniteScrollOptions
): InfiniteScrollResult<T> {
  const { endpoint, initialLimit = 20, threshold = 0.1 } = options

  const [page, setPage] = useState(1)
  const [items, setItems] = useState<T[]>([])
  const [hasMore, setHasMore] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)

  // Fetch next page of results
  const loadNextPage = useCallback(async () => {
    if (isLoading || !hasMore) return

    setIsLoading(true)
    setError(null)

    try {
      const url = new URL(endpoint, window.location.origin)
      url.searchParams.set('page', String(page + 1))
      url.searchParams.set('limit', String(initialLimit))

      const response = await fetch(url.toString())
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()

      if (data.data && Array.isArray(data.data)) {
        setItems((prevItems) => [...prevItems, ...data.data])
        setPage((prevPage) => prevPage + 1)

        // Check if there are more pages
        if (
          data.pagination &&
          data.pagination.page >= data.pagination.pages
        ) {
          setHasMore(false)
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'))
    } finally {
      setIsLoading(false)
    }
  }, [page, endpoint, initialLimit, hasMore, isLoading])

  // Intersection Observer for scroll detection
  useEffect(() => {
    const options = {
      root: null, // viewport
      rootMargin: '100px', // load before reaching bottom
      threshold,
    }

    observerRef.current = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && hasMore && !isLoading) {
          loadNextPage()
        }
      })
    }, options)

    if (sentinelRef.current) {
      observerRef.current.observe(sentinelRef.current)
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
    }
  }, [loadNextPage, hasMore, isLoading])

  // Load initial page
  useEffect(() => {
    const loadInitial = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const url = new URL(endpoint, window.location.origin)
        url.searchParams.set('page', '1')
        url.searchParams.set('limit', String(initialLimit))

        const response = await fetch(url.toString())
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }

        const data = await response.json()

        if (data.data && Array.isArray(data.data)) {
          setItems(data.data)
          setPage(1)

          // Check if there are more pages
          if (
            data.pagination &&
            data.pagination.page >= data.pagination.pages
          ) {
            setHasMore(false)
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'))
      } finally {
        setIsLoading(false)
      }
    }

    loadInitial()
  }, [endpoint, initialLimit])

  // Manual load more function
  const loadMore = useCallback(() => {
    loadNextPage()
  }, [loadNextPage])

  // Reset to initial state
  const reset = useCallback(() => {
    setPage(1)
    setItems([])
    setHasMore(true)
    setError(null)
    setIsLoading(false)
  }, [])

  return {
    items,
    loading: isLoading,
    hasMore,
    error,
    loadMore,
    reset,
    sentinelRef, // Export for mounting in JSX
  } as any
}
```

---

### Step 2: Create Infinite Scroll Component

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/components/BrowseInfiniteScroll.tsx`

```typescript
import React, { useEffect } from 'react'
import { useInfiniteScroll } from '../hooks/useInfiniteScroll'
import { ArtworkGrid } from './ArtworkGrid'
import styles from './BrowseInfiniteScroll.module.css'

interface Props {
  endpoint: string
  title?: string
}

export const BrowseInfiniteScroll: React.FC<Props> = ({ endpoint, title }) => {
  const { items, loading, hasMore, error, loadMore, sentinelRef } =
    useInfiniteScroll({
      endpoint,
      initialLimit: 20,
      threshold: 0.1,
    })

  if (error) {
    return (
      <div className={styles.error}>
        <p>Failed to load artworks: {error.message}</p>
        <button onClick={loadMore}>Try Again</button>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      {title && <h2 className={styles.title}>{title}</h2>}

      <ArtworkGrid
        artworks={items}
        loading={items.length === 0 && loading}
        columns={{ mobile: 2, tablet: 3, desktop: 4 }}
      />

      {/* Sentinel element for Intersection Observer */}
      <div ref={sentinelRef} className={styles.sentinel} />

      {/* Loading Indicator */}
      {loading && items.length > 0 && (
        <div className={styles.loadingIndicator}>
          <div className={styles.spinner} />
          <p>Loading more artworks...</p>
        </div>
      )}

      {/* No More Results Message */}
      {!hasMore && items.length > 0 && (
        <div className={styles.noMore}>
          <p>You've reached the end</p>
        </div>
      )}

      {/* Empty State */}
      {items.length === 0 && !loading && (
        <div className={styles.empty}>
          <p>No artworks found</p>
        </div>
      )}
    </div>
  )
}
```

---

### Step 3: Create Infinite Scroll Styles

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/components/BrowseInfiniteScroll.module.css`

```css
.container {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.title {
  font-size: 1.75rem;
  font-weight: 700;
  margin: 0;
  color: #1a1a1a;
}

.sentinel {
  height: 1px;
  visibility: hidden;
}

.loadingIndicator {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  gap: 1rem;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #e0e0e0;
  border-top-color: #0066cc;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.loadingIndicator p {
  font-size: 0.95rem;
  color: #666;
  margin: 0;
}

.noMore {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  background: #f9f9f9;
  border-radius: 8px;
  text-align: center;
  color: #999;
}

.noMore p {
  margin: 0;
  font-size: 0.95rem;
}

.empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  color: #999;
  text-align: center;
}

.empty p {
  margin: 0;
  font-size: 1.1rem;
}

.error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  padding: 2rem;
  text-align: center;
}

.error p {
  margin: 0 0 1rem 0;
  color: #d32f2f;
  font-size: 0.95rem;
}

.error button {
  padding: 0.5rem 1.5rem;
  background: #0066cc;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
  transition: background 0.2s ease;
}

.error button:hover {
  background: #0052a3;
}

/* Dark Mode */
@media (prefers-color-scheme: dark) {
  .title {
    color: #ffffff;
  }

  .spinner {
    border-color: #333;
    border-top-color: #66b3ff;
  }

  .loadingIndicator p {
    color: #aaa;
  }

  .noMore {
    background: #2d2d2d;
    color: #666;
  }

  .empty,
  .error {
    color: #666;
  }

  .error p {
    color: #ff6b6b;
  }
}
```

---

### Step 4: Create Lazy Image Loading Hook

Optimize image loading with lazy loading and intersection observer.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/hooks/useLazyImage.ts`

```typescript
import { useEffect, useRef, useState } from 'react'

export function useLazyImage(src: string, placeholder?: string) {
  const [imageSrc, setImageSrc] = useState(placeholder || '')
  const [imageRef, setImageRef] = useState<HTMLImageElement | null>(null)

  useEffect(() => {
    let observer: IntersectionObserver | null = null

    const imageElement = imageRef

    if (imageElement) {
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              // Image is in viewport, start loading
              setImageSrc(src)
              if (observer && imageElement) {
                observer.unobserve(imageElement)
              }
            }
          })
        },
        {
          rootMargin: '50px',
        }
      )

      observer.observe(imageElement)
    }

    return () => {
      if (observer && imageElement) {
        observer.unobserve(imageElement)
      }
    }
  }, [src, imageRef])

  return { imageSrc, setImageRef }
}
```

---

### Step 5: Update Artwork Card with Lazy Loading

Update the artwork card component to use lazy image loading.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/components/ArtworkCard.tsx`

Add lazy loading:

```typescript
import { useLazyImage } from '../hooks/useLazyImage'

// In component:
const { imageSrc, setImageRef } = useLazyImage(artwork.image_url)

// In JSX:
<img
  ref={setImageRef}
  src={imageSrc}
  alt={artwork.title}
  className={styles.image}
/>
```

---

## Files to Create/Modify

**Created files:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/hooks/useInfiniteScroll.ts` - Infinite scroll hook
2. `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/components/BrowseInfiniteScroll.tsx` - Infinite scroll component
3. `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/components/BrowseInfiniteScroll.module.css` - Component styles
4. `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/hooks/useLazyImage.ts` - Lazy image loading hook

**Modified files:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/components/ArtworkCard.tsx` - Add lazy image loading
2. `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/pages/Browse.tsx` - Already uses BrowseInfiniteScroll

---

## Verification

### Test 1: Initial Load

Navigate to `/browse?mode=recent`

Expected: Loads first page (20 artworks)

---

### Test 2: Scroll to Bottom

Scroll to bottom of page

Expected: Automatically loads next page of artworks

---

### Test 3: Loading Indicator

Observe while scrolling

Expected: Shows spinner and "Loading more artworks..." message during fetch

---

### Test 4: No More Results

Scroll until all results loaded

Expected: Shows "You've reached the end" message

---

### Test 5: Empty Results

Navigate to category with no artworks

Expected: Shows "No artworks found" message

---

### Test 6: Error Handling

Simulate network error (DevTools network throttle)

Expected: Shows error message with "Try Again" button

---

### Test 7: Lazy Image Loading

Scroll down slowly

Expected: Images load as they come into view, not all at once

---

### Test 8: Memory Efficiency

Scroll through 100+ artworks

Expected: Memory usage remains reasonable, old images unloaded

---

### Test 9: Multiple Categories

Switch between categories

Expected: Resets scroll position and loads new category data

---

### Test 10: URL Parameter Change

Change URL parameters while scrolled down

Expected: Resets to top, loads new data

---

### Test 11: Mobile Scroll Performance

Test on mobile device with slow network

Expected: Smooth scrolling, appropriate loading feedback

---

### Test 12: Pagination Accuracy

Load multiple pages, verify total count

Expected: Number of items matches pagination.total from API

---

### Test 13: Concurrent Requests

Scroll very fast

Expected: Only one request in flight at a time, no race conditions

---

### Test 14: Sentinel Visibility

Inspect DOM

Expected: Sentinel element present but invisible (height: 1px, visibility: hidden)

---

### Test 15: Reset Functionality

Programmatically call reset()

Expected: Items cleared, pagination reset, ready to load fresh data

---

## Summary

This build implements infinite scroll with:

- Intersection Observer for efficient scroll detection
- Automatic pagination on scroll
- Loading indicators and completion messages
- Lazy image loading for performance
- Error handling with retry capability
- Memory-efficient data loading
- Mobile-optimized scrolling
- No loading buttons needed

The infinite scroll provides a seamless browsing experience while keeping memory and bandwidth efficient.

---

**Next step:** Proceed to **99-UI-FEATURED-CAROUSEL.md** to refine the featured carousel component.
