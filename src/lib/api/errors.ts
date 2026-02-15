import type { Context } from 'hono'
import type { HonoEnv } from '../../types/env'

/**
 * ApiError class for consistent error responses
 */
export class ApiError extends Error {
  statusCode: number
  code: string
  details?: Record<string, unknown>

  constructor(
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR',
    message: string = 'An unexpected error occurred',
    details?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'ApiError'
    this.statusCode = statusCode
    this.code = code
    this.details = details
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details && { details: this.details }),
      },
    }
  }
}

/**
 * Global error handler middleware
 */
export function apiErrorHandler(err: Error, c: Context<HonoEnv>) {
  console.error('[API Error]', err.name, err.message)

  if (err instanceof ApiError) {
    return c.json(err.toJSON(), err.statusCode as 400 | 401 | 403 | 404 | 409 | 429 | 500)
  }

  if (err.message.includes('validation')) {
    const validationError = new ApiError(
      400,
      'VALIDATION_ERROR',
      'Request validation failed',
      { originalMessage: err.message }
    )
    return c.json(validationError.toJSON(), 400)
  }

  const internalError = new ApiError(
    500,
    'INTERNAL_ERROR',
    'An unexpected error occurred'
  )
  return c.json(internalError.toJSON(), 500)
}

/**
 * Common error constructors
 */
export const Errors = {
  badRequest: (message: string, details?: Record<string, unknown>) =>
    new ApiError(400, 'BAD_REQUEST', message, details),

  unauthorized: (message: string = 'Authentication required') =>
    new ApiError(401, 'UNAUTHORIZED', message),

  forbidden: (message: string = 'Access denied') =>
    new ApiError(403, 'FORBIDDEN', message),

  notFound: (resource: string = 'Resource') =>
    new ApiError(404, 'NOT_FOUND', `${resource} not found`),

  conflict: (message: string, details?: Record<string, unknown>) =>
    new ApiError(409, 'CONFLICT', message, details),

  rateLimited: (retryAfter?: number) =>
    new ApiError(
      429,
      'RATE_LIMITED',
      'Too many requests. Please try again later.',
      retryAfter ? { retryAfter } : undefined
    ),

  internal: (message: string, details?: Record<string, unknown>) =>
    new ApiError(500, 'INTERNAL_ERROR', message, details),
}
