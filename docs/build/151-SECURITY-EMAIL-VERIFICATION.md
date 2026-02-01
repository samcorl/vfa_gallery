# Build 151: Security - Email Verification

## Goal
Implement email verification flow for new account signups. Require users to verify their email address before accessing certain platform features. Send verification emails with secure tokens and track verification status.

---

## Spec Extract

From TECHNICAL-SPEC.md:
- **Email verification required for activation**: Part of abuse prevention
- **CAPTCHA on registration**: Combined with email verification for security
- **Zero tolerance for illegal activity**: Email verification helps prevent spam accounts
- **Users Table**: Includes `email_verified_at` field to track verification status

---

## Prerequisites

**Must complete before starting:**
- **Build 06**: Users table with `email_verified_at` field
- **Build 13**: Supporting tables (to add verification_tokens)
- **Build 18-23**: Authentication flow (OAuth and JWT setup)
- **Build 149**: Activity logging (to log verification events)

---

## Steps

### Step 1: Create Verification Tokens Table

Add a new table to store email verification tokens.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/migrations/[TIMESTAMP]_create_verification_tokens.sql`

```sql
-- Create verification_tokens table for email verification
CREATE TABLE verification_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  token_hash TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL,  -- 'email_verification', 'password_reset', 'email_change'
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Index for quick lookup by token_hash
CREATE INDEX idx_verification_tokens_token_hash ON verification_tokens(token_hash);
CREATE INDEX idx_verification_tokens_user_id_type ON verification_tokens(user_id, type);
CREATE INDEX idx_verification_tokens_expires_at ON verification_tokens(expires_at);
```

**Apply migration:**
```bash
wrangler d1 execute site --file=migrations/[TIMESTAMP]_create_verification_tokens.sql
```

### Step 2: Create Email Service Module

Create a module to handle email sending via a service (e.g., SendGrid, Mailgun, Resend).

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/email/email-service.ts`

```typescript
/**
 * Email service configuration and sender
 * Using Resend as example (popular for Workers)
 * Can be adapted for SendGrid, Mailgun, AWS SES, etc.
 */

export interface EmailOptions {
  to: string
  subject: string
  html: string
  text?: string
}

/**
 * Send email via Resend API
 * Requires RESEND_API_KEY environment variable
 */
export async function sendEmail(
  apiKey: string,
  options: EmailOptions
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'noreply@vfa.gallery',
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      return {
        success: false,
        error: error.message || 'Failed to send email',
      }
    }

    const data = await response.json<{ id: string }>()
    return {
      success: true,
      messageId: data.id,
    }
  } catch (error) {
    console.error('Email send error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Generate HTML email template for email verification
 */
export function getVerificationEmailTemplate(
  userEmail: string,
  verificationUrl: string,
  userName?: string
): string {
  const displayName = userName || 'Artist'

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { border-bottom: 1px solid #e0e0e0; padding-bottom: 20px; }
    .content { padding: 20px 0; }
    .button { display: inline-block; padding: 12px 24px; background-color: #0066cc; color: white; text-decoration: none; border-radius: 4px; font-weight: 500; }
    .footer { border-top: 1px solid #e0e0e0; padding-top: 20px; font-size: 12px; color: #999; }
    .code { background-color: #f5f5f5; padding: 10px; font-family: monospace; border-radius: 4px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>Welcome to VFA.gallery, ${displayName}!</h2>
    </div>

    <div class="content">
      <p>Thank you for signing up. To activate your account, please verify your email address by clicking the button below:</p>

      <p style="text-align: center; margin: 30px 0;">
        <a href="${verificationUrl}" class="button">Verify Email Address</a>
      </p>

      <p style="color: #666; font-size: 14px;">
        Or copy and paste this link in your browser:<br>
        <code class="code">${verificationUrl}</code>
      </p>

      <p style="color: #999; font-size: 14px;">
        This verification link will expire in 24 hours for security reasons.
      </p>
    </div>

    <div class="footer">
      <p>
        © 2026 VFA.gallery. All rights reserved.<br>
        <a href="https://vfa.gallery" style="color: #0066cc; text-decoration: none;">vfa.gallery</a>
      </p>
    </div>
  </div>
</body>
</html>
  `
}

/**
 * Generate plain text version of verification email
 */
export function getVerificationEmailText(verificationUrl: string): string {
  return `
Verify your VFA.gallery email address

Please click the link below to verify your email address and activate your account:

${verificationUrl}

This link will expire in 24 hours.

Questions? Contact us at support@vfa.gallery
  `
}
```

### Step 3: Create Verification Token Service

Create a service to generate and manage verification tokens.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/security/verification-service.ts`

```typescript
import type { D1Database } from '@cloudflare/workers-types'
import crypto from 'crypto'
import { generateId } from '../utils/id'

/**
 * Token validity period (24 hours)
 */
const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000

/**
 * Generate secure verification token
 * @returns { token: plain token for email, tokenHash: hash for storage }
 */
function generateVerificationToken(): { token: string; tokenHash: string } {
  const token = crypto.randomUUID() + '-' + crypto.randomUUID()

  const tokenHash = crypto
    .createHash('sha256')
    .update(token)
    .digest('hex')

  return { token, tokenHash }
}

/**
 * Create email verification token for a user
 */
export async function createVerificationToken(
  db: D1Database,
  userId: string,
  type: 'email_verification' | 'password_reset' | 'email_change' = 'email_verification'
): Promise<string> {
  const { token, tokenHash } = generateVerificationToken()
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MS).toISOString()

  await db
    .prepare(
      `
      INSERT INTO verification_tokens (id, user_id, token, token_hash, type, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      `
    )
    .bind(
      generateId(),
      userId,
      token,
      tokenHash,
      type,
      expiresAt,
      new Date().toISOString()
    )
    .run()

  return token
}

/**
 * Verify a token and return user if valid
 */
export async function verifyToken(
  db: D1Database,
  token: string,
  type: 'email_verification' | 'password_reset' | 'email_change'
): Promise<{ valid: boolean; userId?: string; error?: string }> {
  // Hash the token to look up
  const tokenHash = crypto
    .createHash('sha256')
    .update(token)
    .digest('hex')

  // Look up token
  const record = await db
    .prepare(
      `
      SELECT id, user_id, expires_at, used_at FROM verification_tokens
      WHERE token_hash = ? AND type = ?
      `
    )
    .bind(tokenHash, type)
    .first<{ id: string; user_id: string; expires_at: string; used_at: string | null }>()

  if (!record) {
    return { valid: false, error: 'Token not found' }
  }

  // Check if already used
  if (record.used_at) {
    return { valid: false, error: 'Token already used' }
  }

  // Check if expired
  if (new Date(record.expires_at) < new Date()) {
    return { valid: false, error: 'Token expired' }
  }

  return { valid: true, userId: record.user_id }
}

/**
 * Mark token as used
 */
export async function markTokenAsUsed(
  db: D1Database,
  token: string,
  type: 'email_verification' | 'password_reset' | 'email_change'
): Promise<void> {
  const tokenHash = crypto
    .createHash('sha256')
    .update(token)
    .digest('hex')

  await db
    .prepare(
      `
      UPDATE verification_tokens
      SET used_at = ?
      WHERE token_hash = ? AND type = ?
      `
    )
    .bind(new Date().toISOString(), tokenHash, type)
    .run()
}

/**
 * Clean up expired tokens (call periodically)
 */
export async function cleanupExpiredTokens(db: D1Database): Promise<void> {
  const now = new Date().toISOString()

  await db
    .prepare(
      `
      DELETE FROM verification_tokens
      WHERE expires_at < ? AND used_at IS NOT NULL
      `
    )
    .bind(now)
    .run()
}
```

### Step 4: Create Email Verification API Endpoints

Create endpoints to handle verification email sending and token verification.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/routes/api/auth/email-verification.ts`

```typescript
import { Hono } from 'hono'
import type { HonoContext } from '../../../types/env'
import { requireAuth } from '../../../lib/api/middleware/auth'
import {
  createVerificationToken,
  verifyToken,
  markTokenAsUsed,
} from '../../../lib/api/security/verification-service'
import { sendEmail } from '../../../lib/email/email-service'
import {
  getVerificationEmailTemplate,
  getVerificationEmailText,
} from '../../../lib/email/email-service'
import { logActivity, ActivityAction, EntityType } from '../../../lib/api/security/activity-logger'

const router = new Hono<HonoContext>()

/**
 * POST /auth/email/send-verification
 * Send verification email to current user
 * Authenticated only
 */
router.post('/send-verification', requireAuth, async (c) => {
  const db = c.env.DB as D1Database
  const user = c.get('user')

  // Get user email
  const userRecord = await db
    .prepare('SELECT email, username, email_verified_at FROM users WHERE id = ?')
    .bind(user.userId)
    .first<{ email: string; username: string; email_verified_at: string | null }>()

  if (!userRecord) {
    return c.json({ error: 'User not found' }, 404)
  }

  // Check if already verified
  if (userRecord.email_verified_at) {
    return c.json(
      { error: 'Email already verified' },
      400
    )
  }

  // Create verification token
  const token = await createVerificationToken(db, user.userId, 'email_verification')

  // Build verification URL
  const baseUrl = c.req.header('origin') || 'https://vfa.gallery'
  const verificationUrl = `${baseUrl}/verify-email?token=${encodeURIComponent(token)}`

  // Send email
  const resendApiKey = c.env.RESEND_API_KEY as string
  const emailResult = await sendEmail(resendApiKey, {
    to: userRecord.email,
    subject: 'Verify Your VFA.gallery Email Address',
    html: getVerificationEmailTemplate(userRecord.email, verificationUrl, userRecord.username),
    text: getVerificationEmailText(verificationUrl),
  })

  if (!emailResult.success) {
    console.error('Email send failed:', emailResult.error)
    return c.json(
      { error: 'Failed to send verification email' },
      500
    )
  }

  // Log the action
  await logActivity(db, c, {
    action: ActivityAction.USER_SIGNUP,  // Or create new action: EMAIL_VERIFICATION_SENT
    userId: user.userId,
    entityType: EntityType.USER,
    entityId: user.userId,
    metadata: { messageId: emailResult.messageId },
  })

  return c.json({
    success: true,
    message: 'Verification email sent',
    email: userRecord.email,
  })
})

/**
 * POST /auth/email/verify
 * Verify email with token
 * Public endpoint
 */
router.post('/verify', async (c) => {
  const db = c.env.DB as D1Database
  const body = await c.req.json<{ token: string }>()

  if (!body.token) {
    return c.json({ error: 'Token required' }, 400)
  }

  // Verify token
  const result = await verifyToken(db, body.token, 'email_verification')

  if (!result.valid) {
    return c.json(
      { error: 'Invalid or expired token' },
      401
    )
  }

  const userId = result.userId!

  // Mark token as used
  await markTokenAsUsed(db, body.token, 'email_verification')

  // Update user to mark email as verified
  const now = new Date().toISOString()
  await db
    .prepare('UPDATE users SET email_verified_at = ?, updated_at = ? WHERE id = ?')
    .bind(now, now, userId)
    .run()

  // Log the verification
  await logActivity(db, c, {
    action: ActivityAction.EMAIL_VERIFIED,
    userId,
    entityType: EntityType.USER,
    entityId: userId,
  })

  return c.json({
    success: true,
    message: 'Email verified successfully',
    userId,
  })
})

/**
 * GET /auth/email/verification-status
 * Check verification status for current user
 * Authenticated only
 */
router.get('/verification-status', requireAuth, async (c) => {
  const db = c.env.DB as D1Database
  const user = c.get('user')

  const userRecord = await db
    .prepare('SELECT email, email_verified_at FROM users WHERE id = ?')
    .bind(user.userId)
    .first<{ email: string; email_verified_at: string | null }>()

  if (!userRecord) {
    return c.json({ error: 'User not found' }, 404)
  }

  return c.json({
    email: userRecord.email,
    verified: !!userRecord.email_verified_at,
    verifiedAt: userRecord.email_verified_at,
  })
})

/**
 * POST /auth/email/resend-verification
 * Resend verification email (rate limited)
 * Authenticated only
 */
router.post('/resend-verification', requireAuth, async (c) => {
  const db = c.env.DB as D1Database
  const user = c.get('user')

  // Check if already verified
  const userRecord = await db
    .prepare('SELECT email_verified_at FROM users WHERE id = ?')
    .bind(user.userId)
    .first<{ email_verified_at: string | null }>()

  if (userRecord?.email_verified_at) {
    return c.json(
      { error: 'Email already verified' },
      400
    )
  }

  // Check if recent token was created (prevent spam)
  const recentToken = await db
    .prepare(
      `
      SELECT id FROM verification_tokens
      WHERE user_id = ? AND type = 'email_verification'
        AND created_at >= datetime('now', '-5 minutes')
      LIMIT 1
      `
    )
    .bind(user.userId)
    .first()

  if (recentToken) {
    return c.json(
      { error: 'Verification email already sent. Please wait 5 minutes before requesting another.' },
      429
    )
  }

  // Send verification email (same as /send-verification)
  // Delegate to existing logic or create shared function
  const token = await createVerificationToken(db, user.userId, 'email_verification')

  const baseUrl = c.req.header('origin') || 'https://vfa.gallery'
  const verificationUrl = `${baseUrl}/verify-email?token=${encodeURIComponent(token)}`

  const userEmail = await db
    .prepare('SELECT email, username FROM users WHERE id = ?')
    .bind(user.userId)
    .first<{ email: string; username: string }>()

  const resendApiKey = c.env.RESEND_API_KEY as string
  await sendEmail(resendApiKey, {
    to: userEmail!.email,
    subject: 'Verify Your VFA.gallery Email Address',
    html: getVerificationEmailTemplate(userEmail!.email, verificationUrl, userEmail!.username),
    text: getVerificationEmailText(verificationUrl),
  })

  return c.json({
    success: true,
    message: 'Verification email resent',
  })
})

export default router
```

### Step 5: Update Signup Flow to Require Verification

Modify the signup endpoint to set initial status and require verification.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/routes/api/auth/signup.ts`

```typescript
/**
 * Update the signup handler to:
 * 1. Set status to 'pending' until email verified
 * 2. Send verification email
 */

export async function handleSignup(c: HonoContext) {
  const db = c.env.DB as D1Database
  const body = await c.req.json()

  // Create user with 'pending' status
  const user = await db
    .prepare(
      `
      INSERT INTO users (
        id, email, username, display_name, status, role, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `
    )
    .bind(
      generateId(),
      body.email,
      body.username,
      body.displayName,
      'pending',  // Set to pending until email verified
      'user',
      new Date().toISOString(),
      new Date().toISOString()
    )
    .run()

  const userId = user.meta.last_row_id

  // Create verification token
  const token = await createVerificationToken(db, userId, 'email_verification')

  // Send verification email
  const baseUrl = c.req.header('origin') || 'https://vfa.gallery'
  const verificationUrl = `${baseUrl}/verify-email?token=${encodeURIComponent(token)}`

  const resendApiKey = c.env.RESEND_API_KEY as string
  await sendEmail(resendApiKey, {
    to: body.email,
    subject: 'Verify Your VFA.gallery Email Address',
    html: getVerificationEmailTemplate(body.email, verificationUrl, body.username),
    text: getVerificationEmailText(verificationUrl),
  })

  // Log signup
  await logSignupActivity(c, userId, body.email)

  return c.json(
    {
      success: true,
      message: 'Account created. Please check your email to verify your address.',
      userId,
    },
    201
  )
}
```

### Step 6: Protect Features Behind Email Verification

Update endpoints that should require email verification.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/middleware/email-verified.ts`

```typescript
import { createMiddleware } from 'hono/factory'
import type { HonoContext } from '../../../types/env'

/**
 * Middleware to require email verification
 * Use on endpoints that should only be available to verified users
 */
export const requireEmailVerified = createMiddleware<HonoContext>(async (c, next) => {
  const db = c.env.DB as D1Database
  const user = c.get('user')

  if (!user) {
    throw new Error('Authentication required')
  }

  const userRecord = await db
    .prepare('SELECT email_verified_at FROM users WHERE id = ?')
    .bind(user.userId)
    .first<{ email_verified_at: string | null }>()

  if (!userRecord?.email_verified_at) {
    return c.json(
      {
        error: 'Email verification required',
        message: 'Please verify your email address to access this feature.',
      },
      403
    )
  }

  await next()
})
```

Apply this middleware to protected endpoints:

```typescript
// In artworks.ts or other endpoints
router.post('/artworks', requireAuth, requireEmailVerified, createArtworkHandler)
router.post('/galleries', requireAuth, requireEmailVerified, createGalleryHandler)
```

---

## Files to Create/Modify

| Path | Action | Purpose |
|------|--------|---------|
| `/Volumes/DataSSD/gitsrc/vfa_gallery/migrations/[TIMESTAMP]_create_verification_tokens.sql` | Create | Verification tokens table |
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/email/email-service.ts` | Create | Email sending service |
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/security/verification-service.ts` | Create | Token generation and verification |
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/routes/api/auth/email-verification.ts` | Create | Email verification endpoints |
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/middleware/email-verified.ts` | Create | Middleware to enforce verification |
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/routes/api/auth/signup.ts` | Modify | Send verification email on signup |
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/routes/api/artworks.ts` | Modify | Apply email verification requirement |
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/routes/api/galleries.ts` | Modify | Apply email verification requirement |

---

## Environment Variables Required

Add these to `wrangler.toml` and `.env.local`:

```toml
[env.production]
vars = { RESEND_API_KEY = "re_xxxxx" }

[env.development]
vars = { RESEND_API_KEY = "re_xxxxx" }
```

---

## Verification

### Test 1: User signs up and receives verification email
```bash
# Register a new user
curl -X POST http://localhost:8787/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email":"newuser@example.com",
    "username":"newuser",
    "password":"password123"
  }'

# Response should indicate email sent and status is 'pending'
```

### Test 2: Verify email with token
```bash
# Extract token from email or check database
wrangler d1 execute site --command="SELECT token FROM verification_tokens WHERE user_id = '{userId}' LIMIT 1;"

# Use token to verify
curl -X POST http://localhost:8787/auth/email/verify \
  -H "Content-Type: application/json" \
  -d '{"token":"[token]"}'

# Check user status changed
wrangler d1 execute site --command="SELECT status, email_verified_at FROM users WHERE id = '{userId}';"

# Should show status='active' and email_verified_at timestamp
```

### Test 3: Unverified user cannot upload
```bash
# As unverified user, try to create artwork
curl -X POST http://localhost:8787/api/artworks \
  -H "Authorization: Bearer {unverified_token}" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test","description":"Test"}'

# Should return 403 error requiring email verification
```

### Test 4: Verified user can upload
```bash
# Verify email first
# Then create artwork with same token
curl -X POST http://localhost:8787/api/artworks \
  -H "Authorization: Bearer {verified_token}" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test","description":"Test"}'

# Should succeed with 201
```

### Test 5: Check verification status
```bash
curl -X GET http://localhost:8787/auth/email/verification-status \
  -H "Authorization: Bearer {token}"

# Should return:
# {
#   "email": "user@example.com",
#   "verified": true,
#   "verifiedAt": "2026-01-19T12:34:56Z"
# }
```

### Test 6: Resend verification email
```bash
# As unverified user
curl -X POST http://localhost:8787/auth/email/resend-verification \
  -H "Authorization: Bearer {token}"

# Should send new email with new token

# Trying again within 5 minutes should fail with 429
curl -X POST http://localhost:8787/auth/email/resend-verification \
  -H "Authorization: Bearer {token}"

# Should return 429: Rate limit error
```

### Test 7: Token expiration
```bash
# Get an old token (wait 24+ hours or manually update DB)
wrangler d1 execute site --command="UPDATE verification_tokens SET expires_at = datetime('now', '-1 minute') WHERE user_id = '{userId}';"

# Try to verify with expired token
curl -X POST http://localhost:8787/auth/email/verify \
  -H "Content-Type: application/json" \
  -d '{"token":"[old_token]"}'

# Should return 401: Token expired
```
