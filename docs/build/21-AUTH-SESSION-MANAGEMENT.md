# Build 21: Session Management & Token Refresh

**Goal:** Implement session tracking, validation, and automatic token refresh logic for seamless user experience while maintaining security.

**Spec Extract:**
- Session validation and refresh logic
- Lazy cleanup of expired sessions (delete on next login)
- Token expiry: 7 days
- If token expires in < 1 day, automatically issue new token
- From Build 13: sessions table tracks active sessions

---

## Prerequisites

- **Build 13:** SCHEMA-SUPPORTING.md (sessions table)
- **Build 20:** AUTH-JWT-GENERATION.md (generateToken, verifyToken functions)

---

## Spec Details

**Sessions Table Schema (from Build 13):**
```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  ip_address TEXT,
  user_agent TEXT
);
```

**Session Lifecycle:**
1. Create on login (after successful auth)
2. Validate on each API request
3. Update last_used_at on validation
4. Refresh token if expires in < 1 day (lazy refresh)
5. Delete expired sessions (on next login or manual cleanup)

**Refresh Logic:**
- Check if token expires in < 86,400 seconds (1 day)
- If so, generate new token and set new cookie
- Keep old session until token expires (allow both valid)
- Update session expires_at to new expiry time

---

## Steps

### Step 1: Create Session Utility Module

Create: `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/auth/session.ts`

```typescript
import crypto from 'crypto';
import { JWTPayload } from './jwt';

// Types
export interface Session {
  id: string;
  userId: string;
  tokenHash: string;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface SessionCreateOptions {
  userId: string;
  ipAddress?: string;
  userAgent?: string;
}

// Helper: Hash token for storage (never store raw tokens)
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Helper: Calculate expiration timestamp (7 days from now)
function calculateExpiresAt(): string {
  const expiresAtDate = new Date();
  expiresAtDate.setDate(expiresAtDate.getDate() + 7);
  return expiresAtDate.toISOString();
}

/**
 * Create a new session record in the database
 *
 * @param db - D1 Database binding
 * @param token - JWT token (will be hashed before storage)
 * @param options - Session creation options
 * @returns Session record
 */
export async function createSession(
  db: D1Database,
  token: string,
  options: SessionCreateOptions
): Promise<Session> {
  const sessionId = crypto.randomUUID();
  const tokenHash = hashToken(token);
  const expiresAt = calculateExpiresAt();
  const now = new Date().toISOString();

  try {
    await db
      .prepare(
        `
        INSERT INTO sessions (
          id,
          user_id,
          token_hash,
          created_at,
          last_used_at,
          expires_at,
          ip_address,
          user_agent
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `
      )
      .bind(
        sessionId,
        options.userId,
        tokenHash,
        now,
        now,
        expiresAt,
        options.ipAddress || null,
        options.userAgent || null
      )
      .run();

    return {
      id: sessionId,
      userId: options.userId,
      tokenHash,
      createdAt: now,
      lastUsedAt: now,
      expiresAt,
      ipAddress: options.ipAddress,
      userAgent: options.userAgent,
    };
  } catch (error) {
    console.error('Failed to create session:', error);
    throw new Error('Session creation failed');
  }
}

/**
 * Validate a session by token hash
 * Updates last_used_at timestamp on valid session
 *
 * @param db - D1 Database binding
 * @param token - JWT token
 * @returns Session record if valid, null if invalid/expired
 */
export async function validateSession(
  db: D1Database,
  token: string
): Promise<Session | null> {
  const tokenHash = hashToken(token);
  const now = new Date().toISOString();

  try {
    // Find session and check expiration
    const session = await db
      .prepare(
        `
        SELECT
          id,
          user_id as userId,
          token_hash as tokenHash,
          created_at as createdAt,
          last_used_at as lastUsedAt,
          expires_at as expiresAt,
          ip_address as ipAddress,
          user_agent as userAgent
        FROM sessions
        WHERE token_hash = ? AND expires_at > ?
        LIMIT 1
      `
      )
      .bind(tokenHash, now)
      .first<Session>();

    if (!session) {
      return null;
    }

    // Update last_used_at
    await db
      .prepare('UPDATE sessions SET last_used_at = ? WHERE id = ?')
      .bind(now, session.id)
      .run();

    return session;
  } catch (error) {
    console.error('Failed to validate session:', error);
    return null;
  }
}

/**
 * Check if token should be refreshed (expires in < 1 day)
 *
 * @param payload - JWT payload with exp claim
 * @returns true if token should be refreshed
 */
export function shouldRefreshToken(payload: JWTPayload): boolean {
  const now = Math.floor(Date.now() / 1000);
  const expiresIn = payload.exp - now;
  const oneDay = 86400; // 1 day in seconds

  return expiresIn < oneDay && expiresIn > 0;
}

/**
 * Update session expiration after token refresh
 *
 * @param db - D1 Database binding
 * @param sessionId - Session ID
 * @param newExpiresAt - New expiration datetime
 */
export async function updateSessionExpiry(
  db: D1Database,
  sessionId: string,
  newExpiresAt: string
): Promise<void> {
  try {
    await db
      .prepare('UPDATE sessions SET expires_at = ? WHERE id = ?')
      .bind(newExpiresAt, sessionId)
      .run();
  } catch (error) {
    console.error('Failed to update session expiry:', error);
    throw new Error('Session update failed');
  }
}

/**
 * Delete a session (logout)
 *
 * @param db - D1 Database binding
 * @param sessionId - Session ID or token
 * @param byToken - If true, sessionId is actually a token
 */
export async function deleteSession(
  db: D1Database,
  sessionId: string,
  byToken: boolean = false
): Promise<void> {
  try {
    if (byToken) {
      const tokenHash = hashToken(sessionId);
      await db
        .prepare('DELETE FROM sessions WHERE token_hash = ?')
        .bind(tokenHash)
        .run();
    } else {
      await db
        .prepare('DELETE FROM sessions WHERE id = ?')
        .bind(sessionId)
        .run();
    }
  } catch (error) {
    console.error('Failed to delete session:', error);
    throw new Error('Session deletion failed');
  }
}

/**
 * Clean up expired sessions (lazy cleanup - called periodically)
 * Returns number of sessions deleted
 *
 * @param db - D1 Database binding
 * @returns Number of deleted sessions
 */
export async function cleanupExpiredSessions(db: D1Database): Promise<number> {
  const now = new Date().toISOString();

  try {
    // Note: D1 doesn't return affected row count, so we'll estimate
    await db
      .prepare('DELETE FROM sessions WHERE expires_at < ?')
      .bind(now)
      .run();

    return 1; // Placeholder - actual count not available from D1
  } catch (error) {
    console.error('Failed to cleanup sessions:', error);
    throw new Error('Session cleanup failed');
  }
}

/**
 * Get all active sessions for a user
 *
 * @param db - D1 Database binding
 * @param userId - User ID
 * @returns Array of active sessions
 */
export async function getUserSessions(
  db: D1Database,
  userId: string
): Promise<Session[]> {
  const now = new Date().toISOString();

  try {
    const sessions = await db
      .prepare(
        `
        SELECT
          id,
          user_id as userId,
          token_hash as tokenHash,
          created_at as createdAt,
          last_used_at as lastUsedAt,
          expires_at as expiresAt,
          ip_address as ipAddress,
          user_agent as userAgent
        FROM sessions
        WHERE user_id = ? AND expires_at > ?
        ORDER BY last_used_at DESC
      `
      )
      .bind(userId, now)
      .all<Session>();

    return sessions.results || [];
  } catch (error) {
    console.error('Failed to get user sessions:', error);
    return [];
  }
}

/**
 * Revoke all sessions for a user (logout everywhere)
 *
 * @param db - D1 Database binding
 * @param userId - User ID
 */
export async function revokeAllUserSessions(
  db: D1Database,
  userId: string
): Promise<void> {
  try {
    await db
      .prepare('DELETE FROM sessions WHERE user_id = ?')
      .bind(userId)
      .run();
  } catch (error) {
    console.error('Failed to revoke user sessions:', error);
    throw new Error('Failed to revoke sessions');
  }
}
```

### Step 2: Create Session Middleware

Create: `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/middleware/session.ts`

```typescript
import { Hono, Context, Next } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { generateToken, verifyToken, JWTPayload, getTokenExpirySecs } from '@/lib/auth/jwt';
import {
  validateSession,
  shouldRefreshToken,
  updateSessionExpiry,
  deleteSession,
  cleanupExpiredSessions,
} from '@/lib/auth/session';
import { getAuthCookie, setAuthCookie } from '@/lib/auth/cookies';

interface HonoContext {
  Bindings: {
    JWT_SECRET: string;
    DB: D1Database;
  };
  Variables: {
    user: {
      id: string;
      email: string;
      username: string;
      role: string;
    };
    tokenPayload: JWTPayload;
    sessionId: string;
  };
}

/**
 * Session validation middleware
 * Verifies JWT token, validates session, and handles token refresh
 */
export async function sessionMiddleware(c: Context<HonoContext>, next: Next) {
  try {
    const token = getAuthCookie(c);
    const { JWT_SECRET, DB } = c.env;

    if (!token) {
      throw new HTTPException(401, {
        message: 'No authentication token',
      });
    }

    // Verify JWT signature
    const verifyResult = await verifyToken(token, JWT_SECRET);
    if (!verifyResult.valid || !verifyResult.payload) {
      throw new HTTPException(401, {
        message: verifyResult.error || 'Invalid token',
      });
    }

    // Validate session in database
    const session = await validateSession(DB, token);
    if (!session) {
      throw new HTTPException(401, {
        message: 'Session not found or expired',
      });
    }

    // Store in context for use in handlers
    c.set('user', {
      id: verifyResult.payload.sub,
      email: verifyResult.payload.email,
      username: verifyResult.payload.username,
      role: verifyResult.payload.role,
    });
    c.set('tokenPayload', verifyResult.payload);
    c.set('sessionId', session.id);

    // Check if token should be refreshed
    if (shouldRefreshToken(verifyResult.payload)) {
      try {
        // Generate new token
        const newToken = await generateToken(
          verifyResult.payload.sub,
          verifyResult.payload.email,
          verifyResult.payload.username,
          verifyResult.payload.role,
          JWT_SECRET
        );

        // Set new token in cookie
        setAuthCookie(c, newToken);

        // Update session expiry in database
        const expiresAtDate = new Date();
        expiresAtDate.setSeconds(expiresAtDate.getSeconds() + getTokenExpirySecs());
        await updateSessionExpiry(DB, session.id, expiresAtDate.toISOString());

        // Update context with new payload
        const newVerifyResult = await verifyToken(newToken, JWT_SECRET);
        if (newVerifyResult.valid && newVerifyResult.payload) {
          c.set('tokenPayload', newVerifyResult.payload);
        }
      } catch (error) {
        console.error('Token refresh failed:', error);
        // Continue with old token; refresh failure is not fatal
      }
    }

    // Lazy cleanup: run cleanup on 1% of requests
    if (Math.random() < 0.01) {
      await cleanupExpiredSessions(DB).catch((err) => {
        console.error('Cleanup error (non-fatal):', err);
      });
    }

    await next();
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }

    console.error('Session middleware error:', error);
    throw new HTTPException(401, {
      message: 'Authentication failed',
    });
  }
}
```

### Step 3: Integrate Session Middleware into Auth Callback

Edit: `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/auth.ts`

Add to the callback endpoint (after creating/updating user):

```typescript
import { createSession } from '@/lib/auth/session';
import { generateToken } from '@/lib/auth/jwt';
import { setAuthCookie } from '@/lib/auth/cookies';

// In the callback handler, after getOrCreateUser:

// Generate JWT token
const jwtToken = await generateToken(
  user.id,
  user.email,
  user.username,
  'user', // Default role
  env.JWT_SECRET
);

// Create session in database
const session = await createSession(DB, jwtToken, {
  userId: user.id,
  ipAddress: c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For'),
  userAgent: c.req.header('User-Agent'),
});

// Set JWT in httpOnly cookie
setAuthCookie(c, jwtToken);

// Clear state cookie
setCookie(c, 'oauth_state', '', {
  httpOnly: true,
  secure: true,
  sameSite: 'Lax',
  maxAge: 0,
  path: '/',
});

// Redirect based on user status
if (user.isNewUser) {
  return c.redirect('/profile?auth=success&new=true');
} else {
  return c.redirect('/?auth=success');
}
```

### Step 4: Register Middleware

Edit: `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/index.ts`

Add session middleware to protected routes:

```typescript
import { sessionMiddleware } from './middleware/session';

// For protected routes (example):
app.use('/api/users/*', sessionMiddleware);
app.use('/api/artworks/*', sessionMiddleware);
app.use('/api/galleries/*', sessionMiddleware);

// OR apply globally with exceptions:
// app.use('*', async (c, next) => {
//   const isPublicRoute = [
//     '/api/auth/google',
//     '/api/auth/google/callback',
//     '/api/browse',
//     '/api/search',
//     '/api/g/*' // public gallery routes
//   ].some(path => c.req.path.startsWith(path));
//
//   if (!isPublicRoute) {
//     return sessionMiddleware(c, next);
//   }
//   return next();
// });
```

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/auth/session.ts` | Create | Session management utilities |
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/middleware/session.ts` | Create | Session validation middleware |
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/auth.ts` | Modify | Integrate session creation in callback |
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/index.ts` | Modify | Register session middleware |

---

## Verification

### 1. Session Created on Login
```sql
-- In CloudFlare D1
SELECT * FROM sessions WHERE user_id = 'your-user-id';
-- Should see new session record with token_hash, expires_at
```

### 2. Session Validated on Protected Request
```bash
# Make authenticated request
curl -H "Cookie: auth_token=your-jwt-token" http://localhost:8787/api/users/me
# Should succeed and return user data
```

### 3. Token Refresh on Near-Expiry
```bash
# Monitor browser DevTools → Application → Cookies
# Make request when token has < 1 day remaining
# Cookie value should change (new token issued)
```

### 4. Session Expires After 7 Days
```sql
-- Create test session with past expiry
UPDATE sessions SET expires_at = datetime('now', '-1 day') WHERE id = 'test-id';

-- Try to use expired session
curl -H "Cookie: auth_token=old-token" http://localhost:8787/api/users/me
-- Should return 401 Unauthorized
```

### 5. Last Used At Updated
```sql
-- Check initial last_used_at
SELECT last_used_at FROM sessions WHERE id = 'test-id';

-- Make authenticated request

-- Check updated timestamp
SELECT last_used_at FROM sessions WHERE id = 'test-id';
-- Should be more recent
```

### 6. Cleanup Removes Expired Sessions
```sql
-- View session count
SELECT COUNT(*) FROM sessions;

-- Run cleanup (happens on ~1% of requests)
-- OR manually call cleanupExpiredSessions()

-- View updated count
SELECT COUNT(*) FROM sessions;
-- Should be reduced if expired sessions existed
```

### 7. Get User Sessions
```bash
# Get all active sessions for logged-in user
curl -H "Cookie: auth_token=your-jwt-token" http://localhost:8787/api/users/me/sessions
# Should return array of sessions
```

---

## Common Issues & Troubleshooting

**Issue:** "Session not found or expired"
- Solution: Check session's expires_at timestamp
- Verify sessions table query is correct (check column name aliases)
- Token validation fails before session lookup?

**Issue:** Token not refreshing automatically
- Solution: Check if token actually has < 1 day remaining
- Verify shouldRefreshToken() is being called
- Check JWT_SECRET hasn't changed (would fail new token generation)

**Issue:** Sessions table growing indefinitely
- Solution: Cleanup only runs on ~1% of requests
- Add scheduled background job to cleanup expired sessions regularly
- Or manually call cleanupExpiredSessions periodically

**Issue:** Hash mismatch when validating session
- Solution: Verify token hashing is consistent (sha256)
- Check token isn't being modified between storage and validation
- Ensure same JWT_SECRET is used

**Issue:** IP address or User-Agent fields empty
- Solution: These are optional - code uses null if not provided
- Check CF-Connecting-IP header is passed (CloudFlare specific)

---

## Notes

- Sessions are tracked separately from tokens for audit trail and multi-device support
- Token refresh is silent (user doesn't notice) - happens before expiry
- Cleanup is lazy (1% of requests) to avoid performance impact
- Users can have multiple active sessions (logged in from different devices)
- Logout will be implemented in Build 22 using deleteSession()

---

## Next Steps

- Build 22: Create logout endpoint using deleteSession()
- Build 16: Integrate session middleware into auth check middleware
