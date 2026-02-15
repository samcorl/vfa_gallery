# 37-IMAGE-URLS-UTILITY.md

## Goal
Create a reusable image URL utility that generates transformed image URLs using Cloudflare Image Transformations. Thumbnails and other image variants are served on-the-fly by the Cloudflare CDN via transformation parameters, eliminating the need for pre-generated versions in storage.

## Spec Extract
- **Framework**: Hono on Cloudflare Pages
- **Image Transform API**: Cloudflare Image Transformations (via `/cdn-cgi/image/` path)
- **CDN Domain**: `https://images.vfa.gallery`
- **Original Image Path**: `https://images.vfa.gallery/originals/{userId}/{uuid}.jpg`
- **Transformed URL Pattern**: `https://images.vfa.gallery/cdn-cgi/image/{transformParams}/originals/{userId}/{uuid}.jpg`
- **Utility Location**: `src/lib/utils/imageUrls.ts`
- **Key Functions**:
  - `getImageUrl()` — base function with custom transformation options
  - `getThumbnailUrl()` — 400px wide for grid display
  - `getIconUrl()` — 128px square with cover fit
  - `getDisplayUrl()` — 1200px max for hero/detail views
  - `getOriginalUrl()` — direct URL without transforms

## Prerequisites
- Build 05: Environment configuration with R2 credentials
- Build 36: Upload URL generation working
- Cloudflare Pages site configured with:
  - R2 bucket connected as origin (via Cloudflare Workers KV or direct bucket binding)
  - Image Resizing enabled (Cloudflare Pro plan or Images add-on subscription)
  - Zone configured to serve images from `images.vfa.gallery` subdomain
  - R2 bucket public access enabled or Worker routing configured for CDN

## Steps

### 1. Create ImageTransformOptions TypeScript Types

**File**: `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/types/image.ts`

```typescript
/**
 * Options for Cloudflare Image Transformations
 * @see https://developers.cloudflare.com/images/image-resizing/url-format/
 */
export interface ImageTransformOptions {
  /** Width in pixels (1-16000) */
  width?: number;
  /** Height in pixels (1-16000) */
  height?: number;
  /** Compression quality (1-100), default 85 */
  quality?: number;
  /** Output format: auto, json, jpeg, png, webp, avif, etc. */
  format?: 'auto' | 'jpeg' | 'png' | 'webp' | 'avif' | 'json';
  /** Fit behavior: scale-down, contain, cover, crop, pad */
  fit?: 'scale-down' | 'contain' | 'cover' | 'crop' | 'pad';
  /** Gravity for crop/cover: auto, left, right, top, bottom, center */
  gravity?: 'auto' | 'left' | 'right' | 'top' | 'bottom' | 'center';
  /** Enable metadata preservation (exif, icc) */
  metadata?: 'keep' | 'copyright' | 'none';
  /** Animated image behavior: true/false */
  animated?: boolean;
  /** Background color for padding (hex format) */
  background?: string;
  /** Blur radius (1-250) */
  blur?: number;
  /** Sharpen radius (0.3-10) */
  sharpen?: number;
  /** Opacity (0-100) */
  opacity?: number;
  /** Brightness modifier (-100 to 100) */
  brightness?: number;
  /** Contrast modifier (-100 to 100) */
  contrast?: number;
  /** Saturation modifier (-100 to 100) */
  saturation?: number;
  /** Rotation degrees (0, 90, 180, 270) */
  rotation?: 0 | 90 | 180 | 270;
  /** Auto-orient based on EXIF */
  'auto-orient'?: boolean;
}

/**
 * Predefined image sizes for the gallery
 */
export const IMAGE_SIZES = {
  THUMBNAIL: 400,
  ICON: 128,
  DISPLAY: 1200,
  SQUARE: 400
} as const;
```

### 2. Create Image URL Utility

**File**: `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/utils/imageUrls.ts`

```typescript
import type { ImageTransformOptions } from '../types/image';
import { IMAGE_SIZES } from '../types/image';

/**
 * Configuration for the image CDN
 */
const IMAGE_CDN_DOMAIN = 'https://images.vfa.gallery';
const CLOUDFLARE_IMAGE_API = '/cdn-cgi/image';

/**
 * Build transformation parameters string for Cloudflare Image Resizing
 * @see https://developers.cloudflare.com/images/image-resizing/url-format/
 */
function buildTransformParams(options: ImageTransformOptions): string {
  const params: string[] = [];

  if (options.width) params.push(`width=${options.width}`);
  if (options.height) params.push(`height=${options.height}`);
  if (options.quality) params.push(`quality=${options.quality}`);
  if (options.format) params.push(`format=${options.format}`);
  if (options.fit) params.push(`fit=${options.fit}`);
  if (options.gravity) params.push(`gravity=${options.gravity}`);
  if (options.metadata) params.push(`metadata=${options.metadata}`);
  if (options.animated !== undefined) params.push(`animated=${options.animated ? 'true' : 'false'}`);
  if (options.background) params.push(`background=${encodeURIComponent(options.background)}`);
  if (options.blur) params.push(`blur=${options.blur}`);
  if (options.sharpen) params.push(`sharpen=${options.sharpen}`);
  if (options.opacity !== undefined) params.push(`opacity=${options.opacity}`);
  if (options.brightness !== undefined) params.push(`brightness=${options.brightness}`);
  if (options.contrast !== undefined) params.push(`contrast=${options.contrast}`);
  if (options.saturation !== undefined) params.push(`saturation=${options.saturation}`);
  if (options.rotation !== undefined) params.push(`rotation=${options.rotation}`);
  if (options['auto-orient'] !== undefined) {
    params.push(`auto-orient=${options['auto-orient'] ? 'true' : 'false'}`);
  }

  return params.join(',');
}

/**
 * Generate a base image URL with optional transformations
 * @param key - R2 key (e.g., 'originals/userId/uuid.jpg')
 * @param options - Transformation options
 * @returns Full CDN URL with transformations
 */
export function getImageUrl(key: string, options?: ImageTransformOptions): string {
  // Normalize key to not start with /
  const normalizedKey = key.startsWith('/') ? key.slice(1) : key;

  if (!options || Object.keys(options).length === 0) {
    // No transformations, return original
    return `${IMAGE_CDN_DOMAIN}/${normalizedKey}`;
  }

  const transformParams = buildTransformParams(options);
  return `${IMAGE_CDN_DOMAIN}${CLOUDFLARE_IMAGE_API}/${transformParams}/${normalizedKey}`;
}

/**
 * Get thumbnail URL (400px wide, quality 80, auto format)
 * Suitable for gallery grid display
 */
export function getThumbnailUrl(key: string): string {
  return getImageUrl(key, {
    width: IMAGE_SIZES.THUMBNAIL,
    quality: 80,
    format: 'auto'
  });
}

/**
 * Get icon URL (128x128px square, cover fit, quality 80)
 * Suitable for avatar/profile displays
 */
export function getIconUrl(key: string): string {
  return getImageUrl(key, {
    width: IMAGE_SIZES.ICON,
    height: IMAGE_SIZES.ICON,
    fit: 'cover',
    quality: 80,
    format: 'auto'
  });
}

/**
 * Get display URL (1200px max width, quality 85, auto format)
 * Suitable for hero sections and detail views
 */
export function getDisplayUrl(key: string): string {
  return getImageUrl(key, {
    width: IMAGE_SIZES.DISPLAY,
    quality: 85,
    format: 'auto'
  });
}

/**
 * Get original image URL without any transformations
 * Use sparingly as original files may be large
 */
export function getOriginalUrl(key: string): string {
  const normalizedKey = key.startsWith('/') ? key.slice(1) : key;
  return `${IMAGE_CDN_DOMAIN}/${normalizedKey}`;
}

/**
 * Generate a URL for a custom transformation
 * Useful for specific use cases not covered by presets
 */
export function getCustomImageUrl(key: string, options: ImageTransformOptions): string {
  return getImageUrl(key, options);
}

/**
 * Generate URL with responsive image srcset
 * Returns array of [size, url] pairs for use in srcset attribute
 */
export function getResponsiveImageSrcset(
  key: string,
  widths: number[] = [400, 800, 1200]
): [number, string][] {
  return widths.map(width => [
    width,
    getImageUrl(key, {
      width,
      quality: 80,
      format: 'auto'
    })
  ]);
}

/**
 * Generate srcset HTML attribute string
 * Usage: <img srcset={getResponsiveImageSrcsetString(key)} ... />
 */
export function getResponsiveImageSrcsetString(
  key: string,
  widths: number[] = [400, 800, 1200]
): string {
  return getResponsiveImageSrcset(key, widths)
    .map(([width, url]) => `${url} ${width}w`)
    .join(', ');
}

/**
 * Validate that a key follows the expected R2 structure
 */
export function isValidImageKey(key: string): boolean {
  // Basic validation: should not be empty and not contain suspicious patterns
  if (!key || key.trim() === '') return false;
  if (key.includes('..')) return false; // Path traversal attempt
  return true;
}

/**
 * Extract userId from a standard image key
 * Expected format: originals/{userId}/{uuid}.jpg
 */
export function extractUserIdFromImageKey(key: string): string | null {
  const parts = key.split('/');
  if (parts.length >= 3 && parts[0] === 'originals') {
    return parts[1];
  }
  return null;
}

/**
 * Extract UUID from a standard image key
 * Expected format: originals/{userId}/{uuid}.jpg
 */
export function extractUuidFromImageKey(key: string): string | null {
  const parts = key.split('/');
  if (parts.length >= 3 && parts[0] === 'originals') {
    const filename = parts[parts.length - 1];
    return filename.replace(/\.[^/.]+$/, ''); // Remove file extension
  }
  return null;
}
```

### 3. Create Integration Utilities (React/Vue/Svelte usage)

**File**: `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/utils/imageComponents.ts`

```typescript
/**
 * Utilities for use with image components
 * Provides helpers for common gallery patterns
 */

import {
  getThumbnailUrl,
  getIconUrl,
  getDisplayUrl,
  getResponsiveImageSrcsetString,
  type ImageTransformOptions
} from './imageUrls';

export interface ImageComponentProps {
  imageKey: string;
  alt: string;
  className?: string;
  loading?: 'lazy' | 'eager';
  sizes?: string;
}

export interface ThumbnailImageProps extends ImageComponentProps {
  width?: number;
  height?: number;
}

/**
 * Get props for a thumbnail image element
 */
export function getThumbnailProps(props: ImageComponentProps) {
  return {
    src: getThumbnailUrl(props.imageKey),
    alt: props.alt,
    loading: props.loading || 'lazy' as const,
    className: props.className
  };
}

/**
 * Get props for a responsive thumbnail with srcset
 */
export function getResponsiveThumbnailProps(props: ImageComponentProps) {
  return {
    src: getThumbnailUrl(props.imageKey),
    srcSet: getResponsiveImageSrcsetString(props.imageKey, [400, 800]),
    alt: props.alt,
    sizes: props.sizes || '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw',
    loading: props.loading || 'lazy' as const,
    className: props.className
  };
}

/**
 * Get props for an icon/avatar image element
 */
export function getIconProps(props: ImageComponentProps) {
  return {
    src: getIconUrl(props.imageKey),
    alt: props.alt,
    loading: props.loading || 'lazy' as const,
    className: props.className,
    width: 128,
    height: 128
  };
}

/**
 * Get props for a display/hero image element
 */
export function getDisplayProps(props: ImageComponentProps) {
  return {
    src: getDisplayUrl(props.imageKey),
    srcSet: getResponsiveImageSrcsetString(props.imageKey, [1200, 1600]),
    alt: props.alt,
    sizes: props.sizes || '(max-width: 768px) 100vw, 1200px',
    loading: props.loading || 'lazy' as const,
    className: props.className
  };
}
```

### 4. Update Environment Configuration

**File**: `/Volumes/DataSSD/gitsrc/vfa_gallery/.env.example`

Add/verify these variables:
```
# Image CDN Configuration
VITE_IMAGE_CDN_DOMAIN=https://images.vfa.gallery
VITE_IMAGE_API_PATH=/cdn-cgi/image

# R2 Configuration
R2_ENDPOINT=https://youraccount.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=your_access_key_id
R2_SECRET_ACCESS_KEY=your_secret_access_key
R2_BUCKET_NAME=site-prod
```

### 5. Create Documentation for Cloudflare Image Resizing Setup

**File**: `/Volumes/DataSSD/gitsrc/vfa_gallery/docs/CLOUDFLARE-IMAGE-SETUP.md`

```markdown
# Cloudflare Image Resizing Setup

## Overview
This project uses Cloudflare Image Resizing to serve on-the-fly transformed images via the `/cdn-cgi/image/` API endpoint.

## Prerequisites
- **Plan Requirement**: Cloudflare Pro plan or Images add-on subscription
- **Zone Setup**: Domain must be on Cloudflare nameservers
- **Image Resizing**: Must be enabled in Cloudflare dashboard → Images → Resizing

## Configuration Steps

### 1. Enable Image Resizing in Cloudflare Dashboard
1. Go to Cloudflare Dashboard
2. Select your domain
3. Go to Images → Resizing
4. Toggle "Image Resizing" to ON
5. Note: Cloudflare Pro costs $200/month; Images add-on is typically cheaper

### 2. Connect R2 Bucket to Zone
Your R2 bucket must be accessible from your zone. Options:

**Option A: Public R2 Bucket (Recommended)**
- Set R2 bucket visibility to Public
- Images served directly via `https://images.vfa.gallery/path/to/image.jpg`

**Option B: Private Bucket with Worker**
- Create a Cloudflare Worker that authenticates and serves from private R2 bucket
- Route `/originals/*` to worker
- Worker fetches from R2 and returns image

### 3. Setup Subdomain (images.vfa.gallery)
1. Create DNS record for `images` subdomain pointing to your origin
2. Add CNAME: `images.vfa.gallery` → `youraccount.r2.cloudflarestorage.com`
3. Or point to a Worker if using Option B above

### 4. Test Image Transformation
```bash
# Original image
curl -i https://images.vfa.gallery/originals/{userId}/{uuid}.jpg

# Transformed thumbnail
curl -i https://images.vfa.gallery/cdn-cgi/image/width=400,quality=80,format=auto/originals/{userId}/{uuid}.jpg
```

## Usage in Application
See `src/lib/utils/imageUrls.ts` for available helper functions.

## Cost Considerations
- **Image Resizing**: Varies by plan (included in Pro, separate add-on for Business)
- **R2 Storage**: Pay-as-you-go
- **Images Served**: First 100k transformations/month included with Pro; additional $0.50 per 100k
- **Bandwidth**: Standard Cloudflare bandwidth pricing applies

## Troubleshooting

### Images Not Transforming
- Verify Image Resizing is enabled in dashboard
- Check domain is on Cloudflare nameservers
- Verify R2 bucket is publicly accessible
- Check CDN cache is not interfering (clear if needed)

### 404 on Image Requests
- Verify R2 bucket name and paths are correct
- Check R2 bucket is public
- Verify DNS resolution for images.vfa.gallery subdomain

### High Latency
- Images are cached at Cloudflare edge
- First request to a new transformation may take 1-2 seconds
- Subsequent requests are served from cache
- Consider warming cache for popular image sizes

## Alternative: Transform at Upload Time
If Image Resizing is not feasible:
1. Accept Node.js/Jimp-based thumbnail generation at upload time
2. Store thumbnails in separate R2 paths
3. Update build spec accordingly
```

## Files to Create/Modify

| Path | Type | Purpose |
|------|------|---------|
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/types/image.ts` | Create | TypeScript types for image transformations |
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/utils/imageUrls.ts` | Create | Core image URL generation utilities |
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/utils/imageComponents.ts` | Create | Component integration helpers |
| `/Volumes/DataSSD/gitsrc/vfa_gallery/docs/CLOUDFLARE-IMAGE-SETUP.md` | Create | Setup and configuration guide |
| `/Volumes/DataSSD/gitsrc/vfa_gallery/.env.example` | Modify | Add image CDN environment variables |

## Verification

### Test 1: Generate Thumbnail URL
```typescript
import { getThumbnailUrl } from '$lib/utils/imageUrls';

const imageKey = 'originals/user123/abc-def-ghi.jpg';
const thumbUrl = getThumbnailUrl(imageKey);
console.log(thumbUrl);
// Output: https://images.vfa.gallery/cdn-cgi/image/width=400,quality=80,format=auto/originals/user123/abc-def-ghi.jpg
```

### Test 2: Verify Cloudflare Image Transformation Works
```bash
# Test with real image (replace with actual image URL)
curl -I https://images.vfa.gallery/cdn-cgi/image/width=400,quality=80,format=auto/originals/test/image.jpg

# Should return 200 OK with appropriate Content-Type and Cache-Control headers
# Example response headers:
# HTTP/2 200
# content-type: image/webp
# cf-cache-status: HIT
# cache-control: public, max-age=31536000
```

### Test 3: Test All Helper Functions
```typescript
import {
  getImageUrl,
  getThumbnailUrl,
  getIconUrl,
  getDisplayUrl,
  getOriginalUrl,
  getResponsiveImageSrcsetString,
  extractUserIdFromImageKey,
  extractUuidFromImageKey
} from '$lib/utils/imageUrls';

const key = 'originals/user456/xyz-123-456.jpg';

console.log('Thumbnail:', getThumbnailUrl(key));
console.log('Icon:', getIconUrl(key));
console.log('Display:', getDisplayUrl(key));
console.log('Original:', getOriginalUrl(key));
console.log('Srcset:', getResponsiveImageSrcsetString(key));
console.log('UserId:', extractUserIdFromImageKey(key)); // 'user456'
console.log('UUID:', extractUuidFromImageKey(key)); // 'xyz-123-456'
```

### Test 4: Test Integration Helpers
```typescript
import { getThumbnailProps, getDisplayProps } from '$lib/utils/imageComponents';

const key = 'originals/user789/image.jpg';
const thumbProps = getThumbnailProps({ imageKey: key, alt: 'Artwork thumbnail' });
const displayProps = getDisplayProps({ imageKey: key, alt: 'Artwork' });

// Use in component
// <img {...thumbProps} />
// <img {...displayProps} />
```

### Test 5: Responsive Srcset Rendering
```html
<!-- Test in browser DevTools -->
<img
  src="https://images.vfa.gallery/cdn-cgi/image/width=400,quality=80,format=auto/originals/test/image.jpg"
  srcset="https://images.vfa.gallery/cdn-cgi/image/width=400,quality=80,format=auto/originals/test/image.jpg 400w, https://images.vfa.gallery/cdn-cgi/image/width=800,quality=80,format=auto/originals/test/image.jpg 800w, https://images.vfa.gallery/cdn-cgi/image/width=1200,quality=80,format=auto/originals/test/image.jpg 1200w"
  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
  alt="Test image"
/>
```

### Test 6: Error Handling
```typescript
import { isValidImageKey } from '$lib/utils/imageUrls';

console.log(isValidImageKey('originals/user/image.jpg')); // true
console.log(isValidImageKey('../../../etc/passwd')); // false
console.log(isValidImageKey('')); // false
```

## Notes

### Performance Characteristics
- **First request to new transformation**: ~1-2 seconds (Cloudflare processes and caches)
- **Cached requests**: <100ms from edge (served from cache)
- **Bandwidth savings**: ~60-80% reduction vs original images through quality/format optimization
- **Storage savings**: No thumbnails stored; only originals take up R2 space

### Format Negotiation with `auto`
- Cloudflare automatically selects best format based on client capabilities
- Modern browsers get WebP or AVIF
- Older browsers fall back to JPEG/PNG
- Results in ~20-30% better compression than static JPEG

### Image Rotation & Orientation
- Cloudflare respects EXIF orientation data
- Use `auto-orient: true` if images have incorrect rotation
- Most modern cameras/phones handle this automatically

### Caching Strategy
- Transformed images cached for 1 year (31536000 seconds)
- Original images cached based on R2 Cache-Control headers
- Browser cache respects Cloudflare Cache-Control headers
- Clear Cloudflare cache if needing to re-serve updated images

### Future Enhancements
- Implement responsive images for different screen sizes
- Add blur-hash generation for image placeholders
- Consider Cloudflare's Responsive Image Variants API for multiple formats
- Implement analytics on image transformation API usage

### Gotchas
1. **R2 Bucket Visibility**: Ensure bucket is public or Worker-fronted
2. **DNS Propagation**: Images subdomain must resolve correctly
3. **CORS Headers**: If images accessed from different domain, ensure CORS enabled
4. **Quality vs File Size**: Quality 80 usually optimal; 75 for thumbnails, 85+ for display
5. **Animated GIFs**: Set `animated: true` to preserve animation; increases processing time
