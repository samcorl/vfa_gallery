import { setCookie, deleteCookie } from 'hono/cookie'
import type { HonoContext } from '../../types/env'
import { JWT_CONFIG } from './jwt'

/**
 * Cookie configuration
 */
export const COOKIE_CONFIG = {
  authToken: 'auth_token',
  oauthState: 'oauth_state',
}

/**
 * Get cookie options based on environment
 */
function getCookieOptions(c: HonoContext, maxAge?: number) {
  const isProduction = c.env.ENVIRONMENT === 'production'

  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'Lax' as const,
    path: '/',
    maxAge: maxAge,
    domain: isProduction ? '.vfa.gallery' : undefined,
  }
}

/**
 * Set authentication token cookie
 */
export function setAuthCookie(c: HonoContext, token: string): void {
  setCookie(c, COOKIE_CONFIG.authToken, token, {
    ...getCookieOptions(c, JWT_CONFIG.accessTokenExpiry),
  })
}

/**
 * Clear authentication token cookie
 */
export function clearAuthCookie(c: HonoContext): void {
  deleteCookie(c, COOKIE_CONFIG.authToken, {
    path: '/',
  })
}

/**
 * Set OAuth state cookie for CSRF protection
 */
export function setOAuthStateCookie(c: HonoContext, state: string): void {
  setCookie(c, COOKIE_CONFIG.oauthState, state, {
    ...getCookieOptions(c, 600), // 10 minutes
  })
}

/**
 * Clear OAuth state cookie
 */
export function clearOAuthStateCookie(c: HonoContext): void {
  deleteCookie(c, COOKIE_CONFIG.oauthState, {
    path: '/',
  })
}
