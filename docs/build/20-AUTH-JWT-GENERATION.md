# Build 20: JWT Token Generation & Validation

**Goal:** Create utilities for generating and verifying JWT tokens with proper payload structure, expiration handling, and secret key management.

**Spec Extract:**
- JWT tokens stored in httpOnly cookies
- Token expiry: 7 days
- JWT payload: { sub: id, email, username, role, iat, exp }
- No custom auth - delegated to SSO providers
- Signed with env.JWT_SECRET

---

## Prerequisites

- **Build 15:** API-FOUNDATION.md (shared types and utilities)

---

## Spec Details

**JWT Payload Structure:**
```json
{
  "sub": "user-id-uuid",
  "email": "user@example.com",
  "username": "john_smith",
  "role": "user",
  "iat": 1234567890,
  "exp": 1234567890
}
```

**Token Expiry:** 7 days (604,800 seconds)

**Signing Algorithm:** HS256 (HMAC with SHA-256)

**Secret Key Source:** `env.JWT_SECRET` environment variable

**Cookie Settings:**
- Name: `auth_token`
- httpOnly: true (no JavaScript access)
- secure: true (HTTPS only in production)
- sameSite: 'Lax' (CSRF protection)
- maxAge: 604,800 (7 days in seconds)

---

## Steps

### Step 1: Install JWT Library

Ensure package.json has jose library (lightweight JWT library for edge runtime):

Edit: `/Volumes/DataSSD/gitsrc/vfa_gallery/package.json`

```json
{
  "dependencies": {
    "jose": "^5.0.0"
  }
}
```

Install:
```bash
npm install jose
```

### Step 2: Create JWT Utility Module

Create: `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/auth/jwt.ts`

```typescript
import { SignJWT, jwtVerify } from 'jose';
import { TextEncoder } from 'util';

// Type definitions
export interface JWTPayload {
  sub: string; // user ID
  email: string;
  username: string;
  role: string;
  iat: number; // issued at
  exp: number; // expiration
}

export interface VerifyResult {
  valid: boolean;
  payload?: JWTPayload;
  error?: string;
}

// Constants
const TOKEN_EXPIRY_SECONDS = 7 * 24 * 60 * 60; // 7 days
const ALGORITHM = 'HS256';

// Helper: Get secret key as Uint8Array
function getSecretKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

// Helper: Validate secret key strength
function validateSecretKey(secret: string): boolean {
  // Minimum 32 characters for HS256 (256 bits)
  if (secret.length < 32) {
    console.warn('JWT_SECRET is less than 32 characters - not recommended for production');
  }
  return secret.length > 0;
}

/**
 * Generate a JWT token for a user
 *
 * @param userId - User's UUID
 * @param email - User's email
 * @param username - User's username
 * @param role - User's role (default: 'user')
 * @param secret - JWT secret key from environment
 * @returns JWT token string
 * @throws Error if secret is invalid or token generation fails
 */
export async function generateToken(
  userId: string,
  email: string,
  username: string,
  role: string,
  secret: string
): Promise<string> {
  // Validate inputs
  if (!userId || !email || !username || !secret) {
    throw new Error('Missing required parameters for token generation');
  }

  if (!validateSecretKey(secret)) {
    throw new Error('Invalid JWT secret key');
  }

  const secretKey = getSecretKey(secret);

  try {
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = now + TOKEN_EXPIRY_SECONDS;

    const token = await new SignJWT({
      sub: userId,
      email: email,
      username: username,
      role: role,
      iat: now,
      exp: expiresAt,
    })
      .setProtectedHeader({ alg: ALGORITHM })
      .setExpirationTime(expiresAt)
      .sign(secretKey);

    return token;
  } catch (error) {
    console.error('JWT generation failed:', error);
    throw new Error('Failed to generate JWT token');
  }
}

/**
 * Verify and decode a JWT token
 *
 * @param token - JWT token string
 * @param secret - JWT secret key from environment
 * @returns VerifyResult with payload if valid, error if invalid
 */
export async function verifyToken(
  token: string,
  secret: string
): Promise<VerifyResult> {
  // Validate inputs
  if (!token || !secret) {
    return {
      valid: false,
      error: 'Missing token or secret',
    };
  }

  if (!validateSecretKey(secret)) {
    return {
      valid: false,
      error: 'Invalid JWT secret key',
    };
  }

  const secretKey = getSecretKey(secret);

  try {
    const verified = await jwtVerify(token, secretKey);

    const payload = verified.payload as JWTPayload;

    return {
      valid: true,
      payload: {
        sub: payload.sub,
        email: payload.email,
        username: payload.username,
        role: payload.role,
        iat: payload.iat,
        exp: payload.exp,
      },
    };
  } catch (error) {
    let errorMessage = 'Token verification failed';

    if (error instanceof Error) {
      if (error.message.includes('exp')) {
        errorMessage = 'Token has expired';
      } else if (error.message.includes('signature')) {
        errorMessage = 'Invalid token signature';
      } else if (error.message.includes('malformed')) {
        errorMessage = 'Malformed token';
      } else {
        errorMessage = error.message;
      }
    }

    return {
      valid: false,
      error: errorMessage,
    };
  }
}

/**
 * Decode token without verification (for inspection only)
 * WARNING: Only use this if you need to inspect token before verification
 *
 * @param token - JWT token string
 * @returns Decoded payload or null if invalid format
 */
export function decodeTokenWithoutVerification(
  token: string
): JWTPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const payload = JSON.parse(
      Buffer.from(parts[1], 'base64').toString('utf-8')
    );

    return {
      sub: payload.sub,
      email: payload.email,
      username: payload.username,
      role: payload.role,
      iat: payload.iat,
      exp: payload.exp,
    };
  } catch {
    return null;
  }
}

/**
 * Check if token is expired without verification
 *
 * @param token - JWT token string
 * @returns true if token is expired, false otherwise
 */
export function isTokenExpired(token: string): boolean {
  const payload = decodeTokenWithoutVerification(token);
  if (!payload) {
    return true;
  }

  const now = Math.floor(Date.now() / 1000);
  return payload.exp <= now;
}

/**
 * Get remaining expiration time in seconds
 *
 * @param token - JWT token string
 * @returns Seconds until expiration, or 0 if expired
 */
export function getTokenExpiresIn(token: string): number {
  const payload = decodeTokenWithoutVerification(token);
  if (!payload) {
    return 0;
  }

  const now = Math.floor(Date.now() / 1000);
  const remaining = payload.exp - now;
  return Math.max(0, remaining);
}

/**
 * Get token expiry constant for cookie settings
 *
 * @returns Number of seconds for token expiry
 */
export function getTokenExpirySecs(): number {
  return TOKEN_EXPIRY_SECONDS;
}
```

### Step 3: Create Cookie Utility Module

Create: `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/auth/cookies.ts`

```typescript
import { Context } from 'hono';
import { setCookie as setHonoCookie, getCookie as getHonoCookie } from 'hono/cookie';
import { getTokenExpirySecs } from './jwt';

const AUTH_COOKIE_NAME = 'auth_token';
const COOKIE_PATH = '/';

/**
 * Set JWT token in httpOnly cookie
 */
export function setAuthCookie(c: Context, token: string): void {
  const maxAge = getTokenExpirySecs();

  setHonoCookie(c, AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: true, // HTTPS only
    sameSite: 'Lax',
    maxAge: maxAge,
    path: COOKIE_PATH,
  });
}

/**
 * Get JWT token from cookie
 */
export function getAuthCookie(c: Context): string | undefined {
  return getHonoCookie(c, AUTH_COOKIE_NAME);
}

/**
 * Clear JWT token cookie (logout)
 */
export function clearAuthCookie(c: Context): void {
  setHonoCookie(c, AUTH_COOKIE_NAME, '', {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    maxAge: 0, // Delete cookie
    path: COOKIE_PATH,
  });
}

/**
 * Check if token cookie exists (for quick checks)
 */
export function hasAuthCookie(c: Context): boolean {
  return !!getAuthCookie(c);
}
```

### Step 4: Add Environment Variable Configuration

Update: `/Volumes/DataSSD/gitsrc/vfa_gallery/wrangler.toml`

```toml
[env.development]
vars = { ENVIRONMENT = "development" }
env_vars = { JWT_SECRET = "dev-secret-key-please-change-in-production-32chars" }

[env.production]
vars = { ENVIRONMENT = "production" }
# Use: npx wrangler secret put JWT_SECRET --env production
```

Or set via CloudFlare secrets:

```bash
# Generate a strong secret key (32+ characters recommended)
# Use a cryptographically secure random generator
# Example: openssl rand -base64 32

# For development (NOT secure, only for local testing)
echo "dev-super-secret-key-minimum-32-chars-please!" > .env.local

# For production
npx wrangler secret put JWT_SECRET --env production
```

### Step 5: Create Tests/Examples

Create: `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/auth/__tests__/jwt.test.ts`

```typescript
import { generateToken, verifyToken, isTokenExpired, getTokenExpiresIn } from '../jwt';

describe('JWT Utilities', () => {
  const testSecret = 'test-secret-key-minimum-32-characters-required';
  const testUser = {
    userId: '123e4567-e89b-12d3-a456-426614174000',
    email: 'test@example.com',
    username: 'testuser',
    role: 'user',
  };

  test('generateToken creates valid token', async () => {
    const token = await generateToken(
      testUser.userId,
      testUser.email,
      testUser.username,
      testUser.role,
      testSecret
    );

    expect(token).toBeTruthy();
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
  });

  test('verifyToken validates correct token', async () => {
    const token = await generateToken(
      testUser.userId,
      testUser.email,
      testUser.username,
      testUser.role,
      testSecret
    );

    const result = await verifyToken(token, testSecret);

    expect(result.valid).toBe(true);
    expect(result.payload).toBeTruthy();
    expect(result.payload?.sub).toBe(testUser.userId);
    expect(result.payload?.email).toBe(testUser.email);
    expect(result.payload?.username).toBe(testUser.username);
    expect(result.payload?.role).toBe(testUser.role);
  });

  test('verifyToken rejects invalid signature', async () => {
    const token = await generateToken(
      testUser.userId,
      testUser.email,
      testUser.username,
      testUser.role,
      testSecret
    );

    const result = await verifyToken(token, 'different-secret-key-minimum-32-characters-required');

    expect(result.valid).toBe(false);
    expect(result.error).toContain('signature');
  });

  test('isTokenExpired returns false for fresh token', async () => {
    const token = await generateToken(
      testUser.userId,
      testUser.email,
      testUser.username,
      testUser.role,
      testSecret
    );

    expect(isTokenExpired(token)).toBe(false);
  });

  test('getTokenExpiresIn returns positive seconds', async () => {
    const token = await generateToken(
      testUser.userId,
      testUser.email,
      testUser.username,
      testUser.role,
      testSecret
    );

    const expiresIn = getTokenExpiresIn(token);
    expect(expiresIn).toBeGreaterThan(0);
    expect(expiresIn).toBeLessThanOrEqual(7 * 24 * 60 * 60); // 7 days
  });
});
```

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `/Volumes/DataSSD/gitsrc/vfa_gallery/package.json` | Modify | Add jose dependency |
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/auth/jwt.ts` | Create | JWT generation & verification |
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/auth/cookies.ts` | Create | JWT cookie management |
| `/Volumes/DataSSD/gitsrc/vfa_gallery/wrangler.toml` | Modify | Add JWT_SECRET env var |
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/auth/__tests__/jwt.test.ts` | Create | Unit tests (optional) |

---

## Verification

### 1. Generate Token
```typescript
import { generateToken } from '@/lib/auth/jwt';

const token = await generateToken(
  'user-123',
  'test@example.com',
  'testuser',
  'user',
  'your-secret-key-minimum-32-characters-here'
);

console.log(token); // Should print JWT with 3 dot-separated parts
```

### 2. Verify Token
```typescript
import { verifyToken } from '@/lib/auth/jwt';

const result = await verifyToken(token, 'your-secret-key-minimum-32-characters-here');

console.log(result.valid); // true
console.log(result.payload); // { sub, email, username, role, iat, exp }
```

### 3. Check Token Expiry
```typescript
import { isTokenExpired, getTokenExpiresIn } from '@/lib/auth/jwt';

console.log(isTokenExpired(token)); // false
console.log(getTokenExpiresIn(token)); // ~604800 (7 days in seconds)
```

### 4. Test Invalid Token
```typescript
const invalidResult = await verifyToken(token, 'wrong-secret-key');
console.log(invalidResult.valid); // false
console.log(invalidResult.error); // "Invalid token signature"
```

### 5. Test Cookie Operations
```typescript
import { setAuthCookie, getAuthCookie, clearAuthCookie } from '@/lib/auth/cookies';

// In Hono route handler
setAuthCookie(c, token);
const retrieved = getAuthCookie(c); // Should equal token

clearAuthCookie(c);
const afterClear = getAuthCookie(c); // Should be undefined
```

### 6. Decode Without Verification (Unsafe)
```typescript
import { decodeTokenWithoutVerification } from '@/lib/auth/jwt';

const payload = decodeTokenWithoutVerification(token);
console.log(payload?.email); // test@example.com
```

### 7. Run Tests
```bash
npm test -- src/lib/auth/__tests__/jwt.test.ts
# All tests should pass
```

---

## Common Issues & Troubleshooting

**Issue:** "Invalid JWT secret key"
- Solution: JWT_SECRET must be at least 32 characters
- Generate: `openssl rand -base64 32`

**Issue:** Token verification fails immediately after generation
- Solution: Verify secret key is exactly the same for generation and verification
- Check for leading/trailing whitespace in env var

**Issue:** Cookie not setting in browser
- Solution: Ensure `secure: true` is only for HTTPS; remove for localhost
- Check browser allows cookies (not in private mode)

**Issue:** "Token has expired" immediately
- Solution: Check server clock is accurate (JWT uses absolute timestamps)
- Sync system time: `ntpdate -s time.nist.gov` or similar

**Issue:** `jose` library not found
- Solution: Run `npm install jose`
- Verify package.json has jose dependency

---

## Notes

- JWTs are stateless - payload is not stored server-side, only verified with secret
- 7-day expiry matches typical session length for gallery users
- httpOnly cookie prevents XSS attacks from reading the token
- secure: true forces HTTPS in production (essential for security)
- sameSite: 'Lax' allows cross-site navigation but prevents CSRF
- Token refresh logic will be handled in Build 21

---

## Next Steps

- Build 19: Integrate generateToken into callback endpoint
- Build 21: Create session management for token refresh
- Build 22: Use clearAuthCookie in logout endpoint
