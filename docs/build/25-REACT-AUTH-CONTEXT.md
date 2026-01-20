# Build 25: React Auth Context

## Goal
Create an authentication context provider with useAuth hook that manages user state, authentication status, and provides login/logout functionality integrated with the backend auth endpoints.

## Spec Extract

From **02-DATA-MODELS.md**:
- User model: `{ id, username, displayName, avatarUrl, role }`
- Roles: `artist`, `collector`, `admin`

From **03-API-ENDPOINTS.md**:
- `GET /api/auth/me` - Check current auth status
- `POST /api/auth/logout` - Logout endpoint
- `GET /api/auth/google` - OAuth redirect (handled by backend)

## Prerequisites
- **24-REACT-ROUTER-SETUP.md** - Router configured

## Steps

### 1. Create Auth Types

Create **src/types/auth.ts**:

```typescript
export type UserRole = 'artist' | 'collector' | 'admin';

export interface User {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: () => void;
  logout: () => Promise<void>;
}
```

### 2. Create Auth Context

Create **src/contexts/AuthContext.tsx**:

```typescript
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, AuthContextType, UserRole } from '../types/auth';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch current user on mount
  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        const response = await fetch('/api/auth/me', {
          credentials: 'include', // Include cookies in request
        });

        if (response.ok) {
          const userData = await response.json();
          setUser(userData);
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error('Failed to check auth status:', error);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuthStatus();
  }, []);

  const login = () => {
    // Redirect to Google OAuth endpoint
    window.location.href = '/api/auth/google';
  };

  const logout = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });

      if (response.ok) {
        setUser(null);
        // Redirect to home page after logout
        window.location.href = '/';
      } else {
        console.error('Logout failed');
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: user !== null,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
```

### 3. Wrap App with AuthProvider

Update **src/App.tsx**:

```typescript
import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import { AuthProvider } from './contexts/AuthContext';
import './App.css';

export default function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}
```

### 4. Create Test Hook Component (Optional - for verification)

Create **src/components/AuthStatus.tsx** (for testing purposes):

```typescript
import { useAuth } from '../contexts/AuthContext';

export function AuthStatus() {
  const { user, isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return <div className="p-4">Loading auth status...</div>;
  }

  return (
    <div className="p-4 bg-gray-100 rounded">
      <p className="text-sm font-semibold">Auth Status:</p>
      <p className="text-xs text-gray-600 mt-1">
        Authenticated: {isAuthenticated ? 'Yes' : 'No'}
      </p>
      {user && (
        <div className="mt-2 text-sm">
          <p>User: {user.displayName}</p>
          <p>Role: {user.role}</p>
          <p>Username: {user.username}</p>
        </div>
      )}
    </div>
  );
}
```

## Files to Create/Modify

### Create:
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/types/auth.ts`
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/contexts/AuthContext.tsx`
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/AuthStatus.tsx` (optional test component)

### Modify:
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/App.tsx`

## Verification

### 1. Check Context Exports

Verify **src/contexts/AuthContext.tsx** exports:
```typescript
export { AuthProvider, useAuth };
```

### 2. Test in Home Page

Update **src/pages/HomePage.tsx** temporarily to test:

```typescript
import { useAuth } from '../contexts/AuthContext';
import { AuthStatus } from '../components/AuthStatus';

export default function HomePage() {
  const { isLoading } = useAuth();

  return (
    <div className="p-4">
      <h1 className="text-3xl font-bold">Home</h1>
      <p className="text-gray-600 mt-2">Homepage placeholder</p>
      <div className="mt-4">
        <AuthStatus />
      </div>
    </div>
  );
}
```

### 3. Verify Development

Run the dev server:
```bash
npm run dev
```

Check the following:
- No TypeScript errors in strict mode
- Console shows "Loading auth status..." initially
- After ~1 second, shows "Authenticated: No" (if not logged in)
- No CORS errors if API is on different port (must be configured)
- Network tab shows GET `/api/auth/me` request

### 4. Test API Integration

In browser console:
```javascript
// Test 1: Check current auth
fetch('/api/auth/me', { credentials: 'include' })
  .then(r => r.json())
  .then(console.log);

// Test 2: Should show 401 if not authenticated
// Should show user object if authenticated
```

### 5. Verify Context Hook

In any component that imports useAuth:
```typescript
const { user, isLoading, isAuthenticated, login, logout } = useAuth();

// Should have no TypeScript errors
// Should provide all expected properties
```

## Success Criteria
- AuthContext compiles without TypeScript errors
- useAuth hook can be called in any component
- /api/auth/me is fetched on app mount
- User state is null when not authenticated
- isLoading is true initially, false after check
- isAuthenticated boolean matches user !== null
- login() function redirects to /api/auth/google
- logout() function calls /api/auth/logout endpoint
- No console errors about context not being wrapped in provider
- User data displays correctly when logged in
