import { Link } from 'react-router-dom'
import { useEffect, useState, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import Avatar from '../components/ui/Avatar'
import ArtworkGridItem from '../components/ui/ArtworkGridItem'
import SEOHead from '../components/SEOHead'
import FooterAd from '../components/ads/FooterAd'

interface FeaturedArtist {
  id: string
  username: string
  displayName: string | null
  avatarUrl: string | null
  artworkCount: number
}

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

export default function HomePage() {
  const { isAuthenticated, user, login } = useAuth()
  const [featuredArtists, setFeaturedArtists] = useState<FeaturedArtist[]>([])
  const [recentArtworks, setRecentArtworks] = useState<BrowseArtwork[]>([])
  const [loading, setLoading] = useState(true)
  const carouselRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [featuredRes, recentRes] = await Promise.all([
          fetch('/api/browse/featured'),
          fetch('/api/browse/recent?limit=12'),
        ])

        if (featuredRes.ok) {
          const featured = await featuredRes.json()
          setFeaturedArtists(featured.artists || [])
        }

        if (recentRes.ok) {
          const recent = await recentRes.json()
          setRecentArtworks(recent.data || [])
        }
      } catch {
        // Silently fail — homepage still renders
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  const scrollCarousel = (direction: 'left' | 'right') => {
    if (!carouselRef.current) return
    const scrollAmount = 260
    carouselRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    })
  }

  return (
    <div>
      <SEOHead
        title="VFA.gallery - Virtual Fine Art Gallery"
        description="A free online gallery platform for artists and schools to showcase and share artwork."
        path="/"
      />
      {/* Hero Section */}
      <div className="bg-gray-900 text-white">
        <div className="max-w-7xl mx-auto px-4 py-20 text-center">
          <h1 className="text-5xl font-bold mb-4">Virtual Fine Art Gallery</h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto mb-8">
            A free online gallery platform for artists and schools to showcase and share artwork.
          </p>
          {isAuthenticated ? (
            <div className="flex items-center justify-center gap-4">
              <span className="text-gray-300">
                Welcome back, {user?.displayName || user?.username}
              </span>
              <Link
                to="/profile/galleries"
                className="px-6 py-3 bg-white text-gray-900 rounded-lg font-semibold hover:bg-gray-100 transition"
              >
                My Galleries
              </Link>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={login}
                className="px-6 py-3 bg-white text-gray-900 rounded-lg font-semibold hover:bg-gray-100 transition"
              >
                Sign in with Google
              </button>
              <Link
                to="/browse"
                className="px-6 py-3 border border-gray-500 text-white rounded-lg font-semibold hover:bg-gray-800 transition"
              >
                Browse Art
              </Link>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Featured Artists Carousel */}
        {featuredArtists.length > 0 && (
          <section className="mb-16">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Featured Artists</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => scrollCarousel('left')}
                  className="p-2 rounded-full border border-gray-300 text-gray-600 hover:bg-gray-50 transition"
                  aria-label="Scroll left"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => scrollCarousel('right')}
                  className="p-2 rounded-full border border-gray-300 text-gray-600 hover:bg-gray-50 transition"
                  aria-label="Scroll right"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div
              ref={carouselRef}
              className="flex gap-4 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-2"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {featuredArtists.map((artist) => (
                <Link
                  key={artist.id}
                  to={`/${artist.username}`}
                  className="flex-shrink-0 w-56 snap-start rounded-lg border border-gray-200 bg-white p-4 hover:shadow-md transition text-center"
                >
                  <Avatar src={artist.avatarUrl} name={artist.displayName || artist.username} size="lg" className="mx-auto mb-3" />
                  <p className="font-semibold text-gray-900 truncate">
                    {artist.displayName || artist.username}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {artist.artworkCount} artwork{artist.artworkCount !== 1 ? 's' : ''}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Recent Artworks */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Recent Artworks</h2>
            <Link
              to="/browse"
              className="text-sm text-gray-500 hover:text-gray-900 transition font-medium"
            >
              View all
            </Link>
          </div>

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
          ) : recentArtworks.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <p>No artworks yet. Be the first to share your art!</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {recentArtworks.map((artwork) => (
                <ArtworkGridItem key={artwork.id} artwork={artwork} linkTo="/browse" />
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Footer Ad */}
      <FooterAd className="max-w-7xl mx-auto px-4" />
    </div>
  )
}
