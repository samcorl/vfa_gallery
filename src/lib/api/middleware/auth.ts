import { verify } from 'hono/jwt'
import { getCookie } from 'hono/cookie'
import type { HonoContext } from '../../../types/env'
import { Errors } from '../errors'

/**
 * JWT Payload structure
 */
export interface JWTPayload {
  userId: string
  email: string
  role: 'user' | 'admin'
  exp: number
  iat: number
}

/**
 * User context extracted from JWT
 */
export interface AuthUser {
  userId: string
  email: string
  role: 'user' | 'admin'
}

/**
 * Extract JWT from request (header or cookie)
 */
function extractToken(c: HonoContext): string | null {
  const authHeader = c.req.header('Authorization')
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7)
  }

  const cookieToken = getCookie(c, 'auth_token')
  if (cookieToken) {
    return cookieToken
  }

  return null
}

/**
 * Verify JWT and extract payload
 */
async function verifyToken(token: string, secret: string): Promise<JWTPayload | null> {
  try {
    const decoded = await verify(token, secret, 'HS256') as unknown as JWTPayload

    if (!decoded.userId || !decoded.email || !decoded.role) {
      return null
    }

    if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
      return null
    }

    return decoded
  } catch (err) {
    console.error('[Auth] JWT verification failed:', err instanceof Error ? err.message : err)
    return null
  }
}

/**
 * Required Authentication Middleware
 */
export async function requireAuth(c: HonoContext, next: () => Promise<void>) {
  const token = extractToken(c)

  if (!token) {
    throw Errors.unauthorized('No authentication token provided')
  }

  const secret = c.env.JWT_SECRET
  if (!secret) {
    throw Errors.internal('JWT_SECRET not configured')
  }

  const payload = await verifyToken(token, secret)

  if (!payload) {
    throw Errors.unauthorized('Invalid or expired token')
  }

  c.set('user', {
    userId: payload.userId,
    email: payload.email,
    role: payload.role,
  })

  await next()
}

/**
 * Optional Authentication Middleware
 */
export async function optionalAuth(c: HonoContext, next: () => Promise<void>) {
  const token = extractToken(c)

  if (token) {
    const secret = c.env.JWT_SECRET
    if (secret) {
      const payload = await verifyToken(token, secret)
      if (payload) {
        c.set('user', {
          userId: payload.userId,
          email: payload.email,
          role: payload.role,
        })
      }
    }
  }

  await next()
}

/**
 * Admin-Only Middleware (use after requireAuth)
 */
export async function requireAdmin(c: HonoContext, next: () => Promise<void>) {
  const user = c.get('user')

  if (!user) {
    throw Errors.unauthorized('Authentication required')
  }

  if (user.role !== 'admin') {
    throw Errors.forbidden('Admin access required')
  }

  await next()
}

/**
 * Get current user from context (null if not authenticated)
 */
export function getCurrentUser(c: HonoContext): AuthUser | null {
  return c.get('user') || null
}

/**
 * Require current user or throw
 */
export function requireCurrentUser(c: HonoContext): AuthUser {
  const user = getCurrentUser(c)
  if (!user) {
    throw Errors.unauthorized('Authentication required')
  }
  return user
}
