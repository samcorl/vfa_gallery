import type { HonoContext } from '../../../types/env'
import { Errors } from '../errors'

/**
 * Middleware to require email verification.
 * Use on endpoints that need verified users (uploads, messaging, etc.)
 * Must be placed AFTER requireAuth middleware.
 */
export async function requireEmailVerified(
  c: HonoContext,
  next: () => Promise<void>
): Promise<void> {
  const user = c.get('user')
  if (!user) {
    throw Errors.unauthorized('Authentication required')
  }

  const db = c.env.DB
  const userRecord = await db
    .prepare('SELECT email_verified_at FROM users WHERE id = ?')
    .bind(user.userId)
    .first<{ email_verified_at: string | null }>()

  if (!userRecord?.email_verified_at) {
    throw Errors.forbidden('Email verification required. Please verify your email address to access this feature.')
  }

  await next()
}
