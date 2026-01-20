# 103-UI-SEARCH-FILTERS.md

## Goal

Add search filter controls for category dropdown, date range picker (from/to), and artist filter input. Filters update URL parameters and trigger search automatically.

---

## Spec Extract

From Phase 18 requirements:

- **Category Filter**: Dropdown with all categories
- **Date Range Picker**: "From" and "To" date inputs
- **Artist Filter Input**: Text input for artist filtering (or use autocomplete from 102)
- **Live Updates**: Filters update URL params and trigger new search
- **Clear Filters**: Button to reset all filters
- **Responsive**: Stack on mobile, horizontal on desktop

---

## Prerequisites

**Must complete before starting:**
- **101-UI-SEARCH-PAGE.md** - Search page with base functionality
- **102-UI-SEARCH-AUTOCOMPLETE.md** - Optional, for artist autocomplete
- **95-API-BROWSE-CATEGORIES.md** - Categories API endpoint exists

---

## Steps

### Step 1: Create Filters Types

Create TypeScript interfaces for filter state.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/types/filters.ts`

```typescript
/**
 * Search filter state
 */
export interface SearchFilters {
  category?: string
  fromDate?: string // ISO 8601
  toDate?: string // ISO 8601
  artist?: string
}

/**
 * Category option for filter dropdown
 */
export interface CategoryOption {
  id: string
  name: string
  slug: string
  description?: string
  artworkCount?: number
}
```

---

### Step 2: Create Category Service

Create a service to fetch available categories.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/services/categoryService.ts`

```typescript
import type { CategoryOption } from '../types/filters'

/**
 * Fetch all categories for filter dropdown
 */
export async function fetchCategories(): Promise<CategoryOption[]> {
  try {
    const response = await fetch('/api/browse/categories')

    if (!response.ok) {
      throw new Error('Failed to fetch categories')
    }

    const data = await response.json()
    return data.categories || []
  } catch (error) {
    console.error('Error fetching categories:', error)
    return []
  }
}
```

---

### Step 3: Create Filters Component

Create a collapsible/expandable filters component.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/components/SearchFilters.tsx`

```typescript
import React, { useState, useEffect } from 'react'
import type { SearchFilters, CategoryOption } from '../types/filters'
import { fetchCategories } from '../services/categoryService'

interface SearchFiltersProps {
  filters: SearchFilters
  onChange: (filters: SearchFilters) => void
  onClear: () => void
  loading?: boolean
}

/**
 * Search filter controls component
 * Displays category dropdown, date range pickers, and artist filter
 */
export const SearchFilters: React.FC<SearchFiltersProps> = ({
  filters,
  onChange,
  onClear,
  loading = false,
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [categories, setCategories] = useState<CategoryOption[]>([])
  const [loadingCategories, setLoadingCategories] = useState(false)

  // Fetch categories on mount
  useEffect(() => {
    const loadCategories = async () => {
      setLoadingCategories(true)
      try {
        const cats = await fetchCategories()
        setCategories(cats)
      } finally {
        setLoadingCategories(false)
      }
    }

    loadCategories()
  }, [])

  const hasActiveFilters =
    filters.category || filters.fromDate || filters.toDate || filters.artist

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({
      ...filters,
      category: e.target.value || undefined,
    })
  }

  const handleFromDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({
      ...filters,
      fromDate: e.target.value || undefined,
    })
  }

  const handleToDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({
      ...filters,
      toDate: e.target.value || undefined,
    })
  }

  const handleArtistChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({
      ...filters,
      artist: e.target.value || undefined,
    })
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
      {/* Filter Header (Collapsible on mobile) */}
      <div className="hidden md:flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Filters
        </h3>
        {hasActiveFilters && (
          <button
            onClick={onClear}
            className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium transition-colors"
          >
            Clear All
          </button>
        )}
      </div>

      {/* Mobile Toggle */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="md:hidden w-full flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg
            className="w-5 h-5 text-gray-600 dark:text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
            />
          </svg>
          <span className="font-medium text-gray-900 dark:text-white">
            Filters {hasActiveFilters && `(${Object.values(filters).filter(Boolean).length})`}
          </span>
        </div>
        <svg
          className={`w-5 h-5 text-gray-600 dark:text-gray-400 transition-transform ${
            isOpen ? 'transform rotate-180' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
      </button>

      {/* Filter Controls */}
      <div className={`md:block ${isOpen ? 'block' : 'hidden'} p-4 space-y-4`}>
        {/* Category Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Category
          </label>
          <select
            value={filters.category || ''}
            onChange={handleCategoryChange}
            disabled={loadingCategories || loading}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.slug}>
                {cat.name}
                {cat.artworkCount ? ` (${cat.artworkCount})` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Artist Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Artist
          </label>
          <input
            type="text"
            value={filters.artist || ''}
            onChange={handleArtistChange}
            disabled={loading}
            placeholder="Filter by artist name"
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          />
        </div>

        {/* Date Range */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              From
            </label>
            <input
              type="date"
              value={filters.fromDate || ''}
              onChange={handleFromDateChange}
              disabled={loading}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              To
            </label>
            <input
              type="date"
              value={filters.toDate || ''}
              onChange={handleToDateChange}
              disabled={loading}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            />
          </div>
        </div>

        {/* Mobile Clear Button */}
        {hasActiveFilters && (
          <button
            onClick={onClear}
            className="md:hidden w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium"
          >
            Clear Filters
          </button>
        )}
      </div>
    </div>
  )
}
```

---

### Step 4: Update Search Page with Filters

Integrate filters component into search page.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/pages/SearchPage.tsx` (modify existing)

Add filters state and update layout:

```typescript
import { SearchFilters as SearchFiltersComponent } from '../components/SearchFilters'
import type { SearchFilters } from '../types/filters'

// In SearchPage component:

const [filters, setFilters] = useState<SearchFilters>({})

// Update search when filters change (with debounce)
const filterChangeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

useEffect(() => {
  if (filterChangeTimer.current) {
    clearTimeout(filterChangeTimer.current)
  }

  filterChangeTimer.current = setTimeout(() => {
    // Build search params including filters
    const params: SearchParamsType = {
      q: queryInput || undefined,
      artist: filters.artist || undefined,
      category: filters.category || undefined,
      from: filters.fromDate || undefined,
      to: filters.toDate || undefined,
      page: 1,
    }

    // Update URL
    const newParams = new URLSearchParams()
    if (params.q) newParams.append('q', params.q)
    if (params.artist) newParams.append('artist', params.artist)
    if (params.category) newParams.append('category', params.category)
    if (params.from) newParams.append('from', params.from)
    if (params.to) newParams.append('to', params.to)

    setSearchParams(newParams)

    // Trigger search if any filter is set
    if (params.q || params.artist || params.category || params.from || params.to) {
      search(params)
    }
  }, 500) // Debounce filter changes

  return () => {
    if (filterChangeTimer.current) {
      clearTimeout(filterChangeTimer.current)
    }
  }
}, [filters])

const handleClearFilters = () => {
  setFilters({})
  setQueryInput('')
  setSearchParams({})
}

// In JSX, add filters section after search input:

return (
  <div className="min-h-screen bg-white dark:bg-gray-900">
    {/* Sticky Search Bar */}
    <div className="sticky top-0 z-40 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 shadow-sm">
      <div className="container mx-auto px-4 py-6">
        {/* Search Form */}
        <form onSubmit={handleSearchSubmit} className="flex gap-2 mb-4">
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
        </form>

        {/* Filters */}
        <SearchFiltersComponent
          filters={filters}
          onChange={setFilters}
          onClear={handleClearFilters}
          loading={loading}
        />
      </div>
    </div>

    {/* Rest of page... */}
  </div>
)
```

---

### Step 5: Handle Filter URL Parameters

Update URL parsing to handle filters:

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/pages/SearchPage.tsx` (modify useEffect)

```typescript
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

  // Set filter state from URL
  setFilters({
    artist: params.artist,
    category: params.category,
    fromDate: params.from,
    toDate: params.to,
  })

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
```

---

## Files to Create/Modify

**New files to create:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/types/filters.ts` - Filter types
2. `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/services/categoryService.ts` - Category service
3. `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/components/SearchFilters.tsx` - Filters component

**Files to modify:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/pages/SearchPage.tsx` - Integrate filters

---

## Verification

### Test 1: Filters Render

1. Navigate to `/search`
2. On mobile: Click "Filters" toggle
3. On desktop: Filters visible immediately

Expected: All filter controls visible (category, artist, date range)

---

### Test 2: Category Filter

1. Click category dropdown
2. Select a category
3. Verify: Results update with selected category
4. Verify: URL shows `?category=slug`

Expected: Search results filtered by category

---

### Test 3: Date Range Filter

1. Select "From" date: 2024-01-01
2. Select "To" date: 2024-12-31
3. Verify: Results update
4. Verify: URL shows `?from=2024-01-01&to=2024-12-31`

Expected: Results filtered by date range

---

### Test 4: Artist Filter

1. Type artist name in "Artist" field
2. Wait for debounce (500ms)
3. Verify: Results filter by artist

Expected: Artist filter works and triggers search

---

### Test 5: Multiple Filters

1. Select category: "Abstract"
2. Type artist: "John"
3. Set from date: 2023-01-01
4. Verify: Results show all three filters applied
5. Verify: URL shows all filters: `?category=abstract&artist=John&from=2023-01-01`

Expected: Multiple filters work together

---

### Test 6: Clear Filters

1. Apply multiple filters
2. Click "Clear Filters" button
3. Verify: All filters reset to empty
4. Verify: Results return to initial state
5. Verify: URL resets

Expected: Clear button resets all filters

---

### Test 7: URL Params Load

1. Visit: `/search?category=abstract&from=2023-01-01`
2. Verify: Category and date filters are pre-filled
3. Verify: Results show filtered data

Expected: Page loads with filters from URL

---

### Test 8: Responsive Layout

1. **Mobile** (<640px):
   - Filters in collapsible section
   - Toggle button visible
   - "Clear Filters" button on mobile

2. **Desktop** (>640px):
   - Filters always visible
   - All controls in one row/grid
   - "Clear All" button in header

Expected: Layout adapts to screen size

---

### Test 9: Loading State

1. Apply a filter
2. Observe results loading
3. Verify: All filter inputs are disabled during loading
4. Verify: Loading spinner shows

Expected: Filter controls disabled while searching

---

## Summary

This build adds comprehensive filter controls with:
- Category dropdown with artwork counts
- Artist text filter
- Date range picker (from/to)
- URL-based state persistence
- Mobile-friendly collapsible design
- Debounced filter changes (500ms)
- Clear all filters button
- Live search result updates

Users can now narrow search results by category, artist, and date, with all filter state shareable via URL.

---

**Next steps:**
- **104-UI-SEARCH-EMPTY-STATE.md** - Polish empty state messaging and suggestions
