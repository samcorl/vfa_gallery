# Build 86: Collection Hero Image Component

## Goal

Create an optimized, accessible collection hero image component that handles loading states, fallbacks, responsive layouts, and image optimization. This component is the visual centerpiece of the collection page.

---

## Spec Extract

**Hero Image Requirements:**
- Full-width on mobile (square aspect ratio)
- Contained with padding on desktop (h-96, rounded corners)
- Loading placeholder with pulse animation
- Fallback gradient if image missing or fails to load
- Image lazy-loading optimization
- Accessible alt text
- High-resolution images with responsive src attributes
- Dark mode support

**Responsive Breakpoints:**
- Mobile: Full viewport width, square (1:1)
- Tablet (sm): Full width, square aspect
- Desktop (md+): Contained max-w-7xl, fixed height, rounded corners

---

## Prerequisites

**Must complete before starting:**
- **85-UI-PUBLIC-COLLECTION.md** - Collection page using this component
- **40-IMAGE-PIPELINE-ORCHESTRATION.md** - Image processing pipeline for display URLs

**Reason:** This component needs image URLs from the pipeline and integrates with the collection page.

---

## Steps

### Step 1: Create Enhanced Hero Component with Image Optimization

Create an advanced hero component with better loading and error handling:

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/public/CollectionHero.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import type { PublicCollectionResponse } from '../../types/public';

interface CollectionHeroProps {
  collection: PublicCollectionResponse;
  theme: PublicCollectionResponse['theme'] | null;
  priority?: 'high' | 'low';
}

interface ImageState {
  status: 'loading' | 'loaded' | 'error' | 'placeholder';
  retries: number;
}

export default function CollectionHero({
  collection,
  theme,
  priority = 'high',
}: CollectionHeroProps) {
  const [imageState, setImageState] = useState<ImageState>({
    status: 'loading',
    retries: 0,
  });

  const maxRetries = 2;
  const heroUrl = collection.heroImageUrl;

  // Generate srcSet for responsive images
  const getSrcSet = () => {
    if (!heroUrl) return '';

    // Add width parameters to image URL for CDN optimization
    // Assumes image URLs are from R2 and can accept ?width parameters
    return [
      `${heroUrl}?w=480&q=75 480w`,
      `${heroUrl}?w=768&q=75 768w`,
      `${heroUrl}?w=1024&q=75 1024w`,
      `${heroUrl}?w=1280&q=80 1280w`,
    ].join(',');
  };

  const handleImageLoad = () => {
    setImageState({ status: 'loaded', retries: 0 });
  };

  const handleImageError = () => {
    setImageState((prev) => {
      const newRetries = prev.retries + 1;

      // Retry loading if we haven't exceeded max retries
      if (newRetries < maxRetries) {
        // Retry after a delay
        setTimeout(() => {
          const img = new Image();
          img.src = heroUrl || '';
          img.onload = () => setImageState({ status: 'loaded', retries: 0 });
          img.onerror = () => {
            handleImageError();
          };
        }, 1000 * newRetries);

        return { status: 'loading', retries: newRetries };
      }

      return { status: 'error', retries: newRetries };
    });
  };

  // Cleanup: prevent memory leaks
  useEffect(() => {
    return () => {
      // Cancel any pending retries
    };
  }, []);

  if (!heroUrl) {
    return <HeroPlaceholder collectionName={collection.name} />;
  }

  return (
    <div className={`relative w-full ${imageState.status === 'error' ? 'bg-gray-100 dark:bg-gray-800' : ''}`}>
      {/* Mobile: Square aspect ratio, full width */}
      <div className="sm:hidden aspect-square w-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
        <HeroImage
          src={heroUrl}
          alt={collection.name}
          srcSet={getSrcSet()}
          onLoad={handleImageLoad}
          onError={handleImageError}
          isLoading={imageState.status === 'loading'}
          hasError={imageState.status === 'error'}
          sizes="100vw"
          loading={priority === 'high' ? 'eager' : 'lazy'}
        />
      </div>

      {/* Tablet & Desktop: Contained with padding, fixed height */}
      <div className="hidden sm:block max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="relative w-full h-96 rounded-lg overflow-hidden shadow-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
          <HeroImage
            src={heroUrl}
            alt={collection.name}
            srcSet={getSrcSet()}
            onLoad={handleImageLoad}
            onError={handleImageError}
            isLoading={imageState.status === 'loading'}
            hasError={imageState.status === 'error'}
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 90vw, calc(100vw - 4rem)"
            loading={priority === 'high' ? 'eager' : 'lazy'}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Hero image with loading and error states
 */
interface HeroImageProps {
  src: string;
  alt: string;
  srcSet: string;
  sizes: string;
  onLoad: () => void;
  onError: () => void;
  isLoading: boolean;
  hasError: boolean;
  loading: 'eager' | 'lazy';
}

function HeroImage({
  src,
  alt,
  srcSet,
  sizes,
  onLoad,
  onError,
  isLoading,
  hasError,
  loading,
}: HeroImageProps) {
  if (hasError) {
    return (
      <div className="absolute inset-0 bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800 flex items-center justify-center">
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
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6H4m14 0h4"
            />
          </svg>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Unable to load image
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Loading skeleton */}
      {isLoading && (
        <div className="absolute inset-0 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700 animate-pulse" />
      )}

      {/* Actual image */}
      <img
        src={src}
        srcSet={srcSet}
        sizes={sizes}
        alt={alt}
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${
          isLoading ? 'opacity-0' : 'opacity-100'
        }`}
        onLoad={onLoad}
        onError={onError}
        loading={loading}
        decoding="async"
      />
    </>
  );
}

/**
 * Placeholder shown when no hero image is available
 */
interface HeroPlaceholderProps {
  collectionName: string;
}

function HeroPlaceholder({ collectionName }: HeroPlaceholderProps) {
  return (
    <div className="relative w-full">
      {/* Mobile */}
      <div className="sm:hidden aspect-square w-full bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900 dark:to-purple-900 flex items-center justify-center">
        <div className="text-center px-4">
          <svg
            className="w-16 h-16 text-blue-300 dark:text-blue-500 mx-auto mb-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6H4m14 0h4"
            />
          </svg>
          <p className="text-sm text-blue-700 dark:text-blue-300 font-medium">
            No hero image for this collection
          </p>
        </div>
      </div>

      {/* Desktop */}
      <div className="hidden sm:block max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="relative w-full h-96 rounded-lg overflow-hidden bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900 dark:to-purple-900 flex items-center justify-center border border-blue-200 dark:border-blue-800">
          <div className="text-center">
            <svg
              className="w-20 h-20 text-blue-300 dark:text-blue-500 mx-auto mb-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6H4m14 0h4"
              />
            </svg>
            <p className="text-sm text-blue-700 dark:text-blue-300 font-medium">
              No hero image available
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
```

### Step 2: Create CSS Module for Hero Styling (Optional)

Create a CSS module for more advanced styling:

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/public/CollectionHero.module.css`

```css
.heroContainer {
  position: relative;
  width: 100%;
  overflow: hidden;
}

.heroMobile {
  aspect-ratio: 1;
  width: 100%;
  background-color: rgb(243 244 246);
}

.heroMobile:dark {
  background-color: rgb(31 41 55);
}

.heroDesktop {
  max-width: 80rem;
  margin: 0 auto;
  padding: 1.5rem 1rem;
}

@media (min-width: 640px) {
  .heroDesktop {
    padding: 2rem 1.5rem;
  }
}

@media (min-width: 1024px) {
  .heroDesktop {
    padding: 2rem;
  }
}

.heroWrapper {
  position: relative;
  width: 100%;
  height: 24rem;
  border-radius: 0.5rem;
  overflow: hidden;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
  background-color: rgb(243 244 246);
  border: 1px solid rgb(229 231 235);
}

.heroWrapper:dark {
  background-color: rgb(31 41 55);
  border-color: rgb(55 65 81);
}

.heroImage {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: opacity 500ms;
}

.heroImage.loading {
  opacity: 0;
}

.heroImage.loaded {
  opacity: 1;
}

.heroSkeleton {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    rgb(229 231 235) 0%,
    rgb(243 244 246) 50%,
    rgb(229 231 235) 100%
  );
  background-size: 200% 100%;
  animation: shimmer 2s infinite;
}

.heroSkeleton:dark {
  background: linear-gradient(
    90deg,
    rgb(55 65 81) 0%,
    rgb(75 85 99) 50%,
    rgb(55 65 81) 100%
  );
}

@keyframes shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

.errorState {
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgb(229 231 235), rgb(209 213 219));
  display: flex;
  align-items: center;
  justify-content: center;
}

.errorState:dark {
  background: linear-gradient(135deg, rgb(55 65 81), rgb(75 85 99));
}

.errorContent {
  text-align: center;
}

.errorIcon {
  width: 3rem;
  height: 3rem;
  color: rgb(156 163 175);
  margin: 0 auto 0.5rem;
}

.errorIcon:dark {
  color: rgb(107 114 128);
}

.errorText {
  font-size: 0.875rem;
  color: rgb(107 114 128);
}

.errorText:dark {
  color: rgb(156 163 175);
}
```

### Step 3: Create Utility Hook for Image Loading

Create a reusable hook for managing image loading state:

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/hooks/useImageLoad.ts`

```typescript
import { useState, useCallback } from 'react';

export interface UseImageLoadOptions {
  maxRetries?: number;
  retryDelay?: number;
  onSuccess?: () => void;
  onError?: () => void;
}

export function useImageLoad(options: UseImageLoadOptions = {}) {
  const {
    maxRetries = 2,
    retryDelay = 1000,
    onSuccess,
    onError,
  } = options;

  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [retries, setRetries] = useState(0);

  const handleLoad = useCallback(() => {
    setStatus('loaded');
    setRetries(0);
    onSuccess?.();
  }, [onSuccess]);

  const handleError = useCallback(() => {
    setRetries((prev) => {
      const newRetries = prev + 1;

      if (newRetries < maxRetries) {
        setTimeout(() => {
          // Retry logic handled by component using this hook
        }, retryDelay * newRetries);
        return newRetries;
      }

      setStatus('error');
      onError?.();
      return newRetries;
    });
  }, [maxRetries, retryDelay, onError]);

  const reset = useCallback(() => {
    setStatus('loading');
    setRetries(0);
  }, []);

  return {
    status,
    retries,
    isLoading: status === 'loading',
    isLoaded: status === 'loaded',
    isError: status === 'error',
    handleLoad,
    handleError,
    reset,
  };
}
```

### Step 4: Test Hero Component in Isolation

Create a test file:

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/public/__tests__/CollectionHero.test.tsx`

```typescript
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import CollectionHero from '../CollectionHero';
import type { PublicCollectionResponse } from '../../../types/public';

describe('CollectionHero', () => {
  const mockCollection: PublicCollectionResponse = {
    id: 'col_123',
    slug: 'test-collection',
    name: 'Test Collection',
    description: 'Test description',
    heroImageUrl: 'https://example.com/hero.jpg',
    artworkCount: 10,
    status: 'active',
    theme: null,
    parent: {
      artist: {
        id: 'user_123',
        username: 'test-artist',
        displayName: 'Test Artist',
        avatarUrl: null,
      },
      gallery: {
        id: 'gal_123',
        slug: 'test-gallery',
        name: 'Test Gallery',
      },
    },
    navigation: {
      previousCollection: null,
      nextCollection: null,
    },
    artworkPreview: [],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };

  it('renders hero image when URL is provided', () => {
    render(<CollectionHero collection={mockCollection} theme={null} />);
    const image = screen.getByAltText('Test Collection');
    expect(image).toBeInTheDocument();
  });

  it('shows placeholder when no hero image URL', () => {
    const noImageCollection = {
      ...mockCollection,
      heroImageUrl: null,
    };
    render(<CollectionHero collection={noImageCollection} theme={null} />);
    expect(screen.getByText('No hero image available')).toBeInTheDocument();
  });

  it('displays loading state initially', () => {
    const { container } = render(
      <CollectionHero collection={mockCollection} theme={null} />
    );
    const skeleton = container.querySelector('.animate-pulse');
    expect(skeleton).toBeInTheDocument();
  });

  it('accepts priority prop for loading attribute', () => {
    const { rerender } = render(
      <CollectionHero collection={mockCollection} theme={null} priority="high" />
    );
    let image = screen.getByAltText('Test Collection') as HTMLImageElement;
    expect(image.loading).toBe('eager');

    rerender(
      <CollectionHero collection={mockCollection} theme={null} priority="low" />
    );
    image = screen.getByAltText('Test Collection') as HTMLImageElement;
    expect(image.loading).toBe('lazy');
  });

  it('generates srcSet for responsive images', () => {
    render(<CollectionHero collection={mockCollection} theme={null} />);
    const image = screen.getByAltText('Test Collection') as HTMLImageElement;
    expect(image.srcset).toContain('480w');
    expect(image.srcset).toContain('768w');
    expect(image.srcset).toContain('1024w');
    expect(image.srcset).toContain('1280w');
  });
});
```

### Step 5: Verify Component Integration

Test in the collection page:

```bash
cd /Volumes/DataSSD/gitsrc/vfa_gallery
npm run dev
```

Navigate to a collection page and verify:

1. Hero image loads with proper aspect ratio
2. Mobile: Full-width square
3. Desktop: Contained, rounded, with padding
4. Loading skeleton shows while image loads
5. Image transitions smoothly when loaded

---

## Files to Create/Modify

**Create:**
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/public/CollectionHero.tsx` - Enhanced hero component
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/public/CollectionHero.module.css` - Optional styling
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/hooks/useImageLoad.ts` - Image loading hook
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/public/__tests__/CollectionHero.test.tsx` - Tests

**Modify:**
- None (replaces/enhances previous hero component)

---

## Verification

### Test 1: Mobile Rendering

- Open DevTools with mobile viewport
- Hero image displays as square, full-width
- No horizontal scroll

### Test 2: Desktop Rendering

- Open DevTools with desktop viewport
- Hero image contained in max-w-7xl
- Fixed height (h-96) with rounded corners
- Visible padding on sides

### Test 3: Loading State

- Inspect network tab to slow down image load
- Skeleton/pulse animation shows while loading
- Image fades in smoothly when loaded

### Test 4: Error Handling

- Inspect element and change src to invalid URL
- Error state displays (icon + message)
- No broken image icon shown

### Test 5: Placeholder When No Image

- Remove heroImageUrl from test data
- Gradient placeholder displays
- Matches responsive layout

### Test 6: Responsive Images

- Use DevTools to inspect srcset attribute
- Multiple width parameters present
- Correct sizes attribute for responsive loading

### Test 7: Dark Mode

- Toggle dark mode
- Colors adapt correctly
- No contrast issues

### Test 8: Accessibility

- Image has alt text
- alt text matches collection name
- Proper semantic HTML structure

---

## Success Criteria

- [ ] Hero component renders in responsive layouts
- [ ] Mobile: full-width square aspect
- [ ] Desktop: contained with h-96 height
- [ ] Loading skeleton shows during image load
- [ ] Images load with srcSet optimization
- [ ] Placeholder displays when no image
- [ ] Error state shows gracefully
- [ ] All 8 test cases pass
- [ ] Dark mode colors correct
- [ ] Accessible with proper alt text

---

## Next Steps

Once verified, proceed to:
- **Build 87:** Collection navigation component
- **Build 88:** Public artwork detail endpoint
