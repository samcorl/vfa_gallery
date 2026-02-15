import { Hono } from 'hono'
import type { HonoEnv } from '../../../types/env'
import { Errors } from '../errors'

const publicGalleries = new Hono<HonoEnv>()

/**
 * GET /:artist/:gallery
 * Public gallery detail
 */
publicGalleries.get('/:artist/:gallery', async (c) => {
  const { artist, gallery } = c.req.param()
  const db = c.env.DB

  // Look up user by username where status = 'active'
  const user = await db
    .prepare(`SELECT id, username, display_name, avatar_url FROM users WHERE username = ? AND status = 'active'`)
    .bind(artist)
    .first<{ id: string; username: string; display_name: string; avatar_url: string | null }>()

  if (!user) {
    throw Errors.notFound('User')
  }

  // Look up gallery by slug + user_id where status = 'active'
  const galleryRow = await db
    .prepare(
      `SELECT id, slug, name, description, welcome_message, theme_id, created_at, updated_at
       FROM galleries
       WHERE slug = ? AND user_id = ? AND status = 'active'`
    )
    .bind(gallery, user.id)
    .first<{
      id: string
      slug: string
      name: string
      description: string | null
      welcome_message: string | null
      theme_id: string | null
      created_at: string
      updated_at: string
    }>()

  if (!galleryRow) {
    throw Errors.notFound('Gallery')
  }

  // Count active collections in this gallery
  const collectionCountResult = await db
    .prepare(`SELECT COUNT(*) as count FROM collections WHERE gallery_id = ? AND status = 'active'`)
    .bind(galleryRow.id)
    .first<{ count: number }>()

  const collectionCount = collectionCountResult?.count ?? 0

  return c.json({
    id: galleryRow.id,
    slug: galleryRow.slug,
    name: galleryRow.name,
    description: galleryRow.description,
    welcomeMessage: galleryRow.welcome_message,
    themeId: galleryRow.theme_id,
    collectionCount,
    artist: {
      username: user.username,
      displayName: user.display_name,
      avatarUrl: user.avatar_url,
    },
    createdAt: galleryRow.created_at,
    updatedAt: galleryRow.updated_at,
  })
})

/**
 * GET /:artist/:gallery/collections
 * Public gallery collections (paginated)
 */
publicGalleries.get('/:artist/:gallery/collections', async (c) => {
  const { artist, gallery } = c.req.param()
  const page = Math.max(1, parseInt(c.req.query('page') || '1', 10))
  const pageSize = Math.min(100, Math.max(1, parseInt(c.req.query('pageSize') || '12', 10)))

  const db = c.env.DB

  // Verify user exists and is active
  const user = await db
    .prepare(`SELECT id FROM users WHERE username = ? AND status = 'active'`)
    .bind(artist)
    .first<{ id: string }>()

  if (!user) {
    throw Errors.notFound('User')
  }

  // Verify gallery exists, is active, and belongs to user
  const galleryRow = await db
    .prepare(`SELECT id FROM galleries WHERE slug = ? AND user_id = ? AND status = 'active'`)
    .bind(gallery, user.id)
    .first<{ id: string }>()

  if (!galleryRow) {
    throw Errors.notFound('Gallery')
  }

  // Calculate offset
  const offset = (page - 1) * pageSize

  // Fetch active collections with artwork counts
  const collectionsResult = await db
    .prepare(
      `SELECT c.id, c.slug, c.name, c.description, c.hero_image_url,
         COUNT(ca.artwork_id) as artwork_count
       FROM collections c
       LEFT JOIN collection_artworks ca ON ca.collection_id = c.id
       WHERE c.gallery_id = ? AND c.status = 'active'
       GROUP BY c.id
       ORDER BY c.is_default DESC, c.created_at ASC
       LIMIT ? OFFSET ?`
    )
    .bind(galleryRow.id, pageSize, offset)
    .all<{
      id: string
      slug: string
      name: string
      description: string | null
      hero_image_url: string | null
      artwork_count: number
    }>()

  // Get total count for pagination
  const countResult = await db
    .prepare(`SELECT COUNT(*) as count FROM collections WHERE gallery_id = ? AND status = 'active'`)
    .bind(galleryRow.id)
    .first<{ count: number }>()

  const total = countResult?.count ?? 0
  const totalPages = Math.ceil(total / pageSize)

  return c.json({
    data: (collectionsResult.results || []).map((col) => ({
      id: col.id,
      slug: col.slug,
      name: col.name,
      description: col.description,
      heroImageUrl: col.hero_image_url,
      artworkCount: col.artwork_count,
    })),
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
    },
  })
})

/**
 * GET /:artist/:gallery/:collection
 * Public collection detail with artworks, parent context, and navigation
 */
publicGalleries.get('/:artist/:gallery/:collection', async (c) => {
  const { artist, gallery, collection } = c.req.param()
  const page = Math.max(1, parseInt(c.req.query('page') || '1', 10))
  const pageSize = Math.min(100, Math.max(1, parseInt(c.req.query('pageSize') || '24', 10)))

  const db = c.env.DB

  // Resolve user
  const user = await db
    .prepare(`SELECT id, username, display_name, avatar_url FROM users WHERE username = ? AND status = 'active'`)
    .bind(artist)
    .first<{ id: string; username: string; display_name: string; avatar_url: string | null }>()

  if (!user) {
    throw Errors.notFound('User')
  }

  // Resolve gallery
  const galleryRow = await db
    .prepare(
      `SELECT id, slug, name FROM galleries WHERE slug = ? AND user_id = ? AND status = 'active'`
    )
    .bind(gallery, user.id)
    .first<{ id: string; slug: string; name: string }>()

  if (!galleryRow) {
    throw Errors.notFound('Gallery')
  }

  // Resolve collection
  const collectionRow = await db
    .prepare(
      `SELECT id, slug, name, description, hero_image_url, theme_id, created_at, updated_at
       FROM collections
       WHERE slug = ? AND gallery_id = ? AND status = 'active'`
    )
    .bind(collection, galleryRow.id)
    .first<{
      id: string
      slug: string
      name: string
      description: string | null
      hero_image_url: string | null
      theme_id: string | null
      created_at: string
      updated_at: string
    }>()

  if (!collectionRow) {
    throw Errors.notFound('Collection')
  }

  // Get prev/next collections in this gallery (ordered by is_default DESC, created_at ASC)
  const allCollections = await db
    .prepare(
      `SELECT slug, name FROM collections
       WHERE gallery_id = ? AND status = 'active'
       ORDER BY is_default DESC, created_at ASC`
    )
    .bind(galleryRow.id)
    .all<{ slug: string; name: string }>()

  const collectionsList = allCollections.results || []
  const currentIndex = collectionsList.findIndex((col) => col.slug === collectionRow.slug)

  const prevCollection = currentIndex > 0 ? collectionsList[currentIndex - 1] : null
  const nextCollection = currentIndex < collectionsList.length - 1 ? collectionsList[currentIndex + 1] : null

  // Count total artworks in collection
  const countResult = await db
    .prepare(`SELECT COUNT(*) as count FROM collection_artworks WHERE collection_id = ?`)
    .bind(collectionRow.id)
    .first<{ count: number }>()

  const total = countResult?.count ?? 0
  const totalPages = Math.ceil(total / pageSize)
  const offset = (page - 1) * pageSize

  // Fetch paginated artworks
  const artworksResult = await db
    .prepare(
      `SELECT a.id, a.slug, a.title, a.medium, a.dimensions, a.year, a.image_key,
              ca.position
       FROM collection_artworks ca
       JOIN artworks a ON a.id = ca.artwork_id
       WHERE ca.collection_id = ? AND a.status = 'active'
       ORDER BY ca.position ASC
       LIMIT ? OFFSET ?`
    )
    .bind(collectionRow.id, pageSize, offset)
    .all<{
      id: string
      slug: string
      title: string
      medium: string | null
      dimensions: string | null
      year: number | null
      image_key: string
      position: number
    }>()

  return c.json({
    id: collectionRow.id,
    slug: collectionRow.slug,
    name: collectionRow.name,
    description: collectionRow.description,
    heroImageUrl: collectionRow.hero_image_url,
    themeId: collectionRow.theme_id,
    createdAt: collectionRow.created_at,
    updatedAt: collectionRow.updated_at,
    artist: {
      username: user.username,
      displayName: user.display_name,
      avatarUrl: user.avatar_url,
    },
    gallery: {
      slug: galleryRow.slug,
      name: galleryRow.name,
    },
    navigation: {
      previous: prevCollection ? { slug: prevCollection.slug, name: prevCollection.name } : null,
      next: nextCollection ? { slug: nextCollection.slug, name: nextCollection.name } : null,
    },
    artworks: {
      data: (artworksResult.results || []).map((artwork) => ({
        id: artwork.id,
        slug: artwork.slug,
        title: artwork.title,
        medium: artwork.medium,
        dimensions: artwork.dimensions,
        year: artwork.year,
        imageUrl: `https://images.vfa.gallery/${artwork.image_key}`,
        thumbnailUrl: `/cdn-cgi/image/width=400,quality=80/${artwork.image_key}`,
        position: artwork.position,
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
      },
    },
  })
})

/**
 * GET /:artist/:gallery/:collection/:artwork
 * Public artwork detail with metadata, parent context, and navigation
 */
publicGalleries.get('/:artist/:gallery/:collection/:artwork', async (c) => {
  const { artist, gallery, collection, artwork } = c.req.param()
  const db = c.env.DB

  // Resolve user
  const user = await db
    .prepare(`SELECT id, username, display_name, avatar_url FROM users WHERE username = ? AND status = 'active'`)
    .bind(artist)
    .first<{ id: string; username: string; display_name: string; avatar_url: string | null }>()

  if (!user) {
    throw Errors.notFound('User')
  }

  // Resolve gallery
  const galleryRow = await db
    .prepare(
      `SELECT id, slug, name FROM galleries WHERE slug = ? AND user_id = ? AND status = 'active'`
    )
    .bind(gallery, user.id)
    .first<{ id: string; slug: string; name: string }>()

  if (!galleryRow) {
    throw Errors.notFound('Gallery')
  }

  // Resolve collection
  const collectionRow = await db
    .prepare(
      `SELECT id, slug, name FROM collections WHERE slug = ? AND gallery_id = ? AND status = 'active'`
    )
    .bind(collection, galleryRow.id)
    .first<{ id: string; slug: string; name: string }>()

  if (!collectionRow) {
    throw Errors.notFound('Collection')
  }

  // Resolve artwork via junction table
  const artworkRow = await db
    .prepare(
      `SELECT a.id, a.slug, a.title, a.description, a.materials, a.dimensions,
              a.created_date, a.category, a.tags, a.image_key, a.status,
              a.created_at, a.updated_at,
              ca.position
       FROM collection_artworks ca
       JOIN artworks a ON a.id = ca.artwork_id
       WHERE ca.collection_id = ? AND a.slug = ? AND a.status = 'active'`
    )
    .bind(collectionRow.id, artwork)
    .first<{
      id: string
      slug: string
      title: string
      description: string | null
      materials: string | null
      dimensions: string | null
      created_date: string | null
      category: string | null
      tags: string | null
      image_key: string
      status: string
      created_at: string
      updated_at: string
      position: number
    }>()

  if (!artworkRow) {
    throw Errors.notFound('Artwork')
  }

  // Get prev/next artworks in collection by position
  const allArtworks = await db
    .prepare(
      `SELECT a.slug, a.title, a.image_key, ca.position
       FROM collection_artworks ca
       JOIN artworks a ON a.id = ca.artwork_id
       WHERE ca.collection_id = ? AND a.status = 'active'
       ORDER BY ca.position ASC`
    )
    .bind(collectionRow.id)
    .all<{ slug: string; title: string; image_key: string; position: number }>()

  const artworksList = allArtworks.results || []
  const currentIndex = artworksList.findIndex((a) => a.slug === artworkRow.slug)

  const prevArtwork = currentIndex > 0 ? artworksList[currentIndex - 1] : null
  const nextArtwork = currentIndex < artworksList.length - 1 ? artworksList[currentIndex + 1] : null

  return c.json({
    id: artworkRow.id,
    slug: artworkRow.slug,
    title: artworkRow.title,
    description: artworkRow.description,
    materials: artworkRow.materials,
    dimensions: artworkRow.dimensions,
    createdDate: artworkRow.created_date,
    category: artworkRow.category,
    tags: artworkRow.tags ? JSON.parse(artworkRow.tags) : [],
    displayUrl: `https://images.vfa.gallery/cdn-cgi/image/width=1200,quality=85,format=auto/${artworkRow.image_key}`,
    thumbnailUrl: `https://images.vfa.gallery/cdn-cgi/image/width=400,quality=80,format=auto/${artworkRow.image_key}`,
    status: artworkRow.status,
    position: artworkRow.position,
    createdAt: artworkRow.created_at,
    updatedAt: artworkRow.updated_at,
    artist: {
      username: user.username,
      displayName: user.display_name,
      avatarUrl: user.avatar_url,
    },
    parent: {
      gallery: {
        slug: galleryRow.slug,
        name: galleryRow.name,
      },
      collection: {
        slug: collectionRow.slug,
        name: collectionRow.name,
      },
    },
    navigation: {
      previous: prevArtwork
        ? {
            slug: prevArtwork.slug,
            title: prevArtwork.title,
            thumbnailUrl: `https://images.vfa.gallery/cdn-cgi/image/width=128,height=128,fit=cover,quality=80,format=auto/${prevArtwork.image_key}`,
          }
        : null,
      next: nextArtwork
        ? {
            slug: nextArtwork.slug,
            title: nextArtwork.title,
            thumbnailUrl: `https://images.vfa.gallery/cdn-cgi/image/width=128,height=128,fit=cover,quality=80,format=auto/${nextArtwork.image_key}`,
          }
        : null,
    },
  })
})

export { publicGalleries }
