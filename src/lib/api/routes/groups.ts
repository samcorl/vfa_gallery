import { Hono } from 'hono'
import type { HonoEnv } from '../../../types/env'
import { Errors } from '../errors'
import { requireAuth, optionalAuth, getCurrentUser } from '../middleware/auth'

const groups = new Hono<HonoEnv>()

/**
 * Helper: Map group row from DB to API response
 */
function mapGroupRow(row: any) {
  let socials = null
  if (row.socials) {
    try {
      socials = JSON.parse(row.socials)
    } catch {
      socials = null
    }
  }
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    website: row.website || null,
    email: row.email || null,
    phone: row.phone || null,
    socials,
    logoUrl: row.logo_url || null,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/**
 * Helper: Convert name to URL-friendly slug
 */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * POST /api/groups
 * Create a new group (requires authentication)
 */
groups.post('/', requireAuth, async (c) => {
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

  const data = body as Record<string, any>
  const db = c.env.DB

  // Validate required fields
  if (!data.name || typeof data.name !== 'string') {
    throw Errors.badRequest('Group name is required')
  }

  if (data.name.length > 100) {
    throw Errors.badRequest('Group name must be 100 characters or less')
  }

  // Generate base slug
  let slug = slugify(data.name)
  if (!slug) {
    throw Errors.badRequest('Group name must contain alphanumeric characters')
  }

  // Check slug uniqueness and generate unique slug if needed
  const existing = await db
    .prepare('SELECT id FROM groups WHERE slug = ?')
    .bind(slug)
    .first()

  if (existing) {
    const suffix = crypto.randomUUID().substring(0, 6)
    slug = `${slug}-${suffix}`
  }

  // Prepare data
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const socials = data.socials ? JSON.stringify(data.socials) : null

  // Insert group
  await db
    .prepare(
      `INSERT INTO groups (id, slug, name, website, email, phone, socials, logo_url, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      slug,
      data.name,
      data.website || null,
      data.email || null,
      data.phone || null,
      socials,
      null,
      authUser.userId,
      now,
      now
    )
    .run()

  // Auto-add creator as owner
  await db
    .prepare(
      `INSERT INTO group_members (group_id, user_id, role, joined_at)
       VALUES (?, ?, ?, ?)`
    )
    .bind(id, authUser.userId, 'owner', now)
    .run()

  // Fetch and return the new group
  const group = await db
    .prepare('SELECT * FROM groups WHERE id = ?')
    .bind(id)
    .first()

  if (!group) {
    throw Errors.internal('Failed to create group')
  }

  return c.json({ data: mapGroupRow(group) }, 201)
})

/**
 * GET /api/groups
 * List all groups with pagination and search
 */
groups.get('/', async (c) => {
  const db = c.env.DB
  const page = parseInt(c.req.query('page') || '1', 10)
  const pageSize = Math.min(parseInt(c.req.query('pageSize') || '20', 10), 100)
  const q = c.req.query('q') || ''

  if (page < 1 || pageSize < 1) {
    throw Errors.badRequest('page and pageSize must be >= 1')
  }

  const offset = (page - 1) * pageSize

  // Build WHERE clause
  let whereClause = ''
  let params: any[] = []

  if (q) {
    whereClause = 'WHERE g.name LIKE ?'
    params.push(`%${q}%`)
  }

  // Count total
  const countQuery = `SELECT COUNT(*) as count FROM groups g ${whereClause}`
  const countResult = await db
    .prepare(countQuery)
    .bind(...params)
    .first<{ count: number }>()

  const total = countResult?.count || 0
  const totalPages = Math.ceil(total / pageSize)

  // Fetch groups
  const query = `
    SELECT
      g.*,
      (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as member_count
    FROM groups g
    ${whereClause}
    ORDER BY g.created_at DESC
    LIMIT ? OFFSET ?
  `

  const groups_list = await db
    .prepare(query)
    .bind(...params, pageSize, offset)
    .all<any>()

  const data = groups_list.results?.map((row) => ({
    ...mapGroupRow(row),
    memberCount: row.member_count || 0,
  })) || []

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
 * GET /api/groups/:slug
 * Get group by slug with members (public endpoint)
 */
groups.get('/:slug', optionalAuth, async (c) => {
  const slug = c.req.param('slug')
  const db = c.env.DB
  const authUser = getCurrentUser(c)

  // Fetch group
  const group = await db
    .prepare('SELECT * FROM groups WHERE slug = ?')
    .bind(slug)
    .first<Record<string, unknown>>()

  if (!group) {
    throw Errors.notFound('Group')
  }

  // Fetch members
  const membersResult = await db
    .prepare(
      `SELECT
        gm.user_id, gm.role, gm.joined_at,
        u.username, u.display_name, u.avatar_url
       FROM group_members gm
       JOIN users u ON gm.user_id = u.id
       WHERE gm.group_id = ?
       ORDER BY CASE gm.role WHEN 'owner' THEN 1 WHEN 'manager' THEN 2 ELSE 3 END, gm.joined_at ASC`
    )
    .bind(group.id)
    .all<any>()

  const members = (membersResult.results || []).map((m) => ({
    userId: m.user_id,
    username: m.username,
    displayName: m.display_name || null,
    avatarUrl: m.avatar_url || null,
    role: m.role,
    joinedAt: m.joined_at,
  }))

  // Determine current user's role in group
  let userRole = null
  if (authUser) {
    userRole = members.find((m) => m.userId === authUser.userId)?.role || null
  }

  return c.json({
    data: {
      ...mapGroupRow(group),
      members,
      memberCount: members.length,
      userRole,
    },
  })
})

/**
 * PATCH /api/groups/:id
 * Update group (requires owner or manager role)
 */
groups.patch('/:id', requireAuth, async (c) => {
  const authUser = getCurrentUser(c)
  if (!authUser) {
    throw Errors.unauthorized()
  }

  const groupId = c.req.param('id')
  const db = c.env.DB

  // Check user's role in group
  const memberRole = await db
    .prepare('SELECT role FROM group_members WHERE group_id = ? AND user_id = ?')
    .bind(groupId, authUser.userId)
    .first<{ role: string }>()

  if (!memberRole || (memberRole.role !== 'owner' && memberRole.role !== 'manager')) {
    throw Errors.forbidden('Only owners and managers can update groups')
  }

  // Fetch existing group
  const existingGroup = await db
    .prepare('SELECT * FROM groups WHERE id = ?')
    .bind(groupId)
    .first()

  if (!existingGroup) {
    throw Errors.notFound('Group')
  }

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    throw Errors.badRequest('Invalid JSON body')
  }

  const data = body as Record<string, any>
  const now = new Date().toISOString()

  // Build update query dynamically
  const updates: string[] = ['updated_at = ?']
  const values: any[] = [now]

  // Handle name and slug
  if (data.name !== undefined) {
    if (typeof data.name !== 'string' || !data.name.trim()) {
      throw Errors.badRequest('Group name must be a non-empty string')
    }
    if (data.name.length > 100) {
      throw Errors.badRequest('Group name must be 100 characters or less')
    }

    const newSlug = slugify(data.name)
    if (!newSlug) {
      throw Errors.badRequest('Group name must contain alphanumeric characters')
    }

    // Check slug uniqueness (allow same slug if same group)
    const slugExists = await db
      .prepare('SELECT id FROM groups WHERE slug = ? AND id != ?')
      .bind(newSlug, groupId)
      .first()

    if (slugExists) {
      const suffix = crypto.randomUUID().substring(0, 6)
      updates.push('slug = ?', 'name = ?')
      values.push(`${newSlug}-${suffix}`, data.name)
    } else {
      updates.push('slug = ?', 'name = ?')
      values.push(newSlug, data.name)
    }
  }

  if (data.website !== undefined) {
    updates.push('website = ?')
    values.push(data.website || null)
  }

  if (data.email !== undefined) {
    updates.push('email = ?')
    values.push(data.email || null)
  }

  if (data.phone !== undefined) {
    updates.push('phone = ?')
    values.push(data.phone || null)
  }

  if (data.socials !== undefined) {
    const socialsJson = data.socials ? JSON.stringify(data.socials) : null
    updates.push('socials = ?')
    values.push(socialsJson)
  }

  // Execute update
  values.push(groupId)
  await db
    .prepare(`UPDATE groups SET ${updates.join(', ')} WHERE id = ?`)
    .bind(...values)
    .run()

  // Fetch and return updated group
  const updated = await db
    .prepare('SELECT * FROM groups WHERE id = ?')
    .bind(groupId)
    .first()

  if (!updated) {
    throw Errors.internal('Failed to fetch updated group')
  }

  return c.json({ data: mapGroupRow(updated) })
})

/**
 * DELETE /api/groups/:id
 * Delete group (owner only)
 */
groups.delete('/:id', requireAuth, async (c) => {
  const authUser = getCurrentUser(c)
  if (!authUser) {
    throw Errors.unauthorized()
  }

  const groupId = c.req.param('id')
  const db = c.env.DB

  // Check user is owner
  const memberRole = await db
    .prepare('SELECT role FROM group_members WHERE group_id = ? AND user_id = ? AND role = ?')
    .bind(groupId, authUser.userId, 'owner')
    .first()

  if (!memberRole) {
    throw Errors.forbidden('Only owners can delete groups')
  }

  // Verify group exists
  const group = await db
    .prepare('SELECT id FROM groups WHERE id = ?')
    .bind(groupId)
    .first()

  if (!group) {
    throw Errors.notFound('Group')
  }

  // Delete group (CASCADE handles members)
  await db
    .prepare('DELETE FROM groups WHERE id = ?')
    .bind(groupId)
    .run()

  return c.body(null, 204)
})

/**
 * GET /api/groups/:id/members
 * List all members of a group
 */
groups.get('/:id/members', async (c) => {
  const groupId = c.req.param('id')
  const db = c.env.DB

  // Verify group exists
  const group = await db
    .prepare('SELECT id FROM groups WHERE id = ?')
    .bind(groupId)
    .first()

  if (!group) {
    throw Errors.notFound('Group')
  }

  // Fetch members
  const membersResult = await db
    .prepare(
      `SELECT
        gm.user_id, gm.role, gm.joined_at,
        u.username, u.display_name, u.avatar_url
       FROM group_members gm
       JOIN users u ON gm.user_id = u.id
       WHERE gm.group_id = ?
       ORDER BY CASE gm.role WHEN 'owner' THEN 1 WHEN 'manager' THEN 2 ELSE 3 END, gm.joined_at ASC`
    )
    .bind(groupId)
    .all<any>()

  const members = (membersResult.results || []).map((m) => ({
    userId: m.user_id,
    username: m.username,
    displayName: m.display_name || null,
    avatarUrl: m.avatar_url || null,
    role: m.role,
    joinedAt: m.joined_at,
  }))

  return c.json({ data: members })
})

/**
 * POST /api/groups/:id/members
 * Add a member to a group (owner/manager only)
 */
groups.post('/:id/members', requireAuth, async (c) => {
  const authUser = getCurrentUser(c)
  if (!authUser) {
    throw Errors.unauthorized()
  }

  const groupId = c.req.param('id')
  const db = c.env.DB

  // Check current user is owner or manager
  const userRole = await db
    .prepare('SELECT role FROM group_members WHERE group_id = ? AND user_id = ?')
    .bind(groupId, authUser.userId)
    .first<{ role: string }>()

  if (!userRole || (userRole.role !== 'owner' && userRole.role !== 'manager')) {
    throw Errors.forbidden('Only owners and managers can add members')
  }

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    throw Errors.badRequest('Invalid JSON body')
  }

  const data = body as Record<string, any>

  // Validate userId
  if (!data.userId || typeof data.userId !== 'string') {
    throw Errors.badRequest('userId is required')
  }

  // Validate role
  const role = data.role || 'member'
  if (!['member', 'manager'].includes(role)) {
    throw Errors.badRequest('role must be "member" or "manager"')
  }

  // Check target user exists and is active
  const targetUser = await db
    .prepare('SELECT id, username, display_name, avatar_url FROM users WHERE id = ? AND status = ?')
    .bind(data.userId, 'active')
    .first<any>()

  if (!targetUser) {
    throw Errors.notFound('User')
  }

  // Check user is not already a member
  const existing = await db
    .prepare('SELECT user_id FROM group_members WHERE group_id = ? AND user_id = ?')
    .bind(groupId, data.userId)
    .first()

  if (existing) {
    throw Errors.conflict('User is already a member of this group')
  }

  // Add member
  const now = new Date().toISOString()
  await db
    .prepare(
      `INSERT INTO group_members (group_id, user_id, role, joined_at)
       VALUES (?, ?, ?, ?)`
    )
    .bind(groupId, data.userId, role, now)
    .run()

  return c.json(
    {
      data: {
        userId: targetUser.id,
        username: targetUser.username,
        displayName: targetUser.display_name || null,
        avatarUrl: targetUser.avatar_url || null,
        role,
        joinedAt: now,
      },
    },
    201
  )
})

/**
 * DELETE /api/groups/:id/members/:userId
 * Remove a member from a group (owner/manager only)
 */
groups.delete('/:id/members/:userId', requireAuth, async (c) => {
  const authUser = getCurrentUser(c)
  if (!authUser) {
    throw Errors.unauthorized()
  }

  const groupId = c.req.param('id')
  const targetUserId = c.req.param('userId')
  const db = c.env.DB

  // Check current user is owner or manager
  const userRole = await db
    .prepare('SELECT role FROM group_members WHERE group_id = ? AND user_id = ?')
    .bind(groupId, authUser.userId)
    .first<{ role: string }>()

  if (!userRole || (userRole.role !== 'owner' && userRole.role !== 'manager')) {
    throw Errors.forbidden('Only owners and managers can remove members')
  }

  // Check target member exists
  const targetMember = await db
    .prepare('SELECT role FROM group_members WHERE group_id = ? AND user_id = ?')
    .bind(groupId, targetUserId)
    .first<{ role: string }>()

  if (!targetMember) {
    throw Errors.notFound('Member')
  }

  // Cannot remove owner
  if (targetMember.role === 'owner') {
    throw Errors.badRequest('Cannot remove group owner')
  }

  // If removing self (as owner/manager), check if there are other admins
  if (targetUserId === authUser.userId) {
    const adminCount = await db
      .prepare(
        `SELECT COUNT(*) as count FROM group_members
         WHERE group_id = ? AND role IN ('owner', 'manager')`
      )
      .bind(groupId)
      .first<{ count: number }>()

    if ((adminCount?.count || 0) <= 1) {
      throw Errors.badRequest('Cannot remove the last admin. Transfer ownership or add another admin first.')
    }
  }

  // Remove member
  await db
    .prepare('DELETE FROM group_members WHERE group_id = ? AND user_id = ?')
    .bind(groupId, targetUserId)
    .run()

  return c.body(null, 204)
})

/**
 * POST /api/groups/:id/join
 * Join a group as a member (authenticated users only)
 */
groups.post('/:id/join', requireAuth, async (c) => {
  const authUser = getCurrentUser(c)
  if (!authUser) {
    throw Errors.unauthorized()
  }

  const groupId = c.req.param('id')
  const db = c.env.DB

  // Verify group exists
  const group = await db
    .prepare('SELECT id FROM groups WHERE id = ?')
    .bind(groupId)
    .first()

  if (!group) {
    throw Errors.notFound('Group')
  }

  // Check not already a member
  const existing = await db
    .prepare('SELECT user_id FROM group_members WHERE group_id = ? AND user_id = ?')
    .bind(groupId, authUser.userId)
    .first()

  if (existing) {
    throw Errors.conflict('You are already a member of this group')
  }

  // Add as member
  const now = new Date().toISOString()
  await db
    .prepare(
      `INSERT INTO group_members (group_id, user_id, role, joined_at)
       VALUES (?, ?, ?, ?)`
    )
    .bind(groupId, authUser.userId, 'member', now)
    .run()

  return c.json({
    data: {
      message: 'Successfully joined group',
    },
  })
})

/**
 * POST /api/groups/:id/leave
 * Leave a group
 */
groups.post('/:id/leave', requireAuth, async (c) => {
  const authUser = getCurrentUser(c)
  if (!authUser) {
    throw Errors.unauthorized()
  }

  const groupId = c.req.param('id')
  const db = c.env.DB

  // Check is member
  const membership = await db
    .prepare('SELECT role FROM group_members WHERE group_id = ? AND user_id = ?')
    .bind(groupId, authUser.userId)
    .first<{ role: string }>()

  if (!membership) {
    throw Errors.badRequest('You are not a member of this group')
  }

  // If owner, check if only owner
  if (membership.role === 'owner') {
    const ownerCount = await db
      .prepare(
        `SELECT COUNT(*) as count FROM group_members
         WHERE group_id = ? AND role = 'owner'`
      )
      .bind(groupId)
      .first<{ count: number }>()

    if ((ownerCount?.count || 0) <= 1) {
      throw Errors.badRequest('Cannot leave as the last owner. Transfer ownership first.')
    }
  }

  // Remove member
  await db
    .prepare('DELETE FROM group_members WHERE group_id = ? AND user_id = ?')
    .bind(groupId, authUser.userId)
    .run()

  return c.json({
    data: {
      message: 'Successfully left group',
    },
  })
})

export { groups }
