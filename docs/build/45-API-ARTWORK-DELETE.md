# 45-API-ARTWORK-DELETE.md

## Goal
Implement the DELETE `/api/artworks/:id` endpoint that soft-deletes artworks by setting status to 'deleted', removes them from all associated collections, and prevents future access. Images remain in R2 for potential recovery.

---

## Spec Extract

From TECHNICAL-SPEC.md:
- **Soft Deletes**: Artworks set to status = 'deleted' rather than permanently removed
- **Status Values**: 'active', 'draft', 'deleted'
- **Access Control**: Deleted artworks return 404 to all users
- **Collections**: Artworks removed from all collections on deletion

Design rationale:
- Preserves referential integrity and audit trails
- Allows future recovery/undelete functionality
- R2 images kept for potential recovery (cleanup job can be added later)

Request:
```
DELETE /api/artworks/:id
Authorization: Bearer <user-token>
```

Response:
```json
{
  "success": true,
  "message": "Artwork deleted successfully",
  "id": "art_abc123"
}
```

---

## Prerequisites

**Must complete before starting:**
- **43-API-ARTWORK-GET.md** - Artwork retrieval with authorization
- **44-API-ARTWORK-UPDATE.md** - Artwork update service patterns
- **10-SCHEMA-ARTWORKS.md** - Artworks table schema
- **09-SCHEMA-COLLECTIONS.md** - Collection associations

---

## Steps

### Step 1: Create Artwork Deletion Service

Build service module for deletion operations.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/services/artworkDelete.ts`

```typescript
import type { D1Database } from '@cloudflare/workers-types'

/**
 * Deletion result
 */
export interface DeletionResult {
  success: boolean
  artworkId: string
  removedFromCollections: number
  timestamp: string
}

/**
 * Artwork deletion service
 */
export class ArtworkDeleteService {
  private db: D1Database

  constructor(db: D1Database) {
    this.db = db
  }

  /**
   * Soft delete an artwork
   *
   * Operation:
   * 1. Verify artwork exists and is owned by user
   * 2. Remove artwork from all collections
   * 3. Set status to 'deleted'
   * 4. Update updatedAt timestamp
   *
   * @param artworkId - The artwork ID to delete
   * @param userId - The user ID (must own the artwork)
   * @returns Deletion result with collection count
   * @throws Error if artwork not found or not owned
   */
  async deleteArtwork(artworkId: string, userId: string): Promise<DeletionResult> {
    try {
      // Fetch artwork to verify ownership and get current state
      const artwork = await this.db
        .prepare('SELECT id, status FROM artworks WHERE id = ? AND user_id = ?')
        .bind(artworkId, userId)
        .first()

      if (!artwork) {
        throw new Error('Artwork not found or not owned by user')
      }

      // Already deleted - idempotent operation
      if (artwork.status === 'deleted') {
        return {
          success: true,
          artworkId,
          removedFromCollections: 0,
          timestamp: new Date().toISOString()
        }
      }

      // Remove from all collections (get count first for response)
      const collectionsResult = await this.db
        .prepare('SELECT COUNT(*) as count FROM collection_artworks WHERE artwork_id = ?')
        .bind(artworkId)
        .first()

      const collectionCount = collectionsResult?.count || 0

      // Delete collection associations
      if (collectionCount > 0) {
        await this.db
          .prepare('DELETE FROM collection_artworks WHERE artwork_id = ?')
          .bind(artworkId)
          .run()
      }

      // Update artwork status to deleted
      const now = new Date().toISOString()
      await this.db
        .prepare(
          'UPDATE artworks SET status = ?, updated_at = ? WHERE id = ? AND user_id = ?'
        )
        .bind('deleted', now, artworkId, userId)
        .run()

      // Decrement user artwork count
      await this.db
        .prepare('UPDATE users SET artwork_count = MAX(0, artwork_count - 1) WHERE id = ?')
        .bind(userId)
        .run()

      return {
        success: true,
        artworkId,
        removedFromCollections: collectionCount,
        timestamp: now
      }
    } catch (error) {
      console.error('Error deleting artwork:', error)
      throw error
    }
  }

  /**
   * Bulk soft delete multiple artworks by user
   * Useful for admin operations or account deletion
   *
   * @param artworkIds - Array of artwork IDs to delete
   * @param userId - The user ID (must own all artworks)
   * @returns Count of deleted artworks
   */
  async bulkDeleteArtworks(artworkIds: string[], userId: string): Promise<number> {
    try {
      if (!artworkIds || artworkIds.length === 0) {
        return 0
      }

      // Validate all artworks are owned by user
      const placeholders = artworkIds.map(() => '?').join(',')
      const params = [...artworkIds, userId]

      const existingResult = await this.db
        .prepare(
          `SELECT COUNT(*) as count FROM artworks
           WHERE id IN (${placeholders}) AND user_id = ?`
        )
        .bind(...params)
        .first()

      if (existingResult?.count !== artworkIds.length) {
        throw new Error('Not all artworks are owned by user')
      }

      // Remove from all collections
      await this.db
        .prepare(
          `DELETE FROM collection_artworks
           WHERE artwork_id IN (${placeholders})`
        )
        .bind(...artworkIds)
        .run()

      // Mark all as deleted
      const now = new Date().toISOString()
      await this.db
        .prepare(
          `UPDATE artworks
           SET status = ?, updated_at = ?
           WHERE id IN (${placeholders}) AND user_id = ?`
        )
        .bind('deleted', now, ...artworkIds, userId)
        .run()

      // Decrement user artwork count
      await this.db
        .prepare(
          `UPDATE users
           SET artwork_count = MAX(0, artwork_count - ?)
           WHERE id = ?`
        )
        .bind(artworkIds.length, userId)
        .run()

      return artworkIds.length
    } catch (error) {
      console.error('Error bulk deleting artworks:', error)
      throw error
    }
  }

  /**
   * Permanently delete artwork (hard delete)
   * WARNING: This is irreversible and removes all data
   * Only use for admin operations or explicit user requests
   *
   * @param artworkId - The artwork ID to permanently delete
   * @param userId - The user ID (must own the artwork)
   */
  async permanentlyDeleteArtwork(artworkId: string, userId: string): Promise<void> {
    try {
      // Remove from collections
      await this.db
        .prepare('DELETE FROM collection_artworks WHERE artwork_id = ?')
        .bind(artworkId)
        .run()

      // Delete artwork record
      const result = await this.db
        .prepare('DELETE FROM artworks WHERE id = ? AND user_id = ?')
        .bind(artworkId, userId)
        .run()

      if (!result.success) {
        throw new Error('Artwork not found or not owned by user')
      }

      // Decrement user artwork count
      await this.db
        .prepare('UPDATE users SET artwork_count = MAX(0, artwork_count - 1) WHERE id = ?')
        .bind(userId)
        .run()
    } catch (error) {
      console.error('Error permanently deleting artwork:', error)
      throw error
    }
  }

  /**
   * Check if artwork is deleted
   */
  async isDeleted(artworkId: string): Promise<boolean> {
    const result = await this.db
      .prepare('SELECT status FROM artworks WHERE id = ? AND status = ?')
      .bind(artworkId, 'deleted')
      .first()

    return !!result
  }

  /**
   * Get deletion audit info
   * Returns who deleted and when
   */
  async getDeletionInfo(artworkId: string): Promise<any> {
    try {
      const result = await this.db
        .prepare('SELECT status, updated_at FROM artworks WHERE id = ?')
        .bind(artworkId)
        .first()

      if (!result) {
        return null
      }

      return {
        status: result.status,
        deletedAt: result.updated_at,
        isDeleted: result.status === 'deleted'
      }
    } catch (error) {
      console.error('Error getting deletion info:', error)
      throw error
    }
  }
}
```

### Step 2: Add DELETE Endpoint to Artworks Route

Create the DELETE handler for artwork deletion.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/artworks.ts` (Update existing file)

Add this handler:

```typescript
import { json, type RequestHandler } from '@sveltejs/kit'
import { auth } from '$lib/server/auth'
import { db } from '$lib/server/db'
import { ArtworkDeleteService } from '$lib/api/services/artworkDelete'

/**
 * DELETE /api/artworks/:id
 * Soft delete an artwork (sets status to 'deleted')
 *
 * This is a soft delete:
 * - Artwork marked as deleted, not removed from database
 * - Removed from all collections
 * - Returns 404 to all future requests
 * - Images remain in R2 for potential recovery
 *
 * Response codes:
 * - 200: Artwork successfully deleted
 * - 401: Not authenticated
 * - 403: Not authorized (don't own artwork)
 * - 404: Artwork not found
 * - 500: Server error
 */
export const DELETE: RequestHandler = async ({ url, request }) => {
  try {
    // Authenticate user
    const session = await auth.getSession(request)
    if (!session?.user?.id) {
      return json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id

    // Extract artwork ID from URL
    const pathParts = url.pathname.split('/')
    const artworkId = pathParts[pathParts.length - 1]

    if (!artworkId) {
      return json({ error: 'Missing artwork ID' }, { status: 400 })
    }

    // Initialize deletion service
    const deleteService = new ArtworkDeleteService(db)

    // Perform deletion
    const result = await deleteService.deleteArtwork(artworkId, userId)

    return json(
      {
        success: true,
        message: 'Artwork deleted successfully',
        artworkId: result.artworkId,
        removedFromCollections: result.removedFromCollections,
        deletedAt: result.timestamp
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error in DELETE /api/artworks/:id:', error)

    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return json({ error: 'Artwork not found' }, { status: 404 })
      }
      if (error.message.includes('not owned')) {
        return json(
          { error: 'Not authorized to delete this artwork' },
          { status: 403 }
        )
      }
    }

    return json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

### Step 3: Update SvelteKit Route Handler

Wire up the DELETE handler in SvelteKit routing.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/routes/api/artworks/[id]/+server.ts` (Update)

```typescript
import { GET, PATCH, DELETE } from '$lib/api/routes/artworks'

export { GET, PATCH, DELETE }
```

### Step 4: Create Admin Bulk Delete Endpoint (Optional)

Create endpoint for admins to bulk delete user artworks.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/admin/artworks.ts` (Optional)

```typescript
import { json, type RequestHandler } from '@sveltejs/kit'
import { auth } from '$lib/server/auth'
import { db } from '$lib/server/db'
import { ArtworkDeleteService } from '$lib/api/services/artworkDelete'

/**
 * POST /api/admin/artworks/bulk-delete
 * Admin bulk delete artworks (requires admin role)
 *
 * Request body:
 * {
 *   "artworkIds": ["art_123", "art_456"],
 *   "userId": "usr_xyz"
 * }
 */
export const POST: RequestHandler = async ({ request }) => {
  try {
    // Authenticate and check admin role
    const session = await auth.getSession(request)
    if (!session?.user?.id) {
      return json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check admin role
    const userRole = await db
      .prepare('SELECT role FROM users WHERE id = ?')
      .bind(session.user.id)
      .first()

    if (userRole?.role !== 'admin') {
      return json({ error: 'Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const { artworkIds, userId } = body

    if (!Array.isArray(artworkIds) || artworkIds.length === 0) {
      return json({ error: 'artworkIds must be non-empty array' }, { status: 400 })
    }

    if (!userId) {
      return json({ error: 'userId is required' }, { status: 400 })
    }

    const deleteService = new ArtworkDeleteService(db)
    const deletedCount = await deleteService.bulkDeleteArtworks(artworkIds, userId)

    return json(
      {
        success: true,
        message: 'Artworks deleted successfully',
        deletedCount,
        timestamp: new Date().toISOString()
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error in bulk delete:', error)
    return json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

---

## Files to Create/Modify

| Path | Type | Purpose |
|------|------|---------|
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/services/artworkDelete.ts` | Create | Artwork deletion service |
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/artworks.ts` | Modify | Add DELETE handler |
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/routes/api/artworks/[id]/+server.ts` | Modify | Export DELETE handler |
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/admin/artworks.ts` | Create | Admin bulk delete (optional) |

---

## Verification

### Test 1: Soft Delete Artwork
```bash
# Owner deletes their artwork
curl -X DELETE http://localhost:5173/api/artworks/art_abc123 \
  -H "Authorization: Bearer <owner-token>"

# Expected: 200 OK
# {
#   "success": true,
#   "message": "Artwork deleted successfully",
#   "artworkId": "art_abc123",
#   "removedFromCollections": 2,
#   "deletedAt": "2024-01-15T11:30:00Z"
# }
```

### Test 2: Deleted Artwork Not Accessible
```bash
# Try to get deleted artwork
curl -X GET http://localhost:5173/api/artworks/art_abc123 \
  -H "Authorization: Bearer <owner-token>"

# Expected: 404 Not Found (even to owner!)
# This is by design - soft deleted items are hidden from everyone
```

### Test 3: Non-Owner Cannot Delete
```bash
curl -X DELETE http://localhost:5173/api/artworks/art_abc123 \
  -H "Authorization: Bearer <other-user-token>"

# Expected: 403 Forbidden
# "Not authorized to delete this artwork"
```

### Test 4: Unauthenticated Cannot Delete
```bash
curl -X DELETE http://localhost:5173/api/artworks/art_abc123

# Expected: 401 Unauthorized
```

### Test 5: Nonexistent Artwork
```bash
curl -X DELETE http://localhost:5173/api/artworks/art_nonexistent \
  -H "Authorization: Bearer <token>"

# Expected: 404 Not Found
```

### Test 6: Idempotent Delete
```bash
# Delete artwork
curl -X DELETE http://localhost:5173/api/artworks/art_abc123 \
  -H "Authorization: Bearer <owner-token>"

# Expected: 200 OK

# Delete same artwork again
curl -X DELETE http://localhost:5173/api/artworks/art_abc123 \
  -H "Authorization: Bearer <owner-token>"

# Expected: 200 OK (idempotent - safe to call multiple times)
```

### Test 7: Collections Removal
```bash
# Create artwork and add to 2 collections
# Then delete artwork
curl -X DELETE http://localhost:5173/api/artworks/art_abc123 \
  -H "Authorization: Bearer <owner-token>"

# Expected: 200 OK with removedFromCollections: 2

# Verify collection_artworks row removed
# SELECT * FROM collection_artworks WHERE artwork_id = 'art_abc123'
# Result: No rows
```

### Test 8: User Artwork Count Decremented
```bash
# Check user artwork count before deletion
curl -X GET http://localhost:5173/api/users/me \
  -H "Authorization: Bearer <token>"
# Note: artwork_count

# Delete artwork
curl -X DELETE http://localhost:5173/api/artworks/art_abc123 \
  -H "Authorization: Bearer <token>"

# Check count again - should be decremented by 1
curl -X GET http://localhost:5173/api/users/me \
  -H "Authorization: Bearer <token>"
# artwork_count should be 1 less
```

### Test 9: Admin Bulk Delete (if implemented)
```bash
curl -X POST http://localhost:5173/api/admin/artworks/bulk-delete \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin-token>" \
  -d '{
    "artworkIds": ["art_123", "art_456", "art_789"],
    "userId": "usr_xyz"
  }'

# Expected: 200 OK
# {
#   "success": true,
#   "deletedCount": 3,
#   "message": "Artworks deleted successfully"
# }
```

### Test 10: Status Verification
```bash
# After deletion, check database directly
SELECT status, updated_at FROM artworks WHERE id = 'art_abc123'

# Expected: status = 'deleted', updated_at = current timestamp
```

---

## Notes

- **Soft Deletes**: Artworks are not removed from database, only marked as deleted
- **Idempotent**: Calling DELETE multiple times is safe and returns 200 each time
- **Collection Cleanup**: All collection associations are removed on deletion
- **User Count**: Artwork count is decremented from user record
- **Access Control**: Deleted artworks return 404 to all users, including owners
- **Audit Trail**: Updated timestamp can be used to track when artwork was deleted
- **Images Preserved**: R2 images are NOT deleted; separate cleanup job can be created
- **Hard Delete Available**: Service provides `permanentlyDeleteArtwork()` for admin cleanup if needed
- **Timestamps**: Deletion respects `updated_at` for audit purposes

