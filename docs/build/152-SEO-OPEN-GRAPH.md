# Build 152: SEO Open Graph Meta Tags

## Goal

Add Open Graph meta tags to all public pages for rich social media previews. Display page-specific information (artwork image, artist name, collection title) when links are shared on Facebook, LinkedIn, and other platforms.

---

## Spec Extract

From **01-TECHNICAL-SPEC.md** and UI/SEO Requirements:

- **Open Graph Meta Tags:**
  - `og:title` - Page title
  - `og:description` - Page description
  - `og:image` - Social preview image
  - `og:url` - Canonical page URL
  - `og:type` - Content type (website, profile, article)
  - `og:site_name` - VFA.gallery

- **Dynamic Content Based on Page Type:**
  - **Homepage:** Site title, site description, site logo
  - **Artist Profile:** Artist name, artist bio, artist avatar
  - **Gallery:** Gallery title, gallery description, gallery thumbnail
  - **Collection:** Collection title, collection description, first artwork image
  - **Artwork:** Artwork title, artwork description, artwork image

- **Image Requirements:**
  - Minimum 200x200 pixels
  - Recommended 1200x630 pixels (social standard)
  - JPEG or PNG format
  - Use `display_url` for artworks, `avatar_url` for artists

---

## Prerequisites

- **24-REACT-ROUTER-SETUP.md** - Router established with all routes
- **40-IMAGE-PIPELINE-ORCHESTRATION.md** - Image URLs available from API
- **77-API-PUBLIC-USER-GALLERIES.md** - Artist public endpoint working
- **84-API-PUBLIC-COLLECTION.md** - Collection public endpoint working

---

## Steps

### 1. Create Open Graph Meta Tag Utilities

Create **src/utils/openGraph.ts**:

```typescript
/**
 * Open Graph meta tag configuration
 */

export interface OpenGraphConfig {
  title: string;
  description: string;
  image: string;
  url: string;
  type?: 'website' | 'profile' | 'article' | 'image';
  siteName?: string;
  imageWidth?: number;
  imageHeight?: number;
  imageAlt?: string;
  author?: string;
  publishedTime?: string;
}

export interface SocialMeta {
  title: string;
  description: string;
  image: string;
  url: string;
  type: string;
}

/**
 * Set Open Graph meta tags
 */
export function setOpenGraphMeta(config: OpenGraphConfig) {
  // Remove any existing og:meta tags
  document.querySelectorAll('meta[property^="og:"]').forEach((el) => el.remove());
  document.querySelectorAll('meta[name^="twitter:"]').forEach((el) => el.remove());

  const { title, description, image, url, type = 'website', siteName = 'VFA.gallery' } = config;

  // Helper to create and append meta tag
  const setMeta = (property: string, content: string, isMeta = false) => {
    const meta = document.createElement('meta');
    if (isMeta) {
      meta.setAttribute('name', property);
    } else {
      meta.setAttribute('property', property);
    }
    meta.setAttribute('content', content);
    document.head.appendChild(meta);
  };

  // Core Open Graph tags
  setMeta('og:title', title);
  setMeta('og:description', description);
  setMeta('og:image', image);
  setMeta('og:url', url);
  setMeta('og:type', type);
  setMeta('og:site_name', siteName);

  // Image metadata
  if (config.imageWidth) {
    setMeta('og:image:width', config.imageWidth.toString());
  }
  if (config.imageHeight) {
    setMeta('og:image:height', config.imageHeight.toString());
  }
  if (config.imageAlt) {
    setMeta('og:image:alt', config.imageAlt);
  }

  // Optional article metadata
  if (config.type === 'article') {
    if (config.author) {
      setMeta('article:author', config.author);
    }
    if (config.publishedTime) {
      setMeta('article:published_time', config.publishedTime);
    }
  }

  // Also set description as regular meta tag for better compatibility
  setMeta('description', description, true);

  // Update canonical URL
  let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.rel = 'canonical';
    document.head.appendChild(canonical);
  }
  canonical.href = url;
}

/**
 * Get absolute URL for sharing
 */
export function getAbsoluteUrl(path: string): string {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://vfa.gallery';
  return `${baseUrl}${path}`;
}

/**
 * Sanitize text for meta tags (remove HTML, limit length)
 */
export function sanitizeMetaText(text: string | undefined, maxLength = 155): string {
  if (!text) return '';

  // Remove HTML tags
  let cleaned = text.replace(/<[^>]*>/g, '');
  // Decode HTML entities
  cleaned = cleaned
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'");
  // Limit length
  if (cleaned.length > maxLength) {
    cleaned = cleaned.substring(0, maxLength).trim() + '...';
  }

  return cleaned;
}

/**
 * Get image dimensions (for og:image:width/height)
 * Returns standard social dimensions: 1200x630
 */
export function getSocialImageDimensions(): { width: number; height: number } {
  return { width: 1200, height: 630 };
}
```

### 2. Create Page-Specific Meta Tag Hooks

Create **src/hooks/useOpenGraph.ts**:

```typescript
import { useEffect } from 'react';
import { setOpenGraphMeta, getAbsoluteUrl, sanitizeMetaText, getSocialImageDimensions } from '../utils/openGraph';

interface UseOpenGraphProps {
  title: string;
  description?: string;
  image?: string;
  imageAlt?: string;
  type?: 'website' | 'profile' | 'article' | 'image';
  path: string;
  publishedTime?: string;
  author?: string;
}

/**
 * Hook to update Open Graph meta tags
 * Usage:
 * const { width, height } = getSocialImageDimensions();
 * useOpenGraph({
 *   title: 'My Artwork',
 *   description: 'A beautiful piece',
 *   image: 'https://...',
 *   imageAlt: 'My Artwork',
 *   path: '/artist/my-gallery/my-artwork',
 *   type: 'image'
 * });
 */
export function useOpenGraph({
  title,
  description = '',
  image = '/default-og-image.png',
  imageAlt = title,
  type = 'website',
  path,
  publishedTime,
  author,
}: UseOpenGraphProps) {
  useEffect(() => {
    const dims = getSocialImageDimensions();
    setOpenGraphMeta({
      title: sanitizeMetaText(title, 60), // Twitter limit
      description: sanitizeMetaText(description, 155), // Meta description standard
      image,
      imageAlt,
      imageWidth: dims.width,
      imageHeight: dims.height,
      url: getAbsoluteUrl(path),
      type,
      publishedTime,
      author,
    });
  }, [title, description, image, imageAlt, type, path, publishedTime, author]);
}
```

### 3. Update Homepage with Open Graph Meta Tags

Update **src/pages/HomePage.tsx**:

```typescript
import { useOpenGraph } from '../hooks/useOpenGraph';

export default function HomePage() {
  useOpenGraph({
    title: 'VFA.gallery - Emerging Visual Fine Artists',
    description:
      'Discover and support emerging visual fine artists. Optimized for comics, manga, and digital art creators.',
    image: '/og-homepage.png', // Create this image file
    imageAlt: 'VFA.gallery homepage',
    type: 'website',
    path: '/',
  });

  return (
    <div>
      {/* Homepage content */}
    </div>
  );
}
```

### 4. Update Artist Profile Page with Open Graph Meta Tags

Update **src/pages/ArtistProfilePage.tsx**:

```typescript
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useOpenGraph } from '../hooks/useOpenGraph';
import { sanitizeMetaText } from '../utils/openGraph';

interface ArtistData {
  name: string;
  slug: string;
  bio?: string;
  avatar_url?: string;
}

export default function ArtistProfilePage() {
  const { artistSlug } = useParams<{ artistSlug: string }>();
  const [artist, setArtist] = useState<ArtistData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch artist data from API
    const fetchArtist = async () => {
      try {
        const response = await fetch(`/api/public/users/${artistSlug}`);
        const data = await response.json();
        setArtist(data);
      } catch (error) {
        console.error('Failed to fetch artist:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchArtist();
  }, [artistSlug]);

  useOpenGraph({
    title: artist?.name || 'Artist Profile',
    description: sanitizeMetaText(artist?.bio, 155) || `View artworks by ${artist?.name || 'this artist'}`,
    image: artist?.avatar_url || '/default-avatar.png',
    imageAlt: artist?.name || 'Artist profile picture',
    type: 'profile',
    path: `/${artistSlug}`,
  });

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      {/* Artist profile content */}
    </div>
  );
}
```

### 5. Update Gallery Page with Open Graph Meta Tags

Update **src/pages/GalleryPage.tsx**:

```typescript
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useOpenGraph } from '../hooks/useOpenGraph';
import { sanitizeMetaText } from '../utils/openGraph';

interface GalleryData {
  title: string;
  slug: string;
  description?: string;
  thumbnail_url?: string;
  artist_slug?: string;
}

export default function GalleryPage() {
  const { artistSlug, gallerySlug } = useParams<{ artistSlug: string; gallerySlug: string }>();
  const [gallery, setGallery] = useState<GalleryData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchGallery = async () => {
      try {
        const response = await fetch(`/api/public/users/${artistSlug}/galleries/${gallerySlug}`);
        const data = await response.json();
        setGallery(data);
      } catch (error) {
        console.error('Failed to fetch gallery:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchGallery();
  }, [artistSlug, gallerySlug]);

  useOpenGraph({
    title: gallery?.title || 'Gallery',
    description: sanitizeMetaText(gallery?.description, 155) || `Gallery by ${artistSlug}`,
    image: gallery?.thumbnail_url || '/default-gallery.png',
    imageAlt: gallery?.title || 'Gallery thumbnail',
    type: 'website',
    path: `/${artistSlug}/${gallerySlug}`,
  });

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      {/* Gallery content */}
    </div>
  );
}
```

### 6. Update Collection Page with Open Graph Meta Tags

Update **src/pages/CollectionPage.tsx**:

```typescript
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useOpenGraph } from '../hooks/useOpenGraph';
import { sanitizeMetaText } from '../utils/openGraph';

interface CollectionData {
  title: string;
  slug: string;
  description?: string;
  artworks?: Array<{ display_url?: string; title?: string }>;
}

export default function CollectionPage() {
  const { artistSlug, gallerySlug, collectionSlug } = useParams<{
    artistSlug: string;
    gallerySlug: string;
    collectionSlug: string;
  }>();
  const [collection, setCollection] = useState<CollectionData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCollection = async () => {
      try {
        const response = await fetch(
          `/api/public/collections/${collectionSlug}?artist=${artistSlug}&gallery=${gallerySlug}`
        );
        const data = await response.json();
        setCollection(data);
      } catch (error) {
        console.error('Failed to fetch collection:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCollection();
  }, [artistSlug, gallerySlug, collectionSlug]);

  // Use first artwork image if available
  const previewImage = collection?.artworks?.[0]?.display_url || '/default-collection.png';

  useOpenGraph({
    title: collection?.title || 'Collection',
    description: sanitizeMetaText(collection?.description, 155) || `Collection in ${gallerySlug} by ${artistSlug}`,
    image: previewImage,
    imageAlt: collection?.artworks?.[0]?.title || collection?.title || 'Collection image',
    type: 'website',
    path: `/${artistSlug}/${gallerySlug}/${collectionSlug}`,
  });

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      {/* Collection content */}
    </div>
  );
}
```

### 7. Update Artwork Page with Open Graph Meta Tags

Update **src/pages/ArtworkPage.tsx**:

```typescript
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useOpenGraph } from '../hooks/useOpenGraph';
import { sanitizeMetaText } from '../utils/openGraph';

interface ArtworkData {
  title: string;
  slug: string;
  description?: string;
  display_url: string;
  created_at?: string;
  artist_slug?: string;
}

export default function ArtworkPage() {
  const { artistSlug, gallerySlug, collectionSlug, artworkSlug } = useParams<{
    artistSlug: string;
    gallerySlug: string;
    collectionSlug: string;
    artworkSlug: string;
  }>();
  const [artwork, setArtwork] = useState<ArtworkData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchArtwork = async () => {
      try {
        const response = await fetch(
          `/api/public/artworks/${artworkSlug}?artist=${artistSlug}&gallery=${gallerySlug}&collection=${collectionSlug}`
        );
        const data = await response.json();
        setArtwork(data);
      } catch (error) {
        console.error('Failed to fetch artwork:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchArtwork();
  }, [artworkSlug, artistSlug, gallerySlug, collectionSlug]);

  useOpenGraph({
    title: artwork?.title || 'Artwork',
    description: sanitizeMetaText(artwork?.description, 155) || `Artwork by ${artistSlug}`,
    image: artwork?.display_url || '/default-artwork.png',
    imageAlt: artwork?.title || 'Artwork image',
    type: 'image',
    path: `/${artistSlug}/${gallerySlug}/${collectionSlug}/${artworkSlug}`,
    publishedTime: artwork?.created_at,
    author: artistSlug,
  });

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      {/* Artwork content */}
    </div>
  );
}
```

### 8. Create Default Open Graph Images

Create placeholder images in **public/og-images/**:

```bash
mkdir -p /Volumes/DataSSD/gitsrc/vfa_gallery/site/public/og-images
```

Files to create (1200x630px PNG images):
- `og-homepage.png` - VFA.gallery logo + text
- `default-avatar.png` - Generic artist avatar icon
- `default-gallery.png` - Generic gallery thumbnail
- `default-collection.png` - Generic collection thumbnail
- `default-artwork.png` - Generic artwork placeholder

### 9. Add Open Graph Meta Tag to Base HTML

Update **site/index.html** with default og:meta tags:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />

    <!-- Open Graph Meta Tags (defaults, will be overridden by useOpenGraph hook) -->
    <meta property="og:title" content="VFA.gallery - Emerging Visual Fine Artists" />
    <meta property="og:description" content="Discover and support emerging visual fine artists." />
    <meta property="og:image" content="https://vfa.gallery/og-images/og-homepage.png" />
    <meta property="og:url" content="https://vfa.gallery" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="VFA.gallery" />

    <!-- Fallback for other platforms -->
    <meta name="description" content="Discover and support emerging visual fine artists." />

    <!-- Canonical URL -->
    <link rel="canonical" href="https://vfa.gallery" />

    <title>VFA.gallery</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

---

## Files to Create/Modify

### Create:
- `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/utils/openGraph.ts`
- `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/hooks/useOpenGraph.ts`
- `/Volumes/DataSSD/gitsrc/vfa_gallery/site/public/og-images/og-homepage.png`
- `/Volumes/DataSSD/gitsrc/vfa_gallery/site/public/og-images/default-avatar.png`
- `/Volumes/DataSSD/gitsrc/vfa_gallery/site/public/og-images/default-gallery.png`
- `/Volumes/DataSSD/gitsrc/vfa_gallery/site/public/og-images/default-collection.png`
- `/Volumes/DataSSD/gitsrc/vfa_gallery/site/public/og-images/default-artwork.png`

### Modify:
- `/Volumes/DataSSD/gitsrc/vfa_gallery/site/index.html`
- `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/pages/HomePage.tsx`
- `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/pages/ArtistProfilePage.tsx`
- `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/pages/GalleryPage.tsx`
- `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/pages/CollectionPage.tsx`
- `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/pages/ArtworkPage.tsx`

---

## Verification

### 1. Test Homepage Open Graph Tags

Open DevTools (F12) → Elements tab on homepage and verify:

```html
<meta property="og:title" content="VFA.gallery - Emerging Visual Fine Artists" />
<meta property="og:description" content="Discover and support emerging visual fine artists..." />
<meta property="og:image" content="https://vfa.gallery/og-images/og-homepage.png" />
<meta property="og:url" content="https://vfa.gallery/" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="VFA.gallery" />
```

### 2. Test Artist Profile Open Graph Tags

Navigate to `/{artist-slug}` and verify:

```html
<meta property="og:title" content="[Artist Name]" />
<meta property="og:description" content="[Artist Bio]..." />
<meta property="og:image" content="[Artist Avatar URL]" />
<meta property="og:url" content="https://vfa.gallery/[artist-slug]" />
<meta property="og:type" content="profile" />
```

### 3. Test Gallery Open Graph Tags

Navigate to `/{artist-slug}/{gallery-slug}` and verify correct gallery metadata.

### 4. Test Collection Open Graph Tags

Navigate to `/{artist-slug}/{gallery-slug}/{collection-slug}` and verify correct collection metadata with first artwork image.

### 5. Test Artwork Open Graph Tags

Navigate to `/{artist-slug}/{gallery-slug}/{collection-slug}/{artwork-slug}` and verify:

```html
<meta property="og:type" content="image" />
<meta property="og:image" content="[Artwork Display URL]" />
<meta property="article:author" content="[Artist Slug]" />
<meta property="article:published_time" content="[Creation Date]" />
```

### 6. Test Social Media Preview (Facebook)

Use Facebook's Sharing Debugger (https://developers.facebook.com/tools/debug/sharing/):

1. Enter artwork URL
2. Verify: Title, description, and image display correctly
3. Image should be 1200x630px
4. Title should be truncated to ~60 characters
5. Description should be truncated to ~155 characters

### 7. Test Social Media Preview (LinkedIn)

Navigate to LinkedIn Share Inspector (https://www.linkedin.com/inspector/):

1. Enter artwork URL
2. Verify: Title, description, and image display correctly
3. Author tag visible if applicable

### 8. Test Canonical URL

In DevTools, verify each page has correct canonical link:

```html
<link rel="canonical" href="https://vfa.gallery/[correct-path]" />
```

### 9. Test TypeScript

```bash
npx tsc --noEmit
```

Should have no errors in strict mode.

### 10. Test Browser DevTools

Navigate to various pages and verify in DevTools:
- All og: tags present
- No duplicate og: tags
- Image URLs are absolute (start with http/https)
- URL tags match current page location

---

## Success Criteria

- All public pages have Open Graph meta tags
- Artwork pages use `og:type="image"` with proper author/publish metadata
- Artist/gallery pages use `og:type="profile"` or `og:type="website"` as appropriate
- Images are absolute URLs (1200x630px or larger)
- Text content (title, description) is properly sanitized and truncated
- Canonical URL correctly set on all pages
- Facebook/LinkedIn preview shows correct title, description, and image
- No duplicate meta tags after navigation
- TypeScript strict mode passes
- No console errors related to meta tag updates
