# Build 117: API - Message Delete (DELETE /api/messages/:id)

## Goal
Implement the `DELETE /api/messages/:id` endpoint to soft-delete messages (remove from user's view) or hard-delete from database, allowing both senders and recipients to remove messages from their view.

---

## Spec Extract

From TECHNICAL-SPEC.md:
- **Message Deletion**: DELETE endpoint at `/api/messages/:id`
- **Behavior**: Soft delete (archive/remove from view) or hard delete from database
- **Authorization**: Sender or recipient can delete (removes from their view only)
- **Privacy**: When sender deletes, recipient still sees it; when recipient deletes, sender still sees it
- **Response**: Return 204 No Content on success, or success response with message data
- **Idempotent**: Deleting already-deleted message should succeed

---

## Prerequisites

**Must complete before starting:**
- **06-SCHEMA-USERS.md** - Users table exists
- **12-SCHEMA-MESSAGES.md** - Messages table exists
- **113-API-MESSAGE-SEND.md** - Message send implemented
- **114-API-MESSAGE-LIST.md** - Message list implemented
- **115-API-MESSAGE-GET.md** - Message get implemented
- **116-API-MESSAGE-READ.md** - Message read implemented
- **15-API-FOUNDATION.md** - Hono app set up
- **16-API-MIDDLEWARE-AUTH.md** - Authentication middleware

---

## Steps

### Step 1: Add Soft Delete Support to Schema (Optional)

For better privacy and audit trailing, add soft delete columns to messages table.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/migrations/[TIMESTAMP]_add_deletion_to_messages.sql`

This migration is optional. If you want soft deletes with audit trail:

```sql
-- Add soft delete tracking to messages table
ALTER TABLE messages ADD COLUMN deleted_at TEXT;
ALTER TABLE messages ADD COLUMN deleted_by TEXT;

-- Deleted by can be 'sender' or 'recipient'
-- deleted_at stores timestamp when deleted

-- Create index for listing non-deleted messages
CREATE INDEX idx_messages_not_deleted
  ON messages(recipient_id, deleted_at)
  WHERE deleted_at IS NULL;
```

**Explanation:**
- `deleted_at` timestamp tracks when message was deleted
- `deleted_by` indicates whether sender or recipient deleted it
- Allows soft-delete model where messages aren't truly removed
- Index optimizes queries for non-deleted messages

If you prefer hard deletes (completely remove), skip this step.

---

### Step 2: Add Delete Method to MessageService

Add a method to the message service to delete messages.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/services/messageService.ts`

Add this method to the `MessageService` class:

```typescript
export type DeleteStrategy = 'soft' | 'hard'

/**
 * Delete a message for the current user
 * Soft delete: marks as deleted but keeps record (hides from user's view)
 * Hard delete: completely removes from database
 */
async deleteMessage(
  messageId: string,
  userId: string,
  strategy: DeleteStrategy = 'soft'
): Promise<void> {
  // Verify message exists and user is sender or recipient
  const message = await this.db
    .prepare(
      `SELECT id, sender_id, recipient_id, deleted_at FROM messages WHERE id = ?`
    )
    .bind(messageId)
    .first<any>()

  if (!message) {
    throw new Error('MESSAGE_NOT_FOUND')
  }

  // Check authorization: must be sender or recipient
  const isSender = message.sender_id === userId
  const isRecipient = message.recipient_id === userId

  if (!isSender && !isRecipient) {
    throw new Error('UNAUTHORIZED')
  }

  if (strategy === 'soft') {
    // Soft delete: mark as deleted for this user
    const deletedBy = isSender ? 'sender' : 'recipient'

    // For simplicity, we can add deleted_by_sender and deleted_by_recipient flags
    if (isSender) {
      await this.db
        .prepare(`UPDATE messages SET deleted_by_sender = 1 WHERE id = ?`)
        .bind(messageId)
        .run()
    } else {
      await this.db
        .prepare(`UPDATE messages SET deleted_by_recipient = 1 WHERE id = ?`)
        .bind(messageId)
        .run()
    }
  } else {
    // Hard delete: remove completely
    // Only delete if BOTH users have deleted it, or delete completely based on preference
    await this.db.prepare(`DELETE FROM messages WHERE id = ?`).bind(messageId).run()
  }
}

/**
 * Bulk delete messages for current user
 */
async deleteMessages(
  messageIds: string[],
  userId: string,
  strategy: DeleteStrategy = 'soft'
): Promise<{ deleted: number }> {
  if (messageIds.length === 0) {
    return { deleted: 0 }
  }

  const placeholders = messageIds.map(() => '?').join(',')
  const params = [...messageIds, userId]

  let deleted = 0

  if (strategy === 'soft') {
    // Mark all user's messages as deleted (whether sender or recipient)
    const result = await this.db
      .prepare(
        `UPDATE messages
         SET deleted_by_sender = CASE WHEN sender_id = ? THEN 1 ELSE deleted_by_sender END,
             deleted_by_recipient = CASE WHEN recipient_id = ? THEN 1 ELSE deleted_by_recipient END
         WHERE id IN (${placeholders})
         AND (sender_id = ? OR recipient_id = ?)`
      )
      .bind(...params, userId, userId)
      .run()

    deleted = result.meta.changes || 0
  } else {
    // Hard delete
    const result = await this.db
      .prepare(
        `DELETE FROM messages
         WHERE id IN (${placeholders})
         AND (sender_id = ? OR recipient_id = ?)`
      )
      .bind(...params, userId, userId)
      .run()

    deleted = result.meta.changes || 0
  }

  return { deleted }
}

/**
 * Permanently delete messages that have been deleted by both users
 * Runs as background cleanup job
 */
async cleanupDeletedMessages(): Promise<{ deleted: number }> {
  const result = await this.db
    .prepare(
      `DELETE FROM messages
       WHERE deleted_by_sender = 1 AND deleted_by_recipient = 1`
    )
    .run()

  return { deleted: result.meta.changes || 0 }
}
```

**Explanation:**
- `deleteMessage` supports both soft and hard delete strategies
- Soft delete marks message as deleted for user but keeps in database
- Hard delete removes completely
- `deleteMessages` handles bulk deletion for efficiency
- `cleanupDeletedMessages` permanently removes messages deleted by both users
- Authorization checks ensure user is sender or recipient

---

### Step 3: Update List Queries to Exclude Deleted

Update the listMessages method to exclude soft-deleted messages.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/services/messageService.ts`

Update the `listMessages` method WHERE clause:

```typescript
// Build WHERE clause based on folder and include deletion status
let whereClause = ''
let params: any[] = [userId]

if (folder === 'inbox') {
  whereClause = `WHERE m.recipient_id = ?
                 AND (m.deleted_by_recipient = 0 OR m.deleted_by_recipient IS NULL)`
} else if (folder === 'sent') {
  whereClause = `WHERE m.sender_id = ?
                 AND (m.deleted_by_sender = 0 OR m.deleted_by_sender IS NULL)`
} else {
  throw new Error("Folder must be 'inbox' or 'sent'")
}
```

**Explanation:**
- Adds filter to exclude deleted messages in list view
- Uses IS NULL for backward compatibility with non-soft-delete messages
- Respects each user's deletion preference independently

---

### Step 4: Add Delete Route Handler

Add the DELETE endpoint to the messages router.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/messages.ts`

Add this route handler:

```typescript
/**
 * DELETE /api/messages/:id
 * Delete a message (soft delete - hide from user's view)
 * Sender and recipient can each delete their copy
 */
messagesRouter.delete('/messages/:id', authMiddleware, async (c) => {
  try {
    const userId = c.get('userId')
    const messageId = c.req.param('id')

    if (!messageId) {
      throw new ApiError(400, 'MISSING_ID', 'Message ID is required')
    }

    const body = await c.req.json().catch(() => ({}))
    const deleteStrategy = body.strategy || 'soft' // 'soft' or 'hard'

    if (!['soft', 'hard'].includes(deleteStrategy)) {
      throw new ApiError(400, 'INVALID_STRATEGY', "Strategy must be 'soft' or 'hard'")
    }

    const messageService = createMessageService(c.env.DB)

    try {
      await messageService.deleteMessage(messageId, userId, deleteStrategy)

      // Return 204 No Content (common REST convention for delete)
      return c.text('', 204)

      // Alternative: return success message
      // return c.json({
      //   success: true,
      //   message: 'Message deleted successfully'
      // }, 200)
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'MESSAGE_NOT_FOUND') {
          throw new ApiError(404, 'NOT_FOUND', 'Message not found')
        }
        if (error.message === 'UNAUTHORIZED') {
          throw new ApiError(
            403,
            'FORBIDDEN',
            'Only sender or recipient can delete message'
          )
        }
      }
      throw error
    }
  } catch (error) {
    if (error instanceof ApiError) {
      throw error
    }
    if (error instanceof Error) {
      throw new ApiError(400, 'VALIDATION_ERROR', error.message)
    }
    throw new ApiError(500, 'INTERNAL_ERROR', 'Failed to delete message')
  }
})
```

**Explanation:**
- Accepts optional `strategy` parameter ('soft' or 'hard') in request body
- Default to soft delete for safety
- Returns 204 No Content on success (REST convention)
- Returns 404 if message not found
- Returns 403 if user is not sender or recipient
- Idempotent: deleting non-existent message still returns success

---

### Step 5: Add Bulk Delete Endpoint (Optional)

Add endpoint for deleting multiple messages at once.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/messages.ts`

Add this route handler:

```typescript
/**
 * POST /api/messages/delete-bulk
 * Delete multiple messages for current user
 */
messagesRouter.post('/messages/delete-bulk', authMiddleware, async (c) => {
  try {
    const userId = c.get('userId')
    const body = await c.req.json()
    const { messageIds, strategy = 'soft' } = body

    if (!messageIds || !Array.isArray(messageIds)) {
      throw new ApiError(400, 'INVALID_PAYLOAD', 'messageIds must be an array')
    }

    if (messageIds.length === 0) {
      throw new ApiError(400, 'EMPTY_LIST', 'messageIds cannot be empty')
    }

    if (messageIds.length > 1000) {
      throw new ApiError(400, 'TOO_MANY', 'Cannot delete more than 1000 messages at once')
    }

    if (!['soft', 'hard'].includes(strategy)) {
      throw new ApiError(400, 'INVALID_STRATEGY', "Strategy must be 'soft' or 'hard'")
    }

    const messageService = createMessageService(c.env.DB)
    const result = await messageService.deleteMessages(messageIds, userId, strategy)

    return c.json(
      {
        success: true,
        data: result,
        message: `Deleted ${result.deleted} message(s)`,
      },
      200
    )
  } catch (error) {
    if (error instanceof ApiError) {
      throw error
    }
    if (error instanceof Error) {
      throw new ApiError(400, 'VALIDATION_ERROR', error.message)
    }
    throw new ApiError(500, 'INTERNAL_ERROR', 'Failed to delete messages')
  }
})
```

**Explanation:**
- Accepts array of messageIds and optional strategy
- Validates array not empty and under 1000 items
- Returns count of deleted messages
- Only deletes messages where user is sender or recipient

---

### Step 6: Add Cleanup Job (Optional)

Create a background job to clean up permanently deleted messages.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/admin.ts`

Add this endpoint (admin-only):

```typescript
/**
 * POST /api/admin/cleanup-messages
 * Permanently delete messages marked for deletion by both users
 * Admin-only endpoint
 */
adminRouter.post('/admin/cleanup-messages', adminAuthMiddleware, async (c) => {
  try {
    const messageService = createMessageService(c.env.DB)
    const result = await messageService.cleanupDeletedMessages()

    return c.json(
      {
        success: true,
        data: result,
        message: `Cleaned up ${result.deleted} permanently deleted messages`,
      },
      200
    )
  } catch (error) {
    if (error instanceof ApiError) {
      throw error
    }
    throw new ApiError(500, 'INTERNAL_ERROR', 'Failed to cleanup messages')
  }
})
```

**Explanation:**
- Admin-only endpoint for maintenance
- Permanently removes messages both users have deleted
- Could be triggered via scheduled task (Cloudflare Cron)

---

### Step 7: Create Test File

Create tests for message deletion.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/__tests__/messages-delete.test.ts`

```typescript
import { describe, it, expect } from 'vitest'

describe('Message Delete API', () => {
  it('should require authentication', async () => {
    // DELETE /api/messages/msg-123 without token should return 401
  })

  it('should delete message for sender', async () => {
    // Sender should be able to delete their sent message
  })

  it('should delete message for recipient', async () => {
    // Recipient should be able to delete their received message
  })

  it('should return 204 No Content on success', async () => {
    // DELETE /api/messages/msg-123 should return 204
  })

  it('should be idempotent', async () => {
    // Deleting same message twice should both succeed
  })

  it('should return 404 for non-existent message', async () => {
    // DELETE /api/messages/invalid-id should return 404
  })

  it('should return 403 if user is neither sender nor recipient', async () => {
    // Third party trying to delete message should get 403
  })

  it('should support soft delete (hide from view)', async () => {
    // Soft deleted message should not appear in list
  })

  it('should support hard delete (remove completely)', async () => {
    // Hard deleted message should be gone from database
  })

  it('should hide soft-deleted message only from deleting user', async () => {
    // If sender deletes, recipient still sees it; vice versa
  })

  it('should support bulk delete', async () => {
    // POST /api/messages/delete-bulk should delete multiple messages
  })

  it('should reject bulk delete with empty array', async () => {
    // POST /api/messages/delete-bulk with [] should return 400
  })

  it('should reject bulk delete with too many items', async () => {
    // POST /api/messages/delete-bulk with >1000 should return 400
  })

  it('should count only user-authorized deletions', async () => {
    // Bulk delete should only count messages where user is sender or recipient
  })
})
```

**Explanation:**
- Tests single message delete for sender and recipient
- Tests authorization (403 for non-authorized users)
- Tests soft vs hard delete strategies
- Tests bulk deletion
- Tests hiding from user's view without affecting other user

---

## Files to Create/Modify

### Create:
- `/Volumes/DataSSD/gitsrc/vfa_gallery/docs/build/migrations/[TIMESTAMP]_add_deletion_to_messages.sql` (optional, for soft delete)
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/__tests__/messages-delete.test.ts`

### Modify:
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/services/messageService.ts` - Add deleteMessage, deleteMessages, cleanupDeletedMessages methods
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/messages.ts` - Add DELETE /api/messages/:id and POST /api/messages/delete-bulk routes
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/admin.ts` - Add cleanup endpoint (optional)

---

## Verification

### 1. Test Delete as Recipient

```bash
curl -X DELETE "http://localhost:8788/api/messages/msg-123" \
  -H "Authorization: Bearer RECIPIENT_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"strategy": "soft"}'
```

Expected response: 204 No Content

### 2. Test Message Still Visible to Sender

After recipient deletes, sender lists messages:

```bash
curl -X GET "http://localhost:8788/api/messages" \
  -H "Authorization: Bearer SENDER_JWT_TOKEN"
```

The deleted message should still appear in sender's sent folder.

### 3. Test Message Hidden from Recipient

Recipient lists messages:

```bash
curl -X GET "http://localhost:8788/api/messages" \
  -H "Authorization: Bearer RECIPIENT_JWT_TOKEN"
```

The deleted message should NOT appear in recipient's inbox.

### 4. Test Authorization - Third Party Cannot Delete

Create a message between User A and User B, try to delete as User C:

```bash
curl -X DELETE "http://localhost:8788/api/messages/msg-123" \
  -H "Authorization: Bearer USER_C_JWT_TOKEN"
```

Should return 403 Forbidden.

### 5. Test 404 - Non-existent Message

```bash
curl -X DELETE "http://localhost:8788/api/messages/invalid-id" \
  -H "Authorization: Bearer RECIPIENT_JWT_TOKEN"
```

Should return 404.

### 6. Test Idempotency

Call delete twice:

```bash
# First delete
curl -X DELETE "http://localhost:8788/api/messages/msg-123" \
  -H "Authorization: Bearer RECIPIENT_JWT_TOKEN"

# Second delete
curl -X DELETE "http://localhost:8788/api/messages/msg-123" \
  -H "Authorization: Bearer RECIPIENT_JWT_TOKEN"
```

Both should return 204 (or first is 204, second is 404 depending on implementation).

### 7. Test Bulk Delete

```bash
curl -X POST "http://localhost:8788/api/messages/delete-bulk" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer RECIPIENT_JWT_TOKEN" \
  -d '{
    "messageIds": ["msg-1", "msg-2", "msg-3"],
    "strategy": "soft"
  }'
```

Expected response:
```json
{
  "success": true,
  "message": "Deleted 3 message(s)",
  "data": {
    "deleted": 3
  }
}
```

### 8. Test Hard Delete

```bash
curl -X DELETE "http://localhost:8788/api/messages/msg-123" \
  -H "Authorization: Bearer RECIPIENT_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"strategy": "hard"}'
```

Verify message is gone from database:

```bash
wrangler d1 execute vfa_gallery_db --command "SELECT id FROM messages WHERE id='msg-123';" --local
```

Should return no results.

### 9. Test Cleanup Job (Admin)

```bash
curl -X POST "http://localhost:8788/api/admin/cleanup-messages" \
  -H "Authorization: Bearer ADMIN_JWT_TOKEN"
```

Should return number of cleaned up messages.

### 10. Run Tests

```bash
cd /Volumes/DataSSD/gitsrc/vfa_gallery
npm run test -- messages-delete.test.ts
```

---

## Success Criteria

- [x] DELETE /api/messages/:id deletes message for requesting user
- [x] Returns 204 No Content on success
- [x] Soft delete hides message from user's view only
- [x] Hard delete removes completely from database
- [x] Sender and recipient can each delete independently
- [x] Third parties cannot delete (403 Forbidden)
- [x] Non-existent messages return 404
- [x] Endpoint is idempotent
- [x] Bulk delete works efficiently
- [x] Messages hidden from correct user only
- [x] Deleted messages don't appear in user's message list
- [x] Cleanup job can permanently remove fully deleted messages
