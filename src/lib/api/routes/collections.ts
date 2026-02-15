import { Hono } from 'hono'
import type { HonoEnv } from '../../../types/env'
import { Errors } from '../errors'
import { requireAuth, optionalAuth, getCurrentUser } from '../middleware/auth'
import { validateCollectionCreate, validateCollectionUpdate } from '../../validation/collections'
import { getThumbnailUrl, getIconUrl, getDisplayUrl } from '../../utils/imageUrls'

const collections = new Hono<HonoEnv>()

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
 * Helper: Generate unique slug, scoped to gallery, optionally excluding current collection
 */
async function generateUniqueSlug(
  db: any,
  name: string,
  galleryId: string,
  excludeCollectionId?: string
): Promise<string> {
  const baseSlug = generateSlug(name)
  let slug = baseSlug
  let counter = 1

  while (true) {
    const existing = await db
      .prepare('SELECT id FROM collections WHERE gallery_id = ? AND slug = ? AND id != ?')
      .bind(galleryId, slug, excludeCollectionId || '')
      .first()
    if (!existing) break
    slug = `${baseSlug}-${counter}`
    counter++
  }

  return slug
}

/**
 * Helper: Format collection row from DB to API response
 */
function formatCollection(row: any): Record<string, any> {
  return {
    id: row.id,
    galleryId: row.gallery_id,
    slug: row.slug,
    name: row.name,
    description: row.description || null,
    heroImageUrl: row.hero_image_url || null,
    themeId: row.theme_id || null,
    isDefault: row.is_default === 1 || row.is_default === true,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/**
 * Helper: Format artwork summary (used within collection detail)
 */
function formatArtworkSummary(row: any): Record<string, any> {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description || null,
    imageKey: row.image_key,
    thumbnailUrl: row.image_key ? getThumbnailUrl(row.image_key) : null,
    iconUrl: row.image_key ? getIconUrl(row.image_key) : null,
    displayUrl: row.image_key ? getDisplayUrl(row.image_key) : null,
    createdAt: row.created_at,
  }
}

/**
 * Helper: Verify gallery ownership
 */
async function verifyGalleryOwnership(db: any, galleryId: string, userId: string): Promise<any> {
  const gallery = await db
    .prepare('SELECT * FROM galleries WHERE id = ?')
    .bind(galleryId)
    .first<any>()

  if (!gallery || gallery.user_id !== userId) {
    throw Errors.notFound('Gallery')
  }

  return gallery
}

/**
 * Helper: Verify collection ownership
 */
async function verifyCollectionOwnership(
  db: any,
  collectionId: string,
  userId: string
): Promise<{ collection: any; gallery: any }> {
  const collection = await db
    .prepare('SELECT * FROM collections WHERE id = ?')
    .bind(collectionId)
    .first<any>()

  if (!collection) {
    throw Errors.notFound('Collection')
  }

  const gallery = await db
    .prepare('SELECT * FROM galleries WHERE id = ?')
    .bind(collection.gallery_id)
    .first<any>()

  if (!gallery || gallery.user_id !== userId) {
    throw Errors.notFound('Collection')
  }

  return { collection, gallery }
}

/**
 * POST /api/galleries/:galleryId/collections
 * Create collection
 */
collections.post('/galleries/:galleryId/collections', requireAuth, async (c) => {
  const authUser = getCurrentUser(c)
  if (!authUser) {
    throw Errors.unauthorized()
  }

  const galleryId = c.req.param('galleryId')

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    throw Errors.badRequest('Invalid JSON body')
  }

  const validationErrors = validateCollectionCreate(body)
  if (validationErrors.length > 0) {
    throw Errors.badRequest(validationErrors[0].message)
  }

  const data = body as Record<string, unknown>
  const db = c.env.DB

  // Verify gallery ownership
  await verifyGalleryOwnership(db, galleryId, authUser.userId)

  // Check collection count limit: 1000 per user across all galleries
  const countRow = await db
    .prepare(
      "SELECT COUNT(*) as count FROM collections c JOIN galleries g ON c.gallery_id = g.id WHERE g.user_id = ? AND c.status != 'deleted'"
    )
    .bind(authUser.userId)
    .first<{ count: number }>()

  const collectionCount = countRow?.count || 0
  if (collectionCount >= 1000) {
    throw Errors.badRequest('Collection limit exceeded')
  }

  // Generate unique slug (scoped to gallery)
  const slug = await generateUniqueSlug(db, data.name as string, galleryId)

  const collectionId = crypto.randomUUID()
  const now = new Date().toISOString()

  await db
    .prepare(
      `INSERT INTO collections
       (id, gallery_id, slug, name, description, hero_image_url, theme_id, is_default, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      collectionId,
      galleryId,
      slug,
      data.name as string,
      (data.description as string) || null,
      null,
      null,
      0,
      'active',
      now,
      now
    )
    .run()

  // Fetch and return the new collection
  const newCollection = await db
    .prepare('SELECT * FROM collections WHERE id = ?')
    .bind(collectionId)
    .first<any>()

  return c.json(formatCollection(newCollection), 201)
})

/**
 * GET /api/galleries/:galleryId/collections
 * List collections in a gallery
 */
collections.get('/galleries/:galleryId/collections', optionalAuth, async (c) => {
  const galleryId = c.req.param('galleryId')
  const authUser = getCurrentUser(c)

  const page = Math.max(1, parseInt(c.req.query('page') || '1', 10))
  const pageSize = Math.min(100, Math.max(1, parseInt(c.req.query('pageSize') || '20', 10)))
  const status = c.req.query('status')

  const db = c.env.DB
  const offset = (page - 1) * pageSize

  // Fetch gallery to verify it exists
  const gallery = await db
    .prepare('SELECT * FROM galleries WHERE id = ?')
    .bind(galleryId)
    .first<any>()

  if (!gallery) {
    throw Errors.notFound('Gallery')
  }

  const isOwner = authUser && authUser.userId === gallery.user_id

  // Build WHERE clause
  let whereConditions = 'WHERE c.gallery_id = ?'
  const bindings: any[] = [galleryId]

  // Non-owners see only active collections
  if (!isOwner) {
    whereConditions += " AND c.status = 'active'"
  } else if (status) {
    // Owner can filter by status
    whereConditions += ' AND c.status = ?'
    bindings.push(status)
  }

  // Get total count
  const countQuery = `SELECT COUNT(*) as total FROM collections c ${whereConditions}`
  const countRow = await db.prepare(countQuery).bind(...bindings).first<{ total: number }>()
  const total = countRow?.total || 0
  const totalPages = Math.ceil(total / pageSize)

  // Get paginated data with artwork count
  const dataQuery = `
    SELECT c.*, COUNT(ca.artwork_id) as artwork_count
    FROM collections c
    LEFT JOIN collection_artworks ca ON ca.collection_id = c.id
    ${whereConditions}
    GROUP BY c.id
    ORDER BY c.is_default DESC, c.created_at ASC
    LIMIT ? OFFSET ?
  `
  const rows = await db
    .prepare(dataQuery)
    .bind(...bindings, pageSize, offset)
    .all<any>()

  const data = (rows.results || []).map((row: any) => {
    const formatted = formatCollection(row)
    return {
      ...formatted,
      artworkCount: row.artwork_count,
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
 * GET /api/collections/:id
 * Get collection detail with artworks
 */
collections.get('/collections/:id', optionalAuth, async (c) => {
  const collectionId = c.req.param('id')
  const authUser = getCurrentUser(c)

  const db = c.env.DB

  // Fetch collection
  const collection = await db
    .prepare('SELECT * FROM collections WHERE id = ?')
    .bind(collectionId)
    .first<any>()

  if (!collection) {
    throw Errors.notFound('Collection')
  }

  // Fetch gallery
  const gallery = await db
    .prepare('SELECT * FROM galleries WHERE id = ?')
    .bind(collection.gallery_id)
    .first<any>()

  if (!gallery) {
    throw Errors.notFound('Gallery')
  }

  const isOwner = authUser && authUser.userId === gallery.user_id

  // Non-owner can only see active collections
  if (!isOwner && collection.status !== 'active') {
    throw Errors.notFound('Collection')
  }

  // Fetch artworks in collection
  const artworksQuery = `
    SELECT ca.position, ca.added_at, a.*
    FROM collection_artworks ca
    JOIN artworks a ON a.id = ca.artwork_id
    WHERE ca.collection_id = ?
    ORDER BY ca.position ASC, ca.added_at DESC
  `
  const artworksResult = await db
    .prepare(artworksQuery)
    .bind(collectionId)
    .all<any>()

  const artworks = (artworksResult.results || []).map((row: any) => ({
    position: row.position,
    addedAt: row.added_at,
    artwork: formatArtworkSummary(row),
  }))

  // Fetch theme if present
  let theme = null
  if (collection.theme_id) {
    const themeRow = await db
      .prepare('SELECT id, name, config FROM themes WHERE id = ?')
      .bind(collection.theme_id)
      .first<any>()
    if (themeRow) {
      theme = {
        id: themeRow.id,
        name: themeRow.name,
        config: themeRow.config ? JSON.parse(themeRow.config) : null,
      }
    }
  }

  const formatted = formatCollection(collection)
  return c.json({
    ...formatted,
    artworks,
    ...(theme && { theme }),
  })
})

/**
 * PATCH /api/collections/:id
 * Update collection
 */
collections.patch('/collections/:id', requireAuth, async (c) => {
  const collectionId = c.req.param('id')
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

  const validationErrors = validateCollectionUpdate(body)
  if (validationErrors.length > 0) {
    throw Errors.badRequest(validationErrors[0].message)
  }

  const data = body as Record<string, unknown>
  const db = c.env.DB

  // Verify collection ownership
  const { collection, gallery } = await verifyCollectionOwnership(db, collectionId, authUser.userId)

  // Map camelCase to snake_case for DB
  const fieldMap: Record<string, string> = {
    name: 'name',
    description: 'description',
    heroImageUrl: 'hero_image_url',
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
  let newSlug = collection.slug
  if ('name' in data && data.name !== collection.name) {
    newSlug = await generateUniqueSlug(db, data.name as string, collection.gallery_id, collectionId)
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

  // Add collection ID to bind values
  bindValues.push(collectionId)

  // Execute update
  const updateQuery = `UPDATE collections SET ${setClauses.join(', ')} WHERE id = ?`
  await db.prepare(updateQuery).bind(...bindValues).run()

  // Fetch updated collection
  const updated = await db
    .prepare('SELECT * FROM collections WHERE id = ?')
    .bind(collectionId)
    .first<any>()

  return c.json(formatCollection(updated))
})

/**
 * DELETE /api/collections/:id
 * Delete collection
 */
collections.delete('/collections/:id', requireAuth, async (c) => {
  const collectionId = c.req.param('id')
  const authUser = getCurrentUser(c)
  if (!authUser) {
    throw Errors.unauthorized()
  }

  const db = c.env.DB

  // Verify collection ownership
  const { collection } = await verifyCollectionOwnership(db, collectionId, authUser.userId)

  // Check if default
  if (collection.is_default === 1 || collection.is_default === true) {
    throw Errors.badRequest('Cannot delete the default collection')
  }

  // Delete collection (CASCADE handles collection_artworks)
  await db
    .prepare('DELETE FROM collections WHERE id = ?')
    .bind(collectionId)
    .run()

  return c.json({
    success: true,
  })
})

/**
 * POST /api/collections/:id/copy
 * Copy collection to another gallery
 */
collections.post('/collections/:id/copy', requireAuth, async (c) => {
  const collectionId = c.req.param('id')
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
  if (!data.galleryId || typeof data.galleryId !== 'string') {
    throw Errors.badRequest('Gallery ID is required')
  }

  const targetGalleryId = data.galleryId as string
  const db = c.env.DB

  // Verify user owns source collection (via its gallery)
  const { collection, gallery: sourceGallery } = await verifyCollectionOwnership(
    db,
    collectionId,
    authUser.userId
  )

  // Verify user owns target gallery
  const targetGallery = await verifyGalleryOwnership(db, targetGalleryId, authUser.userId)

  // Check collection limit
  const countRow = await db
    .prepare(
      "SELECT COUNT(*) as count FROM collections c JOIN galleries g ON c.gallery_id = g.id WHERE g.user_id = ? AND c.status != 'deleted'"
    )
    .bind(authUser.userId)
    .first<{ count: number }>()

  const collectionCount = countRow?.count || 0
  if (collectionCount >= 1000) {
    throw Errors.badRequest('Collection limit exceeded')
  }

  // Generate new name and slug
  const newName = `${collection.name} (Copy)`
  const slug = await generateUniqueSlug(db, newName, targetGalleryId)

  const newCollectionId = crypto.randomUUID()
  const now = new Date().toISOString()

  // Insert new collection (copy name, description; not heroImageUrl, themeId)
  await db
    .prepare(
      `INSERT INTO collections
       (id, gallery_id, slug, name, description, hero_image_url, theme_id, is_default, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      newCollectionId,
      targetGalleryId,
      slug,
      newName,
      collection.description || null,
      null,
      null,
      0,
      'active',
      now,
      now
    )
    .run()

  // Copy collection_artworks: only artworks owned by the user
  await db
    .prepare(
      `INSERT INTO collection_artworks (collection_id, artwork_id, position, added_at)
       SELECT ?, ca.artwork_id, ca.position, ?
       FROM collection_artworks ca
       JOIN artworks a ON a.id = ca.artwork_id
       WHERE ca.collection_id = ? AND a.user_id = ?`
    )
    .bind(newCollectionId, now, collectionId, authUser.userId)
    .run()

  // Fetch and return the new collection
  const newCollection = await db
    .prepare('SELECT * FROM collections WHERE id = ?')
    .bind(newCollectionId)
    .first<any>()

  return c.json(formatCollection(newCollection), 201)
})

// ─── Collection-Artwork Management ───────────────────────────────

/**
 * POST /collections/:id/artworks
 * Add an artwork to a collection
 */
collections.post('/collections/:id/artworks', requireAuth, async (c) => {
  const { id } = c.req.param()
  const authUser = getCurrentUser(c)
  if (!authUser) throw Errors.unauthorized()

  const db = c.env.DB
  const { collection } = await verifyCollectionOwnership(db, id, authUser.userId)

  const body = await c.req.json<{ artworkId?: string }>()
  if (!body.artworkId || typeof body.artworkId !== 'string') {
    throw Errors.badRequest('artworkId is required')
  }

  // Verify user owns the artwork
  const artwork = await db
    .prepare('SELECT id FROM artworks WHERE id = ? AND user_id = ?')
    .bind(body.artworkId, authUser.userId)
    .first<any>()

  if (!artwork) {
    throw Errors.notFound('Artwork')
  }

  // Check for duplicate
  const existing = await db
    .prepare('SELECT collection_id FROM collection_artworks WHERE collection_id = ? AND artwork_id = ?')
    .bind(id, body.artworkId)
    .first<any>()

  if (existing) {
    throw Errors.badRequest('Artwork is already in this collection')
  }

  // Get next position
  const maxPos = await db
    .prepare('SELECT MAX(position) as max_pos FROM collection_artworks WHERE collection_id = ?')
    .bind(id)
    .first<{ max_pos: number | null }>()

  const nextPosition = (maxPos?.max_pos ?? -1) + 1

  // Insert and update collection timestamp
  await db.batch([
    db
      .prepare('INSERT INTO collection_artworks (collection_id, artwork_id, position) VALUES (?, ?, ?)')
      .bind(id, body.artworkId, nextPosition),
    db
      .prepare('UPDATE collections SET updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .bind(id),
  ])

  return c.json({ success: true, position: nextPosition }, 201)
})

/**
 * DELETE /collections/:id/artworks/:artworkId
 * Remove an artwork from a collection
 */
collections.delete('/collections/:id/artworks/:artworkId', requireAuth, async (c) => {
  const { id, artworkId } = c.req.param()
  const authUser = getCurrentUser(c)
  if (!authUser) throw Errors.unauthorized()

  const db = c.env.DB
  await verifyCollectionOwnership(db, id, authUser.userId)

  // Verify artwork is in collection
  const entry = await db
    .prepare('SELECT collection_id FROM collection_artworks WHERE collection_id = ? AND artwork_id = ?')
    .bind(id, artworkId)
    .first<any>()

  if (!entry) {
    throw Errors.notFound('Artwork not found in this collection')
  }

  // Remove and re-compact positions
  await db
    .prepare('DELETE FROM collection_artworks WHERE collection_id = ? AND artwork_id = ?')
    .bind(id, artworkId)
    .run()

  // Re-number remaining positions sequentially
  const remaining = await db
    .prepare('SELECT artwork_id FROM collection_artworks WHERE collection_id = ? ORDER BY position ASC')
    .bind(id)
    .all<{ artwork_id: string }>()

  if (remaining.results.length > 0) {
    const updates = remaining.results.map((row, idx) =>
      db
        .prepare('UPDATE collection_artworks SET position = ? WHERE collection_id = ? AND artwork_id = ?')
        .bind(idx, id, row.artwork_id)
    )
    updates.push(
      db.prepare('UPDATE collections SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(id)
    )
    await db.batch(updates)
  } else {
    await db
      .prepare('UPDATE collections SET updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .bind(id)
      .run()
  }

  return c.json({ success: true, message: 'Artwork removed from collection' })
})

/**
 * PATCH /collections/:id/artworks/reorder
 * Reorder artworks in a collection
 */
collections.patch('/collections/:id/artworks/reorder', requireAuth, async (c) => {
  const { id } = c.req.param()
  const authUser = getCurrentUser(c)
  if (!authUser) throw Errors.unauthorized()

  const db = c.env.DB
  await verifyCollectionOwnership(db, id, authUser.userId)

  const body = await c.req.json<{ artworkIds?: string[] }>()
  if (!body.artworkIds || !Array.isArray(body.artworkIds)) {
    throw Errors.badRequest('artworkIds array is required')
  }

  // Get current artworks in collection
  const current = await db
    .prepare('SELECT artwork_id FROM collection_artworks WHERE collection_id = ?')
    .bind(id)
    .all<{ artwork_id: string }>()

  const currentIds = new Set(current.results.map((r) => r.artwork_id))
  const providedIds = new Set(body.artworkIds)

  // Validate: same count, no duplicates, all IDs match
  if (body.artworkIds.length !== currentIds.size) {
    throw Errors.badRequest(
      `Expected ${currentIds.size} artwork IDs, got ${body.artworkIds.length}`
    )
  }

  if (providedIds.size !== body.artworkIds.length) {
    throw Errors.badRequest('Duplicate artwork IDs are not allowed')
  }

  for (const artworkId of body.artworkIds) {
    if (!currentIds.has(artworkId)) {
      throw Errors.badRequest(`Artwork ${artworkId} is not in this collection`)
    }
  }

  // Atomic position update
  const updates = body.artworkIds.map((artworkId, idx) =>
    db
      .prepare('UPDATE collection_artworks SET position = ? WHERE collection_id = ? AND artwork_id = ?')
      .bind(idx, id, artworkId)
  )
  updates.push(
    db.prepare('UPDATE collections SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(id)
  )

  await db.batch(updates)

  return c.json({ success: true, message: 'Artworks reordered' })
})

export { collections }
