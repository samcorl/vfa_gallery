import { Hono } from 'hono'
import type { HonoEnv } from '../../types/env'
import { apiErrorHandler } from './errors'
import { corsMiddleware } from './middleware/cors'
import { loggerMiddleware } from './middleware/logger'
import { rateLimitMiddleware, authRateLimit } from './middleware/rateLimit'
import { auth } from './routes/auth'
import { users } from './routes/users'
import { artworks } from './routes/artworks'
import { galleries } from './routes/galleries'
import { collections } from './routes/collections'
import { publicUsers } from './routes/publicUsers'
import { publicGalleries } from './routes/publicGalleries'
import { search } from './routes/search'
import { browse } from './routes/browse'
import { themes } from './routes/themes'
import { messages } from './routes/messages'
import { groups } from './routes/groups'
import { admin } from './routes/admin'
import { adminUsers } from './routes/admin-users'
import { emailVerification } from './routes/email-verification'

// Initialize Hono app with strict typing
export const app = new Hono<HonoEnv>()

// Middleware order:
// 1. CORS - sets headers
// 2. Logger - logs all requests
// 3. Rate Limiter - tracks requests (placeholder in Phase 3)

app.use('*', corsMiddleware())
app.use('*', loggerMiddleware)
app.use('*', rateLimitMiddleware())
app.use('/api/auth/*', authRateLimit)

// Health check endpoint
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  })
})

// Mount API routes
app.route('/api/auth', auth)
app.route('/api/auth/email', emailVerification)
app.route('/api/users/me', users)
app.route('/api/artworks', artworks)
app.route('/api/galleries', galleries)
app.route('/api', collections)
app.route('/api/users', publicUsers)
app.route('/api/g', publicGalleries)
app.route('/api/search', search)
app.route('/api/browse', browse)
app.route('/api/themes', themes)
app.route('/api/messages', messages)
app.route('/api/groups', groups)
app.route('/api/admin', admin)
app.route('/api/admin/users', adminUsers)

// Global error handler
app.onError(apiErrorHandler)

// 404 handler for unmatched routes
app.notFound((c) => {
  return c.json({
    error: {
      code: 'NOT_FOUND',
      message: 'Endpoint not found',
    },
  }, 404)
})

export default app
