# Build 116: API - Message Read (PATCH /api/messages/:id/read)

## Goal
Implement the `PATCH /api/messages/:id/read` endpoint to mark a message as read, setting the `read_at` timestamp. Only the recipient can mark a message as read.

---

## Spec Extract

From TECHNICAL-SPEC.md:
- **Message Read Status**: PATCH endpoint at `/api/messages/:id/read`
- **Behavior**: Set `read_at` timestamp to current time
- **Authorization**: Only recipient can mark as read
- **Status**: Update message status if needed (from 'sent' to 'read')
- **Response**: Return updated message
- **Idempotent**: Marking already-read message should succeed without error

---

## Prerequisites

**Must complete before starting:**
- **06-SCHEMA-USERS.md** - Users table exists
- **12-SCHEMA-MESSAGES.md** - Messages table exists with read_at field
- **113-API-MESSAGE-SEND.md** - Message send implemented
- **115-API-MESSAGE-GET.md** - Message get implemented
- **15-API-FOUNDATION.md** - Hono app set up
- **16-API-MIDDLEWARE-AUTH.md** - Authentication middleware

---

## Steps

### Step 1: Add Mark Read Method to MessageService

Add a method to the message service to mark messages as read.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/services/messageService.ts`

Add this method to the `MessageService` class:

```typescript
/**
 * Mark a message as read by setting read_at timestamp
 * Only recipient can mark as read
 */
async markMessageAsRead(messageId: string, userId: string): Promise<Message> {
  // Verify message exists and user is recipient
  const message = await this.db
    .prepare('SELECT id, recipient_id FROM messages WHERE id = ?')
    .bind(messageId)
    .first<any>()

  if (!message) {
    throw new Error('MESSAGE_NOT_FOUND')
  }

  if (message.recipient_id !== userId) {
    throw new Error('UNAUTHORIZED')
  }

  // Only update if not already read (avoid unnecessary DB writes)
  if (!message.read_at) {
    const now = new Date().toISOString()

    await this.db
      .prepare(
        `UPDATE messages
         SET read_at = ?, status = 'read'
         WHERE id = ?`
      )
      .bind(now, messageId)
      .run()
  }

  // Fetch and return updated message
  const updated = await this.db
    .prepare(
      `SELECT id, sender_id, recipient_id, context_type, context_id,
              subject, body, status, tone_score, flagged_reason,
              reviewed_by, reviewed_at, read_at, created_at
       FROM messages
       WHERE id = ?`
    )
    .bind(messageId)
    .first()

  if (!updated) {
    throw new Error('FAILED_TO_UPDATE')
  }

  return this.formatMessage(updated)
}

/**
 * Mark multiple messages as read in a single operation
 * Useful for inbox-wide operations
 */
async markMessagesAsRead(
  messageIds: string[],
  userId: string
): Promise<{ updated: number }> {
  if (messageIds.length === 0) {
    return { updated: 0 }
  }

  // Create placeholders for IN clause
  const placeholders = messageIds.map(() => '?').join(',')
  const params = [...messageIds, userId]

  const now = new Date().toISOString()

  // Update all messages where user is recipient and not already read
  const result = await this.db
    .prepare(
      `UPDATE messages
       SET read_at = ?, status = 'read'
       WHERE id IN (${placeholders})
       AND recipient_id = ?
       AND read_at IS NULL`
    )
    .bind(...params, now)
    .run()

  // Return number of affected rows
  return { updated: result.meta.changes || 0 }
}

/**
 * Get unread message count for a user
 */
async getUnreadCount(userId: string): Promise<number> {
  const result = await this.db
    .prepare(
      `SELECT COUNT(*) as count
       FROM messages
       WHERE recipient_id = ? AND read_at IS NULL`
    )
    .bind(userId)
    .first<{ count: number }>()

  return result?.count || 0
}
```

**Explanation:**
- `markMessageAsRead` sets read_at timestamp if not already read
- Checks that user is the recipient (not sender)
- Idempotent: marking already-read message succeeds silently
- Updates status to 'read' for tracking purposes
- Returns updated message object
- `markMessagesAsRead` marks multiple messages efficiently (for batch operations)
- `getUnreadCount` provides count for UI indicators

---

### Step 2: Add Mark Read Route Handler

Add the PATCH endpoint to mark messages as read.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/messages.ts`

Add this route handler:

```typescript
/**
 * PATCH /api/messages/:id/read
 * Mark a message as read
 * Only recipient can mark as read
 */
messagesRouter.patch('/messages/:id/read', authMiddleware, async (c) => {
  try {
    const userId = c.get('userId')
    const messageId = c.req.param('id')

    if (!messageId) {
      throw new ApiError(400, 'MISSING_ID', 'Message ID is required')
    }

    const messageService = createMessageService(c.env.DB)

    try {
      const message = await messageService.markMessageAsRead(messageId, userId)
      return c.json(
        {
          success: true,
          data: message,
          message: 'Message marked as read',
        },
        200
      )
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'MESSAGE_NOT_FOUND') {
          throw new ApiError(404, 'NOT_FOUND', 'Message not found')
        }
        if (error.message === 'UNAUTHORIZED') {
          throw new ApiError(
            403,
            'FORBIDDEN',
            'Only recipient can mark message as read'
          )
        }
        if (error.message === 'FAILED_TO_UPDATE') {
          throw new ApiError(500, 'UPDATE_FAILED', 'Failed to update message')
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
    throw new ApiError(500, 'INTERNAL_ERROR', 'Failed to mark message as read')
  }
})
```

**Explanation:**
- Extracts messageId from URL parameter
- Calls service to mark message as read
- Returns 404 if message not found
- Returns 403 if user is not the recipient
- Returns updated message object on success
- Idempotent: can be called multiple times safely

---

### Step 3: Add Batch Mark Read Endpoint (Optional)

Add an endpoint to mark multiple messages as read in one operation.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/messages.ts`

Add this route handler:

```typescript
/**
 * PATCH /api/messages/read-bulk
 * Mark multiple messages as read
 * Only recipient can mark as read
 */
messagesRouter.patch('/messages/read-bulk', authMiddleware, async (c) => {
  try {
    const userId = c.get('userId')
    const body = await c.req.json()
    const { messageIds } = body

    if (!messageIds || !Array.isArray(messageIds)) {
      throw new ApiError(
        400,
        'INVALID_PAYLOAD',
        'messageIds must be an array'
      )
    }

    if (messageIds.length === 0) {
      throw new ApiError(400, 'EMPTY_LIST', 'messageIds cannot be empty')
    }

    if (messageIds.length > 1000) {
      throw new ApiError(400, 'TOO_MANY', 'Cannot mark more than 1000 messages at once')
    }

    const messageService = createMessageService(c.env.DB)
    const result = await messageService.markMessagesAsRead(messageIds, userId)

    return c.json(
      {
        success: true,
        data: result,
        message: `Marked ${result.updated} message(s) as read`,
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
    throw new ApiError(500, 'INTERNAL_ERROR', 'Failed to mark messages as read')
  }
})
```

**Explanation:**
- Accepts array of messageIds in request body
- Validates array is not empty and under 1000 items
- Calls service to mark all messages read
- Returns count of updated messages
- Only marks messages where user is recipient

---

### Step 4: Add Unread Count Endpoint (Optional)

Add an endpoint to get the unread message count for the current user.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/messages.ts`

Add this route handler:

```typescript
/**
 * GET /api/messages/unread-count
 * Get count of unread messages for current user
 */
messagesRouter.get('/messages/unread-count', authMiddleware, async (c) => {
  try {
    const userId = c.get('userId')
    const messageService = createMessageService(c.env.DB)

    const unreadCount = await messageService.getUnreadCount(userId)

    return c.json(
      {
        success: true,
        data: { unreadCount },
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
    throw new ApiError(500, 'INTERNAL_ERROR', 'Failed to get unread count')
  }
})
```

**Explanation:**
- Lightweight endpoint for UI badge counts
- Returns just the count of unread messages
- Useful for checking inbox status without fetching full list

---

### Step 5: Create Test File

Create tests for message read functionality.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/__tests__/messages-read.test.ts`

```typescript
import { describe, it, expect } from 'vitest'

describe('Message Read API', () => {
  it('should require authentication', async () => {
    // PATCH /api/messages/msg-123/read without token should return 401
  })

  it('should mark message as read', async () => {
    // PATCH /api/messages/msg-123/read should set read_at timestamp
  })

  it('should update message status to read', async () => {
    // Message status should change from 'sent' to 'read'
  })

  it('should return updated message', async () => {
    // Response should include the updated message with read_at timestamp
  })

  it('should only allow recipient to mark as read', async () => {
    // Sender trying to mark own sent message as read should return 403
  })

  it('should return 404 for non-existent message', async () => {
    // PATCH /api/messages/invalid-id/read should return 404
  })

  it('should be idempotent', async () => {
    // Marking same message as read twice should succeed both times
  })

  it('should not change read_at if already read', async () => {
    // Marking already-read message should keep original read_at timestamp
  })

  it('should support bulk marking', async () => {
    // PATCH /api/messages/read-bulk should mark multiple at once
  })

  it('should reject bulk with empty array', async () => {
    // PATCH /api/messages/read-bulk with [] should return 400
  })

  it('should reject bulk with too many items', async () => {
    // PATCH /api/messages/read-bulk with >1000 items should return 400
  })

  it('should return unread count', async () => {
    // GET /api/messages/unread-count should return count of unread messages
  })

  it('should only count messages recipient receives', async () => {
    // Unread count should only include recipient_id = user, not sender_id
  })

  it('should exclude already-read messages from count', async () => {
    // Messages with read_at set should not be counted as unread
  })
})
```

**Explanation:**
- Tests marking single message as read
- Tests authorization (only recipient can mark as read)
- Tests idempotency
- Tests bulk operations
- Tests unread count accuracy

---

### Step 6: Add Database Index for Read Status (Optional)

Add index to improve query performance for unread messages.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/docs/build/14-SCHEMA-INDEXES.md`

If not already present, add:

```sql
-- Index for finding unread messages efficiently
CREATE INDEX idx_messages_recipient_read
  ON messages(recipient_id, read_at)
  WHERE read_at IS NULL;

-- Index for getting unread count
CREATE INDEX idx_messages_unread_count
  ON messages(recipient_id)
  WHERE read_at IS NULL;
```

**Explanation:**
- Accelerates unread message queries
- WHERE clause only indexes unread messages (read_at IS NULL)
- Composite index on recipient_id and read_at for list queries

---

## Files to Create/Modify

### Create:
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/__tests__/messages-read.test.ts`

### Modify:
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/services/messageService.ts` - Add markMessageAsRead, markMessagesAsRead, getUnreadCount methods
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/messages.ts` - Add PATCH /api/messages/:id/read and optional bulk endpoints

---

## Verification

### 1. Test Mark Single Message as Read

```bash
curl -X PATCH "http://localhost:8788/api/messages/msg-123/read" \
  -H "Authorization: Bearer RECIPIENT_JWT_TOKEN"
```

Expected response:
```json
{
  "success": true,
  "message": "Message marked as read",
  "data": {
    "id": "msg-123",
    "senderId": "user-2-id",
    "recipientId": "user-1-id",
    "body": "Test message",
    "status": "read",
    "readAt": "2026-01-19T12:05:00Z",
    "createdAt": "2026-01-19T12:00:00Z"
  }
}
```

### 2. Verify in Database

```bash
wrangler d1 execute vfa_gallery_db --command "SELECT id, status, read_at FROM messages WHERE id='msg-123';" --local
```

Should show status='read' and read_at with timestamp.

### 3. Test Authorization - Sender Cannot Mark as Read

```bash
curl -X PATCH "http://localhost:8788/api/messages/msg-123/read" \
  -H "Authorization: Bearer SENDER_JWT_TOKEN"
```

Should return 403 Forbidden:
```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "Only recipient can mark message as read"
  }
}
```

### 4. Test Idempotency

Call the same endpoint twice:

```bash
# First call
curl -X PATCH "http://localhost:8788/api/messages/msg-123/read" \
  -H "Authorization: Bearer RECIPIENT_JWT_TOKEN"

# Second call
curl -X PATCH "http://localhost:8788/api/messages/msg-123/read" \
  -H "Authorization: Bearer RECIPIENT_JWT_TOKEN"
```

Both should succeed with 200 OK.

### 5. Test 404 - Non-existent Message

```bash
curl -X PATCH "http://localhost:8788/api/messages/invalid-id/read" \
  -H "Authorization: Bearer RECIPIENT_JWT_TOKEN"
```

Should return 404:
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Message not found"
  }
}
```

### 6. Test Bulk Mark as Read

```bash
curl -X PATCH "http://localhost:8788/api/messages/read-bulk" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer RECIPIENT_JWT_TOKEN" \
  -d '{
    "messageIds": ["msg-1", "msg-2", "msg-3", "msg-4", "msg-5"]
  }'
```

Expected response:
```json
{
  "success": true,
  "message": "Marked 5 message(s) as read",
  "data": {
    "updated": 5
  }
}
```

### 7. Test Unread Count Endpoint

```bash
curl -X GET "http://localhost:8788/api/messages/unread-count" \
  -H "Authorization: Bearer RECIPIENT_JWT_TOKEN"
```

Expected response:
```json
{
  "success": true,
  "data": {
    "unreadCount": 3
  }
}
```

### 8. Verify Unread Count After Marking as Read

Mark a message as read, then check count:

```bash
# Mark as read
curl -X PATCH "http://localhost:8788/api/messages/msg-unread/read" \
  -H "Authorization: Bearer RECIPIENT_JWT_TOKEN"

# Check count - should decrease by 1
curl -X GET "http://localhost:8788/api/messages/unread-count" \
  -H "Authorization: Bearer RECIPIENT_JWT_TOKEN"
```

### 9. Test Bulk with Invalid Input

```bash
# Empty array
curl -X PATCH "http://localhost:8788/api/messages/read-bulk" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer RECIPIENT_JWT_TOKEN" \
  -d '{"messageIds": []}'
```

Should return 400 EMPTY_LIST.

```bash
# Too many items
curl -X PATCH "http://localhost:8788/api/messages/read-bulk" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer RECIPIENT_JWT_TOKEN" \
  -d '{"messageIds": ['msg-1', 'msg-2', ...'msg-1001']}'
```

Should return 400 TOO_MANY.

### 10. Run Tests

```bash
cd /Volumes/DataSSD/gitsrc/vfa_gallery
npm run test -- messages-read.test.ts
```

---

## Success Criteria

- [x] PATCH /api/messages/:id/read marks message as read
- [x] Sets read_at timestamp to current time
- [x] Updates message status to 'read'
- [x] Only recipient can mark as read (403 for sender)
- [x] Non-existent messages return 404
- [x] Endpoint is idempotent (can be called multiple times safely)
- [x] Returns updated message object
- [x] Bulk endpoint marks multiple messages efficiently
- [x] Unread count endpoint accurate
- [x] Database queries optimized with indexes
- [x] Unauthenticated requests return 401
