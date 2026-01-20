# Build 115: API - Message Get (GET /api/messages/:id)

## Goal
Implement the `GET /api/messages/:id` endpoint to retrieve a single message with full context information, ensuring users can only view messages they sent or received.

---

## Spec Extract

From TECHNICAL-SPEC.md:
- **Message Retrieval**: GET endpoint at `/api/messages/:id`
- **Authorization**: User must be sender or recipient to view message
- **Response**: Full message with complete context details (artwork, gallery, collection, artist info)
- **Context**: Include full linked object (title, slug, description, thumbnail if applicable)
- **Authentication**: User must be authenticated
- **Error**: Return 404 if message doesn't exist or user lacks permission

---

## Prerequisites

**Must complete before starting:**
- **06-SCHEMA-USERS.md** - Users table exists
- **08-SCHEMA-GALLERIES.md** - Galleries table exists
- **09-SCHEMA-COLLECTIONS.md** - Collections table exists
- **10-SCHEMA-ARTWORKS.md** - Artworks table exists
- **12-SCHEMA-MESSAGES.md** - Messages table exists
- **113-API-MESSAGE-SEND.md** - Message send implemented
- **114-API-MESSAGE-LIST.md** - Message list implemented
- **15-API-FOUNDATION.md** - Hono app set up
- **16-API-MIDDLEWARE-AUTH.md** - Authentication middleware

---

## Steps

### Step 1: Add Get Method to MessageService

Extend the message service with a method to retrieve a single message with full context.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/services/messageService.ts`

Add these interfaces and methods to the `MessageService` class:

```typescript
export interface MessageWithFullContext extends Message {
  sender: UserFullInfo
  recipient: UserFullInfo
  context?: ContextFullInfo
}

export interface UserFullInfo {
  id: string
  username: string
  slug: string
  avatarUrl?: string
  email?: string // Only for admins viewing messages
}

export interface ContextFullInfo {
  type: MessageContextType
  id: string
  title?: string
  slug?: string
  description?: string
  url?: string
  thumbnailUrl?: string
  artist?: UserPreview // For artworks, gallery, and collections
}

/**
 * Get a single message by ID with full context
 * Only sender or recipient can view
 */
async getMessage(messageId: string, userId: string): Promise<MessageWithFullContext> {
  // Fetch message with sender and recipient
  const message = await this.db
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
      WHERE m.id = ?
      `
    )
    .bind(messageId)
    .first<any>()

  if (!message) {
    throw new Error('MESSAGE_NOT_FOUND')
  }

  // Check authorization: user must be sender or recipient
  if (message.sender_id !== userId && message.recipient_id !== userId) {
    throw new Error('UNAUTHORIZED')
  }

  // Build response
  const result: MessageWithFullContext = {
    id: message.id,
    senderId: message.sender_id,
    recipientId: message.recipient_id,
    contextType: message.context_type,
    contextId: message.context_id,
    subject: message.subject,
    body: message.body,
    status: message.status,
    toneScore: message.tone_score,
    flaggedReason: message.flagged_reason,
    reviewedBy: message.reviewed_by,
    reviewedAt: message.reviewed_at,
    readAt: message.read_at,
    createdAt: message.created_at,
    sender: {
      id: message.sender_id,
      username: message.sender_username,
      slug: message.sender_slug,
      avatarUrl: message.sender_avatar_url,
    },
    recipient: {
      id: message.recipient_id,
      username: message.recipient_username,
      slug: message.recipient_slug,
      avatarUrl: message.recipient_avatar_url,
    },
  }

  // Fetch full context if present
  if (message.context_id && message.context_type !== 'general') {
    const context = await this.getFullContext(
      message.context_type,
      message.context_id
    )
    if (context) {
      result.context = context
    }
  }

  return result
}

/**
 * Fetch complete context information for linked entity
 */
private async getFullContext(
  contextType: string,
  contextId: string
): Promise<ContextFullInfo | null> {
  switch (contextType) {
    case 'artwork':
      return this.getArtworkContext(contextId)
    case 'gallery':
      return this.getGalleryContext(contextId)
    case 'collection':
      return this.getCollectionContext(contextId)
    case 'artist':
      return this.getArtistContext(contextId)
    default:
      return null
  }
}

/**
 * Fetch full artwork context
 */
private async getArtworkContext(artworkId: string): Promise<ContextFullInfo | null> {
  const artwork = await this.db
    .prepare(
      `
      SELECT
        a.id, a.title, a.slug, a.description,
        a.display_image_url as display_image_url,
        a.thumbnail_url as thumbnail_url,
        u.id as artist_id, u.username as artist_username,
        u.slug as artist_slug, u.avatar_url as artist_avatar_url
      FROM artworks a
      LEFT JOIN users u ON a.artist_id = u.id
      WHERE a.id = ?
      `
    )
    .bind(artworkId)
    .first<any>()

  if (!artwork) {
    return null
  }

  return {
    type: 'artwork',
    id: artwork.id,
    title: artwork.title,
    slug: artwork.slug,
    description: artwork.description,
    url: `/artwork/${artwork.slug}`,
    thumbnailUrl: artwork.thumbnail_url,
    artist: {
      id: artwork.artist_id,
      username: artwork.artist_username,
      slug: artwork.artist_slug,
      avatarUrl: artwork.artist_avatar_url,
    },
  }
}

/**
 * Fetch full gallery context
 */
private async getGalleryContext(galleryId: string): Promise<ContextFullInfo | null> {
  const gallery = await this.db
    .prepare(
      `
      SELECT
        g.id, g.title, g.slug, g.description,
        g.cover_image_url as cover_image_url,
        u.id as artist_id, u.username as artist_username,
        u.slug as artist_slug, u.avatar_url as artist_avatar_url
      FROM galleries g
      LEFT JOIN users u ON g.artist_id = u.id
      WHERE g.id = ?
      `
    )
    .bind(galleryId)
    .first<any>()

  if (!gallery) {
    return null
  }

  return {
    type: 'gallery',
    id: gallery.id,
    title: gallery.title,
    slug: gallery.slug,
    description: gallery.description,
    url: `/gallery/${gallery.slug}`,
    thumbnailUrl: gallery.cover_image_url,
    artist: {
      id: gallery.artist_id,
      username: gallery.artist_username,
      slug: gallery.artist_slug,
      avatarUrl: gallery.artist_avatar_url,
    },
  }
}

/**
 * Fetch full collection context
 */
private async getCollectionContext(
  collectionId: string
): Promise<ContextFullInfo | null> {
  const collection = await this.db
    .prepare(
      `
      SELECT
        c.id, c.title, c.slug, c.description,
        u.id as artist_id, u.username as artist_username,
        u.slug as artist_slug, u.avatar_url as artist_avatar_url
      FROM collections c
      LEFT JOIN users u ON c.artist_id = u.id
      WHERE c.id = ?
      `
    )
    .bind(collectionId)
    .first<any>()

  if (!collection) {
    return null
  }

  return {
    type: 'collection',
    id: collection.id,
    title: collection.title,
    slug: collection.slug,
    description: collection.description,
    url: `/collection/${collection.slug}`,
    artist: {
      id: collection.artist_id,
      username: collection.artist_username,
      slug: collection.artist_slug,
      avatarUrl: collection.artist_avatar_url,
    },
  }
}

/**
 * Fetch full artist (user) context
 */
private async getArtistContext(artistId: string): Promise<ContextFullInfo | null> {
  const artist = await this.db
    .prepare(
      `
      SELECT
        id, username, slug, avatar_url, bio
      FROM users
      WHERE id = ?
      `
    )
    .bind(artistId)
    .first<any>()

  if (!artist) {
    return null
  }

  return {
    type: 'artist',
    id: artist.id,
    title: artist.username,
    slug: artist.slug,
    description: artist.bio,
    url: `/${artist.slug}`,
    thumbnailUrl: artist.avatar_url,
  }
}
```

**Explanation:**
- `getMessage` retrieves a message and verifies user has permission (is sender or recipient)
- Returns 404 if message not found or user unauthorized
- Enriches message with full context including artist info
- Separate methods for each context type (artwork, gallery, collection, artist)
- Includes relevant metadata like thumbnails and descriptions

---

### Step 2: Update Message Types

Add types for full context responses in the message types file.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/types/message.ts`

Add these interfaces:

```typescript
export interface UserFullInfo {
  id: string
  username: string
  slug: string
  avatarUrl?: string
  email?: string // Only for admins
}

export interface ContextFullInfo {
  type: MessageContextType
  id: string
  title?: string
  slug?: string
  description?: string
  url?: string
  thumbnailUrl?: string
  artist?: UserPreview
}

export interface MessageWithFullContext extends Message {
  sender: UserFullInfo
  recipient: UserFullInfo
  context?: ContextFullInfo
}
```

**Explanation:**
- `UserFullInfo` includes avatar and optional email (for admin contexts)
- `ContextFullInfo` includes full details like description, URL, and artist info
- `MessageWithFullContext` combines message with full sender/recipient/context details

---

### Step 3: Add Get Route Handler

Add the GET /api/messages/:id endpoint to the messages router.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/messages.ts`

Add this route handler:

```typescript
/**
 * GET /api/messages/:id
 * Get a single message by ID with full context
 * User must be sender or recipient
 */
messagesRouter.get('/messages/:id', authMiddleware, async (c) => {
  try {
    const userId = c.get('userId')
    const messageId = c.req.param('id')

    if (!messageId) {
      throw new ApiError(400, 'MISSING_ID', 'Message ID is required')
    }

    const messageService = createMessageService(c.env.DB)

    try {
      const message = await messageService.getMessage(messageId, userId)
      return c.json({ success: true, data: message }, 200)
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'MESSAGE_NOT_FOUND') {
          throw new ApiError(404, 'NOT_FOUND', 'Message not found')
        }
        if (error.message === 'UNAUTHORIZED') {
          throw new ApiError(403, 'FORBIDDEN', 'You do not have permission to view this message')
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
    throw new ApiError(500, 'INTERNAL_ERROR', 'Failed to fetch message')
  }
})
```

**Explanation:**
- Extracts messageId from URL parameter
- Calls service to fetch message and verify permissions
- Returns 404 if message not found
- Returns 403 if user is not sender or recipient
- Returns full message with context on success

---

### Step 4: Add Service Method for Context Caching (Optional)

Optionally add caching to reduce database queries for frequently viewed messages.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/middleware/cache.ts`

```typescript
import type { Context, Next } from 'hono'
import type { HonoEnv } from '../../../types/env'

/**
 * Simple cache middleware for message GET requests
 * In production, use CloudFlare KV or Redis
 */
const messageCache = new Map<string, { data: any; timestamp: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export async function messageCacheMiddleware(c: Context<HonoEnv>, next: Next) {
  const key = c.req.path

  // Check if cached response exists and is fresh
  const cached = messageCache.get(key)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return c.json({ success: true, data: cached.data }, 200)
  }

  await next()

  // Cache the response if it was successful
  if (c.res.status === 200) {
    try {
      const data = await c.res.json()
      if (data.success) {
        messageCache.set(key, { data: data.data, timestamp: Date.now() })
      }
    } catch {
      // Response wasn't JSON, skip caching
    }
  }
}

/**
 * Clear cache for a specific message
 * Call after message updates (read, delete, etc.)
 */
export function clearMessageCache(messageId: string) {
  const keys = Array.from(messageCache.keys()).filter(
    (key) => key.includes(messageId)
  )
  keys.forEach((key) => messageCache.delete(key))
}
```

**Explanation:**
- Simple in-memory cache with TTL
- For production, should use CloudFlare KV for distributed caching
- Provides method to clear cache when messages are updated

---

### Step 5: Create Test File

Create tests for the message get endpoint.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/__tests__/messages-get.test.ts`

```typescript
import { describe, it, expect } from 'vitest'

describe('Message Get API', () => {
  it('should require authentication', async () => {
    // GET /api/messages/msg-123 without token should return 401
  })

  it('should return message with full context', async () => {
    // GET /api/messages/msg-123 should include sender, recipient, and context
  })

  it('should include sender details', async () => {
    // Response should have sender.username, sender.slug, sender.avatarUrl
  })

  it('should include recipient details', async () => {
    // Response should have recipient.username, recipient.slug, recipient.avatarUrl
  })

  it('should include artwork context', async () => {
    // Messages with contextType=artwork should include full artwork details
  })

  it('should include gallery context', async () => {
    // Messages with contextType=gallery should include gallery details and artist
  })

  it('should include collection context', async () => {
    // Messages with contextType=collection should include collection details
  })

  it('should include artist context', async () => {
    // Messages with contextType=artist should include artist profile info
  })

  it('should return 404 for non-existent message', async () => {
    // GET /api/messages/invalid-id should return 404
  })

  it('should return 403 if user is neither sender nor recipient', async () => {
    // User C trying to view message between User A and User B should fail
  })

  it('should allow sender to view message', async () => {
    // Sender should be able to view their sent message
  })

  it('should allow recipient to view message', async () => {
    // Recipient should be able to view their received message
  })

  it('should handle deleted context gracefully', async () => {
    // Message with deleted artwork should return without context object
  })

  it('should include message moderation fields', async () => {
    // Response should include flaggedReason, reviewedBy, reviewedAt if present
  })
})
```

**Explanation:**
- Tests authorization (sender/recipient can view, others cannot)
- Tests all context types are included with full details
- Tests error cases (404, 403)
- Tests handling of deleted context

---

## Files to Create/Modify

### Create:
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/__tests__/messages-get.test.ts`
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/middleware/cache.ts` (optional)

### Modify:
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/services/messageService.ts` - Add getMessage and context methods
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/types/message.ts` - Add full context types
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/messages.ts` - Add GET /api/messages/:id route

---

## Verification

### 1. Test Get Message as Recipient

```bash
curl -X GET "http://localhost:8788/api/messages/msg-123" \
  -H "Authorization: Bearer RECIPIENT_JWT_TOKEN"
```

Expected response:
```json
{
  "success": true,
  "data": {
    "id": "msg-123",
    "senderId": "user-2-id",
    "recipientId": "user-1-id",
    "subject": "Question about your artwork",
    "body": "I'd like to purchase one of your pieces...",
    "status": "sent",
    "readAt": null,
    "createdAt": "2026-01-19T12:00:00Z",
    "sender": {
      "id": "user-2-id",
      "username": "collector",
      "slug": "collector",
      "avatarUrl": "https://..."
    },
    "recipient": {
      "id": "user-1-id",
      "username": "artist1",
      "slug": "artist1",
      "avatarUrl": "https://..."
    },
    "context": {
      "type": "artwork",
      "id": "artwork-456",
      "title": "Moonlit Forest",
      "slug": "moonlit-forest",
      "description": "A serene landscape...",
      "url": "/artwork/moonlit-forest",
      "thumbnailUrl": "https://...",
      "artist": {
        "id": "user-1-id",
        "username": "artist1",
        "slug": "artist1"
      }
    }
  }
}
```

### 2. Test Get Message as Sender

```bash
curl -X GET "http://localhost:8788/api/messages/msg-123" \
  -H "Authorization: Bearer SENDER_JWT_TOKEN"
```

Should return the same message (sender can also view).

### 3. Test 404 - Non-existent Message

```bash
curl -X GET "http://localhost:8788/api/messages/invalid-id" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

Expected response (404):
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Message not found"
  }
}
```

### 4. Test 403 - No Permission

Create a message between User A and User B, then try to view as User C:

```bash
curl -X GET "http://localhost:8788/api/messages/msg-123" \
  -H "Authorization: Bearer USER_C_JWT_TOKEN"
```

Expected response (403):
```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "You do not have permission to view this message"
  }
}
```

### 5. Test Gallery Context

Send a message with `contextType=gallery` and retrieve it:

```bash
curl -X GET "http://localhost:8788/api/messages/msg-gallery" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

Verify context includes:
- Gallery title, slug, description
- Cover image URL
- Artist details (id, username, slug)

### 6. Test Collection Context

Send message with `contextType=collection` and verify context includes collection details.

### 7. Test Artist Context

Send message with `contextType=artist` and verify context includes artist profile info.

### 8. Test Deleted Context

Delete an artwork, then view a message that referenced it:

```bash
curl -X GET "http://localhost:8788/api/messages/msg-deleted-context" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

Message should return successfully without context object (not fail with error).

### 9. Run Tests

```bash
cd /Volumes/DataSSD/gitsrc/vfa_gallery
npm run test -- messages-get.test.ts
```

---

## Success Criteria

- [x] GET /api/messages/:id returns full message with context
- [x] Sender can view their sent messages
- [x] Recipient can view received messages
- [x] Third parties cannot view messages (403 Forbidden)
- [x] Non-existent messages return 404 Not Found
- [x] Artwork context includes title, slug, thumbnail, artist info
- [x] Gallery context includes title, slug, description, cover image
- [x] Collection context includes title, slug, artist info
- [x] Artist context includes username, slug, bio, avatar
- [x] Deleted context items don't break response
- [x] Message includes moderation fields (flaggedReason, reviewedBy, reviewedAt)
- [x] Unauthenticated requests return 401 Unauthorized
