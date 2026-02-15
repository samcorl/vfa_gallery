import { useAuth } from '../contexts/AuthContext'
import { ProfileForm } from '../components/profile/ProfileForm'

export default function ProfileEditPage() {
  const { user, isLoading } = useAuth()

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
          Please log in to edit your profile.
        </div>
      </div>
    )
  }

  const handleSave = () => {
    // Update user in auth context by refetching
    // The actual user update happens in the API call
    window.location.href = '/profile'
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Edit Profile</h1>
        <p className="text-gray-600">Update your profile information and manage your social media links.</p>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <ProfileForm user={user} onSave={handleSave} isLoading={isLoading} />
      </div>
    </div>
  )
}
