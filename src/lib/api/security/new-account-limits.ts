import type { D1Database } from '../../../types/env'

const NEW_ACCOUNT_DAYS = 7
const NEW_ACCOUNT_UPLOAD_LIMIT = 10

export function isNewAccount(createdAt: string): boolean {
  const accountAge = Date.now() - new Date(createdAt).getTime()
  return accountAge < NEW_ACCOUNT_DAYS * 24 * 60 * 60 * 1000
}

export async function getTodayUploadCount(db: D1Database, userId: string): Promise<number> {
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const todayIso = today.toISOString()

  const result = await db
    .prepare(
      `SELECT COUNT(*) as count FROM activity_log
       WHERE user_id = ? AND action = 'artwork_created' AND created_at >= ?`
    )
    .bind(userId, todayIso)
    .first<{ count: number }>()

  return result?.count ?? 0
}

export async function checkNewAccountUploadLimit(
  db: D1Database,
  userId: string,
  userCreatedAt: string
): Promise<{ limited: boolean; reason?: string; retryAfter?: number }> {
  if (!isNewAccount(userCreatedAt)) {
    return { limited: false }
  }

  const todayCount = await getTodayUploadCount(db, userId)

  if (todayCount >= NEW_ACCOUNT_UPLOAD_LIMIT) {
    const now = new Date()
    const tomorrow = new Date(now)
    tomorrow.setUTCHours(24, 0, 0, 0)
    const retryAfter = Math.ceil((tomorrow.getTime() - now.getTime()) / 1000)

    return {
      limited: true,
      reason: `New account upload limit reached (${todayCount}/${NEW_ACCOUNT_UPLOAD_LIMIT}). Limit resets at midnight UTC.`,
      retryAfter,
    }
  }

  return { limited: false }
}
