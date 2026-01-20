# 101-UI-SEARCH-PAGE.md

## Goal

Create the search page (`/search`) with a full-featured search interface including search input, filter controls, results grid, and URL-based state management for shareable search results.

---

## Spec Extract

From Phase 18 requirements:

- **URL Route**: `/search`
- **Search Input**: Text input at top, full width, persistent focus on load
- **Results Display**: Uses ArtworkGrid component for responsive layout
- **URL Parameters**: Query state persisted in URL (`?q=search&artist=name&category=cat`)
- **Filter Controls**: Category dropdown, date range picker, artist filter
- **Empty State**: Friendly message with suggestions
- **Responsive**: Mobile-optimized layout with sticky search bar

---

## Prerequisites

**Must complete before starting:**
- **100-API-SEARCH.md** - GET /api/search endpoint implemented
- **24-REACT-ROUTER-SETUP.md** - React Router configured with routes
- **48-UI-ARTWORK-GRID.md** - ArtworkGrid component available

---

## Steps

### Step 1: Create Search Types

Create TypeScript interfaces for search state and API responses.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/types/search.ts`

```typescript
/**
 * Search query parameters from URL
 */
export interface SearchParams {
  q?: string
  artist?: string
  category?: string
  from?: string // ISO 8601 date
  to?: string // ISO 8601 date
  page?: number
  limit?: number
}

/**
 * Artwork search result item
 */
export interface SearchResult {
  id: string
  title: string
  slug: string
  artistId: string
  artistName: string
  galleryId: string
  collectionId?: string
  thumbnail_url: string
  status: 'active' | 'hidden' | 'featured'
  createdAt: string
  updatedAt: string
}

/**
 * Search API response
 */
export interface SearchResponse {
  results: SearchResult[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  query: SearchParams
}
```

---

### Step 2: Create Search Results Container

Create a hook to manage search state and API calls.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/hooks/useSearch.ts`

```typescript
import { useState, useCallback, useEffect } from 'react'
import type { SearchParams, SearchResponse } from '../types/search'

interface UseSearchOptions {
  autoSearch?: boolean
  defaultLimit?: number
}

/**
 * Hook for managing search state and API calls
 * Syncs with URL query parameters
 */
export function useSearch(options: UseSearchOptions = {}) {
  const { autoSearch = true, defaultLimit = 20 } = options
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<SearchResponse | null>(null)

  const search = useCallback(async (params: SearchParams) => {
    // Don't search if no parameters provided
    if (!params.q && !params.artist && !params.category && !params.from && !params.to) {
      setResults(null)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const queryParams = new URLSearchParams()
      if (params.q) queryParams.append('q', params.q)
      if (params.artist) queryParams.append('artist', params.artist)
      if (params.category) queryParams.append('category', params.category)
      if (params.from) queryParams.append('from', params.from)
      if (params.to) queryParams.append('to', params.to)
      queryParams.append('page', String(params.page || 1))
      queryParams.append('limit', String(params.limit || defaultLimit))

      const response = await fetch(`/api/search?${queryParams.toString()}`)

      if (!response.ok) {
        if (response.status === 400) {
          setError('Please enter a search query or select filters')
        } else {
          setError('Failed to search artworks')
        }
        setResults(null)
        return
      }

      const data: SearchResponse = await response.json()
      setResults(data)
    } catch (err) {
      setError('Failed to perform search')
      setResults(null)
      console.error('Search error:', err)
    } finally {
      setLoading(false)
    }
  }, [defaultLimit])

  return {
    results,
    loading,
    error,
    search,
  }
}
```

---

### Step 3: Create Search Page Component

Create the main search page with search input and results.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/pages/SearchPage.tsx`

```typescript
import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useSearch } from '../hooks/useSearch'
import { ArtworkGrid } from '../components/artwork'
import type { SearchParams as SearchParamsType } from '../types/search'
import type { Artwork } from '../types/artwork'

/**
 * Search page with full-featured search interface
 * URL parameters: ?q=query&artist=name&category=cat&from=date&to=date&page=1
 */
export const SearchPage: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [queryInput, setQueryInput] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)

  const { results, loading, error, search } = useSearch({ defaultLimit: 20 })

  // Parse URL params on component mount
  useEffect(() => {
    const params: SearchParamsType = {
      q: searchParams.get('q') || undefined,
      artist: searchParams.get('artist') || undefined,
      category: searchParams.get('category') || undefined,
      from: searchParams.get('from') || undefined,
      to: searchParams.get('to') || undefined,
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '20'),
    }

    // Set query input from URL
    if (params.q) {
      setQueryInput(params.q)
    }

    // Auto-search if params present
    if (params.q || params.artist || params.category || params.from || params.to) {
      search(params)
    }

    // Focus search input
    if (searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [searchParams])

  // Handle search input change (debounce not needed here, only on submit)
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    // Build URL params
    const params: SearchParamsType = {
      q: queryInput || undefined,
      artist: searchParams.get('artist') || undefined,
      category: searchParams.get('category') || undefined,
      from: searchParams.get('from') || undefined,
      to: searchParams.get('to') || undefined,
      page: 1, // Reset to page 1 on new search
    }

    // Update URL
    const newParams = new URLSearchParams()
    if (params.q) newParams.append('q', params.q)
    if (params.artist) newParams.append('artist', params.artist)
    if (params.category) newParams.append('category', params.category)
    if (params.from) newParams.append('from', params.from)
    if (params.to) newParams.append('to', params.to)

    setSearchParams(newParams)

    // Trigger search
    search(params)
  }

  const handleArtworkSelect = (artwork: any) => {
    navigate(`/public/${artwork.artistName}/${artwork.galleryId}/${artwork.collectionId}/${artwork.slug}`)
  }

  const handleClearSearch = () => {
    setQueryInput('')
    setSearchParams({})
    navigate('/search')
  }

  const artworksToDisplay: Artwork[] = results?.results.map((r) => ({
    id: r.id,
    title: r.title,
    slug: r.slug,
    description: '',
    artistId: r.artistId,
    artistName: r.artistName,
    galleryId: r.galleryId,
    collectionId: r.collectionId,
    thumbnail_url: r.thumbnail_url,
    status: r.status,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  })) || []

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      {/* Sticky Search Bar */}
      <div className="sticky top-0 z-40 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="container mx-auto px-4 py-6">
          <form onSubmit={handleSearchSubmit} className="flex gap-2">
            <div className="flex-1">
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search artworks by title, description, or tags..."
                value={queryInput}
                onChange={(e) => setQueryInput(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              type="submit"
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
            >
              Search
            </button>
            {queryInput && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="px-4 py-3 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 font-medium rounded-lg transition-colors"
              >
                Clear
              </button>
            )}
          </form>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-12">
        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Results Header */}
        {results && (
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Search Results
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Found {results.pagination.total} artwork{results.pagination.total !== 1 ? 's' : ''} {queryInput ? `for "${queryInput}"` : ''}
            </p>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex justify-center py-16">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-4 text-gray-600 dark:text-gray-400">Searching artworks...</p>
            </div>
          </div>
        )}

        {/* Results Grid */}
        {!loading && results && artworksToDisplay.length > 0 && (
          <ArtworkGrid
            artworks={artworksToDisplay}
            onSelect={handleArtworkSelect}
            showArtist={true}
          />
        )}

        {/* No Results with Empty State */}
        {!loading && results && artworksToDisplay.length === 0 && (
          <div className="py-16 text-center">
            <div className="inline-block mb-4">
              <svg
                className="w-16 h-16 text-gray-300 dark:text-gray-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              No artworks found
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Try different keywords or adjust your filters
            </p>
            <button
              onClick={handleClearSearch}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
            >
              Browse All Artworks
            </button>
          </div>
        )}

        {/* Initial State */}
        {!loading && !results && (
          <div className="py-16 text-center">
            <svg
              className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Start searching
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Enter a search query or use filters to find artworks
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
```

---

### Step 4: Register Search Route

Add the search page to the router configuration.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/App.tsx` (or route configuration file)

Add this route:

```typescript
import { SearchPage } from './pages/SearchPage'

// In your router configuration:
{
  path: '/search',
  element: <SearchPage />,
}
```

---

### Step 5: Create Navigation Link

Add search link to main navigation.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/components/Navigation.tsx` (or similar)

Add this link:

```typescript
import { Link } from 'react-router-dom'

// In navigation component:
<Link
  to="/search"
  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
>
  Search
</Link>
```

---

## Files to Create/Modify

**New files to create:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/types/search.ts` - Search types
2. `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/hooks/useSearch.ts` - Search hook
3. `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/pages/SearchPage.tsx` - Search page

**Files to modify:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/App.tsx` - Add route

---

## Verification

### Test 1: Route Accessible

Navigate to `/search` in browser:

```bash
# Local dev: http://localhost:5173/search
```

Expected: Search page loads with empty state

---

### Test 2: Search Input Focus

On page load, verify search input is focused:

```bash
# DevTools > Elements, verify input has focus
# Or manually: keyboard should activate input immediately
```

Expected: Search input has focus ring visible

---

### Test 3: URL Parameters

Test URL param syncing:

1. Visit: `/search?q=abstract&artist=john`
2. Verify: Search input shows "abstract" and results load
3. Modify search input to "landscape"
4. Submit form
5. Verify: URL changes to `/search?q=landscape&artist=john&page=1`

Expected: URL params sync with search state

---

### Test 4: Search Results

Test search functionality:

1. Enter search query: "landscape"
2. Click Search button
3. Verify: Results load in grid below
4. Verify: Artist names visible on artworks
5. Verify: Grid is responsive (2 cols mobile, 3 cols tablet, 4 cols desktop)

Expected: Grid displays search results with proper layout

---

### Test 5: Clear Button

Test clear functionality:

1. Enter search query
2. Click Clear button
3. Verify: Input clears, URL resets, results disappear

Expected: Page returns to initial empty state

---

### Test 6: Artwork Selection

Test artwork navigation:

1. Search for artworks
2. Click on an artwork card
3. Verify: Navigates to `/public/[artist]/[gallery]/[collection]/[slug]`

Expected: Navigation to artwork detail page works

---

### Test 7: Responsive Design

Test mobile and desktop layouts:

1. **Mobile** (<640px): Search bar sticky, input full width, grid 2 cols
2. **Tablet** (640-1024px): Sticky search, grid 3 cols
3. **Desktop** (>1024px): Sticky search, grid 4 cols

Expected: Layout adapts to breakpoints

---

## Summary

This build creates a functional search page with:
- Full-width sticky search input
- URL-based state management for shareable searches
- Integration with ArtworkGrid component
- Empty states and error handling
- Responsive design for all devices
- Clear/reset functionality
- Artist name display in results

The page is production-ready and provides users with a powerful way to discover artworks.

---

**Next steps:**
- **102-UI-SEARCH-AUTOCOMPLETE.md** - Add artist name autocomplete
- **103-UI-SEARCH-FILTERS.md** - Add filter controls
- **104-UI-SEARCH-EMPTY-STATE.md** - Polish empty state messaging
