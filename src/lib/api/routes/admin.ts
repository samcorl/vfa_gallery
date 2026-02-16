import { Hono } from 'hono'
import type { HonoEnv } from '../../../types/env'
import { requireAuth, requireAdmin, getCurrentUser } from '../middleware/auth'
import { Errors } from '../errors'

const admin = new Hono<HonoEnv>()

// Apply auth + admin middleware to ALL admin routes
admin.use('*', requireAuth)
admin.use('*', requireAdmin)

/**
 * GET /api/admin/stats
 * Get dashboard statistics for admin users
 */
admin.get('/stats', async (c) => {
  const db = c.env.DB

  // Query user stats
  const userStatsResult = await db
    .prepare('SELECT status, COUNT(*) as count FROM users GROUP BY status')
    .all<any>()

  const userStats: Record<string, number> = {}
  ;(userStatsResult.results || []).forEach((row) => {
    userStats[row.status] = row.count
  })

  // Query gallery stats
  const galleryStatsResult = await db
    .prepare('SELECT status, COUNT(*) as count FROM galleries GROUP BY status')
    .all<any>()

  const galleryStats: Record<string, number> = {}
  ;(galleryStatsResult.results || []).forEach((row) => {
    galleryStats[row.status] = row.count
  })

  // Query artwork stats
  const artworkStatsResult = await db
    .prepare('SELECT status, COUNT(*) as count FROM artworks GROUP BY status')
    .all<any>()

  const artworkStats: Record<string, number> = {}
  ;(artworkStatsResult.results || []).forEach((row) => {
    artworkStats[row.status] = row.count
  })

  // Query message stats
  const messageStatsResult = await db
    .prepare('SELECT status, COUNT(*) as count FROM messages GROUP BY status')
    .all<any>()

  const messageStats: Record<string, number> = {}
  ;(messageStatsResult.results || []).forEach((row) => {
    messageStats[row.status] = row.count
  })

  // Query recent activity
  const activityResult = await db
    .prepare(
      `SELECT al.action, al.entity_type, al.user_id, u.username, al.created_at
       FROM activity_log al
       LEFT JOIN users u ON al.user_id = u.id
       ORDER BY al.created_at DESC
       LIMIT 10`
    )
    .all<any>()

  const recentActivity = (activityResult.results || []).map((row) => ({
    action: row.action,
    entityType: row.entity_type,
    userId: row.user_id,
    username: row.username,
    createdAt: row.created_at,
  }))

  return c.json({
    data: {
      users: userStats,
      galleries: galleryStats,
      artworks: artworkStats,
      messages: messageStats,
      recentActivity,
      generatedAt: new Date().toISOString(),
    },
  })
})

/**
 * GET /api/admin/activity
 * Get paginated activity log with optional filtering
 */
admin.get('/activity', async (c) => {
  const db = c.env.DB

  // Query params
  const action = c.req.query('action')
  const userId = c.req.query('user_id')
  const from = c.req.query('from')
  const to = c.req.query('to')
  const page = parseInt(c.req.query('page') || '1', 10)
  const limit = Math.min(parseInt(c.req.query('limit') || '20', 10), 100)

  // Validate pagination
  if (page < 1 || limit < 1 || limit > 100) {
    throw Errors.badRequest(
      'Invalid pagination: page must be >= 1, limit must be 1-100'
    )
  }

  // Validate date range
  if (from && to) {
    if (new Date(from) >= new Date(to)) {
      throw Errors.badRequest('Invalid date range: from must be before to')
    }
  }

  // Build WHERE clause dynamically
  const conditions: string[] = []
  const params: any[] = []

  if (action) {
    conditions.push('al.action = ?')
    params.push(action)
  }

  if (userId) {
    conditions.push('al.user_id = ?')
    params.push(userId)
  }

  if (from) {
    conditions.push('al.created_at >= ?')
    params.push(from)
  }

  if (to) {
    conditions.push('al.created_at <= ?')
    params.push(to)
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  // Count total
  const countQuery = `SELECT COUNT(*) as total FROM activity_log al ${whereClause}`
  const countResult = await db
    .prepare(countQuery)
    .bind(...params)
    .first<{ total: number }>()

  const total = countResult?.total || 0

  // Calculate offset
  const offset = (page - 1) * limit

  // Fetch paginated activity
  const query = `
    SELECT
      al.id,
      al.action,
      al.entity_type,
      al.entity_id,
      al.user_id,
      u.username,
      u.email,
      al.metadata,
      al.ip_address,
      al.user_agent,
      al.created_at
    FROM activity_log al
    LEFT JOIN users u ON al.user_id = u.id
    ${whereClause}
    ORDER BY al.created_at DESC
    LIMIT ? OFFSET ?
  `

  const activityResult = await db
    .prepare(query)
    .bind(...params, limit, offset)
    .all<any>()

  const activities = (activityResult.results || []).map((row) => ({
    id: row.id,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    userId: row.user_id,
    username: row.username,
    userEmail: row.email,
    metadata: row.metadata ? JSON.parse(row.metadata) : null,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    createdAt: row.created_at,
  }))

  return c.json({
    data: {
      activities,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    },
  })
})

/**
 * GET /api/admin/messages/pending
 * Get pending messages for review with pagination and filtering
 */
admin.get('/messages/pending', async (c) => {
  const db = c.env.DB

  const flaggedOnly = c.req.query('flagged_only') === 'true'
  const sortBy = c.req.query('sort_by') || 'created_at'
  const page = parseInt(c.req.query('page') || '1', 10)
  const limit = Math.min(parseInt(c.req.query('limit') || '20', 10), 100)

  // Validate
  if (page < 1 || limit < 1 || limit > 100) {
    throw Errors.badRequest('Invalid pagination: page must be >= 1, limit must be 1-100')
  }
  if (!['created_at', 'tone_score'].includes(sortBy)) {
    throw Errors.badRequest("Invalid sort_by: must be 'tone_score' or 'created_at'")
  }

  // Build WHERE
  const conditions: string[] = ["m.status = 'pending_review'"]
  if (flaggedOnly) {
    conditions.push('m.flagged_reason IS NOT NULL')
  }
  const whereClause = `WHERE ${conditions.join(' AND ')}`

  // Build ORDER BY (SQLite doesn't support NULLS LAST)
  const orderBy = sortBy === 'tone_score'
    ? 'CASE WHEN m.tone_score IS NULL THEN 1 ELSE 0 END, m.tone_score DESC, m.created_at DESC'
    : 'm.created_at DESC'

  // Count
  const countResult = await db
    .prepare(`SELECT COUNT(*) as total FROM messages m ${whereClause}`)
    .first<{ total: number }>()
  const total = countResult?.total || 0

  const offset = (page - 1) * limit

  // Query with JOINs for sender, recipient, and context title
  const query = `
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
      CASE
        WHEN m.context_type = 'artwork' THEN a.title
        WHEN m.context_type = 'gallery' THEN g.title
        ELSE NULL
      END as context_title,
      m.reviewed_by,
      m.reviewed_at,
      m.created_at
    FROM messages m
    LEFT JOIN users us ON m.sender_id = us.id
    LEFT JOIN users ur ON m.recipient_id = ur.id
    LEFT JOIN artworks a ON m.context_type = 'artwork' AND m.context_id = a.id
    LEFT JOIN galleries g ON m.context_type = 'gallery' AND m.context_id = g.id
    ${whereClause}
    ORDER BY ${orderBy}
    LIMIT ? OFFSET ?
  `

  const result = await db
    .prepare(query)
    .bind(limit, offset)
    .all<any>()

  const messages = (result.results || []).map((row: any) => ({
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
    contextTitle: row.context_title,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
    actions: { approve: true, reject: true, flag: true },
  }))

  return c.json({
    data: {
      messages,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    },
  })
})

/**
 * POST /api/admin/messages/:id/approve
 * Approve a pending message
 */
admin.post('/messages/:id/approve', async (c) => {
  const db = c.env.DB
  const messageId = c.req.param('id')
  const authUser = getCurrentUser(c)!
  const now = new Date().toISOString()

  // Verify message exists and is pending
  const message = await db
    .prepare("SELECT id, status FROM messages WHERE id = ? AND status = 'pending_review'")
    .bind(messageId)
    .first<{ id: string; status: string }>()

  if (!message) {
    throw Errors.notFound('Message not found or not pending review')
  }

  // Update status
  await db
    .prepare("UPDATE messages SET status = 'approved', reviewed_by = ?, reviewed_at = ? WHERE id = ?")
    .bind(authUser.userId, now, messageId)
    .run()

  // Log activity
  await db
    .prepare('INSERT INTO activity_log (id, user_id, action, entity_type, entity_id, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(crypto.randomUUID(), authUser.userId, 'message_approved', 'message', messageId, JSON.stringify({ previous_status: 'pending_review' }), now)
    .run()

  return c.json({
    data: {
      id: messageId,
      status: 'approved',
      reviewedBy: authUser.userId,
      reviewedAt: now,
    },
  })
})

/**
 * POST /api/admin/messages/:id/reject
 * Reject a pending message
 */
admin.post('/messages/:id/reject', async (c) => {
  const db = c.env.DB
  const messageId = c.req.param('id')
  const authUser2 = getCurrentUser(c)!
  const now = new Date().toISOString()

  // Parse optional reason
  let reason: string | undefined
  try {
    const contentType = c.req.header('content-type') || ''
    if (contentType.includes('application/json')) {
      const body = await c.req.json<{ reason?: string }>()
      if (body.reason !== undefined) {
        if (typeof body.reason !== 'string') {
          throw Errors.badRequest('Rejection reason must be a string')
        }
        if (body.reason.length > 1000) {
          throw Errors.badRequest('Rejection reason must be 1000 characters or less')
        }
        reason = body.reason
      }
    }
  } catch (err: any) {
    if (err.code === 'BAD_REQUEST') throw err
  }

  // Verify message exists and is pending
  const message = await db
    .prepare("SELECT id, status FROM messages WHERE id = ? AND status = 'pending_review'")
    .bind(messageId)
    .first<{ id: string; status: string }>()

  if (!message) {
    throw Errors.notFound('Message not found or not pending review')
  }

  // Update status
  await db
    .prepare("UPDATE messages SET status = 'rejected', reviewed_by = ?, reviewed_at = ? WHERE id = ?")
    .bind(authUser2.userId, now, messageId)
    .run()

  // Log activity with reason in metadata
  const metadata: Record<string, any> = { previous_status: 'pending_review' }
  if (reason) metadata.reason = reason

  await db
    .prepare('INSERT INTO activity_log (id, user_id, action, entity_type, entity_id, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(crypto.randomUUID(), authUser2.userId, 'message_rejected', 'message', messageId, JSON.stringify(metadata), now)
    .run()

  const responseData: Record<string, any> = {
    id: messageId,
    status: 'rejected',
    reviewedBy: authUser2.userId,
    reviewedAt: now,
  }
  if (reason) responseData.reason = reason

  return c.json({ data: responseData })
})

/**
 * POST /api/admin/messages/:id/flag
 * Flag a message for manual review
 */
admin.post('/messages/:id/flag', async (c) => {
  const db = c.env.DB
  const messageId = c.req.param('id')

  const body = await c.req.json<{ reason: string }>()

  if (!body.reason || typeof body.reason !== 'string') {
    throw Errors.badRequest('Flag reason is required and must be a string')
  }
  if (body.reason.length > 1000) {
    throw Errors.badRequest('Flag reason must be 1000 characters or less')
  }

  // Verify message exists
  const message = await db
    .prepare('SELECT id FROM messages WHERE id = ?')
    .bind(messageId)
    .first<{ id: string }>()

  if (!message) {
    throw Errors.notFound('Message not found')
  }

  // Update flagged_reason
  await db
    .prepare('UPDATE messages SET flagged_reason = ? WHERE id = ?')
    .bind(body.reason, messageId)
    .run()

  return c.json({
    data: {
      id: messageId,
      flagged: true,
      reason: body.reason,
    },
  })
})

/**
 * GET /api/admin/suspicious/flagged
 * Get flagged users for review
 */
admin.get('/suspicious/flagged', async (c) => {
  const db = c.env.DB
  const page = parseInt(c.req.query('page') || '1', 10)
  const limit = Math.min(parseInt(c.req.query('limit') || '20', 10), 100)

  if (page < 1 || limit < 1) {
    throw Errors.badRequest('Invalid pagination')
  }

  const offset = (page - 1) * limit

  // Import dynamically to avoid circular deps if needed
  const { getFlaggedUsers } = await import('../security/suspicious-detection')
  const users = await getFlaggedUsers(db, limit, offset)

  // Count total flagged
  const countResult = await db
    .prepare("SELECT COUNT(*) as total FROM users WHERE status = 'flagged'")
    .first<{ total: number }>()
  const total = countResult?.total || 0

  return c.json({
    data: {
      users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    },
  })
})

/**
 * POST /api/admin/suspicious/:userId/clear
 * Clear suspicious flags for a user
 */
admin.post('/suspicious/:userId/clear', async (c) => {
  const db = c.env.DB
  const targetUserId = c.req.param('userId')
  const authUser = getCurrentUser(c)
  if (!authUser) {
    throw Errors.unauthorized()
  }
  const { userId } = authUser

  const body = await c.req.json<{ reviewNotes: string }>()
  if (!body.reviewNotes || typeof body.reviewNotes !== 'string') {
    throw Errors.badRequest('Review notes are required')
  }
  if (body.reviewNotes.length > 1000) {
    throw Errors.badRequest('Review notes must be 1000 characters or less')
  }

  // Verify user exists and is flagged
  const flaggedUser = await db
    .prepare("SELECT id, status FROM users WHERE id = ? AND status = 'flagged'")
    .bind(targetUserId)
    .first<{ id: string; status: string }>()

  if (!flaggedUser) {
    throw Errors.notFound('Flagged user not found')
  }

  const { clearSuspiciousFlags } = await import('../security/suspicious-detection')
  await clearSuspiciousFlags(db, targetUserId, userId, body.reviewNotes)

  return c.json({
    data: {
      userId: targetUserId,
      status: 'active',
      clearedBy: userId,
    },
  })
})

/**
 * GET /api/admin/suspicious/stats
 * Get suspicious activity statistics
 */
admin.get('/suspicious/stats', async (c) => {
  const db = c.env.DB

  const flaggedCount = await db
    .prepare("SELECT COUNT(*) as count FROM users WHERE status = 'flagged'")
    .first<{ count: number }>()

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const flagsByType = await db
    .prepare(
      `SELECT
        json_extract(metadata, '$.flag') as flag,
        json_extract(metadata, '$.severity') as severity,
        COUNT(*) as count
       FROM activity_log
       WHERE action = 'suspicious_activity_flagged' AND created_at >= ?
       GROUP BY json_extract(metadata, '$.flag')`
    )
    .bind(oneDayAgo)
    .all<{ flag: string; severity: string; count: number }>()

  return c.json({
    data: {
      flaggedUsers: flaggedCount?.count || 0,
      recentFlags: (flagsByType.results || []).map((r) => ({
        flag: r.flag,
        severity: r.severity,
        count: r.count,
      })),
      timeWindow: '24 hours',
    },
  })
})

export { admin }
