# 143-API-ADMIN-MESSAGES-PENDING.md

## Goal

Create the `GET /api/admin/messages/pending` endpoint to query messages with status 'pending_review'. Returns paginated moderation queue with sender/recipient info, context references (artwork/gallery), tone scores, and flagged reasons.

---

## Spec Extract

From TECHNICAL-SPEC.md - Admin Tools & Moderation:

- **Endpoint:** `GET /api/admin/messages/pending`
- **Authentication:** Required (JWT token)
- **Authorization:** Admin role required
- **Query Parameters:**
  - `flagged_only`: Filter to only flagged messages (default: false) - optional
  - `sort_by`: Sort order 'tone_score' or 'created_at' (default: 'created_at') - optional
  - `page`: Page number (default: 1)
  - `limit`: Items per page (default: 20, max: 100)
- **Response (200 OK):**
  ```json
  {
    "data": {
      "messages": [
        {
          "id": "msg_123",
          "senderUserId": "user_456",
          "senderUsername": "artist-name",
          "senderEmail": "artist@example.com",
          "recipientUserId": "user_789",
          "recipientUsername": "collector",
          "recipientEmail": "collector@example.com",
          "subject": "About your artwork",
          "body": "I'm interested in purchasing...",
          "status": "pending_review",
          "toneScore": 0.8,
          "flaggedReason": "High tone score indicates possible concern",
          "contextType": "artwork",
          "contextId": "art_101",
          "contextTitle": "Sunset Landscape",
          "reviewedBy": null,
          "reviewedAt": null,
          "createdAt": "2026-01-19T14:30:00Z",
          "actions": {
            "approve": true,
            "reject": true,
            "flag": true
          }
        }
      ],
      "pagination": {
        "page": 1,
        "limit": 20,
        "total": 45,
        "pages": 3
      }
    }
  }
  ```
- **HTTP Status Codes:**
  - `200` - Success
  - `400` - Bad request (invalid filters)
  - `401` - Unauthorized
  - `403` - Forbidden (not admin)

---

## Prerequisites

**Must complete before starting:**
- **133-API-ADMIN-MIDDLEWARE.md** - Admin role verification middleware
- **12-SCHEMA-MESSAGES.md** - Messages table with status, tone_score, flagged_reason
- **06-SCHEMA-USERS.md** - Users table for sender/recipient info lookup
- **10-SCHEMA-ARTWORKS.md** - Artworks table for context lookup (optional)
- **08-SCHEMA-GALLERIES.md** - Galleries table for context lookup (optional)

---

## Steps

### Step 1: Create Pending Messages Query Types

Define types for the pending messages endpoint.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/types/adminMessages.ts`

```typescript
/**
 * Admin pending messages query and response types
 */

export interface UserInfo {
  id: string
  username: string | null
  email: string | null
}

export interface ContextInfo {
  type: string | null
  id: string | null
  title: string | null
}

export interface MessageReviewAction {
  approve: boolean
  reject: boolean
  flag: boolean
}

export interface PendingMessage {
  id: string
  senderUserId: string | null
  senderUsername: string | null
  senderEmail: string | null
  recipientUserId: string | null
  recipientUsername: string | null
  recipientEmail: string | null
  subject: string | null
  body: string
  status: string
  toneScore: number | null
  flaggedReason: string | null
  contextType: string | null
  contextId: string | null
  contextTitle: string | null
  reviewedBy: string | null
  reviewedAt: string | null
  createdAt: string
  actions: MessageReviewAction
}

export interface MessagePaginationMeta {
  page: number
  limit: number
  total: number
  pages: number
}

export interface PendingMessagesResponse {
  messages: PendingMessage[]
  pagination: MessagePaginationMeta
}

export interface PendingMessagesFilters {
  flagged_only?: boolean
  sort_by?: 'tone_score' | 'created_at'
  page?: number
  limit?: number
}
```

---

### Step 2: Add Pending Messages Query Functions to Admin Service

Update the admin service with pending message queries.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/services/admin.service.ts`

Add these imports at the top:

```typescript
import type {
  PendingMessage,
  PendingMessagesResponse,
  PendingMessagesFilters,
  MessagePaginationMeta,
} from '../../../types/adminMessages'
```

Add these functions:

```typescript
/**
 * Query pending review messages for moderation
 */
export async function getPendingMessages(
  db: Database,
  filters: PendingMessagesFilters
): Promise<PendingMessagesResponse> {
  const {
    flagged_only = false,
    sort_by = 'created_at',
    page = 1,
    limit = 20,
  } = filters

  // Validate pagination
  if (page < 1 || limit < 1 || limit > 100) {
    throw Errors.badRequest(
      'Invalid pagination: page must be >= 1, limit must be 1-100'
    )
  }

  // Validate sort_by
  if (!['tone_score', 'created_at'].includes(sort_by)) {
    throw Errors.badRequest(
      "Invalid sort_by: must be 'tone_score' or 'created_at'"
    )
  }

  // Build WHERE clause
  const whereConditions = ["m.status = 'pending_review'"]
  if (flagged_only) {
    whereConditions.push("m.flagged_reason IS NOT NULL")
  }

  const whereClause = `WHERE ${whereConditions.join(' AND ')}`

  // Build ORDER BY clause
  const orderBy =
    sort_by === 'tone_score'
      ? 'm.tone_score DESC NULLS LAST, m.created_at DESC'
      : 'm.created_at DESC'

  // Get total count
  const countSql = `
    SELECT COUNT(*) as total
    FROM messages m
    ${whereClause}
  `

  const countResult = await db
    .prepare(countSql)
    .first<{ total: number }>()

  const total = countResult?.total || 0
  const pages = Math.ceil(total / limit)

  // Calculate offset
  const offset = (page - 1) * limit

  // Get paginated results with user and context info
  const querySql = `
    SELECT
      m.id,
      m.sender_id,
      us.username as sender_username,
      us.email as sender_email,
      m.recipient_id,
      ur.username as recipient_username,
      ur.email as recipient_email,
      m.subject,
      m.body,
      m.status,
      m.tone_score,
      m.flagged_reason,
      m.context_type,
      m.context_id,
      m.reviewed_by,
      m.reviewed_at,
      m.created_at
    FROM messages m
    LEFT JOIN users us ON m.sender_id = us.id
    LEFT JOIN users ur ON m.recipient_id = ur.id
    ${whereClause}
    ORDER BY ${orderBy}
    LIMIT ? OFFSET ?
  `

  const messages = await db
    .prepare(querySql)
    .bind(limit, offset)
    .all<{
      id: string
      sender_id: string | null
      sender_username: string | null
      sender_email: string | null
      recipient_id: string | null
      recipient_username: string | null
      recipient_email: string | null
      subject: string | null
      body: string
      status: string
      tone_score: number | null
      flagged_reason: string | null
      context_type: string | null
      context_id: string | null
      reviewed_by: string | null
      reviewed_at: string | null
      created_at: string
    }>()

  // Fetch context details for messages with context
  const messageEntries: PendingMessage[] = await Promise.all(
    (messages || []).map(async (row) => {
      let contextTitle: string | null = null

      // Look up context if present
      if (row.context_type && row.context_id) {
        try {
          if (row.context_type === 'artwork') {
            const artwork = await db
              .prepare('SELECT title FROM artworks WHERE id = ?')
              .bind(row.context_id)
              .first<{ title: string }>()
            contextTitle = artwork?.title || null
          } else if (row.context_type === 'gallery') {
            const gallery = await db
              .prepare('SELECT title FROM galleries WHERE id = ?')
              .bind(row.context_id)
              .first<{ title: string }>()
            contextTitle = gallery?.title || null
          }
        } catch (err) {
          console.error(
            `Failed to lookup ${row.context_type} ${row.context_id}`,
            err
          )
        }
      }

      return {
        id: row.id,
        senderUserId: row.sender_id,
        senderUsername: row.sender_username,
        senderEmail: row.sender_email,
        recipientUserId: row.recipient_id,
        recipientUsername: row.recipient_username,
        recipientEmail: row.recipient_email,
        subject: row.subject,
        body: row.body,
        status: row.status,
        toneScore: row.tone_score,
        flaggedReason: row.flagged_reason,
        contextType: row.context_type,
        contextId: row.context_id,
        contextTitle,
        reviewedBy: row.reviewed_by,
        reviewedAt: row.reviewed_at,
        createdAt: row.created_at,
        actions: {
          approve: true,
          reject: true,
          flag: true,
        },
      }
    })
  )

  const pagination: MessagePaginationMeta = {
    page,
    limit,
    total,
    pages,
  }

  return {
    messages: messageEntries,
    pagination,
  }
}

/**
 * Approve a pending message (mark as approved)
 */
export async function approvePendingMessage(
  db: Database,
  messageId: string,
  adminUserId: string
): Promise<void> {
  const now = new Date().toISOString()

  await db
    .prepare(
      `UPDATE messages
       SET status = 'approved', reviewed_by = ?, reviewed_at = ?
       WHERE id = ?`
    )
    .bind(adminUserId, now, messageId)
    .run()
}

/**
 * Reject a pending message (mark as rejected)
 */
export async function rejectPendingMessage(
  db: Database,
  messageId: string,
  adminUserId: string
): Promise<void> {
  const now = new Date().toISOString()

  await db
    .prepare(
      `UPDATE messages
       SET status = 'rejected', reviewed_by = ?, reviewed_at = ?
       WHERE id = ?`
    )
    .bind(adminUserId, now, messageId)
    .run()
}

/**
 * Flag a message for further review
 */
export async function flagMessage(
  db: Database,
  messageId: string,
  reason: string
): Promise<void> {
  await db
    .prepare(
      `UPDATE messages
       SET flagged_reason = ?
       WHERE id = ?`
    )
    .bind(reason, messageId)
    .run()
}
```

---

### Step 3: Add Pending Messages Routes to Admin Router

Add the GET and POST routes for pending messages.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/admin.ts`

Add imports:

```typescript
import {
  getPendingMessages,
  approvePendingMessage,
  rejectPendingMessage,
  flagMessage,
} from '../services/admin.service'
import type {
  PendingMessagesFilters,
  PendingMessagesResponse,
} from '../../../types/adminMessages'
```

Add these routes:

```typescript
/**
 * GET /admin/messages/pending
 * Query pending review messages for moderation
 */
adminRouter.get('/messages/pending', async (c) => {
  const db = c.env.DB

  try {
    // Extract query parameters
    const flagged_only = c.req.query('flagged_only') === 'true'
    const sort_by = (c.req.query('sort_by') || 'created_at') as
      | 'tone_score'
      | 'created_at'
    const page = parseInt(c.req.query('page') || '1')
    const limit = parseInt(c.req.query('limit') || '20')

    const filters: PendingMessagesFilters = {
      flagged_only,
      sort_by,
      page,
      limit,
    }

    const response = await getPendingMessages(db, filters)

    return c.json({ data: response })
  } catch (err: any) {
    console.error('[Admin Pending Messages Error]', err)
    if (err.code === 'BAD_REQUEST') {
      throw err
    }
    throw Errors.internal('Failed to fetch pending messages', {
      originalError: err.message,
    })
  }
})

/**
 * POST /admin/messages/:id/approve
 * Approve a pending message
 */
adminRouter.post('/messages/:id/approve', async (c) => {
  const db = c.env.DB
  const messageId = c.req.param('id')
  const userId = c.get('userId') as string

  try {
    // Verify message exists and is pending
    const message = await db
      .prepare("SELECT id, status FROM messages WHERE id = ? AND status = 'pending_review'")
      .bind(messageId)
      .first<{ id: string; status: string }>()

    if (!message) {
      throw Errors.notFound('Message not found or not pending review')
    }

    await approvePendingMessage(db, messageId, userId)

    return c.json({
      data: {
        id: messageId,
        status: 'approved',
        reviewedBy: userId,
        reviewedAt: new Date().toISOString(),
      },
    })
  } catch (err: any) {
    console.error('[Approve Message Error]', err)
    if (err.code === 'NOT_FOUND' || err.code === 'BAD_REQUEST') {
      throw err
    }
    throw Errors.internal('Failed to approve message', {
      originalError: err.message,
    })
  }
})

/**
 * POST /admin/messages/:id/reject
 * Reject a pending message
 */
adminRouter.post('/messages/:id/reject', async (c) => {
  const db = c.env.DB
  const messageId = c.req.param('id')
  const userId = c.get('userId') as string

  try {
    // Verify message exists and is pending
    const message = await db
      .prepare("SELECT id, status FROM messages WHERE id = ? AND status = 'pending_review'")
      .bind(messageId)
      .first<{ id: string; status: string }>()

    if (!message) {
      throw Errors.notFound('Message not found or not pending review')
    }

    await rejectPendingMessage(db, messageId, userId)

    return c.json({
      data: {
        id: messageId,
        status: 'rejected',
        reviewedBy: userId,
        reviewedAt: new Date().toISOString(),
      },
    })
  } catch (err: any) {
    console.error('[Reject Message Error]', err)
    if (err.code === 'NOT_FOUND' || err.code === 'BAD_REQUEST') {
      throw err
    }
    throw Errors.internal('Failed to reject message', {
      originalError: err.message,
    })
  }
})

/**
 * POST /admin/messages/:id/flag
 * Flag a message for further review
 */
adminRouter.post('/messages/:id/flag', async (c) => {
  const db = c.env.DB
  const messageId = c.req.param('id')

  try {
    const body = await c.req.json<{ reason: string }>()

    if (!body.reason || typeof body.reason !== 'string') {
      throw Errors.badRequest('Flag reason is required and must be a string')
    }

    // Verify message exists
    const message = await db
      .prepare('SELECT id FROM messages WHERE id = ?')
      .bind(messageId)
      .first<{ id: string }>()

    if (!message) {
      throw Errors.notFound('Message not found')
    }

    await flagMessage(db, messageId, body.reason)

    return c.json({
      data: {
        id: messageId,
        flagged: true,
        reason: body.reason,
      },
    })
  } catch (err: any) {
    console.error('[Flag Message Error]', err)
    if (err.code === 'NOT_FOUND' || err.code === 'BAD_REQUEST') {
      throw err
    }
    throw Errors.internal('Failed to flag message', {
      originalError: err.message,
    })
  }
})
```

---

## Files to Create/Modify

**New files to create:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/types/adminMessages.ts`

**Files to modify:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/services/admin.service.ts` - Add pending message query functions
2. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/admin.ts` - Add message routes

---

## Verification

### Test 1: TypeScript Compilation

```bash
cd /Volumes/DataSSD/gitsrc/vfa_gallery
npx tsc --noEmit
```

Expected: No type errors

---

### Test 2: Access Without Authentication

```bash
curl http://localhost:8788/api/admin/messages/pending
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

### Test 3: Access as Regular User

```bash
curl -H "Authorization: Bearer {User_Token}" \
  http://localhost:8788/api/admin/messages/pending
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

### Test 4: Access as Admin - No Pending Messages

```bash
curl -H "Authorization: Bearer {Admin_Token}" \
  http://localhost:8788/api/admin/messages/pending
```

Expected response (200) with empty messages:
```json
{
  "data": {
    "messages": [],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 0,
      "pages": 0
    }
  }
}
```

---

### Test 5: Create Test Messages

1. Create multiple messages with status 'pending_review'
2. Some with tone_score values
3. Some with flagged_reason values

```bash
# Example (via direct DB or test helper)
wrangler d1 execute vfa-gallery --command="
  INSERT INTO messages (id, sender_id, recipient_id, body, status, tone_score)
  VALUES ('msg_test1', 'user_1', 'user_2', 'Test message 1', 'pending_review', 0.8)
"
```

---

### Test 6: Query Pending Messages

```bash
curl -H "Authorization: Bearer {Admin_Token}" \
  http://localhost:8788/api/admin/messages/pending | jq '.data'
```

Expected: Returns messages with all fields populated

---

### Test 7: Filter by Flagged Only

```bash
curl -H "Authorization: Bearer {Admin_Token}" \
  "http://localhost:8788/api/admin/messages/pending?flagged_only=true"
```

Expected: Returns only messages with flagged_reason NOT NULL

---

### Test 8: Sort by Tone Score

```bash
curl -H "Authorization: Bearer {Admin_Token}" \
  "http://localhost:8788/api/admin/messages/pending?sort_by=tone_score"
```

Expected: Messages sorted by tone_score descending (highest first)

---

### Test 9: Sort by Created At (Default)

```bash
curl -H "Authorization: Bearer {Admin_Token}" \
  "http://localhost:8788/api/admin/messages/pending?sort_by=created_at"
```

Expected: Messages sorted by created_at descending (newest first)

---

### Test 10: Pagination

```bash
curl -H "Authorization: Bearer {Admin_Token}" \
  "http://localhost:8788/api/admin/messages/pending?page=1&limit=5"
```

Expected response includes:
```json
{
  "pagination": {
    "page": 1,
    "limit": 5,
    "total": X,
    "pages": Y
  }
}
```

---

### Test 11: Invalid Sort By

```bash
curl -H "Authorization: Bearer {Admin_Token}" \
  "http://localhost:8788/api/admin/messages/pending?sort_by=invalid"
```

Expected response (400):
```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "Invalid sort_by: must be 'tone_score' or 'created_at'"
  }
}
```

---

### Test 12: Invalid Pagination

```bash
curl -H "Authorization: Bearer {Admin_Token}" \
  "http://localhost:8788/api/admin/messages/pending?page=0&limit=200"
```

Expected response (400):
```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "Invalid pagination: page must be >= 1, limit must be 1-100"
  }
}
```

---

### Test 13: Context Information

1. Create a message with context_type='artwork' and context_id pointing to real artwork
2. Query pending messages

Expected: Message includes contextTitle from artwork lookup

---

### Test 14: Approve Message

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

Then verify in database: status changed to 'approved', reviewed_by set

---

### Test 15: Reject Message

```bash
curl -X POST -H "Authorization: Bearer {Admin_Token}" \
  http://localhost:8788/api/admin/messages/msg_test2/reject
```

Expected response (200) with status='rejected'

---

### Test 16: Approve Non-Existent Message

```bash
curl -X POST -H "Authorization: Bearer {Admin_Token}" \
  http://localhost:8788/api/admin/messages/invalid_id/approve
```

Expected response (404):
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Message not found or not pending review"
  }
}
```

---

### Test 17: Flag Message

```bash
curl -X POST -H "Authorization: Bearer {Admin_Token}" \
  -H "Content-Type: application/json" \
  -d '{"reason":"Contains spam"}' \
  http://localhost:8788/api/admin/messages/msg_test3/flag
```

Expected response (200):
```json
{
  "data": {
    "id": "msg_test3",
    "flagged": true,
    "reason": "Contains spam"
  }
}
```

---

### Test 18: Flag Message Without Reason

```bash
curl -X POST -H "Authorization: Bearer {Admin_Token}" \
  -H "Content-Type: application/json" \
  -d '{}' \
  http://localhost:8788/api/admin/messages/msg_test4/flag
```

Expected response (400):
```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "Flag reason is required and must be a string"
  }
}
```

---

### Test 19: Approved Message Cannot Be Approved Again

1. Approve a message
2. Try to approve the same message again

Expected response (404): Message not found or not pending review

---

### Test 20: Response Format

```bash
curl -H "Authorization: Bearer {Admin_Token}" \
  http://localhost:8788/api/admin/messages/pending | jq '.data.messages[0]'
```

Expected to include all fields:
- id, senderUserId, senderUsername, senderEmail
- recipientUserId, recipientUsername, recipientEmail
- subject, body, status, toneScore, flaggedReason
- contextType, contextId, contextTitle
- reviewedBy, reviewedAt, createdAt
- actions (with approve, reject, flag)

---

## Success Criteria

- [ ] TypeScript compiles without errors
- [ ] GET /api/admin/messages/pending requires authentication (401)
- [ ] Requires admin role (403 for non-admins)
- [ ] Returns empty messages for fresh database
- [ ] Filters by flagged_only correctly
- [ ] Sorts by tone_score correctly
- [ ] Sorts by created_at correctly
- [ ] Pagination works (page, limit, total, pages)
- [ ] Validates pagination limits (1-100)
- [ ] Validates sort_by options
- [ ] Includes sender/recipient information
- [ ] Includes context information with lookup
- [ ] POST approve updates status and reviewed fields
- [ ] POST reject updates status and reviewed fields
- [ ] POST flag sets flagged_reason
- [ ] All review actions require admin auth
- [ ] Returns appropriate error messages
- [ ] All fields properly typed and formatted

---

## Next Steps

Once this build is verified, you can create corresponding UI components (**144-UI-ADMIN-MESSAGES-PENDING.md**) for the moderation queue interface that consumes these endpoints.
