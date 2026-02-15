import { Hono } from 'hono'
import type { HonoEnv } from '../../../types/env'
import { Errors } from '../errors'
import { requireAuth, getCurrentUser } from '../middleware/auth'

const messages = new Hono<HonoEnv>()

/**
 * Helper: Map message row from DB to API response
 */
function mapMessageRow(row: any) {
  return {
    id: row.id,
    senderId: row.sender_id,
    recipientId: row.recipient_id,
    contextType: row.context_type || null,
    contextId: row.context_id || null,
    subject: row.subject || null,
    body: row.body,
    status: row.status,
    toneScore: row.tone_score || null,
    flaggedReason: row.flagged_reason || null,
    reviewedBy: row.reviewed_by || null,
    reviewedAt: row.reviewed_at || null,
    readAt: row.read_at || null,
    createdAt: row.created_at,
  }
}

/**
 * POST /api/messages
 * Send message
 */
messages.post('/', requireAuth, async (c) => {
  const authUser = getCurrentUser(c)
  if (!authUser) {
    throw Errors.unauthorized()
  }

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    throw Errors.badRequest('Invalid JSON body')
  }

  const data = body as Record<string, unknown>
  const db = c.env.DB

  // Validate body
  if (!data.body || typeof data.body !== 'string') {
    throw Errors.badRequest('Message body is required')
  }

  const bodyText = (data.body as string).trim()
  if (bodyText.length === 0) {
    throw Errors.badRequest('Message body cannot be empty')
  }

  if (bodyText.length > 10000) {
    throw Errors.badRequest('Message body exceeds maximum length of 10000 characters')
  }

  // Validate subject if provided
  if (data.subject && typeof data.subject === 'string') {
    if (data.subject.length > 200) {
      throw Errors.badRequest('Subject exceeds maximum length of 200 characters')
    }
  }

  // Validate recipientId
  if (!data.recipientId || typeof data.recipientId !== 'string') {
    throw Errors.badRequest('Recipient ID is required')
  }

  // Check self-messaging
  if (data.recipientId === authUser.userId) {
    throw Errors.badRequest('Cannot send message to yourself')
  }

  // Validate recipient exists and is active
  const recipient = await db
    .prepare('SELECT id FROM users WHERE id = ? AND status = ?')
    .bind(data.recipientId as string, 'active')
    .first<any>()

  if (!recipient) {
    throw Errors.badRequest('Recipient not found or is inactive')
  }

  // Validate contextType if provided
  const validContextTypes = ['artist', 'gallery', 'collection', 'artwork', 'general']
  if (data.contextType && !validContextTypes.includes(data.contextType as string)) {
    throw Errors.badRequest('Invalid context type')
  }

  // Build insert values
  const messageId = crypto.randomUUID()
  const now = new Date().toISOString()
  const contextType = (data.contextType as string) || null
  const contextId = (data.contextId as string) || null
  const subject = (data.subject as string) || null

  // Insert message
  await db
    .prepare(
      `INSERT INTO messages
       (id, sender_id, recipient_id, context_type, context_id, subject, body, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      messageId,
      authUser.userId,
      data.recipientId as string,
      contextType,
      contextId,
      subject,
      bodyText,
      'sent',
      now
    )
    .run()

  // Fetch and return the new message
  const newMessage = await db
    .prepare('SELECT * FROM messages WHERE id = ?')
    .bind(messageId)
    .first<any>()

  return c.json(mapMessageRow(newMessage), 201)
})

/**
 * GET /api/messages
 * List messages (inbox or sent)
 */
messages.get('/', requireAuth, async (c) => {
  const authUser = getCurrentUser(c)
  if (!authUser) {
    throw Errors.unauthorized()
  }

  const folder = c.req.query('folder') || 'inbox'
  const page = Math.max(1, parseInt(c.req.query('page') || '1', 10))
  const pageSize = Math.min(100, Math.max(1, parseInt(c.req.query('pageSize') || '20', 10)))

  if (!['inbox', 'sent'].includes(folder)) {
    throw Errors.badRequest('Folder must be inbox or sent')
  }

  const db = c.env.DB
  const offset = (page - 1) * pageSize

  // Build WHERE clause based on folder
  let whereCondition = ''
  if (folder === 'inbox') {
    whereCondition = 'WHERE m.recipient_id = ?'
  } else {
    whereCondition = 'WHERE m.sender_id = ?'
  }

  // Get total count
  const countQuery = `SELECT COUNT(*) as total FROM messages m ${whereCondition}`
  const countRow = await db
    .prepare(countQuery)
    .bind(authUser.userId)
    .first<{ total: number }>()

  const total = countRow?.total || 0
  const totalPages = Math.ceil(total / pageSize)

  // Get paginated data with user joins
  const dataQuery = `
    SELECT
      m.*,
      s.id as sender_user_id,
      s.username as sender_username,
      s.display_name as sender_display_name,
      s.avatar_url as sender_avatar_url,
      r.id as recipient_user_id,
      r.username as recipient_username,
      r.display_name as recipient_display_name,
      r.avatar_url as recipient_avatar_url
    FROM messages m
    LEFT JOIN users s ON m.sender_id = s.id
    LEFT JOIN users r ON m.recipient_id = r.id
    ${whereCondition}
    ORDER BY m.created_at DESC
    LIMIT ? OFFSET ?
  `

  const rows = await db
    .prepare(dataQuery)
    .bind(authUser.userId, pageSize, offset)
    .all<any>()

  const data = (rows.results || []).map((row: any) => ({
    ...mapMessageRow(row),
    sender: {
      id: row.sender_user_id,
      username: row.sender_username,
      displayName: row.sender_display_name,
      avatarUrl: row.sender_avatar_url,
    },
    recipient: {
      id: row.recipient_user_id,
      username: row.recipient_username,
      displayName: row.recipient_display_name,
      avatarUrl: row.recipient_avatar_url,
    },
  }))

  return c.json({
    data,
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
    },
  })
})

/**
 * GET /api/messages/unread-count
 * Get unread message count
 * MUST be defined before /:id route
 */
messages.get('/unread-count', requireAuth, async (c) => {
  const authUser = getCurrentUser(c)
  if (!authUser) {
    throw Errors.unauthorized()
  }

  const db = c.env.DB

  const countRow = await db
    .prepare('SELECT COUNT(*) as count FROM messages WHERE recipient_id = ? AND read_at IS NULL')
    .bind(authUser.userId)
    .first<{ count: number }>()

  const unreadCount = countRow?.count || 0

  return c.json({ unreadCount })
})

/**
 * GET /api/messages/:id
 * Get single message with context
 */
messages.get('/:id', requireAuth, async (c) => {
  const messageId = c.req.param('id')
  const authUser = getCurrentUser(c)
  if (!authUser) {
    throw Errors.unauthorized()
  }

  const db = c.env.DB

  // Fetch message with sender and recipient user info
  const messageRow = await db
    .prepare(
      `SELECT
        m.*,
        s.id as sender_user_id,
        s.username as sender_username,
        s.display_name as sender_display_name,
        s.avatar_url as sender_avatar_url,
        r.id as recipient_user_id,
        r.username as recipient_username,
        r.display_name as recipient_display_name,
        r.avatar_url as recipient_avatar_url
      FROM messages m
      LEFT JOIN users s ON m.sender_id = s.id
      LEFT JOIN users r ON m.recipient_id = r.id
      WHERE m.id = ?`
    )
    .bind(messageId)
    .first<any>()

  if (!messageRow) {
    throw Errors.notFound('Message')
  }

  // Authorization: user must be sender or recipient
  if (messageRow.sender_id !== authUser.userId && messageRow.recipient_id !== authUser.userId) {
    throw Errors.notFound('Message')
  }

  // Fetch context if present
  let context = null
  if (messageRow.context_type && messageRow.context_id && messageRow.context_type !== 'general') {
    const contextType = messageRow.context_type

    if (contextType === 'artwork') {
      const artwork = await db
        .prepare('SELECT id, title, slug, thumbnail_url FROM artworks WHERE id = ?')
        .bind(messageRow.context_id)
        .first<any>()

      if (artwork) {
        context = {
          type: 'artwork',
          id: artwork.id,
          title: artwork.title,
          slug: artwork.slug,
          thumbnailUrl: artwork.thumbnail_url,
        }
      }
    } else if (contextType === 'gallery') {
      const gallery = await db
        .prepare('SELECT id, name, slug FROM galleries WHERE id = ?')
        .bind(messageRow.context_id)
        .first<any>()

      if (gallery) {
        context = {
          type: 'gallery',
          id: gallery.id,
          title: gallery.name,
          slug: gallery.slug,
        }
      }
    } else if (contextType === 'collection') {
      const collection = await db
        .prepare('SELECT id, name, slug FROM collections WHERE id = ?')
        .bind(messageRow.context_id)
        .first<any>()

      if (collection) {
        context = {
          type: 'collection',
          id: collection.id,
          title: collection.name,
          slug: collection.slug,
        }
      }
    } else if (contextType === 'artist') {
      const artist = await db
        .prepare('SELECT id, username, display_name, avatar_url FROM users WHERE id = ?')
        .bind(messageRow.context_id)
        .first<any>()

      if (artist) {
        context = {
          type: 'artist',
          id: artist.id,
          title: artist.username,
          slug: artist.username,
          displayName: artist.display_name,
          avatarUrl: artist.avatar_url,
        }
      }
    }
  }

  return c.json({
    ...mapMessageRow(messageRow),
    sender: {
      id: messageRow.sender_user_id,
      username: messageRow.sender_username,
      displayName: messageRow.sender_display_name,
      avatarUrl: messageRow.sender_avatar_url,
    },
    recipient: {
      id: messageRow.recipient_user_id,
      username: messageRow.recipient_username,
      displayName: messageRow.recipient_display_name,
      avatarUrl: messageRow.recipient_avatar_url,
    },
    ...(context && { context }),
  })
})

/**
 * PATCH /api/messages/:id/read
 * Mark message as read
 */
messages.patch('/:id/read', requireAuth, async (c) => {
  const messageId = c.req.param('id')
  const authUser = getCurrentUser(c)
  if (!authUser) {
    throw Errors.unauthorized()
  }

  const db = c.env.DB

  // Fetch message
  const message = await db
    .prepare('SELECT * FROM messages WHERE id = ?')
    .bind(messageId)
    .first<any>()

  if (!message) {
    throw Errors.notFound('Message')
  }

  // Authorization: only recipient can mark as read
  if (message.recipient_id !== authUser.userId) {
    throw Errors.forbidden('Only recipient can mark as read')
  }

  // Update if not already read
  if (!message.read_at) {
    const now = new Date().toISOString()
    await db
      .prepare('UPDATE messages SET read_at = ?, status = ? WHERE id = ?')
      .bind(now, 'read', messageId)
      .run()
  }

  // Fetch updated message
  const updatedMessage = await db
    .prepare('SELECT * FROM messages WHERE id = ?')
    .bind(messageId)
    .first<any>()

  return c.json(mapMessageRow(updatedMessage))
})

/**
 * DELETE /api/messages/:id
 * Delete message
 */
messages.delete('/:id', requireAuth, async (c) => {
  const messageId = c.req.param('id')
  const authUser = getCurrentUser(c)
  if (!authUser) {
    throw Errors.unauthorized()
  }

  const db = c.env.DB

  // Fetch message
  const message = await db
    .prepare('SELECT * FROM messages WHERE id = ?')
    .bind(messageId)
    .first<any>()

  if (!message) {
    throw Errors.notFound('Message')
  }

  // Authorization: must be sender or recipient
  if (message.sender_id !== authUser.userId && message.recipient_id !== authUser.userId) {
    throw Errors.notFound('Message')
  }

  // Delete message
  await db
    .prepare('DELETE FROM messages WHERE id = ?')
    .bind(messageId)
    .run()

  return c.json({
    success: true,
  })
})

export { messages }
