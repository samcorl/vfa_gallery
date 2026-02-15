import { Link, useSearchParams } from 'react-router-dom'
import { useEffect, useState, useCallback, useRef } from 'react'
import { Search as SearchIcon } from 'lucide-react'
import ArtworkGridItem from '../components/ui/ArtworkGridItem'
import Pagination from '../components/ui/Pagination'
import SEOHead from '../components/SEOHead'
import FooterAd from '../components/ads/FooterAd'

interface SearchArtwork {
  id: string
  slug: string
  title: string
  category: string | null
  thumbnailUrl: string
  createdAt: string
  artist: {
    username: string
    displayName: string | null
  }
}

interface ArtistSuggestion {
  id: string
  username: string
  displayName: string | null
  avatarUrl: string | null
  artworkCount: number
}

interface CategoryInfo {
  slug: string
  name: string
  count: number
}

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [queryInput, setQueryInput] = useState(searchParams.get('q') || '')
  const [artworks, setArtworks] = useState<SearchArtwork[]>([])
  const [page, setPage] = useState(Number(searchParams.get('page')) || 1)
  const [totalPages, setTotalPages] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [categories, setCategories] = useState<CategoryInfo[]>([])
  const [artistInput, setArtistInput] = useState(searchParams.get('artist') || '')
  const [artistSuggestions, setArtistSuggestions] = useState<ArtistSuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1)
  const [categoryFilter, setCategoryFilter] = useState(searchParams.get('category') || '')
  const [fromDate, setFromDate] = useState(searchParams.get('from') || '')
  const [toDate, setToDate] = useState(searchParams.get('to') || '')
  const [searchPerformed, setSearchPerformed] = useState(
    !!searchParams.get('q') ||
      !!searchParams.get('artist') ||
      !!searchParams.get('category') ||
      !!searchParams.get('from') ||
      !!searchParams.get('to')
  )
  const autocompleteRef = useRef<HTMLDivElement>(null)
  const artistSuggestionsDebounceRef = useRef<NodeJS.Timeout>()

  // Fetch categories on mount
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch('/api/browse/categories')
        const data = await response.json()
        setCategories(data.categories || [])
      } catch (err) {
        console.error('Failed to fetch categories:', err)
      }
    }
    fetchCategories()
  }, [])

  // Fetch artist suggestions with debounce
  useEffect(() => {
    if (artistSuggestionsDebounceRef.current) {
      clearTimeout(artistSuggestionsDebounceRef.current)
    }

    if (!artistInput.trim()) {
      setArtistSuggestions([])
      setShowSuggestions(false)
      return
    }

    artistSuggestionsDebounceRef.current = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/search/artists?q=${encodeURIComponent(artistInput)}&limit=8`
        )
        const data = await response.json()
        setArtistSuggestions(data.artists || [])
        setShowSuggestions(true)
        setSelectedSuggestionIndex(-1)
      } catch (err) {
        console.error('Failed to fetch artist suggestions:', err)
      }
    }, 300)

    return () => {
      if (artistSuggestionsDebounceRef.current) {
        clearTimeout(artistSuggestionsDebounceRef.current)
      }
    }
  }, [artistInput])

  // Click outside handler for autocomplete
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        autocompleteRef.current &&
        !autocompleteRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Fetch search results when searchParams change
  useEffect(() => {
    const q = searchParams.get('q')
    const artist = searchParams.get('artist')
    const category = searchParams.get('category')
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const pageNum = Number(searchParams.get('page')) || 1

    // Only fetch if there are search criteria
    if (!q && !artist && !category && !from && !to) {
      setArtworks([])
      setSearchPerformed(false)
      return
    }

    const fetchResults = async () => {
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams()
        if (q) params.append('q', q)
        if (artist) params.append('artist', artist)
        if (category) params.append('category', category)
        if (from) params.append('from', from)
        if (to) params.append('to', to)
        params.append('page', String(pageNum))
        params.append('limit', '20')

        const response = await fetch(`/api/search?${params.toString()}`)
        const data = await response.json()
        setArtworks(data.data || [])
        setPage(data.pagination.page)
        setTotalPages(data.pagination.totalPages)
        setSearchPerformed(true)
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to search artworks'
        )
      } finally {
        setLoading(false)
      }
    }

    fetchResults()
  }, [searchParams])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const params = new URLSearchParams()

    if (queryInput.trim()) params.set('q', queryInput.trim())
    if (artistInput.trim()) params.set('artist', artistInput.trim())
    if (categoryFilter) params.set('category', categoryFilter)
    if (fromDate) params.set('from', fromDate)
    if (toDate) params.set('to', toDate)
    params.set('page', '1')

    setSearchParams(params)
    setShowSuggestions(false)
  }

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams)
    params.set('page', String(newPage))
    setSearchParams(params)
  }

  const handleArtistSelect = (artist: ArtistSuggestion) => {
    setArtistInput(artist.username)
    setShowSuggestions(false)
    setSelectedSuggestionIndex(-1)
  }

  const handleArtistKeydown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || artistSuggestions.length === 0) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedSuggestionIndex((prev) =>
          prev < artistSuggestions.length - 1 ? prev + 1 : 0
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedSuggestionIndex((prev) =>
          prev > 0 ? prev - 1 : artistSuggestions.length - 1
        )
        break
      case 'Enter':
        e.preventDefault()
        if (selectedSuggestionIndex >= 0) {
          handleArtistSelect(artistSuggestions[selectedSuggestionIndex])
        }
        break
      case 'Escape':
        e.preventDefault()
        setShowSuggestions(false)
        setSelectedSuggestionIndex(-1)
        break
      default:
        break
    }
  }

  const clearAll = () => {
    setQueryInput('')
    setArtistInput('')
    setCategoryFilter('')
    setFromDate('')
    setToDate('')
    setSearchParams({})
    setArtworks([])
    setSearchPerformed(false)
  }

  const hasActiveFilters =
    queryInput.trim() ||
    artistInput.trim() ||
    categoryFilter ||
    fromDate ||
    toDate

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <SEOHead
        title="Search Artworks"
        description="Search and discover artworks by title, artist, category, and more."
        path="/search"
      />
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Search</h1>

      {/* Search Form */}
      <form onSubmit={handleSearch} className="mb-6">
        <div className="flex gap-2">
          <input
            type="text"
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            placeholder="Search artworks by title, description, or tags..."
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-400 focus:border-gray-400"
          />
          <button
            type="submit"
            className="px-6 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors flex items-center gap-2"
          >
            <SearchIcon className="w-5 h-5" />
            Search
          </button>
        </div>
      </form>

      {/* Filters Row */}
      <div className="flex flex-wrap gap-3 mb-8 items-end">
        {/* Category select */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Category
          </label>
          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value)
            }}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-400 focus:border-gray-400"
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat.slug} value={cat.slug}>
                {cat.name} ({cat.count})
              </option>
            ))}
          </select>
        </div>

        {/* Artist input with autocomplete */}
        <div className="relative" ref={autocompleteRef}>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Artist
          </label>
          <input
            type="text"
            value={artistInput}
            onChange={(e) => setArtistInput(e.target.value)}
            onKeyDown={handleArtistKeydown}
            placeholder="Search by artist..."
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-400 focus:border-gray-400 w-40"
          />
          {/* Autocomplete dropdown */}
          {showSuggestions && artistSuggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-50">
              {artistSuggestions.map((artist, index) => (
                <button
                  key={artist.id}
                  type="button"
                  onMouseDown={() => handleArtistSelect(artist)}
                  className={`w-full text-left px-4 py-2 flex items-center gap-2 ${
                    index === selectedSuggestionIndex
                      ? 'bg-gray-100'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  {artist.avatarUrl && (
                    <img
                      src={artist.avatarUrl}
                      alt={artist.displayName || artist.username}
                      className="w-6 h-6 rounded-full"
                    />
                  )}
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">
                      {artist.displayName || artist.username}
                    </div>
                    <div className="text-xs text-gray-500">
                      {artist.artworkCount} artworks
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Date from */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            From
          </label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-400 focus:border-gray-400"
          />
        </div>

        {/* Date to */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            To
          </label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-400 focus:border-gray-400"
          />
        </div>

        {/* Clear button */}
        {hasActiveFilters && (
          <button
            onClick={clearAll}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-900 hover:bg-gray-50 transition-colors"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Results Header */}
      {artworks.length > 0 && (
        <div className="mb-6">
          <p className="text-gray-600">
            Found <span className="font-semibold text-gray-900">{artworks.length}</span>{' '}
            {artworks.length === 1 ? 'artwork' : 'artworks'}
          </p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="aspect-square bg-gray-200 rounded-lg animate-pulse"
            />
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="text-center py-16 text-red-600">
          <p className="text-lg font-medium">Error loading results</p>
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Results Grid */}
      {!loading && artworks.length > 0 && (
        <div className="mb-8">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {artworks.map((artwork) => (
              <ArtworkGridItem
                key={artwork.id}
                artwork={{
                  id: artwork.id,
                  slug: artwork.slug,
                  title: artwork.title,
                  thumbnailUrl: artwork.thumbnailUrl,
                  category: artwork.category,
                  artist: artwork.artist,
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex justify-center mt-8">
          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
        </div>
      )}

      {/* No Results */}
      {!loading && !error && searchPerformed && artworks.length === 0 && (
        <div className="text-center py-16 text-gray-500">
          <SearchIcon className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            No artworks found
          </h2>
          <p className="mb-6">Try different keywords or adjust your filters</p>
          <Link
            to="/browse"
            className="inline-block px-6 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            Browse All Artworks
          </Link>
        </div>
      )}

      {/* Initial State (no search yet) */}
      {!loading && !error && !searchPerformed && (
        <div className="text-center py-16 text-gray-500">
          <SearchIcon className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Search artworks
          </h2>
          <p>Enter a query or use filters to discover artworks</p>
        </div>
      )}

      <FooterAd />
    </div>
  )
}
