import type { D1Database } from '../../../types/env'

/**
 * Check for rapid uploads (>threshold in 1 minute)
 */
export async function checkRapidUploads(
  db: D1Database,
  userId: string,
  threshold: number = 5
): Promise<{ detected: boolean; count: number }> {
  const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString()

  const result = await db
    .prepare(
      `SELECT COUNT(*) as count FROM activity_log
       WHERE user_id = ? AND action = 'artwork_created' AND created_at >= ?`
    )
    .bind(userId, oneMinuteAgo)
    .first<{ count: number }>()

  const count = result?.count ?? 0
  return { detected: count > threshold, count }
}

/**
 * Check for bulk gallery creation (>threshold in 1 hour)
 */
export async function checkBulkGalleryCreation(
  db: D1Database,
  userId: string,
  threshold: number = 10
): Promise<{ detected: boolean; count: number }> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()

  const result = await db
    .prepare(
      `SELECT COUNT(*) as count FROM activity_log
       WHERE user_id = ? AND action = 'gallery_created' AND created_at >= ?`
    )
    .bind(userId, oneHourAgo)
    .first<{ count: number }>()

  const count = result?.count ?? 0
  return { detected: count > threshold, count }
}

/**
 * Check for unusual login IP
 */
export async function checkUnusualIP(
  db: D1Database,
  userId: string,
  currentIP: string
): Promise<{ isUnusual: boolean; previousIPs: string[] }> {
  const result = await db
    .prepare(
      `SELECT DISTINCT ip_address FROM activity_log
       WHERE user_id = ? AND action IN ('user_login', 'user_signup')
       ORDER BY created_at DESC
       LIMIT 10`
    )
    .bind(userId)
    .all<{ ip_address: string }>()

  const previousIPs = (result.results || []).map((r) => r.ip_address)
  const isUnusual = previousIPs.length > 0 && !previousIPs.includes(currentIP)
  return { isUnusual, previousIPs }
}

/**
 * Check for failed login attempts from an IP
 */
export async function checkFailedLogins(
  db: D1Database,
  ipAddress: string,
  threshold: number = 5
): Promise<{ detected: boolean; count: number }> {
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString()

  const result = await db
    .prepare(
      `SELECT COUNT(*) as count FROM activity_log
       WHERE ip_address = ? AND action = 'user_login_failed' AND created_at >= ?`
    )
    .bind(ipAddress, fifteenMinutesAgo)
    .first<{ count: number }>()

  const count = result?.count ?? 0
  return { detected: count >= threshold, count }
}

/**
 * Flag suspicious activity for a user
 */
export async function flagSuspiciousActivity(
  db: D1Database,
  userId: string,
  flag: string,
  severity: 'low' | 'medium' | 'high' | 'critical',
  details: Record<string, unknown>
): Promise<void> {
  // Check if already flagged recently (prevent duplicates)
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const existing = await db
    .prepare(
      `SELECT id FROM activity_log
       WHERE user_id = ? AND action = 'suspicious_activity_flagged'
       AND metadata LIKE ? AND created_at >= ?
       LIMIT 1`
    )
    .bind(userId, `%"flag":"${flag}"%`, oneHourAgo)
    .first()

  if (existing) return

  const now = new Date().toISOString()

  await db
    .prepare(
      `INSERT INTO activity_log (id, user_id, action, entity_type, entity_id, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      crypto.randomUUID(),
      userId,
      'suspicious_activity_flagged',
      'user',
      userId,
      JSON.stringify({ flag, severity, ...details }),
      now
    )
    .run()

  // Flag user if severity is high or critical
  if (severity === 'high' || severity === 'critical') {
    await db
      .prepare('UPDATE users SET status = ?, updated_at = ? WHERE id = ? AND status != ?')
      .bind('flagged', now, userId, 'suspended')
      .run()
  }
}

/**
 * Get flagged users for admin review
 */
export async function getFlaggedUsers(
  db: D1Database,
  limit: number = 50,
  offset: number = 0
): Promise<Array<{ userId: string; username: string; email: string; flaggedAt: string; flags: unknown[] }>> {
  const result = await db
    .prepare(
      `SELECT id, username, email, updated_at FROM users
       WHERE status = 'flagged'
       ORDER BY updated_at DESC
       LIMIT ? OFFSET ?`
    )
    .bind(limit, offset)
    .all<{ id: string; username: string; email: string; updated_at: string }>()

  const users = result.results || []

  // Get recent flags for each user
  const usersWithFlags = await Promise.all(
    users.map(async (user) => {
      const flagsResult = await db
        .prepare(
          `SELECT metadata, created_at FROM activity_log
           WHERE user_id = ? AND action = 'suspicious_activity_flagged'
           ORDER BY created_at DESC
           LIMIT 5`
        )
        .bind(user.id)
        .all<{ metadata: string; created_at: string }>()

      const flags = (flagsResult.results || []).map((r) => {
        try { return { ...JSON.parse(r.metadata), detectedAt: r.created_at } }
        catch { return { detectedAt: r.created_at } }
      })

      return {
        userId: user.id,
        username: user.username,
        email: user.email,
        flaggedAt: user.updated_at,
        flags,
      }
    })
  )

  return usersWithFlags
}

/**
 * Clear suspicious flags for a user
 */
export async function clearSuspiciousFlags(
  db: D1Database,
  userId: string,
  reviewedBy: string,
  reviewNotes: string
): Promise<void> {
  const now = new Date().toISOString()

  await db
    .prepare('UPDATE users SET status = ?, updated_at = ? WHERE id = ?')
    .bind('active', now, userId)
    .run()

  await db
    .prepare(
      `INSERT INTO activity_log (id, user_id, action, entity_type, entity_id, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      crypto.randomUUID(),
      reviewedBy,
      'suspicious_flags_cleared',
      'user',
      userId,
      JSON.stringify({ reviewedBy, reviewNotes, clearedUserId: userId }),
      now
    )
    .run()
}
