import { Hono } from 'hono'
import type { HonoEnv } from '../../../types/env'
import { Errors } from '../errors'
import { requireAuth, getCurrentUser } from '../middleware/auth'
import { updateUserProfile, updateUserAvatarUrl } from '../../db/users'
import { validateProfileUpdate, validateAvatarUpload } from '../../validation/users'
import type { UserSocial } from '../../../types/user'

const users = new Hono<HonoEnv>()

/**
 * PATCH /api/users/me
 * Update current user profile
 */
users.patch('/', requireAuth, async (c) => {
  const authUser = getCurrentUser(c)
  if (!authUser) {
    throw Errors.unauthorized()
  }

  // Parse JSON body
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    throw Errors.badRequest('Invalid JSON body')
  }

  // Validate request
  const validationErrors = validateProfileUpdate(body)
  if (validationErrors.length > 0) {
    throw Errors.badRequest('Validation failed', { errors: validationErrors })
  }

  const data = body as Record<string, unknown>

  // Update user profile
  const db = c.env.DB
  const updates: Parameters<typeof updateUserProfile>[2] = {}

  if (data.displayName !== undefined) {
    updates.displayName = data.displayName as string | null
  }

  if (data.bio !== undefined) {
    updates.bio = data.bio as string | null
  }

  if (data.website !== undefined) {
    updates.website = data.website as string | null
  }

  if (data.phone !== undefined) {
    updates.phone = data.phone as string | null
  }

  if (data.socials !== undefined) {
    updates.socials = data.socials as UserSocial[] | null
  }

  const updatedUser = await updateUserProfile(db, authUser.userId, updates)
  if (!updatedUser) {
    throw Errors.notFound('User')
  }

  return c.json({ user: updatedUser })
})

/**
 * POST /api/users/me/avatar
 * Upload and update user avatar
 */
users.post('/avatar', requireAuth, async (c) => {
  const authUser = getCurrentUser(c)
  if (!authUser) {
    throw Errors.unauthorized()
  }

  // Parse form data
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

  // Validate file
  const validationErrors = validateAvatarUpload(file)
  if (validationErrors.length > 0) {
    throw Errors.badRequest('Invalid file', { errors: validationErrors })
  }

  // Upload to R2
  const bucket = c.env.IMAGE_BUCKET
  if (!bucket) {
    throw Errors.internal('Image bucket not configured')
  }

  try {
    // Generate unique filename
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 8)
    const extension = file.name.split('.').pop() || 'jpg'
    const key = `avatars/${authUser.userId}-${timestamp}-${random}.${extension}`

    // Read file as ArrayBuffer
    const arrayBuffer = await file.arrayBuffer()

    // Upload to R2
    await bucket.put(key, arrayBuffer, {
      httpMetadata: {
        contentType: file.type,
        cacheControl: 'public, max-age=31536000',
      },
    })

    // Build public URL
    // In production, this would be the custom domain for your R2 bucket
    const avatarUrl = `https://images.vfa.gallery/${key}`

    // Update user in database
    const db = c.env.DB
    const updatedUser = await updateUserAvatarUrl(db, authUser.userId, avatarUrl)
    if (!updatedUser) {
      throw Errors.notFound('User')
    }

    return c.json({ user: updatedUser })
  } catch (err) {
    if (err instanceof Error && !err.message.includes('not configured')) {
      console.error('[Avatar Upload] Error:', err.message)
    }
    throw Errors.internal('Failed to upload avatar')
  }
})

export { users }
