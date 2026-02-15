/**
 * Options for Cloudflare Image Transformations
 * @see https://developers.cloudflare.com/images/image-resizing/url-format/
 */
export interface ImageTransformOptions {
  /** Width in pixels (1-16000) */
  width?: number
  /** Height in pixels (1-16000) */
  height?: number
  /** Compression quality (1-100), default 85 */
  quality?: number
  /** Output format: auto, jpeg, png, webp, avif */
  format?: 'auto' | 'jpeg' | 'png' | 'webp' | 'avif'
  /** Fit behavior: scale-down, contain, cover, crop, pad */
  fit?: 'scale-down' | 'contain' | 'cover' | 'crop' | 'pad'
  /** Gravity for crop/cover: auto, left, right, top, bottom, center */
  gravity?: 'auto' | 'left' | 'right' | 'top' | 'bottom' | 'center'
  /** Enable metadata preservation */
  metadata?: 'keep' | 'copyright' | 'none'
}

/**
 * Predefined image sizes for the gallery
 */
export const IMAGE_SIZES = {
  THUMBNAIL: 400,
  ICON: 128,
  DISPLAY: 1200,
} as const