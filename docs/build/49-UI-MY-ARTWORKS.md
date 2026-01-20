# 49-UI-MY-ARTWORKS.md

## Goal

Create a user's personal artwork management page at `/profile/artworks` that displays all their artworks with filtering, search, and navigation to edit individual artworks.

---

## Spec Extract

From TECHNICAL-SPEC.md and UI Requirements:

- **URL:** `/profile/artworks` (authentication required)

- **Features:**
  - Paginated grid of all user's artworks
  - Filter by status: In Collection / Orphaned / All
  - Search within own artworks (by title or description)
  - Bulk select capability (future feature, groundwork only)
  - Click artwork to edit details
  - Show pagination controls if artworks exceed page size

- **API Integration:**
  - Fetch from `GET /api/artworks?userId=<id>&status=<filter>&search=<query>&page=<page>`
  - Pagination: 20 artworks per page by default

- **Responsive:**
  - Mobile-first design
  - Touch-friendly controls
  - Filter buttons stack on mobile, inline on tablet/desktop

---

## Prerequisites

**Must complete before starting:**
- **48-UI-ARTWORK-GRID.md** - ArtworkGrid component and types
- **42-AUTH-PROFILE-SETUP.md** or equivalent - User authentication and profile context
- **26-REACT-PROTECTED-ROUTES.md** - Protected route wrapper

---

## Steps

### Step 1: Create Types for MyArtworks Page

Extend the artwork types with page-specific types.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/types/artwork.ts`

Update the existing file to add these types at the end:

```typescript
/**
 * Filter options for My Artworks page
 */
export type ArtworkFilterStatus = 'all' | 'in-collection' | 'orphaned'

/**
 * Pagination metadata
 */
export interface PaginationMeta {
  page: number
  pageSize: number
  total: number
  totalPages: number
  hasNextPage: boolean
  hasPrevPage: boolean
}

/**
 * API response for paginated artworks
 */
export interface PaginatedArtworksResponse {
  artworks: Artwork[]
  pagination: PaginationMeta
}
```

---

### Step 2: Create useArtworksQuery Hook

Create a custom hook for fetching and managing artworks with filtering/pagination.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/hooks/useArtworksQuery.ts`

```typescript
import { useState, useCallback, useEffect } from 'react'
import type { Artwork, ArtworkFilterStatus, PaginatedArtworksResponse } from '../types/artwork'

interface UseArtworksQueryOptions {
  userId?: string
  initialPage?: number
  pageSize?: number
  autoFetch?: boolean
}

interface UseArtworksQueryState {
  artworks: Artwork[]
  loading: boolean
  error: Error | null
  page: number
  pageSize: number
  total: number
  totalPages: number
  hasNextPage: boolean
  hasPrevPage: boolean
}

/**
 * Custom hook for fetching artworks with filtering and pagination
 * Manages loading states, errors, and pagination
 */
export const useArtworksQuery = (options: UseArtworksQueryOptions = {}) => {
  const {
    userId,
    initialPage = 1,
    pageSize = 20,
    autoFetch = true,
  } = options

  const [state, setState] = useState<UseArtworksQueryState>({
    artworks: [],
    loading: autoFetch,
    error: null,
    page: initialPage,
    pageSize,
    total: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPrevPage: false,
  })

  const [filter, setFilter] = useState<ArtworkFilterStatus>('all')
  const [search, setSearch] = useState('')

  /**
   * Fetch artworks from API
   */
  const fetchArtworks = useCallback(
    async (pageNum = 1) => {
      if (!userId) {
        setState((prev) => ({ ...prev, error: new Error('User ID required') }))
        return
      }

      setState((prev) => ({ ...prev, loading: true, error: null }))

      try {
        const params = new URLSearchParams({
          userId,
          page: String(pageNum),
          pageSize: String(pageSize),
          ...(filter !== 'all' && { status: filter === 'in-collection' ? 'in_collection' : 'orphaned' }),
          ...(search && { search }),
        })

        const response = await fetch(`/api/artworks?${params.toString()}`)

        if (!response.ok) {
          throw new Error(`Failed to fetch artworks: ${response.statusText}`)
        }

        const data: PaginatedArtworksResponse = await response.json()

        setState((prev) => ({
          ...prev,
          artworks: data.artworks,
          page: data.pagination.page,
          total: data.pagination.total,
          totalPages: data.pagination.totalPages,
          hasNextPage: data.pagination.hasNextPage,
          hasPrevPage: data.pagination.hasPrevPage,
          loading: false,
        }))
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error')
        setState((prev) => ({
          ...prev,
          error,
          loading: false,
        }))
      }
    },
    [userId, filter, search, pageSize]
  )

  // Auto-fetch on mount or when dependencies change
  useEffect(() => {
    if (autoFetch && userId) {
      fetchArtworks(1)
    }
  }, [userId, filter, search, autoFetch, fetchArtworks])

  /**
   * Go to specific page
   */
  const goToPage = useCallback((pageNum: number) => {
    if (pageNum > 0 && pageNum <= state.totalPages) {
      fetchArtworks(pageNum)
    }
  }, [state.totalPages, fetchArtworks])

  /**
   * Go to next page
   */
  const nextPage = useCallback(() => {
    if (state.hasNextPage) {
      goToPage(state.page + 1)
    }
  }, [state.page, state.hasNextPage, goToPage])

  /**
   * Go to previous page
   */
  const prevPage = useCallback(() => {
    if (state.hasPrevPage) {
      goToPage(state.page - 1)
    }
  }, [state.page, state.hasPrevPage, goToPage])

  /**
   * Update filter and reset to page 1
   */
  const updateFilter = useCallback((newFilter: ArtworkFilterStatus) => {
    setFilter(newFilter)
  }, [])

  /**
   * Update search and reset to page 1
   */
  const updateSearch = useCallback((query: string) => {
    setSearch(query)
  }, [])

  /**
   * Refetch current page
   */
  const refetch = useCallback(() => {
    fetchArtworks(state.page)
  }, [state.page, fetchArtworks])

  return {
    ...state,
    filter,
    search,
    updateFilter,
    updateSearch,
    goToPage,
    nextPage,
    prevPage,
    refetch,
    setSearch,
    setFilter,
  }
}
```

---

### Step 3: Create MyArtworks Page

Create the main page component for managing personal artworks.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/pages/MyArtworks.tsx`

```typescript
import React, { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArtworkGrid } from '../components/artwork'
import { useAuth } from '../hooks/useAuth'
import { useArtworksQuery } from '../hooks/useArtworksQuery'
import type { Artwork, ArtworkFilterStatus } from '../types/artwork'

/**
 * My Artworks Page
 * Displays user's personal artworks with filtering, search, and management
 * Route: /profile/artworks (protected)
 */
export const MyArtworks: React.FC = () => {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [selectedArtworks, setSelectedArtworks] = useState<Set<string>>(new Set())

  // Fetch user's artworks with filtering and pagination
  const {
    artworks,
    loading,
    error,
    page,
    totalPages,
    hasNextPage,
    hasPrevPage,
    filter,
    search,
    updateFilter,
    updateSearch,
    nextPage,
    prevPage,
    goToPage,
    total,
  } = useArtworksQuery({
    userId: user?.userId,
    pageSize: 20,
    autoFetch: true,
  })

  /**
   * Handle artwork selection for bulk actions
   */
  const handleSelectArtwork = (artwork: Artwork) => {
    navigate(`/profile/artworks/${artwork.id}/edit`)
  }

  /**
   * Handle filter change
   */
  const handleFilterChange = (newFilter: ArtworkFilterStatus) => {
    updateFilter(newFilter)
  }

  /**
   * Handle search
   */
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateSearch(e.target.value)
  }

  /**
   * Clear search and filter
   */
  const handleClearFilters = () => {
    updateSearch('')
    updateFilter('all')
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            My Artworks
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Total: {total} artwork{total !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-700 rounded text-red-800 dark:text-red-100">
            <p className="font-semibold">Error loading artworks</p>
            <p className="text-sm">{error.message}</p>
          </div>
        )}

        {/* Search and Filter Bar */}
        <div className="mb-8 space-y-4 sm:space-y-0 sm:flex sm:gap-4 sm:items-center sm:justify-between">
          {/* Search Input */}
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search artworks by title or description..."
              value={search}
              onChange={handleSearchChange}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Filter Buttons */}
          <div className="flex flex-wrap gap-2">
            {(['all', 'in-collection', 'orphaned'] as const).map((filterOption) => (
              <button
                key={filterOption}
                onClick={() => handleFilterChange(filterOption)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  filter === filterOption
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                {filterOption === 'all'
                  ? 'All'
                  : filterOption === 'in-collection'
                    ? 'In Collection'
                    : 'Orphaned'}
              </button>
            ))}
          </div>

          {/* Clear Filters Button */}
          {(filter !== 'all' || search) && (
            <button
              onClick={handleClearFilters}
              className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white underline text-sm"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* Artwork Grid */}
        <div className="mb-8">
          <ArtworkGrid
            artworks={artworks}
            onSelect={handleSelectArtwork}
            loading={loading}
            emptyMessage={
              search || filter !== 'all'
                ? 'No artworks match your filters'
                : 'You haven\'t uploaded any artworks yet'
            }
          />
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* Page Info */}
            <p className="text-gray-600 dark:text-gray-400">
              Page {page} of {totalPages}
            </p>

            {/* Pagination Buttons */}
            <div className="flex gap-2">
              <button
                onClick={prevPage}
                disabled={!hasPrevPage}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  hasPrevPage
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-600 cursor-not-allowed'
                }`}
              >
                Previous
              </button>

              {/* Page Numbers */}
              <div className="flex gap-1">
                {Array.from({ length: Math.min(5, totalPages) }).map((_, index) => {
                  const pageNum = Math.max(1, page - 2) + index
                  if (pageNum > totalPages) return null

                  return (
                    <button
                      key={pageNum}
                      onClick={() => goToPage(pageNum)}
                      className={`px-3 py-2 rounded-lg font-medium transition-colors ${
                        page === pageNum
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-600'
                      }`}
                    >
                      {pageNum}
                    </button>
                  )
                })}
              </div>

              <button
                onClick={nextPage}
                disabled={!hasNextPage}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  hasNextPage
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-600 cursor-not-allowed'
                }`}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
```

---

### Step 4: Add Route to Router Configuration

Update the React Router configuration to include the new page.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/App.tsx` (or routing file)

Add this route inside your protected routes section:

```typescript
import { MyArtworks } from './pages/MyArtworks'
import { ProtectedRoute } from './components/ProtectedRoute'

// Inside your route configuration:
{
  path: 'profile/artworks',
  element: (
    <ProtectedRoute>
      <MyArtworks />
    </ProtectedRoute>
  ),
}
```

---

### Step 5: Create Index Hook Export

Add the new hook to your hooks index file.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/hooks/index.ts`

```typescript
export { useAuth } from './useAuth'
export { useArtworksQuery } from './useArtworksQuery'
// ... other exports
```

---

## Files to Create/Modify

**New files to create:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/hooks/useArtworksQuery.ts` - Artworks query hook
2. `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/pages/MyArtworks.tsx` - My Artworks page

**Modified files:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/types/artwork.ts` - Add pagination types
2. `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/App.tsx` - Add route configuration
3. `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/hooks/index.ts` - Export new hook (if exists)

---

## Verification

### Test 1: Page Compiles

Run TypeScript compiler:

```bash
cd /Volumes/DataSSD/gitsrc/vfa_gallery/site
npx tsc --noEmit
```

Expected: No type errors

---

### Test 2: Route is Protected

Verify the route requires authentication:

1. Start the dev server: `npm run dev`
2. Navigate to `/profile/artworks` without logging in
3. Should redirect to login or show login page

---

### Test 3: Page Loads When Authenticated

1. Log in with a test account
2. Navigate to `/profile/artworks`
3. Page should load and fetch user's artworks

Expected: ArtworkGrid displays with user's artworks

---

### Test 4: Filter Works

1. Click "In Collection" filter
2. Observe artworks list updates to show only collected artworks

Expected: Grid updates without page reload

---

### Test 5: Search Works

1. Type in search box
2. Grid should update to show only matching artworks

Expected: Real-time filtering as you type (or on enter key)

---

### Test 6: Pagination Works

1. If more than 20 artworks, pagination controls appear
2. Click "Next" button
3. Page number updates and new artworks load

Expected: Smooth pagination with page info updating

---

### Test 7: Click to Edit

1. Click on any artwork card
2. Navigate to `/profile/artworks/:id/edit`

Expected: Navigates to edit page (will be created in phase 50)

---

### Test 8: Responsive Design

Test at different breakpoints:

**Mobile (<640px):**
- Search box full width
- Filter buttons stack vertically
- Pagination buttons stack
- Grid shows 2 columns

**Tablet (640-1024px):**
- Search and filters on same line (flex)
- Pagination horizontal
- Grid shows 3 columns

**Desktop (>1024px):**
- Clean horizontal layout
- Grid shows 4 columns

---

### Test 9: Empty States

1. Test with new user account (no artworks)
2. Test with filters that return no results
3. Test with search that matches nothing

Expected: Appropriate empty messages display

---

### Test 10: Error Handling

To test error handling, temporarily break the API call:

1. In the hook, change API endpoint to something invalid
2. Load the page
3. Error message should display with helpful message

Expected: Error state displays gracefully without crashing

---

## Summary

This build creates a user's personal artwork management page with:
- Paginated artwork grid display
- Filter by status (all, in-collection, orphaned)
- Search functionality for finding specific artworks
- Click-to-edit navigation
- Responsive design for all screen sizes
- Loading and error states
- Foundation for bulk selection (future feature)

The page integrates with the ArtworkGrid component from build 48 and connects to user authentication from build 42.

---

**Next steps:**
- **50-UI-ARTWORK-EDIT.md** - Create artwork edit page
- **51-UI-ARTWORK-CARD.md** - Specialized card variants
