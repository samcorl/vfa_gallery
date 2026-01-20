# 102-UI-SEARCH-AUTOCOMPLETE.md

## Goal

Add artist name autocomplete dropdown to search input with debounced API calls, keyboard navigation (arrow keys, enter, escape), and click selection.

---

## Spec Extract

From Phase 18 requirements:

- **Autocomplete Trigger**: After 2 characters typed
- **Debounce**: 300ms delay before API call
- **Suggestion Source**: API endpoint for artist suggestions
- **Keyboard Navigation**: Up/down arrows, enter to select, escape to close
- **Mouse Support**: Click to select suggestion
- **Display**: Dropdown below search input with artist names and artwork count
- **Max Results**: Show up to 8 suggestions

---

## Prerequisites

**Must complete before starting:**
- **101-UI-SEARCH-PAGE.md** - Search page with input exists
- **API endpoint for artist suggestions** - Should return artist names and counts

---

## Steps

### Step 1: Create Autocomplete Hook

Create a reusable hook for managing autocomplete state and API calls.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/hooks/useAutocomplete.ts`

```typescript
import { useState, useCallback, useRef, useEffect } from 'react'

export interface AutocompleteOption {
  id: string
  label: string
  value: string
  metadata?: Record<string, any>
}

interface UseAutocompleteOptions {
  debounceMs?: number
  minChars?: number
  maxResults?: number
  fetchSuggestions: (query: string) => Promise<AutocompleteOption[]>
}

/**
 * Hook for managing autocomplete state with debounce and keyboard navigation
 */
export function useAutocomplete(options: UseAutocompleteOptions) {
  const {
    debounceMs = 300,
    minChars = 2,
    maxResults = 8,
    fetchSuggestions,
  } = options

  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<AutocompleteOption[]>([])
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Fetch suggestions with debounce
  useEffect(() => {
    // Clear existing timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current)
    }

    // Don't search if query too short
    if (query.length < minChars) {
      setSuggestions([])
      setIsOpen(false)
      setSelectedIndex(-1)
      return
    }

    setLoading(true)

    // Set debounce timer
    debounceTimer.current = setTimeout(async () => {
      try {
        const results = await fetchSuggestions(query)
        const limited = results.slice(0, maxResults)
        setSuggestions(limited)
        setIsOpen(limited.length > 0)
        setSelectedIndex(-1)
      } catch (error) {
        console.error('Autocomplete error:', error)
        setSuggestions([])
        setIsOpen(false)
      } finally {
        setLoading(false)
      }
    }, debounceMs)

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current)
      }
    }
  }, [query, minChars, debounceMs, maxResults, fetchSuggestions])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen) {
        if (e.key === 'ArrowDown') {
          setIsOpen(true)
        }
        return
      }

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex((prev) =>
            prev < suggestions.length - 1 ? prev + 1 : prev
          )
          break

        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1))
          break

        case 'Enter':
          e.preventDefault()
          if (selectedIndex >= 0) {
            const selected = suggestions[selectedIndex]
            setQuery(selected.value)
            setIsOpen(false)
            setSuggestions([])
            setSelectedIndex(-1)
          }
          break

        case 'Escape':
          e.preventDefault()
          setIsOpen(false)
          setSelectedIndex(-1)
          break

        default:
          break
      }
    },
    [isOpen, suggestions, selectedIndex]
  )

  const selectSuggestion = useCallback((option: AutocompleteOption) => {
    setQuery(option.value)
    setIsOpen(false)
    setSuggestions([])
    setSelectedIndex(-1)
  }, [])

  return {
    query,
    setQuery,
    suggestions,
    selectedIndex,
    isOpen,
    setIsOpen,
    loading,
    handleKeyDown,
    selectSuggestion,
  }
}
```

---

### Step 2: Create Autocomplete Component

Create a reusable autocomplete dropdown component.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/components/Autocomplete.tsx`

```typescript
import React, { useRef, useEffect } from 'react'
import type { AutocompleteOption } from '../hooks/useAutocomplete'

interface AutocompleteProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  options: AutocompleteOption[]
  selectedIndex: number
  isOpen: boolean
  loading: boolean
  onKeyDown: (e: React.KeyboardEvent) => void
  onSelect: (option: AutocompleteOption) => void
  onOpenChange?: (open: boolean) => void
}

/**
 * Autocomplete dropdown component
 * Shows suggestions below input with keyboard navigation support
 */
export const Autocomplete: React.FC<AutocompleteProps> = ({
  value,
  onChange,
  placeholder,
  options,
  selectedIndex,
  isOpen,
  loading,
  onKeyDown,
  onSelect,
  onOpenChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const highlightedItemRef = useRef<HTMLButtonElement>(null)

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onOpenChange?.(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onOpenChange])

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedItemRef.current) {
      highlightedItemRef.current.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIndex])

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Input Field */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => value.length >= 2 && options.length > 0 && onOpenChange?.(true)}
          placeholder={placeholder}
          className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        {/* Loading Spinner */}
        {loading && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          </div>
        )}
      </div>

      {/* Dropdown Menu */}
      {isOpen && options.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg z-50">
          {options.map((option, index) => (
            <button
              ref={index === selectedIndex ? highlightedItemRef : null}
              key={option.id}
              onClick={() => onSelect(option)}
              className={`w-full text-left px-4 py-3 transition-colors ${
                index === selectedIndex
                  ? 'bg-blue-50 dark:bg-blue-900 text-blue-900 dark:text-blue-50'
                  : 'text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700'
              } ${index < options.length - 1 ? 'border-b border-gray-100 dark:border-gray-700' : ''}`}
              type="button"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{option.label}</span>
                {option.metadata?.count && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {option.metadata.count} artwork{option.metadata.count !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* No Results Message */}
      {isOpen && !loading && options.length === 0 && value.length >= 2 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg px-4 py-3 z-50">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No artists found matching "{value}"
          </p>
        </div>
      )}
    </div>
  )
}
```

---

### Step 3: Create Artist Suggestions Service

Create a service for fetching artist suggestions.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/services/searchService.ts`

```typescript
import type { AutocompleteOption } from '../hooks/useAutocomplete'

/**
 * Fetch artist name suggestions for autocomplete
 * @param query - Search query
 * @returns Array of artist suggestions
 */
export async function fetchArtistSuggestions(
  query: string
): Promise<AutocompleteOption[]> {
  if (query.length < 2) {
    return []
  }

  try {
    const response = await fetch(
      `/api/search/artists?q=${encodeURIComponent(query)}&limit=8`
    )

    if (!response.ok) {
      throw new Error('Failed to fetch artist suggestions')
    }

    const data = await response.json()

    return data.artists.map((artist: any) => ({
      id: artist.id,
      label: artist.name,
      value: artist.name,
      metadata: {
        count: artist.artworkCount || 0,
      },
    }))
  } catch (error) {
    console.error('Error fetching artist suggestions:', error)
    return []
  }
}
```

---

### Step 4: Update Search Page with Autocomplete

Integrate autocomplete into the search page.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/pages/SearchPage.tsx` (modify existing)

Replace the search form section:

```typescript
import { useAutocomplete } from '../hooks/useAutocomplete'
import { Autocomplete } from '../components/Autocomplete'
import { fetchArtistSuggestions } from '../services/searchService'

// In SearchPage component, replace search form:

const {
  query: artistQuery,
  setQuery: setArtistQuery,
  suggestions,
  selectedIndex,
  isOpen,
  setIsOpen,
  loading: suggestionsLoading,
  handleKeyDown: handleAutocompleteKeyDown,
  selectSuggestion,
} = useAutocomplete({
  debounceMs: 300,
  minChars: 2,
  maxResults: 8,
  fetchSuggestions: fetchArtistSuggestions,
})

// Use handleAutocompleteKeyDown for autocomplete input
const handleAutocompleteKeyDown = (e: React.KeyboardEvent) => {
  // If Enter on autocomplete, trigger search
  if (e.key === 'Enter' && isOpen === false) {
    handleSearchSubmit(e as any)
  } else {
    handleAutocompleteKeyDown(e)
  }
}

// In JSX, update the search form:
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

  {/* Artist Autocomplete */}
  <div className="w-48">
    <Autocomplete
      value={artistQuery}
      onChange={setArtistQuery}
      placeholder="Filter by artist"
      options={suggestions}
      selectedIndex={selectedIndex}
      isOpen={isOpen}
      loading={suggestionsLoading}
      onKeyDown={handleAutocompleteKeyDown}
      onSelect={(option) => {
        selectSuggestion(option)
        // Update search params with selected artist
        setSearchParams((prev) => {
          const newParams = new URLSearchParams(prev)
          newParams.set('artist', option.value)
          return newParams
        })
      }}
      onOpenChange={setIsOpen}
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
```

---

### Step 5: Create Backend API Endpoint (if needed)

If the API endpoint doesn't exist, create it:

**File:** Backend route (implementation depends on your framework)

```typescript
// GET /api/search/artists?q=query&limit=8
// Returns: { artists: [{ id, name, artworkCount }, ...] }

export async function searchArtists(db: Database, query: string, limit: number = 8) {
  const searchPattern = `%${query}%`

  const artists = await db
    .select({
      id: users.id,
      name: users.displayName || users.username,
    })
    .from(users)
    .where(sql`${users.displayName} LIKE ${searchPattern} OR ${users.username} LIKE ${searchPattern}`)
    .limit(limit)

  // Get artwork count for each artist
  const withCounts = await Promise.all(
    artists.map(async (artist) => ({
      ...artist,
      artworkCount: await getArtworkCountForArtist(db, artist.id),
    }))
  )

  return withCounts
}
```

---

## Files to Create/Modify

**New files to create:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/hooks/useAutocomplete.ts` - Autocomplete hook
2. `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/components/Autocomplete.tsx` - Autocomplete component
3. `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/services/searchService.ts` - Search service

**Files to modify:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/pages/SearchPage.tsx` - Integrate autocomplete

---

## Verification

### Test 1: Autocomplete Appears

1. Click on artist input field
2. Type 2-3 characters (e.g., "john")
3. Wait 300ms

Expected: Dropdown appears with matching artists

---

### Test 2: Debounce Works

1. Type quickly: "j-o-h-n-d-o-e"
2. Watch network tab

Expected: Only 1 API call after 300ms delay, not multiple calls per keystroke

---

### Test 3: Keyboard Navigation

1. Type "john"
2. Press Down arrow
3. First artist highlights
4. Press Down arrow again
5. Second artist highlights
6. Press Up arrow
7. Back to first artist
8. Press Enter

Expected: Selected artist populates input and dropdown closes

---

### Test 4: Escape to Close

1. Type "john"
2. Dropdown appears
3. Press Escape

Expected: Dropdown closes, text remains in input

---

### Test 5: Click to Select

1. Type "john"
2. Click on an artist in dropdown
3. Verify: Artist name fills input

Expected: Clicking selects and closes dropdown

---

### Test 6: No Results

1. Type "zzzzzzzzz" (non-existent artist)
2. Wait for debounce

Expected: Message shows "No artists found matching..."

---

### Test 7: Responsive

1. Test on mobile (<640px)
2. Test on tablet (640-1024px)
3. Test on desktop (>1024px)

Expected: Autocomplete dropdown aligns properly at all breakpoints

---

## Summary

This build adds artist autocomplete to the search page with:
- Debounced API calls (300ms)
- Keyboard navigation (arrow keys, enter, escape)
- Click-to-select support
- Loading state indicator
- Artwork count display
- Responsive dropdown positioning
- Click-outside detection

The autocomplete enhances the search experience by helping users discover artists and filter results efficiently.

---

**Next steps:**
- **103-UI-SEARCH-FILTERS.md** - Add category and date range filters
- **104-UI-SEARCH-EMPTY-STATE.md** - Polish empty state messaging
