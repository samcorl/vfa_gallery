# 38-WORKER-IMAGE-ICON.md

## Goal
Create a reusable `<ArtworkImage>` React component that renders responsive images using Cloudflare Image Transformations. This component handles image URL generation, responsive srcSet, lazy loading, and provides sensible defaults for different image variants (original, display, thumbnail, icon).

## Spec Extract
- **Approach**: On-the-fly image transformation via Cloudflare Image Transformations (no pre-generated variants)
- **URL Generation**: Use image URL utility from spec 37 (`src/lib/utils/imageUrls.ts`)
- **Framework**: React + TypeScript + Tailwind CSS
- **Component**: `<ArtworkImage>` at `src/components/ui/ArtworkImage.tsx`
- **CDN Domain**: `https://images.vfa.gallery`
- **Props**: `imageKey` (R2 key), `alt` (required), `variant` ('original' | 'display' | 'thumbnail' | 'icon'), optional width/height overrides, `className`
- **Features**:
  - Responsive srcSet with 1x and 2x resolutions
  - Lazy loading by default
  - Sensible defaults per variant (icon: 128x128 with rounded corners)
  - Tailwind-based styling
  - Full TypeScript support
- **Variants**:
  - `original`: Full resolution, no constraints
  - `display`: Display-sized (typically 800px wide max)
  - `thumbnail`: Gallery thumbnail (240px)
  - `icon`: Small icon (128px) with rounded appearance

## Prerequisites
- Build 37: Image URL utility working at `src/lib/utils/imageUrls.ts`
- Build 05: Environment configuration with R2 bucket and CDN domain
- React 18+ with TypeScript configured
- Tailwind CSS available in project
- Cloudflare Image Transformations enabled on CDN domain

## Steps

### 1. Create ArtworkImage Component

**File**: `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/ui/ArtworkImage.tsx`

```typescript
import React, { ImgHTMLAttributes } from 'react';
import { generateImageUrl } from '@/lib/utils/imageUrls';

export type ImageVariant = 'original' | 'display' | 'thumbnail' | 'icon';

interface VariantConfig {
  width: number;
  height?: number;
  className: string;
}

const VARIANT_DEFAULTS: Record<ImageVariant, VariantConfig> = {
  original: {
    width: 1920,
    className: 'w-full h-auto'
  },
  display: {
    width: 800,
    height: 800,
    className: 'w-full max-w-4xl h-auto'
  },
  thumbnail: {
    width: 240,
    height: 240,
    className: 'w-60 h-60 object-cover'
  },
  icon: {
    width: 128,
    height: 128,
    className: 'w-32 h-32 rounded-lg object-cover'
  }
};

export interface ArtworkImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'srcSet'> {
  /** R2 storage key for the image (e.g., "originals/user-id/uuid.jpg") */
  imageKey: string;
  /** Alt text for the image (required for accessibility) */
  alt: string;
  /** Image variant determining default dimensions and styling */
  variant?: ImageVariant;
  /** Optional width override (in pixels) */
  width?: number;
  /** Optional height override (in pixels) */
  height?: number;
  /** Additional Tailwind classes to merge with variant defaults */
  className?: string;
  /** Whether to use lazy loading (default: true) */
  loading?: 'lazy' | 'eager';
  /** Quality for Cloudflare Image Transformations (1-100, default: 80) */
  quality?: number;
  /** Format for Cloudflare Image Transformations (auto, jpg, png, webp, avif) */
  format?: 'auto' | 'jpg' | 'png' | 'webp' | 'avif';
}

/**
 * Responsive image component using Cloudflare Image Transformations
 *
 * Generates optimized image URLs on-the-fly with responsive srcSet
 * for different pixel densities (1x, 2x).
 *
 * @example
 * ```tsx
 * // Icon variant (sensible defaults)
 * <ArtworkImage
 *   imageKey="originals/user-123/artwork-uuid.jpg"
 *   alt="Artwork title"
 *   variant="icon"
 * />
 *
 * // Display with custom styling
 * <ArtworkImage
 *   imageKey="originals/user-123/artwork-uuid.jpg"
 *   alt="Artwork title"
 *   variant="display"
 *   className="rounded-xl shadow-lg"
 * />
 *
 * // Custom dimensions
 * <ArtworkImage
 *   imageKey="originals/user-123/artwork-uuid.jpg"
 *   alt="Artwork title"
 *   width={640}
 *   height={640}
 *   className="border-2 border-gray-200"
 * />
 * ```
 */
export const ArtworkImage = React.forwardRef<HTMLImageElement, ArtworkImageProps>(
  (
    {
      imageKey,
      alt,
      variant = 'display',
      width: widthOverride,
      height: heightOverride,
      className: classNameOverride,
      loading = 'lazy',
      quality = 80,
      format = 'auto',
      ...imgProps
    },
    ref
  ) => {
    // Get variant defaults
    const variantConfig = VARIANT_DEFAULTS[variant];
    const displayWidth = widthOverride ?? variantConfig.width;
    const displayHeight = heightOverride ?? variantConfig.height ?? displayWidth;

    // Generate primary image URL (1x resolution)
    const src = generateImageUrl(imageKey, {
      width: displayWidth,
      height: displayHeight,
      quality,
      format
    });

    // Generate srcSet for 2x resolution (higher pixel density displays)
    const srcSet2x = generateImageUrl(imageKey, {
      width: displayWidth * 2,
      height: displayHeight * 2,
      quality: Math.max(quality - 10, 60), // Slightly lower quality for larger sizes
      format
    });

    // Merge Tailwind classes: variant defaults + user overrides
    const mergedClassName = classNameOverride
      ? `${variantConfig.className} ${classNameOverride}`
      : variantConfig.className;

    return (
      <img
        ref={ref}
        src={src}
        srcSet={`${src} 1x, ${srcSet2x} 2x`}
        alt={alt}
        className={mergedClassName}
        loading={loading}
        decoding="async"
        {...imgProps}
      />
    );
  }
);

ArtworkImage.displayName = 'ArtworkImage';

export default ArtworkImage;
```

### 2. Update Image URL Utility (if not already complete from spec 37)

**File**: `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/utils/imageUrls.ts`

Ensure this file exports the `generateImageUrl` function with proper Cloudflare Image Transformations support:

```typescript
interface ImageTransformOptions {
  width?: number;
  height?: number;
  fit?: 'scale-down' | 'contain' | 'cover' | 'crop' | 'pad';
  quality?: number;
  format?: 'auto' | 'jpg' | 'png' | 'webp' | 'avif';
  metadata?: 'keep' | 'copyright' | 'none';
}

/**
 * Generates a Cloudflare Image Transformations URL
 *
 * @param imageKey - R2 storage key (e.g., "originals/user-id/uuid.jpg")
 * @param options - Transformation options
 * @returns Full URL with transformation parameters
 */
export function generateImageUrl(
  imageKey: string,
  options: ImageTransformOptions = {}
): string {
  const cdnDomain = process.env.REACT_APP_CDN_DOMAIN || 'https://images.vfa.gallery';
  const {
    width,
    height,
    fit = 'cover',
    quality = 80,
    format = 'auto',
    metadata = 'none'
  } = options;

  // Build query parameters for Cloudflare Image Transformations
  const params = new URLSearchParams();

  if (width) params.append('width', width.toString());
  if (height) params.append('height', height.toString());
  if (fit !== 'cover') params.append('fit', fit);
  if (quality !== 80) params.append('quality', quality.toString());
  if (format !== 'auto') params.append('format', format);
  if (metadata !== 'none') params.append('metadata', metadata);

  const queryString = params.toString();
  const baseUrl = `${cdnDomain}/${imageKey}`;

  return queryString ? `${baseUrl}?${queryString}` : baseUrl;
}
```

### 3. Add Component Export to UI Index

**File**: `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/ui/index.ts`

Add export for the new component:

```typescript
export { ArtworkImage, type ArtworkImageProps, type ImageVariant } from './ArtworkImage';
```

## Files to Create/Modify

| Path | Type | Purpose |
|------|------|---------|
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/ui/ArtworkImage.tsx` | Create | React component for rendering responsive images using Cloudflare Image Transformations |
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/utils/imageUrls.ts` | Modify | Ensure `generateImageUrl` function is properly exported (created in spec 37) |
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/ui/index.ts` | Modify | Add export for ArtworkImage component |

## Verification

### Test 1: Component Renders with Icon Variant
```tsx
import { ArtworkImage } from '@/components/ui';

export function TestIconComponent() {
  return (
    <ArtworkImage
      imageKey="originals/test-user/test-artwork.jpg"
      alt="Test artwork"
      variant="icon"
    />
  );
}

// Expected: Image renders at 128x128 with rounded corners
// Network: Should request image with width=128, height=128 from CDN
```

### Test 2: Component Renders with Display Variant
```tsx
<ArtworkImage
  imageKey="originals/test-user/test-artwork.jpg"
  alt="Test artwork"
  variant="display"
/>

// Expected: Image renders responsively with max-width of 4xl
// Network: Should have srcSet with both 1x and 2x versions
```

### Test 3: Verify srcSet and Lazy Loading
```bash
# Inspect element in browser DevTools
# Expected to see:
# - src: https://images.vfa.gallery/originals/test-user/test-artwork.jpg?width=800&height=800&quality=80&format=auto
# - srcSet: 1x version above + 2x version with width=1600&height=1600
# - loading="lazy" attribute present
# - decoding="async" attribute present
```

### Test 4: Custom Dimensions and Styling
```tsx
<ArtworkImage
  imageKey="originals/test-user/test-artwork.jpg"
  alt="Custom sized image"
  width={400}
  height={300}
  className="rounded-xl shadow-lg"
/>

// Expected: Image renders at 400x300 with rounded corners and shadow
// Network: Should request image with width=400, height=300
```

### Test 5: Different Variants Produce Correct URLs
```typescript
import { generateImageUrl } from '@/lib/utils/imageUrls';

// Icon variant (128x128)
const iconUrl = generateImageUrl('originals/user/art.jpg', {
  width: 128,
  height: 128
});
// Expected: https://images.vfa.gallery/originals/user/art.jpg?width=128&height=128&...

// Display variant (800x800)
const displayUrl = generateImageUrl('originals/user/art.jpg', {
  width: 800,
  height: 800
});
// Expected: https://images.vfa.gallery/originals/user/art.jpg?width=800&height=800&...

// Thumbnail variant (240x240)
const thumbUrl = generateImageUrl('originals/user/art.jpg', {
  width: 240,
  height: 240
});
// Expected: https://images.vfa.gallery/originals/user/art.jpg?width=240&height=240&...
```

### Test 6: Quality Parameter Variation
```tsx
// High quality (for display)
<ArtworkImage
  imageKey="originals/test-user/test-artwork.jpg"
  alt="High quality"
  variant="display"
  quality={90}
/>

// Lower quality (for thumbnails)
<ArtworkImage
  imageKey="originals/test-user/test-artwork.jpg"
  alt="Thumbnail"
  variant="thumbnail"
  quality={70}
/>

// Expected URLs: First has quality=90, second has quality=70
```

### Test 7: Format Parameter
```tsx
<ArtworkImage
  imageKey="originals/test-user/test-artwork.jpg"
  alt="WebP format"
  variant="display"
  format="webp"
/>

// Expected URL: https://images.vfa.gallery/originals/test-user/test-artwork.jpg?...&format=webp
```

### Test 8: Component with Eager Loading
```tsx
<ArtworkImage
  imageKey="originals/test-user/test-artwork.jpg"
  alt="Hero image"
  variant="display"
  loading="eager"
/>

// Expected: loading="eager" attribute in rendered img element
```

### Test 9: Accessibility Test
```bash
# In browser DevTools, check accessibility:
# - alt text is present and descriptive
# - img element has proper semantic attributes
# - decoding="async" doesn't block rendering
```

### Test 10: Integration in Real Components
Test the component in actual usage:
```tsx
// In an artist profile
<div className="artist-profile">
  <ArtworkImage
    imageKey={artwork.imageKey}
    alt={artwork.title}
    variant="icon"
  />
</div>

// In an artwork detail page
<div className="artwork-detail">
  <ArtworkImage
    imageKey={artwork.imageKey}
    alt={artwork.title}
    variant="display"
    className="rounded-2xl shadow-2xl"
  />
</div>

// In a gallery grid
<div className="gallery-grid">
  {artworks.map(art => (
    <ArtworkImage
      key={art.id}
      imageKey={art.imageKey}
      alt={art.title}
      variant="thumbnail"
      className="border-2 border-gray-300 hover:border-blue-500"
    />
  ))}
</div>
```

## Notes

- **No server-side processing**: All image transformations happen on-the-fly via Cloudflare Image Transformations. No pre-generated variants stored in R2.
- **Responsive by default**: srcSet automatically handles 1x and 2x pixel density displays.
- **Performance**: Lazy loading enabled by default (`loading="lazy"`). Use `loading="eager"` only for above-the-fold images.
- **Tailwind integration**: Variant defaults use Tailwind classes; user overrides are appended for flexibility.
- **Type-safe**: Full TypeScript support with exported types for props and variants.
- **URL structure**: CDN domain (`https://images.vfa.gallery`) + R2 key + query parameters.
- **Quality defaults**: 80 for standard views, reduced to 70 for thumbnails in 2x srcSet to manage file size.
- **Format negotiation**: `format="auto"` lets Cloudflare choose optimal format (WebP for modern browsers, JPEG fallback).
- **Metadata removal**: `metadata="none"` strips EXIF data for privacy and smaller file sizes.
- **Error handling**: If image URL is malformed or CDN domain not configured, component still renders with broken image appearance (standard HTML behavior).
- **Browser support**: Works on all modern browsers. Fallback to `src` for browsers that don't support srcSet.
