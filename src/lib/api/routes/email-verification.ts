import { Hono } from 'hono'
import type { HonoEnv } from '../../../types/env'
import { requireAuth } from '../middleware/auth'
import { Errors } from '../errors'
import {
  createVerificationToken,
  verifyToken,
  markTokenAsUsed,
} from '../security/verification-service'
import {
  sendEmail,
  getVerificationEmailTemplate,
  getVerificationEmailText,
} from '../../email/email-service'

const emailVerification = new Hono<HonoEnv>()

/**
 * POST /api/auth/email/send-verification
 * Send verification email to the authenticated user
 */
emailVerification.post('/send-verification', requireAuth, async (c) => {
  const db = c.env.DB
  const user = c.get('user')!

  const userRecord = await db
    .prepare('SELECT email, username, email_verified_at FROM users WHERE id = ?')
    .bind(user.userId)
    .first<{ email: string; username: string; email_verified_at: string | null }>()

  if (!userRecord) {
    throw Errors.notFound('User')
  }

  if (userRecord.email_verified_at) {
    throw Errors.badRequest('Email is already verified')
  }

  // Check for recent token (5 minute cooldown)
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
  const recentToken = await db
    .prepare(
      `SELECT id FROM verification_tokens
       WHERE user_id = ? AND type = 'email_verification' AND created_at >= ?
       LIMIT 1`
    )
    .bind(user.userId, fiveMinutesAgo)
    .first()

  if (recentToken) {
    throw Errors.rateLimited(300)
  }

  const token = await createVerificationToken(db, user.userId, 'email_verification')

  const isProduction = c.env.ENVIRONMENT === 'production'
  const baseUrl = isProduction ? 'https://vfa.gallery' : 'http://localhost:8788'
  const verificationUrl = `${baseUrl}/verify-email?token=${encodeURIComponent(token)}`

  const apiKey = c.env.RESEND_API_KEY
  if (!apiKey) {
    console.error('[Email Verification] RESEND_API_KEY not configured')
    throw Errors.internal('Email service not configured')
  }

  const emailResult = await sendEmail(apiKey, {
    to: userRecord.email,
    subject: 'Verify Your VFA.gallery Email Address',
    html: getVerificationEmailTemplate(userRecord.email, verificationUrl, userRecord.username),
    text: getVerificationEmailText(verificationUrl),
  })

  if (!emailResult.success) {
    console.error('[Email Verification] Send failed:', emailResult.error)
    throw Errors.internal('Failed to send verification email')
  }

  return c.json({
    data: {
      message: 'Verification email sent',
      email: userRecord.email,
    },
  })
})

/**
 * POST /api/auth/email/verify
 * Verify email with token (public endpoint)
 */
emailVerification.post('/verify', async (c) => {
  const db = c.env.DB
  const body = await c.req.json<{ token: string }>()

  if (!body.token || typeof body.token !== 'string') {
    throw Errors.badRequest('Verification token is required')
  }

  const result = await verifyToken(db, body.token, 'email_verification')

  if (!result.valid) {
    throw Errors.unauthorized(result.error || 'Invalid verification token')
  }

  const userId = result.userId!
  const now = new Date().toISOString()

  // Mark token as used
  await markTokenAsUsed(db, body.token, 'email_verification')

  // Update user email_verified_at
  await db
    .prepare('UPDATE users SET email_verified_at = ?, updated_at = ? WHERE id = ?')
    .bind(now, now, userId)
    .run()

  return c.json({
    data: {
      message: 'Email verified successfully',
      userId,
      verifiedAt: now,
    },
  })
})

/**
 * GET /api/auth/email/verification-status
 * Check verification status for current user
 */
emailVerification.get('/verification-status', requireAuth, async (c) => {
  const db = c.env.DB
  const user = c.get('user')!

  const userRecord = await db
    .prepare('SELECT email, email_verified_at FROM users WHERE id = ?')
    .bind(user.userId)
    .first<{ email: string; email_verified_at: string | null }>()

  if (!userRecord) {
    throw Errors.notFound('User')
  }

  return c.json({
    data: {
      email: userRecord.email,
      verified: !!userRecord.email_verified_at,
      verifiedAt: userRecord.email_verified_at,
    },
  })
})

/**
 * POST /api/auth/email/resend-verification
 * Resend verification email (with 5-minute cooldown)
 */
emailVerification.post('/resend-verification', requireAuth, async (c) => {
  const db = c.env.DB
  const user = c.get('user')!

  const userRecord = await db
    .prepare('SELECT email, username, email_verified_at FROM users WHERE id = ?')
    .bind(user.userId)
    .first<{ email: string; username: string; email_verified_at: string | null }>()

  if (!userRecord) {
    throw Errors.notFound('User')
  }

  if (userRecord.email_verified_at) {
    throw Errors.badRequest('Email is already verified')
  }

  // 5-minute cooldown
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
  const recentToken = await db
    .prepare(
      `SELECT id FROM verification_tokens
       WHERE user_id = ? AND type = 'email_verification' AND created_at >= ?
       LIMIT 1`
    )
    .bind(user.userId, fiveMinutesAgo)
    .first()

  if (recentToken) {
    throw Errors.rateLimited(300)
  }

  const token = await createVerificationToken(db, user.userId, 'email_verification')

  const isProduction = c.env.ENVIRONMENT === 'production'
  const baseUrl = isProduction ? 'https://vfa.gallery' : 'http://localhost:8788'
  const verificationUrl = `${baseUrl}/verify-email?token=${encodeURIComponent(token)}`

  const apiKey = c.env.RESEND_API_KEY
  if (!apiKey) {
    throw Errors.internal('Email service not configured')
  }

  const emailResult = await sendEmail(apiKey, {
    to: userRecord.email,
    subject: 'Verify Your VFA.gallery Email Address',
    html: getVerificationEmailTemplate(userRecord.email, verificationUrl, userRecord.username),
    text: getVerificationEmailText(verificationUrl),
  })

  if (!emailResult.success) {
    throw Errors.internal('Failed to send verification email')
  }

  return c.json({
    data: {
      message: 'Verification email resent',
      email: userRecord.email,
    },
  })
})

export { emailVerification }
