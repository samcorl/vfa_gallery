# Build 89: Public Artwork Detail Page

## Goal

Create the public artwork detail page at `/:artist/:gallery/:collection/:artwork` that displays the full artwork with large display image, metadata, artist credit, breadcrumbs, and previous/next navigation.

---

## Spec Extract

**Route:** `/:artist/:gallery/:collection/:artwork`

**Page Features:**
- Large display image (full height on desktop, full width on mobile)
- Artwork title and description
- Image metadata: dimensions, upload date
- Artist credit with link to artist profile
- Breadcrumbs: Artist > Gallery > Collection > Artwork
- Previous/Next artwork navigation
- SEO metadata for sharing
- Responsive layout (mobile-first)
- No authentication required

**Responsive Behavior:**
- Mobile: Full-width image, stacked layout
- Tablet: Image takes ~60% width, metadata sidebar
- Desktop: Image left, sidebar right with metadata

---

## Prerequisites

**Must complete before starting:**
- **88-API-PUBLIC-ARTWORK.md** - Artwork API endpoint
- **24-REACT-ROUTER-SETUP.md** - Router configured
- **87-UI-PUBLIC-COLLECTION-NAV.md** - Navigation patterns

**Reason:** This page depends on the artwork API and router setup.

---

## Steps

### Step 1: Create Artwork Detail Page Component

Create the main artwork page:

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/pages/PublicArtworkPage.tsx`

```typescript
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { PublicArtworkResponse } from '../types/public';
import ArtworkDisplay from '../components/public/ArtworkDisplay';
import ArtworkMetadata from '../components/public/ArtworkMetadata';
import ArtworkBreadcrumbs from '../components/public/ArtworkBreadcrumbs';
import ArtworkNavigation from '../components/public/ArtworkNavigation';
import ErrorFallback from '../components/ErrorFallback';
import { useToast } from '../context/ToastContext';

interface ArtworkData {
  data: PublicArtworkResponse;
}

export default function PublicArtworkPage() {
  const { artist, gallery, collection, artwork } = useParams<{
    artist: string;
    gallery: string;
    collection: string;
    artwork: string;
  }>();

  const [artworkData, setArtworkData] = useState<ArtworkData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!artist || !gallery || !collection || !artwork) {
      setError('Missing path parameters');
      setIsLoading(false);
      return;
    }

    const fetchArtwork = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(
          `/api/g/${encodeURIComponent(artist)}/${encodeURIComponent(gallery)}/${encodeURIComponent(collection)}/${encodeURIComponent(artwork)}`
        );

        if (!response.ok) {
          if (response.status === 404) {
            setError('Artwork not found');
          } else {
            setError('Failed to load artwork');
          }
          setIsLoading(false);
          return;
        }

        const data = await response.json();
        setArtworkData(data);

        // Set page title and meta tags
        document.title = `${data.data.title} by ${data.data.artist.displayName || data.data.artist.username} - VFA Gallery`;
        updateMetaTags(data.data);
      } catch (err) {
        console.error('Error fetching artwork:', err);
        setError('Failed to load artwork');
      } finally {
        setIsLoading(false);
      }
    };

    fetchArtwork();
  }, [artist, gallery, collection, artwork]);

  const updateMetaTags = (art: PublicArtworkResponse) => {
    const ogTitle = document.querySelector('meta[property="og:title"]') ||
      document.createElement('meta');
    ogTitle.setAttribute('property', 'og:title');
    ogTitle.setAttribute('content', art.title);
    document.head.appendChild(ogTitle);

    const ogDescription = document.querySelector('meta[property="og:description"]') ||
      document.createElement('meta');
    ogDescription.setAttribute('property', 'og:description');
    ogDescription.setAttribute('content', art.description || 'View this artwork');
    document.head.appendChild(ogDescription);

    const ogImage = document.querySelector('meta[property="og:image"]') ||
      document.createElement('meta');
    ogImage.setAttribute('property', 'og:image');
    ogImage.setAttribute('content', art.displayUrl);
    document.head.appendChild(ogImage);

    const ogType = document.querySelector('meta[property="og:type"]') ||
      document.createElement('meta');
    ogType.setAttribute('property', 'og:type');
    ogType.setAttribute('content', 'image');
    document.head.appendChild(ogType);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 dark:border-white" />
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading artwork...</p>
        </div>
      </div>
    );
  }

  if (error || !artworkData) {
    return <ErrorFallback message={error || 'Failed to load artwork'} />;
  }

  const { data: art } = artworkData;

  return (
    <div>
      {/* Breadcrumbs */}
      <div className="px-4 py-3 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <ArtworkBreadcrumbs artwork={art} />
      </div>

      {/* Main Content */}
      <div className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Artwork Display - Takes 2 columns on large screens */}
          <div className="lg:col-span-2">
            <ArtworkDisplay artwork={art} />
          </div>

          {/* Metadata Sidebar */}
          <div className="lg:col-span-1">
            <ArtworkMetadata artwork={art} />
          </div>
        </div>

        {/* Navigation */}
        {(art.navigation.previousArtwork || art.navigation.nextArtwork) && (
          <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
            <ArtworkNavigation
              previousArtwork={art.navigation.previousArtwork}
              nextArtwork={art.navigation.nextArtwork}
              artist={art.artist.username}
              gallery={art.parent.gallery.slug}
              collection={art.parent.collection.slug}
            />
          </div>
        )}
      </div>
    </div>
  );
}
```

### Step 2: Create Artwork Display Component

Create the image display component:

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/public/ArtworkDisplay.tsx`

```typescript
import React, { useState } from 'react';
import type { PublicArtworkResponse } from '../../types/public';
import ArtworkZoom from './ArtworkZoom';

interface ArtworkDisplayProps {
  artwork: PublicArtworkResponse;
}

export default function ArtworkDisplay({ artwork }: ArtworkDisplayProps) {
  const [showZoom, setShowZoom] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <>
      {/* Image Container */}
      <div className="bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
        {/* Mobile: Responsive width */}
        <div className="relative w-full">
          {!imageLoaded && !imageFailed && (
            <div className="absolute inset-0 bg-gray-200 dark:bg-gray-700 animate-pulse" />
          )}

          {imageFailed ? (
            <div className="w-full aspect-square flex items-center justify-center bg-gray-100 dark:bg-gray-800">
              <div className="text-center">
                <svg
                  className="w-12 h-12 text-gray-400 mx-auto mb-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="m2.25 15.75l5.159-5.159a2.25 2.25 0 012.12-.912l6.519.659a2.25 2.25 0 012.12.912l5.158 5.159m-1.5-4.5l.75.75m-2.25 2.25l.75.75"
                  />
                </svg>
                <p className="text-gray-500 dark:text-gray-400">Failed to load image</p>
              </div>
            </div>
          ) : (
            <img
              src={artwork.displayUrl}
              alt={artwork.title}
              className={`w-full h-auto transition-opacity duration-300 cursor-zoom-in hover:opacity-90 ${
                imageLoaded ? 'opacity-100' : 'opacity-0'
              }`}
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageFailed(true)}
              onClick={() => setShowZoom(true)}
              loading="eager"
              decoding="async"
            />
          )}
        </div>

        {/* Click to Zoom Hint */}
        {imageLoaded && (
          <div className="p-3 bg-gray-50 dark:bg-gray-700 flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-300">
              {artwork.metadata.width && artwork.metadata.height
                ? `${artwork.metadata.width} × ${artwork.metadata.height} px`
                : 'Image'}
            </span>
            <button
              onClick={() => setShowZoom(true)}
              className="text-blue-600 dark:text-blue-400 hover:underline text-sm font-medium"
            >
              Click to zoom
            </button>
          </div>
        )}
      </div>

      {/* Title and Description */}
      <div className="mt-6">
        <h1 className="text-3xl sm:text-4xl font-bold mb-2">{artwork.title}</h1>
        {artwork.description && (
          <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap text-base leading-relaxed">
            {artwork.description}
          </p>
        )}
      </div>

      {/* Zoom Modal */}
      {showZoom && (
        <ArtworkZoom
          imageUrl={artwork.displayUrl}
          title={artwork.title}
          onClose={() => setShowZoom(false)}
        />
      )}
    </>
  );
}
```

### Step 3: Create Artwork Metadata Sidebar

Create the sidebar with artwork metadata:

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/public/ArtworkMetadata.tsx`

```typescript
import React from 'react';
import { Link } from 'react-router-dom';
import type { PublicArtworkResponse } from '../../types/public';

interface ArtworkMetadataProps {
  artwork: PublicArtworkResponse;
}

export default function ArtworkMetadata({ artwork }: ArtworkMetadataProps) {
  const uploadDate = new Date(artwork.metadata.uploadedAt).toLocaleDateString(
    'en-US',
    { year: 'numeric', month: 'long', day: 'numeric' }
  );

  return (
    <div className="space-y-6">
      {/* Artist Credit */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase mb-3">
          Artist
        </h3>
        <Link
          to={`/${artwork.artist.username}`}
          className="flex items-center space-x-3 hover:opacity-70 transition-opacity"
        >
          {artwork.artist.avatarUrl && (
            <img
              src={artwork.artist.avatarUrl}
              alt={artwork.artist.username}
              className="w-10 h-10 rounded-full"
            />
          )}
          <div>
            <p className="font-semibold text-gray-900 dark:text-white">
              {artwork.artist.displayName || artwork.artist.username}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              @{artwork.artist.username}
            </p>
          </div>
        </Link>
      </div>

      {/* Image Info */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase mb-3">
          Image Info
        </h3>
        <div className="space-y-2 text-sm">
          {artwork.metadata.width && artwork.metadata.height && (
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Dimensions:</span>
              <span className="text-gray-900 dark:text-white font-mono">
                {artwork.metadata.width} × {artwork.metadata.height}
              </span>
            </div>
          )}
          {artwork.metadata.mimeType && (
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Type:</span>
              <span className="text-gray-900 dark:text-white font-mono uppercase text-xs">
                {artwork.metadata.mimeType.split('/')[1]}
              </span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Uploaded:</span>
            <span className="text-gray-900 dark:text-white text-xs">{uploadDate}</span>
          </div>
        </div>
      </div>

      {/* Collection Info */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase mb-3">
          Collection
        </h3>
        <Link
          to={`/${artwork.artist.username}/${artwork.parent.gallery.slug}/${artwork.parent.collection.slug}`}
          className="text-blue-600 dark:text-blue-400 hover:underline text-sm font-medium"
        >
          {artwork.parent.collection.name}
        </Link>
        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
          in {artwork.parent.gallery.name}
        </p>
      </div>

      {/* Share Buttons */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase mb-3">
          Share
        </h3>
        <div className="flex gap-2">
          <button
            onClick={() => {
              navigator.clipboard.writeText(window.location.href);
              alert('Link copied to clipboard');
            }}
            className="flex-1 px-3 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white text-sm font-medium rounded transition-colors"
            title="Copy link"
          >
            Copy
          </button>
          <a
            href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(artwork.title)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded transition-colors text-center"
            title="Share on Twitter"
          >
            Twitter
          </a>
        </div>
      </div>
    </div>
  );
}
```

### Step 4: Create Artwork Breadcrumbs

Create breadcrumb navigation:

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/public/ArtworkBreadcrumbs.tsx`

```typescript
import React from 'react';
import { Link } from 'react-router-dom';
import type { PublicArtworkResponse } from '../../types/public';

interface ArtworkBreadcrumbsProps {
  artwork: PublicArtworkResponse;
}

export default function ArtworkBreadcrumbs({ artwork }: ArtworkBreadcrumbsProps) {
  return (
    <nav className="flex items-center space-x-2 text-sm" aria-label="Breadcrumb">
      <Link
        to={`/${artwork.artist.username}`}
        className="text-blue-600 dark:text-blue-400 hover:underline"
      >
        {artwork.artist.displayName || artwork.artist.username}
      </Link>

      <span className="text-gray-400">/</span>

      <Link
        to={`/${artwork.artist.username}/${artwork.parent.gallery.slug}`}
        className="text-blue-600 dark:text-blue-400 hover:underline"
      >
        {artwork.parent.gallery.name}
      </Link>

      <span className="text-gray-400">/</span>

      <Link
        to={`/${artwork.artist.username}/${artwork.parent.gallery.slug}/${artwork.parent.collection.slug}`}
        className="text-blue-600 dark:text-blue-400 hover:underline"
      >
        {artwork.parent.collection.name}
      </Link>

      <span className="text-gray-400">/</span>

      <span className="text-gray-700 dark:text-gray-300 font-medium">
        {artwork.title}
      </span>
    </nav>
  );
}
```

### Step 5: Create Artwork Navigation

Create previous/next artwork navigation:

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/public/ArtworkNavigation.tsx`

```typescript
import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

interface ArtworkNavProps {
  previousArtwork: { slug: string; title: string } | null;
  nextArtwork: { slug: string; title: string } | null;
  artist: string;
  gallery: string;
  collection: string;
}

export default function ArtworkNavigation({
  previousArtwork,
  nextArtwork,
  artist,
  gallery,
  collection,
}: ArtworkNavProps) {
  return (
    <nav
      className="flex flex-col sm:flex-row gap-4 sm:gap-8"
      aria-label="Artwork navigation"
    >
      {previousArtwork ? (
        <Link
          to={`/${artist}/${gallery}/${collection}/${previousArtwork.slug}`}
          className="group flex-1 flex flex-col items-start space-y-2 p-4 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
            Previous
          </span>
          <span className="text-lg font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors flex items-center space-x-2">
            <ChevronLeftIcon className="w-5 h-5" />
            <span className="truncate">{previousArtwork.title}</span>
          </span>
        </Link>
      ) : (
        <div />
      )}

      {nextArtwork ? (
        <Link
          to={`/${artist}/${gallery}/${collection}/${nextArtwork.slug}`}
          className="group flex-1 flex flex-col items-end space-y-2 p-4 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-right"
        >
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
            Next
          </span>
          <span className="text-lg font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors flex items-center space-x-2 justify-end">
            <span className="truncate">{nextArtwork.title}</span>
            <ChevronRightIcon className="w-5 h-5" />
          </span>
        </Link>
      ) : (
        <div />
      )}
    </nav>
  );
}
```

### Step 6: Update Router

Add the route to your router:

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/App.tsx` (or routing file)

```typescript
import PublicArtworkPage from './pages/PublicArtworkPage';

// In your routes array:
{
  path: '/:artist/:gallery/:collection/:artwork',
  element: <PublicArtworkPage />,
}
```

---

## Files to Create/Modify

**Create:**
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/pages/PublicArtworkPage.tsx` - Main artwork page
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/public/ArtworkDisplay.tsx` - Image display
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/public/ArtworkMetadata.tsx` - Metadata sidebar
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/public/ArtworkBreadcrumbs.tsx` - Breadcrumbs
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/public/ArtworkNavigation.tsx` - Navigation

**Modify:**
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/App.tsx` - Add route

---

## Verification

### Test 1: Page Loads with Artwork Data

Navigate to a valid artwork URL and verify:
- Artwork title displays
- Description displays (if set)
- Image loads

### Test 2: Metadata Sidebar

- Artist credit shows with avatar
- Image dimensions display (if available)
- Upload date displays
- Collection info links back to collection

### Test 3: Breadcrumbs Navigation

- Click artist name: navigates to artist profile
- Click gallery name: navigates to gallery
- Click collection name: navigates to collection
- Current artwork shows as plain text

### Test 4: Previous/Next Navigation

- Click previous/next buttons
- Navigates to adjacent artwork
- Buttons only show when adjacent artwork exists

### Test 5: SEO Metadata

- Page title: "Artwork Title by Artist Name - VFA Gallery"
- OG tags set correctly for social sharing

### Test 6: Responsive Layout

- Mobile: Single column, full-width image
- Tablet: Image ~60%, sidebar ~40%
- Desktop: 2/3 + 1/3 grid layout

### Test 7: Image Display

- Image loads and displays
- "Click to zoom" hint visible
- Failed image shows error state gracefully

### Test 8: Error Handling

- Non-existent artwork: shows error message
- Invalid path: shows error message
- API failure: shows error message

---

## Success Criteria

- [ ] Artwork page created
- [ ] Image displays responsively
- [ ] Metadata sidebar shows artist credit, dimensions, upload date
- [ ] Breadcrumbs navigation works
- [ ] Previous/next artwork navigation works
- [ ] SEO metadata set correctly
- [ ] Responsive layout on all screen sizes
- [ ] Error states handled gracefully
- [ ] All 8 test cases pass

---

## Next Steps

Once verified, proceed to:
- **Build 90:** Artwork zoom/pan viewer
- **Build 91:** Share buttons component
- **Build 92:** Message artist button
