import type { Gallery } from '../../types/gallery'

interface GalleryCardProps {
  gallery: Gallery
  onClick?: (gallery: Gallery) => void
}

function formatRelativeTime(dateString: string): string {
  const now = new Date()
  const date = new Date(dateString)
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 30) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

function getGradientFromId(id: string): string {
  const hash = id.charCodeAt(0) % 6
  const gradients = [
    'from-gray-200 to-gray-300',
    'from-gray-100 to-gray-200',
    'from-gray-300 to-gray-400',
    'from-gray-50 to-gray-100',
    'from-gray-200 to-gray-400',
    'from-gray-150 to-gray-250',
  ]
  return gradients[hash]
}

export default function GalleryCard({
  gallery,
  onClick,
}: GalleryCardProps) {
  const gradient = getGradientFromId(gallery.id)

  const handleClick = () => {
    if (onClick) {
      onClick(gallery)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ' ') && onClick) {
      e.preventDefault()
      onClick(gallery)
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className="border border-gray-100 rounded-lg overflow-hidden hover:shadow-md hover:border-gray-300 transition-all cursor-pointer"
    >
      {/* Top Section - Gradient Placeholder */}
      <div className={`aspect-square bg-gradient-to-br ${gradient}`} />

      {/* Content Section */}
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 truncate">
          {gallery.name}
        </h3>
        <p className="text-sm text-gray-500">
          {gallery.collectionCount} collection{gallery.collectionCount !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Footer */}
      <div className="border-t border-gray-100 px-4 py-3 flex items-center justify-between">
        <span className="text-xs text-gray-400">
          {formatRelativeTime(gallery.updatedAt)}
        </span>
        {gallery.isDefault && (
          <span className="bg-gray-900 text-white rounded-full px-2 py-0.5 text-xs">
            Default
          </span>
        )}
      </div>
    </div>
  )
}
