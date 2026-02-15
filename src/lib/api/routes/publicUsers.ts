import { Hono } from 'hono'
import type { HonoEnv } from '../../../types/env'
import { Errors } from '../errors'
import { parseSocials } from '../../../types/user'

const publicUsers = new Hono<HonoEnv>()

// GET /:username - Public user profile
publicUsers.get('/:username', async (c) => {
  const { username } = c.req.param()
  const db = c.env.db

  // Look up user by username where status = 'active'
  const user = await db
    .prepare(
      `SELECT id, username, display_name, avatar_url, bio, website, socials, created_at
       FROM users
       WHERE username = ? AND status = 'active'`
    )
    .bind(username)
    .first()

  if (!user) {
    throw Errors.notFound('User')
  }

  // Count galleries
  const galleriesResult = await db
    .prepare(`SELECT COUNT(*) as count FROM galleries WHERE user_id = ? AND status = 'active'`)
    .bind(user.id)
    .first<{ count: number }>()

  // Count artworks
  const artworksResult = await db
    .prepare(
      `SELECT COUNT(*) as count FROM artworks WHERE user_id = ? AND status = 'active' AND is_public = 1`
    )
    .bind(user.id)
    .first<{ count: number }>()

  const galleriesCount = galleriesResult?.count ?? 0
  const artworksCount = artworksResult?.count ?? 0

  return c.json({
    username: user.username,
    displayName: user.display_name,
    avatarUrl: user.avatar_url,
    bio: user.bio,
    website: user.website,
    socials: user.socials ? parseSocials(user.socials) : [],
    galleriesCount,
    artworksCount,
    createdAt: user.created_at,
  })
})

// GET /:username/galleries - Public user galleries (paginated)
publicUsers.get('/:username/galleries', async (c) => {
  const { username } = c.req.param()
  const page = parseInt(c.req.query('page') || '1', 10)
  const pageSize = Math.min(parseInt(c.req.query('pageSize') || '20', 10), 100)

  const db = c.env.db

  // Verify user exists and is active
  const user = await db
    .prepare(`SELECT id FROM users WHERE username = ? AND status = 'active'`)
    .bind(username)
    .first<{ id: string }>()

  if (!user) {
    throw Errors.notFound('User')
  }

  // Calculate offset
  const offset = (page - 1) * pageSize

  // Fetch active galleries with collection counts
  const galleries = await db
    .prepare(
      `SELECT g.id, g.slug, g.name, g.description, g.welcome_message, g.theme_id,
         COUNT(c.id) as collection_count
       FROM galleries g
       LEFT JOIN collections c ON c.gallery_id = g.id AND c.status = 'active'
       WHERE g.user_id = ? AND g.status = 'active'
       GROUP BY g.id
       ORDER BY g.is_default DESC, g.created_at DESC
       LIMIT ? OFFSET ?`
    )
    .bind(user.id, pageSize, offset)
    .all<{
      id: string
      slug: string
      name: string
      description: string | null
      welcome_message: string | null
      theme_id: string | null
      collection_count: number
    }>()

  // Get total count for pagination
  const countResult = await db
    .prepare(`SELECT COUNT(*) as count FROM galleries WHERE user_id = ? AND status = 'active'`)
    .bind(user.id)
    .first<{ count: number }>()

  const total = countResult?.count ?? 0
  const totalPages = Math.ceil(total / pageSize)

  return c.json({
    data: galleries.results.map((g) => ({
      id: g.id,
      slug: g.slug,
      name: g.name,
      description: g.description,
      welcomeMessage: g.welcome_message,
      themeId: g.theme_id,
      collectionCount: g.collection_count,
    })),
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
    },
  })
})

export { publicUsers }
