# 70-UI-COLLECTION-MANAGER.md

## Goal

Create the Collection Manager page (`/profile/galleries/:gid/collections/:cid`) that displays a single collection's artworks with full management capabilities including hero image upload, artwork adding/removing, and drag-and-drop reordering.

---

## Spec Extract

From TECHNICAL-SPEC.md - Collection Management UI:

**Page URL:** `/profile/galleries/:gid/collections/:cid`

**UI Components:**
- Collection header with name, description, and edit button (pencil icon)
- Hero image upload area (drag-and-drop or click to upload)
- Artwork grid showing artworks in collection (ordered by position)
- "Add Artwork" button opens modal to select from user's library
- Remove artwork button on each card (X in corner)
- Drag-and-drop to reorder artworks (desktop)
- Long-press to reorder artworks (mobile)
- Theme selector dropdown
- "Preview" link to open public collection view
- Save button to persist all changes

**Data Requirements:**
- Collection details: name, description, heroImageUrl, status
- Artworks: list with position ordering
- User's artwork library for selection modal
- Theme list for dropdown

**Dependencies:**
- Gallery data from `GET /api/galleries/:gid` (file 54)
- Collection data from `GET /api/collections/:cid` (file 65)
- Collection updates via `PATCH /api/collections/:cid` (file 66)
- Collection artwork management APIs (files 71-73)

---

## Prerequisites

**Must complete before starting:**
- **54-API-GALLERY-GET.md** - Gallery retrieval with collections
- **65-API-COLLECTION-GET.md** - Collection retrieval with artworks
- **66-API-COLLECTION-UPDATE.md** - Collection update endpoint
- **62-UI-GALLERY-MANAGER.md** - Gallery manager page
- **27-REACT-LAYOUT-SHELL.md** - Main layout and routing
- **25-REACT-AUTH-CONTEXT.md** - Authentication context
- **28-REACT-TOAST-SYSTEM.md** - Toast notifications

**Should be aware of (for artwork management):**
- **42-API-ARTWORK-LIST.md** - Artwork listing
- **39-WORKER-IMAGE-WATERMARK.md** - Image watermarking

---

## Steps

### Step 1: Create Add Artwork Modal Component

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/gallery/AddArtworkModal.tsx`

```typescript
import { useEffect, useState } from 'react'
import { useToast } from '../../contexts/ToastContext'

export interface UserArtwork {
  id: string
  title: string
  thumbnailUrl?: string
  createdAt: string
}

export interface AddArtworkModalProps {
  isOpen: boolean
  collectionId: string
  onClose: () => void
  onAdd: (artworkId: string) => Promise<void>
}

export default function AddArtworkModal({
  isOpen,
  collectionId,
  onClose,
  onAdd,
}: AddArtworkModalProps) {
  const { showToast } = useToast()
  const [artworks, setArtworks] = useState<UserArtwork[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isAdding, setIsAdding] = useState(false)

  // Fetch user's artworks when modal opens
  useEffect(() => {
    if (!isOpen) return

    const fetchArtworks = async () => {
      setIsLoading(true)
      try {
        const response = await fetch('/api/artworks', {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        })

        if (!response.ok) {
          throw new Error('Failed to fetch artworks')
        }

        const data = await response.json()
        setArtworks(data.data || [])
      } catch (error) {
        showToast(
          error instanceof Error ? error.message : 'Failed to load artworks',
          'error'
        )
      } finally {
        setIsLoading(false)
      }
    }

    fetchArtworks()
  }, [isOpen, showToast])

  const handleAdd = async () => {
    if (!selectedId) {
      showToast('Please select an artwork', 'error')
      return
    }

    setIsAdding(true)
    try {
      await onAdd(selectedId)
      setSelectedId(null)
      onClose()
      showToast('Artwork added to collection', 'success')
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : 'Failed to add artwork',
        'error'
      )
    } finally {
      setIsAdding(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Add Artwork</h2>
          <button
            onClick={onClose}
            disabled={isAdding}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {isLoading ? (
            <div className="flex justify-center items-center h-48">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : artworks.length === 0 ? (
            <div className="text-center py-12 text-gray-600">
              <p className="mb-3">No artworks yet. Create one to add to this collection.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {artworks.map((artwork) => (
                <button
                  key={artwork.id}
                  onClick={() =>
                    setSelectedId(selectedId === artwork.id ? null : artwork.id)
                  }
                  className={`relative rounded-lg overflow-hidden border-2 transition-all ${
                    selectedId === artwork.id
                      ? 'border-blue-600 shadow-lg'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {artwork.thumbnailUrl && (
                    <img
                      src={artwork.thumbnailUrl}
                      alt={artwork.title}
                      className="w-full h-32 object-cover"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-2">
                    <p className="text-white text-xs font-medium line-clamp-2">
                      {artwork.title}
                    </p>
                  </div>
                  {selectedId === artwork.id && (
                    <div className="absolute inset-0 flex items-center justify-center bg-blue-600/20">
                      <div className="bg-blue-600 rounded-full p-2">
                        <svg
                          className="w-4 h-4 text-white"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isAdding}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleAdd}
            disabled={!selectedId || isAdding}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            {isAdding && (
              <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            Add Artwork
          </button>
        </div>
      </div>
    </div>
  )
}
```

---

### Step 2: Create Artwork Grid Card Component

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/gallery/ArtworkGridCard.tsx`

```typescript
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

export interface ArtworkGridCardProps {
  id: string
  title: string
  imageUrl?: string
  position: number
  isDragging?: boolean
  isDragOverlay?: boolean
  onRemove: (id: string) => void
}

export default function ArtworkGridCard({
  id,
  title,
  imageUrl,
  position,
  isDragging = false,
  isDragOverlay = false,
  onRemove,
}: ArtworkGridCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging && !isDragOverlay ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative rounded-lg overflow-hidden bg-gray-100 group cursor-grab active:cursor-grabbing ${
        isDragOverlay ? 'shadow-lg' : 'hover:shadow-md'
      }`}
      {...attributes}
      {...listeners}
    >
      {/* Image */}
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={title}
          className="w-full h-40 object-cover"
        />
      ) : (
        <div className="w-full h-40 flex items-center justify-center text-gray-400">
          <div className="text-center">
            <div className="text-2xl mb-1">🖼️</div>
            <div className="text-xs">No image</div>
          </div>
        </div>
      )}

      {/* Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-3">
        {/* Title and Position */}
        <div className="text-white">
          <p className="font-medium text-sm line-clamp-2">{title}</p>
          <p className="text-xs text-gray-300 mt-1">Position: {position}</p>
        </div>

        {/* Remove Button */}
        <button
          onClick={() => onRemove(id)}
          className="self-end px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-medium transition-colors"
        >
          Remove
        </button>
      </div>
    </div>
  )
}
```

---

### Step 3: Create Collection Manager Page

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/pages/CollectionManager.tsx`

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
import ArtworkGridCard from '../components/gallery/ArtworkGridCard'
import AddArtworkModal from '../components/gallery/AddArtworkModal'

interface Artwork {
  id: string
  collectionId: string
  title: string
  imageUrl?: string
  position: number
}

interface Collection {
  id: string
  galleryId: string
  name: string
  description?: string
  heroImageUrl?: string
  status: string
  artworks: Artwork[]
}

export default function CollectionManager() {
  const { gid: galleryId, cid: collectionId } = useParams<{
    gid: string
    cid: string
  }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { showToast } = useToast()

  const [collection, setCollection] = useState<Collection | null>(null)
  const [artworks, setArtworks] = useState<Artwork[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [heroImageFile, setHeroImageFile] = useState<File | null>(null)
  const [heroImagePreview, setHeroImagePreview] = useState<string | null>(null)

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

  // Fetch collection with artworks
  useEffect(() => {
    if (!galleryId || !collectionId) {
      navigate('/profile/galleries')
      return
    }

    const fetchCollection = async () => {
      setIsLoading(true)
      try {
        const response = await fetch(`/api/collections/${collectionId}`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        })

        if (!response.ok) {
          throw new Error('Failed to fetch collection')
        }

        const data = await response.json()
        setCollection(data.data)
        setArtworks(
          (data.data.artworks || []).sort((a: Artwork, b: Artwork) => a.position - b.position)
        )
        setHeroImagePreview(data.data.heroImageUrl || null)
      } catch (error) {
        showToast(
          error instanceof Error ? error.message : 'Failed to load collection',
          'error'
        )
        navigate(`/profile/galleries/${galleryId}`)
      } finally {
        setIsLoading(false)
      }
    }

    fetchCollection()
  }, [galleryId, collectionId, navigate, showToast])

  // Handle artwork reorder
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (!over || active.id === over.id) return

    const oldIndex = artworks.findIndex((art) => art.id === active.id)
    const newIndex = artworks.findIndex((art) => art.id === over.id)

    const newArtworks = arrayMove(artworks, oldIndex, newIndex)
    // Update positions
    const withPositions = newArtworks.map((art, idx) => ({
      ...art,
      position: idx,
    }))
    setArtworks(withPositions)
  }

  // Handle remove artwork
  const handleRemoveArtwork = async (artworkId: string) => {
    try {
      const response = await fetch(
        `/api/collections/${collectionId}/artworks/${artworkId}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        }
      )

      if (!response.ok) {
        throw new Error('Failed to remove artwork')
      }

      setArtworks(artworks.filter((art) => art.id !== artworkId))
      showToast('Artwork removed from collection', 'success')
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : 'Failed to remove artwork',
        'error'
      )
    }
  }

  // Handle add artwork from modal
  const handleAddArtwork = async (artworkId: string) => {
    try {
      const response = await fetch(
        `/api/collections/${collectionId}/artworks`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
          body: JSON.stringify({
            artworkId,
          }),
        }
      )

      if (!response.ok) {
        throw new Error('Failed to add artwork')
      }

      const data = await response.json()
      setArtworks([...artworks, data.data])
    } catch (error) {
      throw error
    }
  }

  // Handle hero image upload
  const handleHeroImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file
    if (!file.type.startsWith('image/')) {
      showToast('Please select an image file', 'error')
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      // 10MB limit
      showToast('Image must be less than 10MB', 'error')
      return
    }

    setHeroImageFile(file)
    const preview = URL.createObjectURL(file)
    setHeroImagePreview(preview)
  }

  // Handle save changes
  const handleSaveChanges = async () => {
    if (!collection) return

    setIsSaving(true)
    try {
      // Save artwork order
      if (artworks.length > 0) {
        const response = await fetch(
          `/api/collections/${collectionId}/artworks/reorder`,
          {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${localStorage.getItem('token')}`,
            },
            body: JSON.stringify({
              artworks: artworks.map((art, idx) => ({
                id: art.id,
                position: idx,
              })),
            }),
          }
        )

        if (!response.ok) {
          throw new Error('Failed to save artwork order')
        }
      }

      // Upload hero image if changed
      if (heroImageFile) {
        const formData = new FormData()
        formData.append('file', heroImageFile)

        const uploadResponse = await fetch(
          `/api/collections/${collectionId}/hero-image`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${localStorage.getItem('token')}`,
            },
            body: formData,
          }
        )

        if (!uploadResponse.ok) {
          throw new Error('Failed to upload hero image')
        }

        setHeroImageFile(null)
      }

      showToast('Changes saved', 'success')
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : 'Failed to save changes',
        'error'
      )
    } finally {
      setIsSaving(false)
    }
  }

  // Get public collection URL
  const getPublicCollectionUrl = () => {
    if (!collection || !galleryId) return '#'
    const baseUrl = window.location.origin
    return `${baseUrl}/galleries/${galleryId}/${collection.id}`
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!collection) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-600">Collection not found</p>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Collection Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900">{collection.name}</h1>
            {collection.description && (
              <p className="text-gray-600 mt-2">{collection.description}</p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() =>
                navigate(`/profile/galleries/${galleryId}/collections/${collectionId}/edit`)
              }
              className="px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 flex items-center gap-2"
            >
              <span>✏️</span>
              Edit
            </button>
            <a
              href={getPublicCollectionUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
            >
              Preview
            </a>
          </div>
        </div>
      </div>

      {/* Hero Image Upload */}
      <div className="mb-8 p-6 border-2 border-dashed border-gray-300 rounded-lg">
        <label className="block">
          <div className="text-center">
            {heroImagePreview ? (
              <div className="relative inline-block">
                <img
                  src={heroImagePreview}
                  alt="Hero"
                  className="max-h-48 rounded"
                />
                <button
                  onClick={() => {
                    setHeroImagePreview(null)
                    setHeroImageFile(null)
                  }}
                  className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-1"
                >
                  ✕
                </button>
              </div>
            ) : (
              <div className="py-8">
                <div className="text-3xl mb-3">📷</div>
                <p className="font-medium text-gray-700">
                  Drag and drop or click to upload hero image
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  PNG, JPG, GIF up to 10MB
                </p>
              </div>
            )}
          </div>
          <input
            type="file"
            accept="image/*"
            onChange={handleHeroImageChange}
            className="hidden"
          />
        </label>
      </div>

      {/* Artworks Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">
            Artworks ({artworks.length})
          </h2>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 flex items-center gap-2"
          >
            <span>+</span>
            Add Artwork
          </button>
        </div>

        {/* Artworks Grid */}
        {artworks.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-gray-300 rounded-lg">
            <div className="text-4xl mb-3">🎨</div>
            <p className="text-gray-600 mb-4">
              No artworks yet. Add some to get started.
            </p>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
            >
              Add First Artwork
            </button>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              <SortableContext
                items={artworks.map((a) => a.id)}
                strategy={verticalListSortingStrategy}
              >
                {artworks.map((artwork) => (
                  <ArtworkGridCard
                    key={artwork.id}
                    id={artwork.id}
                    title={artwork.title}
                    imageUrl={artwork.imageUrl}
                    position={artwork.position}
                    onRemove={handleRemoveArtwork}
                  />
                ))}
              </SortableContext>
            </div>
          </DndContext>
        )}
      </div>

      {/* Save Button */}
      <div className="fixed bottom-6 right-6">
        <button
          onClick={handleSaveChanges}
          disabled={isSaving || !heroImageFile}
          className="px-6 py-3 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 shadow-lg"
        >
          {isSaving && (
            <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          )}
          Save Changes
        </button>
      </div>

      {/* Add Artwork Modal */}
      <AddArtworkModal
        isOpen={showAddModal}
        collectionId={collectionId}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAddArtwork}
      />
    </div>
  )
}
```

---

### Step 4: Update Router to Add Collection Manager Route

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/router.tsx`

Find the profile routes section and add:

```typescript
import CollectionManager from '../pages/CollectionManager'

// ... existing routes ...

// Inside the profile routes group:
{
  path: 'galleries/:gid/collections/:cid',
  element: <CollectionManager />,
},
```

---

### Step 5: Ensure Collection API Returns Artworks

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/collections.ts`

Update the GET collection endpoint to include artworks:

```typescript
/**
 * GET /api/collections/:id
 * Returns collection with all associated artworks
 */
collectionsRouter.get('/:id', requireAuth, async (c) => {
  const userId = c.get('userId') as string
  const collectionId = c.req.param('id')
  const db = c.env.DB

  if (!collectionId) {
    throw Errors.badRequest('Collection ID is required')
  }

  // Fetch collection
  const collection = await db
    .prepare('SELECT * FROM collections WHERE id = ?')
    .bind(collectionId)
    .first<CollectionRow>()

  if (!collection) {
    throw Errors.notFound('Collection not found')
  }

  // Verify ownership through gallery chain
  const gallery = await db
    .prepare('SELECT user_id FROM galleries WHERE id = ?')
    .bind(collection.gallery_id)
    .first<{ user_id: string }>()

  if (!gallery || gallery.user_id !== userId) {
    throw Errors.forbidden('You do not have permission to access this collection')
  }

  // Fetch artworks in collection with order
  const artworksResult = await db
    .prepare(
      `
      SELECT
        a.id,
        a.title,
        a.thumbnail_url,
        ca.position
      FROM collection_artworks ca
      JOIN artworks a ON a.id = ca.artwork_id
      WHERE ca.collection_id = ?
      ORDER BY ca.position ASC
      `
    )
    .bind(collectionId)
    .all<{ id: string; title: string; thumbnail_url?: string; position: number }>()

  const artworks = artworksResult?.results || []

  const collectionApi = collectionRowToApi(collection)

  return c.json(
    {
      data: {
        ...collectionApi,
        artworks: artworks.map((a) => ({
          id: a.id,
          title: a.title,
          imageUrl: a.thumbnail_url,
          position: a.position,
        })),
      },
    },
    200
  )
})
```

---

## Files to Create/Modify

**New files to create:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/gallery/AddArtworkModal.tsx`
2. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/gallery/ArtworkGridCard.tsx`
3. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/pages/CollectionManager.tsx`

**Files to modify:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/router.tsx` - Add route for CollectionManager
2. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/collections.ts` - Ensure GET includes artworks

---

## Verification

### Test 1: Route Compiles

```bash
cd /Volumes/DataSSD/gitsrc/vfa_gallery
npx tsc --noEmit
```

Expected: No type errors

---

### Test 2: Load Collection Manager

1. Start dev server: `npx wrangler pages dev`
2. Log in and navigate to a gallery
3. Click on a collection
4. Should navigate to `/profile/galleries/{gid}/collections/{cid}`

Expected: Collection manager page loads with collection name and empty artworks state

---

### Test 3: Add Artwork to Collection

1. Click "+ Add Artwork" button
2. Modal opens showing user's artworks
3. Select an artwork
4. Click "Add Artwork"

Expected: Artwork appears in collection grid

---

### Test 4: Remove Artwork from Collection

1. Click "Remove" button on artwork card
2. Artwork should disappear from grid

Expected: Artwork removed from collection

---

### Test 5: Drag and Drop Reorder

1. Add 3 artworks to collection
2. Drag first artwork to last position
3. Artworks visually reorder

Expected: Artworks reorder on drag (positions updated)

---

### Test 6: Hero Image Upload

1. Click hero image upload area
2. Select an image
3. Image preview appears
4. Click "Save Changes"

Expected: Image uploaded and saved

---

### Test 7: Navigation to Edit

1. Click "Edit" button
2. Should navigate to collection edit page

Expected: Redirects to edit collection page (once available)

---

### Test 8: Preview Link

1. Click "Preview" button
2. Should open public collection view in new tab

Expected: Opens public URL in new tab

---

### Test 9: Empty State

1. Create new collection with no artworks
2. Navigate to collection manager

Expected: Empty state message and "Add First Artwork" button appear

---

### Test 10: Responsive Layout

1. View on mobile (width < 768px)
2. Artworks should display in 2 columns

Expected: Grid uses 2 columns on mobile, 3 on tablet, 4 on desktop

---

## Success Criteria

- [ ] Collection manager page loads with collection details
- [ ] Artworks display in a grid with thumbnails
- [ ] Artworks ordered by position
- [ ] Drag-and-drop reordering works on desktop
- [ ] Long-press reordering works on mobile
- [ ] "+ Add Artwork" button opens add modal
- [ ] Add modal shows user's artworks
- [ ] Can select and add artwork from modal
- [ ] Remove button removes artwork from collection
- [ ] Hero image upload area displays
- [ ] Can upload and preview hero image
- [ ] "Save Changes" button persists changes
- [ ] Navigation to edit works
- [ ] Public preview link works
- [ ] Empty state displays when no artworks
- [ ] Layout is responsive
- [ ] TypeScript compilation succeeds

---

## Next Steps

Once this build is verified, collection management is complete. Additional related builds:
- **71-API-COLLECTION-ARTWORK-ADD.md** - Add artwork to collection endpoint (referenced)
- **72-API-COLLECTION-ARTWORK-REMOVE.md** - Remove artwork from collection endpoint (referenced)
- **73-API-COLLECTION-ARTWORK-REORDER.md** - Reorder artworks in collection endpoint (referenced)
