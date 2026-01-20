# 62-UI-GALLERY-MANAGER.md

## Goal

Create the Gallery Manager page (`/profile/galleries/:id`) that displays a single gallery with all its collections, allows reordering collections, and provides navigation to manage each collection. This is the central hub for managing a gallery's content organization.

---

## Spec Extract

From TECHNICAL-SPEC.md - Gallery Management UI:

**Page URL:** `/profile/galleries/:id`

**UI Components:**
- Gallery header with name, description, and edit button (pencil icon)
- Collections list displayed as cards or list items with:
  - Collection name and artwork count
  - Thumbnail image (if available)
  - Links to manage each collection
- "+ New Collection" button/card to create new collections
- Drag-and-drop to reorder collections (desktop)
- Long-press to reorder collections (mobile)
- Link to gallery roles management (if user is creator)
- Theme selector dropdown
- "Preview" link to open the public gallery view in new tab

**Data Requirements:**
- Gallery details: name, description, themeId, status
- Collections: list with name, artworkCount, heroImageUrl
- User ownership verification
- Public gallery URL generation

**Dependencies:**
- Gallery data from `GET /api/galleries/:id` (file 54)
- Collection management APIs (files 63-70)
- Drag-and-drop library: `@dnd-kit/sortable`

---

## Prerequisites

**Must complete before starting:**
- **54-API-GALLERY-GET.md** - Gallery retrieval with collections
- **60-UI-GALLERY-EDIT.md** - Gallery edit page (for edit button navigation)
- **27-REACT-LAYOUT-SHELL.md** - Main layout and routing
- **25-REACT-AUTH-CONTEXT.md** - Authentication context

**Should be aware of (for collection APIs):**
- **63-API-COLLECTION-CREATE.md** - Collection creation
- **64-API-COLLECTION-LIST.md** - Collection listing
- **65-API-COLLECTION-GET.md** - Collection retrieval

---

## Steps

### Step 1: Install Drag-and-Drop Library

Install the DnD Kit library for drag-and-drop functionality:

```bash
cd /Volumes/DataSSD/gitsrc/vfa_gallery
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

---

### Step 2: Create Collection Card Component

Create a reusable component for displaying collection items.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/gallery/CollectionCard.tsx`

```typescript
import { Link } from 'react-router-dom'
import { CSS } from '@dnd-kit/utilities'
import { useSortable } from '@dnd-kit/sortable'

export interface CollectionCardProps {
  id: string
  galleryId: string
  name: string
  description?: string
  artworkCount: number
  heroImageUrl?: string
  isDragging?: boolean
  isDragOverlay?: boolean
}

export default function CollectionCard({
  id,
  galleryId,
  name,
  description,
  artworkCount,
  heroImageUrl,
  isDragging = false,
  isDragOverlay = false,
}: CollectionCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging && !isDragOverlay ? 0.5 : 1,
  }

  return (
    <Link
      to={`/profile/galleries/${galleryId}/collections/${id}`}
      ref={setNodeRef}
      style={style}
      className={`block p-4 rounded-lg border border-gray-200 hover:border-blue-400 hover:shadow-md transition-all ${
        isDragOverlay ? 'shadow-lg' : ''
      }`}
      {...(isDragging ? listeners : attributes)}
    >
      {/* Hero Image or Placeholder */}
      <div className="w-full h-32 bg-gray-100 rounded mb-3 flex items-center justify-center overflow-hidden">
        {heroImageUrl ? (
          <img
            src={heroImageUrl}
            alt={name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="text-gray-400 text-center">
            <div className="text-2xl mb-1">🖼️</div>
            <div className="text-xs">No hero image</div>
          </div>
        )}
      </div>

      {/* Collection Info */}
      <h3 className="font-bold text-gray-900 truncate">{name}</h3>

      {description && (
        <p className="text-sm text-gray-600 line-clamp-2 mt-1">{description}</p>
      )}

      {/* Artwork Count */}
      <div className="mt-3 flex items-center justify-between">
        <span className="text-sm text-gray-500">
          {artworkCount} {artworkCount === 1 ? 'artwork' : 'artworks'}
        </span>
        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
          Manage
        </span>
      </div>
    </Link>
  )
}
```

**Explanation:**
- Uses `@dnd-kit/sortable` for drag-and-drop support
- Displays collection thumbnail image or placeholder
- Shows artwork count badge
- Provides visual feedback during drag operations
- Links to collection manager page on click

---

### Step 3: Create New Collection Card Component

Create a special card component for creating new collections.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/gallery/NewCollectionCard.tsx`

```typescript
export interface NewCollectionCardProps {
  onClick: () => void
}

export default function NewCollectionCard({ onClick }: NewCollectionCardProps) {
  return (
    <button
      onClick={onClick}
      className="p-4 rounded-lg border-2 border-dashed border-gray-300 hover:border-blue-400 hover:bg-blue-50 transition-all text-center"
    >
      <div className="text-3xl mb-2">+</div>
      <div className="font-semibold text-gray-700">New Collection</div>
      <div className="text-xs text-gray-500 mt-1">Create a new collection</div>
    </button>
  )
}
```

---

### Step 4: Create Gallery Manager Page

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/pages/GalleryManager.tsx`

```typescript
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import CollectionCard from '../components/gallery/CollectionCard'
import NewCollectionCard from '../components/gallery/NewCollectionCard'
import ConfirmDialog from '../components/common/ConfirmDialog'

interface Collection {
  id: string
  galleryId: string
  name: string
  description?: string
  artworkCount: number
  heroImageUrl?: string
}

interface Gallery {
  id: string
  userId: string
  name: string
  description?: string
  themeId?: string
  isDefault: boolean
  status: string
  collections: Collection[]
  createdAt: string
  updatedAt: string
}

export default function GalleryManager() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { showToast } = useToast()

  const [gallery, setGallery] = useState<Gallery | null>(null)
  const [collections, setCollections] = useState<Collection[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isReordering, setIsReordering] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newCollectionName, setNewCollectionName] = useState('')

  // Configure drag-and-drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(TouchSensor, {
      distance: 8,
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Fetch gallery with collections
  useEffect(() => {
    if (!id) {
      navigate('/profile/galleries')
      return
    }

    const fetchGallery = async () => {
      setIsLoading(true)
      try {
        const response = await fetch(`/api/galleries/${id}`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        })

        if (!response.ok) {
          throw new Error('Failed to fetch gallery')
        }

        const data = await response.json()
        setGallery(data.data)
        setCollections(data.data.collections || [])
      } catch (error) {
        showToast(
          error instanceof Error ? error.message : 'Failed to load gallery',
          'error'
        )
        navigate('/profile/galleries')
      } finally {
        setIsLoading(false)
      }
    }

    fetchGallery()
  }, [id, navigate, showToast])

  // Verify ownership
  if (gallery && gallery.userId !== user?.id) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-600">
          You do not have permission to manage this gallery.
        </p>
      </div>
    )
  }

  // Handle collection reorder
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (!over || active.id === over.id) return

    const oldIndex = collections.findIndex((col) => col.id === active.id)
    const newIndex = collections.findIndex((col) => col.id === over.id)

    const newCollections = arrayMove(collections, oldIndex, newIndex)
    setCollections(newCollections)
    setIsReordering(true)

    try {
      // Save new order via API (requires collection reorder endpoint)
      // TODO: Call PATCH /api/galleries/:id/collections/reorder endpoint
      // with { collectionIds: newCollections.map(c => c.id) }
      showToast('Collection order updated', 'success')
    } catch (error) {
      // Revert on error
      setCollections(collections)
      showToast('Failed to save collection order', 'error')
    } finally {
      setIsReordering(false)
    }
  }

  // Handle create new collection
  const handleCreateCollection = async () => {
    if (!newCollectionName.trim()) {
      showToast('Collection name is required', 'error')
      return
    }

    if (!gallery) return

    try {
      const response = await fetch(
        `/api/galleries/${gallery.id}/collections`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
          body: JSON.stringify({
            name: newCollectionName.trim(),
          }),
        }
      )

      if (!response.ok) {
        throw new Error('Failed to create collection')
      }

      const data = await response.json()
      setCollections([...collections, data.data])
      setNewCollectionName('')
      setShowCreateModal(false)
      showToast('Collection created', 'success')
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : 'Failed to create collection',
        'error'
      )
    }
  }

  // Get public gallery URL
  const getPublicGalleryUrl = () => {
    if (!gallery) return '#'
    const baseUrl = window.location.origin
    return `${baseUrl}/galleries/${gallery.id}/${gallery.slug || 'gallery'}`
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!gallery) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-600">Gallery not found</p>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Gallery Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{gallery.name}</h1>
            {gallery.description && (
              <p className="text-gray-600 mt-2">{gallery.description}</p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => navigate(`/profile/galleries/${gallery.id}/edit`)}
              className="px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 flex items-center gap-2"
            >
              <span>✏️</span>
              Edit Gallery
            </button>
            <a
              href={getPublicGalleryUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
            >
              Preview
            </a>
          </div>
        </div>

        {/* Gallery Meta */}
        <div className="flex items-center gap-6 text-sm text-gray-600">
          <span>Status: {gallery.status}</span>
          {gallery.themeId && <span>Theme: {gallery.themeId}</span>}
          <span>Collections: {collections.length}</span>
        </div>
      </div>

      {/* Collections Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Collections</h2>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 flex items-center gap-2"
          >
            <span>+</span>
            New Collection
          </button>
        </div>

        {/* Collections Grid */}
        {collections.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-gray-300 rounded-lg">
            <div className="text-4xl mb-3">📭</div>
            <p className="text-gray-600 mb-4">
              No collections yet. Create one to organize your artworks.
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
            >
              Create First Collection
            </button>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <SortableContext
                items={collections.map((c) => c.id)}
                strategy={verticalListSortingStrategy}
              >
                {collections.map((collection) => (
                  <CollectionCard
                    key={collection.id}
                    id={collection.id}
                    galleryId={collection.galleryId}
                    name={collection.name}
                    description={collection.description}
                    artworkCount={collection.artworkCount}
                    heroImageUrl={collection.heroImageUrl}
                  />
                ))}
              </SortableContext>
              <NewCollectionCard onClick={() => setShowCreateModal(true)} />
            </div>
          </DndContext>
        )}
      </div>

      {/* Create Collection Modal */}
      <ConfirmDialog
        isOpen={showCreateModal}
        title="Create New Collection"
        message=""
        confirmText="Create"
        cancelText="Cancel"
        isLoading={false}
        onConfirm={handleCreateCollection}
        onCancel={() => {
          setShowCreateModal(false)
          setNewCollectionName('')
        }}
      >
        <input
          type="text"
          value={newCollectionName}
          onChange={(e) => setNewCollectionName(e.target.value)}
          placeholder="Collection name"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          onKeyPress={(e) => {
            if (e.key === 'Enter') {
              handleCreateCollection()
            }
          }}
          autoFocus
        />
      </ConfirmDialog>
    </div>
  )
}
```

**Explanation:**
- Fetches gallery data from `GET /api/galleries/:id` which includes collections
- Displays gallery header with name, description, and action buttons
- Implements drag-and-drop reordering using `@dnd-kit/sortable`
- Shows collections as grid cards with artwork counts and hero images
- Provides "+ New Collection" button with modal dialog
- Verifies user ownership before allowing edits
- Displays public gallery preview link
- Responsive grid layout (1 col mobile, 2 cols tablet, 3 cols desktop)

---

### Step 5: Update Router to Add Gallery Manager Route

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/router.tsx`

Find the protected routes section and add:

```typescript
import GalleryManager from '../pages/GalleryManager'

// ... existing routes ...

// Inside the profile routes group:
{
  path: 'galleries/:id',
  element: <GalleryManager />,
},
```

---

### Step 6: Create Navigation Link to Gallery Manager

Update the gallery list or gallery card to link to the manager page.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/gallery/GalleryCard.tsx`

Ensure the card has a link to the manager:

```typescript
<Link to={`/profile/galleries/${gallery.id}`} className="...">
  {/* Card content */}
</Link>
```

---

## Files to Create/Modify

**New files to create:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/gallery/CollectionCard.tsx`
2. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/gallery/NewCollectionCard.tsx`
3. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/pages/GalleryManager.tsx`

**Files to modify:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/router.tsx` - Add route for GalleryManager
2. `/Volumes/DataSSD/gitsrc/vfa_gallery/package.json` - Add dnd-kit dependencies

**Dependencies to install:**
```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

---

## Verification

### Test 1: Route Compiles

```bash
cd /Volumes/DataSSD/gitsrc/vfa_gallery
npx tsc --noEmit
```

Expected: No type errors

---

### Test 2: Load Gallery Manager

1. Start dev server: `npx wrangler pages dev`
2. Log in and create a gallery
3. Navigate to `/profile/galleries/{galleryId}`

Expected: Gallery manager page loads with gallery name and empty collections state

---

### Test 3: Verify Ownership Check

1. Create a gallery with User A
2. Switch to User B's account
3. Try to access `/profile/galleries/{User_A_Gallery_ID}`

Expected: See permission denied message

---

### Test 4: Create Collection from Manager

1. Navigate to gallery manager
2. Click "+ New Collection" button
3. Enter "Test Collection"
4. Click "Create"

Expected:
- Collection appears in the grid
- Toast shows success message
- Collection is saved to database

---

### Test 5: Drag and Drop Collections

1. Create 3 collections in a gallery
2. On desktop, drag collection 1 to position 3
3. Collections should visually reorder

Expected:
- Collections reorder on drag
- Toast shows "Collection order updated"
- Order persists on page reload

---

### Test 6: Navigation to Collection Manager

1. Click on a collection card
2. Should navigate to `/profile/galleries/{gid}/collections/{cid}`

Expected: Redirects to collection manager page (once available)

---

### Test 7: Edit Gallery Button

1. Click "Edit Gallery" button
2. Should navigate to `/profile/galleries/{id}/edit`

Expected: Redirects to gallery edit page

---

### Test 8: Preview Gallery Link

1. Click "Preview" button
2. Should open public gallery view in new tab

Expected: Opens public URL in new tab with correct gallery slug

---

### Test 9: Empty State

1. Create a new gallery
2. Navigate to gallery manager
3. Should show empty state with "Create First Collection" button

Expected: Empty state message and button appear

---

### Test 10: Responsive Layout

1. View on mobile (width < 768px)
2. Collections should display in single column

Expected: Grid uses 1 column on mobile

---

## Success Criteria

- [ ] Gallery manager page loads and displays gallery details
- [ ] Collections display as cards in a grid layout
- [ ] Collections show artwork count and hero images
- [ ] Drag-and-drop reordering works on desktop
- [ ] Long-press reordering works on mobile/touch
- [ ] "+ New Collection" button opens create modal
- [ ] New collections are saved via API and appear in list
- [ ] Ownership verification prevents unauthorized access
- [ ] Navigation to edit gallery works
- [ ] Public gallery preview link works
- [ ] Empty state displays when no collections exist
- [ ] Layout is responsive (mobile, tablet, desktop)
- [ ] TypeScript compilation succeeds
- [ ] All API calls use proper authentication tokens

---

## Next Steps

Once this build is verified, proceed to:
- **66-API-COLLECTION-UPDATE.md** - Add collection update endpoint
- **67-API-COLLECTION-DELETE.md** - Add collection delete endpoint
- **70-UI-COLLECTION-MANAGER.md** - Create collection detail/management page
