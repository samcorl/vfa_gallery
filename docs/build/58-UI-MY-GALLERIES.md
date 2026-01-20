# 58-UI-MY-GALLERIES.md

## Goal

Create the "My Galleries" page (`/profile/galleries`) that displays the authenticated user's galleries in a grid layout with creation controls, collection counts, timestamps, and default gallery indicators.

---

## Spec Extract

From TECHNICAL-SPEC.md and UI Requirements:

- **URL:** `/profile/galleries`
- **Authentication:** Required (user must be logged in)

- **Gallery Grid Display:**
  - Grid of user's galleries
  - Card per gallery showing:
    - Gallery name (title)
    - Number of collections in gallery
    - Last updated timestamp
    - "Default" badge if `is_default = true`

- **New Gallery Card:**
  - First position in grid (or sticky position)
  - Dashed border styling
  - Plus (+) icon
  - Text: "New Gallery" or "Create Gallery"
  - Click opens gallery creation flow

- **Gallery Card Interaction:**
  - Click to open gallery manager/editor
  - Navigation to `/profile/galleries/:id`

- **Responsive Layout:**
  - Mobile (<640px): 2 columns
  - Tablet (640-1024px): 3 columns
  - Desktop (>1024px): 4 columns

- **Empty State:**
  - If no galleries: Show message with CTA to create first gallery
  - Default gallery always exists, so this is rare

---

## Prerequisites

**Must complete before starting:**
- **27-REACT-LAYOUT-SHELL.md** - Base layout and routing
- **53-API-GALLERY-LIST.md** - GET /api/galleries endpoint
- **26-REACT-PROTECTED-ROUTES.md** - Route protection

---

## Steps

### Step 1: Create Gallery Card Component

Create a card component for individual galleries (reusable).

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/components/gallery/GalleryCard.tsx`

```typescript
import React from 'react'
import { Gallery } from '../../types/gallery'
import { formatDistanceToNow } from 'date-fns'

interface GalleryCardProps {
  gallery: Gallery
  collectionCount: number
  onClick: (gallery: Gallery) => void
  isLoading?: boolean
}

/**
 * Gallery Card Component
 * Displays a gallery in grid with name, collection count, and update timestamp
 */
export const GalleryCard: React.FC<GalleryCardProps> = ({
  gallery,
  collectionCount,
  onClick,
  isLoading = false
}) => {
  // Loading skeleton
  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 h-40 animate-pulse">
        <div className="space-y-3">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
        </div>
      </div>
    )
  }

  const timeAgo = formatDistanceToNow(new Date(gallery.updatedAt), { addSuffix: true })

  return (
    <button
      onClick={() => onClick(gallery)}
      className="text-left bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 h-40 hover:shadow-md hover:border-blue-300 dark:hover:border-blue-600 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      <div className="space-y-3 h-full flex flex-col justify-between">
        {/* Header with name and badge */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-gray-900 dark:text-white truncate flex-1">
            {gallery.name}
          </h3>
          {gallery.isDefault && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 whitespace-nowrap">
              Default
            </span>
          )}
        </div>

        {/* Collections info */}
        <div className="text-sm text-gray-600 dark:text-gray-400">
          <p>{collectionCount} collection{collectionCount !== 1 ? 's' : ''}</p>
        </div>

        {/* Timestamp */}
        <p className="text-xs text-gray-500 dark:text-gray-500">
          Updated {timeAgo}
        </p>
      </div>
    </button>
  )
}
```

---

### Step 2: Create New Gallery Card Component

Create a special card for creating a new gallery.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/components/gallery/NewGalleryCard.tsx`

```typescript
import React from 'react'

interface NewGalleryCardProps {
  onClick: () => void
  isLoading?: boolean
}

/**
 * New Gallery Card Component
 * Special card with dashed border and plus icon for creating new galleries
 * Positioned first in the grid
 */
export const NewGalleryCard: React.FC<NewGalleryCardProps> = ({
  onClick,
  isLoading = false
}) => {
  return (
    <button
      onClick={onClick}
      disabled={isLoading}
      className="bg-white dark:bg-gray-800 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 p-4 h-40 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <div className="h-full flex flex-col items-center justify-center space-y-2">
        <svg
          className="w-8 h-8 text-gray-400 dark:text-gray-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 4v16m8-8H4"
          />
        </svg>
        <p className="font-medium text-gray-700 dark:text-gray-300">New Gallery</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">Create and organize</p>
      </div>
    </button>
  )
}
```

---

### Step 3: Create My Galleries Page Component

Create the main page component that orchestrates the gallery grid.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/pages/MyGalleries.tsx`

```typescript
import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { Gallery } from '../types/gallery'
import { GalleryCard } from '../components/gallery/GalleryCard'
import { NewGalleryCard } from '../components/gallery/NewGalleryCard'
import { ErrorBoundary } from '../components/common/ErrorBoundary'
import { PageHeader } from '../components/common/PageHeader'

/**
 * My Galleries Page Component
 * Displays user's galleries in a responsive grid
 * Allows creating new galleries and managing existing ones
 */
export const MyGalleries: React.FC = () => {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { showToast } = useToast()

  // Local state
  const [galleries, setGalleries] = useState<Gallery[]>([])
  const [collectionCounts, setCollectionCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch galleries on mount
  useEffect(() => {
    const fetchGalleries = async () => {
      if (!user) return

      try {
        setLoading(true)
        setError(null)

        const response = await fetch('/api/galleries', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'include'
        })

        if (!response.ok) {
          throw new Error('Failed to load galleries')
        }

        const data = await response.json()
        const galleryList = data.data || []
        setGalleries(galleryList)

        // Fetch collection counts for each gallery
        await fetchCollectionCounts(galleryList)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load galleries'
        setError(message)
        showToast(message, 'error')
      } finally {
        setLoading(false)
      }
    }

    fetchGalleries()
  }, [user, showToast])

  /**
   * Fetch collection count for each gallery
   * Can be optimized if API returns counts in initial response
   */
  const fetchCollectionCounts = async (galleryList: Gallery[]) => {
    const counts: Record<string, number> = {}

    for (const gallery of galleryList) {
      try {
        const response = await fetch(`/api/galleries/${gallery.id}/collections`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'include'
        })

        if (response.ok) {
          const data = await response.json()
          counts[gallery.id] = (data.data || []).length
        }
      } catch (err) {
        console.error(`Failed to fetch collections for gallery ${gallery.id}:`, err)
        counts[gallery.id] = 0
      }
    }

    setCollectionCounts(counts)
  }

  const handleGalleryClick = (gallery: Gallery) => {
    navigate(`/profile/galleries/${gallery.id}`)
  }

  const handleCreateGallery = () => {
    navigate('/profile/galleries/new')
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <PageHeader
          title="My Galleries"
          description="Organize your artwork into galleries"
        />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <GalleryCard
              key={i}
              gallery={{} as Gallery}
              collectionCount={0}
              onClick={() => {}}
              isLoading={true}
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <div className="max-w-6xl mx-auto p-6">
        {/* Page Header */}
        <PageHeader
          title="My Galleries"
          description="Organize your artwork into galleries"
        />

        {/* Error Alert */}
        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-4">
            <p className="text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {/* Empty State */}
        {galleries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-6">
            <svg
              className="w-16 h-16 text-gray-300 dark:text-gray-600 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 6a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6z"
              />
            </svg>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              No galleries yet
            </h3>
            <p className="text-gray-600 dark:text-gray-400 text-center mb-6 max-w-md">
              Create your first gallery to organize and showcase your artwork.
            </p>
            <button
              onClick={handleCreateGallery}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              Create Gallery
            </button>
          </div>
        ) : (
          <>
            {/* Gallery Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {/* New Gallery Card */}
              <NewGalleryCard onClick={handleCreateGallery} />

              {/* Existing Galleries */}
              {galleries.map((gallery) => (
                <GalleryCard
                  key={gallery.id}
                  gallery={gallery}
                  collectionCount={collectionCounts[gallery.id] || 0}
                  onClick={handleGalleryClick}
                />
              ))}
            </div>

            {/* Stats Summary */}
            <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total Galleries</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">
                    {galleries.length}
                  </p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total Collections</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">
                    {Object.values(collectionCounts).reduce((a, b) => a + b, 0)}
                  </p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Default Gallery</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {galleries.find(g => g.isDefault)?.name || 'None'}
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </ErrorBoundary>
  )
}

export default MyGalleries
```

---

### Step 4: Create Page Header Component (If Not Exists)

Create or update the page header component for consistent styling.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/components/common/PageHeader.tsx`

```typescript
import React from 'react'

interface PageHeaderProps {
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
}

/**
 * Page Header Component
 * Consistent header for pages with title, description, and optional action button
 */
export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  action
}) => {
  return (
    <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          {title}
        </h1>
        {description && (
          <p className="text-gray-600 dark:text-gray-400">
            {description}
          </p>
        )}
      </div>
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 sm:mt-0 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
```

---

### Step 5: Add Route to Router Configuration

Update the router to include the My Galleries route.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/index.tsx` or router configuration file

```typescript
import { MyGalleries } from './pages/MyGalleries'
import { ProtectedRoute } from './components/common/ProtectedRoute'

// Add to router configuration:
{
  path: '/profile/galleries',
  element: <ProtectedRoute component={MyGalleries} />,
  errorElement: <ErrorBoundary />
}
```

---

### Step 6: Create Optional Gallery Manager Component

Create a detailed gallery management page that opens when clicking a gallery card.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/pages/GalleryManager.tsx`

```typescript
import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { Gallery } from '../types/gallery'
import { ErrorBoundary } from '../components/common/ErrorBoundary'
import { LoadingSpinner } from '../components/common/LoadingSpinner'

/**
 * Gallery Manager Page
 * Allows editing gallery and managing its collections
 * Can be used instead of separate edit page
 */
export const GalleryManager: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { showToast } = useToast()

  const [gallery, setGallery] = useState<Gallery | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchGallery = async () => {
      if (!id || !user) return

      try {
        setLoading(true)
        setError(null)

        const response = await fetch(`/api/galleries/${id}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include'
        })

        if (!response.ok) {
          throw new Error('Failed to load gallery')
        }

        const data = await response.json()
        setGallery(data.data)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load gallery'
        setError(message)
        showToast(message, 'error')
      } finally {
        setLoading(false)
      }
    }

    fetchGallery()
  }, [id, user, showToast])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
    )
  }

  if (!gallery) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-4">
          <p className="text-red-800 dark:text-red-200">{error || 'Gallery not found'}</p>
        </div>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <div className="max-w-4xl mx-auto p-6">
        <div className="mb-6">
          <button
            onClick={() => navigate('/profile/galleries')}
            className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium mb-4"
          >
            ← Back to Galleries
          </button>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {gallery.name}
          </h1>
        </div>

        {/* Gallery Details */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Gallery Name
            </label>
            <p className="mt-1 text-gray-900 dark:text-white">{gallery.name}</p>
          </div>

          {gallery.description && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Description
              </label>
              <p className="mt-1 text-gray-600 dark:text-gray-400">{gallery.description}</p>
            </div>
          )}

          <div className="flex gap-6 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={() => navigate(`/profile/galleries/${gallery.id}/edit`)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              Edit Gallery
            </button>
            <button
              onClick={() => navigate(`/profile/galleries/${gallery.id}/collections`)}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
            >
              Manage Collections
            </button>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  )
}

export default GalleryManager
```

---

## Files to Create/Modify

1. **Create:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/pages/MyGalleries.tsx`
2. **Create:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/components/gallery/GalleryCard.tsx`
3. **Create:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/components/gallery/NewGalleryCard.tsx`
4. **Create or Update:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/components/common/PageHeader.tsx`
5. **Create:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/pages/GalleryManager.tsx` (optional)
6. **Update:** Router configuration to add `/profile/galleries` route

---

## Route Configuration

Add these routes to your React Router configuration:

```typescript
{
  path: '/profile/galleries',
  element: <ProtectedRoute component={MyGalleries} />,
  errorElement: <ErrorBoundary />
},
{
  path: '/profile/galleries/:id',
  element: <ProtectedRoute component={GalleryManager} />,
  errorElement: <ErrorBoundary />
}
```

---

## Dependencies

Ensure the following are available:
- `date-fns` for timestamp formatting (or use native Date methods)

If not installed:
```bash
npm install date-fns
```

---

## Verification

1. **Page Loads:**
   - Navigate to `/profile/galleries`
   - User is authenticated
   - Page title and description display
   - Loading skeleton shows while fetching

2. **Galleries Display:**
   - All user's galleries appear in grid
   - Each card shows gallery name
   - Collection count displays
   - Updated timestamp shows
   - Default gallery has "Default" badge

3. **New Gallery Card:**
   - Appears first in grid (position 0)
   - Dashed border styling
   - Plus icon visible
   - "New Gallery" text displays

4. **Responsive Grid:**
   - Mobile (< 640px): 2 columns
   - Tablet (640-1024px): 3 columns
   - Desktop (> 1024px): 4 columns + New Gallery card

5. **Gallery Click:**
   - Click gallery card
   - Navigate to `/profile/galleries/:id`
   - Gallery details load correctly

6. **Create New:**
   - Click "New Gallery" card
   - Navigate to `/profile/galleries/new` (or open creation modal)
   - Can create new gallery

7. **Empty State:**
   - Manually delete all galleries
   - Empty state message displays
   - "Create Gallery" button visible
   - Clicking button opens creation flow

8. **Stats Summary:**
   - Total galleries count is correct
   - Total collections count sums properly
   - Default gallery name shows

9. **Error Handling:**
   - Simulate API failure
   - Error message displays
   - User can retry or navigate back

10. **Keyboard Navigation:**
    - Tab through cards
    - Focus rings visible
    - Enter/Space triggers click
    - Accessible to screen readers

---

## Optional Features

1. **Gallery Sorting:**
   - Sort by name, date updated, collection count
   - Add sort dropdown to page header

2. **Gallery Search:**
   - Filter galleries by name
   - Add search input above grid

3. **Gallery Actions Menu:**
   - Right-click context menu on card
   - Quick edit/delete options

4. **Gallery Drag & Drop:**
   - Reorder galleries via drag
   - Save custom ordering to backend

5. **Bulk Actions:**
   - Select multiple galleries
   - Bulk delete or update status
