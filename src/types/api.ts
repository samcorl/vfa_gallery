/**
 * Standard API Response wrapper
 */
export interface ApiResponse<T> {
  data: T
  meta?: {
    timestamp?: string
    version?: string
  }
}

/**
 * Paginated API Response
 */
export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
    hasNextPage: boolean
    hasPreviousPage: boolean
  }
  meta?: {
    timestamp?: string
  }
}

/**
 * Error Response Structure
 */
export interface ErrorResponse {
  error: {
    code: string
    message: string
    details?: Record<string, unknown>
  }
}

/**
 * Status Response
 */
export interface StatusResponse {
  status: 'ok' | 'error'
  timestamp: string
}

/**
 * Pagination query parameters
 */
export interface PaginationParams {
  page?: number
  pageSize?: number
}

/**
 * Parse pagination params from query string
 */
export function parsePaginationParams(params: Record<string, string>): Required<PaginationParams> {
  const page = Math.max(1, parseInt(params.page || '1', 10))
  const pageSize = Math.min(100, Math.max(1, parseInt(params.pageSize || '20', 10)))
  return { page, pageSize }
}

/**
 * Create paginated response helper
 */
export function createPaginatedResponse<T>(
  data: T[],
  page: number,
  pageSize: number,
  total: number
): PaginatedResponse<T> {
  const totalPages = Math.ceil(total / pageSize)
  return {
    data,
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
    meta: {
      timestamp: new Date().toISOString(),
    },
  }
}
