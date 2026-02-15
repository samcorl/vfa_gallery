import { Hono } from 'hono'
import type { HonoEnv } from '../../../types/env'

const browse = new Hono<HonoEnv>()

const VALID_CATEGORIES = ['manga', 'comic', 'illustration', 'concept-art', 'fan-art', 'other']

/**
 * GET /featured
 * Featured artists and artworks
 */
browse.get('/featured', async (c) => {
  const db = c.env.DB

  // Featured artists (up to 10)
  const artistsResult = await db
    .prepare(
      `SELECT u.id, u.username, u.display_name, u.avatar_url,
              COUNT(DISTINCT a.id) as artwork_count
       FROM users u
       LEFT JOIN artworks a ON a.user_id = u.id AND a.status = 'active'
       WHERE u.is_featured = 1 AND u.status = 'active'
       GROUP BY u.id
       ORDER BY artwork_count DESC
       LIMIT 10`
    )
    .all<{
      id: string
      username: string
      display_name: string | null
      avatar_url: string | null
      artwork_count: number
    }>()

  // Featured artworks (up to 20)
  const artworksResult = await db
    .prepare(
      `SELECT a.id, a.slug, a.title, a.category, a.image_key, a.created_at,
              u.username, u.display_name
       FROM artworks a
       JOIN users u ON u.id = a.user_id AND u.status = 'active'
       WHERE a.is_featured = 1 AND a.status = 'active'
       ORDER BY a.created_at DESC
       LIMIT 20`
    )
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
    artists: (artistsResult.results || []).map((a) => ({
      id: a.id,
      username: a.username,
      displayName: a.display_name,
      avatarUrl: a.avatar_url,
      artworkCount: a.artwork_count,
    })),
    artworks: (artworksResult.results || []).map((a) => ({
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
  })
})

/**
 * GET /recent
 * Paginated recent artworks
 */
browse.get('/recent', async (c) => {
  const page = Math.max(1, parseInt(c.req.query('page') || '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt(c.req.query('limit') || '20', 10)))
  const offset = (page - 1) * limit

  const db = c.env.DB

  const countResult = await db
    .prepare(`SELECT COUNT(*) as count FROM artworks WHERE status = 'active'`)
    .first<{ count: number }>()

  const total = countResult?.count ?? 0
  const totalPages = Math.ceil(total / limit)

  const artworksResult = await db
    .prepare(
      `SELECT a.id, a.slug, a.title, a.category, a.image_key, a.created_at,
              u.username, u.display_name
       FROM artworks a
       JOIN users u ON u.id = a.user_id AND u.status = 'active'
       WHERE a.status = 'active'
       ORDER BY a.created_at DESC
       LIMIT ? OFFSET ?`
    )
    .bind(limit, offset)
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
 * GET /categories
 * List all categories with artwork counts
 */
browse.get('/categories', async (c) => {
  const db = c.env.DB

  const result = await db
    .prepare(
      `SELECT category, COUNT(*) as count
       FROM artworks
       WHERE status = 'active' AND category IS NOT NULL
       GROUP BY category
       ORDER BY count DESC`
    )
    .all<{ category: string; count: number }>()

  const categoryCounts = new Map(
    (result.results || []).map((r) => [r.category, r.count])
  )

  return c.json({
    categories: VALID_CATEGORIES.map((cat) => ({
      slug: cat,
      name: cat.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      count: categoryCounts.get(cat) ?? 0,
    })),
  })
})

/**
 * GET /categories/:category
 * Paginated artworks by category
 */
browse.get('/categories/:category', async (c) => {
  const category = c.req.param('category')

  if (!VALID_CATEGORIES.includes(category)) {
    return c.json({
      data: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0, hasMore: false },
    })
  }

  const page = Math.max(1, parseInt(c.req.query('page') || '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt(c.req.query('limit') || '20', 10)))
  const offset = (page - 1) * limit

  const db = c.env.DB

  const countResult = await db
    .prepare(`SELECT COUNT(*) as count FROM artworks WHERE status = 'active' AND category = ?`)
    .bind(category)
    .first<{ count: number }>()

  const total = countResult?.count ?? 0
  const totalPages = Math.ceil(total / limit)

  const artworksResult = await db
    .prepare(
      `SELECT a.id, a.slug, a.title, a.category, a.image_key, a.created_at,
              u.username, u.display_name
       FROM artworks a
       JOIN users u ON u.id = a.user_id AND u.status = 'active'
       WHERE a.status = 'active' AND a.category = ?
       ORDER BY a.created_at DESC
       LIMIT ? OFFSET ?`
    )
    .bind(category, limit, offset)
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

export { browse }
