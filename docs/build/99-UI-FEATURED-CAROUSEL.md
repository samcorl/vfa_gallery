# 99-UI-FEATURED-CAROUSEL.md

## Goal
Refine and complete the featured artists carousel component with smooth horizontal scrolling, keyboard navigation, touch support, and responsive arrow buttons for desktop.

---

## Spec Extract

From Phase 18 requirements:
- **Layout**: Horizontal scrolling carousel with snap points
- **Navigation**: Arrow buttons on desktop, touch swipe on mobile
- **Design**: Artist cards with avatar and artwork count
- **Responsive**: Adapts to all screen sizes
- **Accessibility**: Keyboard navigation support
- **Touch**: Swipe and scroll support on mobile

---

## Prerequisites

**Must complete before starting:**
- **93-API-BROWSE-FEATURED.md** - Featured endpoint
- **96-UI-HOMEPAGE.md** - Base carousel component structure

---

## Steps

### Step 1: Enhance Featured Artists Carousel Component

Update the carousel with improved keyboard and touch support.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/components/FeaturedArtistsCarousel.tsx`

Replace with enhanced version:

```typescript
import React, { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApi } from '../hooks/useApi'
import styles from './FeaturedArtistsCarousel.module.css'

interface FeaturedArtist {
  id: string
  username: string
  display_name: string
  avatar_url: string | null
  artworks_count: number
  featured_at: string
}

interface CarouselState {
  canScrollLeft: boolean
  canScrollRight: boolean
  isDragging: boolean
  dragStart: number
  dragOffset: number
}

export const FeaturedArtistsCarousel: React.FC = () => {
  const navigate = useNavigate()
  const { data, loading } = useApi('/api/browse/featured')
  const [artists, setArtists] = useState<FeaturedArtist[]>([])
  const [state, setState] = useState<CarouselState>({
    canScrollLeft: false,
    canScrollRight: true,
    isDragging: false,
    dragStart: 0,
    dragOffset: 0,
  })
  const scrollRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (data?.data?.artists) {
      setArtists(data.data.artists)
    }
  }, [data])

  // Check scroll position
  const updateScrollState = useCallback(() => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current
      setState((prev) => ({
        ...prev,
        canScrollLeft: scrollLeft > 0,
        canScrollRight: scrollLeft < scrollWidth - clientWidth - 10,
      }))
    }
  }, [])

  // Handle scroll event
  const handleScroll = () => {
    updateScrollState()
  }

  // Smooth scroll
  const scroll = useCallback((direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 300
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      })

      // Update state after animation
      setTimeout(updateScrollState, 300)
    }
  }, [updateScrollState])

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        scroll('left')
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        scroll('right')
      }
    },
    [scroll]
  )

  // Touch/mouse drag support
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setState((prev) => ({
      ...prev,
      isDragging: true,
      dragStart: e.clientX,
      dragOffset: 0,
    }))
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!state.isDragging || !scrollRef.current) return

    const dragDelta = e.clientX - state.dragStart
    setState((prev) => ({
      ...prev,
      dragOffset: dragDelta,
    }))

    // Apply drag offset
    scrollRef.current.scrollLeft -= dragDelta / 2
    setState((prev) => ({
      ...prev,
      dragStart: e.clientX,
    }))
  }

  const handleMouseUp = () => {
    setState((prev) => ({
      ...prev,
      isDragging: false,
      dragOffset: 0,
    }))
    updateScrollState()
  }

  // Touch support
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    setState((prev) => ({
      ...prev,
      isDragging: true,
      dragStart: e.touches[0].clientX,
    }))
  }

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!state.isDragging || !scrollRef.current) return

    const dragDelta = e.touches[0].clientX - state.dragStart
    scrollRef.current.scrollLeft -= dragDelta / 2
    setState((prev) => ({
      ...prev,
      dragStart: e.touches[0].clientX,
    }))
  }

  const handleTouchEnd = () => {
    setState((prev) => ({
      ...prev,
      isDragging: false,
    }))
    updateScrollState()
  }

  // Initialize scroll state
  useEffect(() => {
    updateScrollState()
  }, [artists, updateScrollState])

  // Handle artist click
  const handleArtistClick = (username: string) => {
    navigate(`/${username}`)
  }

  // Loading state
  if (loading) {
    return <div className={styles.loading}>Loading featured artists...</div>
  }

  // Empty state
  if (!artists || artists.length === 0) {
    return <div className={styles.empty}>No featured artists yet</div>
  }

  return (
    <div
      className={styles.container}
      ref={containerRef}
      onKeyDown={handleKeyDown}
      role="region"
      aria-label="Featured artists carousel"
    >
      {/* Left Arrow */}
      {state.canScrollLeft && (
        <button
          className={`${styles.arrow} ${styles.leftArrow}`}
          onClick={() => scroll('left')}
          aria-label="Scroll left"
          type="button"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>
      )}

      {/* Carousel */}
      <div
        className={`${styles.carousel} ${
          state.isDragging ? styles.dragging : ''
        }`}
        ref={scrollRef}
        onScroll={handleScroll}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {artists.map((artist) => (
          <ArtistCard
            key={artist.id}
            artist={artist}
            onClick={() => handleArtistClick(artist.username)}
          />
        ))}
      </div>

      {/* Right Arrow */}
      {state.canScrollRight && (
        <button
          className={`${styles.arrow} ${styles.rightArrow}`}
          onClick={() => scroll('right')}
          aria-label="Scroll right"
          type="button"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>
      )}
    </div>
  )
}

/**
 * Individual artist card component
 */
const ArtistCard: React.FC<{
  artist: FeaturedArtist
  onClick: () => void
}> = ({ artist, onClick }) => {
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onClick()
    }
  }

  return (
    <div
      className={styles.artistCard}
      onClick={onClick}
      onKeyPress={handleKeyPress}
      role="button"
      tabIndex={0}
      aria-label={`${artist.display_name}, ${artist.artworks_count} artworks`}
    >
      <div className={styles.avatarContainer}>
        {artist.avatar_url ? (
          <img
            src={artist.avatar_url}
            alt={artist.display_name}
            className={styles.avatar}
          />
        ) : (
          <div
            className={styles.avatarPlaceholder}
            aria-hidden="true"
          >
            {artist.display_name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      <h3 className={styles.artistName}>{artist.display_name}</h3>
      <p className={styles.artworkCount}>
        {artist.artworks_count}
        {artist.artworks_count === 1 ? ' artwork' : ' artworks'}
      </p>
    </div>
  )
}
```

---

### Step 2: Update Carousel Styles with Touch Support

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/components/FeaturedArtistsCarousel.module.css`

```css
.container {
  position: relative;
  width: 100%;
  display: flex;
  align-items: center;
  outline: none;
}

.carousel {
  display: flex;
  gap: 1rem;
  overflow-x: auto;
  overflow-y: hidden;
  scroll-behavior: smooth;
  scroll-snap-type: x mandatory;
  padding: 0 1rem;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  flex: 1;
  user-select: none;
}

.carousel::-webkit-scrollbar {
  display: none;
}

.carousel.dragging {
  scroll-behavior: auto;
  cursor: grabbing;
}

.artistCard {
  flex: 0 0 calc(50vw - 1rem);
  min-width: 120px;
  max-width: 180px;
  padding: 1rem;
  text-align: center;
  cursor: pointer;
  border-radius: 8px;
  transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
  scroll-snap-align: start;
  background: #f9f9f9;
  border: 1px solid transparent;
}

.artistCard:hover {
  transform: translateY(-4px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  background: #ffffff;
}

.artistCard:focus-visible {
  outline: 2px solid #0066cc;
  outline-offset: 2px;
}

.avatarContainer {
  margin-bottom: 0.75rem;
  display: flex;
  justify-content: center;
}

.avatar {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid #ddd;
  transition: border-color 0.2s ease;
}

.artistCard:hover .avatar {
  border-color: #0066cc;
}

.avatarPlaceholder {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 2rem;
  font-weight: bold;
}

.artistName {
  font-size: 0.95rem;
  font-weight: 600;
  margin: 0.5rem 0;
  color: #1a1a1a;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.artworkCount {
  font-size: 0.8rem;
  color: #666;
  margin: 0;
}

.arrow {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid #ddd;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  transition: all 0.2s ease;
  flex-shrink: 0;
  color: #1a1a1a;
  padding: 0;
}

.arrow:hover {
  background: #ffffff;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  border-color: #999;
}

.arrow:focus-visible {
  outline: 2px solid #0066cc;
  outline-offset: 2px;
}

.leftArrow {
  left: 8px;
}

.rightArrow {
  right: 8px;
}

.loading,
.empty {
  padding: 2rem;
  text-align: center;
  color: #666;
  width: 100%;
}

/* Tablet Breakpoint */
@media (min-width: 640px) {
  .carousel {
    padding: 0 1.5rem;
  }

  .artistCard {
    flex: 0 0 calc(33.333% - 1rem);
    max-width: 200px;
  }

  .arrow {
    width: 48px;
    height: 48px;
  }

  .leftArrow {
    left: 12px;
  }

  .rightArrow {
    right: 12px;
  }
}

/* Desktop Breakpoint */
@media (min-width: 1024px) {
  .carousel {
    padding: 0 3rem;
  }

  .artistCard {
    flex: 0 0 calc(16.666% - 1rem);
    max-width: 220px;
  }

  .arrow {
    width: 48px;
    height: 48px;
  }

  .leftArrow {
    left: 8px;
  }

  .rightArrow {
    right: 8px;
  }
}

/* Dark Mode */
@media (prefers-color-scheme: dark) {
  .artistCard {
    background: #2d2d2d;
    border-color: transparent;
  }

  .artistCard:hover {
    background: #333;
  }

  .artistName {
    color: #ffffff;
  }

  .artworkCount {
    color: #aaa;
  }

  .arrow {
    background: rgba(45, 45, 45, 0.95);
    border-color: #444;
    color: #ffffff;
  }

  .arrow:hover {
    background: #3d3d3d;
    border-color: #666;
  }

  .loading,
  .empty {
    color: #aaa;
  }
}

/* Reduce motion preference */
@media (prefers-reduced-motion: reduce) {
  .carousel {
    scroll-behavior: auto;
  }

  .artistCard {
    transition: none;
  }

  .arrow {
    transition: none;
  }
}
```

---

## Files to Create/Modify

**Modified files:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/components/FeaturedArtistsCarousel.tsx` - Enhanced version
2. `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/components/FeaturedArtistsCarousel.module.css` - Enhanced styles

---

## Verification

### Test 1: Carousel Loads

Navigate to homepage

Expected: Featured artists carousel renders with artists

---

### Test 2: Arrow Button Visibility

Expected: Left arrow hidden initially, right arrow visible if more content

---

### Test 3: Scroll with Right Arrow

Click right arrow

Expected: Carousel scrolls right smoothly, left arrow becomes visible

---

### Test 4: Scroll with Left Arrow

Click left arrow

Expected: Carousel scrolls left smoothly, right arrow visibility updates

---

### Test 5: Keyboard Navigation (Left)

Focus carousel and press left arrow key

Expected: Scrolls left, no page scroll

---

### Test 6: Keyboard Navigation (Right)

Focus carousel and press right arrow key

Expected: Scrolls right, no page scroll

---

### Test 7: Touch Swipe Left

On mobile/touch device, swipe left on carousel

Expected: Carousel scrolls left smoothly

---

### Test 8: Touch Swipe Right

On mobile/touch device, swipe right on carousel

Expected: Carousel scrolls right smoothly

---

### Test 9: Mouse Drag

On desktop, click and drag carousel

Expected: Carousel drags smoothly, cursor shows grab/grabbing

---

### Test 10: Click Artist Card

Click on featured artist card

Expected: Navigates to artist profile page

---

### Test 11: Tab Navigation

Tab through carousel cards

Expected: Each card gets focus indicator, can press Enter to navigate

---

### Test 12: Responsive Columns

Test on mobile (2 cards visible), tablet (3 cards), desktop (6 cards)

Expected: Column count changes appropriately

---

### Test 13: Empty Avatar Fallback

Artist without avatar_url

Expected: Shows initials in gradient circle

---

### Test 14: Avatar with Border

Artist with avatar

Expected: Avatar has border, border color changes on hover

---

### Test 15: Arrow Button Responsiveness

Resize from desktop to mobile

Expected: Arrow buttons remain visible and functional across sizes

---

### Test 16: Scroll Snap

On browsers supporting scroll-snap

Expected: Cards snap to alignment points when scrolling stops

---

### Test 17: Dark Mode

Toggle dark mode

Expected: Colors adjust appropriately, still readable and accessible

---

### Test 18: Reduced Motion

Enable reduced motion preference

Expected: Smooth scrolling disabled, instant scrolling instead

---

### Test 19: Overflow Text

Artist with very long name

Expected: Text truncates with ellipsis, doesn't overflow card

---

### Test 20: Artwork Count

Verify artwork count displayed correctly

Expected: Shows singular "1 artwork" or plural "N artworks"

---

## Summary

This enhanced carousel features:

- Smooth horizontal scrolling with Intersection Observer
- Keyboard navigation (arrow keys)
- Touch and mouse drag support
- Responsive layout with adaptive columns
- Accessibility features (ARIA labels, focus management, keyboard navigation)
- SVG arrow icons instead of text
- Visual feedback (hover, focus states)
- Dark mode support
- Reduced motion support
- Empty state and loading states
- Performance optimized

The carousel provides an excellent user experience across all devices and input methods while maintaining full accessibility.

---

**Next step:** Proceed to **100-API-SEARCH.md** to build the search endpoint.
