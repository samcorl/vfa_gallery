import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import ThemePreview from './ThemePreview'

interface Theme {
  id: string
  name: string
  styles: Record<string, string>
  isSystem?: boolean
}

interface ThemePickerProps {
  open: boolean
  onClose: () => void
  currentThemeId: string | null
  onSelect: (themeId: string | null) => void
}

type TabType = 'system' | 'community' | 'mine'

export default function ThemePicker({
  open,
  onClose,
  currentThemeId,
  onSelect,
}: ThemePickerProps) {
  const { isAuthenticated } = useAuth()
  const [activeTab, setActiveTab] = useState<TabType>('system')
  const [themes, setThemes] = useState<Theme[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fetchKey, setFetchKey] = useState(0)

  // Fetch themes based on active tab
  useEffect(() => {
    if (!open) return

    const fetchThemes = async () => {
      setLoading(true)
      setError(null)
      try {
        let endpoint = '/api/themes'
        let params = ''

        if (activeTab === 'system') {
          params = '?sort=name'
        } else if (activeTab === 'community') {
          params = '?sort=popularity'
        } else if (activeTab === 'mine') {
          endpoint = '/api/themes/mine'
        }

        const response = await fetch(endpoint + params, {
          credentials: 'include',
        })

        if (!response.ok) {
          throw new Error(`Failed to load themes: ${response.statusText}`)
        }

        const json = await response.json()
        let fetchedThemes = json.data || []

        // Client-side filtering for system/community tabs if needed
        if (activeTab === 'system') {
          fetchedThemes = fetchedThemes.filter((t: Theme) => t.isSystem !== false)
        } else if (activeTab === 'community') {
          fetchedThemes = fetchedThemes.filter((t: Theme) => !t.isSystem)
        }

        setThemes(fetchedThemes)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load themes')
        setThemes([])
      } finally {
        setLoading(false)
      }
    }

    fetchThemes()
  }, [open, activeTab, fetchKey])

  if (!open) return null

  const handleSelectTheme = (themeId: string) => {
    onSelect(themeId)
    onClose()
  }

  const handleRemoveTheme = () => {
    onSelect(null)
    onClose()
  }

  const tabs = [
    { id: 'system' as TabType, label: 'System' },
    { id: 'community' as TabType, label: 'Community' },
    ...(isAuthenticated ? [{ id: 'mine' as TabType, label: 'My Themes' }] : []),
  ]

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto shadow-lg">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white">
          <h2 className="text-xl font-semibold text-gray-900">Choose Theme</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors"
            aria-label="Close"
          >
            <X size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 px-6">
          <div className="flex gap-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id)
                  setError(null)
                }}
                className={`py-3 font-medium transition-colors relative ${
                  activeTab === tab.id
                    ? 'text-gray-900 border-b-2 border-gray-800'
                    : 'text-gray-600 hover:text-gray-800 border-b-2 border-transparent'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Remove Theme Button */}
          <div className="mb-6">
            <button
              onClick={handleRemoveTheme}
              className="w-full p-4 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-gray-400 hover:text-gray-700 transition-colors font-medium text-sm"
            >
              Remove Theme
            </button>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="text-center py-12 text-gray-500">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-800"></div>
              <p className="mt-3">Loading...</p>
            </div>
          )}

          {/* Error State */}
          {error && !loading && (
            <div className="text-center py-12">
              <p className="text-gray-600 mb-4">{error}</p>
              <button
                onClick={() => {
                  setError(null)
                  setFetchKey((k) => k + 1)
                }}
                className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium text-sm"
              >
                Retry
              </button>
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && themes.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-600">No themes found</p>
            </div>
          )}

          {/* Themes Grid */}
          {!loading && !error && themes.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {themes.map((theme) => (
                <ThemePreview
                  key={theme.id}
                  styles={theme.styles}
                  name={theme.name}
                  size="md"
                  selected={theme.id === currentThemeId}
                  onClick={() => handleSelectTheme(theme.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
