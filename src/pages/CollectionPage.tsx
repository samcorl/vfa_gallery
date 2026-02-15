import { useParams, Link, useNavigate } from 'react-router-dom'
import { useEffect, useState, useCallback } from 'react'
import ErrorState from '../components/ui/ErrorState'
import NotFoundState from '../components/ui/NotFoundState'
import Pagination from '../components/ui/Pagination'
import ItemNavigation from '../components/ui/ItemNavigation'
import SEOHead from '../components/SEOHead'

interface ArtworkItem {
  id: string
  slug: string
  title: string
  medium: string | null
  dimensions: string | null
  year: number | null
  imageUrl: string
  thumbnailUrl: string
  position: number
}

interface CollectionData {
  id: string
  slug: string
  name: string
  description: string | null
  heroImageUrl: string | null
  themeId: string | null
  artist: {
    username: string
    displayName: string
    avatarUrl: string | null
  }
  gallery: {
    slug: string
    name: string
  }
  navigation: {
    previous: { slug: string; name: string } | null
    next: { slug: string; name: string } | null
  }
  artworks: {
    data: ArtworkItem[]
    pagination: {
      page: number
      pageSize: number
      total: number
      totalPages: number
    }
  }
  createdAt: string
  updatedAt: string
}

export default function CollectionPage() {
  const { artist, gallery, collection } = useParams<{
    artist: string
    gallery: string
    collection: string
  }>()
  const navigate = useNavigate()
  const [data, setData] = useState<CollectionData | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)

  // Fetch collection data
  useEffect(() => {
    const fetchCollection = async () => {
      try {
        setLoading(true)
        setError(null)
        setNotFound(false)

        const response = await fetch(
          `/api/g/${artist}/${gallery}/${collection}?page=${currentPage}&pageSize=24`
        )

        if (response.status === 404) {
          setNotFound(true)
          setLoading(false)
          return
        }

        if (!response.ok) {
          throw new Error('Failed to fetch collection')
        }

        const result: CollectionData = await response.json()
        setData(result)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
      } finally {
        setLoading(false)
      }
    }

    if (artist && gallery && collection) {
      fetchCollection()
    }
  }, [artist, gallery, collection, currentPage])

  // Reset page when collection changes
  useEffect(() => {
    setCurrentPage(1)
  }, [collection])

  // Keyboard navigation for prev/next collection
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!data) return
      // Don't capture when typing in inputs
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return
      }

      if (e.key === 'ArrowLeft' && data.navigation.previous) {
        navigate(`/${artist}/${gallery}/${data.navigation.previous.slug}`)
      } else if (e.key === 'ArrowRight' && data.navigation.next) {
        navigate(`/${artist}/${gallery}/${data.navigation.next.slug}`)
      }
    },
    [data, artist, gallery, navigate]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // 404 state
  if (notFound) {
    return (
      <NotFoundState
        title="Collection not found"
        message="The collection you're looking for doesn't exist or has been removed."
        links={[
          { to: `/${artist}/${gallery}`, label: 'Back to gallery' },
          { to: `/${artist}`, label: 'View artist profile' },
        ]}
      />
    )
  }

  // Loading state
  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-48 mb-8"></div>
          <div className="h-64 bg-gray-200 rounded-lg mb-8"></div>
          <div className="h-10 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-5 bg-gray-200 rounded w-1/2 mb-8"></div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="aspect-square bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // Error state
  if (error && !data) {
    return <ErrorState error={error} onRetry={() => window.location.reload()} />
  }

  if (!data) return null

  const { navigation, artworks } = data
  const { pagination } = artworks

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <SEOHead
        title={`${data.name} - ${data.artist.displayName}`}
        description={data.description || `Collection by ${data.artist.displayName}`}
        image={data.heroImageUrl || (data.artworks.data[0]?.thumbnailUrl) || undefined}
        imageAlt={data.name}
        path={`/${artist}/${gallery}/${collection}`}
      />
      {/* Breadcrumbs */}
      <nav className="text-sm text-gray-500 mb-8 flex items-center gap-2">
        <Link to="/" className="hover:text-gray-700 transition">
          Home
        </Link>
        <span>/</span>
        <Link to={`/${artist}`} className="hover:text-gray-700 transition">
          {artist}
        </Link>
        <span>/</span>
        <Link to={`/${artist}/${gallery}`} className="hover:text-gray-700 transition">
          {data.gallery.name}
        </Link>
        <span>/</span>
        <span className="text-gray-900">{data.name}</span>
      </nav>

      {/* Hero Image */}
      {data.heroImageUrl && (
        <div className="mb-8 rounded-lg overflow-hidden bg-gray-100">
          <img
            src={data.heroImageUrl}
            alt={data.name}
            className="w-full h-64 md:h-80 lg:h-96 object-cover"
          />
        </div>
      )}

      {/* Collection Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">{data.name}</h1>
        {data.description && (
          <p className="text-lg text-gray-600 max-w-2xl">{data.description}</p>
        )}
        <div className="flex items-center gap-3 mt-4">
          <p className="text-sm text-gray-500">
            in{' '}
            <Link
              to={`/${artist}/${gallery}`}
              className="hover:underline font-medium text-gray-900"
            >
              {data.gallery.name}
            </Link>{' '}
            by{' '}
            <Link to={`/${artist}`} className="hover:underline font-medium text-gray-900">
              {data.artist.displayName}
            </Link>
          </p>
        </div>
        <p className="text-sm text-gray-500 mt-1">
          {artworks.pagination.total} artwork{artworks.pagination.total !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Artwork Grid */}
      {artworks.data.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-500">No artworks in this collection yet</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
            {artworks.data.map((artwork) => (
              <Link
                key={artwork.id}
                to={`/${artist}/${gallery}/${collection}/${artwork.slug}`}
                className="group block"
              >
                <div className="aspect-square rounded-lg overflow-hidden bg-gray-100">
                  <img
                    src={artwork.thumbnailUrl}
                    alt={artwork.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    loading="lazy"
                  />
                </div>
                <div className="mt-2">
                  <h3 className="text-sm font-medium text-gray-900 truncate">
                    {artwork.title}
                  </h3>
                  {artwork.medium && (
                    <p className="text-xs text-gray-500 truncate">{artwork.medium}</p>
                  )}
                  {artwork.year && (
                    <p className="text-xs text-gray-400">{artwork.year}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>

          {/* Artwork Pagination */}
          <Pagination
            page={currentPage}
            totalPages={pagination.totalPages}
            onPageChange={setCurrentPage}
          />
        </>
      )}

      {/* Prev/Next Collection Navigation */}
      <ItemNavigation
        previous={navigation.previous ? { slug: navigation.previous.slug, title: navigation.previous.name } : null}
        next={navigation.next ? { slug: navigation.next.slug, title: navigation.next.name } : null}
        basePath={`/${artist}/${gallery}`}
        previousLabel="Previous collection"
        nextLabel="Next collection"
        keyboardHint="Use arrow keys to navigate between collections"
      />
    </div>
  )
}
