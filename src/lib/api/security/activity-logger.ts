import type { D1Database, HonoContext } from '../../../types/env'

/**
 * Extract client IP and user agent from request
 */
function getClientInfo(c: HonoContext): { ipAddress: string; userAgent: string } {
  const ipAddress =
    c.req.header('CF-Connecting-IP') ||
    c.req.header('X-Forwarded-For')?.split(',')[0]?.trim() ||
    'unknown'
  const userAgent = c.req.header('User-Agent') || 'unknown'
  return { ipAddress, userAgent }
}

/**
 * Log an activity to the activity_log table.
 * Wrapped in try/catch so logging never breaks the request.
 */
export async function logActivity(
  db: D1Database,
  c: HonoContext,
  opts: {
    action: string
    userId?: string | null
    entityType?: string | null
    entityId?: string | null
    metadata?: Record<string, unknown> | null
  }
): Promise<void> {
  try {
    const { ipAddress, userAgent } = getClientInfo(c)
    const userId = opts.userId !== undefined ? opts.userId : (c.get('user')?.userId || null)
    const now = new Date().toISOString()

    await db
      .prepare(
        `INSERT INTO activity_log (id, user_id, action, entity_type, entity_id, metadata, ip_address, user_agent, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        crypto.randomUUID(),
        userId,
        opts.action,
        opts.entityType || null,
        opts.entityId || null,
        opts.metadata ? JSON.stringify(opts.metadata) : null,
        ipAddress,
        userAgent,
        now
      )
      .run()
  } catch (error) {
    console.error('[Activity Logger] Failed to log activity:', error)
  }
}

/**
 * Get activity summary for a user (last 30 days)
 */
export async function getUserActivitySummary(
  db: D1Database,
  userId: string
): Promise<Record<string, number>> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const result = await db
    .prepare(
      `SELECT action, COUNT(*) as count
       FROM activity_log
       WHERE user_id = ? AND created_at >= ?
       GROUP BY action`
    )
    .bind(userId, thirtyDaysAgo)
    .all<{ action: string; count: number }>()

  const summary: Record<string, number> = {}
  for (const row of result.results || []) {
    summary[row.action] = row.count
  }
  return summary
}

/**
 * Get recent IPs used by a user
 */
export async function getUserRecentIPs(
  db: D1Database,
  userId: string,
  limit: number = 10
): Promise<Array<{ ipAddress: string; lastUsed: string; count: number }>> {
  const result = await db
    .prepare(
      `SELECT ip_address, MAX(created_at) as last_used, COUNT(*) as count
       FROM activity_log
       WHERE user_id = ?
       GROUP BY ip_address
       ORDER BY last_used DESC
       LIMIT ?`
    )
    .bind(userId, limit)
    .all<{ ip_address: string; last_used: string; count: number }>()

  return (result.results || []).map((row) => ({
    ipAddress: row.ip_address,
    lastUsed: row.last_used,
    count: row.count,
  }))
}
