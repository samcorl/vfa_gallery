# Build 22: Logout Endpoint

**Goal:** Create logout endpoint that deletes session, clears authentication cookie, and returns success response.

**Spec Extract:**
- Session validation and cleanup
- JWT tokens stored in httpOnly cookies
- No custom auth - delegated to SSO providers

---

## Prerequisites

- **Build 21:** AUTH-SESSION-MANAGEMENT.md (session deletion + middleware)
- **Build 20:** AUTH-JWT-GENERATION.md (cookie management)

---

## Spec Details

**Endpoint:** `POST /api/auth/logout`

**Request:**
- Authentication: Required (JWT token in httpOnly cookie)
- Headers: None required beyond automatic cookie transmission
- Body: Empty or `{}`

**Response (Success):**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

**Response (Unauthorized):**
```json
{
  "error": "Unauthorized",
  "message": "No active session"
}
```

**Side Effects:**
- Session record deleted from database
- auth_token cookie cleared (Set-Cookie with maxAge=0)
- User redirected to login page on frontend

---

## Steps

### Step 1: Add Logout Endpoint to Auth Router

Edit: `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/auth.ts`

Add after existing auth routes:

```typescript
// Import session utilities
import { deleteSession } from '@/lib/auth/session';
import { clearAuthCookie, getAuthCookie } from '@/lib/auth/cookies';

// Route: POST /api/auth/logout
authRouter.post('/logout', async (c) => {
  try {
    const token = getAuthCookie(c);
    const { DB } = c.env;

    if (!token) {
      throw new HTTPException(401, {
        message: 'No active session',
      });
    }

    try {
      // Delete session from database (byToken = true)
      await deleteSession(DB, token, true);
    } catch (error) {
      console.error('Session deletion error:', error);
      // Continue anyway - clear cookie even if session deletion fails
    }

    // Clear authentication cookie
    clearAuthCookie(c);

    return c.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    if (error instanceof HTTPException) {
      return c.json(
        {
          error: error.status === 401 ? 'Unauthorized' : 'Error',
          message: error.message,
        },
        error.status
      );
    }

    console.error('Logout error:', error);
    return c.json(
      {
        error: 'Internal Server Error',
        message: 'Logout failed',
      },
      500
    );
  }
});
```

### Step 2: Create Frontend Logout Hook

Create: `/Volumes/DataSSD/gitsrc/vfa_gallery/src/hooks/useLogout.ts`

```typescript
import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

export function useLogout() {
  const navigate = useNavigate();

  const logout = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies
      });

      if (!response.ok) {
        throw new Error(`Logout failed: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success) {
        // Clear any local storage
        localStorage.removeItem('user');
        localStorage.removeItem('authToken'); // if stored locally

        // Redirect to login
        navigate('/login', { replace: true });
      } else {
        throw new Error(data.message || 'Logout failed');
      }
    } catch (error) {
      console.error('Logout error:', error);
      // Still redirect to login even if error (session likely cleared on server)
      navigate('/login', { replace: true });
    }
  }, [navigate]);

  return logout;
}
```

### Step 3: Create Logout Button Component

Create: `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/auth/LogoutButton.tsx`

```typescript
import React, { useState } from 'react';
import { useLogout } from '@/hooks/useLogout';

interface LogoutButtonProps {
  className?: string;
  variant?: 'primary' | 'secondary' | 'ghost';
}

export const LogoutButton: React.FC<LogoutButtonProps> = ({
  className = '',
  variant = 'secondary',
}) => {
  const logout = useLogout();
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async () => {
    setIsLoading(true);
    try {
      await logout();
    } finally {
      setIsLoading(false);
    }
  };

  const baseClasses =
    'px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50';

  const variantClasses = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700',
    secondary: 'bg-gray-200 text-gray-900 hover:bg-gray-300',
    ghost: 'text-gray-700 hover:bg-gray-100',
  };

  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
    >
      {isLoading ? 'Logging out...' : 'Logout'}
    </button>
  );
};
```

### Step 4: Add Logout to Auth Context (Optional)

Edit: `/Volumes/DataSSD/gitsrc/vfa_gallery/src/context/AuthContext.tsx` (from Build 25)

If auth context exists, add logout method:

```typescript
import { useLogout } from '@/hooks/useLogout';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const logout = useLogout();
  const [user, setUser] = useState<AuthUser | null>(null);

  // ... other context code

  const value = {
    user,
    setUser,
    logout, // Add logout to context
    // ... other methods
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
```

### Step 5: Create Protected Route Logout (Optional)

Create: `/Volumes/DataSSD/gitsrc/vfa_gallery/src/pages/Logout.tsx`

```typescript
import React, { useEffect } from 'react';
import { useLogout } from '@/hooks/useLogout';

/**
 * Logout page that automatically logs out the user
 * Useful for: /logout route that triggers logout
 */
export const LogoutPage: React.FC = () => {
  const logout = useLogout();

  useEffect(() => {
    logout();
  }, [logout]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <p className="text-gray-600 mb-4">Logging you out...</p>
        <div className="inline-block animate-spin h-8 w-8 border-4 border-gray-200 border-t-blue-600 rounded-full"></div>
      </div>
    </div>
  );
};
```

### Step 6: Add Logout Route

Edit: `/Volumes/DataSSD/gitsrc/vfa_gallery/src/pages/routes.tsx` (from Build 24)

Add logout route:

```typescript
import { LogoutPage } from './Logout';

export const routes = [
  // ... existing routes
  {
    path: '/logout',
    element: <LogoutPage />,
  },
];
```

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/auth.ts` | Modify | Add logout endpoint |
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/hooks/useLogout.ts` | Create | React hook for logout |
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/auth/LogoutButton.tsx` | Create | Logout button component |
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/context/AuthContext.tsx` | Modify | Add logout to auth context |
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/pages/Logout.tsx` | Create | Auto-logout page |
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/pages/routes.tsx` | Modify | Add logout route |

---

## Verification

### 1. Test Logout Endpoint with Valid Session
```bash
# Get valid auth token cookie from login first
# Then make logout request
curl -X POST \
  -H "Cookie: auth_token=valid-jwt-token" \
  http://localhost:8787/api/auth/logout

# Should return:
# { "success": true, "message": "Logged out successfully" }
```

### 2. Test Logout Endpoint without Session
```bash
# Make logout request without auth cookie
curl -X POST http://localhost:8787/api/auth/logout

# Should return 401:
# { "error": "Unauthorized", "message": "No active session" }
```

### 3. Verify Cookie Cleared
```bash
# After logout request
# Browser DevTools → Application → Cookies
# auth_token cookie should be missing (cleared with maxAge=0)
```

### 4. Verify Session Deleted from Database
```sql
-- Before logout
SELECT * FROM sessions WHERE id = 'specific-session-id';
-- Should exist

-- After logout
SELECT * FROM sessions WHERE id = 'specific-session-id';
-- Should return no rows
```

### 5. Test Logout Button Click
```bash
# In browser after login:
1. Navigate to profile or any protected page
2. Click logout button
3. Should redirect to /login
4. Attempting to access protected page should fail with 401
```

### 6. Test Manual Logout Page
```bash
# Navigate to /logout in browser
# Should show "Logging you out..." spinner
# Should automatically redirect to /login
```

### 7. Verify Session Cannot Be Reused
```bash
# Save JWT token before logging out
token="eyJ..."

# Login and logout
curl -X POST -H "Cookie: auth_token=$token" http://localhost:8787/api/auth/logout

# Try to use old token
curl -H "Cookie: auth_token=$token" http://localhost:8787/api/users/me
# Should return 401 (session deleted, token no longer valid)
```

### 8. Test Multiple Sessions Logout Individual
```bash
# Login from 2 devices (create 2 sessions)
# Device A: GET /api/auth/google → creates session A
# Device B: GET /api/auth/google → creates session B

# Logout from Device A only
curl -X POST -H "Cookie: auth_token=session-a-token" http://localhost:8787/api/auth/logout

# Verify Device A session deleted
SELECT * FROM sessions WHERE id = 'session-a-id';
-- No rows

# Verify Device B session still exists
SELECT * FROM sessions WHERE id = 'session-b-id';
-- Still exists

# Device B can still access protected routes
curl -H "Cookie: auth_token=session-b-token" http://localhost:8787/api/users/me
-- Success
```

---

## Common Issues & Troubleshooting

**Issue:** Logout returns success but user still logged in
- Solution: Verify browser is sending auth_token cookie with logout request
- Check credentials: 'include' is set in fetch call
- Verify clearAuthCookie() is actually being called

**Issue:** "No active session" after just logging in
- Solution: Check getAuthCookie() is retrieving the token
- Verify cookie name matches ('auth_token')
- Check httpOnly cookie isn't being stripped

**Issue:** Session deletion fails but logout still succeeds
- Expected behavior - code catches error and continues
- Cookie is still cleared, so user is effectively logged out
- Check database logs for why deletion failed

**Issue:** Logout button shows spinner indefinitely
- Solution: Check browser console for fetch errors
- Verify /api/auth/logout endpoint is registered
- Check network tab in DevTools to see response

**Issue:** Manual /logout page redirects immediately
- This is correct behavior - the page is supposed to redirect after logout
- If page hangs or shows spinner: check useLogout() implementation

---

## Notes

- Logout is asynchronous on frontend but happens immediately
- Even if session deletion fails, cookie is still cleared (user logged out)
- Multiple sessions per user supported; logout only deletes current session
- Token is not blacklisted (stateless JWT); if someone has token, they can use it until it expires
- Consider implementing token blacklist in future if needed (requires storage)
- CSRF protection: POST method prevents accidental logout via GET

---

## Next Steps

- Build 23: Add Turnstile CAPTCHA protection
- Build 25: Integrate logout into auth context and UI
