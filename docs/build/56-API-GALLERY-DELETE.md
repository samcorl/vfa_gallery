# 56-API-GALLERY-DELETE.md

## Goal

Create the `DELETE /api/galleries/:id` endpoint that allows authenticated users to delete their galleries (except default gallery) with cascading deletion of collections but preservation of artworks in the user's library.

---

## Spec Extract

From TECHNICAL-SPEC.md - Gallery CRUD Operations:

- **Endpoint:** `DELETE /api/galleries/:id`
- **Authentication:** Required (JWT token)
- **Response (200 OK):**
  ```json
  {
    "success": true
  }
  ```

- **Constraints:**
  - User must own the gallery (userId matches JWT user_id)
  - Cannot delete default gallery (`is_default = true`) - return 400
  - Deletion cascades to collections (via ON DELETE CASCADE)
  - Artworks are NOT deleted - they remain in user's library
  - Collections in gallery are removed, clearing gallery_id foreign key
  - Soft delete optional: could set status='deleted' instead of hard delete

- **Cascade Behavior:**
  - Gallery deleted
  - All collections in that gallery deleted (CASCADE)
  - Artworks' `collection_id` field set to NULL (still exist)
  - Artworks remain visible in user's library

---

## Prerequisites

**Must complete before starting:**
- **15-API-FOUNDATION.md** - Hono router and error handling setup
- **16-API-MIDDLEWARE-AUTH.md** - JWT authentication middleware
- **54-API-GALLERY-GET.md** - Gallery retrieval logic
- **08-SCHEMA-GALLERIES.md** - Galleries table schema
- **09-SCHEMA-COLLECTIONS.md** - Collections table with cascade delete

---

## Steps

### Step 1: Create Gallery Delete Service

Create or update the gallery service module with delete logic.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/services/gallery.ts`

Add this function to the existing gallery service:

```typescript
import type { D1Database } from '@cloudflare/workers-types'
import { Errors } from '../errors'

/**
 * Delete a gallery by ID
 * Verifies ownership and prevents deletion of default gallery
 * Cascades to delete collections, but preserves artworks
 */
export async function deleteGallery(
  db: D1Database,
  galleryId: string,
  userId: string
): Promise<void> {
  // Step 1: Fetch gallery to verify ownership and check if default
  const gallery = await db
    .prepare('SELECT * FROM galleries WHERE id = ?')
    .bind(galleryId)
    .first<any>()

  if (!gallery) {
    throw Errors.NotFound('Gallery not found')
  }

  if (gallery.user_id !== userId) {
    throw Errors.Forbidden('You do not have permission to delete this gallery')
  }

  // Step 2: Prevent deletion of default gallery
  if (gallery.is_default) {
    throw new Error('Cannot delete default gallery. Please select another gallery as default first.')
  }

  // Step 3: Delete the gallery
  // NOTE: On DELETE CASCADE is configured in schema, so:
  // - All collections in this gallery are deleted
  // - Collection foreign key constraints cascade
  // - Artworks' collection_id will be set to NULL (if nullable)
  // - Artworks themselves are NOT deleted
  await db
    .prepare('DELETE FROM galleries WHERE id = ?')
    .bind(galleryId)
    .run()

  // Step 4: Verify deletion (optional, for safety)
  const verify = await db
    .prepare('SELECT id FROM galleries WHERE id = ?')
    .bind(galleryId)
    .first()

  if (verify) {
    throw Errors.InternalServerError('Failed to delete gallery')
  }
}

/**
 * Get count of collections in a gallery
 * Useful for warning user before deletion
 */
export async function getGalleryCollectionCount(
  db: D1Database,
  galleryId: string
): Promise<number> {
  const result = await db
    .prepare('SELECT COUNT(*) as count FROM collections WHERE gallery_id = ?')
    .bind(galleryId)
    .first<{ count: number }>()

  return result?.count || 0
}

/**
 * Get count of artworks in a gallery (across all collections)
 * Useful for warning user that artworks will be ungrouped
 */
export async function getGalleryArtworkCount(
  db: D1Database,
  galleryId: string
): Promise<number> {
  const result = await db
    .prepare(`
      SELECT COUNT(*) as count
      FROM artworks a
      WHERE a.collection_id IN (
        SELECT id FROM collections WHERE gallery_id = ?
      )
    `)
    .bind(galleryId)
    .first<{ count: number }>()

  return result?.count || 0
}
```

---

### Step 2: Create API Route Handler

Add the DELETE handler to the galleries API router.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/api/routes/galleries.ts`

Find the galleries router file and add this handler:

```typescript
import { Hono } from 'hono'
import { getAuth } from '../middleware/auth'
import {
  deleteGallery,
  getGalleryCollectionCount,
  getGalleryArtworkCount
} from '../../lib/api/services/gallery'
import type { D1Database } from '@cloudflare/workers-types'

// Assuming router exists, add to it:

/**
 * DELETE /api/galleries/:id
 * Delete a gallery
 *
 * Returns: 200 OK with { "success": true }
 *
 * Errors:
 * - 400: Cannot delete default gallery
 * - 401: Unauthorized
 * - 403: Forbidden (not the gallery owner)
 * - 404: Gallery not found
 * - 500: Server error
 *
 * Note: Cascade deletes collections but preserves artworks
 */
router.delete('/galleries/:id', async (c) => {
  try {
    const db = c.env.DB as D1Database
    const galleryId = c.req.param('id')

    // Get authenticated user
    const auth = getAuth(c)
    if (!auth) {
      return c.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Delete gallery
    await deleteGallery(db, galleryId, auth.userId)

    return c.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('Gallery delete error:', error)

    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return c.json(
          { error: 'Gallery not found' },
          { status: 404 }
        )
      }
      if (error.message.includes('not have permission')) {
        return c.json(
          { error: 'Forbidden' },
          { status: 403 }
        )
      }
      if (error.message.includes('Cannot delete default gallery')) {
        return c.json(
          { error: error.message },
          { status: 400 }
        )
      }
    }

    return c.json(
      { error: 'Failed to delete gallery' },
      { status: 500 }
    )
  }
})

/**
 * GET /api/galleries/:id/delete-info
 * Get information about what will be deleted
 * Useful for confirmation dialogs
 *
 * Returns:
 * {
 *   "galleryId": "gal_123",
 *   "galleryName": "My Gallery",
 *   "collectionCount": 5,
 *   "artworkCount": 42,
 *   "canDelete": true,
 *   "reason": null
 * }
 */
router.get('/galleries/:id/delete-info', async (c) => {
  try {
    const db = c.env.DB as D1Database
    const galleryId = c.req.param('id')

    // Get authenticated user
    const auth = getAuth(c)
    if (!auth) {
      return c.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Fetch gallery
    const gallery = await db
      .prepare('SELECT * FROM galleries WHERE id = ?')
      .bind(galleryId)
      .first<any>()

    if (!gallery) {
      return c.json(
        { error: 'Gallery not found' },
        { status: 404 }
      )
    }

    if (gallery.user_id !== auth.userId) {
      return c.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    // Get collection and artwork counts
    const collectionCount = await getGalleryCollectionCount(db, galleryId)
    const artworkCount = await getGalleryArtworkCount(db, galleryId)

    // Determine if gallery can be deleted
    const canDelete = !gallery.is_default
    const reason = gallery.is_default
      ? 'Cannot delete default gallery. Please select another gallery as default first.'
      : null

    return c.json({
      galleryId: gallery.id,
      galleryName: gallery.name,
      collectionCount,
      artworkCount,
      canDelete,
      reason
    }, { status: 200 })
  } catch (error) {
    console.error('Gallery delete info error:', error)
    return c.json(
      { error: 'Failed to fetch delete information' },
      { status: 500 }
    )
  }
})

export default router
```

---

### Step 3: Create React Hook for Delete

Create a custom hook to handle gallery deletion in the UI.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/hooks/useDeleteGallery.ts`

```typescript
import { useState } from 'react'

export interface DeleteGalleryInfo {
  galleryId: string
  galleryName: string
  collectionCount: number
  artworkCount: number
  canDelete: boolean
  reason?: string
}

interface UseDeleteGalleryResult {
  deleting: boolean
  loading: boolean
  error: string | null
  deleteInfo: DeleteGalleryInfo | null
  fetchDeleteInfo: (galleryId: string) => Promise<DeleteGalleryInfo | null>
  deleteGallery: (galleryId: string) => Promise<boolean>
}

/**
 * Custom hook for deleting a gallery
 * Handles fetching delete information and performing deletion
 */
export function useDeleteGallery(): UseDeleteGalleryResult {
  const [deleting, setDeleting] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleteInfo, setDeleteInfo] = useState<DeleteGalleryInfo | null>(null)

  const fetchDeleteInfo = async (galleryId: string): Promise<DeleteGalleryInfo | null> => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/galleries/${galleryId}/delete-info`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to fetch delete information')
      }

      const data = await response.json()
      setDeleteInfo(data)
      return data
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch delete information'
      setError(message)
      return null
    } finally {
      setLoading(false)
    }
  }

  const deleteGallery = async (galleryId: string): Promise<boolean> => {
    try {
      setDeleting(true)
      setError(null)

      const response = await fetch(`/api/galleries/${galleryId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete gallery')
      }

      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete gallery'
      setError(message)
      return false
    } finally {
      setDeleting(false)
    }
  }

  return { deleting, loading, error, deleteInfo, fetchDeleteInfo, deleteGallery }
}
```

---

### Step 4: Create Deletion Confirmation Modal

Create a component for confirming gallery deletion.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/components/gallery/DeleteGalleryModal.tsx`

```typescript
import React, { useEffect } from 'react'
import { useToast } from '../../contexts/ToastContext'
import { Modal } from '../common/Modal'
import { useDeleteGallery } from '../../hooks/useDeleteGallery'

interface DeleteGalleryModalProps {
  galleryId: string
  isOpen: boolean
  onSuccess: () => void
  onCancel: () => void
}

/**
 * Delete Gallery Modal Component
 * Shows confirmation with details about what will be deleted
 */
export const DeleteGalleryModal: React.FC<DeleteGalleryModalProps> = ({
  galleryId,
  isOpen,
  onSuccess,
  onCancel
}) => {
  const { showToast } = useToast()
  const { deleting, loading, error, deleteInfo, fetchDeleteInfo, deleteGallery } = useDeleteGallery()

  // Fetch delete info when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchDeleteInfo(galleryId)
    }
  }, [isOpen, galleryId])

  const handleConfirmDelete = async () => {
    const success = await deleteGallery(galleryId)
    if (success) {
      showToast('Gallery deleted successfully', 'success')
      onSuccess()
    } else {
      showToast(error || 'Failed to delete gallery', 'error')
    }
  }

  if (!isOpen) return null

  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title="Delete Gallery"
      size="md"
    >
      <div className="space-y-6">
        {/* Error Alert */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-3">
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-6">
            <div className="animate-spin">
              <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
          </div>
        )}

        {/* Content */}
        {!loading && deleteInfo && (
          <>
            {/* Cannot Delete Warning */}
            {!deleteInfo.canDelete && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded p-4">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  {deleteInfo.reason}
                </p>
              </div>
            )}

            {/* Confirmation Message */}
            {deleteInfo.canDelete && (
              <div>
                <p className="text-gray-700 dark:text-gray-300 font-medium mb-4">
                  Are you sure you want to delete <span className="font-bold">{deleteInfo.galleryName}</span>?
                </p>

                {/* Impact Summary */}
                <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded p-4 space-y-2">
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    This action will:
                  </p>
                  <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1 ml-4 list-disc">
                    <li>Delete this gallery</li>
                    <li>Delete {deleteInfo.collectionCount} collection{deleteInfo.collectionCount !== 1 ? 's' : ''}</li>
                    <li>Move {deleteInfo.artworkCount} artwork{deleteInfo.artworkCount !== 1 ? 's' : ''} to your library (not deleted)</li>
                  </ul>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
                    This action cannot be undone.
                  </p>
                </div>
              </div>
            )}
          </>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={deleting || loading}
            className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded font-medium transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirmDelete}
            disabled={deleting || loading || !deleteInfo?.canDelete}
            className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {deleting ? 'Deleting...' : 'Delete Gallery'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
```

---

## Files to Create/Modify

1. **Update:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/services/gallery.ts`
   - Add `deleteGallery` function
   - Add `getGalleryCollectionCount` function
   - Add `getGalleryArtworkCount` function

2. **Update:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/api/routes/galleries.ts`
   - Add DELETE `/api/galleries/:id` handler
   - Add GET `/api/galleries/:id/delete-info` handler

3. **Create:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/hooks/useDeleteGallery.ts`
   - Add custom React hook for deletion

4. **Create:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/components/gallery/DeleteGalleryModal.tsx`
   - Add modal component for deletion confirmation

---

## Database Schema Verification

Ensure the collections table has proper CASCADE delete:

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/db/migrations/009-schema-collections.sql`

Should include:

```sql
CREATE TABLE collections (
  id TEXT PRIMARY KEY,
  gallery_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  -- ... other columns ...
  FOREIGN KEY (gallery_id) REFERENCES galleries(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE(user_id, slug)
)
```

The `ON DELETE CASCADE` is critical for proper deletion behavior.

---

## Testing Checklist

### API Testing

1. **Delete Non-Default Gallery:**
   ```bash
   curl -X DELETE http://localhost:8787/api/galleries/gal_123 \
     -H "Cookie: auth=token"
   ```
   - Response: 200 OK with `{ "success": true }`
   - Gallery no longer exists in database
   - Collections deleted
   - Artworks still exist with `collection_id` = NULL

2. **Delete Info Endpoint:**
   ```bash
   curl http://localhost:8787/api/galleries/gal_123/delete-info \
     -H "Cookie: auth=token"
   ```
   - Returns collection and artwork counts
   - Shows whether gallery can be deleted

3. **Cannot Delete Default Gallery:**
   - Try to delete gallery with `is_default = true`
   - Expect 400 error with message

4. **Authorization:**
   - Try to delete gallery owned by another user
   - Expect 403 Forbidden

5. **Not Found:**
   - Try to delete non-existent gallery
   - Expect 404 Not Found

6. **Cascade Behavior:**
   - Delete gallery with 5 collections and 20 artworks
   - Verify collections are deleted
   - Verify artworks still exist
   - Verify artworks have `collection_id = NULL`

### UI/Integration Testing

1. **Confirmation Dialog:**
   - User clicks delete on gallery
   - Modal appears with gallery name
   - Shows count of collections and artworks

2. **Cannot Delete Warning:**
   - User tries to delete default gallery
   - Modal shows warning
   - Delete button is disabled

3. **Successful Deletion:**
   - User confirms deletion
   - Toast shows success message
   - Page redirects to gallery list
   - Gallery no longer appears

4. **Artworks Preserved:**
   - Delete gallery with artworks
   - Navigate to user's artwork library
   - All artworks still visible
   - Artworks are ungrouped (no longer in collection)

---

## Verification

1. **Endpoint Works:**
   - Non-default galleries can be deleted
   - Returns 200 OK with success flag
   - User is authenticated

2. **Safety Checks:**
   - Default gallery cannot be deleted
   - User must own the gallery
   - Gallery must exist

3. **Cascade Delete:**
   - Collections in gallery are deleted
   - Artworks are preserved
   - Foreign key constraints maintained

4. **Delete Info Available:**
   - Endpoint shows impact before deletion
   - User knows what will happen

5. **Data Consistency:**
   - No orphaned collections
   - Artworks accessible after gallery deletion
   - User can still manage ungrouped artworks
