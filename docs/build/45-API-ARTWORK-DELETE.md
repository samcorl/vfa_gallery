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
  "message": "Artwork deleted",
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

### Step 1: Add DELETE Handler to Artworks Router

Add the DELETE endpoint to the existing artworks router with auth protection, atomic batch operations, and proper error handling.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/artworks.ts` (Modify existing file)

Add this handler to the router:

```typescript
import { Hono } from 'hono'
import type { HonoEnv } from '../../../types/env'
import { requireAuth } from '../middleware/auth'
import { getCurrentUser } from '../middleware/auth'
import { Errors } from '../errors'

const router = new Hono<HonoEnv>()

// ... existing GET, POST, PATCH handlers ...

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
 * Auth: Required (must be owner)
 * Response codes:
 * - 200: Artwork successfully deleted
 * - 401: Not authenticated
 * - 403: Not authorized (don't own artwork)
 * - 404: Artwork not found or already deleted
 * - 500: Server error
 */
router.delete('/:id', requireAuth, async (c) => {
  try {
    const db = c.env.DB
    const user = await getCurrentUser(c)
    const artworkId = c.req.param('id')

    if (!artworkId) {
      return c.json(Errors.badRequest('Missing artwork ID'), { status: 400 })
    }

    // Verify artwork exists and is owned by user
    const artwork = await db
      .prepare('SELECT id, status FROM artworks WHERE id = ? AND user_id = ?')
      .bind(artworkId, user.id)
      .first()

    if (!artwork) {
      return c.json(Errors.notFound('Artwork not found'), { status: 404 })
    }

    // If already deleted, return 404
    if (artwork.status === 'deleted') {
      return c.json(Errors.notFound('Artwork not found'), { status: 404 })
    }

    const now = new Date().toISOString()

    // Use batch for atomic operations:
    // 1. Update artwork status to 'deleted'
    // 2. Remove from all collections
    // 3. Decrement user artwork_count
    const statements = [
      // Update artwork status
      {
        statement: 'UPDATE artworks SET status = ?, updated_at = ? WHERE id = ? AND user_id = ?',
        params: ['deleted', now, artworkId, user.id]
      },
      // Remove from all collections
      {
        statement: 'DELETE FROM collection_artworks WHERE artwork_id = ?',
        params: [artworkId]
      },
      // Decrement artwork count (only if was previously 'active')
      {
        statement: 'UPDATE users SET artwork_count = MAX(0, artwork_count - 1) WHERE id = ?',
        params: [user.id]
      }
    ]

    await db.batch(statements)

    return c.json({
      success: true,
      message: 'Artwork deleted',
      id: artworkId
    })
  } catch (error) {
    console.error('Error deleting artwork:', error)
    return c.json(
      Errors.internalError('Failed to delete artwork'),
      { status: 500 }
    )
  }
})

export default router
```

---

## Files to Create/Modify

| Path | Type | Purpose |
|------|------|---------|
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/artworks.ts` | Modify | Add DELETE handler to existing router |

---

## Verification

### Test 1: Soft Delete Artwork
```bash
# Owner deletes their artwork
curl -X DELETE https://your-domain.com/api/artworks/art_abc123 \
  -H "Authorization: Bearer <owner-token>"

# Expected: 200 OK
# {
#   "success": true,
#   "message": "Artwork deleted",
#   "id": "art_abc123"
# }
```

### Test 2: Deleted Artwork Not Accessible
```bash
# Try to get deleted artwork
curl -X GET https://your-domain.com/api/artworks/art_abc123 \
  -H "Authorization: Bearer <owner-token>"

# Expected: 404 Not Found (even to owner!)
# This is by design - soft deleted items are hidden from everyone
```

### Test 3: Non-Owner Cannot Delete
```bash
curl -X DELETE https://your-domain.com/api/artworks/art_abc123 \
  -H "Authorization: Bearer <other-user-token>"

# Expected: 404 Not Found
# (appears as if artwork doesn't exist to non-owners)
```

### Test 4: Unauthenticated Cannot Delete
```bash
curl -X DELETE https://your-domain.com/api/artworks/art_abc123

# Expected: 401 Unauthorized
```

### Test 5: Nonexistent Artwork
```bash
curl -X DELETE https://your-domain.com/api/artworks/art_nonexistent \
  -H "Authorization: Bearer <token>"

# Expected: 404 Not Found
```

### Test 6: Already Deleted Returns 404
```bash
# Delete artwork
curl -X DELETE https://your-domain.com/api/artworks/art_abc123 \
  -H "Authorization: Bearer <owner-token>"

# Expected: 200 OK

# Delete same artwork again
curl -X DELETE https://your-domain.com/api/artworks/art_abc123 \
  -H "Authorization: Bearer <owner-token>"

# Expected: 404 Not Found (now marked as deleted)
```

### Test 7: Collections Removal Verification
```bash
# Create artwork and add to 2 collections
# Then delete artwork
curl -X DELETE https://your-domain.com/api/artworks/art_abc123 \
  -H "Authorization: Bearer <owner-token>"

# Expected: 200 OK

# Verify collection_artworks row removed
# SELECT * FROM collection_artworks WHERE artwork_id = 'art_abc123'
# Result: No rows
```

### Test 8: User Artwork Count Decremented
```bash
# Check user artwork count before deletion
curl -X GET https://your-domain.com/api/users/me \
  -H "Authorization: Bearer <token>"
# Note: artwork_count

# Delete artwork
curl -X DELETE https://your-domain.com/api/artworks/art_abc123 \
  -H "Authorization: Bearer <token>"

# Check count again - should be decremented by 1
curl -X GET https://your-domain.com/api/users/me \
  -H "Authorization: Bearer <token>"
# artwork_count should be 1 less
```

### Test 9: Batch Operation Atomicity
```bash
# All three operations (status update, collection removal, count decrement)
# should complete atomically via c.env.DB.batch()
# If any fails, entire batch fails and no partial updates occur
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
- **Atomic Operations**: Uses `c.env.DB.batch()` to ensure all three operations complete together
- **Collection Cleanup**: All collection associations are removed on deletion
- **User Count**: Artwork count is decremented from user record (only if was 'active')
- **Access Control**: Deleted artworks return 404 to all users, including owners
- **Idempotent**: Second delete attempt returns 404 (artwork already deleted)
- **Audit Trail**: Updated timestamp can be used to track when artwork was deleted
- **Images Preserved**: R2 images are NOT deleted; separate cleanup job can be created
- **Auth Pattern**: Uses `requireAuth` middleware and `getCurrentUser(c)` for user context
- **Error Handling**: Uses `Errors` factory for consistent error responses
- **Database**: Uses `c.env.DB` from Hono context for D1 access
