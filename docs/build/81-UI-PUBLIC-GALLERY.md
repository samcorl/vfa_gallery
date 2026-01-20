# 81-UI-PUBLIC-GALLERY.md

## Goal
Create the public gallery page at `/:artist/:gallery` that displays a specific gallery with its welcome message, artist credit, theme styling, and collections grid. Shows a compelling gallery showcase for visitors.

---

## Spec Extract

From TECHNICAL-SPEC.md:
- **Route:** `/:artist/:gallery` (artist username, gallery slug)
- **Public Access:** No authentication required
- **Hero section:** Gallery name, welcome message, artist credit with avatar
- **Styling:** Apply gallery theme if set
- **Content:** Collections grid below
- **Error handling:** Show 404 gracefully if gallery not found
- **Responsive:** Mobile-first design
- **Theme application:** CSS variables or class application based on theme

---

## Prerequisites

**Must complete before starting:**
- **80-API-PUBLIC-GALLERY.md** - Public gallery endpoint
- **24-REACT-ROUTER-SETUP.md** - React Router configured for nested routes
- **11-SCHEMA-THEMES.md** - Theme schema (for theme ID reference)

**Reason:** Need gallery API endpoint and routing infrastructure.

---

## Steps

### Step 1: Create Theme Styling Utility

Create a utility to apply theme styles based on theme ID.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/themes.ts`

```typescript
/**
 * Theme configuration with CSS variables and classes
 */
export interface ThemeConfig {
  name: string
  primaryColor: string
  secondaryColor: string
  accentColor: string
  backgroundColor: string
  textColor: string
  borderColor: string
  className: string
  cssVariables: Record<string, string>
}

/**
 * Built-in themes available for galleries
 */
const THEMES: Record<string, ThemeConfig> = {
  light: {
    name: 'Light',
    primaryColor: '#ffffff',
    secondaryColor: '#f3f4f6',
    accentColor: '#3b82f6',
    backgroundColor: '#ffffff',
    textColor: '#111827',
    borderColor: '#e5e7eb',
    className: 'theme-light',
    cssVariables: {
      '--theme-primary': '#ffffff',
      '--theme-secondary': '#f3f4f6',
      '--theme-accent': '#3b82f6',
      '--theme-bg': '#ffffff',
      '--theme-text': '#111827',
      '--theme-border': '#e5e7eb',
    },
  },
  dark: {
    name: 'Dark',
    primaryColor: '#1f2937',
    secondaryColor: '#111827',
    accentColor: '#60a5fa',
    backgroundColor: '#111827',
    textColor: '#f3f4f6',
    borderColor: '#374151',
    className: 'theme-dark',
    cssVariables: {
      '--theme-primary': '#1f2937',
      '--theme-secondary': '#111827',
      '--theme-accent': '#60a5fa',
      '--theme-bg': '#111827',
      '--theme-text': '#f3f4f6',
      '--theme-border': '#374151',
    },
  },
  minimal: {
    name: 'Minimal',
    primaryColor: '#ffffff',
    secondaryColor: '#fafafa',
    accentColor: '#000000',
    backgroundColor: '#ffffff',
    textColor: '#000000',
    borderColor: '#d4d4d8',
    className: 'theme-minimal',
    cssVariables: {
      '--theme-primary': '#ffffff',
      '--theme-secondary': '#fafafa',
      '--theme-accent': '#000000',
      '--theme-bg': '#ffffff',
      '--theme-text': '#000000',
      '--theme-border': '#d4d4d8',
    },
  },
  vibrant: {
    name: 'Vibrant',
    primaryColor: '#fef08a',
    secondaryColor: '#fef3c7',
    accentColor: '#ec4899',
    backgroundColor: '#fef08a',
    textColor: '#7c2d12',
    borderColor: '#fcd34d',
    className: 'theme-vibrant',
    cssVariables: {
      '--theme-primary': '#fef08a',
      '--theme-secondary': '#fef3c7',
      '--theme-accent': '#ec4899',
      '--theme-bg': '#fef08a',
      '--theme-text': '#7c2d12',
      '--theme-border': '#fcd34d',
    },
  },
}

/**
 * Get theme configuration by ID or name
 * Returns light theme as default if not found
 */
export function getThemeConfig(themeId: string | null): ThemeConfig {
  if (!themeId) {
    return THEMES.light
  }

  return THEMES[themeId.toLowerCase()] || THEMES.light
}

/**
 * Get list of all available themes
 */
export function getAvailableThemes(): ThemeConfig[] {
  return Object.values(THEMES)
}

/**
 * Apply theme CSS variables to element
 */
export function applyThemeStyles(
  element: HTMLElement,
  themeId: string | null
): void {
  const theme = getThemeConfig(themeId)

  // Apply CSS variables
  Object.entries(theme.cssVariables).forEach(([key, value]) => {
    element.style.setProperty(key, value)
  })

  // Apply theme class
  element.className = element.className.replace(/theme-\w+/, '')
  element.classList.add(theme.className)
}
```

**Explanation:**
- Defines multiple theme configurations
- Each theme has colors and CSS variables
- `getThemeConfig` returns theme or light as default
- `applyThemeStyles` applies theme to DOM element
- Themes can be extended with more options

---

### Step 2: Create Gallery Hero Section Component

Create a component for the gallery hero section.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/public/GalleryHero.tsx`

```typescript
import React from 'react'
import { Link } from 'react-router-dom'
import PublicAvatar from './PublicAvatar'

interface GalleryHeroProps {
  name: string
  welcome: string | null
  artistUsername: string
  artistDisplayName: string | null
  artistAvatar: string | null
  collectionCount: number
}

export default function GalleryHero({
  name,
  welcome,
  artistUsername,
  artistDisplayName,
  artistAvatar,
  collectionCount,
}: GalleryHeroProps) {
  return (
    <div className="bg-white border-b">
      <div className="max-w-4xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        {/* Gallery Title */}
        <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6">
          {name}
        </h1>

        {/* Welcome Message */}
        {welcome && (
          <p className="text-lg text-gray-700 mb-8 leading-relaxed max-w-2xl">
            {welcome}
          </p>
        )}

        {/* Artist Credit */}
        <div className="flex items-center gap-4 mb-8 pb-8 border-b">
          <PublicAvatar
            avatarUrl={artistAvatar}
            displayName={artistDisplayName}
            username={artistUsername}
            size="sm"
          />
          <div>
            <p className="text-sm text-gray-600 mb-1">Gallery by</p>
            <Link
              to={`/${artistUsername}`}
              className="text-lg font-semibold text-blue-600 hover:text-blue-700 transition-colors"
            >
              {artistDisplayName || artistUsername}
            </Link>
          </div>
        </div>

        {/* Collection Count */}
        <div>
          <p className="text-sm text-gray-600 mb-2">Collections in this gallery</p>
          <p className="text-2xl font-bold text-gray-900">
            {collectionCount} {collectionCount === 1 ? 'collection' : 'collections'}
          </p>
        </div>
      </div>
    </div>
  )
}
```

**Explanation:**
- Displays gallery name prominently
- Shows welcome/description message
- Links to artist profile
- Shows artist avatar with credit
- Displays collection count
- Clean, spacious layout

---

### Step 3: Create Public Gallery Page

Create the main gallery page component.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/pages/PublicGallery.tsx`

```typescript
import React, { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import GalleryHero from '../components/public/GalleryHero'
import ErrorBoundary from '../components/error/ErrorBoundary'
import { getThemeConfig, applyThemeStyles } from '../lib/themes'

interface GalleryData {
  id: string
  slug: string
  name: string
  welcome: string | null
  theme: string | null
  collectionCount: number
  artist: {
    username: string
    displayName: string | null
    avatarUrl: string | null
  }
}

export default function PublicGallery() {
  const { artist, gallery } = useParams<{
    artist: string
    gallery: string
  }>()
  const [galleryData, setGalleryData] = useState<GalleryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!artist || !gallery) {
      setError('Artist or gallery information is missing')
      setLoading(false)
      return
    }

    const fetchGallery = async () => {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch(
          `/api/g/${encodeURIComponent(artist)}/${encodeURIComponent(gallery)}`
        )

        if (!response.ok) {
          if (response.status === 404) {
            setError(`Gallery not found`)
          } else {
            setError('Failed to load gallery')
          }
          setGalleryData(null)
          return
        }

        const data = await response.json()
        setGalleryData(data.data)

        // Apply theme to document
        if (data.data.theme) {
          const themeConfig = getThemeConfig(data.data.theme)
          applyThemeStyles(document.documentElement, data.data.theme)
        }
      } catch (err) {
        console.error('Error fetching gallery:', err)
        setError('Failed to load gallery')
        setGalleryData(null)
      } finally {
        setLoading(false)
      }
    }

    fetchGallery()
  }, [artist, gallery])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          <p className="mt-4 text-gray-600">Loading gallery...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">404</h1>
          <p className="text-lg text-gray-600 mb-8">{error}</p>
          <div className="flex gap-4 justify-center">
            <Link
              to="/"
              className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              Home
            </Link>
            {artist && (
              <Link
                to={`/${artist}`}
                className="px-6 py-3 border border-blue-500 text-blue-500 rounded-lg hover:bg-blue-50 transition-colors"
              >
                Back to Artist
              </Link>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (!galleryData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">Gallery not found</p>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <div
        className="min-h-screen"
        style={{
          backgroundColor: 'var(--theme-bg)',
          color: 'var(--theme-text)',
        }}
      >
        {/* Hero Section */}
        <GalleryHero
          name={galleryData.name}
          welcome={galleryData.welcome}
          artistUsername={galleryData.artist.username}
          artistDisplayName={galleryData.artist.displayName}
          artistAvatar={galleryData.artist.avatarUrl}
          collectionCount={galleryData.collectionCount}
        />

        {/* Collections Section */}
        <div className="max-w-6xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold mb-8">Collections</h2>
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <p className="text-gray-600 mb-4">
              Collections will be displayed here
            </p>
            <Link
              to={`/${artist}`}
              className="text-blue-500 hover:underline"
            >
              Back to gallery
            </Link>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  )
}
```

**Explanation:**
- Fetches gallery data from `/api/g/:artist/:gallery` endpoint
- Shows loading spinner while fetching
- Shows 404 error message if gallery not found
- Applies theme styles to document
- Displays gallery hero section with artist credit
- Responsive layout
- Error boundary wrapper
- Placeholder for collections (implemented in next build)

---

### Step 4: Register Route in React Router

Add the public gallery route to React Router configuration.

**File:** React Router configuration (wherever routes are defined)

Add this import:

```typescript
import PublicGallery from './pages/PublicGallery'
```

Add this route definition:

```typescript
{
  path: '/:artist/:gallery',
  element: <PublicGallery />,
  errorElement: <ErrorPage />,
},
```

This route must come AFTER the `/:artist` route in the route array so the more specific route is matched first:

```typescript
const routes = [
  // Public routes
  {
    path: '/',
    element: <Home />,
  },
  // More specific route first
  {
    path: '/:artist/:gallery',
    element: <PublicGallery />,
    errorElement: <ErrorPage />,
  },
  // Less specific route after
  {
    path: '/:artist',
    element: <PublicArtist />,
    errorElement: <ErrorPage />,
  },
  // Catch-all
  {
    path: '*',
    element: <NotFound />,
  },
]
```

**Explanation:**
- Matches routes like `/username/gallery-slug`
- Route order is important - more specific routes first
- Extracted artist and gallery from URL parameters

---

### Step 5: Add Gallery Link to Gallery Card

Update the gallery card component to link to the gallery page.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/public/GalleryCard.tsx`

The component already links to `/:artist/:gallery` in the existing code, so no changes needed. The Link is already set to:

```typescript
const galleryUrl = `/${artist}/${slug}`
```

This correctly routes to the new public gallery page.

---

## Files to Create/Modify

**New files to create:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/themes.ts`
2. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/public/GalleryHero.tsx`
3. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/pages/PublicGallery.tsx`

**Files to modify:**
1. React Router configuration file - Add `/:artist/:gallery` route
2. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/public/GalleryCard.tsx` - Already links correctly

---

## Verification

### Test 1: Navigate to Gallery Page

Visit:
```
http://localhost:5173/testuser/landscape-photography
```

Expected:
- Page loads with gallery information
- Gallery name displays prominently
- Welcome message shows (if present)
- Artist credit section visible with avatar
- Collection count displayed
- Link back to artist profile works

---

### Test 2: Verify 404 for Non-Existent Gallery

Visit:
```
http://localhost:5173/testuser/nonexistent-gallery
```

Expected:
- Shows 404 error message
- Shows "Home" and "Back to Artist" buttons
- No gallery data displayed

---

### Test 3: Verify Artist Link Works

Click the artist name in the credit section:
- Should navigate to `/:artist` page
- Artist profile page loads

---

### Test 4: Verify Theme Styling

If gallery has theme set:
- Page background and text colors change
- CSS variables applied to document
- Page uses theme colors from database

Test with different themes:
- Light theme (white background, dark text)
- Dark theme (dark background, light text)
- Other themes if configured

---

### Test 5: Verify Loading State

With network throttled to slow 3G:
- Loading spinner shows
- Page is responsive while loading
- Data loads and displays correctly

---

### Test 6: Verify API Data Matches Display

Fetch from API manually:
```bash
curl http://localhost:8788/api/g/testuser/landscape-photography
```

Verify displayed data matches API response:
- Gallery name matches
- Welcome text matches
- Artist info matches
- Collection count matches

---

### Test 7: Verify Responsive Design

Mobile viewport (< 640px):
- Title and text are readable
- Avatar displays properly
- No horizontal scrolling

Desktop viewport (> 1024px):
- Content is centered
- Layout is balanced
- White space is appropriate

---

### Test 8: Verify Error Boundary

Trigger an error (if error boundary test component available):
- Error is caught and handled gracefully
- Page doesn't crash
- User can navigate away

---

### Test 9: Verify Multiple Gallery Navigation

Navigate between multiple galleries:
- Gallery 1: `/testuser/gallery1`
- Gallery 2: `/testuser/gallery2`
- Gallery 3: `/differentuser/gallery3`

Verify:
- Data updates correctly for each gallery
- Artist information changes appropriately
- No data persistence between galleries

---

### Test 10: Verify Collection Count Accuracy

Gallery has 5 active collections:
```bash
curl http://localhost:8788/api/g/testuser/landscape-photography | jq '.data.collectionCount'
```

Verify displayed count matches API response.

---

## Summary

This build creates the public gallery page:
- Beautiful hero section with gallery info
- Artist credit with profile link
- Theme styling system with CSS variables
- Collection count display
- 404 error handling
- Full responsive design
- Loading and error states
- Foundation for displaying individual galleries

---

**Next step:** Proceed to **82-UI-PUBLIC-GALLERY-COLLECTIONS.md** to create the collections grid for the gallery page.
