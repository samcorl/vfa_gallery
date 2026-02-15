import type { HonoContext } from '../../../types/env'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogEntry {
  level: LogLevel
  timestamp: string
  method: string
  path: string
  status?: number
  duration: number
  userId?: string
  error?: string
  ip?: string
}

/**
 * Request logging middleware
 */
export async function loggerMiddleware(c: HonoContext, next: () => Promise<void>) {
  const startTime = performance.now()
  const startDate = new Date().toISOString()

  const method = c.req.method
  const path = c.req.path
  const ip = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown'

  try {
    await next()

    const duration = Math.round(performance.now() - startTime)
    const status = c.res.status
    const user = c.get('user')

    const logEntry: LogEntry = {
      level: status >= 400 ? 'warn' : 'info',
      timestamp: startDate,
      method,
      path,
      status,
      duration,
      userId: user?.userId,
      ip,
    }

    logRequest(logEntry)
  } catch (err) {
    const duration = Math.round(performance.now() - startTime)
    const user = c.get('user')

    const logEntry: LogEntry = {
      level: 'error',
      timestamp: startDate,
      method,
      path,
      duration,
      userId: user?.userId,
      ip,
      error: err instanceof Error ? err.message : String(err),
    }

    logRequest(logEntry)
    throw err
  }
}

function logRequest(entry: LogEntry): void {
  const { method, path, status, duration, userId, ip, error } = entry

  let logLine = `[${method}] ${path}`

  if (status !== undefined) {
    logLine += ` - ${status}`
  }

  logLine += ` - ${duration}ms`

  if (userId) {
    logLine += ` [${userId}]`
  }

  if (ip && ip !== 'unknown') {
    logLine += ` [${ip}]`
  }

  if (error) {
    logLine += ` ERROR: ${error}`
  }

  if (entry.level === 'error') {
    console.error(logLine)
  } else if (entry.level === 'warn') {
    console.warn(logLine)
  } else {
    console.log(logLine)
  }
}

/**
 * Log custom events
 */
export function logEvent(c: HonoContext, message: string, level: LogLevel = 'info'): void {
  const user = c.get('user')
  const logLine = `[EVENT] ${message}${user ? ` [${user.userId}]` : ''}`

  if (level === 'error') {
    console.error(logLine)
  } else if (level === 'warn') {
    console.warn(logLine)
  } else {
    console.log(logLine)
  }
}
