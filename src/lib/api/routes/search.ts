import { Hono } from 'hono'
import type { HonoEnv } from '../../../types/env'
import { Errors } from '../errors'

const search = new Hono<HonoEnv>()

/**
 * GET /
 * Search artworks by multiple criteria
 */
search.get('/', async (c) => {
  const q = c.req.query('q') || ''
  const artist = c.req.query('artist') || ''
  const category = c.req.query('category') || ''
  const from = c.req.query('from') || ''
  const to = c.req.query('to') || ''
  const page = Math.max(1, parseInt(c.req.query('page') || '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt(c.req.query('limit') || '20', 10)))

  // Require at least one search parameter
  if (!q && !artist && !category && !from && !to) {
    throw Errors.badRequest('At least one search parameter is required')
  }

  // Validate date parameters
  if (from && isNaN(new Date(from).getTime())) {
    throw Errors.badRequest('Invalid from date format')
  }
  if (to && isNaN(new Date(to).getTime())) {
    throw Errors.badRequest('Invalid to date format')
  }

  const db = c.env.DB
  const offset = (page - 1) * limit

  // Build WHERE clause dynamically
  const conditions: string[] = ["a.status = 'active'"]
  const binds: (string | number)[] = []

  if (q) {
    conditions.push('(a.title LIKE ? COLLATE NOCASE OR a.description LIKE ? COLLATE NOCASE OR a.tags LIKE ? COLLATE NOCASE)')
    binds.push(`%${q}%`, `%${q}%`, `%${q}%`)
  }

  if (artist) {
    conditions.push('u.username = ?')
    binds.push(artist)
  }

  if (category) {
    conditions.push('a.category = ?')
    binds.push(category)
  }

  if (from) {
    conditions.push('a.created_at >= ?')
    binds.push(from)
  }

  if (to) {
    conditions.push('a.created_at <= ?')
    binds.push(to)
  }

  const whereClause = conditions.join(' AND ')

  // Get total count
  const countResult = await db
    .prepare(
      `SELECT COUNT(*) as count FROM artworks a
       JOIN users u ON u.id = a.user_id AND u.status = 'active'
       WHERE ${whereClause}`
    )
    .bind(...binds)
    .first<{ count: number }>()

  const total = countResult?.count ?? 0
  const totalPages = Math.ceil(total / limit)

  // Get paginated results
  const artworksResult = await db
    .prepare(
      `SELECT a.id, a.slug, a.title, a.category, a.image_key, a.created_at,
              u.username, u.display_name
       FROM artworks a
       JOIN users u ON u.id = a.user_id AND u.status = 'active'
       WHERE ${whereClause}
       ORDER BY a.created_at DESC
       LIMIT ? OFFSET ?`
    )
    .bind(...binds, limit, offset)
    .all<{
      id: string
      slug: string
      title: string
      category: string | null
      image_key: string
      created_at: string
      username: string
      display_name: string | null
    }>()

  return c.json({
    data: (artworksResult.results || []).map((a) => ({
      id: a.id,
      slug: a.slug,
      title: a.title,
      category: a.category,
      thumbnailUrl: `/cdn-cgi/image/width=400,quality=80,format=auto/${a.image_key}`,
      createdAt: a.created_at,
      artist: {
        username: a.username,
        displayName: a.display_name,
      },
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasMore: page < totalPages,
    },
  })
})

/**
 * GET /artists
 * Artist autocomplete
 */
search.get('/artists', async (c) => {
  const q = c.req.query('q') || ''
  const limit = Math.min(20, Math.max(1, parseInt(c.req.query('limit') || '8', 10)))

  // Require minimum 2 characters
  if (q.length < 2) {
    return c.json({ artists: [] })
  }

  const db = c.env.DB
  const searchPattern = `%${q}%`

  const result = await db
    .prepare(
      `SELECT u.id, u.username, u.display_name, u.avatar_url,
              COUNT(DISTINCT a.id) as artwork_count
       FROM users u
       LEFT JOIN artworks a ON a.user_id = u.id AND a.status = 'active'
       WHERE u.status = 'active'
         AND (u.username LIKE ? COLLATE NOCASE OR u.display_name LIKE ? COLLATE NOCASE)
       GROUP BY u.id
       HAVING artwork_count > 0
       ORDER BY artwork_count DESC
       LIMIT ?`
    )
    .bind(searchPattern, searchPattern, limit)
    .all<{
      id: string
      username: string
      display_name: string | null
      avatar_url: string | null
      artwork_count: number
    }>()

  return c.json({
    artists: (result.results || []).map((a) => ({
      id: a.id,
      username: a.username,
      displayName: a.display_name,
      avatarUrl: a.avatar_url,
      artworkCount: a.artwork_count,
    })),
  })
})

export { search }
