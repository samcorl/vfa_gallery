import type { UserSocial } from '../types/user'

/**
 * Social media platform configuration
 */
export const SOCIAL_PLATFORMS = {
  twitter: {
    name: 'Twitter',
    icon: 'twitter',
    baseUrl: 'https://twitter.com',
    pattern: /^@?[\w]{1,15}$/,
  },
  instagram: {
    name: 'Instagram',
    icon: 'instagram',
    baseUrl: 'https://instagram.com',
    pattern: /^[a-zA-Z0-9._]{1,30}$/,
  },
  facebook: {
    name: 'Facebook',
    icon: 'facebook',
    baseUrl: 'https://facebook.com',
    pattern: /^[a-zA-Z0-9.-]{5,}$/,
  },
  linkedin: {
    name: 'LinkedIn',
    icon: 'linkedin',
    baseUrl: 'https://linkedin.com/in',
    pattern: /^[a-zA-Z0-9-]{3,100}$/,
  },
  github: {
    name: 'GitHub',
    icon: 'github',
    baseUrl: 'https://github.com',
    pattern: /^[a-zA-Z0-9-]{1,39}$/,
  },
  youtube: {
    name: 'YouTube',
    icon: 'youtube',
    baseUrl: 'https://youtube.com/@',
    pattern: /^[a-zA-Z0-9_-]{3,30}$/,
  },
  tiktok: {
    name: 'TikTok',
    icon: 'tiktok',
    baseUrl: 'https://tiktok.com/@',
    pattern: /^[a-zA-Z0-9_.]{3,24}$/,
  },
  website: {
    name: 'Website',
    icon: 'globe',
    baseUrl: '',
    pattern: /^https?:\/\/.+/,
  },
} as const

/**
 * Extract username from social media URL
 */
export function extractSocialUsername(url: string, platform: string): string {
  try {
    const urlObj = new URL(url)
    const pathname = urlObj.pathname

    switch (platform) {
      case 'twitter':
        return pathname.replace(/^\/?@?/, '')
      case 'instagram':
      case 'github':
      case 'tiktok':
      case 'youtube':
        return pathname.replace(/^\/?@?/, '')
      case 'facebook':
        return pathname.split('/').filter(Boolean)[0] || ''
      case 'linkedin':
        return pathname.split('/').pop() || ''
      default:
        return pathname
    }
  } catch {
    return ''
  }
}

/**
 * Build social media URL from username
 */
export function buildSocialUrl(platform: keyof typeof SOCIAL_PLATFORMS, username: string): string {
  const config = SOCIAL_PLATFORMS[platform]

  if (!config) {
    return username.startsWith('http') ? username : ''
  }

  if (platform === 'website') {
    return username.startsWith('http') ? username : `https://${username}`
  }

  const cleanUsername = username.replace(/^@/, '').replace(/\/$/, '')
  return `${config.baseUrl}/${cleanUsername}`
}

/**
 * Get social media icon class name
 */
export function getSocialIconClass(platform: string): string {
  const config = SOCIAL_PLATFORMS[platform as keyof typeof SOCIAL_PLATFORMS]
  return config?.icon || 'globe'
}

/**
 * Get social media display name
 */
export function getSocialDisplayName(platform: string): string {
  const config = SOCIAL_PLATFORMS[platform as keyof typeof SOCIAL_PLATFORMS]
  return config?.name || platform
}

/**
 * Validate social media username for a platform
 */
export function validateSocialUsername(username: string, platform: string): boolean {
  const config = SOCIAL_PLATFORMS[platform as keyof typeof SOCIAL_PLATFORMS]

  if (!config) {
    return false
  }

  // Website allows any URL
  if (platform === 'website') {
    try {
      new URL(username.startsWith('http') ? username : `https://${username}`)
      return true
    } catch {
      return false
    }
  }

  const cleanUsername = username.replace(/^@/, '')
  return config.pattern.test(cleanUsername)
}

/**
 * Extract all social links from a user's socials array
 */
export function extractSocialLinks(socials: UserSocial[]): Record<string, string> {
  const links: Record<string, string> = {}

  for (const social of socials) {
    links[social.platform] = social.url
  }

  return links
}

/**
 * Build social media link from platform and username/url
 */
export function buildSocialLink(platform: string, usernameOrUrl: string): UserSocial {
  let url = usernameOrUrl
  let username = usernameOrUrl

  if (platform === 'website' || usernameOrUrl.startsWith('http')) {
    url = usernameOrUrl.startsWith('http') ? usernameOrUrl : `https://${usernameOrUrl}`
  } else {
    url = buildSocialUrl(platform as keyof typeof SOCIAL_PLATFORMS, usernameOrUrl)
    username = usernameOrUrl.replace(/^@/, '')
  }

  return {
    platform: platform as UserSocial['platform'],
    url,
    username: platform === 'website' ? undefined : username,
  }
}
