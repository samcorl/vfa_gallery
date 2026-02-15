import type { ImageTransformOptions } from '../types/image'
import { IMAGE_SIZES } from '../types/image'

const IMAGE_CDN_DOMAIN = 'https://images.vfa.gallery'
const CLOUDFLARE_IMAGE_API = '/cdn-cgi/image'

/**
 * Build transformation parameters string for Cloudflare Image Resizing
 * Format: width=400,quality=80,format=auto
 */
function buildTransformParams(options: ImageTransformOptions): string {
  const params: string[] = []

  if (options.width) params.push(`width=${options.width}`)
  if (options.height) params.push(`height=${options.height}`)
  if (options.quality) params.push(`quality=${options.quality}`)
  if (options.format) params.push(`format=${options.format}`)
  if (options.fit) params.push(`fit=${options.fit}`)
  if (options.gravity) params.push(`gravity=${options.gravity}`)
  if (options.metadata) params.push(`metadata=${options.metadata}`)

  return params.join(',')
}

/**
 * Generate a Cloudflare Image Transformation URL from an R2 key
 * @param key - R2 key (e.g., 'originals/userId/uuid.jpg')
 * @param options - Transformation options
 * @returns Full CDN URL with transformations
 */
export function getImageUrl(key: string, options?: ImageTransformOptions): string {
  const normalizedKey = key.startsWith('/') ? key.slice(1) : key

  if (!options || Object.keys(options).length === 0) {
    return `${IMAGE_CDN_DOMAIN}/${normalizedKey}`
  }

  const transformParams = buildTransformParams(options)
  return `${IMAGE_CDN_DOMAIN}${CLOUDFLARE_IMAGE_API}/${transformParams}/${normalizedKey}`
}

/**
 * Get thumbnail URL (400px wide, quality 80, auto format)
 * For gallery grid display
 */
export function getThumbnailUrl(key: string): string {
  return getImageUrl(key, {
    width: IMAGE_SIZES.THUMBNAIL,
    quality: 80,
    format: 'auto',
  })
}

/**
 * Get icon URL (128x128px square, cover fit, quality 80)
 * For navigation previews and small displays
 */
export function getIconUrl(key: string): string {
  return getImageUrl(key, {
    width: IMAGE_SIZES.ICON,
    height: IMAGE_SIZES.ICON,
    fit: 'cover',
    quality: 80,
    format: 'auto',
  })
}

/**
 * Get display URL (1200px max width, quality 85, auto format)
 * For hero sections and detail views
 */
export function getDisplayUrl(key: string): string {
  return getImageUrl(key, {
    width: IMAGE_SIZES.DISPLAY,
    quality: 85,
    format: 'auto',
  })
}

/**
 * Get original image URL without any transformations
 */
export function getOriginalUrl(key: string): string {
  const normalizedKey = key.startsWith('/') ? key.slice(1) : key
  return `${IMAGE_CDN_DOMAIN}/${normalizedKey}`
}

/**
 * Generate responsive srcset string for use in img elements
 */
export function getSrcSet(
  key: string,
  widths: number[] = [400, 800, 1200],
): string {
  return widths
    .map((width) => {
      const url = getImageUrl(key, { width, quality: 80, format: 'auto' })
      return `${url} ${width}w`
    })
    .join(', ')
}

/**
 * Validate that a key follows the expected R2 structure
 */
export function isValidImageKey(key: string): boolean {
  if (!key || key.trim() === '') return false
  if (key.includes('..')) return false
  return true
}
