import { useParams, Link, useNavigate } from 'react-router-dom'
import { useEffect, useState, useCallback, useRef } from 'react'
import { X, ZoomIn } from 'lucide-react'
import ErrorState from '../components/ui/ErrorState'
import NotFoundState from '../components/ui/NotFoundState'
import ItemNavigation from '../components/ui/ItemNavigation'
import Avatar from '../components/ui/Avatar'
import ShareButtons from '../components/ui/ShareButtons'
import SEOHead from '../components/SEOHead'

interface ArtworkData {
  id: string
  slug: string
  title: string
  description: string | null
  materials: string | null
  dimensions: string | null
  createdDate: string | null
  category: string | null
  tags: string[]
  displayUrl: string
  thumbnailUrl: string
  status: string
  position: number
  createdAt: string
  updatedAt: string
  artist: {
    username: string
    displayName: string
    avatarUrl: string | null
  }
  parent: {
    gallery: {
      slug: string
      name: string
    }
    collection: {
      slug: string
      name: string
    }
  }
  navigation: {
    previous: { slug: string; title: string; thumbnailUrl: string } | null
    next: { slug: string; title: string; thumbnailUrl: string } | null
  }
}

export default function ArtworkPage() {
  const { artist, gallery, collection, artwork } = useParams<{
    artist: string
    gallery: string
    collection: string
    artwork: string
  }>()
  const navigate = useNavigate()
  const [data, setData] = useState<ArtworkData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [showZoom, setShowZoom] = useState(false)
  const [zoomScale, setZoomScale] = useState(1)
  const [zoomPos, setZoomPos] = useState({ x: 0, y: 0 })
  const zoomDragging = useRef(false)
  const zoomDragStart = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const fetchArtwork = async () => {
      try {
        setLoading(true)
        setError(null)
        setNotFound(false)
        setImageLoaded(false)

        const response = await fetch(`/api/g/${artist}/${gallery}/${collection}/${artwork}`)

        if (response.status === 404) {
          setNotFound(true)
          setLoading(false)
          return
        }

        if (!response.ok) {
          throw new Error('Failed to fetch artwork')
        }

        const result: ArtworkData = await response.json()
        setData(result)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
      } finally {
        setLoading(false)
      }
    }

    if (artist && gallery && collection && artwork) {
      fetchArtwork()
    }
  }, [artist, gallery, collection, artwork])

  // Zoom handlers
  const openZoom = () => {
    setZoomScale(1)
    setZoomPos({ x: 0, y: 0 })
    setShowZoom(true)
  }

  const handleZoomWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    setZoomScale((prev) => Math.min(5, Math.max(1, prev - e.deltaY * 0.002)))
  }, [])

  const handleZoomPointerDown = useCallback((e: React.PointerEvent) => {
    zoomDragging.current = true
    zoomDragStart.current = { x: e.clientX - zoomPos.x, y: e.clientY - zoomPos.y }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }, [zoomPos])

  const handleZoomPointerMove = useCallback((e: React.PointerEvent) => {
    if (!zoomDragging.current) return
    setZoomPos({
      x: e.clientX - zoomDragStart.current.x,
      y: e.clientY - zoomDragStart.current.y,
    })
  }, [])

  const handleZoomPointerUp = useCallback(() => {
    zoomDragging.current = false
  }, [])


  // Keyboard navigation for prev/next artwork
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!data) return
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return
      }

      if (e.key === 'Escape' && showZoom) {
        setShowZoom(false)
        return
      }

      if (showZoom) return // Don't navigate while zoomed

      if (e.key === 'ArrowLeft' && data.navigation.previous) {
        navigate(`/${artist}/${gallery}/${collection}/${data.navigation.previous.slug}`)
      } else if (e.key === 'ArrowRight' && data.navigation.next) {
        navigate(`/${artist}/${gallery}/${collection}/${data.navigation.next.slug}`)
      }
    },
    [data, artist, gallery, collection, navigate, showZoom]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // 404 state
  if (notFound) {
    return (
      <NotFoundState
        title="Artwork not found"
        message="The artwork you're looking for doesn't exist or has been removed."
        links={[
          { to: `/${artist}/${gallery}/${collection}`, label: 'Back to collection' },
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
          <div className="h-4 bg-gray-200 rounded w-64 mb-8"></div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 aspect-[4/3] bg-gray-200 rounded-lg"></div>
            <div className="space-y-4">
              <div className="h-8 bg-gray-200 rounded w-3/4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              <div className="h-20 bg-gray-200 rounded"></div>
              <div className="h-12 bg-gray-200 rounded"></div>
            </div>
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

  const { navigation } = data

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <SEOHead
        title={`${data.title} by ${data.artist.displayName}`}
        description={data.description || `Artwork by ${data.artist.displayName}`}
        image={data.displayUrl}
        imageAlt={data.title}
        path={`/${artist}/${gallery}/${collection}/${artwork}`}
        type="article"
        author={data.artist.displayName}
        publishedTime={data.createdAt}
      />
      {/* Breadcrumbs */}
      <nav className="text-sm text-gray-500 mb-8 flex items-center gap-2 flex-wrap">
        <Link to="/" className="hover:text-gray-700 transition">Home</Link>
        <span>/</span>
        <Link to={`/${artist}`} className="hover:text-gray-700 transition">{artist}</Link>
        <span>/</span>
        <Link to={`/${artist}/${gallery}`} className="hover:text-gray-700 transition">
          {data.parent.gallery.name}
        </Link>
        <span>/</span>
        <Link to={`/${artist}/${gallery}/${collection}`} className="hover:text-gray-700 transition">
          {data.parent.collection.name}
        </Link>
        <span>/</span>
        <span className="text-gray-900">{data.title}</span>
      </nav>

      {/* Main Content: Image + Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Artwork Image - 2/3 width on desktop */}
        <div className="lg:col-span-2">
          <div className="bg-gray-100 rounded-lg overflow-hidden">
            {!imageLoaded && (
              <div className="aspect-[4/3] animate-pulse bg-gray-200"></div>
            )}
            <img
              src={data.displayUrl}
              alt={data.title}
              className={`w-full h-auto cursor-zoom-in ${imageLoaded ? 'block' : 'hidden'}`}
              onLoad={() => setImageLoaded(true)}
              onClick={openZoom}
              loading="eager"
            />
          </div>
          {imageLoaded && (
            <button
              onClick={openZoom}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition mt-2"
            >
              <ZoomIn className="w-3 h-3" />
              Click image to zoom
            </button>
          )}
        </div>

        {/* Metadata Sidebar - 1/3 width on desktop */}
        <div className="lg:col-span-1 space-y-6">
          {/* Title + Description */}
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-1">{data.title}</h1>
            {data.description && (
              <p className="text-gray-600 mt-3 whitespace-pre-wrap">{data.description}</p>
            )}
          </div>

          {/* Artist Credit */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">Artist</h3>
            <Link
              to={`/${artist}`}
              className="flex items-center gap-3 hover:opacity-80 transition"
            >
              <Avatar src={data.artist.avatarUrl} name={data.artist.displayName || artist || ''} size="md" />
              <div>
                <p className="font-semibold text-gray-900">{data.artist.displayName}</p>
                <p className="text-sm text-gray-500">@{data.artist.username}</p>
              </div>
            </Link>
          </div>

          {/* Artwork Details */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">Details</h3>
            <dl className="space-y-2 text-sm">
              {data.materials && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Materials</dt>
                  <dd className="text-gray-900">{data.materials}</dd>
                </div>
              )}
              {data.dimensions && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Dimensions</dt>
                  <dd className="text-gray-900">{data.dimensions}</dd>
                </div>
              )}
              {data.createdDate && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Created</dt>
                  <dd className="text-gray-900">{data.createdDate}</dd>
                </div>
              )}
              {data.category && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Category</dt>
                  <dd className="text-gray-900 capitalize">{data.category}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Tags */}
          {data.tags.length > 0 && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">Tags</h3>
              <div className="flex flex-wrap gap-2">
                {data.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-1 bg-gray-200 text-gray-700 text-xs rounded-full"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Collection Info */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">Collection</h3>
            <Link
              to={`/${artist}/${gallery}/${collection}`}
              className="text-sm font-medium text-gray-900 hover:underline"
            >
              {data.parent.collection.name}
            </Link>
            <p className="text-xs text-gray-500 mt-1">
              in{' '}
              <Link
                to={`/${artist}/${gallery}`}
                className="hover:underline"
              >
                {data.parent.gallery.name}
              </Link>
            </p>
          </div>

          {/* Share */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">Share</h3>
            <ShareButtons
              url={typeof window !== 'undefined' ? window.location.href : ''}
              title={`${data.title} by ${data.artist.displayName}`}
              imageUrl={data.displayUrl}
            />
          </div>
        </div>
      </div>

      {/* Prev/Next Artwork Navigation */}
      <ItemNavigation
        previous={navigation.previous}
        next={navigation.next}
        basePath={`/${artist}/${gallery}/${collection}`}
        previousLabel="Previous"
        nextLabel="Next"
        keyboardHint="Use arrow keys to navigate between artworks"
      />

      {/* Zoom Modal */}
      {showZoom && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowZoom(false)
          }}
        >
          <button
            onClick={() => setShowZoom(false)}
            className="absolute top-4 right-4 text-white/70 hover:text-white transition z-10"
            aria-label="Close zoom"
          >
            <X className="w-8 h-8" />
          </button>
          <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/50 text-xs">
            Scroll to zoom · Drag to pan · Esc to close
          </p>
          <div
            className="overflow-hidden w-full h-full flex items-center justify-center"
            onWheel={handleZoomWheel}
            onPointerDown={handleZoomPointerDown}
            onPointerMove={handleZoomPointerMove}
            onPointerUp={handleZoomPointerUp}
            style={{ touchAction: 'none' }}
          >
            <img
              src={data.displayUrl}
              alt={data.title}
              className="max-w-none select-none"
              style={{
                transform: `translate(${zoomPos.x}px, ${zoomPos.y}px) scale(${zoomScale})`,
                cursor: zoomScale > 1 ? 'grab' : 'zoom-in',
              }}
              draggable={false}
            />
          </div>
        </div>
      )}
    </div>
  )
}
