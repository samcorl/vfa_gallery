# Build 85: Public Collection Page UI

## Goal

Create the public collection page component at `/:artist/:gallery/:collection` that displays the full collection with hero image, description, theme styling, artwork grid, and breadcrumb navigation.

---

## Spec Extract

**Route:** `/:artist/:gallery/:collection`

**Public Page Features:**
- Display collection name, description, hero image
- Hero image: full-width on mobile, contained on desktop with responsive padding
- Apply gallery theme if set
- Artwork grid: responsive layout (2-4 columns depending on screen size)
- Breadcrumbs: Artist > Gallery > Collection
- Previous/Next navigation buttons (from API)
- Lazy loading for artwork grid
- No authentication required
- SEO metadata: collection name, description, hero image for OG tags

**Responsive Behavior:**
- Mobile: 1-2 columns in grid, full-width hero
- Tablet: 2-3 columns
- Desktop: 3-4 columns
- Touch-friendly spacing and tap targets

---

## Prerequisites

**Must complete before starting:**
- **84-API-PUBLIC-COLLECTION.md** - Collection API endpoint
- **24-REACT-ROUTER-SETUP.md** - Router configured
- **27-REACT-LAYOUT-SHELL.md** - Layout shell for page structure

**Reason:** This page depends on the API endpoint and router setup.

---

## Steps

### Step 1: Create Collection Page Component

Create the main collection page component:

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/pages/PublicCollectionPage.tsx`

```typescript
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { PublicCollectionResponse } from '../types/public';
import CollectionHero from '../components/public/CollectionHero';
import CollectionBreadcrumbs from '../components/public/CollectionBreadcrumbs';
import CollectionNavigation from '../components/public/CollectionNavigation';
import ArtworkGrid from '../components/public/ArtworkGrid';
import ErrorFallback from '../components/ErrorFallback';
import { useToast } from '../context/ToastContext';

interface CollectionData {
  data: PublicCollectionResponse;
}

export default function PublicCollectionPage() {
  const { artist, gallery, collection } = useParams<{
    artist: string;
    gallery: string;
    collection: string;
  }>();

  const [collectionData, setCollectionData] = useState<CollectionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { addToast } = useToast();

  useEffect(() => {
    if (!artist || !gallery || !collection) {
      setError('Missing path parameters');
      setIsLoading(false);
      return;
    }

    const fetchCollection = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(
          `/api/g/${encodeURIComponent(artist)}/${encodeURIComponent(gallery)}/${encodeURIComponent(collection)}`
        );

        if (!response.ok) {
          if (response.status === 404) {
            setError('Collection not found');
          } else {
            setError('Failed to load collection');
          }
          setIsLoading(false);
          return;
        }

        const data = await response.json();
        setCollectionData(data);

        // Set page title and meta tags
        document.title = `${data.data.name} - VFA Gallery`;
        updateMetaTags(data.data);
      } catch (err) {
        console.error('Error fetching collection:', err);
        setError('Failed to load collection');
      } finally {
        setIsLoading(false);
      }
    };

    fetchCollection();
  }, [artist, gallery, collection]);

  const updateMetaTags = (collection: PublicCollectionResponse) => {
    // Update OG tags for sharing
    const ogTitle = document.querySelector('meta[property="og:title"]') ||
      document.createElement('meta');
    ogTitle.setAttribute('property', 'og:title');
    ogTitle.setAttribute('content', collection.name);
    document.head.appendChild(ogTitle);

    const ogDescription = document.querySelector('meta[property="og:description"]') ||
      document.createElement('meta');
    ogDescription.setAttribute('property', 'og:description');
    ogDescription.setAttribute('content', collection.description || 'View artworks in this collection');
    document.head.appendChild(ogDescription);

    if (collection.heroImageUrl) {
      const ogImage = document.querySelector('meta[property="og:image"]') ||
        document.createElement('meta');
      ogImage.setAttribute('property', 'og:image');
      ogImage.setAttribute('content', collection.heroImageUrl);
      document.head.appendChild(ogImage);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 dark:border-white" />
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading collection...</p>
        </div>
      </div>
    );
  }

  if (error || !collectionData) {
    return <ErrorFallback message={error || 'Failed to load collection'} />;
  }

  const { data: collection } = collectionData;

  return (
    <div className={collection.theme ? `theme-${collection.theme.id}` : ''}>
      {/* Breadcrumbs */}
      <div className="px-4 py-3 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <CollectionBreadcrumbs
          artist={collection.parent.artist}
          gallery={collection.parent.gallery}
          collection={collection}
        />
      </div>

      {/* Hero Image */}
      <CollectionHero
        collection={collection}
        theme={collection.theme}
      />

      {/* Collection Info */}
      <div className="px-4 py-8 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold mb-2">
            {collection.name}
          </h1>
          {collection.description && (
            <p className="text-lg text-gray-600 dark:text-gray-400 max-w-3xl">
              {collection.description}
            </p>
          )}
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-3">
            {collection.artworkCount} {collection.artworkCount === 1 ? 'artwork' : 'artworks'}
          </p>
        </div>

        {/* Artwork Grid */}
        {collection.artworkPreview && collection.artworkPreview.length > 0 ? (
          <ArtworkGrid
            artworks={collection.artworkPreview}
            artist={collection.parent.artist}
            gallery={collection.parent.gallery}
            collection={collection}
          />
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">
              No artworks in this collection yet
            </p>
          </div>
        )}

        {/* Navigation */}
        {(collection.navigation.previousCollection || collection.navigation.nextCollection) && (
          <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
            <CollectionNavigation
              previousCollection={collection.navigation.previousCollection}
              nextCollection={collection.navigation.nextCollection}
              artist={collection.parent.artist.username}
              gallery={collection.parent.gallery.slug}
            />
          </div>
        )}
      </div>
    </div>
  );
}
```

### Step 2: Create Collection Hero Component

Create the hero image component:

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/public/CollectionHero.tsx`

```typescript
import React, { useState } from 'react';
import type { PublicCollectionResponse } from '../../types/public';

interface CollectionHeroProps {
  collection: PublicCollectionResponse;
  theme: PublicCollectionResponse['theme'] | null;
}

export default function CollectionHero({ collection, theme }: CollectionHeroProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

  if (!collection.heroImageUrl) {
    return (
      <div className="w-full h-64 sm:h-80 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 flex items-center justify-center">
        <p className="text-gray-500 dark:text-gray-400">No hero image</p>
      </div>
    );
  }

  return (
    <div className="relative w-full overflow-hidden">
      {/* Mobile: full-width */}
      <div className="sm:hidden aspect-square w-full bg-gray-100 dark:bg-gray-800">
        {!imageLoaded && !imageFailed && (
          <div className="absolute inset-0 bg-gray-200 dark:bg-gray-700 animate-pulse" />
        )}
        <img
          src={collection.heroImageUrl}
          alt={collection.name}
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            imageLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          onLoad={() => setImageLoaded(true)}
          onError={() => setImageFailed(true)}
          loading="eager"
        />
      </div>

      {/* Tablet & Desktop: contained with padding */}
      <div className="hidden sm:block max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="relative w-full h-96 rounded-lg overflow-hidden shadow-lg bg-gray-100 dark:bg-gray-800">
          {!imageLoaded && !imageFailed && (
            <div className="absolute inset-0 bg-gray-200 dark:bg-gray-700 animate-pulse" />
          )}
          <img
            src={collection.heroImageUrl}
            alt={collection.name}
            className={`w-full h-full object-cover transition-opacity duration-300 ${
              imageLoaded ? 'opacity-100' : 'opacity-0'
            }`}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageFailed(true)}
            loading="eager"
          />
        </div>
      </div>

      {imageFailed && (
        <div className="w-full h-64 sm:h-96 bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
          <p className="text-gray-500 dark:text-gray-400">Failed to load image</p>
        </div>
      )}
    </div>
  );
}
```

### Step 3: Create Breadcrumbs Component

Create breadcrumb navigation:

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/public/CollectionBreadcrumbs.tsx`

```typescript
import React from 'react';
import { Link } from 'react-router-dom';
import type { PublicCollectionResponse } from '../../types/public';

interface BreadcrumbsProps {
  artist: PublicCollectionResponse['parent']['artist'];
  gallery: PublicCollectionResponse['parent']['gallery'];
  collection: PublicCollectionResponse;
}

export default function CollectionBreadcrumbs({
  artist,
  gallery,
  collection,
}: BreadcrumbsProps) {
  return (
    <nav className="flex items-center space-x-2 text-sm" aria-label="Breadcrumb">
      <Link
        to={`/${artist.username}`}
        className="text-blue-600 dark:text-blue-400 hover:underline"
      >
        {artist.displayName || artist.username}
      </Link>

      <span className="text-gray-400">/</span>

      <Link
        to={`/${artist.username}/${gallery.slug}`}
        className="text-blue-600 dark:text-blue-400 hover:underline"
      >
        {gallery.name}
      </Link>

      <span className="text-gray-400">/</span>

      <span className="text-gray-700 dark:text-gray-300 font-medium">
        {collection.name}
      </span>
    </nav>
  );
}
```

### Step 4: Create Collection Navigation Component

Create previous/next navigation:

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/public/CollectionNavigation.tsx`

```typescript
import React from 'react';
import { Link } from 'react-router-dom';

interface CollectionNavProps {
  previousCollection: { slug: string; name: string } | null;
  nextCollection: { slug: string; name: string } | null;
  artist: string;
  gallery: string;
}

export default function CollectionNavigation({
  previousCollection,
  nextCollection,
  artist,
  gallery,
}: CollectionNavProps) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:gap-8">
      {previousCollection ? (
        <Link
          to={`/${artist}/${gallery}/${previousCollection.slug}`}
          className="group flex flex-col items-start space-y-2 p-4 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
            Previous
          </span>
          <span className="text-lg font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors flex items-center space-x-2">
            <span>←</span>
            <span className="truncate">{previousCollection.name}</span>
          </span>
        </Link>
      ) : (
        <div />
      )}

      {nextCollection ? (
        <Link
          to={`/${artist}/${gallery}/${nextCollection.slug}`}
          className="group flex flex-col items-end space-y-2 p-4 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-right"
        >
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
            Next
          </span>
          <span className="text-lg font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors flex items-center space-x-2 justify-end">
            <span className="truncate">{nextCollection.name}</span>
            <span>→</span>
          </span>
        </Link>
      ) : (
        <div />
      )}
    </div>
  );
}
```

### Step 5: Create Public Artwork Grid Component

Create the responsive artwork grid:

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/public/ArtworkGrid.tsx`

```typescript
import React from 'react';
import { Link } from 'react-router-dom';
import type { PublicCollectionResponse } from '../../types/public';

interface ArtworkGridProps {
  artworks: PublicCollectionResponse['artworkPreview'];
  artist: PublicCollectionResponse['parent']['artist'];
  gallery: PublicCollectionResponse['parent']['gallery'];
  collection: PublicCollectionResponse;
}

export default function ArtworkGrid({
  artworks,
  artist,
  gallery,
  collection,
}: ArtworkGridProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
      {artworks.map((artwork) => (
        <Link
          key={artwork.id}
          to={`/${artist.username}/${gallery.slug}/${collection.slug}/${artwork.slug}`}
          className="group relative aspect-square overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800 hover:shadow-lg transition-shadow"
        >
          {/* Thumbnail */}
          {artwork.thumbnailUrl ? (
            <img
              src={artwork.thumbnailUrl}
              alt={artwork.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-xs text-gray-400">No image</span>
            </div>
          )}

          {/* Overlay */}
          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-300 flex items-end">
            <div className="w-full p-3 bg-gradient-to-t from-black to-transparent text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <p className="text-sm font-semibold truncate">{artwork.title}</p>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
```

### Step 6: Update Router Configuration

Add the route to your router setup:

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/App.tsx` (or routing file)

```typescript
import PublicCollectionPage from './pages/PublicCollectionPage';

// In your routes array:
{
  path: '/:artist/:gallery/:collection',
  element: <PublicCollectionPage />,
}
```

### Step 7: Test the Page

Start the development server:

```bash
cd /Volumes/DataSSD/gitsrc/vfa_gallery
npm run dev
```

Navigate to: `http://localhost:5173/samcorl/digital-art/landscapes`

---

## Files to Create/Modify

**Create:**
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/pages/PublicCollectionPage.tsx` - Main collection page
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/public/CollectionHero.tsx` - Hero image component
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/public/CollectionBreadcrumbs.tsx` - Breadcrumb navigation
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/public/CollectionNavigation.tsx` - Previous/next navigation
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/public/ArtworkGrid.tsx` - Artwork grid component

**Modify:**
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/App.tsx` - Add route

---

## Verification

### Test 1: Page Loads with Collection Data

Navigate to a valid collection URL and verify:
- Collection name displays
- Description displays (if set)
- Artwork count displays

### Test 2: Hero Image Displays

- Mobile: Full-width, square aspect ratio
- Desktop: Contained with padding, h-96 height
- Loading state shows while image loads

### Test 3: Breadcrumbs Navigation Works

- Click artist name: navigates to artist profile
- Click gallery name: navigates to gallery
- Current collection shows as plain text (not clickable)

### Test 4: Artwork Grid Displays

- 2 columns on mobile
- 3 columns on tablet
- 4 columns on desktop
- Click artwork: navigates to artwork detail page

### Test 5: Previous/Next Navigation

- Shows buttons only if collections exist
- Click previous/next: navigates correctly
- Layout adjusts when one is missing

### Test 6: Theme Applied (if set)

- Gallery with theme: theme CSS class applied to page
- Gallery without theme: no theme class

### Test 7: SEO Metadata

- Page title: "Collection Name - VFA Gallery"
- OG title, description, image set for social sharing

### Test 8: Error Handling

- Non-existent collection: shows error message
- Invalid path: shows error message
- API failure: shows error message

---

## Success Criteria

- [ ] Public collection page created
- [ ] Hero component displays correctly (responsive)
- [ ] Breadcrumbs navigation works
- [ ] Artwork grid displays in responsive layout
- [ ] Previous/next collection navigation works
- [ ] Theme styling applied if set
- [ ] SEO metadata set correctly
- [ ] Error states handled gracefully
- [ ] All 8 test cases pass

---

## Next Steps

Once verified, proceed to:
- **Build 86:** Collection hero image component enhancements
- **Build 87:** Collection navigation component refinements
- **Build 88:** Public artwork detail page
