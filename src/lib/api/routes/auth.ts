import { Hono } from 'hono'
import { getCookie } from 'hono/cookie'
import type { HonoEnv } from '../../../types/env'
import { Errors } from '../errors'
import { requireAuth, getCurrentUser } from '../middleware/auth'
import { generateAccessToken, generateOAuthState, generateUserId } from '../../auth/jwt'
import {
  setAuthCookie,
  clearAuthCookie,
  setOAuthStateCookie,
  clearOAuthStateCookie,
  COOKIE_CONFIG,
} from '../../auth/cookies'
import { getUserById } from '../../db/users'
import { logActivity } from '../security/activity-logger'

const auth = new Hono<HonoEnv>()

/**
 * Google OAuth endpoints
 */
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo'

/**
 * GET /api/auth/login
 * Initiates Google OAuth flow
 */
auth.get('/login', (c) => {
  const clientId = c.env.GOOGLE_CLIENT_ID
  if (!clientId) {
    throw Errors.internal('Google OAuth not configured')
  }

  // Generate state for CSRF protection
  const state = generateOAuthState()
  setOAuthStateCookie(c, state)

  // Determine redirect URI based on environment
  const isProduction = c.env.ENVIRONMENT === 'production'
  const baseUrl = isProduction ? 'https://vfa.gallery' : 'http://localhost:8788'
  const redirectUri = `${baseUrl}/api/auth/callback`

  // Build authorization URL
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state: state,
    access_type: 'offline',
    prompt: 'consent',
  })

  const authUrl = `${GOOGLE_AUTH_URL}?${params.toString()}`
  return c.redirect(authUrl)
})

/**
 * GET /api/auth/callback
 * Handles Google OAuth callback
 */
auth.get('/callback', async (c) => {
  const code = c.req.query('code')
  const state = c.req.query('state')
  const error = c.req.query('error')

  // Check for OAuth errors
  if (error) {
    console.error('[Auth] OAuth error:', error)
    // Log failed OAuth attempt
    const db = c.env.DB
    await logActivity(db, c, {
      action: 'user_login_failed',
      metadata: { reason: 'oauth_error', error: error as string },
    })
    return c.redirect('/?error=oauth_denied')
  }

  // Validate required parameters
  if (!code || !state) {
    throw Errors.badRequest('Missing authorization code or state')
  }

  // Validate state (CSRF protection)
  const storedState = getCookie(c, COOKIE_CONFIG.oauthState)
  if (!storedState || storedState !== state) {
    throw Errors.badRequest('Invalid state parameter')
  }
  clearOAuthStateCookie(c)

  // Exchange code for tokens
  const clientId = c.env.GOOGLE_CLIENT_ID
  const clientSecret = c.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw Errors.internal('Google OAuth not configured')
  }

  const isProduction = c.env.ENVIRONMENT === 'production'
  const baseUrl = isProduction ? 'https://vfa.gallery' : 'http://localhost:8788'
  const redirectUri = `${baseUrl}/api/auth/callback`

  const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code: code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    }),
  })

  if (!tokenResponse.ok) {
    const errorData = await tokenResponse.text()
    console.error('[Auth] Token exchange failed:', errorData)
    throw Errors.internal('Failed to exchange authorization code')
  }

  const tokenData = (await tokenResponse.json()) as {
    access_token: string
    token_type: string
    expires_in: number
    scope: string
  }

  // Fetch user info from Google
  const userInfoResponse = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  })

  if (!userInfoResponse.ok) {
    console.error('[Auth] Failed to fetch user info')
    throw Errors.internal('Failed to fetch user information')
  }

  const googleUser = (await userInfoResponse.json()) as {
    id: string
    email: string
    name: string
    picture: string
    verified_email: boolean
  }

  if (!googleUser.email) {
    throw Errors.badRequest('Email not provided by Google')
  }

  // Find or create user in database
  const db = c.env.DB

  // Check if user exists
  const existingUser = await db
    .prepare('SELECT id, email, username, display_name, avatar_url, status, role FROM users WHERE email = ?')
    .bind(googleUser.email)
    .first<{
      id: string
      email: string
      username: string
      display_name: string | null
      avatar_url: string | null
      status: string
      role: string
    }>()

  let user: {
    id: string
    email: string
    username: string
    displayName: string | null
    avatarUrl: string | null
    status: string
    role: 'user' | 'admin'
  }
  let isNewUser = false

  if (existingUser) {
    // Update existing user's last login and avatar
    await db
      .prepare('UPDATE users SET last_login_at = CURRENT_TIMESTAMP, avatar_url = ? WHERE id = ?')
      .bind(googleUser.picture || existingUser.avatar_url, existingUser.id)
      .run()

    user = {
      id: existingUser.id,
      email: existingUser.email,
      username: existingUser.username,
      displayName: existingUser.display_name,
      avatarUrl: googleUser.picture || existingUser.avatar_url,
      status: existingUser.status,
      role: existingUser.role as 'user' | 'admin',
    }
  } else {
    // Create new user
    isNewUser = true
    const userId = generateUserId()
    const username = generateUniqueUsername(googleUser.email)

    // Create user, default gallery, and default collection atomically
    const defaultGalleryId = crypto.randomUUID()
    const defaultCollectionId = crypto.randomUUID()

    await db.batch([
      db
        .prepare(
          `INSERT INTO users (id, email, username, display_name, avatar_url, email_verified_at, status, role, last_login_at)
           VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 'active', 'user', CURRENT_TIMESTAMP)`
        )
        .bind(userId, googleUser.email, username, googleUser.name, googleUser.picture),
      db
        .prepare(
          `INSERT INTO galleries (id, user_id, slug, name, is_default, status)
           VALUES (?, ?, 'my-gallery', 'My Gallery', 1, 'active')`
        )
        .bind(defaultGalleryId, userId),
      db
        .prepare(
          `INSERT INTO collections (id, gallery_id, slug, name, is_default, status)
           VALUES (?, ?, 'my-collection', 'My Collection', 1, 'active')`
        )
        .bind(defaultCollectionId, defaultGalleryId),
    ])

    user = {
      id: userId,
      email: googleUser.email,
      username: username,
      displayName: googleUser.name,
      avatarUrl: googleUser.picture,
      status: 'active',
      role: 'user',
    }
  }

  // Generate JWT
  const jwtSecret = c.env.JWT_SECRET
  if (!jwtSecret) {
    throw Errors.internal('JWT_SECRET not configured')
  }

  const token = await generateAccessToken(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
    },
    jwtSecret
  )

  // Set auth cookie
  setAuthCookie(c, token)

  // Log login/signup activity
  await logActivity(db, c, {
    action: isNewUser ? 'user_signup' : 'user_login',
    userId: user.id,
    entityType: 'user',
    entityId: user.id,
    metadata: isNewUser ? { email: googleUser.email } : undefined,
  })

  // Redirect to home or dashboard
  return c.redirect('/')
})

/**
 * POST /api/auth/logout
 * Logs out the current user
 */
auth.post('/logout', (c) => {
  clearAuthCookie(c)
  return c.json({ success: true, message: 'Logged out successfully' })
})

/**
 * GET /api/auth/me
 * Returns current authenticated user info
 */
auth.get('/me', requireAuth, async (c) => {
  const authUser = getCurrentUser(c)
  if (!authUser) {
    throw Errors.unauthorized()
  }

  // Fetch full user details from database
  const db = c.env.DB
  const user = await getUserById(db, authUser.userId)
  if (!user) {
    throw Errors.notFound('User')
  }

  return c.json({ user })
})

/**
 * Generate a unique username from email
 */
function generateUniqueUsername(email: string): string {
  const localPart = email.split('@')[0]
  const cleaned = localPart.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
  const suffix = Math.random().toString(36).substring(2, 6)
  return `${cleaned}_${suffix}`
}

/**
 * POST /api/auth/test-login
 * Test-only endpoint for E2E testing — bypasses Google OAuth
 * Returns 404 in production
 */
auth.post('/test-login', async (c) => {
  // Block in production
  if (c.env.ENVIRONMENT === 'production') {
    return c.json({ error: 'Not found' }, 404)
  }

  const body = await c.req.json<{ email: string; role?: string }>()
  const { email, role } = body

  if (!email) {
    return c.json({ error: 'Email required' }, 400)
  }

  const db = c.env.DB

  // Find existing user
  const existingUser = await db
    .prepare('SELECT id, email, username, display_name, avatar_url, status, role FROM users WHERE email = ?')
    .bind(email)
    .first<{
      id: string
      email: string
      username: string
      display_name: string | null
      avatar_url: string | null
      status: string
      role: string
    }>()

  let userId: string
  let userRole: 'user' | 'admin'

  if (existingUser) {
    userId = existingUser.id
    userRole = (role || existingUser.role) as 'user' | 'admin'

    // Update last login
    await db
      .prepare('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?')
      .bind(userId)
      .run()
  } else {
    // Create test user
    userId = generateUserId()
    const username = generateUniqueUsername(email)
    userRole = (role as 'user' | 'admin') || 'user'

    const defaultGalleryId = crypto.randomUUID()
    const defaultCollectionId = crypto.randomUUID()

    await db.batch([
      db
        .prepare(
          `INSERT INTO users (id, email, username, display_name, avatar_url, status, role, last_login_at)
           VALUES (?, ?, ?, ?, NULL, 'active', ?, CURRENT_TIMESTAMP)`
        )
        .bind(userId, email, username, `Test ${username}`, userRole),
      db
        .prepare(
          `INSERT INTO galleries (id, user_id, slug, name, is_default, status)
           VALUES (?, ?, 'my-gallery', 'My Gallery', 1, 'active')`
        )
        .bind(defaultGalleryId, userId),
      db
        .prepare(
          `INSERT INTO collections (id, gallery_id, slug, name, is_default, status)
           VALUES (?, ?, 'my-collection', 'My Collection', 1, 'active')`
        )
        .bind(defaultCollectionId, defaultGalleryId),
    ])
  }

  // Generate JWT (same as real auth callback)
  const jwtSecret = c.env.JWT_SECRET
  if (!jwtSecret) {
    return c.json({ error: 'JWT_SECRET not configured' }, 500)
  }

  const token = await generateAccessToken(
    { userId, email, role: userRole },
    jwtSecret
  )

  // Set auth cookie (same as real auth callback)
  setAuthCookie(c, token)

  // Log activity
  await logActivity(db, c, {
    action: 'user_login',
    userId,
    entityType: 'user',
    entityId: userId,
    metadata: { method: 'test-login' },
  })

  return c.json({ success: true, userId, email, role: userRole })
})

export { auth }
