# Build 23: CloudFlare Turnstile CAPTCHA Integration

**Goal:** Implement CloudFlare Turnstile CAPTCHA integration for bot prevention on authentication flows, particularly for new user registration.

**Spec Extract:**
- CAPTCHA on registration (from Build 151)
- Zero tolerance for illegal activity
- Turnstile will be required on Google SSO initiation for new users
- From technical spec: Abuse Prevention → CAPTCHA on registration

---

## Prerequisites

- **Build 15:** API-FOUNDATION.md (API setup and shared utilities)

---

## Spec Details

**Turnstile Configuration:**
- Integration: CloudFlare Turnstile (free, privacy-focused)
- Site Key: Public key for embedding widget (frontend)
- Secret Key: Private key for verification (backend)
- Mode: Managed (CloudFlare shows appropriate challenge based on user behavior)

**Verification Endpoint:**
- POST to: `https://challenges.cloudflare.com/turnstile/v0/siteverify`
- Response: JSON with `success` boolean and `error-codes` array

**Flow Integration:**
- Turnstile widget shown before Google OAuth redirect for new users
- Turnstile response token sent with OAuth initiation
- Backend verifies token before redirecting to Google
- Returning users bypass Turnstile

**Environment Variables:**
- `TURNSTILE_SITE_KEY` - Public key for frontend
- `TURNSTILE_SECRET_KEY` - Secret key for backend verification

---

## Steps

### Step 1: Create Turnstile Verification Utility

Create: `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/auth/turnstile.ts`

```typescript
import { HTTPException } from 'hono/http-exception';

// Types
export interface TurnstileResponse {
  success: boolean;
  challenge_ts?: string;
  hostname?: string;
  'error-codes'?: string[];
  score?: number; // For managed challenge mode
  action?: string; // For token-level challenges
  cData?: string; // Additional debugging info
}

export interface VerifyResult {
  valid: boolean;
  error?: string;
  score?: number;
}

// Constants
const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const REQUEST_TIMEOUT = 5000; // 5 seconds
const MIN_SCORE = 0.3; // Minimum score for acceptance (if using scored challenge)

// Common error codes from Turnstile
const ERROR_CODES: Record<string, string> = {
  'missing-input-secret': 'Secret key is missing',
  'invalid-input-secret': 'Secret key is invalid or incorrect',
  'missing-input-response': 'Response token is missing',
  'invalid-input-response': 'Response token is invalid or expired',
  'invalid-widget-id': 'Widget ID is invalid',
  'invalid-parsed-json': 'Turnstile server error',
  'bad-request': 'Request was invalid',
  'timeout-or-duplicate': 'Challenge timeout or duplicate',
  'already-spent': 'Token already used',
};

/**
 * Verify Turnstile token with CloudFlare
 *
 * @param token - Turnstile response token from frontend
 * @param secretKey - Turnstile secret key from environment
 * @param remoteIp - Optional: client IP address for additional validation
 * @returns VerifyResult with validation status
 */
export async function verifyTurnstile(
  token: string,
  secretKey: string,
  remoteIp?: string
): Promise<VerifyResult> {
  // Validate inputs
  if (!token || !secretKey) {
    return {
      valid: false,
      error: 'Missing token or secret key',
    };
  }

  try {
    // Prepare request body
    const body = new FormData();
    body.append('secret', secretKey);
    body.append('response', token);
    if (remoteIp) {
      body.append('remoteip', remoteIp);
    }

    // Call Turnstile siteverify endpoint
    const response = await fetch(SITEVERIFY_URL, {
      method: 'POST',
      body: body,
    });

    if (!response.ok) {
      console.error(`Turnstile verification failed with status ${response.status}`);
      return {
        valid: false,
        error: 'Turnstile verification service error',
      };
    }

    const data = (await response.json()) as TurnstileResponse;

    // Check success flag
    if (!data.success) {
      const errorMessages = data['error-codes']
        ?.map((code) => ERROR_CODES[code] || code)
        .join(', ') || 'Unknown error';

      console.warn('Turnstile verification failed:', errorMessages);

      return {
        valid: false,
        error: `CAPTCHA verification failed: ${errorMessages}`,
      };
    }

    // Check score if applicable (for scored/managed challenges)
    if (data.score && data.score < MIN_SCORE) {
      console.warn(`Low Turnstile score: ${data.score}`);
      return {
        valid: false,
        error: 'Challenge score too low - suspected bot activity',
        score: data.score,
      };
    }

    return {
      valid: true,
      score: data.score,
    };
  } catch (error) {
    console.error('Turnstile verification error:', error);
    return {
      valid: false,
      error: 'Failed to verify CAPTCHA token',
    };
  }
}

/**
 * Middleware to require Turnstile verification
 * Use on endpoints that need bot protection
 */
export function createTurnstileMiddleware(requireTurnstile: boolean = true) {
  return async (c: any, next: any) => {
    if (!requireTurnstile) {
      return next();
    }

    try {
      const token = c.req.header('X-Turnstile-Token') ||
        c.req.query('turnstile_token');
      const { TURNSTILE_SECRET_KEY } = c.env;

      if (!token) {
        throw new HTTPException(400, {
          message: 'Turnstile token required',
        });
      }

      if (!TURNSTILE_SECRET_KEY) {
        throw new HTTPException(500, {
          message: 'Turnstile configuration missing',
        });
      }

      const clientIp =
        c.req.header('CF-Connecting-IP') ||
        c.req.header('X-Forwarded-For')?.split(',')[0] ||
        undefined;

      const result = await verifyTurnstile(token, TURNSTILE_SECRET_KEY, clientIp);

      if (!result.valid) {
        throw new HTTPException(400, {
          message: result.error || 'CAPTCHA verification failed',
        });
      }

      // Store result in context for use in handler
      c.set('turnstileVerified', true);
      c.set('turnstileScore', result.score);

      return next();
    } catch (error) {
      if (error instanceof HTTPException) {
        throw error;
      }

      console.error('Turnstile middleware error:', error);
      throw new HTTPException(500, {
        message: 'CAPTCHA verification error',
      });
    }
  };
}
```

### Step 2: Add Turnstile to Google OAuth Redirect

Edit: `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/auth.ts`

Modify the Google OAuth redirect endpoint to require Turnstile:

```typescript
import { verifyTurnstile } from '@/lib/auth/turnstile';

// Route: GET /api/auth/google
// Modified to check for new user and require Turnstile
authRouter.get('/google', async (c) => {
  try {
    const { GOOGLE_CLIENT_ID, GOOGLE_REDIRECT_URI, TURNSTILE_SECRET_KEY } = c.env;

    // Validate environment variables
    if (!GOOGLE_CLIENT_ID || !GOOGLE_REDIRECT_URI) {
      throw new HTTPException(500, {
        message: 'Google OAuth configuration missing',
      });
    }

    // Check if this is a new user attempt (optional query param)
    const isNewUser = c.req.query('new') === 'true';
    const turnstileToken = c.req.query('turnstile_token');

    // Require Turnstile for new users (not returning users)
    if (isNewUser) {
      if (!turnstileToken || !TURNSTILE_SECRET_KEY) {
        throw new HTTPException(400, {
          message: 'CAPTCHA verification required for new users',
        });
      }

      const clientIp =
        c.req.header('CF-Connecting-IP') ||
        c.req.header('X-Forwarded-For')?.split(',')[0];

      const result = await verifyTurnstile(turnstileToken, TURNSTILE_SECRET_KEY, clientIp);

      if (!result.valid) {
        throw new HTTPException(400, {
          message: result.error || 'CAPTCHA verification failed',
        });
      }

      // Store verification in cookie for audit trail
      setCookie(c, 'turnstile_verified', 'true', {
        httpOnly: true,
        secure: true,
        sameSite: 'Lax',
        maxAge: 300, // 5 minutes
        path: '/',
      });
    }

    // Generate state parameter
    const state = generateState();
    setCookie(c, 'oauth_state', state, {
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
      maxAge: 600,
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

### Step 3: Create Frontend Turnstile Component

Create: `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/auth/TurnstileWidget.tsx`

```typescript
import React, { useRef, useEffect } from 'react';

interface TurnstileWidgetProps {
  siteKey: string;
  onTokenReceived: (token: string) => void;
  onError?: (error: string) => void;
  theme?: 'light' | 'dark';
  size?: 'normal' | 'compact';
}

declare global {
  interface Window {
    turnstile?: {
      render: (
        selector: string,
        options: Record<string, any>
      ) => string;
      remove: (id: string) => void;
      reset: (id: string) => void;
      getResponse: (id: string) => string | undefined;
    };
  }
}

export const TurnstileWidget: React.FC<TurnstileWidgetProps> = ({
  siteKey,
  onTokenReceived,
  onError,
  theme = 'light',
  size = 'normal',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string>('');

  useEffect(() => {
    // Load Turnstile script if not already loaded
    if (!window.turnstile) {
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);

      script.onload = () => {
        renderWidget();
      };

      script.onerror = () => {
        onError?.('Failed to load Turnstile widget');
      };

      return () => {
        document.head.removeChild(script);
      };
    } else {
      renderWidget();
    }
  }, [siteKey]);

  const renderWidget = () => {
    if (containerRef.current && window.turnstile) {
      try {
        const widgetId = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          theme: theme,
          size: size,
          callback: (token: string) => {
            onTokenReceived(token);
          },
          'error-callback': () => {
            onError?.('Turnstile verification failed');
          },
          'expired-callback': () => {
            onError?.('Turnstile token expired');
          },
        });

        widgetIdRef.current = widgetId;
      } catch (error) {
        console.error('Failed to render Turnstile widget:', error);
        onError?.('Failed to render Turnstile widget');
      }
    }
  };

  const reset = () => {
    if (widgetIdRef.current && window.turnstile) {
      window.turnstile.reset(widgetIdRef.current);
    }
  };

  const getToken = (): string | undefined => {
    if (widgetIdRef.current && window.turnstile) {
      return window.turnstile.getResponse(widgetIdRef.current);
    }
    return undefined;
  };

  // Expose methods via ref (optional)
  React.useImperativeHandle(
    React.useRef({ reset, getToken }),
    () => ({ reset, getToken }),
    []
  );

  return (
    <div ref={containerRef} className="flex justify-center my-4">
      {/* Turnstile will render here */}
    </div>
  );
};
```

### Step 4: Create Sign-Up Form with Turnstile

Create: `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/auth/SignUpForm.tsx`

```typescript
import React, { useState, useRef } from 'react';
import { TurnstileWidget } from './TurnstileWidget';
import { GoogleOAuthButton } from './GoogleOAuthButton';

interface SignUpFormProps {
  turnstileSiteKey: string;
}

export const SignUpForm: React.FC<SignUpFormProps> = ({ turnstileSiteKey }) => {
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleTurnstileToken = (token: string) => {
    setTurnstileToken(token);
    setError(null);
  };

  const handleTurnstileError = (errorMsg: string) => {
    setError(errorMsg);
    setTurnstileToken(null);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!turnstileToken) {
      setError('Please complete the CAPTCHA');
      return;
    }

    setIsLoading(true);

    try {
      // Redirect to Google OAuth with Turnstile token
      const params = new URLSearchParams({
        new: 'true',
        turnstile_token: turnstileToken,
      });

      window.location.href = `/api/auth/google?${params.toString()}`;
    } catch (err) {
      setError('Failed to initiate sign up');
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSignUp} className="w-full max-w-md mx-auto p-6">
      <h2 className="text-2xl font-bold mb-6 text-center">Create Account</h2>

      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      <div className="mb-6">
        <TurnstileWidget
          siteKey={turnstileSiteKey}
          onTokenReceived={handleTurnstileToken}
          onError={handleTurnstileError}
          theme="light"
          size="normal"
        />
      </div>

      <button
        type="submit"
        disabled={!turnstileToken || isLoading}
        className="w-full mb-4 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? 'Creating Account...' : 'Create Account with Google'}
      </button>

      <div className="relative mb-4">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-300"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-white text-gray-500">or</span>
        </div>
      </div>

      <GoogleOAuthButton />
    </form>
  );
};
```

### Step 5: Add Turnstile Configuration

Create: `/Volumes/DataSSD/gitsrc/vfa_gallery/src/config/turnstile.ts`

```typescript
// Get Turnstile site key from environment
export const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || '';

if (!TURNSTILE_SITE_KEY) {
  console.warn('VITE_TURNSTILE_SITE_KEY environment variable is not set');
}

export const turnstileConfig = {
  siteKey: TURNSTILE_SITE_KEY,
  theme: 'light' as const,
  size: 'normal' as const,
};
```

### Step 6: Update Environment Configuration

Update: `/Volumes/DataSSD/gitsrc/vfa_gallery/wrangler.toml`

```toml
[env.development]
vars = { ENVIRONMENT = "development" }
env_vars = {
  TURNSTILE_SITE_KEY = "1x00000000000000000000AA",
  # Use: npx wrangler secret put TURNSTILE_SECRET_KEY --env development
}

[env.production]
vars = { ENVIRONMENT = "production" }
# Use: npx wrangler secret put TURNSTILE_SITE_KEY --env production
# Use: npx wrangler secret put TURNSTILE_SECRET_KEY --env production
```

Update: `/Volumes/DataSSD/gitsrc/vfa_gallery/.env.example` or `.env.development`

```bash
# Frontend - public key only
VITE_TURNSTILE_SITE_KEY=1x00000000000000000000AA

# Backend - secret key (never expose in frontend)
TURNSTILE_SECRET_KEY=your-secret-key-here
```

### Step 7: Create Tests

Create: `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/auth/__tests__/turnstile.test.ts`

```typescript
import { verifyTurnstile } from '../turnstile';

describe('Turnstile Verification', () => {
  const testSecretKey = 'test-secret-key';

  test('verifyTurnstile returns valid false with empty token', async () => {
    const result = await verifyTurnstile('', testSecretKey);
    expect(result.valid).toBe(false);
    expect(result.error).toBeTruthy();
  });

  test('verifyTurnstile returns valid false with empty secret', async () => {
    const result = await verifyTurnstile('test-token', '');
    expect(result.valid).toBe(false);
    expect(result.error).toBeTruthy();
  });

  // Note: Full integration tests require CloudFlare Turnstile test keys
  // These are available from CloudFlare documentation
});
```

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/auth/turnstile.ts` | Create | Turnstile verification utilities |
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/auth.ts` | Modify | Add Turnstile check to Google redirect |
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/auth/TurnstileWidget.tsx` | Create | Turnstile React component |
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/auth/SignUpForm.tsx` | Create | Sign-up form with Turnstile |
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/config/turnstile.ts` | Create | Turnstile configuration |
| `/Volumes/DataSSD/gitsrc/vfa_gallery/wrangler.toml` | Modify | Add Turnstile env vars |
| `/Volumes/DataSSD/gitsrc/vfa_gallery/.env.example` | Modify | Document env vars |
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/auth/__tests__/turnstile.test.ts` | Create | Unit tests |

---

## Verification

### 1. Get Turnstile Test Keys
```
1. Visit: https://dash.cloudflare.com/
2. Go to: Turnstile section
3. Copy Site Key and Secret Key
4. Use test keys: 1x00000000000000000000AA (always passes)
```

### 2. Test Turnstile Widget Renders
```bash
# In development
npm run dev

# Navigate to sign-up page
# Should see Turnstile widget (will show "Success" with test key)
```

### 3. Test Turnstile Verification Endpoint
```bash
# Get valid token from widget (use test key)
# Then test verification
curl -X POST \
  -F "secret=your-secret-key" \
  -F "response=token-from-widget" \
  https://challenges.cloudflare.com/turnstile/v0/siteverify

# Should return: { "success": true }
```

### 4. Test Google OAuth with Turnstile
```bash
# New user flow
1. Fill out sign-up form
2. Complete Turnstile widget
3. Click "Create Account"
4. Should redirect to Google OAuth (verify Turnstile token was sent)
5. Complete Google login
6. Should create new user record

# Check database
SELECT * FROM users WHERE email = 'new-user@gmail.com';
-- Should exist with status='pending'
```

### 5. Test Turnstile Token Expiry
```bash
# Get Turnstile token
# Wait 5+ minutes (token default expiry)
# Try to use old token
curl -X GET \
  "http://localhost:8787/api/auth/google?new=true&turnstile_token=old-expired-token"

# Should return 400 with "CAPTCHA verification failed"
```

### 6. Test Missing Turnstile for New User
```bash
# Try to create account without Turnstile
curl -X GET "http://localhost:8787/api/auth/google?new=true"

# Should return 400 with "CAPTCHA verification required"
```

### 7. Test Returning User Bypasses Turnstile
```bash
# Returning user flow
# Don't pass turnstile_token parameter
curl -X GET "http://localhost:8787/api/auth/google"

# Should redirect to Google OAuth (no Turnstile required)
```

### 8. Verify Frontend Form Validation
```bash
# In browser sign-up form
1. Try to click "Create Account" without completing Turnstile
2. Should show error "Please complete the CAPTCHA"
3. Complete Turnstile widget
4. Button should become enabled
5. Click button - should redirect
```

---

## Common Issues & Troubleshooting

**Issue:** Turnstile widget doesn't render
- Solution: Check VITE_TURNSTILE_SITE_KEY is set in .env
- Verify Turnstile script loads (DevTools Network tab)
- Check browser console for errors

**Issue:** "CAPTCHA verification required for new users" but not a new user flow
- Solution: Make sure you're not passing `?new=true` parameter for returning users
- Check user intent from context (new vs returning)

**Issue:** Token verification fails immediately after widget success
- Solution: Verify secret key matches between frontend request and backend
- Check token isn't being modified in transit
- Verify Request timeout didn't occur (5 second limit)

**Issue:** Test widget never shows "Success"
- Solution: Make sure using correct test site key: 1x00000000000000000000AA
- Check that theme/size props are valid

**Issue:** Error: "Already spent"
- Solution: Turnstile tokens are single-use
- If retrying same token, it will fail
- Get fresh token from widget

---

## Notes

- Test keys always pass verification (for development/testing)
- Production requires real Turnstile keys from CloudFlare dashboard
- Widget shows different challenges based on user behavior (managed mode)
- Token expires after 5 minutes by default
- No personal data collected by Turnstile
- Consider making Turnstile optional in development (skip check with env var)

---

## Next Steps

- Build 24: React Router setup for sign-up/login pages
- Build 25: Auth Context with Turnstile integration
- Build 151: Email verification flow (also uses CAPTCHA)
