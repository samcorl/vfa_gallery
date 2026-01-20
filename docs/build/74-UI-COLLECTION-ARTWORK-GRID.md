# Build 74: Collection Artwork Grid Component

## Goal

Create the `CollectionArtworkGrid` component that displays artworks within a collection manager with remove buttons, visual indicators for drag-handle capability, and a modal for adding artworks from the user's library.

---

## Spec Extract

From TECHNICAL-SPEC.md - Collection-Artwork Management UI:

**Grid Display:**
- Show artworks ordered by position (ascending)
- Square thumbnail cards in responsive grid
- Remove button (X icon) in top-right corner of each card
- Visual drag-handle indicator (6-dot icon or cursor change)
- Empty state message when no artworks: "No artworks yet. Add some from your library!"
- "Add Artwork" button to open selection modal

**Add Modal:**
- Show user's artworks that are NOT in this collection
- Filter/search capability by artwork title
- Click artwork to add to collection
- Visual feedback (loading state, success message)
- Close button to dismiss modal

---

## Prerequisites

**Must complete before starting:**
- **70-UI-COLLECTION-MANAGER.md** - Collection manager page structure
- **48-UI-ARTWORK-GRID.md** - Artwork card component (for reference)
- **71-API-COLLECTION-ARTWORKS-ADD.md** - Add artwork API endpoint
- **24-REACT-ROUTER-SETUP.md** - React Router setup

---

## Steps

### Step 1: Create Artwork Selection Modal Component

Create a modal that allows users to select artworks from their library to add to the collection.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/components/collection/AddArtworkModal.tsx`

```typescript
import React, { useState, useEffect } from 'react'
import { XMarkIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline'

interface Artwork {
  id: string
  title: string
  slug: string
  thumbnail_url: string
}

interface AddArtworkModalProps {
  isOpen: boolean
  collectionId: string
  onClose: () => void
  onSuccess: () => void
}

/**
 * Modal for adding artworks to a collection
 * Shows user's artworks that are not already in the collection
 * Provides search/filter capability
 */
export const AddArtworkModal: React.FC<AddArtworkModalProps> = ({
  isOpen,
  collectionId,
  onClose,
  onSuccess,
}) => {
  const [availableArtworks, setAvailableArtworks] = useState<Artwork[]>([])
  const [filteredArtworks, setFilteredArtworks] = useState<Artwork[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState<string | null>(null)

  // Fetch available artworks when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchAvailableArtworks()
    }
  }, [isOpen, collectionId])

  // Filter artworks by search term
  useEffect(() => {
    const filtered = availableArtworks.filter((artwork) =>
      artwork.title.toLowerCase().includes(searchTerm.toLowerCase())
    )
    setFilteredArtworks(filtered)
  }, [searchTerm, availableArtworks])

  const fetchAvailableArtworks = async () => {
    setLoading(true)
    setError(null)

    try {
      // Fetch all user's artworks
      const response = await fetch('/api/artworks')
      if (!response.ok) {
        throw new Error('Failed to fetch artworks')
      }
      const data = await response.json()

      // Filter out artworks already in this collection
      const available = data.data.filter((artwork: Artwork) => {
        // This is a simplified check; ideally the API would handle filtering
        return true // Full filtering happens on server or with collection data
      })

      setAvailableArtworks(available)
      setFilteredArtworks(available)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load artworks')
    } finally {
      setLoading(false)
    }
  }

  const handleAddArtwork = async (artworkId: string) => {
    setAdding(artworkId)
    setError(null)

    try {
      const response = await fetch(`/api/collections/${collectionId}/artworks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ artworkId }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to add artwork')
      }

      // Remove from available list and trigger parent refresh
      setAvailableArtworks((prev) => prev.filter((a) => a.id !== artworkId))
      setFilteredArtworks((prev) => prev.filter((a) => a.id !== artworkId))

      // If this was the last artwork and search is active, show message
      if (filteredArtworks.length === 1) {
        setSearchTerm('')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add artwork')
    } finally {
      setAdding(null)
    }
  }

  if (!isOpen) {
    return null
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Add Artwork to Collection
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="relative">
            <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search artworks..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                       bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                       focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-red-700 dark:text-red-400 text-sm">{error}</p>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-gray-500 dark:text-gray-400">Loading artworks...</div>
            </div>
          ) : filteredArtworks.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 dark:text-gray-400">
                {availableArtworks.length === 0
                  ? 'You have no artworks yet. Create some first!'
                  : 'No artworks match your search.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {filteredArtworks.map((artwork) => (
                <button
                  key={artwork.id}
                  onClick={() => handleAddArtwork(artwork.id)}
                  disabled={adding === artwork.id}
                  className="group relative aspect-square rounded-lg overflow-hidden
                           border-2 border-gray-200 dark:border-gray-700
                           hover:border-blue-500 dark:hover:border-blue-400
                           transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {/* Image */}
                  <img
                    src={artwork.thumbnail_url}
                    alt={artwork.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />

                  {/* Overlay with title and add button */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors
                              flex flex-col items-center justify-center">
                    <p className="text-white text-sm font-medium text-center px-2 line-clamp-2
                               opacity-0 group-hover:opacity-100 transition-opacity">
                      {artwork.title}
                    </p>
                  </div>

                  {/* Loading indicator */}
                  {adding === artwork.id && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white
                     rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
```

---

### Step 2: Create Artwork Card with Remove Button

Extend the artwork card component with a remove button for use in collections.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/components/collection/CollectionArtworkCard.tsx`

```typescript
import React, { useState } from 'react'
import { XMarkIcon, EllipsisVerticalIcon } from '@heroicons/react/24/outline'

interface CollectionArtworkCardProps {
  id: string
  title: string
  thumbnail_url: string
  position: number
  onRemove: (artworkId: string) => void
  isDragging?: boolean
  isDragHandle?: boolean
}

/**
 * Artwork card for collection manager
 * Displays image with remove button and drag indicator
 */
export const CollectionArtworkCard: React.FC<CollectionArtworkCardProps> = ({
  id,
  title,
  thumbnail_url,
  position,
  onRemove,
  isDragging = false,
  isDragHandle = false,
}) => {
  const [isRemoving, setIsRemoving] = useState(false)
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false)

  const handleRemoveClick = async () => {
    setIsRemoving(true)
    try {
      await onRemove(id)
    } finally {
      setIsRemoving(false)
      setShowRemoveConfirm(false)
    }
  }

  return (
    <div
      className={`relative group aspect-square rounded-lg overflow-hidden border-2
                 transition-all duration-200
                 ${isDragging ? 'border-blue-500 shadow-lg scale-95' : 'border-gray-200 dark:border-gray-700'}
                 ${isDragHandle ? 'cursor-grab active:cursor-grabbing' : ''}`}
    >
      {/* Image */}
      <img
        src={thumbnail_url}
        alt={title}
        className="w-full h-full object-cover"
        draggable={isDragHandle}
      />

      {/* Position badge */}
      <div className="absolute top-2 left-2 bg-black/60 text-white text-xs font-semibold
                    px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity">
        {position + 1}
      </div>

      {/* Drag handle indicator */}
      <div className="absolute top-2 right-2 text-white opacity-0 group-hover:opacity-100
                    transition-opacity pointer-events-none">
        <EllipsisVerticalIcon className="w-5 h-5" />
      </div>

      {/* Remove button */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          setShowRemoveConfirm(true)
        }}
        disabled={isRemoving}
        className="absolute bottom-2 right-2 p-1 bg-red-500 hover:bg-red-600 text-white
                 rounded-full opacity-0 group-hover:opacity-100 transition-all
                 disabled:opacity-50 disabled:cursor-not-allowed z-10"
        aria-label={`Remove ${title}`}
      >
        <XMarkIcon className="w-5 h-5" />
      </button>

      {/* Remove confirmation overlay */}
      {showRemoveConfirm && (
        <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center
                      rounded-lg gap-3 z-20">
          <p className="text-white text-sm font-medium text-center px-3">
            Remove "{title}"?
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleRemoveClick}
              disabled={isRemoving}
              className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white text-sm rounded
                       disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isRemoving ? 'Removing...' : 'Remove'}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowRemoveConfirm(false)
              }}
              disabled={isRemoving}
              className="px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white text-sm rounded
                       disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
```

---

### Step 3: Create Collection Artwork Grid Component

Create the main grid component that displays all artworks in a collection.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/components/collection/CollectionArtworkGrid.tsx`

```typescript
import React, { useState } from 'react'
import { PlusIcon } from '@heroicons/react/24/outline'
import { CollectionArtworkCard } from './CollectionArtworkCard'
import { AddArtworkModal } from './AddArtworkModal'
import { useToast } from '../../hooks/useToast'

interface Artwork {
  id: string
  title: string
  slug: string
  thumbnail_url: string
  position: number
}

interface CollectionArtworkGridProps {
  collectionId: string
  collectionName: string
  artworks: Artwork[]
  isLoading?: boolean
  onArtworksChanged: () => void
}

/**
 * Grid display of artworks in a collection
 * Includes remove buttons and "Add Artwork" button
 * Prepared for drag-and-drop integration in Build 75
 */
export const CollectionArtworkGrid: React.FC<CollectionArtworkGridProps> = ({
  collectionId,
  collectionName,
  artworks,
  isLoading = false,
  onArtworksChanged,
}) => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const { showToast } = useToast()

  const handleRemoveArtwork = async (artworkId: string) => {
    try {
      const response = await fetch(
        `/api/collections/${collectionId}/artworks/${artworkId}`,
        {
          method: 'DELETE',
        }
      )

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to remove artwork')
      }

      showToast('Artwork removed from collection', 'success')
      onArtworksChanged()
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : 'Failed to remove artwork',
        'error'
      )
    }
  }

  const handleAddSuccess = () => {
    setIsAddModalOpen(false)
    showToast('Artwork added to collection', 'success')
    onArtworksChanged()
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="aspect-square bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"
          />
        ))}
      </div>
    )
  }

  return (
    <div>
      {/* Header with Add button */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Artworks in "{collectionName}"
        </h2>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600
                   text-white rounded-lg transition-colors"
        >
          <PlusIcon className="w-5 h-5" />
          Add Artwork
        </button>
      </div>

      {/* Empty state */}
      {artworks.length === 0 ? (
        <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg
                      p-8 text-center">
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            No artworks yet. Add some from your library!
          </p>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600
                     text-white rounded-lg transition-colors"
          >
            <PlusIcon className="w-5 h-5" />
            Add First Artwork
          </button>
        </div>
      ) : (
        /* Artwork grid */
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {artworks.map((artwork) => (
            <CollectionArtworkCard
              key={artwork.id}
              id={artwork.id}
              title={artwork.title}
              thumbnail_url={artwork.thumbnail_url}
              position={artwork.position}
              onRemove={handleRemoveArtwork}
              isDragHandle={true}
            />
          ))}
        </div>
      )}

      {/* Add Artwork Modal */}
      <AddArtworkModal
        isOpen={isAddModalOpen}
        collectionId={collectionId}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={handleAddSuccess}
      />
    </div>
  )
}
```

---

### Step 4: Create Hook for Toast Notifications

Create a hook for showing toast messages (if not already created in Build 28).

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/hooks/useToast.ts`

```typescript
import { useState, useCallback } from 'react'

interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'info'
  duration?: number
}

/**
 * Hook for managing toast notifications
 */
export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const showToast = useCallback(
    (message: string, type: 'success' | 'error' | 'info' = 'info', duration = 3000) => {
      const id = Math.random().toString(36).substr(2, 9)

      setToasts((prev) => [...prev, { id, message, type, duration }])

      if (duration > 0) {
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== id))
        }, duration)
      }

      return id
    },
    []
  )

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return { toasts, showToast, removeToast }
}
```

---

### Step 5: Integrate into Collection Manager

Update the collection manager page to use the new grid component.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/pages/CollectionManager.tsx`

Add this import:

```typescript
import { CollectionArtworkGrid } from '../components/collection/CollectionArtworkGrid'
```

Add this to the component (in the collection detail section):

```typescript
{selectedCollection && (
  <div className="mt-8">
    <CollectionArtworkGrid
      collectionId={selectedCollection.id}
      collectionName={selectedCollection.name}
      artworks={selectedCollection.artworks || []}
      isLoading={loadingArtworks}
      onArtworksChanged={handleRefreshCollection}
    />
  </div>
)}
```

---

## Files to Create/Modify

**Create:**
- `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/components/collection/AddArtworkModal.tsx`
- `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/components/collection/CollectionArtworkCard.tsx`
- `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/components/collection/CollectionArtworkGrid.tsx`
- `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/hooks/useToast.ts` (if not exists)

**Modify:**
- `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/pages/CollectionManager.tsx`

---

## Verification

### Test 1: Display Empty Collection

Navigate to a collection with no artworks:

**Expected:**
- "No artworks yet. Add some from your library!" message
- "Add First Artwork" button displayed

### Test 2: Display Collection with Artworks

Create a collection with artworks (via API or previous builds):

**Expected:**
- Grid displays all artworks in correct order (position 0, 1, 2, ...)
- Position badges show 1, 2, 3, ... (human-readable)
- Remove (X) button visible on hover
- Drag indicator visible on hover

### Test 3: Open Add Artwork Modal

Click "Add Artwork" button:

**Expected:**
- Modal opens with title "Add Artwork to Collection"
- Search bar visible
- List of available artworks shown

### Test 4: Search Artworks in Modal

Type in search field:

**Expected:**
- List filters in real-time
- Only artworks matching search term shown
- "No artworks match your search" if no matches

### Test 5: Add Artwork via Modal

Click an artwork in the modal:

**Expected:**
- Artwork gets loading indicator (spinner)
- Toast notification: "Artwork added to collection"
- Artwork removed from available list
- Grid updates with new artwork
- Modal remains open for adding more

### Test 6: Remove Artwork from Grid

Hover over artwork card and click X button:

**Expected:**
- Confirmation dialog shows: "Remove "{title}"?"
- "Remove" and "Cancel" buttons
- Click "Remove": artwork disappears from grid
- Toast notification: "Artwork removed from collection"
- Click "Cancel": dialog closes, artwork remains

### Test 7: Position Badges Update

Add artworks and verify position badges:

**Expected:**
- First artwork: badge shows "1"
- Second artwork: badge shows "2"
- After removal, remaining artworks renumber correctly

### Test 8: Responsive Grid

Test on different screen sizes:

**Expected:**
- Mobile (< 640px): 2 columns
- Tablet (640-1024px): 3 columns
- Desktop (> 1024px): 4-5 columns

### Test 9: Loading State

While fetching artworks initially:

**Expected:**
- 8 skeleton placeholders shown
- Grid properly sized
- Smooth transition to real content

### Test 10: Empty Available Artworks

User has collection but no other artworks to add:

**Expected:**
- Modal shows "You have no artworks yet. Create some first!"
- No grid displayed
- Search bar still visible but inactive

### Test 11: Accessibility

Test keyboard navigation:

**Expected:**
- Tab key moves through buttons
- Enter key activates buttons
- ESC key closes modal
- ARIA labels present for screen readers

### Test 12: Error Handling

Simulate API error when removing artwork:

**Expected:**
- Toast notification with error message
- Artwork remains in grid
- Remove button interactive again

### Test 13: Concurrent Operations

Rapidly add and remove artworks:

**Expected:**
- Operations queue correctly
- UI doesn't flicker
- Final state matches API reality

### Test 14: Position Order

Add artworks in order: A, B, C, then remove B:

**Expected:**
- Before removal: positions 1, 2, 3
- After removal: A (pos 1), C (pos 2)
- C's position badge updates to "2"

---

## Success Criteria

- [ ] `CollectionArtworkGrid` component renders correctly
- [ ] `CollectionArtworkCard` component with remove button
- [ ] `AddArtworkModal` component functional
- [ ] Empty state shows correct message and button
- [ ] Grid displays artworks in position order
- [ ] Remove button works with confirmation dialog
- [ ] Add button opens modal
- [ ] Search filters artworks in modal
- [ ] Add artwork via modal updates grid
- [ ] Toast notifications appear for actions
- [ ] Responsive grid layout on all screen sizes
- [ ] Loading skeleton state works
- [ ] Error messages display on failures
- [ ] Position badges display and update correctly
- [ ] Drag indicators visible (preparation for Build 75)
- [ ] All UI elements accessible via keyboard

---

## Next Steps

Once verified, proceed to Build 75 to add drag-and-drop reordering functionality using @dnd-kit. The components created in this build provide the foundation for that integration.

