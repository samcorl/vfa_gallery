# 104-UI-SEARCH-EMPTY-STATE.md

## Goal

Create a polished "no results" empty state component with friendly messaging, suggestions for refining search, and navigation options to help users discover content.

---

## Spec Extract

From Phase 18 requirements:

- **Visual Design**: Icon or illustration, clear heading, descriptive message
- **Suggestions**: "Try different keywords", "Adjust filters", "Browse popular artists"
- **Navigation Options**: Link to browse page, link to categories, button to clear filters
- **Responsive**: Works on mobile and desktop
- **Dark Mode**: Full dark mode support
- **Variations**: Different states (no results, no filters applied, error)

---

## Prerequisites

**Must complete before starting:**
- **101-UI-SEARCH-PAGE.md** - Search page exists
- **103-UI-SEARCH-FILTERS.md** - Filter controls exist

---

## Steps

### Step 1: Create Empty State Component

Create a reusable empty state component.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/components/SearchEmptyState.tsx`

```typescript
import React from 'react'
import { Link } from 'react-router-dom'

export type EmptyStateType =
  | 'no-results'
  | 'no-search'
  | 'error'
  | 'no-filters'

interface SearchEmptyStateProps {
  type?: EmptyStateType
  query?: string
  onClearFilters?: () => void
  suggestedArtists?: Array<{ id: string; name: string }>
}

/**
 * Empty state component for search page
 * Shows friendly message and suggestions based on context
 */
export const SearchEmptyState: React.FC<SearchEmptyStateProps> = ({
  type = 'no-search',
  query,
  onClearFilters,
  suggestedArtists = [],
}) => {
  const renderContent = () => {
    switch (type) {
      case 'no-results':
        return {
          icon: (
            <svg
              className="w-20 h-20"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          ),
          heading: 'No artworks found',
          description:
            query && query.length > 0
              ? `We couldn't find any artworks matching "${query}".`
              : 'No artworks match your search criteria.',
          suggestions: [
            {
              title: 'Try different keywords',
              description: 'Search with different terms or broader keywords',
            },
            {
              title: 'Adjust your filters',
              description: 'Expand the date range or remove category filters',
            },
            {
              title: 'Browse popular artists',
              description: 'Discover new artists and their galleries',
            },
          ],
        }

      case 'no-search':
        return {
          icon: (
            <svg
              className="w-20 h-20"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 11c0 3.517-1.009 6.799-2.753 9.571m5.506-15.071c2.6 3.772 4.247 8.229 4.247 13.071 0 11.105-9.294 20.129-20.75 20.129S.75 33.105.75 22C.75 10.894 10.044 1.871 21.5 1.871c3.956 0 7.672 1.066 10.875 2.915m.75 13.129h6.375M1.5 6.457h6.375"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M2 1v6h6"
              />
            </svg>
          ),
          heading: 'Start exploring',
          description:
            'Enter a search query or use filters to discover beautiful artworks from talented artists.',
          suggestions: [
            {
              title: 'Search by keywords',
              description: 'Find artworks by title, artist, or style',
            },
            {
              title: 'Browse by category',
              description: 'Explore artworks in your favorite categories',
            },
            {
              title: 'Discover featured artists',
              description: 'Check out trending and popular artists',
            },
          ],
        }

      case 'error':
        return {
          icon: (
            <svg
              className="w-20 h-20"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          ),
          heading: 'Search unavailable',
          description:
            'We encountered an error while searching. Please try again in a moment.',
          suggestions: [
            {
              title: 'Refresh the page',
              description: 'Try reloading to resolve temporary issues',
            },
            {
              title: 'Simplify your search',
              description: 'Try with fewer filters or keywords',
            },
            {
              title: 'Contact support',
              description: 'If problems persist, reach out to our team',
            },
          ],
        }

      case 'no-filters':
        return {
          icon: (
            <svg
              className="w-20 h-20"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
              />
            </svg>
          ),
          heading: 'No filters applied',
          description:
            'Your current filter combination returned no results. Try adjusting them.',
          suggestions: [
            {
              title: 'Broaden your filters',
              description: 'Expand date ranges or remove category restrictions',
            },
            {
              title: 'Clear all filters',
              description: 'Start fresh and see all available artworks',
            },
            {
              title: 'Browse without filters',
              description: 'Visit the browse page to see popular artworks',
            },
          ],
        }

      default:
        return {
          icon: (
            <svg
              className="w-20 h-20"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          ),
          heading: 'No results',
          description: 'Try adjusting your search or filters to find what you are looking for.',
          suggestions: [],
        }
    }
  }

  const content = renderContent()

  return (
    <div className="py-16 px-4 text-center">
      {/* Icon */}
      <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 mb-6">
        {content.icon}
      </div>

      {/* Heading */}
      <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-3">
        {content.heading}
      </h2>

      {/* Description */}
      <p className="text-gray-600 dark:text-gray-400 text-lg max-w-md mx-auto mb-8">
        {content.description}
      </p>

      {/* Suggestions Grid */}
      {content.suggestions.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mx-auto mb-8">
          {content.suggestions.map((suggestion, idx) => (
            <div
              key={idx}
              className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
            >
              <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                {suggestion.title}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {suggestion.description}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        {onClearFilters && type !== 'no-search' && (
          <button
            onClick={onClearFilters}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
          >
            Clear Filters & Search
          </button>
        )}

        <Link
          to="/browse"
          className="px-6 py-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-medium rounded-lg transition-colors"
        >
          Browse Gallery
        </Link>

        {type === 'error' && (
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 border-2 border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 text-gray-900 dark:text-white font-medium rounded-lg transition-colors"
          >
            Reload Page
          </button>
        )}
      </div>

      {/* Suggested Artists (optional) */}
      {suggestedArtists.length > 0 && (
        <div className="mt-12 max-w-2xl mx-auto">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Popular Artists to Explore
          </h3>
          <div className="flex flex-wrap gap-2 justify-center">
            {suggestedArtists.map((artist) => (
              <Link
                key={artist.id}
                to={`/public/${artist.name}`}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-blue-50 dark:hover:bg-blue-900 text-gray-900 dark:text-white rounded-full transition-colors text-sm font-medium"
              >
                {artist.name}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
```

---

### Step 2: Create Empty State Hook

Create a hook to determine which empty state to show.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/hooks/useEmptyState.ts`

```typescript
import type { EmptyStateType } from '../components/SearchEmptyState'
import type { SearchParams } from '../types/search'
import type { SearchResponse } from '../types/search'

/**
 * Determine which empty state to display based on search state
 */
export function useEmptyState(
  results: SearchResponse | null,
  loading: boolean,
  error: string | null,
  params: SearchParams
): { type: EmptyStateType; shouldShow: boolean } {
  // Don't show empty state while loading
  if (loading) {
    return { type: 'no-search', shouldShow: false }
  }

  // Show error state
  if (error) {
    return { type: 'error', shouldShow: true }
  }

  // No search params entered yet
  if (!params.q && !params.artist && !params.category && !params.from && !params.to) {
    return { type: 'no-search', shouldShow: true }
  }

  // Has filters but no results
  if (
    results &&
    results.results.length === 0 &&
    (params.category || params.from || params.to)
  ) {
    return { type: 'no-filters', shouldShow: true }
  }

  // Has query but no results
  if (results && results.results.length === 0) {
    return { type: 'no-results', shouldShow: true }
  }

  return { type: 'no-search', shouldShow: false }
}
```

---

### Step 3: Update Search Page with Empty State

Integrate empty state component into search page.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/pages/SearchPage.tsx` (modify existing)

Replace the empty state sections:

```typescript
import { SearchEmptyState } from '../components/SearchEmptyState'
import { useEmptyState } from '../hooks/useEmptyState'

// In SearchPage component:

const emptyState = useEmptyState(
  results,
  loading,
  error,
  {
    q: queryInput,
    artist: filters.artist,
    category: filters.category,
    from: filters.fromDate,
    to: filters.toDate,
  }
)

// In JSX, replace all the empty state sections with:

{emptyState.shouldShow && (
  <SearchEmptyState
    type={emptyState.type}
    query={queryInput}
    onClearFilters={emptyState.type === 'no-filters' ? handleClearFilters : undefined}
  />
)}

{!loading && results && artworksToDisplay.length > 0 && (
  <ArtworkGrid
    artworks={artworksToDisplay}
    onSelect={handleArtworkSelect}
    showArtist={true}
  />
)}
```

---

### Step 4: Add Fallback Suggestions

Add a section to fetch popular artists for suggestions.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/services/searchService.ts` (modify existing)

```typescript
/**
 * Fetch popular artists for suggestions
 */
export async function fetchPopularArtists(limit: number = 6): Promise<
  Array<{ id: string; name: string }>
> {
  try {
    const response = await fetch(`/api/browse/featured?limit=${limit}`)

    if (!response.ok) {
      throw new Error('Failed to fetch popular artists')
    }

    const data = await response.json()

    // Extract unique artists from featured artworks
    const artistMap = new Map<string, { id: string; name: string }>()

    data.artworks?.forEach((artwork: any) => {
      if (!artistMap.has(artwork.artistId)) {
        artistMap.set(artwork.artistId, {
          id: artwork.artistId,
          name: artwork.artistName,
        })
      }
    })

    return Array.from(artistMap.values()).slice(0, limit)
  } catch (error) {
    console.error('Error fetching popular artists:', error)
    return []
  }
}
```

---

### Step 5: Show Suggested Artists in Empty State

Update SearchPage to load and display popular artists.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/pages/SearchPage.tsx` (modify existing)

```typescript
import { fetchPopularArtists } from '../services/searchService'

// In SearchPage component:

const [suggestedArtists, setSuggestedArtists] = useState<
  Array<{ id: string; name: string }>
>([])

useEffect(() => {
  const loadSuggestedArtists = async () => {
    try {
      const artists = await fetchPopularArtists(6)
      setSuggestedArtists(artists)
    } catch (error) {
      console.error('Error loading suggested artists:', error)
    }
  }

  // Load suggestions when showing no-search or no-results state
  if (
    emptyState.type === 'no-search' ||
    emptyState.type === 'no-results'
  ) {
    loadSuggestedArtists()
  }
}, [emptyState.type])

// Pass to empty state:
{emptyState.shouldShow && (
  <SearchEmptyState
    type={emptyState.type}
    query={queryInput}
    onClearFilters={emptyState.type === 'no-filters' ? handleClearFilters : undefined}
    suggestedArtists={suggestedArtists}
  />
)}
```

---

## Files to Create/Modify

**New files to create:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/components/SearchEmptyState.tsx` - Empty state component
2. `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/hooks/useEmptyState.ts` - Empty state logic hook

**Files to modify:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/pages/SearchPage.tsx` - Integrate empty state
2. `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/services/searchService.ts` - Add artist suggestions

---

## Verification

### Test 1: No Search Empty State

1. Navigate to `/search`
2. Don't enter any search query
3. Don't apply any filters

Expected: "Start exploring" empty state shows with suggestions

---

### Test 2: No Results Empty State

1. Navigate to `/search`
2. Search for non-existent query: "xyz123notreal"
3. Click Search

Expected: "No artworks found" empty state shows with query in message

---

### Test 3: No Filters Empty State

1. Navigate to `/search?category=abstract&from=2000-01-01&to=2000-01-02`
2. Results show no artworks

Expected: "No filters applied" empty state shows with "Clear Filters" button

---

### Test 4: Error Empty State

1. Mock API error (use network throttling or modify API response)
2. Attempt search

Expected: "Search unavailable" empty state shows with "Reload Page" button

---

### Test 5: Action Buttons

1. On "No results" state, click "Browse Gallery"
2. Verify: Navigate to `/browse`

Expected: Navigation works

---

### Test 6: Clear Filters Button

1. Apply multiple filters that return no results
2. Click "Clear Filters & Search"
3. Verify: Filters clear and URL resets

Expected: Filters clear and search resets

---

### Test 7: Popular Artists Display

1. Navigate to `/search` (no query)
2. Verify: Popular artists section shows

Expected: 6 suggested artists appear at bottom of empty state

---

### Test 8: Artist Link Navigation

1. Click on a suggested artist name
2. Verify: Navigate to artist's public profile

Expected: Navigation to `/public/[artist-name]` works

---

### Test 9: Dark Mode

1. Toggle dark mode
2. Verify: Empty state colors adapt (icons, text, backgrounds)

Expected: All empty state elements have proper dark mode styling

---

### Test 10: Responsive Layout

1. **Mobile** (<640px):
   - Icon and text centered
   - Suggestions in single column
   - Buttons stack vertically

2. **Tablet** (640-1024px):
   - Suggestions in 2 columns
   - Buttons side-by-side

3. **Desktop** (>1024px):
   - Suggestions in 3 columns
   - Full layout

Expected: Layout adapts to all breakpoints

---

### Test 11: Empty State Transition

1. Start at empty state (no query)
2. Type search query
3. Results load
4. Search for non-existent query
5. Verify: Empty state transitions smoothly

Expected: Empty state updates appropriately at each step

---

## Summary

This build creates a polished empty state experience with:
- Multiple empty state variations (no-search, no-results, no-filters, error)
- Friendly messaging with helpful suggestions
- Action buttons for common next steps (clear filters, browse, reload)
- Popular artist suggestions from featured content
- Full dark mode support
- Responsive design for all screen sizes
- Smooth transitions between states

The empty states guide users toward meaningful content discovery and help them refine their searches.

---

**Completion:**
All four search feature builds are now complete:
- **101-UI-SEARCH-PAGE.md** - Core search page with input and results
- **102-UI-SEARCH-AUTOCOMPLETE.md** - Artist name autocomplete
- **103-UI-SEARCH-FILTERS.md** - Filter controls
- **104-UI-SEARCH-EMPTY-STATE.md** - Polished empty states
