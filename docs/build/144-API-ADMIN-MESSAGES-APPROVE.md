# 144-API-ADMIN-MESSAGES-APPROVE.md

## Goal

Create the `POST /api/admin/messages/:id/approve` endpoint to approve a pending message. Set status to 'approved', record the admin user as reviewed_by, set reviewed_at timestamp, and return the updated message.

---

## Spec Extract

From TECHNICAL-SPEC.md - Admin Tools & Moderation:

- **Endpoint:** `POST /api/admin/messages/:id/approve`
- **Authentication:** Required (JWT token)
- **Authorization:** Admin role required
- **Path Parameters:**
  - `id`: Message ID
- **Request Body:** None
- **Response (200 OK):**
  ```json
  {
    "data": {
      "id": "msg_123",
      "status": "approved",
      "reviewedBy": "admin_user_456",
      "reviewedAt": "2026-01-19T15:35:00Z"
    }
  }
  ```
- **HTTP Status Codes:**
  - `200` - Successfully approved
  - `400` - Bad request
  - `401` - Unauthorized
  - `403` - Forbidden (not admin)
  - `404` - Message not found or not pending

---

## Prerequisites

**Must complete before starting:**
- **143-API-ADMIN-MESSAGES-PENDING.md** - Pending messages endpoint
- **133-API-ADMIN-MIDDLEWARE.md** - Admin role verification
- **12-SCHEMA-MESSAGES.md** - Messages table with status, reviewed_by, reviewed_at

---

## Steps

### Step 1: Update Admin Service

Add the approve function to the admin service (if not already done in 143).

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/services/admin.service.ts`

Add this function:

```typescript
/**
 * Approve a pending message and return updated message details
 */
export async function approvePendingMessage(
  db: Database,
  messageId: string,
  adminUserId: string
): Promise<{
  id: string
  status: string
  reviewedBy: string
  reviewedAt: string
}> {
  const now = new Date().toISOString()

  // Update message status
  await db
    .prepare(
      `UPDATE messages
       SET status = 'approved', reviewed_by = ?, reviewed_at = ?
       WHERE id = ?`
    )
    .bind(adminUserId, now, messageId)
    .run()

  // Return confirmation with updated fields
  return {
    id: messageId,
    status: 'approved',
    reviewedBy: adminUserId,
    reviewedAt: now,
  }
}
```

---

### Step 2: Add Approve Route to Admin Router

Add the POST route to handle message approval.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/admin.ts`

Add this import:

```typescript
import { approvePendingMessage } from '../services/admin.service'
```

Add this route:

```typescript
/**
 * POST /admin/messages/:id/approve
 * Approve a pending message for delivery
 */
adminRouter.post('/messages/:id/approve', async (c) => {
  const db = c.env.DB
  const messageId = c.req.param('id')
  const userId = c.get('userId') as string

  try {
    // Validate message ID
    if (!messageId || typeof messageId !== 'string') {
      throw Errors.badRequest('Invalid message ID')
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

    // Approve the message
    const result = await approvePendingMessage(db, messageId, userId)

    // Log the action for audit trail
    console.log(
      `[Admin Action] Message ${messageId} approved by ${userId}`
    )

    return c.json({
      data: result,
    })
  } catch (err: any) {
    console.error('[Admin Approve Message Error]', err)
    if (err.code === 'NOT_FOUND' || err.code === 'BAD_REQUEST') {
      throw err
    }
    throw Errors.internal('Failed to approve message', {
      originalError: err.message,
    })
  }
})
```

---

## Files to Create/Modify

**Files to modify:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/services/admin.service.ts` - Add approvePendingMessage function
2. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/admin.ts` - Add approve route

---

## Verification

### Test 1: TypeScript Compilation

```bash
cd /Volumes/DataSSD/gitsrc/vfa_gallery
npx tsc --noEmit
```

Expected: No type errors

---

### Test 2: Approve Without Authentication

```bash
curl -X POST http://localhost:8788/api/admin/messages/msg_123/approve
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

### Test 3: Approve as Non-Admin User

```bash
curl -X POST -H "Authorization: Bearer {User_Token}" \
  http://localhost:8788/api/admin/messages/msg_123/approve
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

### Test 4: Approve Non-Existent Message

```bash
curl -X POST -H "Authorization: Bearer {Admin_Token}" \
  http://localhost:8788/api/admin/messages/invalid_id/approve
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

### Test 5: Approve Pending Message

1. Create a test message with status='pending_review'
2. Call approve endpoint with admin token:

```bash
curl -X POST -H "Authorization: Bearer {Admin_Token}" \
  http://localhost:8788/api/admin/messages/msg_test1/approve
```

Expected response (200):
```json
{
  "data": {
    "id": "msg_test1",
    "status": "approved",
    "reviewedBy": "{admin_user_id}",
    "reviewedAt": "2026-01-19T15:35:00Z"
  }
}
```

---

### Test 6: Verify Database Update

```bash
wrangler d1 execute vfa-gallery \
  --command="SELECT id, status, reviewed_by, reviewed_at FROM messages WHERE id = 'msg_test1';"
```

Expected: status='approved', reviewed_by set to admin user ID, reviewed_at is not null

---

### Test 7: Cannot Approve Already Approved Message

1. Approve a message (from Test 5)
2. Try to approve the same message again:

```bash
curl -X POST -H "Authorization: Bearer {Admin_Token}" \
  http://localhost:8788/api/admin/messages/msg_test1/approve
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

### Test 8: Cannot Approve Rejected Message

1. Create two test messages: msg_a (approved), msg_b (rejected)
2. Try to approve the rejected one:

```bash
curl -X POST -H "Authorization: Bearer {Admin_Token}" \
  http://localhost:8788/api/admin/messages/msg_b/approve
```

Expected response (404): Not in pending review status

---

### Test 9: Response Format Validation

Approve a message and verify response includes:
- id (matches request ID)
- status (must be 'approved')
- reviewedBy (must be admin user ID)
- reviewedAt (must be ISO 8601 timestamp)

---

### Test 10: Multiple Admins Approving Different Messages

1. Create 2 test messages (msg_x, msg_y)
2. Approve msg_x with admin_user_1
3. Approve msg_y with admin_user_2
4. Verify each has correct reviewed_by

Expected: Each message has correct admin user ID who approved it

---

## Success Criteria

- [ ] TypeScript compiles without errors
- [ ] Requires authentication (401 for missing token)
- [ ] Requires admin role (403 for non-admins)
- [ ] Returns 404 for non-existent message
- [ ] Returns 404 for message not in pending_review status
- [ ] Successfully approves pending message (200)
- [ ] Sets status to 'approved'
- [ ] Sets reviewed_by to admin user ID
- [ ] Sets reviewed_at to current timestamp
- [ ] Returns correct JSON response
- [ ] Cannot re-approve already approved message
- [ ] Cannot approve non-pending messages
- [ ] Returns appropriate error messages

---

## Next Steps

Once this build is verified, proceed to **145-API-ADMIN-MESSAGES-REJECT.md** to create the reject endpoint.
