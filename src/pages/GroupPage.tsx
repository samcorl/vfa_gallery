import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import Avatar from '../components/ui/Avatar'
import { Globe, Mail, Phone, Users, Settings, LogOut, AlertCircle, Loader2 } from 'lucide-react'

interface Member {
  userId: string
  username: string
  displayName: string
  avatarUrl: string
  role: 'member' | 'manager' | 'owner'
  joinedAt: string
}

interface GroupData {
  id: string
  slug: string
  name: string
  website?: string
  email?: string
  phone?: string
  socials?: Record<string, string>
  logoUrl?: string
  createdBy: string
  createdAt: string
  updatedAt: string
  members: Member[]
  memberCount: number
  userRole?: 'member' | 'manager' | 'owner' | null
}

export default function GroupPage() {
  const { slug } = useParams<{ slug: string }>()
  const { isAuthenticated } = useAuth()
  const [group, setGroup] = useState<GroupData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [showAllMembers, setShowAllMembers] = useState(false)

  useEffect(() => {
    const fetchGroup = async () => {
      if (!slug) return

      try {
        setLoading(true)
        setError(null)
        setNotFound(false)

        const response = await fetch(`/api/groups/${slug}`, {
          credentials: 'include',
        })

        if (response.status === 404) {
          setNotFound(true)
          setLoading(false)
          return
        }

        if (!response.ok) {
          throw new Error('Failed to fetch group')
        }

        const data = await response.json()
        setGroup(data.data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
      } finally {
        setLoading(false)
      }
    }

    fetchGroup()
  }, [slug])

  const handleJoinGroup = async () => {
    if (!group || !isAuthenticated) return

    try {
      setActionLoading(true)
      const response = await fetch(`/api/groups/${group.id}/join`, {
        method: 'POST',
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to join group')
      }

      // Refetch group data
      const fetchResponse = await fetch(`/api/groups/${slug}`, {
        credentials: 'include',
      })
      if (fetchResponse.ok) {
        const data = await fetchResponse.json()
        setGroup(data.data)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join group')
    } finally {
      setActionLoading(false)
    }
  }

  const handleLeaveGroup = async () => {
    if (!group || !isAuthenticated) return

    if (!window.confirm('Are you sure you want to leave this group?')) {
      return
    }

    try {
      setActionLoading(true)
      const response = await fetch(`/api/groups/${group.id}/leave`, {
        method: 'POST',
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to leave group')
      }

      // Refetch group data
      const fetchResponse = await fetch(`/api/groups/${slug}`, {
        credentials: 'include',
      })
      if (fetchResponse.ok) {
        const data = await fetchResponse.json()
        setGroup(data.data)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to leave group')
    } finally {
      setActionLoading(false)
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12">
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
        </div>
      </div>
    )
  }

  // Not found state
  if (notFound) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12">
        <div className="flex flex-col items-center justify-center min-h-screen gap-4">
          <AlertCircle className="w-12 h-12 text-gray-400" />
          <h1 className="text-2xl font-bold text-gray-900">Group not found</h1>
          <p className="text-gray-600">The group you're looking for doesn't exist or has been removed.</p>
          <Link to="/groups" className="text-blue-600 hover:underline mt-4">
            Back to Groups
          </Link>
        </div>
      </div>
    )
  }

  // Error state
  if (error && !group) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12">
        <div className="flex flex-col items-center justify-center min-h-screen gap-4">
          <AlertCircle className="w-12 h-12 text-red-400" />
          <h1 className="text-2xl font-bold text-gray-900">Error</h1>
          <p className="text-gray-600">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition"
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  if (!group) return null

  const displayedMembers = showAllMembers ? group.members : group.members.slice(0, 6)
  const isMember = group.userRole !== null && group.userRole !== undefined
  const isOwnerOrManager = group.userRole === 'owner' || group.userRole === 'manager'

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      {/* Header with logo and title */}
      <div className="flex items-start gap-6 mb-12">
        {group.logoUrl && (
          <img
            src={group.logoUrl}
            alt={group.name}
            className="w-24 h-24 rounded-lg object-cover bg-gray-100"
          />
        )}
        <div className="flex-1">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">{group.name}</h1>
          <p className="text-gray-500 mb-6">
            <Users className="inline w-4 h-4 mr-1" />
            {group.memberCount} member{group.memberCount !== 1 ? 's' : ''}
          </p>

          {/* Action buttons */}
          {isAuthenticated && (
            <div className="flex items-center gap-3">
              {isMember && !isOwnerOrManager && (
                <button
                  onClick={handleLeaveGroup}
                  disabled={actionLoading}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  <LogOut className="w-4 h-4" />
                  Leave Group
                </button>
              )}
              {!isMember && (
                <button
                  onClick={handleJoinGroup}
                  disabled={actionLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Join Group'}
                </button>
              )}
              {isOwnerOrManager && (
                <Link
                  to={`/groups/${slug}/manage`}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition"
                >
                  <Settings className="w-4 h-4" />
                  Manage Group
                </Link>
              )}
            </div>
          )}

          {!isAuthenticated && (
            <p className="text-sm text-gray-500">
              <Link to="/login" className="text-blue-600 hover:underline">
                Sign in
              </Link>
              {' '}to join this group
            </p>
          )}
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Contact section */}
      {(group.website || group.email || group.phone) && (
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Contact</h2>
          <div className="space-y-3">
            {group.website && (
              <div className="flex items-center gap-3">
                <Globe className="w-5 h-5 text-gray-400 flex-shrink-0" />
                <a
                  href={group.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline break-all"
                >
                  {group.website}
                </a>
              </div>
            )}
            {group.email && (
              <div className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-gray-400 flex-shrink-0" />
                <a href={`mailto:${group.email}`} className="text-blue-600 hover:underline">
                  {group.email}
                </a>
              </div>
            )}
            {group.phone && (
              <div className="flex items-center gap-3">
                <Phone className="w-5 h-5 text-gray-400 flex-shrink-0" />
                <a href={`tel:${group.phone}`} className="text-blue-600 hover:underline">
                  {group.phone}
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Socials section */}
      {group.socials && Object.keys(group.socials).length > 0 && (
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Follow</h2>
          <div className="space-y-2">
            {group.socials.twitter && (
              <div>
                <a
                  href={`https://twitter.com/${group.socials.twitter}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  Twitter: @{group.socials.twitter}
                </a>
              </div>
            )}
            {group.socials.instagram && (
              <div>
                <a
                  href={`https://instagram.com/${group.socials.instagram}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  Instagram: @{group.socials.instagram}
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Members section */}
      <div className="mb-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">
          Members{' '}
          <span className="text-lg font-normal text-gray-500">({group.memberCount})</span>
        </h2>

        {group.members.length === 0 ? (
          <p className="text-gray-500">No members yet</p>
        ) : (
          <>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-4 mb-6">
              {displayedMembers.map((member) => (
                <Link
                  key={member.userId}
                  to={`/${member.username}`}
                  className="flex flex-col items-center gap-2 group"
                >
                  <div className="relative">
                    <Avatar src={member.avatarUrl} name={member.displayName} size="lg" />
                    {(member.role === 'owner' || member.role === 'manager') && (
                      <span className="absolute -bottom-1 -right-1 text-xs font-semibold px-2 py-1 rounded bg-gray-800 text-white">
                        {member.role === 'owner' ? 'Owner' : 'Mgr'}
                      </span>
                    )}
                  </div>
                  <span className="text-sm text-gray-900 group-hover:underline text-center line-clamp-2">
                    {member.displayName}
                  </span>
                </Link>
              ))}
            </div>

            {!showAllMembers && group.members.length > 6 && (
              <button
                onClick={() => setShowAllMembers(true)}
                className="text-blue-600 hover:underline text-sm font-medium"
              >
                View all {group.memberCount} members
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
