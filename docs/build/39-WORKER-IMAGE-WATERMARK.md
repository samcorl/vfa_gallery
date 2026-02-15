# 39-WORKER-IMAGE-WATERMARK.md

## Goal
Implement frontend-based watermarking for artwork display using CSS overlays. This approach protects artist attribution by preventing direct access to high-resolution original images while maintaining a clean, composable architecture compatible with Cloudflare Pages + Hono + React stack.

## Spec Extract
- **Watermarking Strategy**: CSS-based overlay on frontend display view (not server-side image transformation)
- **Component**: `<WatermarkedImage>` React component at `src/components/ui/WatermarkedImage.tsx`
- **Watermark Content**: Artist username with optional copyright symbol
- **Watermark Position**: Bottom-right corner
- **Watermark Style**: Semi-transparent white text with subtle text shadow
- **Overlay Layer**: Non-interactive (`pointer-events: none`) positioned absolutely over image
- **Right-Click Protection**: Disabled context menu on image element
- **Image Source**: Display variant from spec 37 image utilities (CDN: `https://images.vfa.gallery`)
- **R2 Access Control**: Original images in `originals/` prefix NOT publicly accessible; only `display/` variant URLs served via CDN

## Prerequisites
- Build 37: Image URL utilities working (image transformation and CDN domain configured)
- Cloudflare Pages project configured with Hono framework
- React component library structure established
- R2 bucket with `originals/` and `display/` prefixes configured
- Image upload pipeline storing originals at `originals/{userId}/{uuid}.jpg`
- Display variants accessible via `https://images.vfa.gallery/display/{userId}/{uuid}.jpg`

## Steps

### 1. Create WatermarkedImage Component

**File**: `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/ui/WatermarkedImage.tsx`

```typescript
import React, { CSSProperties } from 'react';
import { getImageUrl } from '@/lib/imageUtils';

interface WatermarkedImageProps {
  imageKey: string;
  artistName: string;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
  priority?: boolean;
}

/**
 * WatermarkedImage Component
 *
 * Displays artwork with a semi-transparent CSS watermark overlay
 * containing the artist's username. The watermark is non-interactive
 * and positioned in the bottom-right corner.
 *
 * Right-click is disabled to prevent direct image saving without watermark.
 *
 * Props:
 * - imageKey: R2 key for the artwork (e.g., "userId/uuid.jpg")
 * - artistName: Artist's username to display in watermark
 * - alt: Alt text for accessibility
 * - className: Optional CSS class for the container
 * - width: Image display width in pixels (optional)
 * - height: Image display height in pixels (optional)
 * - priority: Load image with high priority (optional)
 */
export const WatermarkedImage: React.FC<WatermarkedImageProps> = ({
  imageKey,
  artistName,
  alt,
  className = '',
  width,
  height,
  priority = false
}) => {
  // Get the display variant image URL from CDN
  const imageUrl = getImageUrl(imageKey, 'display');

  // Handle right-click on image to prevent direct save
  const handleContextMenu = (e: React.MouseEvent<HTMLImageElement>) => {
    e.preventDefault();
    // Optionally: show a message or toast that explains watermarking
    return false;
  };

  // Watermark text with copyright symbol
  const watermarkText = `© ${artistName}`;

  // Container styles
  const containerStyle: CSSProperties = {
    position: 'relative',
    display: 'inline-block',
    width: width ? `${width}px` : 'auto',
    height: height ? `${height}px` : 'auto'
  };

  // Image styles
  const imageStyle: CSSProperties = {
    display: 'block',
    width: '100%',
    height: 'auto',
    maxWidth: '100%'
  };

  // Watermark overlay styles
  const watermarkStyle: CSSProperties = {
    position: 'absolute',
    bottom: '16px',
    right: '16px',
    padding: '8px 12px',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: '14px',
    fontWeight: '500',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    textShadow: '0 1px 2px rgba(0, 0, 0, 0.8)',
    borderRadius: '2px',
    pointerEvents: 'none',
    userSelect: 'none',
    whiteSpace: 'nowrap',
    zIndex: 10
  };

  return (
    <div className={className} style={containerStyle}>
      <img
        src={imageUrl}
        alt={alt}
        style={imageStyle}
        onContextMenu={handleContextMenu}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
      />
      <div style={watermarkStyle}>
        {watermarkText}
      </div>
    </div>
  );
};

export default WatermarkedImage;
```

### 2. Document R2 Access Control Configuration

**File**: `/Volumes/DataSSD/gitsrc/vfa_gallery/docs/configuration/R2-ACCESS-CONTROL.md`

```markdown
# R2 Access Control Strategy

## Overview
The VFA Gallery uses a two-tier R2 storage structure:
- **originals/**: Private, server-only access (via Hono backend)
- **display/**: Public CDN access via `https://images.vfa.gallery`

## R2 Bucket Configuration

### Prefix: originals/
- **Access**: Private (no public URL)
- **Purpose**: Store original high-resolution artwork files
- **Access Method**: Server-side only, via AWS SDK with R2 credentials
- **Use Case**:
  - Backup/archival of original files
  - Server-side transformations (future enhancement)
  - Admin/artist download of originals (authenticated endpoint)

### Prefix: display/
- **Access**: Public via CDN
- **Purpose**: Serve optimized display variants
- **Access Method**: Public HTTPS through Cloudflare CDN domain
- **URL Pattern**: `https://images.vfa.gallery/display/{userId}/{uuid}.jpg`

## Implementation

### Option 1: Cloudflare Transform Rules (Recommended)
Configure a Cloudflare Transform Rule to:
1. Block direct requests to `images.vfa.gallery/originals/*`
2. Allow only `images.vfa.gallery/display/*` paths
3. Return 403 Forbidden for blocked paths

Example Transform Rule:
```
Request path contains "originals" → Block (403)
```

### Option 2: Custom Hono Middleware (Alternative)
If Cloudflare Transform Rules are insufficient, add a Hono middleware:

**File**: `src/middleware/imageAccess.ts`

```typescript
import { Hono } from 'hono';

export const imageAccessMiddleware = (app: Hono) => {
  app.all('*', async (c, next) => {
    const url = new URL(c.req.url);

    // Block access to originals prefix
    if (url.pathname.includes('/originals/')) {
      return c.text('Forbidden', 403);
    }

    await next();
  });
};
```

## Why CSS-Based Watermarking?

### Advantages
1. **Cloudflare Workers Compatibility**: No Jimp or external libraries needed
2. **Composability**: Works with any image transformation approach
3. **Performance**: Zero server overhead; applied at render time
4. **Maintenance**: Watermark styling controlled entirely in frontend
5. **Accessibility**: Alt text and semantic HTML preserved
6. **Flexibility**: Easy to customize appearance per-gallery or per-artist

### Limitations
1. **Right-Click Bypass**: Users with browser dev tools can extract the original image URL
2. **Screenshot Protection**: Cannot prevent full screenshot/screenshot tools
3. **Print Protection**: Watermark visible in print but requires CSS rule adjustments

### Mitigations
- Disable right-click on image (`onContextMenu` handler)
- Consider canvas-based approach for future (more robust but heavier)
- Educate users that watermark indicates proper attribution
- Terms of service prohibit redistribution

## Future Enhancements

### Canvas-Based Watermark (Stronger Protection)
For maximum protection against right-click saves:
1. Load image as canvas element
2. Render watermark as pixel overlay at specific coordinates
3. Export as data URL or blob
4. User would save watermarked composite

Trade-off: Increased complexity, larger bundle size, potential performance impact.

### Cloudflare Image Transformations with Draw Overlay
If future requirements demand server-side watermarking:
1. Use Cloudflare Image Transformations `draw` parameter
2. Overlay image must be in same Cloudflare zone
3. Would eliminate need for separate processing
4. URL becomes: `https://images.vfa.gallery/display/{userId}/{uuid}.jpg?draw=...`

Note: Not implemented initially due to overlay image zone requirements.
```

### 3. Export WatermarkedImage from UI Component Index

**File**: `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/ui/index.ts`

Add the following export (create file if it doesn't exist):

```typescript
export { WatermarkedImage } from './WatermarkedImage';
export type { WatermarkedImageProps } from './WatermarkedImage';
```

### 4. Update Artwork Display Page to Use WatermarkedImage

**File**: `/Volumes/DataSSD/gitsrc/vfa_gallery/src/pages/ArtworkPage.tsx`

Example usage in artwork detail view:

```typescript
import { WatermarkedImage } from '@/components/ui/WatermarkedImage';

export const ArtworkPage = ({ artwork, artist }) => {
  return (
    <div className="artwork-detail">
      <WatermarkedImage
        imageKey={artwork.imageKey}
        artistName={artist.username}
        alt={artwork.title}
        className="artwork-image"
        priority={true}
      />
      <div className="artwork-info">
        <h1>{artwork.title}</h1>
        <p>by {artist.displayName}</p>
        {/* ... rest of artwork details ... */}
      </div>
    </div>
  );
};
```

### 5. Add CSS for Enhanced Watermark Display (Optional)

**File**: `/Volumes/DataSSD/gitsrc/vfa_gallery/src/styles/watermark.css`

```css
/* Watermarked Image Container */
.watermarked-image-container {
  position: relative;
  overflow: hidden;
  background-color: #f5f5f5;
}

.watermarked-image-container img {
  display: block;
  width: 100%;
  height: auto;
  max-width: 100%;
}

/* Prevent image drag interactions */
.watermarked-image-container img {
  user-select: none;
  -webkit-user-drag: none;
}

/* Responsive watermark sizing for smaller screens */
@media (max-width: 768px) {
  .watermarked-image-container .watermark-overlay {
    bottom: 12px;
    right: 12px;
    font-size: 12px;
    padding: 6px 10px;
  }
}

/* Print styles - ensure watermark visible in print */
@media print {
  .watermarked-image-container .watermark-overlay {
    display: block !important;
  }
}
```

## Files to Create/Modify

| Path | Type | Purpose |
|------|------|---------|
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/ui/WatermarkedImage.tsx` | Create | React component for watermarked image display |
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/ui/index.ts` | Create/Modify | Export WatermarkedImage component |
| `/Volumes/DataSSD/gitsrc/vfa_gallery/docs/configuration/R2-ACCESS-CONTROL.md` | Create | Documentation for R2 access control strategy |
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/pages/ArtworkPage.tsx` | Modify | Update to use WatermarkedImage component |
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/styles/watermark.css` | Create | Optional CSS enhancements for watermark |

## Verification

### Test 1: Component Renders with Watermark
```bash
# In React component or test file
import { WatermarkedImage } from '@/components/ui/WatermarkedImage';

// Verify watermark text appears in DOM
render(
  <WatermarkedImage
    imageKey="user123/artwork-uuid.jpg"
    artistName="jane_doe"
    alt="Test Artwork"
  />
);

// Expected: Image rendered with watermark overlay showing "© jane_doe"
```

### Test 2: Right-Click Context Menu Disabled
1. Navigate to artwork detail page
2. Right-click on the watermarked image
3. Verify: Context menu does NOT appear (or shows custom message if implemented)

### Test 3: Image URL Uses Display Variant
1. Open browser DevTools (Network tab)
2. Display an artwork with WatermarkedImage component
3. Verify: Image URL is `https://images.vfa.gallery/display/{userId}/{uuid}.jpg`
4. Verify: No requests to `originals/` prefix paths

### Test 4: Watermark Visibility at Different Sizes
Test with various image dimensions:
- Small (800x600): Watermark readable, appropriate size
- Medium (2000x1500): Watermark proportional, readable
- Large (4000x3000): Watermark not overwhelming, bottom-right positioned correctly
- Mobile (< 768px): Watermark scales appropriately per CSS media query

### Test 5: Watermark with Special Characters
```typescript
<WatermarkedImage
  imageKey="user456/artwork.jpg"
  artistName="josé_garcía"
  alt="Test"
/>

// Expected: Watermark displays "© josé_garcía" with proper character rendering
```

### Test 6: R2 Access Control Verification
```bash
# Attempt to access originals prefix directly
curl -I "https://images.vfa.gallery/originals/userId/uuid.jpg"

# Expected Response: 403 Forbidden (or 404 if Transform Rule blocks)

# Attempt to access display prefix
curl -I "https://images.vfa.gallery/display/userId/uuid.jpg"

# Expected Response: 200 OK with image headers
```

### Test 7: Component Props Validation
Test with various prop combinations:
- With width/height: `<WatermarkedImage width={500} height={400} ... />`
- With custom className: `<WatermarkedImage className="gallery-image" ... />`
- With priority flag: `<WatermarkedImage priority={true} ... />`

All variations should render correctly with watermark overlay.

### Test 8: Watermark Positioning
1. Render watermarked image at fullscreen
2. Verify watermark stays in bottom-right corner with 16px padding
3. Verify watermark never overlaps critical artwork content
4. Verify watermark remains visible on images with dark bottom-right areas (semi-transparent background ensures readability)

## Notes

### Design Decisions

**CSS-Based Over Server-Side Watermarking**:
- Jimp library incompatible with Cloudflare Workers (CPU-bound, large memory)
- CSS approach leverages frontend capabilities without server processing
- Aligns with Hono/Cloudflare Pages architecture (serverless, stateless)
- Watermark styling centralized in component, easy to customize

**Pointer-Events: None**:
- Makes watermark layer non-interactive
- Users cannot accidentally click watermark instead of image
- Image remains fully clickable and interactive

**Right-Click Disabled**:
- Prevents direct image save via right-click > Save As
- Does not prevent advanced users with dev tools from accessing URL
- Acceptable trade-off: URL itself doesn't contain originals (blocked at CDN level)

**R2 Prefix Strategy**:
- `originals/` stored but never publicly accessible
- `display/` prefix served via CDN, this is the only public image path
- Prevents accidental exposure of original files
- Allows future server-side transformations if needed

**Watermark Styling Rationale**:
- Semi-transparent black background (rgba 0,0,0,0.5) ensures text contrast on any background
- White text (rgba 255,255,255,0.9) provides readability
- Bottom-right position: standard for watermarks, doesn't interfere with artwork focus (usually center)
- Text shadow adds subtle depth and readability
- No animation or hover effects: keeps performance optimal, maintains accessibility

### Future Enhancements

1. **Canvas-Based Watermarking**: For stronger protection against right-click save
   - Trade-off: Added complexity, larger bundle, potential performance impact
   - Revisit if gallery experiences significant unauthorized redistribution

2. **Watermark Customization**:
   - Per-artist watermark style preferences
   - Gallery-level watermark branding (e.g., "VFA Gallery" in corner)
   - Artist opt-in/opt-out for watermarking

3. **Digital Rights Management (DRM)**:
   - Metadata embedding (EXIF) with artist info
   - License information in metadata
   - Blockchain-based verification (future)

4. **Cloudflare Image Transformations**:
   - If future requirements demand server-side watermarking without Jimp
   - Use CF Image Transform `draw` parameter with overlay image in same zone
   - URL example: `https://images.vfa.gallery/display/{userId}/{uuid}.jpg?draw=overlay`

### Performance Considerations

- Watermark overlay is CSS-only: zero performance impact
- Image lazy-loading supported via `loading` prop
- Watermark applied at render time (not image download time)
- Bundle size: WatermarkedImage component ~2KB uncompressed

### Accessibility

- Image alt text preserved and required
- Watermark text not announced by screen readers (appropriate, as it's decorative overlay)
- Semantic HTML structure maintained
- Keyboard navigation unaffected
- Color contrast sufficient for WCAG AA compliance
