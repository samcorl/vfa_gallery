# 96-UI-HOMEPAGE.md

## Goal
Build the homepage (`/`) with a hero section, featured artists carousel, recent artworks grid, and footer. This is the primary entry point for the platform.

---

## Spec Extract

From Phase 18 requirements:
- **Layout**: Mobile-first, minimalist design
- **Hero Section**: Tagline with clear call-to-action (CTA) button
- **Featured Section**: Horizontal carousel of featured artists (see 99-UI-FEATURED-CAROUSEL.md)
- **Recent Section**: Grid of recently posted artworks with infinite scroll capability
- **Footer**: Simple footer with ad placement area
- **Responsive**: Works well on mobile, tablet, and desktop

---

## Prerequisites

**Must complete before starting:**
- **93-API-BROWSE-FEATURED.md** - Featured endpoint
- **94-API-BROWSE-RECENT.md** - Recent endpoint
- **UI Navigation component** - Top/bottom navigation
- **Artwork Grid component** - Reusable grid display (See 48-UI-ARTWORK-GRID.md)

---

## Steps

### Step 1: Create Homepage Route Component

Create the main homepage route component that assembles all sections.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/pages/Home.tsx`

```typescript
import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/Button'
import { FeaturedArtistsCarousel } from '../components/FeaturedArtistsCarousel'
import { ArtworkGrid } from '../components/ArtworkGrid'
import { Footer } from '../components/Footer'
import { useApi } from '../hooks/useApi'
import styles from './Home.module.css'

export const Home: React.FC = () => {
  const navigate = useNavigate()
  const { data: recentData, loading: recentLoading } = useApi(
    '/api/browse/recent?limit=20'
  )
  const [recentArtworks, setRecentArtworks] = useState<any[]>([])

  useEffect(() => {
    if (recentData?.data) {
      setRecentArtworks(recentData.data)
    }
  }, [recentData])

  const handleBrowseClick = () => {
    navigate('/browse')
  }

  const handleUploadClick = () => {
    navigate('/profile/artworks/new')
  }

  return (
    <div className={styles.homepage}>
      {/* Hero Section */}
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <h1 className={styles.heroTitle}>You Should Be In Pictures</h1>
          <p className={styles.heroSubtitle}>
            A gallery platform for emerging visual artists. Comics, manga, illustrations, and more.
          </p>
          <div className={styles.heroCTA}>
            <Button
              variant="primary"
              size="large"
              onClick={handleBrowseClick}
            >
              Browse Artwork
            </Button>
            <Button
              variant="secondary"
              size="large"
              onClick={handleUploadClick}
            >
              Upload Your Work
            </Button>
          </div>
        </div>
      </section>

      {/* Featured Artists Section */}
      <section className={styles.featuredSection}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Featured Artists</h2>
          <a href="/browse?filter=featured" className={styles.viewAll}>
            View All →
          </a>
        </div>
        <FeaturedArtistsCarousel />
      </section>

      {/* Recently Added Section */}
      <section className={styles.recentSection}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Recently Added</h2>
          <a href="/browse?filter=recent" className={styles.viewAll}>
            View All →
          </a>
        </div>
        <ArtworkGrid
          artworks={recentArtworks}
          loading={recentLoading}
          columns={{ mobile: 2, tablet: 3, desktop: 4 }}
        />
      </section>

      {/* Footer */}
      <Footer />
    </div>
  )
}
```

---

### Step 2: Create Homepage Styles

Create the CSS module for the homepage layout.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/pages/Home.module.css`

```css
.homepage {
  width: 100%;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

/* Hero Section */
.hero {
  width: 100%;
  padding: 3rem 1rem;
  background: linear-gradient(135deg, #f5f5f5 0%, #ffffff 100%);
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
}

.heroContent {
  max-width: 600px;
  width: 100%;
}

.heroTitle {
  font-size: 2rem;
  line-height: 1.2;
  margin: 0 0 1rem 0;
  font-weight: 700;
  color: #1a1a1a;
}

.heroSubtitle {
  font-size: 1.1rem;
  line-height: 1.5;
  margin: 0 0 2rem 0;
  color: #666;
}

.heroCTA {
  display: flex;
  gap: 1rem;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

/* Section Headers */
.sectionHeader {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  padding: 0 1rem;
}

.sectionTitle {
  font-size: 1.75rem;
  font-weight: 700;
  margin: 0;
  color: #1a1a1a;
}

.viewAll {
  color: #0066cc;
  text-decoration: none;
  font-weight: 500;
  font-size: 0.95rem;
  transition: color 0.2s ease;
}

.viewAll:hover {
  color: #0052a3;
}

/* Featured Section */
.featuredSection {
  width: 100%;
  padding: 3rem 0;
  background: #ffffff;
  border-bottom: 1px solid #e0e0e0;
}

/* Recent Section */
.recentSection {
  width: 100%;
  padding: 3rem 1rem;
  flex: 1;
}

/* Tablet Breakpoint */
@media (min-width: 640px) {
  .hero {
    min-height: 70vh;
    padding: 4rem 2rem;
  }

  .heroTitle {
    font-size: 2.75rem;
  }

  .heroSubtitle {
    font-size: 1.25rem;
  }

  .heroCTA {
    flex-direction: row;
    gap: 1.5rem;
  }

  .sectionHeader {
    padding: 0 2rem;
  }

  .sectionTitle {
    font-size: 2rem;
  }

  .featuredSection {
    padding: 3rem 2rem;
  }

  .recentSection {
    padding: 3rem 2rem;
  }
}

/* Desktop Breakpoint */
@media (min-width: 1024px) {
  .hero {
    min-height: 80vh;
    padding: 5rem 3rem;
  }

  .heroTitle {
    font-size: 3.5rem;
  }

  .heroSubtitle {
    font-size: 1.35rem;
  }

  .heroCTA {
    gap: 2rem;
  }

  .sectionHeader {
    padding: 0 3rem;
  }

  .sectionTitle {
    font-size: 2.25rem;
  }

  .featuredSection {
    padding: 4rem 3rem;
  }

  .recentSection {
    padding: 4rem 3rem;
  }
}

/* Dark Mode Support (optional) */
@media (prefers-color-scheme: dark) {
  .hero {
    background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
  }

  .heroTitle,
  .sectionTitle {
    color: #ffffff;
  }

  .heroSubtitle {
    color: #aaaaaa;
  }

  .featuredSection,
  .recentSection {
    background: #1a1a1a;
  }

  .viewAll {
    color: #66b3ff;
  }

  .viewAll:hover {
    color: #99d1ff;
  }
}
```

---

### Step 3: Create Featured Artists Carousel Component

This component will be used in the homepage and browse page.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/components/FeaturedArtistsCarousel.tsx`

```typescript
import React, { useEffect, useState, useRef } from 'react'
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

export const FeaturedArtistsCarousel: React.FC = () => {
  const navigate = useNavigate()
  const { data, loading } = useApi('/api/browse/featured')
  const [artists, setArtists] = useState<FeaturedArtist[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)
  const [showLeftArrow, setShowLeftArrow] = useState(false)
  const [showRightArrow, setShowRightArrow] = useState(true)

  useEffect(() => {
    if (data?.data?.artists) {
      setArtists(data.data.artists)
    }
  }, [data])

  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current
      setShowLeftArrow(scrollLeft > 0)
      setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 10)
    }
  }

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 300
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      })
    }
  }

  const handleArtistClick = (username: string) => {
    navigate(`/${username}`)
  }

  if (loading) {
    return <div className={styles.loading}>Loading featured artists...</div>
  }

  if (!artists || artists.length === 0) {
    return <div className={styles.empty}>No featured artists yet</div>
  }

  return (
    <div className={styles.container}>
      {showLeftArrow && (
        <button
          className={`${styles.arrow} ${styles.leftArrow}`}
          onClick={() => scroll('left')}
          aria-label="Scroll left"
        >
          ‹
        </button>
      )}

      <div
        className={styles.carousel}
        ref={scrollRef}
        onScroll={handleScroll}
      >
        {artists.map((artist) => (
          <div
            key={artist.id}
            className={styles.artistCard}
            onClick={() => handleArtistClick(artist.username)}
            role="button"
            tabIndex={0}
            onKeyPress={(e) => {
              if (e.key === 'Enter') handleArtistClick(artist.username)
            }}
          >
            <div className={styles.avatarContainer}>
              {artist.avatar_url ? (
                <img
                  src={artist.avatar_url}
                  alt={artist.display_name}
                  className={styles.avatar}
                />
              ) : (
                <div className={styles.avatarPlaceholder}>
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
        ))}
      </div>

      {showRightArrow && (
        <button
          className={`${styles.arrow} ${styles.rightArrow}`}
          onClick={() => scroll('right')}
          aria-label="Scroll right"
        >
          ›
        </button>
      )}
    </div>
  )
}
```

---

### Step 4: Create Carousel Styles

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/components/FeaturedArtistsCarousel.module.css`

```css
.container {
  position: relative;
  width: 100%;
  display: flex;
  align-items: center;
}

.carousel {
  display: flex;
  gap: 1rem;
  overflow-x: auto;
  scroll-behavior: smooth;
  scroll-snap-type: x mandatory;
  padding: 0 1rem;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}

.carousel::-webkit-scrollbar {
  display: none;
}

.artistCard {
  flex: 0 0 calc(50vw - 1rem);
  min-width: 120px;
  max-width: 180px;
  padding: 1rem;
  text-align: center;
  cursor: pointer;
  border-radius: 8px;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  scroll-snap-align: start;
  background: #f9f9f9;
}

.artistCard:hover {
  transform: translateY(-4px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
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
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid #ddd;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  font-size: 1.5rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  transition: background 0.2s ease;
}

.arrow:hover {
  background: #ffffff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.leftArrow {
  left: 0;
}

.rightArrow {
  right: 0;
}

.loading,
.empty {
  padding: 2rem;
  text-align: center;
  color: #666;
}

/* Tablet Breakpoint */
@media (min-width: 640px) {
  .artistCard {
    flex: 0 0 calc(33.333% - 1rem);
    max-width: 200px;
  }

  .arrow {
    width: 48px;
    height: 48px;
    font-size: 1.75rem;
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
    display: flex;
  }
}

/* Dark Mode */
@media (prefers-color-scheme: dark) {
  .artistCard {
    background: #2d2d2d;
  }

  .artistName {
    color: #ffffff;
  }

  .artworkCount {
    color: #aaa;
  }

  .arrow {
    background: rgba(45, 45, 45, 0.9);
    border-color: #444;
    color: #ffffff;
  }

  .arrow:hover {
    background: #333;
  }
}
```

---

### Step 5: Create Footer Component

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/components/Footer.tsx`

```typescript
import React from 'react'
import styles from './Footer.module.css'

export const Footer: React.FC = () => {
  return (
    <footer className={styles.footer}>
      <div className={styles.content}>
        <div className={styles.info}>
          <h3>You Should Be In Pictures</h3>
          <p>A gallery platform for emerging visual fine artists.</p>
        </div>

        <div className={styles.links}>
          <nav>
            <a href="/">Home</a>
            <a href="/browse">Browse</a>
            <a href="/search">Search</a>
          </nav>
        </div>

        <div className={styles.adsPlaceholder}>
          {/* Ad placement area - to be configured with ad network */}
          <div className={styles.adSlot}>Advertisement</div>
        </div>
      </div>

      <div className={styles.bottom}>
        <p>&copy; 2026 You Should Be In Pictures. All rights reserved.</p>
      </div>
    </footer>
  )
}
```

---

### Step 6: Create Footer Styles

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/components/Footer.module.css`

```css
.footer {
  width: 100%;
  background: #1a1a1a;
  color: #ffffff;
  margin-top: auto;
}

.content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 3rem 1rem;
  display: grid;
  gap: 2rem;
}

.info h3 {
  font-size: 1.25rem;
  margin: 0 0 0.5rem 0;
  font-weight: 700;
}

.info p {
  margin: 0;
  color: #aaa;
  font-size: 0.95rem;
}

.links nav {
  display: flex;
  gap: 2rem;
  flex-wrap: wrap;
}

.links a {
  color: #aaa;
  text-decoration: none;
  font-size: 0.95rem;
  transition: color 0.2s ease;
}

.links a:hover {
  color: #ffffff;
}

.adsPlaceholder {
  min-height: 100px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.adSlot {
  width: 100%;
  height: 100px;
  background: #2d2d2d;
  border: 1px dashed #444;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #666;
  font-size: 0.85rem;
  border-radius: 4px;
}

.bottom {
  border-top: 1px solid #333;
  padding: 1.5rem;
  text-align: center;
  color: #666;
  font-size: 0.85rem;
}

/* Tablet */
@media (min-width: 640px) {
  .content {
    padding: 4rem 2rem;
    grid-template-columns: 2fr 1fr 1fr;
  }
}

/* Desktop */
@media (min-width: 1024px) {
  .content {
    padding: 4rem 3rem;
    grid-template-columns: 2fr 1fr 2fr;
  }
}
```

---

### Step 7: Register Homepage Route

Update the main routing file to include the homepage.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/App.tsx`

```typescript
import { Home } from './pages/Home'

// Add to router configuration:
{
  path: '/',
  element: <Home />
}
```

---

## Files to Create/Modify

**Created files:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/pages/Home.tsx` - Homepage route
2. `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/pages/Home.module.css` - Homepage styles
3. `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/components/FeaturedArtistsCarousel.tsx` - Carousel component
4. `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/components/FeaturedArtistsCarousel.module.css` - Carousel styles
5. `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/components/Footer.tsx` - Footer component
6. `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/components/Footer.module.css` - Footer styles

**Modified files:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/App.tsx` - Register homepage route

---

## Verification

### Test 1: Homepage Loads

```bash
cd /Volumes/DataSSD/gitsrc/vfa_gallery/site
npm run dev
# Navigate to http://localhost:5173/
```

Expected: Homepage loads without errors

---

### Test 2: Hero Section Renders

Expected: Displays title "You Should Be In Pictures", subtitle, and two CTA buttons

---

### Test 3: Browse Button Navigation

Click "Browse Artwork" button

Expected: Navigates to `/browse` page

---

### Test 4: Upload Button Navigation

Click "Upload Your Work" button (when logged in)

Expected: Navigates to `/profile/artworks/new`

---

### Test 5: Featured Artists Load

Expected: Featured artists carousel displays with artist avatars and names

---

### Test 6: Featured Artists Carousel Navigation

Click left/right arrows on carousel

Expected: Carousel scrolls smoothly; arrows hide at boundaries

---

### Test 7: Featured Artist Click Navigation

Click on featured artist card

Expected: Navigates to artist profile page

---

### Test 8: Recent Artworks Load

Expected: Recent artworks grid displays below featured artists

---

### Test 9: Recent Artworks Grid Responsive

Resize browser to mobile, tablet, desktop sizes

Expected: Grid columns adjust (2 on mobile, 3 on tablet, 4 on desktop)

---

### Test 10: Footer Renders

Scroll to bottom

Expected: Footer displays with links and ad placeholder area

---

### Test 11: Mobile Responsive

Test on mobile device or mobile viewport

Expected: Hero section scaled appropriately, buttons stack vertically, carousel works with touch

---

### Test 12: Artwork Card Click

Click on artwork in recent grid

Expected: Navigates to artwork detail page

---

### Test 13: View All Links

Click "View All →" links

Expected: Navigates to browse page with correct filter applied

---

### Test 14: Performance

Measure load time and Core Web Vitals

Expected: Loads quickly, good LCP and CLS scores

---

### Test 15: Accessibility

Test with keyboard navigation and screen reader

Expected: All interactive elements accessible, proper ARIA labels

---

## Summary

This build creates the homepage with:

- Hero section with clear tagline and CTAs
- Featured artists carousel with smooth scrolling
- Recent artworks grid with infinite scroll capability
- Footer with ad placement area
- Mobile-first responsive design
- Proper linking and navigation
- Loading and empty states
- Dark mode support

The homepage serves as the primary entry point and showcases the platform's best content.

---

**Next step:** Proceed to **97-UI-BROWSE-PAGE.md** to build the main browse page.
