# Build 18: Google OAuth SSO Redirect

**Goal:** Create Google OAuth initiation endpoint that redirects users to Google's consent screen with CSRF protection via state parameter.

**Spec Extract:**
- No custom auth - delegated entirely to SSO providers (Google only for Phase 4)
- JWT tokens stored in httpOnly cookies
- User created on first login if not exists
- From technical spec: Authentication → SSO Providers → Google and/or Apple Sign-In

---

## Prerequisites

- **Build 15:** API-FOUNDATION.md (Hono router setup + shared types)
- **Build 16:** API-MIDDLEWARE-AUTH.md (Auth middleware infrastructure)

---

## Spec Details

**Endpoint:** `GET /api/auth/google`

**Environment Variables Required:**
- `GOOGLE_CLIENT_ID` - OAuth client ID from Google Cloud Console
- `GOOGLE_REDIRECT_URI` - Callback URL (e.g., `https://yourdomain.com/api/auth/google/callback`)
- `GOOGLE_CLIENT_SECRET` - Client secret (only needed in callback, but store in env)

**OAuth Scopes:**
- `openid` - OpenID Connect
- `email` - User email address
- `profile` - User name and picture

**State Parameter:**
- Random 32-byte string, base64-encoded
- Stored in httpOnly cookie named `oauth_state` with 10-minute expiry
- Used to prevent CSRF attacks

---

## Steps

### Step 1: Create Auth Routes File

Create: `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/auth.ts`

```typescript
import { Hono } from 'hono';
import { setCookie, getCookie } from 'hono/cookie';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import crypto from 'crypto';

// Types
interface Env {
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GOOGLE_REDIRECT_URI: string;
  JWT_SECRET: string;
  DB: D1Database;
}

interface HonoContext {
  Bindings: Env;
}

// Initialize router
export const authRouter = new Hono<HonoContext>();

// Helper: Generate random state parameter
function generateState(): string {
  return crypto.randomBytes(32).toString('base64url');
}

// Helper: Build Google OAuth URL
function buildGoogleOAuthURL(
  clientId: string,
  redirectUri: string,
  state: string
): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state: state,
    prompt: 'consent', // Force consent screen on each login
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

// Route: GET /api/auth/google
authRouter.get('/google', async (c) => {
  try {
    const { GOOGLE_CLIENT_ID, GOOGLE_REDIRECT_URI } = c.env;

    // Validate environment variables
    if (!GOOGLE_CLIENT_ID || !GOOGLE_REDIRECT_URI) {
      throw new HTTPException(500, {
        message: 'Google OAuth configuration missing',
      });
    }

    // Generate state parameter
    const state = generateState();

    // Set state in httpOnly cookie (10 minute expiry)
    setCookie(c, 'oauth_state', state, {
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
      maxAge: 600, // 10 minutes
      path: '/',
    });

    // Build Google OAuth URL
    const googleOAuthURL = buildGoogleOAuthURL(
      GOOGLE_CLIENT_ID,
      GOOGLE_REDIRECT_URI,
      state
    );

    // Redirect to Google consent screen
    return c.redirect(googleOAuthURL);
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }

    console.error('Google OAuth redirect error:', error);
    throw new HTTPException(500, {
      message: 'Failed to initiate Google OAuth',
    });
  }
});
```

### Step 2: Integrate Auth Router into Main API Router

Edit: `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/index.ts` (from Build 15)

Add the auth router import and registration:

```typescript
// At the top with other imports
import { authRouter } from './routes/auth';

// In your main Hono app setup (after other routes):
app.route('/api/auth', authRouter);
```

### Step 3: Environment Variables Configuration

Update: `/Volumes/DataSSD/gitsrc/vfa_gallery/wrangler.toml`

Add these environment variables (or set them in CloudFlare dashboard for production):

```toml
[env.production]
vars = { ENVIRONMENT = "production" }
env_vars = { GOOGLE_CLIENT_ID = "your-client-id.apps.googleusercontent.com", GOOGLE_REDIRECT_URI = "https://yourdomain.com/api/auth/google/callback" }

[env.development]
vars = { ENVIRONMENT = "development" }
env_vars = { GOOGLE_CLIENT_ID = "your-dev-client-id.apps.googleusercontent.com", GOOGLE_REDIRECT_URI = "http://localhost:8787/api/auth/google/callback" }
```

Alternatively, store these securely using CloudFlare secrets:

```bash
# For production
npx wrangler secret put GOOGLE_CLIENT_ID --env production
npx wrangler secret put GOOGLE_CLIENT_SECRET --env production
npx wrangler secret put GOOGLE_REDIRECT_URI --env production

# For development (optional)
npx wrangler secret put GOOGLE_CLIENT_ID --env development
npx wrangler secret put GOOGLE_CLIENT_SECRET --env development
npx wrangler secret put GOOGLE_REDIRECT_URI --env development
```

### Step 4: Create Frontend OAuth Initiation

Create: `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/auth/GoogleOAuthButton.tsx`

```typescript
import React from 'react';

export const GoogleOAuthButton: React.FC = () => {
  const handleGoogleSignIn = () => {
    // Redirect to our auth endpoint
    window.location.href = '/api/auth/google';
  };

  return (
    <button
      onClick={handleGoogleSignIn}
      className="px-4 py-2 bg-white border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2"
    >
      <svg
        className="w-5 h-5"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          fill="#4285F4"
        />
        <path
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          fill="#34A853"
        />
        <path
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          fill="#FBBC05"
        />
        <path
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          fill="#EA4335"
        />
      </svg>
      Sign in with Google
    </button>
  );
};
```

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/auth.ts` | Create | Google OAuth redirect endpoint |
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/index.ts` | Modify | Register auth router |
| `/Volumes/DataSSD/gitsrc/vfa_gallery/wrangler.toml` | Modify | Add environment variables |
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/auth/GoogleOAuthButton.tsx` | Create | Frontend button component |

---

## Verification

### 1. Check Endpoint Exists
```bash
# Test in development
curl -i http://localhost:8787/api/auth/google
# Should return 302 redirect to Google OAuth URL
```

### 2. Verify State Cookie
```bash
# The response should include Set-Cookie header with oauth_state
curl -v http://localhost:8787/api/auth/google 2>&1 | grep -i "set-cookie"
# Should see: Set-Cookie: oauth_state=...
```

### 3. Manual Test Flow
1. Navigate to `http://localhost:8787/api/auth/google` in browser
2. Should redirect to Google consent screen
3. URL should contain your `client_id`, `redirect_uri`, and scopes
4. Browser DevTools → Application → Cookies should show `oauth_state` cookie

### 4. Verify Google OAuth URL Format
```bash
# In browser console after the redirect (before consent):
console.log(window.location.href);
# Should be: https://accounts.google.com/o/oauth2/v2/auth?client_id=...&redirect_uri=...&response_type=code&scope=openid+email+profile&state=...
```

### 5. Verify Environment Variables
```bash
# In CloudFlare Pages function
console.log(env.GOOGLE_CLIENT_ID); // Should print your client ID
console.log(env.GOOGLE_REDIRECT_URI); // Should print your redirect URI
```

---

## Common Issues & Troubleshooting

**Issue:** `GOOGLE_CLIENT_ID undefined`
- Solution: Verify secrets are set in wrangler.toml or via `wrangler secret put`
- Check `wrangler.toml` has correct environment section

**Issue:** Redirect loop or infinite redirect
- Solution: Verify `GOOGLE_REDIRECT_URI` is exactly `https://yourdomain.com/api/auth/google/callback`
- Check it matches exactly what's configured in Google Cloud Console

**Issue:** State cookie not set
- Solution: Ensure `secure: true` is only set for HTTPS (remove for localhost development)
- Check browser allows cookies (not in private/incognito mode by default)

**Issue:** 403 error on Google consent screen
- Solution: Google may require HTTPS for redirect_uri in production
- For localhost development, Google allows http://localhost:8787

---

## Notes

- State parameter expires in 10 minutes; if callback takes longer, will fail (expected behavior)
- `prompt: 'consent'` forces the consent screen every time; remove for smoother UX once in production (optional)
- State parameter is cryptographically random and cannot be guessed
- Cookie is httpOnly so JavaScript cannot access it (prevents XSS attacks)
- SameSite=Lax prevents CSRF while allowing cross-site navigation

---

## Next Steps

- Build 19: Create callback endpoint to exchange code for tokens
