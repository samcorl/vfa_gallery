# 157-ADS-FOOTER-PLACEMENT.md

## Goal

Integrate ad slots into page layouts, specifically in the footer area. Position ads below all content, clearly mark as "Advertisement", never place between artwork items, implement responsive sizing.

---

## Spec Extract

From TECHNICAL-SPEC.md - Ad Integration:

- **Placement:** Footer area of pages
- **Position:** Below all content before footer
- **Label:** Clearly marked "Advertisement"
- **Never:** Between artwork items or content
- **Responsive:** Adjust size for mobile/desktop
- **User Control:** Respect ad preferences
- **Rendering:** Load after main content

---

## Prerequisites

**Must complete before starting:**
- **156-ADS-SLOT-COMPONENT.md** - Ad slot component
- **27-REACT-LAYOUT-SHELL.md** - App shell layout
- **96-UI-HOMEPAGE.md** - Homepage layout

---

## Steps

### Step 1: Create Footer Ad Container Component

Create a wrapper component for footer ads.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/ads/FooterAdZone.tsx`

```typescript
import AdSlot from './AdSlot'
import { useAdSlots } from '../../hooks/useAdSlots'

interface FooterAdZoneProps {
  variant?: 'banner' | 'leaderboard'
  className?: string
}

/**
 * Footer ad zone component
 * Places ad slots at the bottom of pages with proper labeling
 */
export default function FooterAdZone({
  variant = 'leaderboard',
  className = '',
}: FooterAdZoneProps) {
  const { adsEnabled } = useAdSlots()

  if (!adsEnabled) {
    return null
  }

  // Determine size based on variant
  const adSize = variant === 'banner' ? 'banner' : 'leaderboard'

  return (
    <div className={`footer-ad-zone py-6 ${className}`}>
      {/* Ad Label */}
      <div className="text-center mb-4">
        <p className="text-xs text-gray-500 font-semibold tracking-wide">
          ADVERTISEMENT
        </p>
      </div>

      {/* Ad Container - Centered */}
      <div className="flex justify-center">
        <AdSlot
          size={adSize}
          id={`footer-ad-${adSize}`}
          className="footer-ad-slot"
        />
      </div>

      {/* Visual separator below ad */}
      <div className="mt-6 border-t border-gray-200" />
    </div>
  )
}
```

---

### Step 2: Update Homepage Layout

Add footer ad to homepage.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/pages/Homepage.tsx`

Add import:

```typescript
import FooterAdZone from '../components/ads/FooterAdZone'
```

Update layout to include footer ad:

```typescript
export default function Homepage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Existing Header */}
      <Header />

      {/* Hero Section */}
      <HeroSection />

      {/* Featured Works */}
      <FeaturedSection />

      {/* Browse Section */}
      <BrowseSection />

      {/* Footer Ad Zone */}
      <div className="bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FooterAdZone />
        </div>
      </div>

      {/* Footer */}
      <Footer />
    </div>
  )
}
```

---

### Step 3: Create Browse Page Ad Integration

Add ads to browse/infinite scroll pages.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/pages/Browse.tsx`

Add import:

```typescript
import FooterAdZone from '../components/ads/FooterAdZone'
```

Update layout:

```typescript
export default function BrowsePage() {
  const [artworks, setArtworks] = useState<Artwork[]>([])
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const { ref } = useInView({
    onChange: (inView) => {
      if (inView && !loading && hasMore) {
        loadMore()
      }
    },
  })

  return (
    <div className="min-h-screen bg-white">
      {/* Browse Header */}
      <BrowseHeader />

      {/* Infinite Scroll Artworks */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <ArtworkGrid artworks={artworks} />

        {/* Loading indicator */}
        {loading && <LoadingSpinner />}

        {/* Intersection observer trigger */}
        <div ref={ref} className="py-8" />

        {/* End of content - show ad before footer */}
        {!hasMore && (
          <div className="bg-gray-50 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8">
            <FooterAdZone />
          </div>
        )}
      </div>

      {/* Footer */}
      <Footer />
    </div>
  )
}
```

---

### Step 4: Update Gallery View

Add footer ad to gallery view pages.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/pages/public/Gallery.tsx`

Add import:

```typescript
import FooterAdZone from '../../components/ads/FooterAdZone'
```

Update layout:

```typescript
export default function GalleryPage() {
  const { galleryId } = useParams()
  const [gallery, setGallery] = useState<Gallery | null>(null)
  const [collections, setCollections] = useState<Collection[]>([])
  const [loading, setLoading] = useState(true)

  // ... existing logic ...

  return (
    <div className="min-h-screen bg-white">
      {/* Gallery Header */}
      {gallery && <GalleryHeader gallery={gallery} />}

      {/* Collections Grid */}
      {collections.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <CollectionsGrid collections={collections} />
        </div>
      )}

      {/* Footer Ad Zone */}
      <div className="bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FooterAdZone />
        </div>
      </div>

      {/* Footer */}
      <Footer />
    </div>
  )
}
```

---

### Step 5: Search Results Page

Add footer ad to search results.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/pages/Search.tsx`

Add import:

```typescript
import FooterAdZone from '../components/ads/FooterAdZone'
```

Update layout:

```typescript
export default function SearchPage() {
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')

  // ... existing search logic ...

  return (
    <div className="min-h-screen bg-white">
      {/* Search Header */}
      <SearchHeader query={query} onSearch={setQuery} />

      {/* Results Section */}
      {results.length > 0 ? (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <ResultsGrid results={results} />

          {/* Footer Ad after results */}
          <div className="mt-12 bg-gray-50 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8">
            <FooterAdZone />
          </div>
        </div>
      ) : (
        <EmptySearchResults query={query} />
      )}

      {/* Footer */}
      <Footer />
    </div>
  )
}
```

---

### Step 6: Create Responsive Ad Component

For mobile optimization.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/ads/ResponsiveAdZone.tsx`

```typescript
import { useEffect, useState } from 'react'
import AdSlot from './AdSlot'
import { useAdSlots } from '../../hooks/useAdSlots'

/**
 * Responsive ad zone that adapts to screen size
 */
export default function ResponsiveAdZone() {
  const { adsEnabled } = useAdSlots()
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768)
    }

    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  if (!adsEnabled) {
    return null
  }

  return (
    <div className="responsive-ad-zone py-6">
      {/* Ad Label */}
      <div className="text-center mb-4">
        <p className="text-xs text-gray-500 font-semibold tracking-wide">
          ADVERTISEMENT
        </p>
      </div>

      {/* Ad Container - Responsive */}
      <div className="flex justify-center">
        {isMobile ? (
          // Mobile: 300x250 banner
          <AdSlot size="banner" id="responsive-ad-mobile" />
        ) : (
          // Desktop: 728x90 leaderboard
          <AdSlot size="leaderboard" id="responsive-ad-desktop" />
        )}
      </div>

      {/* Visual separator */}
      <div className="mt-6 border-t border-gray-200" />
    </div>
  )
}
```

---

### Step 7: Create Ad Guidelines Component

For documentation and consistency.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/ads/AdGuidelines.tsx`

```typescript
/**
 * Ad placement guidelines for developers
 * Reference component for implementing ads consistently
 */

/**
 * DO:
 * - Place ads in footer/bottom of pages
 * - Use FooterAdZone or ResponsiveAdZone wrapper
 * - Label ads clearly as "ADVERTISEMENT"
 * - Center ads on page
 * - Respect user ad preferences
 * - Load ads after main content
 * - Use proper spacing around ads
 *
 * DON'T:
 * - Place ads between content items
 * - Hide ad labels or make them small
 * - Auto-play sounds/videos in ads
 * - Mix ads with content
 * - Show ads to users who disabled them
 * - Place multiple ads close together
 *
 * PLACEMENT LOCATIONS:
 * 1. Homepage - Below featured section, before footer
 * 2. Browse page - After infinite scroll completes
 * 3. Gallery view - Below all collections, before footer
 * 4. Search results - Below results, before footer
 * 5. Artist profile - Below artworks, before footer
 */

export const AD_GUIDELINES = {
  placement: ['footer', 'sidebar'],
  avoidPlacement: ['between-items', 'in-content', 'header'],
  label: 'ADVERTISEMENT',
  spacing: {
    top: 'py-6 or mt-12',
    bottom: 'border-t border-gray-200',
  },
}
```

---

## Files to Create/Modify

**New files to create:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/ads/FooterAdZone.tsx`
2. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/ads/ResponsiveAdZone.tsx`
3. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/ads/AdGuidelines.tsx`

**Files to modify:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/pages/Homepage.tsx` - Add FooterAdZone
2. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/pages/Browse.tsx` - Add FooterAdZone
3. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/pages/public/Gallery.tsx` - Add FooterAdZone
4. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/pages/Search.tsx` - Add FooterAdZone

---

## Verification

### Test 1: TypeScript Compilation

```bash
cd /Volumes/DataSSD/gitsrc/vfa_gallery
npx tsc --noEmit
```

Expected: No type errors

---

### Test 2: Homepage Footer Ad

1. Navigate to homepage
2. Scroll to bottom
3. Verify:
   - "ADVERTISEMENT" label visible
   - Ad slot placeholder displays
   - Positioned below content, above footer
   - Proper spacing maintained

---

### Test 3: Browse Page Footer Ad

1. Navigate to browse page
2. Scroll through infinite scroll
3. When end of content reached, verify:
   - Ad displays after last artwork item
   - Not between artwork items
   - "ADVERTISEMENT" label visible
   - Proper spacing

---

### Test 4: Gallery View Footer Ad

1. Navigate to public gallery
2. Scroll to bottom
3. Verify:
   - Ad displays below all collections
   - Before footer
   - Centered on page
   - Label visible

---

### Test 5: Search Results Footer Ad

1. Perform search
2. View results
3. Scroll to bottom
4. Verify:
   - Ad displays below results
   - Never mixed in with results
   - Properly spaced
   - Label present

---

### Test 6: Responsive Ad Zone

1. Test on mobile viewport (< 768px)
   - Should show 300x250 banner
2. Test on desktop viewport (>= 768px)
   - Should show 728x90 leaderboard
3. Resize browser and verify ads adapt

---

### Test 7: Ads Disabled - No Display

1. Set user preference `ads_disabled: true`
2. Navigate to pages with ad zones
3. Verify:
   - No ads displayed
   - No ad labels visible
   - No empty space where ads would be
   - Page layout unaffected

---

### Test 8: Multiple Pages

Test ad displays on:
- [ ] Homepage
- [ ] Browse page
- [ ] Gallery view
- [ ] Search results
- [ ] Artist profile
- [ ] Collection page

---

### Test 9: Spacing and Alignment

1. Verify ad zones have:
   - Top padding/margin
   - Centered alignment
   - Bottom separator line
   - Proper max-width matching content
   - Responsive padding on mobile

---

### Test 10: Ad Label Consistency

Verify "ADVERTISEMENT" label on all pages:
- [ ] Visible and readable
- [ ] Gray color (500)
- [ ] Small font (xs)
- [ ] Centered above ad
- [ ] Consistent across pages

---

### Test 11: No Ads Between Content

Verify ads NEVER appear:
- [ ] Between artwork items in grid
- [ ] In the middle of collections
- [ ] Mixed within search results
- [ ] Between gallery items
- [ ] Within content sections

---

### Test 12: Production vs Development

1. Set `NODE_ENV=development`
   - Ad shows placeholder with dimensions
2. Build for production
   - Ready for ad network integration
   - Data attributes present for targeting

---

## Success Criteria

- [ ] TypeScript compiles without errors
- [ ] FooterAdZone component created and tested
- [ ] ResponsiveAdZone component works on mobile/desktop
- [ ] "ADVERTISEMENT" labels clearly visible on all pages
- [ ] Ads display in footer area only
- [ ] Ads never between content items
- [ ] Ads respect user preferences (ads_disabled)
- [ ] Ads don't render when disabled
- [ ] Proper spacing and alignment maintained
- [ ] Multiple page types have ads (homepage, browse, gallery, search)
- [ ] Responsive sizing works (300x250 mobile, 728x90 desktop)
- [ ] Ad containers properly styled and centered
- [ ] Visual separators present above/below ads
- [ ] Data attributes ready for ad network

---

## Next Steps

Once this build is verified, proceed to **162-A11Y-KEYBOARD-NAV.md** for keyboard navigation accessibility.
