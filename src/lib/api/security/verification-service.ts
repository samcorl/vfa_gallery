import type { D1Database } from '../../../types/env'

const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000 // 24 hours

/**
 * Hash a token using Web Crypto API (Workers-compatible)
 */
async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(token)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Generate a secure verification token
 * Returns plain token (for email) and hash (for storage)
 */
async function generateVerificationToken(): Promise<{ token: string; tokenHash: string }> {
  const token = `${crypto.randomUUID()}-${crypto.randomUUID()}`
  const tokenHash = await hashToken(token)
  return { token, tokenHash }
}

/**
 * Create a verification token for a user
 * Returns the plain token to send via email
 */
export async function createVerificationToken(
  db: D1Database,
  userId: string,
  type: 'email_verification' | 'password_reset' | 'email_change' = 'email_verification'
): Promise<string> {
  const { token, tokenHash } = await generateVerificationToken()
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MS).toISOString()
  const now = new Date().toISOString()

  await db
    .prepare(
      `INSERT INTO verification_tokens (id, user_id, token_hash, type, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(crypto.randomUUID(), userId, tokenHash, type, expiresAt, now)
    .run()

  return token
}

/**
 * Verify a token and return the associated user ID if valid
 */
export async function verifyToken(
  db: D1Database,
  token: string,
  type: 'email_verification' | 'password_reset' | 'email_change'
): Promise<{ valid: boolean; userId?: string; error?: string }> {
  const tokenHash = await hashToken(token)

  const record = await db
    .prepare(
      `SELECT id, user_id, expires_at, used_at FROM verification_tokens
       WHERE token_hash = ? AND type = ?`
    )
    .bind(tokenHash, type)
    .first<{ id: string; user_id: string; expires_at: string; used_at: string | null }>()

  if (!record) {
    return { valid: false, error: 'Invalid verification token' }
  }

  if (record.used_at) {
    return { valid: false, error: 'Token has already been used' }
  }

  if (new Date(record.expires_at) < new Date()) {
    return { valid: false, error: 'Token has expired' }
  }

  return { valid: true, userId: record.user_id }
}

/**
 * Mark a token as used
 */
export async function markTokenAsUsed(
  db: D1Database,
  token: string,
  type: 'email_verification' | 'password_reset' | 'email_change'
): Promise<void> {
  const tokenHash = await hashToken(token)
  const now = new Date().toISOString()

  await db
    .prepare(
      `UPDATE verification_tokens SET used_at = ? WHERE token_hash = ? AND type = ?`
    )
    .bind(now, tokenHash, type)
    .run()
}

/**
 * Clean up expired tokens
 */
export async function cleanupExpiredTokens(db: D1Database): Promise<void> {
  const now = new Date().toISOString()

  await db
    .prepare(`DELETE FROM verification_tokens WHERE expires_at < ?`)
    .bind(now)
    .run()
}
