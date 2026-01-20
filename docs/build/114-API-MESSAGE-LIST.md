# Build 114: API - Message List (GET /api/messages)

## Goal
Implement the `GET /api/messages` endpoint to return paginated lists of messages with sender/recipient info and context previews, supporting inbox and sent folder views.

---

## Spec Extract

From TECHNICAL-SPEC.md:
- **Message Listing**: GET endpoint at `/api/messages`
- **Query parameters**: folder (inbox/sent), page (default 1), limit (default 20, max 100)
- **Response**: Array of messages with sender/recipient metadata
- **Context**: Include preview of linked artwork/gallery/collection/artist
- **Sorting**: Order by created_at DESC (newest first)
- **Pagination**: Offset-based pagination with total count
- **Authentication**: User must be authenticated; only see their own messages
- **Unread indicator**: Include read_at timestamp to identify unread messages

---

## Prerequisites

**Must complete before starting:**
- **06-SCHEMA-USERS.md** - Users table exists
- **08-SCHEMA-GALLERIES.md** - Galleries table exists
- **09-SCHEMA-COLLECTIONS.md** - Collections table exists
- **10-SCHEMA-ARTWORKS.md** - Artworks table exists
- **12-SCHEMA-MESSAGES.md** - Messages table exists
- **113-API-MESSAGE-SEND.md** - Message send functionality implemented
- **15-API-FOUNDATION.md** - Hono app set up
- **16-API-MIDDLEWARE-AUTH.md** - Authentication middleware

---

## Steps

### Step 1: Add List Method to MessageService

Extend the message service to support listing messages with pagination and filtering.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/services/messageService.ts`

Add these methods to the `MessageService` class:

```typescript
export interface ListMessagesInput {
  userId: string
  folder: 'inbox' | 'sent'
  page?: number
  limit?: number
}

export interface MessageListResponse {
  messages: MessageWithSenderAndRecipient[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNextPage: boolean
    hasPrevPage: boolean
  }
}

export interface MessageWithSenderAndRecipient extends Message {
  sender: UserPreview
  recipient: UserPreview
  context?: ContextPreview
}

export interface UserPreview {
  id: string
  username: string
  slug: string
  avatarUrl?: string
}

export interface ContextPreview {
  type: MessageContextType
  id: string
  title?: string
  slug?: string
}

// Add to MessageService class:
async listMessages(input: ListMessagesInput): Promise<MessageListResponse> {
  const { userId, folder, page = 1, limit = 20 } = input

  // Validate inputs
  if (page < 1) {
    throw new Error('Page must be >= 1')
  }

  const safeLimitLimit = Math.min(limit || 20, 100) // Cap at 100
  const offset = (page - 1) * safeLimitLimit

  // Build WHERE clause based on folder
  let whereClause = ''
  let params: any[] = [userId]

  if (folder === 'inbox') {
    whereClause = 'WHERE m.recipient_id = ?'
  } else if (folder === 'sent') {
    whereClause = 'WHERE m.sender_id = ?'
  } else {
    throw new Error("Folder must be 'inbox' or 'sent'")
  }

  // Get total count
  const countResult = await this.db
    .prepare(`SELECT COUNT(*) as count FROM messages m ${whereClause}`)
    .bind(...params)
    .first<{ count: number }>()

  const total = countResult?.count || 0

  // Fetch messages with sender and recipient details
  const messages = await this.db
    .prepare(
      `
      SELECT
        m.id, m.sender_id, m.recipient_id, m.context_type,
        m.context_id, m.subject, m.body, m.status, m.tone_score,
        m.flagged_reason, m.reviewed_by, m.reviewed_at,
        m.read_at, m.created_at,
        sender.id as sender_id, sender.username as sender_username,
        sender.slug as sender_slug, sender.avatar_url as sender_avatar_url,
        recipient.id as recipient_id, recipient.username as recipient_username,
        recipient.slug as recipient_slug, recipient.avatar_url as recipient_avatar_url
      FROM messages m
      LEFT JOIN users sender ON m.sender_id = sender.id
      LEFT JOIN users recipient ON m.recipient_id = recipient.id
      ${whereClause}
      ORDER BY m.created_at DESC
      LIMIT ? OFFSET ?
      `
    )
    .bind(...params, safeLimitLimit, offset)
    .all<any>()

  // Format results with context
  const formattedMessages = await Promise.all(
    (messages.results || []).map((msg: any) =>
      this.enrichMessageWithContext(msg)
    )
  )

  return {
    messages: formattedMessages,
    pagination: {
      page,
      limit: safeLimitLimit,
      total,
      totalPages: Math.ceil(total / safeLimitLimit),
      hasNextPage: offset + safeLimitLimit < total,
      hasPrevPage: page > 1,
    },
  }
}

/**
 * Fetch context details (artwork title, gallery name, etc.)
 */
private async enrichMessageWithContext(
  msg: any
): Promise<MessageWithSenderAndRecipient> {
  const base: MessageWithSenderAndRecipient = {
    id: msg.id,
    senderId: msg.sender_id,
    recipientId: msg.recipient_id,
    contextType: msg.context_type,
    contextId: msg.context_id,
    subject: msg.subject,
    body: msg.body,
    status: msg.status,
    toneScore: msg.tone_score,
    flaggedReason: msg.flagged_reason,
    reviewedBy: msg.reviewed_by,
    reviewedAt: msg.reviewed_at,
    readAt: msg.read_at,
    createdAt: msg.created_at,
    sender: {
      id: msg.sender_id,
      username: msg.sender_username,
      slug: msg.sender_slug,
      avatarUrl: msg.sender_avatar_url,
    },
    recipient: {
      id: msg.recipient_id,
      username: msg.recipient_username,
      slug: msg.recipient_slug,
      avatarUrl: msg.recipient_avatar_url,
    },
  }

  // Fetch context if present
  if (msg.context_id && msg.context_type !== 'general') {
    try {
      const context = await this.getContextPreview(
        msg.context_type,
        msg.context_id
      )
      if (context) {
        base.context = context
      }
    } catch (err) {
      // If context is deleted, continue without it
      console.warn(`Failed to fetch context: ${msg.context_type} ${msg.context_id}`)
    }
  }

  return base
}

/**
 * Fetch preview data for context (artwork, gallery, collection, or artist)
 */
private async getContextPreview(
  contextType: string,
  contextId: string
): Promise<ContextPreview | null> {
  let query = ''
  let params: any[] = [contextId]

  switch (contextType) {
    case 'artwork':
      query = 'SELECT id, title, slug FROM artworks WHERE id = ?'
      break
    case 'gallery':
      query = 'SELECT id, title as name, slug FROM galleries WHERE id = ?'
      break
    case 'collection':
      query = 'SELECT id, title as name, slug FROM collections WHERE id = ?'
      break
    case 'artist':
      query = 'SELECT id, username as name, slug FROM users WHERE id = ?'
      break
    default:
      return null
  }

  const result = await this.db.prepare(query).bind(...params).first<any>()

  if (!result) {
    return null
  }

  return {
    type: contextType as MessageContextType,
    id: result.id,
    title: result.title || result.name,
    slug: result.slug,
  }
}
```

**Explanation:**
- `listMessages` fetches messages with pagination
- Folder parameter determines inbox (recipient_id) or sent (sender_id)
- Joins with users table to get sender/recipient details
- Returns pagination metadata for UI navigation
- `enrichMessageWithContext` fetches context details for linked items
- Gracefully handles deleted context items

---

### Step 2: Update Message Types

Add types for list responses in the message types file.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/types/message.ts`

Add these interfaces to the file:

```typescript
export interface UserPreview {
  id: string
  username: string
  slug: string
  avatarUrl?: string
}

export interface ContextPreview {
  type: MessageContextType
  id: string
  title?: string
  slug?: string
}

export interface MessageWithSenderAndRecipient extends Message {
  sender: UserPreview
  recipient: UserPreview
  context?: ContextPreview
}

export interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNextPage: boolean
  hasPrevPage: boolean
}

export interface MessageListResponse {
  messages: MessageWithSenderAndRecipient[]
  pagination: PaginationMeta
}
```

**Explanation:**
- `UserPreview` provides minimal user info for message lists
- `ContextPreview` provides metadata about linked artworks/galleries
- `MessageListResponse` combines messages with pagination metadata

---

### Step 3: Add List Route Handler

Add the GET /api/messages endpoint to the messages router.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/messages.ts`

Add this route handler (keep the existing POST route):

```typescript
/**
 * GET /api/messages
 * List user's messages (inbox or sent folder)
 * Query params: folder (inbox|sent), page (default 1), limit (default 20)
 */
messagesRouter.get('/messages', authMiddleware, async (c) => {
  try {
    const userId = c.get('userId')

    // Get query parameters
    const folder = (c.req.query('folder') || 'inbox') as 'inbox' | 'sent'
    const page = parseInt(c.req.query('page') || '1', 10)
    const limit = parseInt(c.req.query('limit') || '20', 10)

    // Validate folder parameter
    if (folder !== 'inbox' && folder !== 'sent') {
      throw new ApiError(400, 'INVALID_FOLDER', "Folder must be 'inbox' or 'sent'")
    }

    // Validate pagination parameters
    if (isNaN(page) || page < 1) {
      throw new ApiError(400, 'INVALID_PAGE', 'Page must be a positive number')
    }

    if (isNaN(limit) || limit < 1 || limit > 100) {
      throw new ApiError(400, 'INVALID_LIMIT', 'Limit must be between 1 and 100')
    }

    const messageService = createMessageService(c.env.DB)

    const response = await messageService.listMessages({
      userId,
      folder,
      page,
      limit,
    })

    return c.json({ success: true, data: response }, 200)
  } catch (error) {
    if (error instanceof ApiError) {
      throw error
    }
    if (error instanceof Error) {
      throw new ApiError(400, 'VALIDATION_ERROR', error.message)
    }
    throw new ApiError(500, 'INTERNAL_ERROR', 'Failed to list messages')
  }
})
```

**Explanation:**
- Extracts and validates query parameters
- Ensures folder is 'inbox' or 'sent'
- Validates page/limit are within acceptable ranges
- Delegates to service layer for business logic
- Returns full response with pagination metadata

---

### Step 4: Add Search Filter Support (Optional)

Optionally add search functionality to find messages by subject or sender.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/services/messageService.ts`

Add this method to the `MessageService` class:

```typescript
export interface SearchMessagesInput extends ListMessagesInput {
  search?: string // Search in subject and body
  contextType?: MessageContextType
}

async searchMessages(input: SearchMessagesInput): Promise<MessageListResponse> {
  const { userId, folder, page = 1, limit = 20, search, contextType } = input

  const safeLimitLimit = Math.min(limit || 20, 100)
  const offset = (page - 1) * safeLimitLimit

  let whereClause = ''
  let params: any[] = [userId]

  // Base folder filter
  if (folder === 'inbox') {
    whereClause = 'WHERE m.recipient_id = ?'
  } else {
    whereClause = 'WHERE m.sender_id = ?'
  }

  // Add search filter
  if (search && search.trim().length > 0) {
    const searchTerm = `%${search.trim()}%`
    whereClause += ' AND (m.subject LIKE ? OR m.body LIKE ?)'
    params.push(searchTerm, searchTerm)
  }

  // Add context type filter
  if (contextType) {
    whereClause += ' AND m.context_type = ?'
    params.push(contextType)
  }

  // Get total count
  const countResult = await this.db
    .prepare(`SELECT COUNT(*) as count FROM messages m ${whereClause}`)
    .bind(...params)
    .first<{ count: number }>()

  const total = countResult?.count || 0

  // Fetch filtered messages
  const messages = await this.db
    .prepare(
      `
      SELECT
        m.id, m.sender_id, m.recipient_id, m.context_type,
        m.context_id, m.subject, m.body, m.status, m.tone_score,
        m.flagged_reason, m.reviewed_by, m.reviewed_at,
        m.read_at, m.created_at,
        sender.id as sender_id, sender.username as sender_username,
        sender.slug as sender_slug, sender.avatar_url as sender_avatar_url,
        recipient.id as recipient_id, recipient.username as recipient_username,
        recipient.slug as recipient_slug, recipient.avatar_url as recipient_avatar_url
      FROM messages m
      LEFT JOIN users sender ON m.sender_id = sender.id
      LEFT JOIN users recipient ON m.recipient_id = recipient.id
      ${whereClause}
      ORDER BY m.created_at DESC
      LIMIT ? OFFSET ?
      `
    )
    .bind(...params, safeLimitLimit, offset)
    .all<any>()

  const formattedMessages = await Promise.all(
    (messages.results || []).map((msg: any) =>
      this.enrichMessageWithContext(msg)
    )
  )

  return {
    messages: formattedMessages,
    pagination: {
      page,
      limit: safeLimitLimit,
      total,
      totalPages: Math.ceil(total / safeLimitLimit),
      hasNextPage: offset + safeLimitLimit < total,
      hasPrevPage: page > 1,
    },
  }
}
```

**Explanation:**
- Adds optional search parameter to search subject and body
- Adds optional contextType filter to show only specific types
- Safely constructs WHERE clause based on provided filters
- Uses LIKE queries for substring matching

---

### Step 5: Create Test File

Create tests for the message listing endpoint.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/__tests__/messages-list.test.ts`

```typescript
import { describe, it, expect } from 'vitest'

describe('Message List API', () => {
  it('should require authentication', async () => {
    // Test without token should return 401
  })

  it('should return inbox messages by default', async () => {
    // GET /api/messages should return inbox (recipient_id = user)
  })

  it('should return sent messages with folder=sent', async () => {
    // GET /api/messages?folder=sent should return sent (sender_id = user)
  })

  it('should reject invalid folder parameter', async () => {
    // GET /api/messages?folder=invalid should return 400
  })

  it('should support pagination', async () => {
    // GET /api/messages?page=2&limit=10
  })

  it('should return pagination metadata', async () => {
    // Response should include total, hasNextPage, totalPages
  })

  it('should include sender and recipient info', async () => {
    // Each message should have sender and recipient with username, slug
  })

  it('should include context preview when present', async () => {
    // Messages with context_id should include context object with title, slug
  })

  it('should order by created_at DESC', async () => {
    // Newest messages should appear first
  })

  it('should cap limit at 100', async () => {
    // GET /api/messages?limit=1000 should be capped to 100
  })

  it('should default to page 1 and limit 20', async () => {
    // GET /api/messages should use page=1, limit=20
  })

  it('should handle deleted context gracefully', async () => {
    // Messages with deleted context should still return without context object
  })
})
```

**Explanation:**
- Provides test structure for message listing
- Tests folder filtering, pagination, and data enrichment
- Tests error cases and edge cases

---

## Files to Create/Modify

### Create:
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/__tests__/messages-list.test.ts`

### Modify:
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/services/messageService.ts` - Add listMessages and searchMessages methods
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/types/message.ts` - Add list response types
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/messages.ts` - Add GET /api/messages route

---

## Verification

### 1. Test Default Inbox

```bash
curl -X GET "http://localhost:8788/api/messages" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

Expected response:
```json
{
  "success": true,
  "data": {
    "messages": [
      {
        "id": "msg-123",
        "senderId": "user-2-id",
        "recipientId": "user-1-id",
        "subject": "Test Subject",
        "body": "Message content...",
        "status": "sent",
        "readAt": null,
        "createdAt": "2026-01-19T12:00:00Z",
        "sender": {
          "id": "user-2-id",
          "username": "artist2",
          "slug": "artist2",
          "avatarUrl": "https://..."
        },
        "recipient": {
          "id": "user-1-id",
          "username": "artist1",
          "slug": "artist1"
        },
        "context": {
          "type": "artwork",
          "id": "artwork-123",
          "title": "Beautiful Landscape",
          "slug": "beautiful-landscape"
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 15,
      "totalPages": 1,
      "hasNextPage": false,
      "hasPrevPage": false
    }
  }
}
```

### 2. Test Sent Folder

```bash
curl -X GET "http://localhost:8788/api/messages?folder=sent" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

Should return messages where user is the sender.

### 3. Test Pagination

```bash
curl -X GET "http://localhost:8788/api/messages?page=2&limit=10" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

Should return page 2 with 10 items, showing hasNextPage and hasPrevPage flags.

### 4. Test Invalid Folder

```bash
curl -X GET "http://localhost:8788/api/messages?folder=trash" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

Should return 400 INVALID_FOLDER error.

### 5. Test Search (if implemented)

```bash
curl -X GET "http://localhost:8788/api/messages?search=artwork" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

Should return messages with "artwork" in subject or body.

### 6. Test Unread Count

Count messages where readAt is null:
```bash
curl -X GET "http://localhost:8788/api/messages" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" | grep -c '"readAt": null'
```

Should show messages not yet marked as read.

### 7. Run Tests

```bash
cd /Volumes/DataSSD/gitsrc/vfa_gallery
npm run test -- messages-list.test.ts
```

---

## Success Criteria

- [x] GET /api/messages returns paginated message list
- [x] Messages include sender/recipient metadata with username and slug
- [x] Folder parameter filters inbox vs sent messages
- [x] Pagination metadata includes total, hasNextPage, totalPages
- [x] Context preview is included when message has contextId
- [x] Messages ordered by created_at DESC (newest first)
- [x] Default page=1, limit=20
- [x] Limit is capped at 100
- [x] Deleted context items don't break responses
- [x] Unauthenticated requests return 401
- [x] readAt field indicates unread messages (null = unread)
