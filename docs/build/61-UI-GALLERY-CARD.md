# Build 61: Gallery Card Component

## Goal
Create a reusable gallery card component that displays gallery information in a grid layout, with proper styling for cover images, metadata, and interactive states.

## Spec Extract

From **04-UI-UX-SPEC.md**:
- Cover image (first collection's hero or gradient placeholder)
- Gallery name
- Collection count badge
- "Default" badge if is_default
- Last updated date (relative format: "2 days ago")
- Hover state with subtle lift/shadow effect
- Mobile-first responsive design

---

## Prerequisites

**Must complete before starting:**
- **58-REACT-FORM-PATTERNS.md** - Date formatting utilities established
- **61-UI-GALLERY-CARD.md** dependencies are just style and utilities

---

## Steps

### Step 1: Create Date Formatting Utility

Create a utility function for relative date formatting.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/utils/dates.ts`

```typescript
/**
 * Format a date as a relative time string
 * Example: "2 days ago", "just now", "3 weeks ago"
 */
export function formatRelativeTime(dateString: string | Date): string {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) {
    return 'just now';
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  }

  const days = Math.floor(hours / 24);
  if (days < 7) {
    return `${days} day${days > 1 ? 's' : ''} ago`;
  }

  const weeks = Math.floor(days / 7);
  if (weeks < 4) {
    return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
  }

  const months = Math.floor(days / 30);
  if (months < 12) {
    return `${months} month${months > 1 ? 's' : ''} ago`;
  }

  const years = Math.floor(days / 365);
  return `${years} year${years > 1 ? 's' : ''} ago`;
}

/**
 * Format a date as ISO date string
 * Example: "Jan 18, 2025"
 */
export function formatDate(dateString: string | Date): string {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}
```

### Step 2: Create Gallery Card Component

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/gallery/GalleryCard.tsx`

```typescript
import { formatRelativeTime } from '../../lib/utils/dates';

export interface Gallery {
  id: string;
  name: string;
  description?: string;
  is_default?: boolean;
  collections_count?: number;
  cover_image_url?: string | null;
  updated_at: string;
}

export interface GalleryCardProps {
  gallery: Gallery;
  onClick?: (gallery: Gallery) => void;
  isDragging?: boolean;
}

/**
 * Placeholder gradient backgrounds for galleries without cover images
 */
const PLACEHOLDER_GRADIENTS = [
  'from-blue-400 to-blue-600',
  'from-purple-400 to-purple-600',
  'from-pink-400 to-pink-600',
  'from-green-400 to-green-600',
  'from-orange-400 to-orange-600',
  'from-red-400 to-red-600',
  'from-indigo-400 to-indigo-600',
  'from-cyan-400 to-cyan-600',
];

/**
 * Get consistent placeholder gradient based on gallery ID
 */
function getPlaceholderGradient(id: string): string {
  const hash = id
    .split('')
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const index = hash % PLACEHOLDER_GRADIENTS.length;
  return PLACEHOLDER_GRADIENTS[index];
}

export default function GalleryCard({
  gallery,
  onClick,
  isDragging = false,
}: GalleryCardProps) {
  const placeholderGradient = getPlaceholderGradient(gallery.id);
  const collectionsCount = gallery.collections_count || 0;
  const updatedTime = formatRelativeTime(gallery.updated_at);

  const handleClick = () => {
    if (onClick) {
      onClick(gallery);
    }
  };

  return (
    <div
      onClick={handleClick}
      className={`group cursor-pointer ${isDragging ? 'opacity-50' : ''}`}
    >
      {/* Cover Image Container */}
      <div
        className={`relative overflow-hidden rounded-lg aspect-square bg-gray-200 transition-all duration-200 ${
          onClick ? 'hover:shadow-lg' : ''
        } ${isDragging ? 'ring-2 ring-blue-400' : ''}`}
      >
        {/* Cover Image or Placeholder */}
        {gallery.cover_image_url ? (
          <img
            src={gallery.cover_image_url}
            alt={gallery.name}
            className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div
            className={`w-full h-full bg-gradient-to-br ${placeholderGradient} flex items-center justify-center transition-transform duration-200 group-hover:scale-105`}
          >
            <div className="text-center text-white">
              <div className="text-4xl mb-2">🎨</div>
              <p className="text-sm font-medium opacity-90">Gallery</p>
            </div>
          </div>
        )}

        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all duration-200" />
      </div>

      {/* Gallery Info */}
      <div className="mt-3 px-1">
        {/* Name and Default Badge */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="text-base font-semibold text-gray-900 line-clamp-2 flex-1">
            {gallery.name}
          </h3>
          {gallery.is_default && (
            <span className="flex-shrink-0 inline-block px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded">
              Default
            </span>
          )}
        </div>

        {/* Description (optional) */}
        {gallery.description && (
          <p className="text-sm text-gray-600 line-clamp-2 mb-2">
            {gallery.description}
          </p>
        )}

        {/* Metadata Footer */}
        <div className="flex items-center justify-between text-xs text-gray-500">
          {/* Collections Count */}
          <span className="flex items-center gap-1">
            <span className="text-lg">📚</span>
            {collectionsCount} {collectionsCount === 1 ? 'collection' : 'collections'}
          </span>

          {/* Updated Time */}
          <span title={gallery.updated_at} className="text-right">
            {updatedTime}
          </span>
        </div>
      </div>
    </div>
  );
}
```

### Step 3: Create Gallery Grid Container (Optional)

Create a wrapper component for displaying multiple gallery cards in a responsive grid.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/gallery/GalleryGrid.tsx`

```typescript
import { ReactNode } from 'react';
import GalleryCard, { Gallery, GalleryCardProps } from './GalleryCard';

export interface GalleryGridProps {
  galleries: Gallery[];
  isLoading?: boolean;
  isEmpty?: boolean;
  emptyMessage?: string;
  onCardClick?: (gallery: Gallery) => void;
  children?: ReactNode;
}

export default function GalleryGrid({
  galleries,
  isLoading = false,
  isEmpty = false,
  emptyMessage = 'No galleries yet',
  onCardClick,
  children,
}: GalleryGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="aspect-square bg-gray-200 rounded-lg mb-3" />
            <div className="h-4 bg-gray-200 rounded mb-2" />
            <div className="h-3 bg-gray-200 rounded w-3/4" />
          </div>
        ))}
      </div>
    );
  }

  if (isEmpty || galleries.length === 0) {
    return (
      <div className="col-span-full text-center py-12">
        <div className="text-4xl mb-3">📚</div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">{emptyMessage}</h3>
        <p className="text-gray-600">Create your first gallery to get started</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Gallery Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
        {galleries.map((gallery) => (
          <GalleryCard
            key={gallery.id}
            gallery={gallery}
            onClick={onCardClick}
          />
        ))}
        {children}
      </div>
    </div>
  );
}
```

### Step 4: Update Galleries List Page

Update the galleries list page to use the new card component.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/pages/GalleriesList.tsx`

Replace the existing gallery display with the new component:

```typescript
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import GalleryGrid from '../components/gallery/GalleryGrid';
import { useToast } from '../contexts/ToastContext';

interface Gallery {
  id: string;
  name: string;
  description?: string;
  is_default: boolean;
  collections_count: number;
  cover_image_url?: string | null;
  updated_at: string;
}

export default function GalleriesList() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [galleries, setGalleries] = useState<Gallery[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchGalleries();
  }, []);

  const fetchGalleries = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/galleries', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to load galleries');
      }

      const data = await response.json();
      setGalleries(data);
    } catch (error) {
      showToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to load galleries',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCardClick = (gallery: Gallery) => {
    navigate(`/profile/galleries/${gallery.id}`);
  };

  const handleCreateClick = () => {
    navigate('/profile/galleries/new');
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b border-gray-200 px-4 py-6 md:px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-3xl font-bold text-gray-900">My Galleries</h1>
            <button
              onClick={handleCreateClick}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              + New Gallery
            </button>
          </div>
          <p className="text-gray-600">
            Organize your collections and showcase your artwork
          </p>
        </div>
      </div>

      {/* Gallery Grid */}
      <div className="px-4 py-8 md:px-6">
        <div className="max-w-7xl mx-auto">
          <GalleryGrid
            galleries={galleries}
            isLoading={isLoading}
            isEmpty={galleries.length === 0}
            emptyMessage="No galleries yet"
            onCardClick={handleCardClick}
          >
            {/* Create Gallery Card */}
            <button
              onClick={handleCreateClick}
              className="flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg aspect-square hover:border-gray-400 hover:bg-gray-50 transition-colors group"
            >
              <div className="text-center">
                <div className="text-4xl mb-1 group-hover:scale-110 transition-transform">
                  +
                </div>
                <p className="text-sm text-gray-600 font-medium">New Gallery</p>
              </div>
            </button>
          </GalleryGrid>
        </div>
      </div>
    </div>
  );
}
```

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/utils/dates.ts` | Create |
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/gallery/GalleryCard.tsx` | Create |
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/gallery/GalleryGrid.tsx` | Create |
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/pages/GalleriesList.tsx` | Modify - use new components |

---

## Verification

1. Navigate to `/profile/galleries`
2. Verify gallery cards display with:
   - Cover image or placeholder gradient
   - Gallery name
   - Description (if available)
   - Collection count badge
   - "Default" badge for default gallery
   - "Updated X days ago" timestamp
3. Hover on gallery card (desktop) - verify shadow effect and image scale
4. Verify responsive grid layout:
   - Mobile (<640px): 2 columns
   - Tablet (640-1024px): 3 columns
   - Desktop (>1024px): 4 columns
5. Click on gallery card - should navigate to edit page
6. Verify "+ New Gallery" card appears at end of grid
7. Test with multiple galleries of different ages
8. Test with gallery without cover image - verify placeholder gradient appears
9. Test empty state - verify empty message appears when no galleries

Test loading state shows skeleton cards while fetching.

Verify placeholder gradients are consistent for same gallery across page reloads.
