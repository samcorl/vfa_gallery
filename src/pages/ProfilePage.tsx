import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { ProfileAvatar } from '../components/profile/ProfileAvatar'
import { SocialLinks } from '../components/profile/SocialLinks'
import { ProfileStats } from '../components/profile/ProfileStats'

export default function ProfilePage() {
  const { user, isLoading } = useAuth()
  const navigate = useNavigate()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-12 h-12 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-yellow-800">
          Please log in to view your profile.
        </div>
      </div>
    )
  }

  const joinedDate = new Date(user.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row gap-6 mb-6">
          <ProfileAvatar user={user} size="xl" />
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900">{user.displayName || user.username}</h1>
            <p className="text-gray-600 text-lg">@{user.username}</p>

            {user.bio && <p className="text-gray-700 mt-3">{user.bio}</p>}

            <div className="flex flex-wrap gap-4 mt-4">
              {user.website && (
                <a
                  href={user.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:text-blue-600"
                >
                  {user.website}
                </a>
              )}
              {user.phone && <span className="text-gray-600">{user.phone}</span>}
              <span className="text-gray-500 text-sm">Joined {joinedDate}</span>
            </div>
          </div>

          <button
            onClick={() => navigate('/profile/edit')}
            className="self-start py-2 px-6 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors"
          >
            Edit Profile
          </button>
        </div>

        {/* Social Links */}
        {user.socials && user.socials.length > 0 && (
          <div className="mb-6">
            <SocialLinks socials={user.socials} />
          </div>
        )}
      </div>

      <hr className="border-gray-200 mb-8" />

      {/* Stats */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Resource Limits</h2>
        <ProfileStats user={user} />
      </div>

      {/* Account Info */}
      <div className="bg-gray-50 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Account Information</h2>
        <div className="space-y-3">
          <div>
            <p className="text-sm text-gray-600">Email</p>
            <p className="text-gray-900 font-medium">{user.email}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Status</p>
            <p className="text-gray-900 font-medium capitalize">{user.status}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Role</p>
            <p className="text-gray-900 font-medium capitalize">{user.role}</p>
          </div>
          {user.lastLoginAt && (
            <div>
              <p className="text-sm text-gray-600">Last Login</p>
              <p className="text-gray-900 font-medium">
                {new Date(user.lastLoginAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
