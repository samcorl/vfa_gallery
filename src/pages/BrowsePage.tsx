import { Link, useSearchParams } from 'react-router-dom'
import { useEffect, useState, useCallback, useRef } from 'react'
import ArtworkGridItem from '../components/ui/ArtworkGridItem'
import Avatar from '../components/ui/Avatar'
import SEOHead from '../components/SEOHead'
import FooterAd from '../components/ads/FooterAd'

type TabType = 'featured' | 'recent' | 'categories'

interface BrowseArtwork {
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

interface FeaturedArtist {
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

export default function BrowsePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = (searchParams.get('tab') as TabType) || 'recent'
  const activeCategory = searchParams.get('category') || null

  // Featured state
  const [featuredArtists, setFeaturedArtists] = useState<FeaturedArtist[]>([])
  const [featuredArtworks, setFeaturedArtworks] = useState<BrowseArtwork[]>([])

  // Recent / category artworks with infinite scroll
  const [artworks, setArtworks] = useState<BrowseArtwork[]>([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  // Categories
  const [categories, setCategories] = useState<CategoryInfo[]>([])

  const [loading, setLoading] = useState(true)
  const sentinelRef = useRef<HTMLDivElement>(null)

  const setTab = (tab: TabType) => {
    setSearchParams({ tab })
    setArtworks([])
    setPage(1)
    setHasMore(true)
  }

  const setCategory = (cat: string) => {
    setSearchParams({ tab: 'categories', category: cat })
    setArtworks([])
    setPage(1)
    setHasMore(true)
  }

  // Fetch featured data
  useEffect(() => {
    if (activeTab !== 'featured') return

    const fetchFeatured = async () => {
      setLoading(true)
      try {
        const res = await fetch('/api/browse/featured')
        if (res.ok) {
          const data = await res.json()
          setFeaturedArtists(data.artists || [])
          setFeaturedArtworks(data.artworks || [])
        }
      } catch {
        // fail silently
      } finally {
        setLoading(false)
      }
    }

    fetchFeatured()
  }, [activeTab])

  // Fetch categories list
  useEffect(() => {
    if (activeTab !== 'categories') return

    const fetchCategories = async () => {
      try {
        const res = await fetch('/api/browse/categories')
        if (res.ok) {
          const data = await res.json()
          setCategories(data.categories || [])
        }
      } catch {
        // fail silently
      }
    }

    fetchCategories()
  }, [activeTab])

  // Fetch artworks (recent or category)
  const fetchArtworks = useCallback(async (pageNum: number, append: boolean) => {
    if (activeTab === 'featured') return

    const isCategory = activeTab === 'categories' && activeCategory
    const url = isCategory
      ? `/api/browse/categories/${activeCategory}?page=${pageNum}&limit=20`
      : `/api/browse/recent?page=${pageNum}&limit=20`

    if (pageNum === 1) setLoading(true)
    else setLoadingMore(true)

    try {
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        if (append) {
          setArtworks((prev) => [...prev, ...(data.data || [])])
        } else {
          setArtworks(data.data || [])
        }
        setHasMore(data.pagination?.hasMore ?? false)
      }
    } catch {
      // fail silently
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [activeTab, activeCategory])

  // Initial fetch for recent/categories
  useEffect(() => {
    if (activeTab === 'featured') return
    if (activeTab === 'categories' && !activeCategory) {
      setLoading(false)
      return
    }
    fetchArtworks(1, false)
  }, [activeTab, activeCategory, fetchArtworks])

  // Infinite scroll with Intersection Observer
  useEffect(() => {
    if (activeTab === 'featured') return
    if (!sentinelRef.current) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          const nextPage = page + 1
          setPage(nextPage)
          fetchArtworks(nextPage, true)
        }
      },
      { rootMargin: '200px' }
    )

    observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [activeTab, hasMore, loadingMore, loading, page, fetchArtworks])

  const tabs: { key: TabType; label: string }[] = [
    { key: 'recent', label: 'Recent' },
    { key: 'featured', label: 'Featured' },
    { key: 'categories', label: 'Categories' },
  ]

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <SEOHead
        title="Browse Artworks"
        description="Browse and discover artworks from emerging visual fine artists."
        path="/browse"
      />
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Browse</h1>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-8">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
              activeTab === tab.key
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Featured Tab */}
      {activeTab === 'featured' && (
        <>
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="aspect-square bg-gray-200 rounded-lg"></div>
                  <div className="h-4 bg-gray-200 rounded mt-2 w-3/4"></div>
                </div>
              ))}
            </div>
          ) : (
            <>
              {featuredArtists.length > 0 && (
                <div className="mb-12">
                  <h2 className="text-xl font-bold text-gray-900 mb-4">Featured Artists</h2>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    {featuredArtists.map((artist) => (
                      <Link
                        key={artist.id}
                        to={`/${artist.username}`}
                        className="rounded-lg border border-gray-200 bg-white p-4 hover:shadow-md transition text-center"
                      >
                        <Avatar
                          src={artist.avatarUrl}
                          name={artist.displayName || artist.username}
                          size="lg"
                          className="mx-auto mb-2"
                        />
                        <p className="font-semibold text-sm text-gray-900 truncate">
                          {artist.displayName || artist.username}
                        </p>
                        <p className="text-xs text-gray-500">
                          {artist.artworkCount} artwork{artist.artworkCount !== 1 ? 's' : ''}
                        </p>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {featuredArtworks.length > 0 && (
                <div>
                  <h2 className="text-xl font-bold text-gray-900 mb-4">Featured Artworks</h2>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {featuredArtworks.map((artwork) => (
                      <ArtworkGridItem key={artwork.id} artwork={artwork} />
                    ))}
                  </div>
                </div>
              )}

              {featuredArtists.length === 0 && featuredArtworks.length === 0 && (
                <div className="text-center py-16 text-gray-500">
                  <p>No featured content yet</p>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Categories Tab */}
      {activeTab === 'categories' && (
        <div className="flex gap-8">
          {/* Category Sidebar */}
          <aside className="hidden md:block w-48 flex-shrink-0">
            <nav className="space-y-1 sticky top-8">
              {categories.map((cat) => (
                <button
                  key={cat.slug}
                  onClick={() => setCategory(cat.slug)}
                  className={`w-full text-left px-3 py-2 text-sm rounded transition flex items-center justify-between ${
                    activeCategory === cat.slug
                      ? 'bg-gray-900 text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <span>{cat.name}</span>
                  <span className={`text-xs ${activeCategory === cat.slug ? 'text-gray-300' : 'text-gray-400'}`}>
                    {cat.count}
                  </span>
                </button>
              ))}
            </nav>
          </aside>

          {/* Mobile category pills */}
          <div className="md:hidden flex gap-2 flex-wrap mb-4 w-full">
            {categories.map((cat) => (
              <button
                key={cat.slug}
                onClick={() => setCategory(cat.slug)}
                className={`px-3 py-1 text-sm rounded-full transition ${
                  activeCategory === cat.slug
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {/* Category artworks */}
          <div className="flex-1 min-w-0">
            {!activeCategory ? (
              <div className="text-center py-16 text-gray-500">
                <p>Select a category to browse artworks</p>
              </div>
            ) : (
              <>
                {loading ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {[...Array(8)].map((_, i) => (
                      <div key={i} className="animate-pulse">
                        <div className="aspect-square bg-gray-200 rounded-lg"></div>
                        <div className="h-4 bg-gray-200 rounded mt-2 w-3/4"></div>
                        <div className="h-3 bg-gray-200 rounded mt-1 w-1/2"></div>
                      </div>
                    ))}
                  </div>
                ) : artworks.length === 0 ? (
                  <div className="text-center py-16 text-gray-500">
                    <p>No artworks found</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {artworks.map((artwork) => (
                      <ArtworkGridItem key={artwork.id} artwork={artwork} />
                    ))}
                  </div>
                )}
              </>
            )}
            <div ref={sentinelRef} className="h-4" />
            {loadingMore && <LoadingSpinner />}
            {!hasMore && artworks.length > 0 && (
              <p className="text-center text-sm text-gray-400 py-4">No more artworks</p>
            )}
          </div>
        </div>
      )}

      {/* Recent Tab */}
      {activeTab === 'recent' && (
        <>
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="aspect-square bg-gray-200 rounded-lg"></div>
                  <div className="h-4 bg-gray-200 rounded mt-2 w-3/4"></div>
                  <div className="h-3 bg-gray-200 rounded mt-1 w-1/2"></div>
                </div>
              ))}
            </div>
          ) : artworks.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <p>No artworks found</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {artworks.map((artwork) => (
                <ArtworkGridItem key={artwork.id} artwork={artwork} />
              ))}
            </div>
          )}
          <div ref={sentinelRef} className="h-4" />
          {loadingMore && <LoadingSpinner />}
          {!hasMore && artworks.length > 0 && (
            <p className="text-center text-sm text-gray-400 py-4">No more artworks</p>
          )}
        </>
      )}
      <FooterAd />
    </div>
  )
}

function LoadingSpinner() {
  return (
    <div className="flex justify-center py-6">
      <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin"></div>
    </div>
  )
}
