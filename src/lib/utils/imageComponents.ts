import { getThumbnailUrl, getIconUrl, getDisplayUrl, getSrcSet } from './imageUrls'

export interface ImageComponentProps {
  imageKey: string
  alt: string
  className?: string
  loading?: 'lazy' | 'eager'
  sizes?: string
}

/**
 * Get props for a thumbnail img element
 */
export function getThumbnailProps(props: ImageComponentProps) {
  return {
    src: getThumbnailUrl(props.imageKey),
    srcSet: getSrcSet(props.imageKey, [400, 800]),
    alt: props.alt,
    sizes: props.sizes || '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw',
    loading: props.loading || ('lazy' as const),
    className: props.className,
  }
}

/**
 * Get props for an icon img element
 */
export function getIconProps(props: ImageComponentProps) {
  return {
    src: getIconUrl(props.imageKey),
    alt: props.alt,
    loading: props.loading || ('lazy' as const),
    className: props.className,
    width: 128,
    height: 128,
  }
}

/**
 * Get props for a display/hero img element
 */
export function getDisplayProps(props: ImageComponentProps) {
  return {
    src: getDisplayUrl(props.imageKey),
    srcSet: getSrcSet(props.imageKey, [800, 1200, 1600]),
    alt: props.alt,
    sizes: props.sizes || '(max-width: 768px) 100vw, 1200px',
    loading: props.loading || ('lazy' as const),
    className: props.className,
  }
}
