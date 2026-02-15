import { Hono } from 'hono'
import type { HonoEnv } from '../../../types/env'
import { Errors } from '../errors'
import { requireAuth, getCurrentUser } from '../middleware/auth'

const themes = new Hono<HonoEnv>()

/**
 * Helper: Format theme row from DB to API response
 */
function mapThemeRow(row: any) {
  return {
    id: row.id,
    name: row.name,
    description: row.description || null,
    createdBy: row.created_by,
    isSystem: row.is_system === 1 || row.is_system === true,
    isPublic: row.is_public === 1 || row.is_public === true,
    copiedFrom: row.copied_from || null,
    styles: row.styles ? JSON.parse(row.styles) : {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/**
 * GET /api/themes
 * List public/system themes (NO auth required)
 */
themes.get('/', async (c) => {
  const limit = Math.min(100, Math.max(1, parseInt(c.req.query('limit') || '50', 10)))
  const offset = Math.max(0, parseInt(c.req.query('offset') || '0', 10))
  const sort = c.req.query('sort') || 'name'

  const db = c.env.DB

  // Validate sort parameter
  const validSorts = ['name', 'created_at', 'popularity']
  const sortField = validSorts.includes(sort) ? sort : 'name'

  // Build ORDER BY clause
  let orderBy = ''
  if (sortField === 'popularity') {
    orderBy = `ORDER BY usage_count DESC`
  } else if (sortField === 'created_at') {
    orderBy = `ORDER BY t.created_at DESC`
  } else {
    orderBy = `ORDER BY t.name ASC`
  }

  // Get total count
  const countQuery = `
    SELECT COUNT(*) as total
    FROM themes t
    WHERE t.is_system = 1 OR t.is_public = 1
  `
  const countRow = await db.prepare(countQuery).first<{ total: number }>()
  const total = countRow?.total || 0

  // Get paginated data with usage count and creator info
  const dataQuery = `
    SELECT
      t.*,
      COUNT(g.id) as usage_count,
      u.id as creator_id,
      u.username,
      u.display_name,
      u.avatar_url
    FROM themes t
    LEFT JOIN galleries g ON g.theme_id = t.id
    LEFT JOIN users u ON u.id = t.created_by
    WHERE t.is_system = 1 OR t.is_public = 1
    GROUP BY t.id
    ${orderBy}
    LIMIT ? OFFSET ?
  `

  const rows = await db
    .prepare(dataQuery)
    .bind(limit, offset)
    .all<any>()

  const data = (rows.results || []).map((row: any) => {
    const mapped = mapThemeRow(row)
    return {
      ...mapped,
      usageCount: row.usage_count || 0,
      ...(row.creator_id && {
        creator: {
          username: row.username || null,
          displayName: row.display_name || null,
          avatarUrl: row.avatar_url || null,
        },
      }),
    }
  })

  const hasMore = offset + limit < total

  return c.json({
    data,
    pagination: {
      total,
      limit,
      offset,
      hasMore,
    },
  })
})

/**
 * GET /api/themes/mine
 * List user's themes (requireAuth)
 */
themes.get('/mine', requireAuth, async (c) => {
  const authUser = getCurrentUser(c)
  if (!authUser) {
    throw Errors.unauthorized()
  }

  const limit = Math.min(100, Math.max(1, parseInt(c.req.query('limit') || '50', 10)))
  const offset = Math.max(0, parseInt(c.req.query('offset') || '0', 10))

  const db = c.env.DB

  // Get total count
  const countQuery = `
    SELECT COUNT(*) as total
    FROM themes
    WHERE created_by = ?
  `
  const countRow = await db
    .prepare(countQuery)
    .bind(authUser.userId)
    .first<{ total: number }>()
  const total = countRow?.total || 0

  // Get paginated data with usage count
  const dataQuery = `
    SELECT
      t.*,
      COUNT(g.id) as usage_count
    FROM themes t
    LEFT JOIN galleries g ON g.theme_id = t.id
    WHERE t.created_by = ?
    GROUP BY t.id
    ORDER BY t.updated_at DESC
    LIMIT ? OFFSET ?
  `

  const rows = await db
    .prepare(dataQuery)
    .bind(authUser.userId, limit, offset)
    .all<any>()

  const data = (rows.results || []).map((row: any) => {
    const mapped = mapThemeRow(row)
    return {
      ...mapped,
      usageCount: row.usage_count || 0,
    }
  })

  const hasMore = offset + limit < total

  return c.json({
    data,
    pagination: {
      total,
      limit,
      offset,
      hasMore,
    },
  })
})

/**
 * POST /api/themes
 * Create theme (requireAuth)
 */
themes.post('/', requireAuth, async (c) => {
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

  // Validate required fields
  if (!data.name) {
    throw Errors.badRequest('Theme name is required')
  }

  if (typeof data.name !== 'string' || data.name.length === 0) {
    throw Errors.badRequest('Theme name must be a non-empty string')
  }

  if (data.name.length > 100) {
    throw Errors.badRequest('Theme name must not exceed 100 characters')
  }

  if (!data.styles) {
    throw Errors.badRequest('Theme styles are required')
  }

  if (typeof data.styles !== 'object' || Array.isArray(data.styles)) {
    throw Errors.badRequest('Theme styles must be a valid object')
  }

  const db = c.env.DB
  const themeId = crypto.randomUUID()
  const now = new Date().toISOString()

  await db
    .prepare(
      `INSERT INTO themes
       (id, name, description, created_by, is_system, is_public, styles, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      themeId,
      data.name as string,
      (data.description as string) || null,
      authUser.userId,
      0,
      data.isPublic ? 1 : 0,
      JSON.stringify(data.styles),
      now,
      now,
    )
    .run()

  // Fetch and return the new theme
  const newTheme = await db
    .prepare('SELECT * FROM themes WHERE id = ?')
    .bind(themeId)
    .first<any>()

  return c.json(mapThemeRow(newTheme), 201)
})

/**
 * PATCH /api/themes/:id
 * Update theme (requireAuth, owner only)
 */
themes.patch('/:id', requireAuth, async (c) => {
  const themeId = c.req.param('id')
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

  // At least one field must be provided
  const updatableFields = ['name', 'description', 'isPublic', 'styles']
  const hasValidField = updatableFields.some((f) => f in data)
  if (!hasValidField) {
    throw Errors.badRequest('At least one field to update is required')
  }

  const db = c.env.DB

  // Fetch theme
  const theme = await db
    .prepare('SELECT * FROM themes WHERE id = ?')
    .bind(themeId)
    .first<any>()

  if (!theme) {
    throw Errors.notFound('Theme')
  }

  // Authorization: must own theme
  if (theme.created_by !== authUser.userId) {
    throw Errors.forbidden('You can only update your own themes')
  }

  // Cannot update system themes
  if (theme.is_system === 1 || theme.is_system === true) {
    throw Errors.forbidden('Cannot update system themes')
  }

  // Validate fields if provided
  if ('name' in data) {
    if (typeof data.name !== 'string' || data.name.length === 0) {
      throw Errors.badRequest('Theme name must be a non-empty string')
    }
    if (data.name.length > 100) {
      throw Errors.badRequest('Theme name must not exceed 100 characters')
    }
  }

  if ('styles' in data) {
    if (typeof data.styles !== 'object' || Array.isArray(data.styles)) {
      throw Errors.badRequest('Theme styles must be a valid object')
    }
  }

  // Build dynamic SET clause
  const fieldMap: Record<string, string> = {
    name: 'name',
    description: 'description',
    isPublic: 'is_public',
    styles: 'styles',
  }

  const setClauses: string[] = []
  const bindValues: any[] = []

  for (const [field, dbField] of Object.entries(fieldMap)) {
    if (field in data) {
      if (field === 'styles') {
        setClauses.push(`${dbField} = ?`)
        bindValues.push(JSON.stringify(data[field]))
      } else if (field === 'isPublic') {
        setClauses.push(`${dbField} = ?`)
        bindValues.push(data[field] ? 1 : 0)
      } else {
        setClauses.push(`${dbField} = ?`)
        bindValues.push(data[field] || null)
      }
    }
  }

  // Add updated_at
  const now = new Date().toISOString()
  setClauses.push('updated_at = ?')
  bindValues.push(now)

  // Add theme ID to bind values
  bindValues.push(themeId)

  // Execute update
  const updateQuery = `UPDATE themes SET ${setClauses.join(', ')} WHERE id = ?`
  await db.prepare(updateQuery).bind(...bindValues).run()

  // Fetch updated theme
  const updated = await db
    .prepare('SELECT * FROM themes WHERE id = ?')
    .bind(themeId)
    .first<any>()

  return c.json(mapThemeRow(updated))
})

/**
 * DELETE /api/themes/:id
 * Delete theme (requireAuth, owner only)
 */
themes.delete('/:id', requireAuth, async (c) => {
  const themeId = c.req.param('id')
  const authUser = getCurrentUser(c)
  if (!authUser) {
    throw Errors.unauthorized()
  }

  const db = c.env.DB

  // Fetch theme
  const theme = await db
    .prepare('SELECT * FROM themes WHERE id = ?')
    .bind(themeId)
    .first<any>()

  if (!theme) {
    throw Errors.notFound('Theme')
  }

  // Authorization: must own theme
  if (theme.created_by !== authUser.userId) {
    throw Errors.forbidden('You can only delete your own themes')
  }

  // Cannot delete system themes
  if (theme.is_system === 1 || theme.is_system === true) {
    throw Errors.forbidden('Cannot delete system themes')
  }

  // Set theme_id = NULL on all galleries using this theme
  await db
    .prepare('UPDATE galleries SET theme_id = NULL WHERE theme_id = ?')
    .bind(themeId)
    .run()

  // Delete the theme
  await db
    .prepare('DELETE FROM themes WHERE id = ?')
    .bind(themeId)
    .run()

  return c.json({
    success: true,
  })
})

/**
 * POST /api/themes/:id/copy
 * Copy theme (requireAuth)
 */
themes.post('/:id/copy', requireAuth, async (c) => {
  const sourceThemeId = c.req.param('id')
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

  // Fetch source theme
  const sourceTheme = await db
    .prepare('SELECT * FROM themes WHERE id = ?')
    .bind(sourceThemeId)
    .first<any>()

  if (!sourceTheme) {
    throw Errors.notFound('Theme')
  }

  // Check if user can copy this theme:
  // - System theme, OR
  // - Public theme, OR
  // - User owns it
  const canCopy =
    sourceTheme.is_system === 1 ||
    sourceTheme.is_system === true ||
    sourceTheme.is_public === 1 ||
    sourceTheme.is_public === true ||
    sourceTheme.created_by === authUser.userId

  if (!canCopy) {
    throw Errors.forbidden('You cannot copy this theme')
  }

  // Prepare new theme data
  const newThemeId = crypto.randomUUID()
  const now = new Date().toISOString()
  const newName = (data.name as string) || `${sourceTheme.name} (Copy)`
  const newDescription = (data.description as string) || sourceTheme.description || null

  // Validate name if provided
  if ('name' in data) {
    if (typeof data.name !== 'string' || data.name.length === 0) {
      throw Errors.badRequest('Theme name must be a non-empty string')
    }
    if (data.name.length > 100) {
      throw Errors.badRequest('Theme name must not exceed 100 characters')
    }
  }

  // Create new theme as copy
  await db
    .prepare(
      `INSERT INTO themes
       (id, name, description, created_by, is_system, is_public, copied_from, styles, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      newThemeId,
      newName,
      newDescription,
      authUser.userId,
      0,
      0,
      sourceThemeId,
      sourceTheme.styles,
      now,
      now,
    )
    .run()

  // Fetch and return the new theme
  const newTheme = await db
    .prepare('SELECT * FROM themes WHERE id = ?')
    .bind(newThemeId)
    .first<any>()

  return c.json(mapThemeRow(newTheme), 201)
})

export { themes }
