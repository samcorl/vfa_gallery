/**
 * User profile types for backend responses and frontend state
 */

export interface UserSocial {
  platform: 'twitter' | 'instagram' | 'facebook' | 'linkedin' | 'github' | 'youtube' | 'tiktok' | 'website'
  url: string
  username?: string
}

export interface UserProfileResponse {
  id: string
  email: string
  username: string
  displayName: string | null
  avatarUrl: string | null
  bio: string | null
  website: string | null
  socials: UserSocial[]
  phone: string | null
  status: string
  role: 'user' | 'admin'
  limits: {
    galleries: number
    collections: number
    artworks: number
    dailyUploads: number
  }
  createdAt: string
  updatedAt: string
  lastLoginAt: string | null
}

export interface UpdateProfileRequest {
  displayName?: string
  bio?: string
  website?: string
  socials?: UserSocial[]
}

export interface AvatarUploadRequest {
  // File is sent as FormData with key 'file'
}

/**
 * Parse socials JSON string from database into UserSocial array
 */
export function parseSocials(socialsJson: string | null): UserSocial[] {
  if (!socialsJson) return []
  try {
    const socials = JSON.parse(socialsJson)
    if (!Array.isArray(socials)) return []
    return socials.filter(
      (s): s is UserSocial =>
        s && typeof s === 'object' &&
        typeof s.platform === 'string' &&
        typeof s.url === 'string'
    )
  } catch {
    return []
  }
}

/**
 * Serialize UserSocial array to JSON string for database storage
 */
export function serializeSocials(socials: UserSocial[] | null | undefined): string | null {
  if (!socials || socials.length === 0) return null
  try {
    return JSON.stringify(socials)
  } catch {
    return null
  }
}
