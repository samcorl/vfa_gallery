import { getThumbnailUrl, getIconUrl, getDisplayUrl, getSrcSet } from '../../lib/utils/imageUrls'

interface ArtworkImageProps {
  imageKey: string
  alt: string
  variant?: 'thumbnail' | 'icon' | 'display'
  className?: string
  loading?: 'lazy' | 'eager'
}

/**
 * Display artwork image with appropriate variant
 * Uses Cloudflare Image Transformations for on-the-fly sizing
 */
export function ArtworkImage({
  imageKey,
  alt,
  variant = 'display',
  className,
  loading = 'lazy',
}: ArtworkImageProps) {
  const getUrl = () => {
    switch (variant) {
      case 'thumbnail':
        return getThumbnailUrl(imageKey)
      case 'icon':
        return getIconUrl(imageKey)
      case 'display':
      default:
        return getDisplayUrl(imageKey)
    }
  }

  const getSizes = () => {
    switch (variant) {
      case 'thumbnail':
        return '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw'
      case 'icon':
        return '128px'
      case 'display':
      default:
        return '(max-width: 768px) 100vw, 1200px'
    }
  }

  const getWidths = () => {
    switch (variant) {
      case 'thumbnail':
        return [400, 800]
      case 'icon':
        return [128, 256]
      case 'display':
      default:
        return [800, 1200, 1600]
    }
  }

  return (
    <img
      src={getUrl()}
      srcSet={getSrcSet(imageKey, getWidths())}
      sizes={getSizes()}
      alt={alt}
      className={className}
      loading={loading}
      decoding="async"
    />
  )
}
