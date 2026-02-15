import { useState } from 'react'
import { useToast } from '../../contexts/ToastContext'
import { validateProfileUpdate } from '../../lib/validation/users'
import type { UserProfileResponse, UserSocial } from '../../types/user'
import { SocialsEditor } from './SocialsEditor'
import { AvatarUpload } from './AvatarUpload'

interface ProfileFormProps {
  user: UserProfileResponse
  onSave: (updatedUser: UserProfileResponse) => void
  isLoading?: boolean
}

export function ProfileForm({ user, onSave, isLoading = false }: ProfileFormProps) {
  const [displayName, setDisplayName] = useState(user.displayName || '')
  const [bio, setBio] = useState(user.bio || '')
  const [website, setWebsite] = useState(user.website || '')
  const [phone, setPhone] = useState(user.phone || '')
  const [socials, setSocials] = useState<UserSocial[]>(user.socials || [])
  const [isSaving, setIsSaving] = useState(false)
  const toast = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const data = {
      displayName: displayName || null,
      bio: bio || null,
      website: website || null,
      phone: phone || null,
      socials,
    }

    // Validate
    const errors = validateProfileUpdate(data)
    if (errors.length > 0) {
      errors.forEach((error) => {
        toast.error(`${error.field}: ${error.message}`)
      })
      return
    }

    setIsSaving(true)
    try {
      const response = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error?.message || 'Save failed')
      }

      const result = await response.json()
      onSave(result.user)
      toast.success('Profile updated successfully')
    } catch (error) {
      console.error('Profile save error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to save profile')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Avatar Upload */}
      <AvatarUpload user={user} onSuccess={onSave} />

      <hr className="border-gray-200" />

      {/* Basic Info */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Basic Information</h3>

        <div>
          <label htmlFor="displayName" className="block text-sm font-medium text-gray-700 mb-1">
            Display Name
          </label>
          <input
            id="displayName"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={100}
            placeholder="Your display name"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isSaving || isLoading}
          />
          <p className="text-xs text-gray-500 mt-1">{displayName.length} / 100</p>
        </div>

        <div>
          <label htmlFor="bio" className="block text-sm font-medium text-gray-700 mb-1">
            Bio
          </label>
          <textarea
            id="bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={500}
            placeholder="Tell us about yourself..."
            rows={4}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            disabled={isSaving || isLoading}
          />
          <p className="text-xs text-gray-500 mt-1">{bio.length} / 500</p>
        </div>

        <div>
          <label htmlFor="website" className="block text-sm font-medium text-gray-700 mb-1">
            Website
          </label>
          <input
            id="website"
            type="url"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="https://example.com"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isSaving || isLoading}
          />
        </div>

        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
            Phone
          </label>
          <input
            id="phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Your phone number"
            maxLength={20}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isSaving || isLoading}
          />
        </div>
      </div>

      <hr className="border-gray-200" />

      {/* Social Media */}
      <SocialsEditor socials={socials} onChange={setSocials} />

      {/* Submit Button */}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isSaving || isLoading}
          className="flex-1 py-2 px-4 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors"
        >
          {isSaving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </form>
  )
}
