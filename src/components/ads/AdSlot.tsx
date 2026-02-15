type AdSlotSize = 'banner' | 'rectangle' | 'leaderboard'

const AD_DIMENSIONS: Record<AdSlotSize, { width: number; height: number }> = {
  banner: { width: 300, height: 250 },
  rectangle: { width: 300, height: 250 },
  leaderboard: { width: 728, height: 90 },
}

interface AdSlotProps {
  size: AdSlotSize
  id?: string
  className?: string
}

export default function AdSlot({ size, id, className = '' }: AdSlotProps) {
  const dimensions = AD_DIMENSIONS[size]
  const slotId = id || `ad-${size}`

  return (
    <div
      id={slotId}
      className={`ad-slot ${className}`}
      data-ad-size={size}
      data-ad-slot={slotId}
      style={{
        width: dimensions.width,
        height: dimensions.height,
        maxWidth: '100%',
      }}
    >
      {import.meta.env.DEV ? (
        <div
          className="flex items-center justify-center bg-gray-100 border-2 border-dashed border-gray-300 rounded w-full h-full"
          style={{ width: dimensions.width, height: dimensions.height, maxWidth: '100%' }}
        >
          <div className="text-center">
            <p className="text-gray-500 font-semibold text-sm">Ad Slot</p>
            <p className="text-gray-400 text-xs">
              {dimensions.width}x{dimensions.height}
            </p>
            <p className="text-gray-400 text-xs mt-0.5">{size}</p>
          </div>
        </div>
      ) : (
        <div
          style={{ width: dimensions.width, height: dimensions.height, maxWidth: '100%' }}
        />
      )}
    </div>
  )
}
