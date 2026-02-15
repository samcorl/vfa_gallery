import type { D1Database } from '../../types/env'
import type { UserProfileResponse } from '../../types/user'
import { parseSocials, serializeSocials, type UserSocial } from '../../types/user'

/**
 * Database row format from users table
 */
interface UserRow {
  id: string
  email: string
  username: string
  display_name: string | null
  avatar_url: string | null
  bio: string | null
  website: string | null
  phone: string | null
  socials: string | null
  status: string
  role: string
  gallery_limit: number
  collection_limit: number
  artwork_limit: number
  daily_upload_limit: number
  created_at: string
  updated_at: string
  last_login_at: string | null
}

/**
 * Convert database row to UserProfileResponse
 */
function rowToUserProfile(row: UserRow): UserProfileResponse {
  return {
    id: row.id,
    email: row.email,
    username: row.username,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    bio: row.bio,
    website: row.website,
    phone: row.phone,
    socials: parseSocials(row.socials),
    status: row.status,
    role: row.role as 'user' | 'admin',
    limits: {
      galleries: row.gallery_limit,
      collections: row.collection_limit,
      artworks: row.artwork_limit,
      dailyUploads: row.daily_upload_limit,
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastLoginAt: row.last_login_at,
  }
}

/**
 * Get user by ID
 */
export async function getUserById(db: D1Database, userId: string): Promise<UserProfileResponse | null> {
  const user = await db
    .prepare(
      `SELECT id, email, username, display_name, avatar_url, bio, website, phone, socials, status, role,
              gallery_limit, collection_limit, artwork_limit, daily_upload_limit,
              created_at, updated_at, last_login_at
       FROM users WHERE id = ?`
    )
    .bind(userId)
    .first<UserRow>()

  if (!user) return null
  return rowToUserProfile(user)
}

/**
 * Update user profile
 */
export async function updateUserProfile(
  db: D1Database,
  userId: string,
  updates: {
    displayName?: string | null
    bio?: string | null
    website?: string | null
    phone?: string | null
    socials?: UserSocial[] | null
  }
): Promise<UserProfileResponse | null> {
  const setClauses: string[] = ['updated_at = CURRENT_TIMESTAMP']
  const bindings: unknown[] = []

  if (updates.displayName !== undefined) {
    setClauses.push('display_name = ?')
    bindings.push(updates.displayName)
  }

  if (updates.bio !== undefined) {
    setClauses.push('bio = ?')
    bindings.push(updates.bio)
  }

  if (updates.website !== undefined) {
    setClauses.push('website = ?')
    bindings.push(updates.website)
  }

  if (updates.phone !== undefined) {
    setClauses.push('phone = ?')
    bindings.push(updates.phone)
  }

  if (updates.socials !== undefined) {
    setClauses.push('socials = ?')
    bindings.push(serializeSocials(updates.socials))
  }

  if (setClauses.length === 1) {
    // Only updated_at was set, no actual changes
    return getUserById(db, userId)
  }

  bindings.push(userId)

  const query = `UPDATE users SET ${setClauses.join(', ')} WHERE id = ?`

  await db.prepare(query).bind(...bindings).run()

  return getUserById(db, userId)
}

/**
 * Update user avatar URL
 */
export async function updateUserAvatarUrl(
  db: D1Database,
  userId: string,
  avatarUrl: string
): Promise<UserProfileResponse | null> {
  await db
    .prepare('UPDATE users SET avatar_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .bind(avatarUrl, userId)
    .run()

  return getUserById(db, userId)
}
