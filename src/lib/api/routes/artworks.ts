import { Hono } from 'hono'
import type { HonoEnv } from '../../../types/env'
import { Errors } from '../errors'
import { requireAuth, optionalAuth, getCurrentUser } from '../middleware/auth'
import { validateArtworkUpload, validateArtworkCreate, validateArtworkUpdate } from '../../validation/artworks'
import { getThumbnailUrl, getIconUrl, getDisplayUrl } from '../../utils/imageUrls'
import { checkNewAccountUploadLimit } from '../security/new-account-limits'
import { logActivity } from '../security/activity-logger'
import { checkRapidUploads, flagSuspiciousActivity } from '../security/suspicious-detection'

const artworks = new Hono<HonoEnv>()

function getFileExtension(contentType: string): string {
  const typeMap: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
  }
  return typeMap[contentType] || 'jpg'
}

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 50)
}

/**
 * Helper: Format artwork row from DB to API response
 */
function formatArtwork(row: any): Record<string, any> {
  return {
    id: row.id,
    userId: row.user_id,
    slug: row.slug,
    title: row.title,
    description: row.description || null,
    materials: row.materials || null,
    dimensions: row.dimensions || null,
    createdDate: row.created_date || null,
    category: row.category || 'other',
    tags: row.tags ? JSON.parse(row.tags) : [],
    imageKey: row.image_key,
    thumbnailUrl: getThumbnailUrl(row.image_key),
    iconUrl: getIconUrl(row.image_key),
    displayUrl: getDisplayUrl(row.image_key),
    isPublic: row.is_public === 1 || row.is_public === true,
    status: row.status,
    isFeatured: row.is_featured === 1 || row.is_featured === true,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/**
 * Helper: Generate unique slug, optionally excluding current artwork
 */
async function generateUniqueSlug(
  db: any,
  title: string,
  userId: string,
  excludeArtworkId?: string
): Promise<string> {
  const baseSlug = generateSlug(title)
  let slug = baseSlug
  let counter = 1

  while (true) {
    const existing = await db
      .prepare('SELECT id FROM artworks WHERE user_id = ? AND slug = ? AND id != ?')
      .bind(userId, slug, excludeArtworkId || '')
      .first()
    if (!existing) break
    slug = `${baseSlug}-${counter}`
    counter++
  }

  return slug
}

/**
 * POST /api/artworks/upload
 * Upload artwork image to R2
 */
artworks.post('/upload', requireAuth, async (c) => {
  const authUser = getCurrentUser(c)
  if (!authUser) {
    throw Errors.unauthorized()
  }

  let formData: FormData
  try {
    formData = await c.req.formData()
  } catch {
    throw Errors.badRequest('Invalid form data')
  }

  const file = formData.get('file')
  if (!file || !(file instanceof File)) {
    throw Errors.badRequest('File is required', { field: 'file' })
  }

  const validationErrors = validateArtworkUpload(file)
  if (validationErrors.length > 0) {
    throw Errors.badRequest('Invalid file', { errors: validationErrors })
  }

  const bucket = c.env.IMAGE_BUCKET
  if (!bucket) {
    throw Errors.internal('Image bucket not configured')
  }

  try {
    const uuid = crypto.randomUUID()
    const extension = getFileExtension(file.type)
    const key = `originals/${authUser.userId}/${uuid}.${extension}`

    const arrayBuffer = await file.arrayBuffer()

    await bucket.put(key, arrayBuffer, {
      httpMetadata: {
        contentType: file.type,
        cacheControl: 'public, max-age=31536000',
      },
    })

    const cdnUrl = `https://images.vfa.gallery/${key}`

    return c.json({
      key,
      cdnUrl,
      contentType: file.type,
      size: file.size,
    })
  } catch (err) {
    if (err instanceof Error) {
      console.error('[Artwork Upload] Error:', err.message)
    }
    throw Errors.internal('Failed to upload image')
  }
})

/**
 * POST /api/artworks
 * Create artwork record with uploaded image
 */
artworks.post('/', requireAuth, async (c) => {
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

  const validationErrors = validateArtworkCreate(body)
  if (validationErrors.length > 0) {
    throw Errors.badRequest('Validation failed', { errors: validationErrors })
  }

  const data = body as Record<string, unknown>
  const db = c.env.DB

  const bucket = c.env.IMAGE_BUCKET
  if (!bucket) {
    throw Errors.internal('Image bucket not configured')
  }

  const imageKey = data.imageKey as string
  const headResult = await bucket.head(imageKey)
  if (!headResult) {
    throw Errors.badRequest('Image not found in storage', { imageKey })
  }

  const userRow = await db
    .prepare('SELECT artwork_limit, created_at, (SELECT COUNT(*) FROM artworks WHERE user_id = ? AND status = ?) as artwork_count FROM users WHERE id = ?')
    .bind(authUser.userId, 'active', authUser.userId)
    .first<{ artwork_limit: number; artwork_count: number; created_at: string }>()

  if (!userRow) {
    throw Errors.notFound('User')
  }

  // New account upload limit check
  const limitCheck = await checkNewAccountUploadLimit(db, authUser.userId, userRow.created_at)
  if (limitCheck.limited) {
    return c.json({
      error: { code: 'RATE_LIMITED', message: limitCheck.reason },
    }, 429)
  }

  if (userRow.artwork_count >= userRow.artwork_limit) {
    throw Errors.rateLimited()
  }

  const slug = await generateUniqueSlug(db, data.title as string, authUser.userId)

  const artworkId = `art_${crypto.randomUUID().replace(/-/g, '').substring(0, 16)}`
  const now = new Date().toISOString()

  await db
    .prepare(
      `INSERT INTO artworks
       (id, user_id, slug, title, description, materials, dimensions,
        created_date, category, tags, image_key, is_public, status, is_featured,
        created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      artworkId,
      authUser.userId,
      slug,
      data.title as string,
      (data.description as string) || null,
      (data.materials as string) || null,
      (data.dimensions as string) || null,
      (data.createdDate as string) || null,
      (data.category as string) || 'other',
      data.tags ? JSON.stringify(data.tags) : null,
      imageKey,
      1,
      'active',
      0,
      now,
      now,
    )
    .run()

  // Log artwork creation
  await logActivity(db, c, {
    action: 'artwork_created',
    entityType: 'artwork',
    entityId: artworkId,
    metadata: { title: data.title as string },
  })

  // Check for suspicious rapid uploads
  const rapidCheck = await checkRapidUploads(db, authUser.userId)
  if (rapidCheck.detected) {
    await flagSuspiciousActivity(db, authUser.userId, 'rapid_uploads', 'high', {
      uploadCount: rapidCheck.count,
      timeWindow: '1 minute',
      threshold: 5,
    })
  }

  return c.json({
    id: artworkId,
    userId: authUser.userId,
    slug,
    title: data.title,
    description: data.description || null,
    materials: data.materials || null,
    dimensions: data.dimensions || null,
    createdDate: data.createdDate || null,
    category: data.category || 'other',
    tags: data.tags || [],
    imageKey,
    thumbnailUrl: getThumbnailUrl(imageKey),
    iconUrl: getIconUrl(imageKey),
    displayUrl: getDisplayUrl(imageKey),
    isPublic: true,
    status: 'active',
    isFeatured: false,
    createdAt: now,
    updatedAt: now,
  }, 201)
})

/**
 * GET /api/artworks
 * List artworks for authenticated user with pagination and filtering
 */
artworks.get('/', requireAuth, async (c) => {
  const authUser = getCurrentUser(c)
  if (!authUser) {
    throw Errors.unauthorized()
  }

  const page = Math.max(1, parseInt(c.req.query('page') || '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt(c.req.query('limit') || '20', 10)))
  const category = c.req.query('category')
  const status = c.req.query('status') || 'active'

  const db = c.env.DB
  const offset = (page - 1) * limit

  // Build WHERE clause
  let whereConditions = 'WHERE user_id = ? AND status = ?'
  const bindings: any[] = [authUser.userId, status]

  if (category) {
    whereConditions += ' AND LOWER(category) = LOWER(?)'
    bindings.push(category)
  }

  // Get total count
  const countQuery = `SELECT COUNT(*) as total FROM artworks ${whereConditions}`
  const countRow = await db.prepare(countQuery).bind(...bindings).first<{ total: number }>()
  const total = countRow?.total || 0
  const totalPages = Math.ceil(total / limit)

  // Get paginated data
  const dataQuery = `
    SELECT id, user_id, slug, title, description, materials, dimensions,
           created_date, category, tags, image_key, is_public, status, is_featured,
           created_at, updated_at
    FROM artworks
    ${whereConditions}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `
  const rows = await db
    .prepare(dataQuery)
    .bind(...bindings, limit, offset)
    .all<any>()

  const data = (rows.results || []).map(formatArtwork)

  return c.json({
    data,
    pagination: {
      page,
      pageSize: limit,
      total,
      totalPages,
    },
  })
})

/**
 * GET /api/artworks/:id
 * Get single artwork by ID
 */
artworks.get('/:id', optionalAuth, async (c) => {
  const artworkId = c.req.param('id')
  const authUser = getCurrentUser(c)
  const db = c.env.DB

  const include = c.req.query('include')

  const row = await db
    .prepare(
      `SELECT id, user_id, slug, title, description, materials, dimensions,
              created_date, category, tags, image_key, is_public, status, is_featured,
              created_at, updated_at
       FROM artworks
       WHERE id = ?`
    )
    .bind(artworkId)
    .first<any>()

  if (!row) {
    throw Errors.notFound('Artwork')
  }

  // Authorization check
  const isOwner = authUser?.userId === row.user_id
  const isActive = row.status === 'active'
  const isPublic = row.is_public === 1 || row.is_public === true

  if (row.status === 'deleted') {
    throw Errors.notFound('Artwork')
  }

  if (!isOwner && (!isActive || !isPublic)) {
    throw Errors.notFound('Artwork')
  }

  let result: any = formatArtwork(row)

  // Optional: include collections
  if (include === 'collections') {
    const collections = await db
      .prepare(
        `SELECT DISTINCT c.id, c.user_id, c.title, c.slug, c.description, c.is_public,
                c.created_at, c.updated_at
         FROM collections c
         JOIN collection_artworks ca ON c.id = ca.collection_id
         WHERE ca.artwork_id = ? AND c.status = 'active'
         ORDER BY c.created_at DESC`
      )
      .bind(artworkId)
      .all<any>()

    result.collections = (collections.results || []).map((col: any) => ({
      id: col.id,
      userId: col.user_id,
      title: col.title,
      slug: col.slug,
      description: col.description || null,
      isPublic: col.is_public === 1 || col.is_public === true,
      createdAt: col.created_at,
      updatedAt: col.updated_at,
    }))
  }

  return c.json(result)
})

/**
 * PATCH /api/artworks/:id
 * Update artwork metadata
 */
artworks.patch('/:id', requireAuth, async (c) => {
  const artworkId = c.req.param('id')
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

  // Fetch artwork
  const artwork = await db
    .prepare('SELECT * FROM artworks WHERE id = ?')
    .bind(artworkId)
    .first<any>()

  if (!artwork) {
    throw Errors.notFound('Artwork')
  }

  // Authorization
  if (artwork.user_id !== authUser.userId) {
    throw Errors.forbidden('You can only update your own artwork')
  }

  // Validate update fields
  const validationErrors = validateArtworkUpdate(data)
  if (validationErrors.length > 0) {
    throw Errors.badRequest('Validation failed', { errors: validationErrors })
  }

  // Allowed fields to update
  const allowedFields = ['title', 'description', 'materials', 'dimensions', 'createdDate', 'category', 'tags']
  const updateData: Record<string, any> = {}

  for (const field of allowedFields) {
    if (field in data) {
      updateData[field] = data[field]
    }
  }

  if (Object.keys(updateData).length === 0) {
    return c.json(formatArtwork(artwork))
  }

  // Map camelCase to snake_case for DB
  const fieldMap: Record<string, string> = {
    title: 'title',
    description: 'description',
    materials: 'materials',
    dimensions: 'dimensions',
    createdDate: 'created_date',
    category: 'category',
    tags: 'tags',
  }

  // Build dynamic SET clause
  const setClauses: string[] = []
  const bindValues: any[] = []

  for (const [field, dbField] of Object.entries(fieldMap)) {
    if (field in updateData) {
      const value = updateData[field]
      if (dbField === 'tags' && value !== null) {
        setClauses.push(`${dbField} = ?`)
        bindValues.push(JSON.stringify(value))
      } else {
        setClauses.push(`${dbField} = ?`)
        bindValues.push(value || null)
      }
    }
  }

  // Handle slug regeneration if title changed
  let newSlug = artwork.slug
  if ('title' in updateData && updateData.title !== artwork.title) {
    newSlug = await generateUniqueSlug(db, updateData.title as string, authUser.userId, artworkId)
    setClauses.push('slug = ?')
    bindValues.push(newSlug)
  }

  // Add updated_at
  const now = new Date().toISOString()
  setClauses.push('updated_at = ?')
  bindValues.push(now)

  // Add artwork ID to bind values
  bindValues.push(artworkId)

  // Execute update
  const updateQuery = `UPDATE artworks SET ${setClauses.join(', ')} WHERE id = ?`
  await db.prepare(updateQuery).bind(...bindValues).run()

  // Fetch updated artwork
  const updated = await db
    .prepare('SELECT * FROM artworks WHERE id = ?')
    .bind(artworkId)
    .first<any>()

  return c.json(formatArtwork(updated))
})

/**
 * DELETE /api/artworks/:id
 * Soft delete artwork
 */
artworks.delete('/:id', requireAuth, async (c) => {
  const artworkId = c.req.param('id')
  const authUser = getCurrentUser(c)
  if (!authUser) {
    throw Errors.unauthorized()
  }

  const db = c.env.DB

  // Fetch artwork
  const artwork = await db
    .prepare('SELECT * FROM artworks WHERE id = ?')
    .bind(artworkId)
    .first<any>()

  if (!artwork) {
    throw Errors.notFound('Artwork')
  }

  // Authorization
  if (artwork.user_id !== authUser.userId) {
    throw Errors.forbidden('You can only delete your own artwork')
  }

  // Already deleted
  if (artwork.status === 'deleted') {
    throw Errors.notFound('Artwork')
  }

  // Use batch for atomicity
  const now = new Date().toISOString()
  const batches = [
    db.prepare('UPDATE artworks SET status = ?, updated_at = ? WHERE id = ?')
      .bind('deleted', now, artworkId),
    db.prepare('DELETE FROM collection_artworks WHERE artwork_id = ?')
      .bind(artworkId),
    db.prepare('UPDATE users SET artwork_count = MAX(0, artwork_count - 1) WHERE id = ?')
      .bind(authUser.userId),
  ]

  await db.batch(batches)

  return c.json({
    success: true,
    message: 'Artwork deleted',
    id: artworkId,
  })
})

/**
 * POST /api/artworks/:id/replace-image
 * Replace artwork image
 */
artworks.post('/:id/replace-image', requireAuth, async (c) => {
  const artworkId = c.req.param('id')
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
  const newImageKey = data.imageKey as string
  const oldImageKey = data.oldImageKey as string | undefined

  if (!newImageKey || typeof newImageKey !== 'string') {
    throw Errors.badRequest('imageKey is required', { field: 'imageKey' })
  }

  // Validate image key format
  const imageKeyPattern = /^originals\/([a-zA-Z0-9_-]+)\/[a-f0-9-]{36}\.[a-z]+$/i
  if (!imageKeyPattern.test(newImageKey)) {
    throw Errors.badRequest('Invalid imageKey format', { imageKey: newImageKey })
  }

  // Extract userId from key and verify it matches authenticated user
  const keyParts = newImageKey.split('/')
  const keyUserId = keyParts[1]
  if (keyUserId !== authUser.userId) {
    throw Errors.forbidden('Image key does not match your user ID')
  }

  const db = c.env.DB
  const bucket = c.env.IMAGE_BUCKET
  if (!bucket) {
    throw Errors.internal('Image bucket not configured')
  }

  // Fetch artwork
  const artwork = await db
    .prepare('SELECT * FROM artworks WHERE id = ?')
    .bind(artworkId)
    .first<any>()

  if (!artwork) {
    throw Errors.notFound('Artwork')
  }

  // Authorization
  if (artwork.user_id !== authUser.userId) {
    throw Errors.forbidden('You can only update your own artwork')
  }

  // Verify new image exists in R2
  const headResult = await bucket.head(newImageKey)
  if (!headResult) {
    throw Errors.badRequest('Image not found in storage', { imageKey: newImageKey })
  }

  // Update artwork
  const now = new Date().toISOString()
  await db
    .prepare('UPDATE artworks SET image_key = ?, updated_at = ? WHERE id = ?')
    .bind(newImageKey, now, artworkId)
    .run()

  // Best-effort cleanup of old image
  if (oldImageKey) {
    try {
      await bucket.delete(oldImageKey)
    } catch (err) {
      console.warn('[Artwork Replace] Failed to delete old image:', oldImageKey, err)
    }
  }

  // Fetch updated artwork
  const updated = await db
    .prepare(
      `SELECT id, user_id, slug, title, description, materials, dimensions,
              created_date, category, tags, image_key, is_public, status, is_featured,
              created_at, updated_at
       FROM artworks
       WHERE id = ?`
    )
    .bind(artworkId)
    .first<any>()

  return c.json(formatArtwork(updated))
})

export { artworks }
