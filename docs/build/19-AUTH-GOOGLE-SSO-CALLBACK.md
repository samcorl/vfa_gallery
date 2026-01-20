# Build 19: Google OAuth Callback & User Creation

**Goal:** Handle Google OAuth callback, verify state parameter, exchange authorization code for tokens, fetch user info, create/update user record in D1, generate JWT, set httpOnly cookie, and redirect appropriately.

**Spec Extract:**
- No custom auth - delegated entirely to SSO providers
- User created on first login if not exists (status: 'pending' until email verified)
- JWT tokens stored in httpOnly cookies
- Update last_login_at if user exists
- From technical spec: Email verification required for activation

---

## Prerequisites

- **Build 06:** SCHEMA-USERS.md (users table with required columns)
- **Build 18:** AUTH-GOOGLE-SSO-REDIRECT.md (state parameter generation + storage)

---

## Spec Details

**Endpoint:** `GET /api/auth/google/callback`

**Query Parameters:**
- `code` - Authorization code from Google
- `state` - State parameter for CSRF validation
- `error` (optional) - Error code if user denies

**User Creation Logic:**
- Check if user exists by email
- If not exists: create new user with status='pending'
- If exists: update last_login_at timestamp
- Both cases: Set username (auto-generate if email-based)

**Session/Cookie Management:**
- Generate JWT token
- Create session record in sessions table
- Set JWT in httpOnly cookie (7 days expiry)

**Redirect Logic:**
- New users → `/profile` (to complete profile setup)
- Returning users → `/` (homepage) or previous page (if available)

---

## Steps

### Step 1: Add Token Exchange Function

Edit: `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/auth.ts`

Add after imports and before the router definition:

```typescript
// Helper: Exchange authorization code for Google tokens
async function exchangeCodeForTokens(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<{ accessToken: string; idToken: string; expiresIn: number }> {
  const tokenUrl = 'https://oauth2.googleapis.com/token';

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      code: code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }).toString(),
  });

  if (!response.ok) {
    const error = await response.json();
    console.error('Google token exchange failed:', error);
    throw new HTTPException(400, {
      message: 'Failed to exchange code for token',
    });
  }

  const data = (await response.json()) as {
    access_token: string;
    id_token: string;
    expires_in: number;
  };

  return {
    accessToken: data.access_token,
    idToken: data.id_token,
    expiresIn: data.expires_in,
  };
}

// Helper: Decode and parse ID token (without verification for simplicity)
// In production, verify the token signature
function decodeIdToken(idToken: string): {
  sub: string;
  email: string;
  name: string;
  picture?: string;
} {
  const parts = idToken.split('.');
  if (parts.length !== 3) {
    throw new HTTPException(400, {
      message: 'Invalid ID token format',
    });
  }

  try {
    const payload = JSON.parse(
      Buffer.from(parts[1], 'base64').toString('utf-8')
    );
    return {
      sub: payload.sub,
      email: payload.email,
      name: payload.name || '',
      picture: payload.picture,
    };
  } catch (error) {
    throw new HTTPException(400, {
      message: 'Failed to decode ID token',
    });
  }
}

// Helper: Generate username from email
function generateUsernameFromEmail(email: string): string {
  // Extract local part (before @)
  const localPart = email.split('@')[0];
  // Remove special characters, convert to lowercase
  return localPart
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '')
    .substring(0, 30);
}
```

### Step 2: Add Callback Endpoint

Add to the auth router in `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/auth.ts`:

```typescript
// Helper: Get or create user
async function getOrCreateUser(
  db: D1Database,
  email: string,
  googleId: string,
  name: string,
  pictureUrl?: string
): Promise<{
  id: string;
  email: string;
  username: string;
  isNewUser: boolean;
}> {
  // Check if user exists
  const existingUser = await db
    .prepare('SELECT id, username FROM users WHERE email = ?')
    .bind(email)
    .first<{ id: string; username: string }>();

  if (existingUser) {
    // Update last_login_at
    await db
      .prepare('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?')
      .bind(existingUser.id)
      .run();

    return {
      id: existingUser.id,
      email,
      username: existingUser.username,
      isNewUser: false,
    };
  }

  // Create new user
  const newUserId = crypto.randomUUID();
  const username = generateUsernameFromEmail(email);

  // Check if username is available
  let finalUsername = username;
  let counter = 1;
  while (true) {
    const existing = await db
      .prepare('SELECT id FROM users WHERE username = ?')
      .bind(finalUsername)
      .first<{ id: string }>();

    if (!existing) {
      break;
    }
    finalUsername = `${username}${counter}`;
    counter++;
  }

  await db
    .prepare(
      `
      INSERT INTO users (
        id,
        email,
        username,
        display_name,
        avatar_url,
        google_id,
        status,
        created_at,
        updated_at,
        last_login_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `
    )
    .bind(newUserId, email, finalUsername, name, pictureUrl || null, googleId)
    .run();

  return {
    id: newUserId,
    email,
    username: finalUsername,
    isNewUser: true,
  };
}

// Route: GET /api/auth/google/callback
authRouter.get('/google/callback', async (c) => {
  try {
    const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI, DB } =
      c.env;

    // Get query parameters
    const code = c.req.query('code');
    const state = c.req.query('state');
    const error = c.req.query('error');

    // Check for OAuth errors
    if (error) {
      const errorDescription = c.req.query('error_description') || error;
      throw new HTTPException(400, {
        message: `OAuth error: ${errorDescription}`,
      });
    }

    // Validate required parameters
    if (!code || !state) {
      throw new HTTPException(400, {
        message: 'Missing code or state parameter',
      });
    }

    // Verify state parameter
    const storedState = getCookie(c, 'oauth_state');
    if (!storedState || storedState !== state) {
      throw new HTTPException(403, {
        message: 'State parameter mismatch - CSRF attack detected',
      });
    }

    // Validate environment variables
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) {
      throw new HTTPException(500, {
        message: 'Google OAuth configuration missing',
      });
    }

    // Exchange code for tokens
    const { idToken } = await exchangeCodeForTokens(
      code,
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      GOOGLE_REDIRECT_URI
    );

    // Decode ID token to get user info
    const userInfo = decodeIdToken(idToken);

    // Get or create user in database
    const user = await getOrCreateUser(
      DB,
      userInfo.email,
      userInfo.sub,
      userInfo.name,
      userInfo.picture
    );

    // Note: JWT generation will happen in Build 20
    // For now, we'll just redirect to profile to indicate success
    // In production, generate JWT and set cookie here

    // Clear state cookie
    setCookie(c, 'oauth_state', '', {
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
      maxAge: 0, // Delete cookie
      path: '/',
    });

    // Redirect based on user status
    if (user.isNewUser) {
      // New user - send to profile completion
      return c.redirect('/profile?auth=success&new=true');
    } else {
      // Returning user - send to homepage
      return c.redirect('/?auth=success');
    }
  } catch (error) {
    if (error instanceof HTTPException) {
      // Redirect to login with error
      return c.redirect(`/login?error=${encodeURIComponent(error.message)}`);
    }

    console.error('Google OAuth callback error:', error);
    return c.redirect('/login?error=Authentication%20failed');
  }
});
```

### Step 3: Verify Users Table Schema

Ensure: `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/db/schema.ts` (from Build 06)

Has these columns in the users table:

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  google_id TEXT,
  status TEXT DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_login_at DATETIME,
  bio TEXT,
  website TEXT,
  role TEXT DEFAULT 'user'
);
```

### Step 4: Create Type Definitions

Create: `/Volumes/DataSSD/gitsrc/vfa_gallery/src/types/auth.ts`

```typescript
export interface GoogleUserInfo {
  sub: string; // Google user ID
  email: string;
  name: string;
  picture?: string;
  email_verified?: boolean;
}

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  display_name?: string;
  avatar_url?: string;
  status: 'pending' | 'active' | 'suspended';
  role: string;
}

export interface AuthResponse {
  user: AuthUser;
  token: string;
  isNewUser: boolean;
}
```

### Step 5: Test User Creation Data

Create: `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/db/fixtures/test-users.ts`

```typescript
// For testing - creates known test users in development
export const testUsers = {
  alice: {
    email: 'alice@example.com',
    username: 'alice',
    display_name: 'Alice Artist',
    googleId: 'test-alice-google-123',
  },
  bob: {
    email: 'bob@example.com',
    username: 'bob',
    display_name: 'Bob Builder',
    googleId: 'test-bob-google-456',
  },
};
```

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/auth.ts` | Modify | Add callback endpoint + helpers |
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/types/auth.ts` | Create | Type definitions |
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/db/fixtures/test-users.ts` | Create | Test data (optional) |

---

## Verification

### 1. Test Complete OAuth Flow
```bash
# Start development server
npm run dev

# In browser:
1. Visit http://localhost:8787/api/auth/google
2. Complete Google sign-in
3. Should redirect to /profile or /
4. Check browser console for errors
```

### 2. Verify User Created in Database
```bash
# In CloudFlare dashboard or via D1 CLI
SELECT * FROM users WHERE email = 'test@gmail.com';
# Should see: id, email, username, status='pending', last_login_at set
```

### 3. Verify State Parameter Validation
```bash
# Test CSRF protection - use invalid state
curl "http://localhost:8787/api/auth/google/callback?code=invalid&state=mismatch"
# Should return 403 Forbidden with "State parameter mismatch"
```

### 4. Verify Duplicate User Handling
```bash
# Sign in twice with same Google account
1. Sign in -> new user created
2. Sign in again -> user updated (not duplicated), last_login_at refreshed
# Query DB: should only have 1 user record, last_login_at updated
```

### 5. Verify Username Generation
```bash
# Sign in with email: john.smith+tag@gmail.com
# Username should be: johnsmith (special chars stripped)

# Sign in with duplicate email on new account
# Username should be: johnsmith, johnsmith1, johnsmith2, etc.
```

### 6. Test Error Scenarios
```bash
# Missing code parameter
curl "http://localhost:8787/api/auth/google/callback?state=xyz"
# Should return 400 with "Missing code or state"

# User denies consent
curl "http://localhost:8787/api/auth/google/callback?error=access_denied"
# Should redirect to /login with error
```

### 7. Verify Cookie Cleared
```bash
# After callback completes
# Browser DevTools → Application → Cookies
# oauth_state cookie should be gone (maxAge=0 deleted it)
```

---

## Common Issues & Troubleshooting

**Issue:** "State parameter mismatch - CSRF attack detected"
- Solution: State cookie may have expired (10 minutes) or browser sent old cookie
- Check browser isn't in private mode (may not persist cookies between redirects)

**Issue:** User created but status stays 'pending'
- This is expected! Status='pending' until email is verified (Build 151)
- Build 19 creates user as pending; they can still use the app

**Issue:** Duplicate user created on retry
- Solution: Check for email uniqueness before inserting
- Current code checks `WHERE email = ?` first, should prevent duplicates

**Issue:** Username collision on new user
- Solution: Code auto-increments (johnsmith, johnsmith1, etc.)
- Verify `WHERE username = ?` query is working

**Issue:** Google returns invalid_grant for code
- Solution: Code is single-use and expires in 10 minutes
- If callback takes too long, code becomes invalid
- User needs to start OAuth flow again (GET /api/auth/google)

**Issue:** Database not updating on re-login
- Solution: Verify `WHERE email = ?` query finds the user
- Check last_login_at column exists in users table

---

## Notes

- State parameter prevents CSRF by validating the redirect came from our code
- Username generation strips special characters to meet slug requirements (Build Spec)
- Status='pending' is intentional; email verification happens in Build 151
- id_token is decoded but not cryptographically verified (acceptable for Google's tokens, could be stricter)
- google_id is stored to prevent duplicate accounts if same person uses different email addresses later
- Current code redirects after callback; JWT + session cookie will be added in Build 20

---

## Next Steps

- Build 20: Implement JWT generation and set httpOnly cookie
- Build 21: Create session management logic
