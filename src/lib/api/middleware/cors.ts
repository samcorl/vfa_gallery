import { cors } from 'hono/cors'

const DEV_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:8788',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
]

const PROD_ORIGINS = [
  'https://vfa.gallery',
  'https://www.vfa.gallery',
]

const ALLOWED_ORIGINS = [...DEV_ORIGINS, ...PROD_ORIGINS]

/**
 * CORS middleware configuration
 */
export function corsMiddleware() {
  return cors({
    origin: (origin) => {
      if (origin && ALLOWED_ORIGINS.includes(origin)) {
        return origin
      }
      return 'https://vfa.gallery'
    },
    credentials: true,
    maxAge: 600,
    allowMethods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Accept-Language',
    ],
    exposeHeaders: [
      'Content-Type',
      'Content-Length',
      'X-Total-Count',
      'X-Page-Count',
      'Retry-After',
    ],
  })
}

/**
 * Check if origin is trusted
 */
export function isTrustedOrigin(origin: string): boolean {
  return ALLOWED_ORIGINS.includes(origin)
}
