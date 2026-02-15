import { useState, useCallback } from 'react'
import { getImageUrl } from '../lib/utils/imageUrls'

interface UseLazyImageOptions {
  src: string
  lowQualityWidth?: number
}

export function useLazyImage({ src, lowQualityWidth = 20 }: UseLazyImageOptions) {
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)

  // Generate low-quality placeholder URL via Cloudflare transforms
  const placeholderSrc = getImageUrl(src, { width: lowQualityWidth, quality: 30 })

  const onLoad = useCallback(() => setLoaded(true), [])
  const onError = useCallback(() => setError(true), [])

  return {
    loaded,
    error,
    placeholderSrc,
    onLoad,
    onError,
    imageStyles: {
      opacity: loaded ? 1 : 0,
      transition: 'opacity 0.3s ease-in-out',
    } as React.CSSProperties,
    placeholderStyles: {
      filter: 'blur(10px)',
      transform: 'scale(1.1)',
      opacity: loaded ? 0 : 1,
      transition: 'opacity 0.3s ease-in-out',
    } as React.CSSProperties,
  }
}
