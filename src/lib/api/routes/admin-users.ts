import { Hono } from 'hono'
import type { HonoEnv } from '../../../types/env'
import { requireAuth, requireAdmin, getCurrentUser } from '../middleware/auth'
import { Errors } from '../errors'

const adminUsers = new Hono<HonoEnv>()

// Apply auth + admin middleware to ALL admin routes
adminUsers.use('*', requireAuth)
adminUsers.use('*', requireAdmin)

/**
 * GET /api/admin/users
 * List users with pagination, search, and filtering
 */
adminUsers.get('/', async (c) => {
  const db = c.env.DB

  // Query params
  const page = parseInt(c.req.query('page') || '1', 10)
  const limit = Math.min(parseInt(c.req.query('limit') || '20', 10), 100)
  const search = c.req.query('search')
  const status = c.req.query('status')
  const sort = c.req.query('sort') || 'created_at'
  const order = (c.req.query('order') || 'desc').toUpperCase()

  // Validate pagination
  if (page < 1 || limit < 1 || limit > 100) {
    throw Errors.badRequest(
      'Invalid pagination: page must be >= 1, limit must be 1-100'
    )
  }

  // Validate status
  const validStatuses = ['pending', 'active', 'suspended', 'deleted']
  if (status && !validStatuses.includes(status)) {
    throw Errors.badRequest(
      `Invalid status: must be one of ${validStatuses.join(', ')}`
    )
  }

  // Validate sort column
  const validSortColumns = ['created_at', 'updated_at', 'username']
  if (!validSortColumns.includes(sort)) {
    throw Errors.badRequest(
      `Invalid sort column: must be one of ${validSortColumns.join(', ')}`
    )
  }

  // Validate order
  if (!['ASC', 'DESC'].includes(order)) {
    throw Errors.badRequest('Invalid order: must be ASC or DESC')
  }

  // Build WHERE clause dynamically
  const conditions: string[] = []
  const params: any[] = []

  if (search) {
    conditions.push('(u.username LIKE ? OR u.email LIKE ?)')
    const searchTerm = `%${search}%`
    params.push(searchTerm, searchTerm)
  }

  if (status) {
    conditions.push('u.status = ?')
    params.push(status)
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  // Count total
  const countQuery = `SELECT COUNT(*) as total FROM users u ${whereClause}`
  const countResult = await db
    .prepare(countQuery)
    .bind(...params)
    .first<{ total: number }>()

  const total = countResult?.total || 0

  // Calculate offset
  const offset = (page - 1) * limit

  // Fetch paginated users
  const query = `
    SELECT
      u.id,
      u.username,
      u.email,
      u.display_name as displayName,
      u.status,
      u.role,
      COUNT(a.id) as artworkCount,
      u.created_at as createdAt,
      u.updated_at as updatedAt,
      u.last_login_at as lastLoginAt
    FROM users u
    LEFT JOIN artworks a ON u.id = a.user_id
    ${whereClause}
    GROUP BY u.id
    ORDER BY u.${sort} ${order}
    LIMIT ? OFFSET ?
  `

  const usersResult = await db
    .prepare(query)
    .bind(...params, limit, offset)
    .all<any>()

  const users = (usersResult.results || []).map((row) => ({
    id: row.id,
    username: row.username,
    email: row.email,
    displayName: row.displayName,
    status: row.status,
    role: row.role,
    artworkCount: row.artworkCount || 0,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    lastLoginAt: row.lastLoginAt,
  }))

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
 * GET /api/admin/users/:id
 * Get detailed user information
 */
adminUsers.get('/:id', async (c) => {
  const db = c.env.DB
  const userId = c.req.param('id')

  // Fetch user details
  const userResult = await db
    .prepare(
      `SELECT
        id,
        email,
        username,
        display_name as displayName,
        avatar_url as avatarUrl,
        bio,
        website,
        phone,
        socials,
        status,
        role,
        gallery_limit as galleryLimit,
        collection_limit as collectionLimit,
        artwork_limit as artworkLimit,
        daily_upload_limit as dailyUploadLimit,
        email_verified_at as emailVerifiedAt,
        created_at as createdAt,
        updated_at as updatedAt,
        last_login_at as lastLoginAt
      FROM users WHERE id = ?`
    )
    .bind(userId)
    .first<any>()

  if (!userResult) {
    throw Errors.notFound('User not found')
  }

  // Parse socials JSON
  let socials = []
  if (userResult.socials) {
    try {
      socials = JSON.parse(userResult.socials)
    } catch {
      socials = []
    }
  }

  // Count galleries
  const galleriesResult = await db
    .prepare('SELECT COUNT(*) as count FROM galleries WHERE user_id = ?')
    .bind(userId)
    .first<{ count: number }>()

  // Count collections
  const collectionsResult = await db
    .prepare('SELECT COUNT(*) as count FROM collections WHERE user_id = ?')
    .bind(userId)
    .first<{ count: number }>()

  // Count artworks
  const artworksResult = await db
    .prepare('SELECT COUNT(*) as count FROM artworks WHERE user_id = ?')
    .bind(userId)
    .first<{ count: number }>()

  // Count recent uploads (30 days)
  const uploadsResult = await db
    .prepare(
      "SELECT COUNT(*) as count FROM artworks WHERE user_id = ? AND created_at >= datetime('now', '-30 days')"
    )
    .bind(userId)
    .first<{ count: number }>()

  // Count messages
  const messagesResult = await db
    .prepare(
      'SELECT COUNT(*) as count FROM messages WHERE sender_id = ? OR recipient_id = ?'
    )
    .bind(userId, userId)
    .first<{ count: number }>()

  return c.json({
    data: {
      id: userResult.id,
      username: userResult.username,
      email: userResult.email,
      displayName: userResult.displayName,
      avatarUrl: userResult.avatarUrl,
      bio: userResult.bio,
      website: userResult.website,
      phone: userResult.phone,
      socials,
      status: userResult.status,
      role: userResult.role,
      galleries: galleriesResult?.count || 0,
      collections: collectionsResult?.count || 0,
      artworks: artworksResult?.count || 0,
      galleryLimit: userResult.galleryLimit,
      collectionLimit: userResult.collectionLimit,
      artworkLimit: userResult.artworkLimit,
      dailyUploadLimit: userResult.dailyUploadLimit,
      emailVerifiedAt: userResult.emailVerifiedAt,
      createdAt: userResult.createdAt,
      updatedAt: userResult.updatedAt,
      lastLoginAt: userResult.lastLoginAt,
      activity: {
        uploads: uploadsResult?.count || 0,
        messages: messagesResult?.count || 0,
      },
    },
  })
})

/**
 * PATCH /api/admin/users/:id
 * Update user details
 */
adminUsers.patch('/:id', async (c) => {
  const db = c.env.DB
  const userId = c.req.param('id')
  const adminUser = getCurrentUser(c)

  if (!adminUser) {
    throw Errors.unauthorized('Authentication required')
  }

  // Parse request body
  let body: Record<string, any> = {}
  try {
    body = await c.req.json()
  } catch {
    throw Errors.badRequest('Invalid JSON body')
  }

  // Validate status
  if (body.status && !['pending', 'active', 'suspended', 'deleted'].includes(body.status)) {
    throw Errors.badRequest(
      "Invalid status: must be one of 'pending', 'active', 'suspended', 'deleted'"
    )
  }

  // Validate role
  if (body.role && !['user', 'admin'].includes(body.role)) {
    throw Errors.badRequest("Invalid role: must be 'user' or 'admin'")
  }

  // Validate limits
  if (body.galleryLimit !== undefined) {
    const limit = parseInt(body.galleryLimit, 10)
    if (isNaN(limit) || limit < 1 || limit > 10000) {
      throw Errors.badRequest('galleryLimit must be between 1 and 10000')
    }
  }

  if (body.collectionLimit !== undefined) {
    const limit = parseInt(body.collectionLimit, 10)
    if (isNaN(limit) || limit < 1 || limit > 10000) {
      throw Errors.badRequest('collectionLimit must be between 1 and 10000')
    }
  }

  if (body.artworkLimit !== undefined) {
    const limit = parseInt(body.artworkLimit, 10)
    if (isNaN(limit) || limit < 1 || limit > 100000) {
      throw Errors.badRequest('artworkLimit must be between 1 and 100000')
    }
  }

  if (body.dailyUploadLimit !== undefined) {
    const limit = parseInt(body.dailyUploadLimit, 10)
    if (isNaN(limit) || limit < 1 || limit > 1000) {
      throw Errors.badRequest('dailyUploadLimit must be between 1 and 1000')
    }
  }

  // Map camelCase to snake_case
  const updateFields: Record<string, any> = {}
  const fieldMap: Record<string, string> = {
    status: 'status',
    role: 'role',
    galleryLimit: 'gallery_limit',
    collectionLimit: 'collection_limit',
    artworkLimit: 'artwork_limit',
    dailyUploadLimit: 'daily_upload_limit',
  }

  for (const [camelKey, snakeKey] of Object.entries(fieldMap)) {
    if (camelKey in body) {
      updateFields[snakeKey] = body[camelKey]
    }
  }

  // Check if there are valid fields to update
  if (Object.keys(updateFields).length === 0) {
    throw Errors.badRequest('No valid fields to update')
  }

  // Check user exists
  const userCheck = await db
    .prepare('SELECT id FROM users WHERE id = ?')
    .bind(userId)
    .first<{ id: string }>()

  if (!userCheck) {
    throw Errors.notFound('User not found')
  }

  // Build dynamic SET clause
  const setClauses: string[] = []
  const updateParams: any[] = []

  for (const [key, value] of Object.entries(updateFields)) {
    setClauses.push(`${key} = ?`)
    updateParams.push(value)
  }

  setClauses.push("updated_at = datetime('now')")

  // Execute UPDATE
  const updateQuery = `UPDATE users SET ${setClauses.join(', ')} WHERE id = ?`
  await db
    .prepare(updateQuery)
    .bind(...updateParams, userId)
    .run()

  // Fetch updated user data
  const updatedUser = await db
    .prepare(
      `SELECT
        id,
        username,
        email,
        status,
        role,
        gallery_limit as galleryLimit,
        collection_limit as collectionLimit,
        artwork_limit as artworkLimit,
        daily_upload_limit as dailyUploadLimit,
        updated_at as updatedAt
      FROM users WHERE id = ?`
    )
    .bind(userId)
    .first<any>()

  // Log to activity_log
  const logId = crypto.randomUUID()
  const changedFields = Object.keys(updateFields)
  const metadata = JSON.stringify({
    changed_fields: changedFields,
    updates: updateFields,
  })

  await db
    .prepare(
      `INSERT INTO activity_log (id, user_id, action, entity_type, entity_id, metadata, created_at)
       VALUES (?, ?, 'user_updated', 'user', ?, ?, datetime('now'))`
    )
    .bind(logId, adminUser.userId, userId, metadata)
    .run()

  return c.json({
    data: {
      id: updatedUser?.id,
      username: updatedUser?.username,
      email: updatedUser?.email,
      status: updatedUser?.status,
      role: updatedUser?.role,
      galleryLimit: updatedUser?.galleryLimit,
      collectionLimit: updatedUser?.collectionLimit,
      artworkLimit: updatedUser?.artworkLimit,
      dailyUploadLimit: updatedUser?.dailyUploadLimit,
      updatedAt: updatedUser?.updatedAt,
    },
  })
})

/**
 * POST /api/admin/users/:id/suspend
 * Suspend a user account
 */
adminUsers.post('/:id/suspend', async (c) => {
  const db = c.env.DB
  const userId = c.req.param('id')
  const adminUser = getCurrentUser(c)

  if (!adminUser) {
    throw Errors.unauthorized('Authentication required')
  }

  // Self-suspension check
  if (userId === adminUser.userId) {
    throw Errors.badRequest('Cannot suspend your own account')
  }

  // Parse optional body
  let body: Record<string, any> = {}
  const contentType = c.req.header('content-type')
  if (contentType && contentType.includes('application/json')) {
    try {
      body = await c.req.json()
    } catch {
      // Ignore parse errors, body remains empty
    }
  }

  // Validate reason if provided
  if (body.reason !== undefined) {
    if (typeof body.reason !== 'string') {
      throw Errors.badRequest('reason must be a string')
    }
    const trimmedReason = body.reason.trim()
    if (trimmedReason.length === 0 || trimmedReason.length > 1000) {
      throw Errors.badRequest('reason must be between 1 and 1000 characters')
    }
  }

  // Check target user
  const targetUser = await db
    .prepare('SELECT id, username, email, status FROM users WHERE id = ?')
    .bind(userId)
    .first<any>()

  if (!targetUser) {
    throw Errors.notFound('User not found')
  }

  if (targetUser.status === 'suspended') {
    throw Errors.conflict('User is already suspended')
  }

  const previousStatus = targetUser.status

  // UPDATE user
  await db
    .prepare(
      `UPDATE users SET status = 'suspended', updated_at = datetime('now') WHERE id = ?`
    )
    .bind(userId)
    .run()

  // SELECT updated user
  const suspendedUser = await db
    .prepare(
      `SELECT id, username, email, status, updated_at as suspendedAt FROM users WHERE id = ?`
    )
    .bind(userId)
    .first<any>()

  // Log to activity_log
  const logId = crypto.randomUUID()
  const metadata = JSON.stringify({
    reason: body.reason || null,
    previous_status: previousStatus,
  })

  await db
    .prepare(
      `INSERT INTO activity_log (id, user_id, action, entity_type, entity_id, metadata, created_at)
       VALUES (?, ?, 'user_suspended', 'user', ?, ?, datetime('now'))`
    )
    .bind(logId, adminUser.userId, userId, metadata)
    .run()

  return c.json({
    data: {
      id: suspendedUser?.id,
      username: suspendedUser?.username,
      email: suspendedUser?.email,
      status: suspendedUser?.status,
      suspendedAt: suspendedUser?.suspendedAt,
      suspendedBy: adminUser.userId,
      suspendReason: body.reason || null,
    },
  })
})

/**
 * POST /api/admin/users/:id/activate
 * Activate a suspended user account
 */
adminUsers.post('/:id/activate', async (c) => {
  const db = c.env.DB
  const userId = c.req.param('id')
  const adminUser = getCurrentUser(c)

  if (!adminUser) {
    throw Errors.unauthorized('Authentication required')
  }

  // Parse optional body
  let body: Record<string, any> = {}
  const contentType = c.req.header('content-type')
  if (contentType && contentType.includes('application/json')) {
    try {
      body = await c.req.json()
    } catch {
      // Ignore parse errors, body remains empty
    }
  }

  // Validate reason if provided
  if (body.reason !== undefined) {
    if (typeof body.reason !== 'string') {
      throw Errors.badRequest('reason must be a string')
    }
    const trimmedReason = body.reason.trim()
    if (trimmedReason.length === 0 || trimmedReason.length > 1000) {
      throw Errors.badRequest('reason must be between 1 and 1000 characters')
    }
  }

  // Check target user
  const targetUser = await db
    .prepare('SELECT id, username, email, status FROM users WHERE id = ?')
    .bind(userId)
    .first<any>()

  if (!targetUser) {
    throw Errors.notFound('User not found')
  }

  if (targetUser.status === 'active') {
    throw Errors.conflict('User is already active')
  }

  const previousStatus = targetUser.status

  // UPDATE user
  await db
    .prepare(
      `UPDATE users SET status = 'active', updated_at = datetime('now') WHERE id = ?`
    )
    .bind(userId)
    .run()

  // SELECT updated user
  const activatedUser = await db
    .prepare(
      `SELECT id, username, email, status, updated_at as activatedAt FROM users WHERE id = ?`
    )
    .bind(userId)
    .first<any>()

  // Log to activity_log
  const logId = crypto.randomUUID()
  const metadata = JSON.stringify({
    reason: body.reason || null,
    previous_status: previousStatus,
  })

  await db
    .prepare(
      `INSERT INTO activity_log (id, user_id, action, entity_type, entity_id, metadata, created_at)
       VALUES (?, ?, 'user_activated', 'user', ?, ?, datetime('now'))`
    )
    .bind(logId, adminUser.userId, userId, metadata)
    .run()

  return c.json({
    data: {
      id: activatedUser?.id,
      username: activatedUser?.username,
      email: activatedUser?.email,
      status: activatedUser?.status,
      activatedAt: activatedUser?.activatedAt,
      activatedBy: adminUser.userId,
      activationReason: body.reason || null,
    },
  })
})

export { adminUsers }
