# Build 75: Collection Artwork Drag-Drop Reorder

## Goal

Create drag-and-drop reordering functionality for collection artworks using @dnd-kit library, with optimistic UI updates and rollback on error, supporting both desktop (click-drag) and mobile (long-press-drag).

---

## Spec Extract

From TECHNICAL-SPEC.md - Collection-Artwork Management UI:

**Desktop Interaction:**
- Click and drag artwork card to reorder
- Visual feedback: shadow and slight scale on dragged item
- Drop zone highlights show valid placement areas
- Auto-save on drop (API call)

**Mobile Interaction:**
- Long-press to pick up artwork
- Drag finger to position
- Release to drop
- Same visual feedback as desktop

**Optimistic Updates:**
- UI updates immediately on drop
- If API fails, rollback to previous order
- Error toast message on failure

---

## Prerequisites

**Must complete before starting:**
- **74-UI-COLLECTION-ARTWORK-GRID.md** - Grid and card components
- **73-API-COLLECTION-ARTWORKS-REORDER.md** - Reorder API endpoint
- **28-REACT-TOAST-SYSTEM.md** - Toast notification system

---

## Steps

### Step 1: Install dnd-kit Dependencies

Add the required drag-and-drop library packages.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/package.json`

Add these dependencies to the `dependencies` section (if not already present):

```json
"dependencies": {
  "@dnd-kit/core": "^6.1.0",
  "@dnd-kit/sortable": "^7.0.2",
  "@dnd-kit/utilities": "^3.2.1",
  "@dnd-kit/modifiers": "^6.0.1"
}
```

Install dependencies:

```bash
cd /Volumes/DataSSD/gitsrc/vfa_gallery
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities @dnd-kit/modifiers
```

---

### Step 2: Create Sortable Artwork Card Component

Create a wrapper for artwork cards that works with dnd-kit.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/components/collection/SortableArtworkCard.tsx`

```typescript
import React from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { CollectionArtworkCard } from './CollectionArtworkCard'

interface SortableArtworkCardProps {
  id: string
  title: string
  thumbnail_url: string
  position: number
  onRemove: (artworkId: string) => void
}

/**
 * Sortable wrapper for artwork card
 * Integrates with dnd-kit for drag-and-drop reordering
 */
export const SortableArtworkCard: React.FC<SortableArtworkCardProps> = ({
  id,
  title,
  thumbnail_url,
  position,
  onRemove,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`transition-all duration-200 ${isOver ? 'scale-105 z-10' : ''}`}
    >
      <CollectionArtworkCard
        id={id}
        title={title}
        thumbnail_url={thumbnail_url}
        position={position}
        onRemove={onRemove}
        isDragging={isDragging}
        isDragHandle={true}
      />
    </div>
  )
}
```

---

### Step 3: Create Sortable Grid Container Component

Create the grid container that manages the drag-and-drop context.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/components/collection/SortableArtworkGrid.tsx`

```typescript
import React, { useState, useCallback, useEffect } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragCancelEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { PlusIcon } from '@heroicons/react/24/outline'
import { SortableArtworkCard } from './SortableArtworkCard'
import { AddArtworkModal } from './AddArtworkModal'
import { useToast } from '../../hooks/useToast'

interface Artwork {
  id: string
  title: string
  slug: string
  thumbnail_url: string
  position: number
}

interface SortableArtworkGridProps {
  collectionId: string
  collectionName: string
  artworks: Artwork[]
  isLoading?: boolean
  onArtworksChanged: () => void
}

/**
 * Sortable grid with drag-and-drop reordering
 * Manages dnd-kit context and optimistic updates
 */
export const SortableArtworkGrid: React.FC<SortableArtworkGridProps> = ({
  collectionId,
  collectionName,
  artworks: initialArtworks,
  isLoading = false,
  onArtworksChanged,
}) => {
  const [artworks, setArtworks] = useState<Artwork[]>(initialArtworks)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const { showToast } = useToast()

  // Update artworks when props change
  useEffect(() => {
    setArtworks(initialArtworks)
  }, [initialArtworks])

  // Configure drag sensors for desktop and mobile
  const sensors = useSensors(
    useSensor(PointerSensor, {
      distance: 8, // Start drag after 8px movement
    }),
    useSensor(TouchSensor, {
      delay: 250, // Long-press delay (250ms)
      tolerance: 5,
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragStart = (event: DragStartEvent) => {
    setDraggedId(event.active.id as string)
  }

  const handleDragCancel = () => {
    setDraggedId(null)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    setDraggedId(null)

    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = artworks.findIndex((a) => a.id === active.id)
      const newIndex = artworks.findIndex((a) => a.id === over.id)

      // Optimistic update
      const newArtworks = arrayMove(artworks, oldIndex, newIndex)
      const updatedArtworks = newArtworks.map((a, i) => ({
        ...a,
        position: i,
      }))
      setArtworks(updatedArtworks)

      // Save to API
      setIsSaving(true)
      try {
        const artworkIds = updatedArtworks.map((a) => a.id)
        const response = await fetch(
          `/api/collections/${collectionId}/artworks/reorder`,
          {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ artworkIds }),
          }
        )

        if (!response.ok) {
          // Rollback on error
          const error = await response.json()
          setArtworks(initialArtworks)
          throw new Error(error.error || 'Failed to save order')
        }

        showToast('Order saved', 'success')
        onArtworksChanged()
      } catch (error) {
        showToast(
          error instanceof Error ? error.message : 'Failed to save order',
          'error'
        )
      } finally {
        setIsSaving(false)
      }
    }
  }

  const handleRemoveArtwork = async (artworkId: string) => {
    // Optimistic removal
    const previousArtworks = artworks
    setArtworks((prev) => {
      const filtered = prev.filter((a) => a.id !== artworkId)
      return filtered.map((a, i) => ({
        ...a,
        position: i,
      }))
    })

    try {
      const response = await fetch(
        `/api/collections/${collectionId}/artworks/${artworkId}`,
        {
          method: 'DELETE',
        }
      )

      if (!response.ok) {
        // Rollback on error
        setArtworks(previousArtworks)
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
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Artworks in "{collectionName}"
          </h2>
          {artworks.length > 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {artworks.length} artwork{artworks.length !== 1 ? 's' : ''}
              {isSaving && ' • Saving order...'}
            </p>
          )}
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          disabled={isSaving}
          className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600
                   text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
        /* Drag-and-drop context */
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <SortableContext items={artworks.map((a) => a.id)}>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {artworks.map((artwork, index) => (
                <SortableArtworkCard
                  key={artwork.id}
                  id={artwork.id}
                  title={artwork.title}
                  thumbnail_url={artwork.thumbnail_url}
                  position={index}
                  onRemove={handleRemoveArtwork}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Drag hint for desktop users */}
      {artworks.length > 1 && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-4 text-center">
          Drag artworks to reorder (hold for 250ms on mobile)
        </p>
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

### Step 4: Update Collection Manager to Use Sortable Grid

Replace the previous grid component with the new sortable version.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/pages/CollectionManager.tsx`

Replace the import:

```typescript
// OLD:
// import { CollectionArtworkGrid } from '../components/collection/CollectionArtworkGrid'

// NEW:
import { SortableArtworkGrid } from '../components/collection/SortableArtworkGrid'
```

Replace the component usage:

```typescript
{selectedCollection && (
  <div className="mt-8">
    <SortableArtworkGrid
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

### Step 5: Add CSS for Smooth Transitions (Optional but Recommended)

Add Tailwind-compatible animations for drag feedback.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/styles/globals.css`

Add this CSS (or ensure Tailwind animations are available):

```css
/* Drag feedback animations */
@keyframes dragPulse {
  0% {
    box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7);
  }
  70% {
    box-shadow: 0 0 0 8px rgba(59, 130, 246, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(59, 130, 246, 0);
  }
}

/* Smooth reorder transition */
.drag-over {
  @apply border-blue-500 border-2;
}

/* Touch action for mobile drag */
.drag-item {
  touch-action: none;
}
```

---

## Files to Create/Modify

**Create:**
- `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/components/collection/SortableArtworkCard.tsx`
- `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/components/collection/SortableArtworkGrid.tsx`

**Modify:**
- `/Volumes/DataSSD/gitsrc/vfa_gallery/package.json` (add dependencies)
- `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/pages/CollectionManager.tsx` (use new component)

---

## Verification

### Test 1: Desktop Drag-and-Drop

Desktop browser, hover over artwork:

**Expected:**
- Cursor changes to grab/grabbing
- Drag indicators visible
- Can click and drag artwork

### Test 2: Drag and Reorder

Drag first artwork to third position:

**Expected:**
- Dragged artwork follows cursor
- Other artworks shift to make space
- Smooth visual feedback (shadow/scale)
- On drop: "Order saved" toast

### Test 3: Verify Database Update

Check collection_artworks positions after reorder:

```bash
wrangler d1 execute site --command="SELECT artwork_id, position FROM collection_artworks WHERE collection_id='col-73' ORDER BY position;"
```

Expected: Positions match new order (0, 1, 2, 3...).

### Test 4: Rollback on API Error

Mock API error during reorder (or temporarily disable endpoint):

**Expected:**
- Artworks revert to original order
- Error toast appears: "Failed to save order"
- User can retry

### Test 5: Multiple Reorders

Reorder artworks multiple times quickly:

**Expected:**
- Each reorder saves correctly
- No visual artifacts or flashing
- Final order matches last saved state

### Test 6: Mobile Long-Press

Mobile device/Chrome DevTools mobile emulation:

**Expected:**
- Press and hold for 250ms to pick up
- Artwork lifts with visual feedback
- Drag to new position
- Release to drop
- "Order saved" message

### Test 7: Mobile Accessibility

Test on real mobile device:

**Expected:**
- Long-press works smoothly
- No lag or jank during drag
- Position updates correctly
- Works in portrait and landscape

### Test 8: Keyboard Navigation

Use keyboard to reorder (arrow keys should work with proper sensor setup):

**Expected:**
- Can navigate with Tab key
- Can drag with keyboard (if implemented)
- All items accessible

### Test 9: Remove During Drag

Try removing artwork while another is being dragged:

**Expected:**
- Remove button hidden during drag
- After drop, remove works normally
- Positions update correctly

### Test 10: Add While Reordering

Add artwork while another is mid-drag:

**Expected:**
- Add button disabled during drag (isSaving)
- After drop completes, add button enabled
- New artwork appears at end with highest position

### Test 11: Single Artwork (No Drag)

Collection with single artwork:

**Expected:**
- Drag not enabled (no cursor change)
- Remove button works
- "Drag artworks to reorder" hint hidden (only 1 item)

### Test 12: Empty State Consistency

Remove all artworks one by one:

**Expected:**
- After last removal, empty state appears
- "Add First Artwork" button visible
- Smooth transition

### Test 13: Network Failure During Save

Simulate network error:

```javascript
// In DevTools console
fetch = () => Promise.reject(new Error('Network error'))
```

Then reorder:

**Expected:**
- Artworks revert to previous order
- Error toast: "Failed to save order"
- Collection state consistent

### Test 14: Long Artwork Titles

Add artwork with very long title:

**Expected:**
- Title fits in badge or truncates properly
- No overflow or layout breaking
- Remove button still accessible

### Test 15: Many Artworks

Add 20+ artworks to collection:

**Expected:**
- Grid remains responsive
- Scroll works smoothly
- Drag performance acceptable
- No lag during reorder

### Test 16: Responsive on All Devices

Test on mobile, tablet, desktop:

**Expected:**
- Correct column count each size
- Gaps and padding appropriate
- Drag works smoothly on all sizes

### Test 17: Concurrent API Calls

Rapidly reorder multiple times:

**Expected:**
- All API calls complete successfully
- Final order is correct
- No race conditions
- Loading indicator shows while saving

### Test 18: Accessibility (a11y)

Screen reader test:

**Expected:**
- Artwork titles announced
- Position numbers announced
- Remove button announces purpose
- Drag feedback conveyed (if possible)

### Test 19: Touch Scrolling

Mobile: Scroll while touching artworks:

**Expected:**
- Scroll works (not confused with drag)
- 250ms delay prevents accidental drags
- Smooth scrolling experience

### Test 20: Dark Mode

Test in dark mode:

**Expected:**
- All visual indicators visible
- Contrast sufficient
- Drag feedback visible
- Colors consistent

---

## Success Criteria

- [ ] @dnd-kit dependencies installed
- [ ] `SortableArtworkCard` component works with dnd-kit
- [ ] `SortableArtworkGrid` manages drag context
- [ ] Desktop drag-and-drop functions (pointer sensor)
- [ ] Mobile long-press drag works (touch sensor)
- [ ] Keyboard support for accessibility
- [ ] Optimistic UI updates immediately
- [ ] Rollback works on API errors
- [ ] Toast notifications for success/failure
- [ ] Position badges update correctly
- [ ] Grid responsive on all device sizes
- [ ] Smooth visual transitions during drag
- [ ] Remove button works during and after reorder
- [ ] Add button works after reorder completes
- [ ] Network errors handled gracefully
- [ ] Performance acceptable with many artworks
- [ ] Drag hint displayed for users
- [ ] All tests pass without errors

---

## Next Steps

Build 75 completes Phase 13 (Collection-Artwork Management). The collection management system is now fully functional with:
- Full CRUD for artworks in collections (Builds 71-73)
- Complete UI with grid display and removal (Build 74)
- Drag-and-drop reordering (Build 75)

Next phases will implement:
- Public views for galleries and collections (Phase 14-16)
- Browse and search functionality (Phase 18-19)
- Additional features as outlined in the build index

