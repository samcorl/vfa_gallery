# 132-UI-GALLERY-ROLES.md

## Goal

Create the Gallery Roles management UI as a tab/section in the Gallery Manager. Only visible to the gallery creator. Allows viewing current admins, adding new admins by username search, and removing admins.

---

## Spec Extract

From TECHNICAL-SPEC.md - Gallery Management UI:

**Page Location:** `/profile/galleries/:id` - Roles Tab (alongside Collections tab)

**UI Components:**
- Roles list showing current admins with:
  - User avatar
  - Username and display name
  - Role label (Creator/Admin)
  - Assigned date
  - Remove button (for admins only)
- Add admin section with:
  - Username search input with autocomplete
  - "Add Admin" button
  - Validation feedback
- Creator info (read-only, cannot be removed)

**Data Requirements:**
- Gallery roles from `GET /api/galleries/:id/roles`
- Add role via `POST /api/galleries/:id/roles`
- Remove role via `DELETE /api/galleries/:id/roles/:userId`

---

## Prerequisites

**Must complete before starting:**
- **131-API-GALLERY-ROLES-REMOVE.md** - DELETE endpoint for removing roles
- **130-API-GALLERY-ROLES-ADD.md** - POST endpoint for adding roles
- **129-API-GALLERY-ROLES-LIST.md** - GET endpoint for listing roles
- **62-UI-GALLERY-MANAGER.md** - Gallery Manager base page and structure
- **25-REACT-AUTH-CONTEXT.md** - Authentication context

---

## Steps

### Step 1: Create Gallery Roles Component

Create a component for managing gallery roles.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/gallery/GalleryRolesManager.tsx`

```typescript
import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'

interface GalleryRole {
  userId: string
  username: string
  displayName: string | null
  avatarUrl: string | null
  role: 'creator' | 'admin'
  grantedAt: string
  grantedBy: string | null
}

export interface GalleryRolesManagerProps {
  galleryId: string
  isCreator: boolean
}

export default function GalleryRolesManager({
  galleryId,
  isCreator,
}: GalleryRolesManagerProps) {
  const { user } = useAuth()
  const { showToast } = useToast()

  const [roles, setRoles] = useState<GalleryRole[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isAdding, setIsAdding] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const [showRemoveConfirm, setShowRemoveConfirm] = useState<string | null>(null)
  const [isRemoving, setIsRemoving] = useState(false)

  // Fetch gallery roles
  useEffect(() => {
    if (!isCreator) return

    const fetchRoles = async () => {
      setIsLoading(true)
      try {
        const response = await fetch(`/api/galleries/${galleryId}/roles`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        })

        if (!response.ok) {
          throw new Error('Failed to fetch roles')
        }

        const data = await response.json()
        setRoles(data.data || [])
      } catch (error) {
        showToast(
          error instanceof Error ? error.message : 'Failed to load roles',
          'error'
        )
      } finally {
        setIsLoading(false)
      }
    }

    fetchRoles()
  }, [galleryId, isCreator, showToast])

  // Handle add admin
  const handleAddAdmin = async () => {
    if (!searchInput.trim()) {
      showToast('Please enter a username', 'error')
      return
    }

    setIsAdding(true)
    try {
      const response = await fetch(`/api/galleries/${galleryId}/roles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          username: searchInput.trim(),
          role: 'admin',
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error?.message || 'Failed to add admin')
      }

      const data = await response.json()
      setRoles([...roles, data.data])
      setSearchInput('')
      showToast('Admin added successfully', 'success')
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : 'Failed to add admin',
        'error'
      )
    } finally {
      setIsAdding(false)
    }
  }

  // Handle remove admin
  const handleRemoveAdmin = async (userId: string) => {
    setIsRemoving(true)
    try {
      const response = await fetch(
        `/api/galleries/${galleryId}/roles/${userId}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        }
      )

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error?.message || 'Failed to remove admin')
      }

      setRoles(roles.filter((r) => r.userId !== userId))
      setShowRemoveConfirm(null)
      showToast('Admin removed successfully', 'success')
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : 'Failed to remove admin',
        'error'
      )
    } finally {
      setIsRemoving(false)
    }
  }

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date)
  }

  if (!isCreator) {
    return (
      <div className="text-center py-8 text-gray-600">
        <p>Only the gallery creator can manage roles.</p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  const creatorRole = roles.find((r) => r.role === 'creator')
  const adminRoles = roles.filter((r) => r.role === 'admin')

  return (
    <div className="space-y-8">
      {/* Creator Section (Read-Only) */}
      {creatorRole && (
        <div>
          <h3 className="text-lg font-bold text-gray-900 mb-4">Creator</h3>
          <div className="p-4 rounded-lg border border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {creatorRole.avatarUrl && (
                  <img
                    src={creatorRole.avatarUrl}
                    alt={creatorRole.username}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                )}
                <div>
                  <p className="font-semibold text-gray-900">
                    {creatorRole.displayName || creatorRole.username}
                  </p>
                  <p className="text-sm text-gray-600">@{creatorRole.username}</p>
                </div>
              </div>
              <span className="px-2 py-1 rounded text-xs bg-purple-100 text-purple-700 font-medium">
                Creator
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Admins Section */}
      <div>
        <h3 className="text-lg font-bold text-gray-900 mb-4">
          Admins ({adminRoles.length})
        </h3>

        {adminRoles.length === 0 ? (
          <p className="text-gray-600 py-4">
            No admins assigned yet. Add one below.
          </p>
        ) : (
          <div className="space-y-3 mb-6">
            {adminRoles.map((role) => (
              <div
                key={role.userId}
                className="p-4 rounded-lg border border-gray-200 hover:border-gray-300 transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {role.avatarUrl && (
                      <img
                        src={role.avatarUrl}
                        alt={role.username}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    )}
                    <div>
                      <p className="font-semibold text-gray-900">
                        {role.displayName || role.username}
                      </p>
                      <p className="text-sm text-gray-600">@{role.username}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        Added {formatDate(role.grantedAt)}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowRemoveConfirm(role.userId)}
                    className="px-3 py-1 rounded text-sm bg-red-50 text-red-600 hover:bg-red-100 transition-colors font-medium"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Admin Section */}
      <div>
        <h3 className="text-lg font-bold text-gray-900 mb-4">Add Admin</h3>
        <div className="p-4 rounded-lg border border-gray-200 bg-gray-50">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Username
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleAddAdmin()
                }
              }}
              placeholder="Enter username"
              disabled={isAdding}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            />
            <button
              onClick={handleAddAdmin}
              disabled={isAdding || !searchInput.trim()}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {isAdding ? 'Adding...' : 'Add'}
            </button>
          </div>
          <p className="text-xs text-gray-600 mt-2">
            Enter the username of the person you want to make an admin.
          </p>
        </div>
      </div>

      {/* Remove Confirmation Modal */}
      {showRemoveConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-sm w-full p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-2">Remove Admin?</h2>
            <p className="text-gray-600 mb-6">
              This user will lose admin access to this gallery.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowRemoveConfirm(null)}
                disabled={isRemoving}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRemoveAdmin(showRemoveConfirm)}
                disabled={isRemoving}
                className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:bg-gray-400 font-medium"
              >
                {isRemoving ? 'Removing...' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

**Explanation:**
- Displays creator role (read-only, non-removable)
- Shows list of admins with avatar, name, and assignment date
- Provides input to add admins by username
- Confirmation dialog before removing admins
- Uses API endpoints for all operations
- Shows loading state while fetching roles
- Displays success/error toasts for user feedback

---

### Step 2: Update Gallery Manager to Include Roles Tab

Update the Gallery Manager page to show tabs and include the roles section.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/pages/GalleryManager.tsx`

Find the gallery header section and add tabs. Replace the entire component with this updated version:

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
import GalleryRolesManager from '../components/gallery/GalleryRolesManager'
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

type TabType = 'collections' | 'roles'

export default function GalleryManager() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { showToast } = useToast()

  const [gallery, setGallery] = useState<Gallery | null>(null)
  const [collections, setCollections] = useState<Collection[]>([])
  const [activeTab, setActiveTab] = useState<TabType>('collections')
  const [isLoading, setIsLoading] = useState(true)
  const [isReordering, setIsReordering] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newCollectionName, setNewCollectionName] = useState('')

  // Configure drag-and-drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(TouchSensor, { distance: 8 }),
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
      // TODO: Call PATCH /api/galleries/:id/collections/reorder endpoint
      showToast('Collection order updated', 'success')
    } catch (error) {
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

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-8">
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTab('collections')}
            className={`px-4 py-3 font-medium border-b-2 transition-colors ${
              activeTab === 'collections'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Collections ({collections.length})
          </button>
          <button
            onClick={() => setActiveTab('roles')}
            className={`px-4 py-3 font-medium border-b-2 transition-colors ${
              activeTab === 'roles'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Roles
          </button>
        </div>
      </div>

      {/* Collections Tab Content */}
      {activeTab === 'collections' && (
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
      )}

      {/* Roles Tab Content */}
      {activeTab === 'roles' && (
        <GalleryRolesManager
          galleryId={gallery.id}
          isCreator={gallery.userId === user?.id}
        />
      )}

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
- Adds tab navigation with Collections and Roles tabs
- Only shows Roles tab content to gallery creator
- Integrates GalleryRolesManager component
- Maintains all existing collection management functionality
- Tabs switch between collections and roles management

---

## Files to Create/Modify

**New files to create:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/gallery/GalleryRolesManager.tsx`

**Files to modify:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/pages/GalleryManager.tsx` - Add roles tab and integrate component

---

## Verification

### Test 1: TypeScript Compilation

```bash
cd /Volumes/DataSSD/gitsrc/vfa_gallery
npx tsc --noEmit
```

Expected: No type errors

---

### Test 2: View Roles Tab as Creator

1. Create a gallery as User A
2. Navigate to `/profile/galleries/{galleryId}`
3. Click "Roles" tab

Expected: Roles tab visible and loads creator role

---

### Test 3: Roles Tab Hidden for Non-Owner

1. Create gallery with User A
2. Access gallery with User B
3. Check if Roles tab appears

Expected: Roles tab not visible to non-owners, or shows permission denied

---

### Test 4: Add Admin from UI

1. On Roles tab, enter a valid username in "Add Admin" field
2. Click "Add" button

Expected:
- Admin appears in list immediately
- Success toast shows
- API call returns 201

---

### Test 5: Remove Admin from UI

1. Click "Remove" button on an admin
2. Confirm removal in dialog

Expected:
- Admin removed from list
- Success toast shows
- API call returns 200

---

### Test 6: Creator Role Non-Removable

1. Look for creator role in list

Expected:
- Creator role shown as read-only
- No remove button on creator role

---

### Test 7: Add Admin Error Handling

1. Try adding non-existent username

Expected:
- Error toast shows
- Admin not added to list

---

### Test 8: Empty Admin List

1. Create new gallery (no admins assigned)
2. Go to Roles tab

Expected: Shows "No admins assigned yet. Add one below."

---

### Test 9: Input Validation

1. Try clicking "Add" without entering username

Expected: "Add" button disabled or error message

---

### Test 10: Tab Switching

1. Switch between Collections and Roles tabs
2. Data should persist

Expected:
- Tab content switches
- No data loss when switching tabs
- State maintained

---

## Success Criteria

- [ ] TypeScript compiles without errors
- [ ] Roles tab visible only to gallery creator
- [ ] Creator role displayed with read-only indicator
- [ ] List of admins displays with avatar and info
- [ ] Can add admin by username search
- [ ] Can remove admin with confirmation dialog
- [ ] Success/error toasts show for all operations
- [ ] Loading state displays while fetching roles
- [ ] Empty state shows when no admins assigned
- [ ] Creator role cannot be removed
- [ ] Tab switching works smoothly
- [ ] Responsive design on mobile/tablet

---

## Next Steps

Once this build is verified, proceed to **133-API-ADMIN-MIDDLEWARE.md** to create admin role verification middleware.
