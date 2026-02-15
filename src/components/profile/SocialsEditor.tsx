import { useState } from 'react'
import { X, Plus } from 'lucide-react'
import { useToast } from '../../contexts/ToastContext'
import { validateSocialUsername, SOCIAL_PLATFORMS } from '../../lib/socials'
import type { UserSocial } from '../../types/user'

interface SocialsEditorProps {
  socials: UserSocial[]
  onChange: (socials: UserSocial[]) => void
}

export function SocialsEditor({ socials, onChange }: SocialsEditorProps) {
  const [newPlatform, setNewPlatform] = useState<UserSocial['platform']>('twitter')
  const [newUrl, setNewUrl] = useState('')
  const toast = useToast()

  const addSocial = () => {
    if (!newUrl.trim()) {
      toast.error('Please enter a URL')
      return
    }

    // Check if platform already exists
    if (socials.some((s) => s.platform === newPlatform)) {
      toast.error(`${SOCIAL_PLATFORMS[newPlatform].name} already added`)
      return
    }

    // Validate URL
    if (!validateSocialUsername(newUrl, newPlatform)) {
      toast.error(`Invalid ${SOCIAL_PLATFORMS[newPlatform].name} URL`)
      return
    }

    const newSocial: UserSocial = {
      platform: newPlatform,
      url: newUrl.startsWith('http')
        ? newUrl
        : `https://${newPlatform === 'website' ? '' : SOCIAL_PLATFORMS[newPlatform].baseUrl}/${newUrl}`.replace(
          /\/\/+/g,
          '/',
        ),
      username: newPlatform === 'website' ? undefined : newUrl.replace(/^@/, ''),
    }

    onChange([...socials, newSocial])
    setNewUrl('')
    toast.success('Social link added')
  }

  const removeSocial = (platform: UserSocial['platform']) => {
    onChange(socials.filter((s) => s.platform !== platform))
    toast.info('Social link removed')
  }

  const availablePlatforms = Object.entries(SOCIAL_PLATFORMS)
    .filter(([key]) => !socials.find((s) => s.platform === key))
    .map(([key]) => key as UserSocial['platform'])

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">Social Media Links</h3>

      {/* Existing socials */}
      {socials.length > 0 && (
        <div className="space-y-2">
          {socials.map((social) => (
            <div
              key={social.platform}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
            >
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {SOCIAL_PLATFORMS[social.platform].name}
                </p>
                <p className="text-xs text-gray-500 truncate">{social.url}</p>
              </div>
              <button
                type="button"
                onClick={() => removeSocial(social.platform)}
                className="text-gray-400 hover:text-red-500 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add new social */}
      {availablePlatforms.length > 0 && (
        <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Platform</label>
            <select
              value={newPlatform}
              onChange={(e) => setNewPlatform(e.target.value as UserSocial['platform'])}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {availablePlatforms.map((platform) => (
                <option key={platform} value={platform}>
                  {SOCIAL_PLATFORMS[platform].name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              {SOCIAL_PLATFORMS[newPlatform].name} URL
            </label>
            <input
              type="text"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  addSocial()
                }
              }}
              placeholder={`e.g., ${
                newPlatform === 'website' ? 'https://example.com' : `@username`
              }`}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            type="button"
            onClick={addSocial}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Link
          </button>
        </div>
      )}

      {availablePlatforms.length === 0 && socials.length > 0 && (
        <p className="text-sm text-gray-500">All platforms added</p>
      )}
    </div>
  )
}
