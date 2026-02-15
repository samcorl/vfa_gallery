import type { Artwork } from '../../types/artwork'
import { ArtworkCard } from './ArtworkCard'
import { ArtworkSkeleton } from './ArtworkSkeleton'

interface ArtworkGridProps {
  artworks: Artwork[]
  onSelect?: (artwork: Artwork) => void
  showStatus?: boolean
  loading?: boolean
  emptyMessage?: string
}

export function ArtworkGrid({
  artworks,
  onSelect,
  showStatus = false,
  loading = false,
  emptyMessage = 'No artworks found',
}: ArtworkGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <ArtworkSkeleton key={i} />
        ))}
      </div>
    )
  }

  if (!artworks || artworks.length === 0) {
    return (
      <div className="w-full py-16 text-center">
        <p className="text-gray-400">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {artworks.map((artwork) => (
        <ArtworkCard
          key={artwork.id}
          artwork={artwork}
          showStatus={showStatus}
          onClick={onSelect}
        />
      ))}
    </div>
  )
}
