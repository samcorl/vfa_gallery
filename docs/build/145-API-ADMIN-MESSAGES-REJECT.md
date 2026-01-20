# 145-API-ADMIN-MESSAGES-REJECT.md

## Goal

Create the `POST /api/admin/messages/:id/reject` endpoint to reject a pending message. Set status to 'rejected', record the admin user as reviewed_by, set reviewed_at timestamp, optionally store rejection reason, and return the updated message.

---

## Spec Extract

From TECHNICAL-SPEC.md - Admin Tools & Moderation:

- **Endpoint:** `POST /api/admin/messages/:id/reject`
- **Authentication:** Required (JWT token)
- **Authorization:** Admin role required
- **Path Parameters:**
  - `id`: Message ID
- **Request Body (Optional):**
  ```json
  {
    "reason": "Contains harassment"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "data": {
      "id": "msg_123",
      "status": "rejected",
      "reviewedBy": "admin_user_456",
      "reviewedAt": "2026-01-19T15:36:00Z",
      "reason": "Contains harassment"
    }
  }
  ```
- **HTTP Status Codes:**
  - `200` - Successfully rejected
  - `400` - Bad request
  - `401` - Unauthorized
  - `403` - Forbidden (not admin)
  - `404` - Message not found or not pending

---

## Prerequisites

**Must complete before starting:**
- **144-API-ADMIN-MESSAGES-APPROVE.md** - Approve endpoint
- **143-API-ADMIN-MESSAGES-PENDING.md** - Pending messages endpoint
- **133-API-ADMIN-MIDDLEWARE.md** - Admin role verification
- **12-SCHEMA-MESSAGES.md** - Messages table with status, reviewed_by, reviewed_at

---

## Steps

### Step 1: Update Schema (if needed)

Ensure messages table has rejection_reason column (optional but recommended).

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/schema/messages.sql`

If not present, add to messages schema migration:

```sql
-- Add rejection reason tracking
ALTER TABLE messages ADD COLUMN rejection_reason TEXT;
```

---

### Step 2: Update Admin Service

Add the reject function to the admin service.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/services/admin.service.ts`

Add this function:

```typescript
/**
 * Reject a pending message with optional reason
 */
export async function rejectPendingMessage(
  db: Database,
  messageId: string,
  adminUserId: string,
  reason?: string
): Promise<{
  id: string
  status: string
  reviewedBy: string
  reviewedAt: string
  reason?: string
}> {
  const now = new Date().toISOString()

  // Update message status with optional reason
  if (reason) {
    await db
      .prepare(
        `UPDATE messages
         SET status = 'rejected', reviewed_by = ?, reviewed_at = ?, rejection_reason = ?
         WHERE id = ?`
      )
      .bind(adminUserId, now, reason, messageId)
      .run()
  } else {
    await db
      .prepare(
        `UPDATE messages
         SET status = 'rejected', reviewed_by = ?, reviewed_at = ?
         WHERE id = ?`
      )
      .bind(adminUserId, now, messageId)
      .run()
  }

  // Return confirmation with updated fields
  const result: any = {
    id: messageId,
    status: 'rejected',
    reviewedBy: adminUserId,
    reviewedAt: now,
  }

  if (reason) {
    result.reason = reason
  }

  return result
}
```

---

### Step 3: Add Reject Route to Admin Router

Add the POST route to handle message rejection.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/admin.ts`

Add this import:

```typescript
import { rejectPendingMessage } from '../services/admin.service'
```

Add this route:

```typescript
/**
 * POST /admin/messages/:id/reject
 * Reject a pending message with optional reason
 */
adminRouter.post('/messages/:id/reject', async (c) => {
  const db = c.env.DB
  const messageId = c.req.param('id')
  const userId = c.get('userId') as string

  try {
    // Validate message ID
    if (!messageId || typeof messageId !== 'string') {
      throw Errors.badRequest('Invalid message ID')
    }

    // Parse request body if present
    let rejectionReason: string | undefined
    try {
      const contentType = c.req.header('content-type') || ''
      if (contentType.includes('application/json')) {
        const body = await c.req.json<{ reason?: string }>()
        rejectionReason = body.reason

        // Validate reason if provided
        if (rejectionReason !== undefined) {
          if (typeof rejectionReason !== 'string') {
            throw Errors.badRequest('Rejection reason must be a string')
          }
          if (rejectionReason.length > 1000) {
            throw Errors.badRequest(
              'Rejection reason must be 1000 characters or less'
            )
          }
        }
      }
    } catch (err: any) {
      if (err.code === 'BAD_REQUEST') {
        throw err
      }
      // Ignore JSON parse errors for requests without body
    }

    // Verify message exists and is in pending_review status
    const message = await db
      .prepare(
        `SELECT id, status, sender_id, recipient_id FROM messages
         WHERE id = ? AND status = 'pending_review'`
      )
      .bind(messageId)
      .first<{
        id: string
        status: string
        sender_id: string | null
        recipient_id: string | null
      }>()

    if (!message) {
      throw Errors.notFound(
        'Message not found or not in pending review status'
      )
    }

    // Reject the message
    const result = await rejectPendingMessage(
      db,
      messageId,
      userId,
      rejectionReason
    )

    // Log the action for audit trail
    console.log(
      `[Admin Action] Message ${messageId} rejected by ${userId}${
        rejectionReason ? ` - Reason: ${rejectionReason}` : ''
      }`
    )

    return c.json({
      data: result,
    })
  } catch (err: any) {
    console.error('[Admin Reject Message Error]', err)
    if (err.code === 'NOT_FOUND' || err.code === 'BAD_REQUEST') {
      throw err
    }
    throw Errors.internal('Failed to reject message', {
      originalError: err.message,
    })
  }
})
```

---

## Files to Create/Modify

**Files to modify:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/services/admin.service.ts` - Add rejectPendingMessage function
2. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/admin.ts` - Add reject route

**Optional schema changes:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/schema/messages.sql` - Add rejection_reason column if not present

---

## Verification

### Test 1: TypeScript Compilation

```bash
cd /Volumes/DataSSD/gitsrc/vfa_gallery
npx tsc --noEmit
```

Expected: No type errors

---

### Test 2: Reject Without Authentication

```bash
curl -X POST http://localhost:8788/api/admin/messages/msg_123/reject
```

Expected response (401):
```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required"
  }
}
```

---

### Test 3: Reject as Non-Admin User

```bash
curl -X POST -H "Authorization: Bearer {User_Token}" \
  http://localhost:8788/api/admin/messages/msg_123/reject
```

Expected response (403):
```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "Admin access required"
  }
}
```

---

### Test 4: Reject Non-Existent Message

```bash
curl -X POST -H "Authorization: Bearer {Admin_Token}" \
  http://localhost:8788/api/admin/messages/invalid_id/reject
```

Expected response (404):
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Message not found or not in pending review status"
  }
}
```

---

### Test 5: Reject Pending Message Without Reason

1. Create a test message with status='pending_review'
2. Call reject endpoint without body:

```bash
curl -X POST -H "Authorization: Bearer {Admin_Token}" \
  http://localhost:8788/api/admin/messages/msg_test1/reject
```

Expected response (200):
```json
{
  "data": {
    "id": "msg_test1",
    "status": "rejected",
    "reviewedBy": "{admin_user_id}",
    "reviewedAt": "2026-01-19T15:36:00Z"
  }
}
```

---

### Test 6: Reject Pending Message With Reason

```bash
curl -X POST -H "Authorization: Bearer {Admin_Token}" \
  -H "Content-Type: application/json" \
  -d '{"reason":"Contains harassment"}' \
  http://localhost:8788/api/admin/messages/msg_test2/reject
```

Expected response (200):
```json
{
  "data": {
    "id": "msg_test2",
    "status": "rejected",
    "reviewedBy": "{admin_user_id}",
    "reviewedAt": "2026-01-19T15:36:15Z",
    "reason": "Contains harassment"
  }
}
```

---

### Test 7: Verify Database Update

```bash
wrangler d1 execute vfa-gallery \
  --command="SELECT id, status, reviewed_by, reviewed_at, rejection_reason FROM messages WHERE id = 'msg_test2';"
```

Expected: status='rejected', reviewed_by set to admin user ID, reviewed_at is not null, rejection_reason set correctly

---

### Test 8: Cannot Reject Already Rejected Message

1. Reject a message (from Test 6)
2. Try to reject the same message again:

```bash
curl -X POST -H "Authorization: Bearer {Admin_Token}" \
  -H "Content-Type: application/json" \
  -d '{"reason":"Duplicate"}' \
  http://localhost:8788/api/admin/messages/msg_test2/reject
```

Expected response (404):
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Message not found or not in pending review status"
  }
}
```

---

### Test 9: Reject Message With Long Reason

```bash
curl -X POST -H "Authorization: Bearer {Admin_Token}" \
  -H "Content-Type: application/json" \
  -d '{"reason":"'"$(python3 -c 'print("x" * 1001)')"'"}' \
  http://localhost:8788/api/admin/messages/msg_test3/reject
```

Expected response (400):
```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "Rejection reason must be 1000 characters or less"
  }
}
```

---

### Test 10: Reject with Non-String Reason

```bash
curl -X POST -H "Authorization: Bearer {Admin_Token}" \
  -H "Content-Type: application/json" \
  -d '{"reason":123}' \
  http://localhost:8788/api/admin/messages/msg_test4/reject
```

Expected response (400):
```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "Rejection reason must be a string"
  }
}
```

---

### Test 11: Cannot Reject Approved Message

1. Create message msg_a with status='pending_review'
2. Approve it (using endpoint 144)
3. Try to reject it:

```bash
curl -X POST -H "Authorization: Bearer {Admin_Token}" \
  -H "Content-Type: application/json" \
  -d '{"reason":"Changed mind"}' \
  http://localhost:8788/api/admin/messages/msg_a/reject
```

Expected response (404): Message not in pending review status

---

### Test 12: Response Format Validation

Reject a message with reason and verify response includes:
- id (matches request ID)
- status (must be 'rejected')
- reviewedBy (must be admin user ID)
- reviewedAt (must be ISO 8601 timestamp)
- reason (must be present if provided)

---

### Test 13: Multiple Admins Rejecting Different Messages

1. Create 2 test messages (msg_x, msg_y)
2. Reject msg_x with admin_user_1 with reason "Spam"
3. Reject msg_y with admin_user_2 with reason "Offensive"
4. Verify each has correct reviewed_by and reason

---

### Test 14: Reject Message With Special Characters

```bash
curl -X POST -H "Authorization: Bearer {Admin_Token}" \
  -H "Content-Type: application/json" \
  -d '{"reason":"Contains: \"quotes\", <tags>, & symbols"}' \
  http://localhost:8788/api/admin/messages/msg_test5/reject
```

Expected response (200): Special characters preserved in reason

---

## Success Criteria

- [ ] TypeScript compiles without errors
- [ ] Requires authentication (401 for missing token)
- [ ] Requires admin role (403 for non-admins)
- [ ] Returns 404 for non-existent message
- [ ] Returns 404 for message not in pending_review status
- [ ] Successfully rejects pending message (200)
- [ ] Sets status to 'rejected'
- [ ] Sets reviewed_by to admin user ID
- [ ] Sets reviewed_at to current timestamp
- [ ] Accepts optional reason parameter
- [ ] Validates reason length (max 1000 chars)
- [ ] Validates reason is string type
- [ ] Stores rejection reason when provided
- [ ] Returns correct JSON response with/without reason
- [ ] Cannot re-reject already rejected message
- [ ] Cannot reject non-pending messages
- [ ] Returns appropriate error messages

---

## Next Steps

Once this build is verified, proceed to **146-UI-ADMIN-MODERATION.md** to create the UI moderation queue page.
