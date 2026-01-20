# Build 153: SEO Twitter Card Meta Tags

## Goal

Add Twitter Card meta tags to all public pages for rich Twitter previews. Display artwork images and proper text formatting when links are shared on Twitter/X.

---

## Spec Extract

From **01-TECHNICAL-SPEC.md** and SEO Requirements:

- **Twitter Card Meta Tags:**
  - `twitter:card` - Card type (summary_large_image for rich media, summary for text)
  - `twitter:title` - Page title
  - `twitter:description` - Page description
  - `twitter:image` - Preview image
  - `twitter:site` - Twitter handle (@vfagallery or similar)
  - `twitter:creator` - Artist's Twitter handle (if available)

- **Card Types:**
  - **Homepage/Gallery/Collection:** `summary_large_image` - Large image with text
  - **Artwork Pages:** `summary_large_image` - Large artwork image for maximum impact
  - **Artist Profile:** `summary` - Text summary with avatar
  - **Browse/Search:** `summary_large_image` - Featured artwork

- **Image Requirements:**
  - Same as Open Graph: 1200x630px recommended, minimum 200x200px
  - JPEG or PNG format
  - Aspect ratio 2:1 (landscape)

---

## Prerequisites

- **152-SEO-OPEN-GRAPH.md** - Open Graph meta tags already implemented
- **24-REACT-ROUTER-SETUP.md** - Router configured with all public routes
- **40-IMAGE-PIPELINE-ORCHESTRATION.md** - Image URLs available from API

---

## Steps

### 1. Create Twitter Card Utilities

Create **src/utils/twitterCard.ts**:

```typescript
/**
 * Twitter Card meta tag configuration
 */

export type TwitterCardType = 'summary' | 'summary_large_image' | 'app' | 'player';

export interface TwitterCardConfig {
  card: TwitterCardType;
  title: string;
  description: string;
  image: string;
  site?: string; // @vfagallery
  creator?: string; // Artist's Twitter handle
  imageAlt?: string;
}

/**
 * Set Twitter Card meta tags
 */
export function setTwitterCardMeta(config: TwitterCardConfig) {
  // Remove any existing twitter: meta tags
  document.querySelectorAll('meta[name^="twitter:"]').forEach((el) => el.remove());

  const { card, title, description, image, site = '@vfagallery', creator, imageAlt } = config;

  // Helper to create and append meta tag
  const setMeta = (name: string, content: string) => {
    const meta = document.createElement('meta');
    meta.setAttribute('name', name);
    meta.setAttribute('content', content);
    document.head.appendChild(meta);
  };

  // Core Twitter Card tags
  setMeta('twitter:card', card);
  setMeta('twitter:title', title);
  setMeta('twitter:description', description);
  setMeta('twitter:image', image);
  setMeta('twitter:site', site);

  // Optional creator
  if (creator) {
    setMeta('twitter:creator', creator);
  }

  // Image alt text for accessibility
  if (imageAlt) {
    setMeta('twitter:image:alt', imageAlt);
  }
}

/**
 * Determine Twitter card type based on content
 */
export function getTwitterCardType(pageType: 'homepage' | 'artist' | 'gallery' | 'collection' | 'artwork' | 'browse'): TwitterCardType {
  // Artwork and gallery pages get large image cards for maximum impact
  if (pageType === 'artwork' || pageType === 'gallery' || pageType === 'collection' || pageType === 'browse') {
    return 'summary_large_image';
  }
  // Artist profile and homepage use standard summary
  return 'summary_large_image'; // For VFA.gallery, we always want large images
}
```

### 2. Create Twitter Card Hook

Create **src/hooks/useTwitterCard.ts**:

```typescript
import { useEffect } from 'react';
import { setTwitterCardMeta, getTwitterCardType, TwitterCardType } from '../utils/twitterCard';
import { sanitizeMetaText } from '../utils/openGraph';

interface UseTwitterCardProps {
  title: string;
  description?: string;
  image?: string;
  imageAlt?: string;
  pageType: 'homepage' | 'artist' | 'gallery' | 'collection' | 'artwork' | 'browse';
  site?: string; // Default: @vfagallery
  creator?: string; // Artist's Twitter handle
  card?: TwitterCardType; // Override auto-detected type
}

/**
 * Hook to update Twitter Card meta tags
 * Usage:
 * useTwitterCard({
 *   title: 'Amazing Artwork',
 *   description: 'A stunning piece by @artist',
 *   image: 'https://...',
 *   imageAlt: 'Amazing Artwork by Artist',
 *   pageType: 'artwork',
 *   creator: '@artist'
 * });
 */
export function useTwitterCard({
  title,
  description = '',
  image = '/default-og-image.png',
  imageAlt = title,
  pageType,
  site = '@vfagallery',
  creator,
  card,
}: UseTwitterCardProps) {
  useEffect(() => {
    const cardType = card || getTwitterCardType(pageType);

    setTwitterCardMeta({
      card: cardType,
      title: sanitizeMetaText(title, 70), // Twitter title limit
      description: sanitizeMetaText(description, 200), // Twitter description limit
      image,
      imageAlt,
      site,
      creator,
    });
  }, [title, description, image, imageAlt, pageType, site, creator, card]);
}
```

### 3. Update Homepage with Twitter Card

Update **src/pages/HomePage.tsx**:

```typescript
import { useOpenGraph } from '../hooks/useOpenGraph';
import { useTwitterCard } from '../hooks/useTwitterCard';

export default function HomePage() {
  useOpenGraph({
    title: 'VFA.gallery - Emerging Visual Fine Artists',
    description:
      'Discover and support emerging visual fine artists. Optimized for comics, manga, and digital art creators.',
    image: '/og-images/og-homepage.png',
    imageAlt: 'VFA.gallery homepage',
    type: 'website',
    path: '/',
  });

  useTwitterCard({
    title: 'VFA.gallery - Emerging Visual Fine Artists',
    description:
      'Discover and support emerging visual fine artists. Optimized for comics, manga, and digital art creators.',
    image: '/og-images/og-homepage.png',
    imageAlt: 'VFA.gallery homepage',
    pageType: 'homepage',
  });

  return (
    <div>
      {/* Homepage content */}
    </div>
  );
}
```

### 4. Update Artist Profile with Twitter Card

Update **src/pages/ArtistProfilePage.tsx**:

```typescript
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useOpenGraph } from '../hooks/useOpenGraph';
import { useTwitterCard } from '../hooks/useTwitterCard';
import { sanitizeMetaText } from '../utils/openGraph';

interface ArtistData {
  name: string;
  slug: string;
  bio?: string;
  avatar_url?: string;
  twitter_handle?: string; // Optional field for artist's Twitter handle
}

export default function ArtistProfilePage() {
  const { artistSlug } = useParams<{ artistSlug: string }>();
  const [artist, setArtist] = useState<ArtistData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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

  const description = sanitizeMetaText(artist?.bio, 155) || `View artworks by ${artist?.name || 'this artist'}`;
  const creatorHandle = artist?.twitter_handle ? `@${artist.twitter_handle.replace(/^@/, '')}` : undefined;

  useOpenGraph({
    title: artist?.name || 'Artist Profile',
    description,
    image: artist?.avatar_url || '/default-avatar.png',
    imageAlt: artist?.name || 'Artist profile picture',
    type: 'profile',
    path: `/${artistSlug}`,
  });

  useTwitterCard({
    title: artist?.name || 'Artist Profile',
    description,
    image: artist?.avatar_url || '/default-avatar.png',
    imageAlt: artist?.name || 'Artist profile picture',
    pageType: 'artist',
    creator: creatorHandle,
  });

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      {/* Artist profile content */}
    </div>
  );
}
```

### 5. Update Gallery Page with Twitter Card

Update **src/pages/GalleryPage.tsx**:

```typescript
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useOpenGraph } from '../hooks/useOpenGraph';
import { useTwitterCard } from '../hooks/useTwitterCard';
import { sanitizeMetaText } from '../utils/openGraph';

interface GalleryData {
  title: string;
  slug: string;
  description?: string;
  thumbnail_url?: string;
  artist_slug?: string;
  artist_name?: string;
  artist_twitter_handle?: string;
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

  const description = sanitizeMetaText(gallery?.description, 155) || `Gallery by ${gallery?.artist_name || artistSlug}`;
  const creatorHandle = gallery?.artist_twitter_handle ? `@${gallery.artist_twitter_handle.replace(/^@/, '')}` : undefined;

  useOpenGraph({
    title: gallery?.title || 'Gallery',
    description,
    image: gallery?.thumbnail_url || '/default-gallery.png',
    imageAlt: gallery?.title || 'Gallery thumbnail',
    type: 'website',
    path: `/${artistSlug}/${gallerySlug}`,
  });

  useTwitterCard({
    title: gallery?.title || 'Gallery',
    description,
    image: gallery?.thumbnail_url || '/default-gallery.png',
    imageAlt: gallery?.title || 'Gallery thumbnail',
    pageType: 'gallery',
    creator: creatorHandle,
  });

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      {/* Gallery content */}
    </div>
  );
}
```

### 6. Update Collection Page with Twitter Card

Update **src/pages/CollectionPage.tsx**:

```typescript
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useOpenGraph } from '../hooks/useOpenGraph';
import { useTwitterCard } from '../hooks/useTwitterCard';
import { sanitizeMetaText } from '../utils/openGraph';

interface CollectionData {
  title: string;
  slug: string;
  description?: string;
  artworks?: Array<{ display_url?: string; title?: string }>;
  artist_name?: string;
  artist_twitter_handle?: string;
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

  const previewImage = collection?.artworks?.[0]?.display_url || '/default-collection.png';
  const description = sanitizeMetaText(collection?.description, 155) || `Collection by ${collection?.artist_name || artistSlug}`;
  const creatorHandle = collection?.artist_twitter_handle ? `@${collection.artist_twitter_handle.replace(/^@/, '')}` : undefined;

  useOpenGraph({
    title: collection?.title || 'Collection',
    description,
    image: previewImage,
    imageAlt: collection?.artworks?.[0]?.title || collection?.title || 'Collection image',
    type: 'website',
    path: `/${artistSlug}/${gallerySlug}/${collectionSlug}`,
  });

  useTwitterCard({
    title: collection?.title || 'Collection',
    description,
    image: previewImage,
    imageAlt: collection?.artworks?.[0]?.title || collection?.title || 'Collection image',
    pageType: 'collection',
    creator: creatorHandle,
  });

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      {/* Collection content */}
    </div>
  );
}
```

### 7. Update Artwork Page with Twitter Card

Update **src/pages/ArtworkPage.tsx**:

```typescript
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useOpenGraph } from '../hooks/useOpenGraph';
import { useTwitterCard } from '../hooks/useTwitterCard';
import { sanitizeMetaText } from '../utils/openGraph';

interface ArtworkData {
  title: string;
  slug: string;
  description?: string;
  display_url: string;
  created_at?: string;
  artist_slug?: string;
  artist_name?: string;
  artist_twitter_handle?: string;
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

  const description = sanitizeMetaText(artwork?.description, 155) || `Artwork by ${artwork?.artist_name || artistSlug}`;
  const creatorHandle = artwork?.artist_twitter_handle ? `@${artwork.artist_twitter_handle.replace(/^@/, '')}` : undefined;

  useOpenGraph({
    title: artwork?.title || 'Artwork',
    description,
    image: artwork?.display_url || '/default-artwork.png',
    imageAlt: artwork?.title || 'Artwork image',
    type: 'image',
    path: `/${artistSlug}/${gallerySlug}/${collectionSlug}/${artworkSlug}`,
    publishedTime: artwork?.created_at,
    author: artistSlug,
  });

  useTwitterCard({
    title: artwork?.title || 'Artwork',
    description,
    image: artwork?.display_url || '/default-artwork.png',
    imageAlt: artwork?.title || 'Artwork image',
    pageType: 'artwork',
    creator: creatorHandle,
    card: 'summary_large_image', // Always use large image for artworks
  });

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      {/* Artwork content */}
    </div>
  );
}
```

### 8. Add Twitter Card to Base HTML

Update **site/index.html** with default Twitter Card tags:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />

    <!-- Twitter Card Meta Tags (defaults, will be overridden by useTwitterCard hook) -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="VFA.gallery - Emerging Visual Fine Artists" />
    <meta name="twitter:description" content="Discover and support emerging visual fine artists." />
    <meta name="twitter:image" content="https://vfa.gallery/og-images/og-homepage.png" />
    <meta name="twitter:site" content="@vfagallery" />

    <!-- Open Graph Meta Tags (from build 152) -->
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
- `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/utils/twitterCard.ts`
- `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/hooks/useTwitterCard.ts`

### Modify:
- `/Volumes/DataSSD/gitsrc/vfa_gallery/site/index.html`
- `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/pages/HomePage.tsx`
- `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/pages/ArtistProfilePage.tsx`
- `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/pages/GalleryPage.tsx`
- `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/pages/CollectionPage.tsx`
- `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/pages/ArtworkPage.tsx`

---

## Verification

### 1. Test Twitter Card Meta Tags on Artwork Page

Open DevTools (F12) → Elements on an artwork page and verify:

```html
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="[Artwork Title]" />
<meta name="twitter:description" content="[Artwork Description]..." />
<meta name="twitter:image" content="https://[artwork-display-url]" />
<meta name="twitter:site" content="@vfagallery" />
<meta name="twitter:creator" content="@[artist-twitter]" />
<meta name="twitter:image:alt" content="[Artwork Title]" />
```

### 2. Test Twitter Card on Homepage

Verify homepage has proper Twitter Card tags with:
- `twitter:card` = `summary_large_image`
- `twitter:image` = logo/homepage image
- No `twitter:creator` (site-level, not creator)

### 3. Test Twitter Card on Artist Profile

Verify artist profile has:
- `twitter:card` = `summary_large_image`
- `twitter:image` = artist avatar
- `twitter:creator` = artist's Twitter handle (if available)

### 4. Test Twitter Card on Gallery/Collection

Verify gallery/collection has:
- `twitter:card` = `summary_large_image`
- `twitter:image` = gallery thumbnail or first artwork
- `twitter:creator` = artist's Twitter handle (if available)

### 5. Test Twitter Card Preview

Use Twitter's Card Validator (https://cards-dev.twitter.com/validator):

1. Enter artwork URL
2. Verify:
   - Large image displays correctly (1200x630 or similar)
   - Title shows correctly (truncated to ~70 chars)
   - Description shows correctly (truncated to ~200 chars)
   - Creator attribution visible
   - No errors or warnings

### 6. Test Multiple Page Types

Test Twitter cards on:
- Homepage
- Artist profile page
- Gallery page
- Collection page
- Artwork page (primary focus)
- Browse/featured artwork page

### 7. Test Twitter Handle Formatting

Verify creator handles are properly formatted:
- If stored as `@artisthandle`, should appear as `@artisthandle`
- If stored as `artisthandle`, should be converted to `@artisthandle`
- Missing handles should not create empty `twitter:creator` tag

### 8. Test Image Dimensions

Verify all `twitter:image` URLs point to:
- Absolute URLs (http/https)
- Valid image files
- Proper dimensions (1200x630px ideal for summary_large_image)
- Accessible and not blocked by CORS

### 9. Test TypeScript

```bash
npx tsc --noEmit
```

Should have no errors in strict mode.

### 10. Test Meta Tag Updates on Navigation

1. Start on homepage
2. Navigate to artwork page
3. Verify Twitter Card meta tags update correctly:
   - Old tags replaced (not duplicated)
   - New image URL loaded
   - Creator handle updated

### 11. Test Accessibility

Verify all Twitter Card images have alt text:
```html
<meta name="twitter:image:alt" content="[descriptive text]" />
```

---

## Success Criteria

- Twitter Card meta tags present on all public pages
- Artwork pages show rich preview with large image
- Profile/gallery pages show appropriate preview
- Images are absolute URLs (1200x630px minimum)
- Text content is sanitized and properly truncated
- Creator handles properly formatted with @ prefix
- Twitter Card Validator shows no errors
- Rich preview displays correctly on Twitter/X
- No duplicate meta tags after navigation
- TypeScript strict mode passes
- Meta tags update when navigating between pages
