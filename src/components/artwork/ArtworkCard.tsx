import { useState } from 'react'
import type { Artwork } from '../../types/artwork'

interface ArtworkCardProps {
  artwork: Artwork
  showArtist?: boolean
  showStatus?: boolean
  onClick?: (artwork: Artwork) => void
}

export function ArtworkCard({
  artwork,
  showArtist = false,
  showStatus = false,
  onClick,
}: ArtworkCardProps) {
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)

  const handleClick = () => onClick?.(artwork)

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ' ') && onClick) {
      e.preventDefault()
      onClick(artwork)
    }
  }

  return (
    <div
      className={`relative group overflow-hidden rounded-lg bg-gray-100 ${onClick ? 'cursor-pointer' : ''}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={onClick ? 0 : undefined}
      role={onClick ? 'button' : undefined}
      aria-label={`Artwork: ${artwork.title}`}
    >
      <div className="w-full aspect-square overflow-hidden">
        {/* Image */}
        <img
          src={artwork.thumbnailUrl}
          alt={artwork.title}
          loading="lazy"
          decoding="async"
          className={`w-full h-full object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
        />

        {/* Loading placeholder */}
        {!loaded && !error && (
          <div className="absolute inset-0 bg-gray-200 animate-pulse" />
        )}

        {/* Error state */}
        {error && (
          <div className="absolute inset-0 bg-gray-200 flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
              <path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" />
            </svg>
          </div>
        )}

        {/* Hover overlay (desktop) */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-end p-3">
          <h3 className="text-white font-semibold text-sm line-clamp-2">{artwork.title}</h3>
        </div>

        {/* Mobile: always-visible title */}
        <div className="sm:hidden absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-2">
          <h3 className="text-white font-semibold text-xs line-clamp-1">{artwork.title}</h3>
        </div>

        {/* Status badge */}
        {showStatus && artwork.status !== 'active' && (
          <div className="absolute top-2 right-2">
            <span className={`px-2 py-0.5 text-xs font-medium rounded text-white ${
              artwork.status === 'draft' ? 'bg-gray-500' : 'bg-red-500'
            }`}>
              {artwork.status === 'draft' ? 'Draft' : 'Deleted'}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
