import { getDisplayUrl, getSrcSet } from '../../lib/utils/imageUrls'

interface WatermarkedImageProps {
  imageKey: string
  artistName: string
  alt: string
  className?: string
}

/**
 * Display artwork with CSS watermark overlay
 * Prevents casual right-click saving and shows artist attribution
 */
export function WatermarkedImage({
  imageKey,
  artistName,
  alt,
  className,
}: WatermarkedImageProps) {
  return (
    <div
      className={`relative select-none ${className || ''}`}
      onContextMenu={(e) => e.preventDefault()}
    >
      <img
        src={getDisplayUrl(imageKey)}
        srcSet={getSrcSet(imageKey, [800, 1200, 1600])}
        sizes="(max-width: 768px) 100vw, 1200px"
        alt={alt}
        loading="lazy"
        decoding="async"
        draggable={false}
        className="w-full h-auto"
      />
      <div
        className="absolute bottom-0 right-0 px-3 py-1.5 pointer-events-none"
        aria-hidden="true"
      >
        <span className="text-white/60 text-sm font-medium drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
          {artistName}
        </span>
      </div>
    </div>
  )
}
