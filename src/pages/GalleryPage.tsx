import { useParams, Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import ErrorState from '../components/ui/ErrorState'
import NotFoundState from '../components/ui/NotFoundState'
import Pagination from '../components/ui/Pagination'
import SEOHead from '../components/SEOHead'
import FooterAd from '../components/ads/FooterAd'

interface GalleryData {
  id: string
  slug: string
  name: string
  description: string
  welcomeMessage: string | null
  themeId: string | null
  collectionCount: number
  artist: {
    username: string
    displayName: string
    avatarUrl: string
  }
  createdAt: string
  updatedAt: string
}

interface Collection {
  id: string
  slug: string
  name: string
  description: string
  heroImageUrl: string | null
  artworkCount: number
}

interface CollectionsResponse {
  data: Collection[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}

export default function GalleryPage() {
  const { artist, gallery } = useParams<{ artist: string; gallery: string }>()
  const [galleryData, setGalleryData] = useState<GalleryData | null>(null)
  const [collections, setCollections] = useState<Collection[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [pagination, setPagination] = useState({ page: 1, pageSize: 12, total: 0, totalPages: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)

  // Fetch gallery data
  useEffect(() => {
    const fetchGallery = async () => {
      try {
        setLoading(true)
        setError(null)
        setNotFound(false)

        const response = await fetch(`/api/g/${artist}/${gallery}`)
        if (response.status === 404) {
          setNotFound(true)
          setLoading(false)
          return
        }

        if (!response.ok) {
          throw new Error('Failed to fetch gallery')
        }

        const data: GalleryData = await response.json()
        setGalleryData(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
      } finally {
        setLoading(false)
      }
    }

    if (artist && gallery) {
      fetchGallery()
    }
  }, [artist, gallery])

  // Fetch collections
  useEffect(() => {
    const fetchCollections = async () => {
      if (!galleryData) return

      try {
        const response = await fetch(
          `/api/g/${artist}/${gallery}/collections?page=${currentPage}&pageSize=12`
        )

        if (!response.ok) {
          throw new Error('Failed to fetch collections')
        }

        const data: CollectionsResponse = await response.json()
        setCollections(data.data)
        setPagination(data.pagination)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load collections')
      }
    }

    if (galleryData) {
      fetchCollections()
    }
  }, [galleryData, currentPage, artist, gallery])

  // 404 state
  if (notFound) {
    return (
      <NotFoundState
        title="Gallery not found"
        message="The gallery you're looking for doesn't exist or has been removed."
        links={[
          { to: `/${artist}`, label: 'View artist profile' },
          { to: '/', label: 'Back to home' },
        ]}
      />
    )
  }

  // Loading state
  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="animate-pulse">
          <div className="h-12 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-6 bg-gray-200 rounded w-1/2 mb-8"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-gray-200 rounded-lg h-64"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // Error state
  if (error && !galleryData) {
    return <ErrorState error={error} onRetry={() => { setLoading(true); window.location.reload() }} />
  }

  if (!galleryData) return null

  return (
    <div className="flex gap-8 max-w-7xl mx-auto px-4 py-12">
      <SEOHead
        title={`${galleryData.name} - ${galleryData.artist.displayName}`}
        description={galleryData.welcomeMessage || galleryData.description || `Gallery by ${galleryData.artist.displayName}`}
        path={`/${artist}/${gallery}`}
      />
      {/* Sidebar - desktop only */}
      <aside className="hidden lg:block w-64 flex-shrink-0">
        <div className="sticky top-8">
          <h3 className="font-semibold text-sm text-gray-900 mb-4">{galleryData.name}</h3>
          <nav className="space-y-2">
            {collections.map((collection) => (
              <Link
                key={collection.id}
                to={`/${artist}/${gallery}/${collection.slug}`}
                className="flex items-center justify-between text-sm text-gray-600 hover:text-gray-900 transition group"
              >
                <span className="group-hover:underline">{collection.name}</span>
                <span className="text-xs text-gray-400">{collection.artworkCount}</span>
              </Link>
            ))}
          </nav>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        {/* Breadcrumb */}
        <nav className="text-sm text-gray-500 mb-8 flex items-center gap-2">
          <Link to="/" className="hover:text-gray-700 transition">
            Home
          </Link>
          <span>/</span>
          <Link to={`/${artist}`} className="hover:text-gray-700 transition">
            {artist}
          </Link>
          <span>/</span>
          <span className="text-gray-900">{galleryData.name}</span>
        </nav>

        {/* Hero Section */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">{galleryData.name}</h1>
          {galleryData.welcomeMessage && (
            <p className="text-lg text-gray-600 mt-4 max-w-2xl">{galleryData.welcomeMessage}</p>
          )}
          <div className="flex items-center gap-3 mt-6">
            <img
              src={galleryData.artist.avatarUrl}
              alt={galleryData.artist.displayName}
              className="w-8 h-8 rounded-full bg-gray-200 object-cover"
            />
            <p className="text-sm text-gray-600">
              by{' '}
              <Link to={`/${artist}`} className="hover:underline font-medium text-gray-900">
                {galleryData.artist.displayName}
              </Link>
            </p>
          </div>
          <p className="text-sm text-gray-500 mt-2">
            {galleryData.collectionCount} collection{galleryData.collectionCount !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Collections Section */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mt-12 mb-6">Collections</h2>

          {collections.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">No collections in this gallery yet</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                {collections.map((collection) => (
                  <Link
                    key={collection.id}
                    to={`/${artist}/${gallery}/${collection.slug}`}
                    className="group block hover:shadow-md transition"
                  >
                    <div className="rounded-t-lg overflow-hidden bg-gray-100">
                      {collection.heroImageUrl ? (
                        <img
                          src={collection.heroImageUrl}
                          alt={collection.name}
                          className="w-full aspect-video object-cover group-hover:scale-105 transition duration-300"
                        />
                      ) : (
                        <div className="w-full aspect-video flex items-center justify-center bg-gray-100">
                          <svg
                            className="w-12 h-12 text-gray-300"
                            fill="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zm-5.04-6.71l-2.75-3.54c-.3-.38-.77-.62-1.3-.62-.89 0-1.6.71-1.6 1.6 0 .53.24 1 .62 1.3l2.75 3.54c.3.38.77.62 1.3.62.89 0 1.6-.71 1.6-1.6 0-.53-.24-1-.62-1.3z" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <div className="bg-white border border-t-0 border-gray-200 rounded-b-lg p-4">
                      <h3 className="font-semibold text-gray-900">{collection.name}</h3>
                      <p className="text-sm text-gray-500 line-clamp-2 mt-1">
                        {collection.description}
                      </p>
                      <p className="text-xs text-gray-400 mt-2">
                        {collection.artworkCount} artwork{collection.artworkCount !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>

              <Pagination
                page={currentPage}
                totalPages={pagination.totalPages}
                onPageChange={setCurrentPage}
              />
            </>
          )}
        </div>

        {/* Footer Ad */}
        <FooterAd />
      </div>
    </div>
  )
}
