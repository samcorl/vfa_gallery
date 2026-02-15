import { useParams, Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { ExternalLink } from 'lucide-react'
import ErrorState from '../components/ui/ErrorState'
import Pagination from '../components/ui/Pagination'
import Avatar from '../components/ui/Avatar'
import SEOHead from '../components/SEOHead'

type UserProfile = {
  username: string
  displayName: string
  avatarUrl: string | null
  bio: string | null
  website: string | null
  socials: Array<{
    platform: 'twitter' | 'instagram' | 'facebook' | 'linkedin' | 'github' | 'youtube' | 'tiktok' | 'website'
    url: string
    username: string
  }>
  galleriesCount: number
  artworksCount: number
  createdAt: string
}

type Gallery = {
  id: string
  slug: string
  name: string
  description: string | null
  welcomeMessage: string | null
  themeId: string | null
  collectionCount: number
}

type GalleriesResponse = {
  data: Gallery[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}

function getInitials(name: string | null, username: string): string {
  if (name) {
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
  }
  return username.slice(0, 2).toUpperCase()
}

function SocialIcon({ platform }: { platform: string }): JSX.Element {
  const icons: Record<string, string> = {
    twitter: 'X',
    instagram: 'IG',
    facebook: 'FB',
    linkedin: 'in',
    github: 'GH',
    youtube: 'YT',
    tiktok: 'TK',
    website: 'Web'
  }
  return <span className="text-xs font-semibold">{icons[platform] || platform}</span>
}

function SkeletonLoader(): JSX.Element {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Avatar skeleton */}
      <div className="flex flex-col items-center mb-8">
        <div className="w-24 h-24 rounded-full bg-gray-200 animate-pulse mb-4" />
        <div className="h-8 w-48 bg-gray-200 animate-pulse mb-2" />
        <div className="h-4 w-32 bg-gray-200 animate-pulse mb-4" />
        <div className="h-4 w-96 bg-gray-200 animate-pulse mb-4" />
      </div>
      {/* Gallery grid skeleton */}
      <div className="mt-12">
        <div className="h-8 w-32 bg-gray-200 animate-pulse mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-48 bg-gray-200 animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  )
}

export default function ArtistProfilePage() {
  const { artist } = useParams<{ artist: string }>()
  const [user, setUser] = useState<UserProfile | null>(null)
  const [galleries, setGalleries] = useState<Gallery[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [pagination, setPagination] = useState({ page: 1, pageSize: 12, total: 0, totalPages: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!artist) return

    const fetchUserProfile = async () => {
      try {
        const response = await fetch(`/api/users/${artist}`)
        if (response.status === 404) {
          setError('not-found')
          setLoading(false)
          return
        }
        if (!response.ok) throw new Error('Failed to fetch user')
        const data: UserProfile = await response.json()
        setUser(data)
      } catch {
        setError('error')
      }
    }

    fetchUserProfile()
  }, [artist])

  useEffect(() => {
    if (!user) return

    const fetchGalleries = async () => {
      try {
        const response = await fetch(`/api/users/${user.username}/galleries?page=${currentPage}&pageSize=12`)
        if (!response.ok) throw new Error('Failed to fetch galleries')
        const data: GalleriesResponse = await response.json()
        setGalleries(data.data)
        setPagination(data.pagination)
        setLoading(false)
      } catch {
        setError('error')
        setLoading(false)
      }
    }

    fetchGalleries()
  }, [user, currentPage])

  if (loading) return <SkeletonLoader />

  if (error === 'not-found') {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Artist not found</h1>
        <p className="text-gray-600 mb-6">The artist you're looking for doesn't exist.</p>
        <Link to="/" className="text-gray-900 hover:text-gray-700 font-semibold">
          Return to home
        </Link>
      </div>
    )
  }

  if (error === 'error' || !user) {
    return <ErrorState error="We couldn't load the artist profile." onRetry={() => window.location.reload()} />
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <SEOHead
        title={user.displayName || user.username}
        description={user.bio || `View artworks by ${user.displayName || user.username}`}
        image={user.avatarUrl || undefined}
        imageAlt={user.displayName || user.username}
        path={`/${artist}`}
        type="profile"
      />
      {/* Hero Section */}
      <div className="flex flex-col items-center mb-12">
        {/* Avatar */}
        <Avatar src={user.avatarUrl} name={user.displayName || user.username} size="xl" className="mb-6" />

        {/* Display Name */}
        <h1 className="text-3xl font-bold text-gray-900">{user.displayName}</h1>

        {/* Username */}
        <p className="text-gray-500 mt-1">@{user.username}</p>

        {/* Bio */}
        {user.bio && <p className="text-gray-600 mt-4 text-center max-w-2xl">{user.bio}</p>}

        {/* Website Link */}
        {user.website && (
          <a
            href={user.website}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-gray-500 hover:text-gray-900 mt-3 flex items-center gap-1 transition"
          >
            {user.website.replace(/^https?:\/\//, '')}
            <ExternalLink className="w-3 h-3" />
          </a>
        )}

        {/* Stats */}
        <p className="text-sm text-gray-500 mt-4">
          {user.galleriesCount} {user.galleriesCount === 1 ? 'gallery' : 'galleries'} · {user.artworksCount} {user.artworksCount === 1 ? 'artwork' : 'artworks'}
        </p>

        {/* Social Links */}
        {user.socials.length > 0 && (
          <div className="flex gap-2 mt-6 flex-wrap justify-center">
            {user.socials.map((social) => (
              <a
                key={`${social.platform}-${social.username}`}
                href={social.url}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1 rounded-full text-sm font-semibold transition"
              >
                <SocialIcon platform={social.platform} />
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Galleries Section */}
      <div className="mt-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Galleries</h2>

        {galleries.length === 0 ? (
          <p className="text-gray-500 text-center py-12">No public galleries yet</p>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {galleries.map((gallery) => (
                <Link
                  key={gallery.id}
                  to={`/${artist}/${gallery.slug}`}
                  className="rounded-lg border border-gray-200 bg-white p-5 hover:shadow-md transition"
                >
                  <h3 className="font-semibold text-gray-900">{gallery.name}</h3>
                  {gallery.description && (
                    <p className="text-sm text-gray-500 line-clamp-2 mt-1">{gallery.description}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-3">
                    {gallery.collectionCount} {gallery.collectionCount === 1 ? 'collection' : 'collections'}
                  </p>
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
    </div>
  )
}
