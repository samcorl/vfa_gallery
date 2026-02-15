import { sign } from 'hono/jwt'

/**
 * JWT token configuration
 */
export const JWT_CONFIG = {
  accessTokenExpiry: 60 * 60, // 1 hour in seconds
  refreshTokenExpiry: 60 * 60 * 24 * 7, // 7 days in seconds
  algorithm: 'HS256' as const,
}

/**
 * JWT payload structure for access tokens
 */
export interface AccessTokenPayload {
  userId: string
  email: string
  role: 'user' | 'admin'
  exp: number
  iat: number
  [key: string]: unknown
}

/**
 * Generate access token for authenticated user
 */
export async function generateAccessToken(
  payload: {
    userId: string
    email: string
    role: 'user' | 'admin'
  },
  secret: string
): Promise<string> {
  const now = Math.floor(Date.now() / 1000)

  const tokenPayload: AccessTokenPayload = {
    userId: payload.userId,
    email: payload.email,
    role: payload.role,
    iat: now,
    exp: now + JWT_CONFIG.accessTokenExpiry,
  }

  return await sign(tokenPayload, secret, JWT_CONFIG.algorithm)
}

/**
 * Generate a random state string for OAuth CSRF protection
 */
export function generateOAuthState(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * Generate a unique user ID
 */
export function generateUserId(): string {
  const timestamp = Date.now().toString(36)
  const randomPart = crypto.getRandomValues(new Uint8Array(8))
  const randomStr = Array.from(randomPart, (byte) => byte.toString(36).padStart(2, '0')).join('')
  return `usr_${timestamp}${randomStr}`
}
