import { Hono } from 'hono'
import type { HonoEnv } from '../../../types/env'
import { Errors } from '../errors'
import { requireAuth, getCurrentUser } from '../middleware/auth'
import { validateGalleryCreate, validateGalleryUpdate } from '../../validation/galleries'

const galleries = new Hono<HonoEnv>()

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 50)
}

/**
 * Helper: Generate unique slug, optionally excluding current gallery
 */
async function generateUniqueSlug(
  db: any,
  name: string,
  userId: string,
  excludeGalleryId?: string
): Promise<string> {
  const baseSlug = generateSlug(name)
  let slug = baseSlug
  let counter = 1

  while (true) {
    const existing = await db
      .prepare('SELECT id FROM galleries WHERE user_id = ? AND slug = ? AND id != ?')
      .bind(userId, slug, excludeGalleryId || '')
      .first()
    if (!existing) break
    slug = `${baseSlug}-${counter}`
    counter++
  }

  return slug
}

/**
 * Helper: Format gallery row from DB to API response
 */
function formatGallery(row: any): Record<string, any> {
  return {
    id: row.id,
    userId: row.user_id,
    slug: row.slug,
    name: row.name,
    description: row.description || null,
    welcomeMessage: row.welcome_message || null,
    themeId: row.theme_id || null,
    isDefault: row.is_default === 1 || row.is_default === true,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/**
 * POST /api/galleries
 * Create gallery
 */
galleries.post('/', requireAuth, async (c) => {
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

  const validationErrors = validateGalleryCreate(body)
  if (validationErrors.length > 0) {
    throw Errors.badRequest(validationErrors[0].message)
  }

  const data = body as Record<string, unknown>
  const db = c.env.DB

  // Check gallery count
  const countRow = await db
    .prepare("SELECT COUNT(*) as count FROM galleries WHERE user_id = ? AND status != 'deleted'")
    .bind(authUser.userId)
    .first<{ count: number }>()

  const galleryCount = countRow?.count || 0
  if (galleryCount >= 500) {
    throw Errors.badRequest('Gallery limit exceeded')
  }

  // Generate unique slug
  const slug = await generateUniqueSlug(db, data.name as string, authUser.userId)

  const galleryId = crypto.randomUUID()
  const now = new Date().toISOString()

  await db
    .prepare(
      `INSERT INTO galleries
       (id, user_id, slug, name, description, welcome_message, theme_id, is_default, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      galleryId,
      authUser.userId,
      slug,
      data.name as string,
      (data.description as string) || null,
      (data.welcomeMessage as string) || null,
      null,
      0,
      'active',
      now,
      now,
    )
    .run()

  // Bootstrap creator role
  await db
    .prepare(
      `INSERT INTO gallery_roles (gallery_id, user_id, role, granted_at, granted_by)
       VALUES (?, ?, 'creator', ?, NULL)`
    )
    .bind(galleryId, authUser.userId, now)
    .run()

  // Fetch and return the new gallery
  const newGallery = await db
    .prepare('SELECT * FROM galleries WHERE id = ?')
    .bind(galleryId)
    .first<any>()

  return c.json(formatGallery(newGallery), 201)
})

/**
 * GET /api/galleries
 * List user's galleries
 */
galleries.get('/', requireAuth, async (c) => {
  const authUser = getCurrentUser(c)
  if (!authUser) {
    throw Errors.unauthorized()
  }

  const page = Math.max(1, parseInt(c.req.query('page') || '1', 10))
  const pageSize = Math.min(100, Math.max(1, parseInt(c.req.query('pageSize') || '20', 10)))
  const status = c.req.query('status')

  const db = c.env.DB
  const offset = (page - 1) * pageSize

  // Build WHERE clause
  let whereConditions = 'WHERE user_id = ?'
  const bindings: any[] = [authUser.userId]

  if (status) {
    whereConditions += ' AND status = ?'
    bindings.push(status)
  }

  // Get total count
  const countQuery = `SELECT COUNT(*) as total FROM galleries ${whereConditions}`
  const countRow = await db.prepare(countQuery).bind(...bindings).first<{ total: number }>()
  const total = countRow?.total || 0
  const totalPages = Math.ceil(total / pageSize)

  // Get paginated data with collection count
  const dataQuery = `
    SELECT g.*, COUNT(c.id) as collection_count
    FROM galleries g
    LEFT JOIN collections c ON c.gallery_id = g.id
    ${whereConditions}
    GROUP BY g.id
    ORDER BY g.is_default DESC, g.created_at DESC
    LIMIT ? OFFSET ?
  `
  const rows = await db
    .prepare(dataQuery)
    .bind(...bindings, pageSize, offset)
    .all<any>()

  const data = (rows.results || []).map((row: any) => {
    const formatted = formatGallery(row)
    return {
      ...formatted,
      collectionCount: row.collection_count,
    }
  })

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
 * GET /api/galleries/:id
 * Get gallery detail with collections and theme
 */
galleries.get('/:id', requireAuth, async (c) => {
  const galleryId = c.req.param('id')
  const authUser = getCurrentUser(c)
  if (!authUser) {
    throw Errors.unauthorized()
  }

  const db = c.env.DB

  // Fetch gallery
  const gallery = await db
    .prepare('SELECT * FROM galleries WHERE id = ?')
    .bind(galleryId)
    .first<any>()

  if (!gallery) {
    throw Errors.notFound('Gallery')
  }

  // Authorization: check ownership
  if (gallery.user_id !== authUser.userId) {
    throw Errors.notFound('Gallery')
  }

  // Fetch collections for this gallery
  const collectionsQuery = `
    SELECT c.*, COUNT(ca.artwork_id) as artwork_count
    FROM collections c
    LEFT JOIN collection_artworks ca ON ca.collection_id = c.id
    WHERE c.gallery_id = ?
    GROUP BY c.id
    ORDER BY c.is_default DESC, c.created_at ASC
  `
  const collectionsResult = await db
    .prepare(collectionsQuery)
    .bind(galleryId)
    .all<any>()

  const collections = (collectionsResult.results || []).map((col: any) => ({
    id: col.id,
    galleryId: col.gallery_id,
    slug: col.slug,
    name: col.name,
    description: col.description || null,
    artworkCount: col.artwork_count,
    isDefault: col.is_default === 1 || col.is_default === true,
    status: col.status,
    createdAt: col.created_at,
    updatedAt: col.updated_at,
  }))

  // Fetch theme if present
  let theme = null
  if (gallery.theme_id) {
    const themeRow = await db
      .prepare('SELECT id, name, config FROM themes WHERE id = ?')
      .bind(gallery.theme_id)
      .first<any>()
    if (themeRow) {
      theme = {
        id: themeRow.id,
        name: themeRow.name,
        config: themeRow.config ? JSON.parse(themeRow.config) : null,
      }
    }
  }

  const formatted = formatGallery(gallery)
  return c.json({
    ...formatted,
    collections,
    ...(theme && { theme }),
  })
})

/**
 * PATCH /api/galleries/:id
 * Update gallery
 */
galleries.patch('/:id', requireAuth, async (c) => {
  const galleryId = c.req.param('id')
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

  const validationErrors = validateGalleryUpdate(body)
  if (validationErrors.length > 0) {
    throw Errors.badRequest(validationErrors[0].message)
  }

  const data = body as Record<string, unknown>
  const db = c.env.DB

  // Fetch gallery
  const gallery = await db
    .prepare('SELECT * FROM galleries WHERE id = ?')
    .bind(galleryId)
    .first<any>()

  if (!gallery) {
    throw Errors.notFound('Gallery')
  }

  // Authorization
  if (gallery.user_id !== authUser.userId) {
    throw Errors.forbidden('You can only update your own gallery')
  }

  // Map camelCase to snake_case for DB
  const fieldMap: Record<string, string> = {
    name: 'name',
    description: 'description',
    welcomeMessage: 'welcome_message',
    themeId: 'theme_id',
    status: 'status',
  }

  // Build dynamic SET clause from provided fields
  const setClauses: string[] = []
  const bindValues: any[] = []

  for (const [field, dbField] of Object.entries(fieldMap)) {
    if (field in data) {
      setClauses.push(`${dbField} = ?`)
      bindValues.push(data[field] || null)
    }
  }

  if (setClauses.length === 0) {
    throw Errors.badRequest('No valid fields to update')
  }

  // Handle slug regeneration if name changed
  let newSlug = gallery.slug
  if ('name' in data && data.name !== gallery.name) {
    newSlug = await generateUniqueSlug(db, data.name as string, authUser.userId, galleryId)
    setClauses.push('slug = ?')
    bindValues.push(newSlug)
  }

  // Verify theme exists if provided and not null
  if ('themeId' in data && data.themeId !== null) {
    const theme = await db
      .prepare('SELECT id FROM themes WHERE id = ?')
      .bind(data.themeId as string)
      .first()
    if (!theme) {
      throw Errors.badRequest('Theme not found')
    }
  }

  // Add updated_at
  const now = new Date().toISOString()
  setClauses.push('updated_at = ?')
  bindValues.push(now)

  // Add gallery ID to bind values
  bindValues.push(galleryId)

  // Execute update
  const updateQuery = `UPDATE galleries SET ${setClauses.join(', ')} WHERE id = ?`
  await db.prepare(updateQuery).bind(...bindValues).run()

  // Fetch updated gallery
  const updated = await db
    .prepare('SELECT * FROM galleries WHERE id = ?')
    .bind(galleryId)
    .first<any>()

  return c.json(formatGallery(updated))
})

/**
 * DELETE /api/galleries/:id
 * Delete gallery
 */
galleries.delete('/:id', requireAuth, async (c) => {
  const galleryId = c.req.param('id')
  const authUser = getCurrentUser(c)
  if (!authUser) {
    throw Errors.unauthorized()
  }

  const db = c.env.DB

  // Fetch gallery
  const gallery = await db
    .prepare('SELECT * FROM galleries WHERE id = ?')
    .bind(galleryId)
    .first<any>()

  if (!gallery) {
    throw Errors.notFound('Gallery')
  }

  // Authorization
  if (gallery.user_id !== authUser.userId) {
    throw Errors.forbidden('You can only delete your own gallery')
  }

  // Check if default
  if (gallery.is_default === 1 || gallery.is_default === true) {
    throw Errors.badRequest('Cannot delete the default gallery')
  }

  // Delete gallery (CASCADE handles collections)
  await db
    .prepare('DELETE FROM galleries WHERE id = ?')
    .bind(galleryId)
    .run()

  return c.json({
    success: true,
  })
})

/**
 * GET /api/galleries/:id/roles
 * List gallery roles (owner only)
 */
galleries.get('/:id/roles', requireAuth, async (c) => {
  const galleryId = c.req.param('id')
  const authUser = getCurrentUser(c)
  if (!authUser) throw Errors.unauthorized()

  const db = c.env.DB

  const gallery = await db
    .prepare('SELECT id, user_id FROM galleries WHERE id = ?')
    .bind(galleryId)
    .first<{ id: string; user_id: string }>()

  if (!gallery) throw Errors.notFound('Gallery')
  if (gallery.user_id !== authUser.userId) throw Errors.forbidden('Only the gallery owner can view roles')

  const result = await db
    .prepare(
      `SELECT gr.user_id, gr.role, gr.granted_at, gr.granted_by,
              u.username, u.display_name, u.avatar_url
       FROM gallery_roles gr
       JOIN users u ON u.id = gr.user_id
       WHERE gr.gallery_id = ?
       ORDER BY CASE gr.role WHEN 'creator' THEN 0 ELSE 1 END, gr.granted_at DESC`
    )
    .bind(galleryId)
    .all<any>()

  const data = (result.results || []).map((row: any) => ({
    userId: row.user_id,
    username: row.username,
    displayName: row.display_name || null,
    avatarUrl: row.avatar_url || null,
    role: row.role,
    grantedAt: row.granted_at,
    grantedBy: row.granted_by || null,
  }))

  return c.json({ data })
})

/**
 * POST /api/galleries/:id/roles
 * Add admin role (owner only)
 */
galleries.post('/:id/roles', requireAuth, async (c) => {
  const galleryId = c.req.param('id')
  const authUser = getCurrentUser(c)
  if (!authUser) throw Errors.unauthorized()

  let body: any
  try {
    body = await c.req.json()
  } catch {
    throw Errors.badRequest('Invalid JSON body')
  }

  if (!body.username) throw Errors.badRequest('Username is required')
  if (!body.role || body.role !== 'admin') throw Errors.badRequest('Role must be "admin"')

  const db = c.env.DB

  const gallery = await db
    .prepare('SELECT id, user_id FROM galleries WHERE id = ?')
    .bind(galleryId)
    .first<{ id: string; user_id: string }>()

  if (!gallery) throw Errors.notFound('Gallery')
  if (gallery.user_id !== authUser.userId) throw Errors.forbidden('Only the gallery owner can assign roles')

  // Look up target user
  const targetUser = await db
    .prepare('SELECT id, username, display_name, avatar_url FROM users WHERE username = ?')
    .bind(body.username.trim())
    .first<{ id: string; username: string; display_name: string | null; avatar_url: string | null }>()

  if (!targetUser) throw Errors.notFound('User')

  // Prevent self-assignment
  if (targetUser.id === authUser.userId) throw Errors.badRequest('You cannot assign roles to yourself')

  // Check for existing role
  const existing = await db
    .prepare('SELECT role FROM gallery_roles WHERE gallery_id = ? AND user_id = ?')
    .bind(galleryId, targetUser.id)
    .first<{ role: string }>()

  if (existing) throw Errors.conflict(`User already has role "${existing.role}" in this gallery`)

  const now = new Date().toISOString()

  await db
    .prepare(
      `INSERT INTO gallery_roles (gallery_id, user_id, role, granted_at, granted_by)
       VALUES (?, ?, ?, ?, ?)`
    )
    .bind(galleryId, targetUser.id, body.role, now, authUser.userId)
    .run()

  return c.json({
    data: {
      userId: targetUser.id,
      username: targetUser.username,
      displayName: targetUser.display_name || null,
      avatarUrl: targetUser.avatar_url || null,
      role: body.role,
      grantedAt: now,
      grantedBy: authUser.userId,
    },
  }, 201)
})

/**
 * DELETE /api/galleries/:id/roles/:userId
 * Remove role (owner only)
 */
galleries.delete('/:id/roles/:userId', requireAuth, async (c) => {
  const galleryId = c.req.param('id')
  const targetUserId = c.req.param('userId')
  const authUser = getCurrentUser(c)
  if (!authUser) throw Errors.unauthorized()

  const db = c.env.DB

  const gallery = await db
    .prepare('SELECT id, user_id FROM galleries WHERE id = ?')
    .bind(galleryId)
    .first<{ id: string; user_id: string }>()

  if (!gallery) throw Errors.notFound('Gallery')
  if (gallery.user_id !== authUser.userId) throw Errors.forbidden('Only the gallery owner can remove roles')

  const role = await db
    .prepare('SELECT role FROM gallery_roles WHERE gallery_id = ? AND user_id = ?')
    .bind(galleryId, targetUserId)
    .first<{ role: string }>()

  if (!role) throw Errors.notFound('Role')
  if (role.role === 'creator') throw Errors.badRequest('Cannot remove the creator role from a gallery')

  await db
    .prepare('DELETE FROM gallery_roles WHERE gallery_id = ? AND user_id = ?')
    .bind(galleryId, targetUserId)
    .run()

  return c.json({ message: 'Role removed successfully' })
})

/**
 * GET /api/galleries/:id/delete-info
 * Get pre-delete information
 */
galleries.get('/:id/delete-info', requireAuth, async (c) => {
  const galleryId = c.req.param('id')
  const authUser = getCurrentUser(c)
  if (!authUser) {
    throw Errors.unauthorized()
  }

  const db = c.env.DB

  // Fetch gallery
  const gallery = await db
    .prepare('SELECT * FROM galleries WHERE id = ?')
    .bind(galleryId)
    .first<any>()

  if (!gallery) {
    throw Errors.notFound('Gallery')
  }

  // Authorization
  if (gallery.user_id !== authUser.userId) {
    throw Errors.notFound('Gallery')
  }

  // Count collections
  const collectionCountRow = await db
    .prepare('SELECT COUNT(*) as count FROM collections WHERE gallery_id = ?')
    .bind(galleryId)
    .first<{ count: number }>()

  const collectionCount = collectionCountRow?.count || 0

  // Count artworks in those collections
  const artworkCountRow = await db
    .prepare(
      `SELECT COUNT(DISTINCT ca.artwork_id) as count
       FROM collection_artworks ca
       JOIN collections c ON c.id = ca.collection_id
       WHERE c.gallery_id = ?`
    )
    .bind(galleryId)
    .first<{ count: number }>()

  const artworkCount = artworkCountRow?.count || 0

  const isDefault = gallery.is_default === 1 || gallery.is_default === true
  const canDelete = !isDefault

  return c.json({
    galleryId,
    galleryName: gallery.name,
    collectionCount,
    artworkCount,
    canDelete,
    reason: isDefault ? 'Cannot delete the default gallery' : null,
  })
})

export { galleries }
