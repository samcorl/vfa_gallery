import { useState } from 'react'

export interface GalleryFormData {
  name: string
  description: string
  welcomeMessage: string
}

interface GalleryFormProps {
  initialData?: Partial<GalleryFormData>
  onSubmit: (data: GalleryFormData) => Promise<void>
  onCancel?: () => void
  submitLabel?: string
  isLoading?: boolean
}

export default function GalleryForm({
  initialData,
  onSubmit,
  onCancel,
  submitLabel = 'Save',
  isLoading: externalLoading = false,
}: GalleryFormProps) {
  const [name, setName] = useState(initialData?.name || '')
  const [description, setDescription] = useState(initialData?.description || '')
  const [welcomeMessage, setWelcomeMessage] = useState(
    initialData?.welcomeMessage || ''
  )
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const isSubmitting = isLoading || externalLoading

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Client-side validation
    if (!name.trim()) {
      setError('Gallery name is required')
      return
    }

    setIsLoading(true)
    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim(),
        welcomeMessage: welcomeMessage.trim(),
      })
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'An error occurred while saving'
      )
      setIsLoading(false)
    }
  }

  const fieldDisabled = isSubmitting

  return (
    <form onSubmit={handleSubmit} className="w-full">
      {/* Name Field */}
      <div className="space-y-6">
        <div>
          <label
            htmlFor="name"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Gallery Name
          </label>
          <input
            id="name"
            type="text"
            maxLength={200}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Spring Collection 2024"
            disabled={fieldDisabled}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-900 disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed"
          />
          <div className="flex justify-end mt-1">
            <span className="text-xs text-gray-400">
              {name.length}/200
            </span>
          </div>
        </div>

        {/* Description Field */}
        <div>
          <label
            htmlFor="description"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Description
          </label>
          <textarea
            id="description"
            maxLength={2000}
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Tell visitors about this gallery..."
            disabled={fieldDisabled}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-900 disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed resize-none"
          />
          <div className="flex justify-end mt-1">
            <span className="text-xs text-gray-400">
              {description.length}/2000
            </span>
          </div>
        </div>

        {/* Welcome Message Field */}
        <div>
          <label
            htmlFor="welcomeMessage"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Welcome Message
          </label>
          <textarea
            id="welcomeMessage"
            maxLength={2000}
            rows={3}
            value={welcomeMessage}
            onChange={(e) => setWelcomeMessage(e.target.value)}
            placeholder="Welcome your visitors..."
            disabled={fieldDisabled}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-900 disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed resize-none"
          />
          <div className="flex items-center justify-between mt-1">
            <span className="text-xs text-gray-500">
              Displayed at the top of your gallery page
            </span>
            <span className="text-xs text-gray-400">
              {welcomeMessage.length}/2000
            </span>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Button Row */}
        <div className="flex gap-3 pt-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={fieldDisabled}
              className="flex-1 px-4 py-2 border border-gray-900 rounded-lg text-gray-900 font-medium hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-0 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={fieldDisabled}
            className="flex-1 px-4 py-2 bg-gray-900 rounded-lg text-white font-medium hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-0 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? 'Saving...' : submitLabel}
          </button>
        </div>
      </div>
    </form>
  )
}
