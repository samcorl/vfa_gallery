# Build 26: React Protected Routes

## Goal
Create protected route wrapper components that enforce authentication and role-based authorization, redirecting unauthorized users appropriately.

## Spec Extract

From **01-TECHNICAL-SPEC.md**:
- Protected routes require authentication
- Admin routes require authentication + admin role
- Unauthorized access should redirect to homepage or login flow

From **04-UI-UX-SPEC.md**:
- Profile section (/profile/*) is private
- Admin section (/admin/*) is admin-only

## Prerequisites
- **25-REACT-AUTH-CONTEXT.md** - Auth context and useAuth hook created

## Steps

### 1. Create Loading Spinner Component

Create **src/components/ui/LoadingSpinner.tsx**:

```typescript
export interface LoadingSpinnerProps {
  message?: string;
  size?: 'small' | 'medium' | 'large';
}

export function LoadingSpinner({
  message = 'Loading...',
  size = 'medium'
}: LoadingSpinnerProps) {
  const sizeClasses = {
    small: 'h-6 w-6',
    medium: 'h-12 w-12',
    large: 'h-16 w-16',
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <div className={`${sizeClasses[size]} animate-spin rounded-full border-4 border-gray-200 border-t-blue-600`} />
      <p className="text-gray-600">{message}</p>
    </div>
  );
}
```

### 2. Create ProtectedRoute Component

Create **src/components/ProtectedRoute.tsx**:

```typescript
import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LoadingSpinner } from './ui/LoadingSpinner';

interface ProtectedRouteProps {
  children: ReactNode;
}

/**
 * ProtectedRoute wrapper for authenticated-only routes
 * Redirects to home if not authenticated
 * Shows loading spinner while auth state is being checked
 */
export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth();

  // Show spinner while checking auth status
  if (isLoading) {
    return <LoadingSpinner message="Checking authentication..." />;
  }

  // Redirect to home if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  // Render protected content
  return <>{children}</>;
}
```

### 3. Create AdminRoute Component

Create **src/components/AdminRoute.tsx**:

```typescript
import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LoadingSpinner } from './ui/LoadingSpinner';

interface AdminRouteProps {
  children: ReactNode;
}

/**
 * AdminRoute wrapper for admin-only routes
 * Requires both authentication AND admin role
 * Redirects to home if not authenticated or not admin
 * Shows loading spinner while auth state is being checked
 */
export default function AdminRoute({ children }: AdminRouteProps) {
  const { user, isLoading, isAuthenticated } = useAuth();

  // Show spinner while checking auth status
  if (isLoading) {
    return <LoadingSpinner message="Checking permissions..." />;
  }

  // Redirect if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  // Redirect if not admin
  if (user?.role !== 'admin') {
    console.warn(`Access denied: User role '${user?.role}' is not 'admin'`);
    return <Navigate to="/" replace />;
  }

  // Render admin content
  return <>{children}</>;
}
```

### 4. Update Router to Use Protected Routes

Update **src/router.tsx** to import and use the protected route components:

```typescript
import { createBrowserRouter, RouteObject } from 'react-router-dom';
import AppShell from './components/layout/AppShell';

// ... other imports ...
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';

// ... page imports ...

const routes: RouteObject[] = [
  {
    element: <AppShell />,
    children: [
      // Public routes
      {
        path: '/',
        element: <HomePage />,
      },
      {
        path: '/browse',
        element: <BrowsePage />,
      },
      {
        path: '/search',
        element: <SearchPage />,
      },
      {
        path: '/groups/:slug',
        element: <GroupPage />,
      },
      {
        path: '/:artist',
        element: <ArtistProfilePage />,
      },
      {
        path: '/:artist/:gallery',
        element: <GalleryPage />,
      },
      {
        path: '/:artist/:gallery/:collection',
        element: <CollectionPage />,
      },
      {
        path: '/:artist/:gallery/:collection/:artwork',
        element: <ArtworkPage />,
      },
      // Protected routes - require authentication
      {
        path: '/profile',
        element: (
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/profile/galleries',
        element: (
          <ProtectedRoute>
            <GalleriesPage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/profile/artworks',
        element: (
          <ProtectedRoute>
            <ArtworksPage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/profile/messages',
        element: (
          <ProtectedRoute>
            <MessagesPage />
          </ProtectedRoute>
        ),
      },
      // Admin routes - require authentication + admin role
      {
        path: '/admin',
        element: (
          <AdminRoute>
            <AdminDashboard />
          </AdminRoute>
        ),
      },
      {
        path: '/admin/users',
        element: (
          <AdminRoute>
            <AdminUsers />
          </AdminRoute>
        ),
      },
      {
        path: '/admin/reports',
        element: (
          <AdminRoute>
            <AdminReports />
          </AdminRoute>
        ),
      },
      {
        path: '*',
        element: <NotFoundPage />,
      },
    ],
  },
];

export const router = createBrowserRouter(routes);
```

## Files to Create/Modify

### Create:
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/ui/LoadingSpinner.tsx`
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/ProtectedRoute.tsx`
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/AdminRoute.tsx`

### Modify:
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/router.tsx`

## Verification

### 1. Test Unauthenticated Access

1. Run dev server:
   ```bash
   npm run dev
   ```

2. Navigate to `/profile` while not logged in
   - Should show "Checking authentication..." spinner
   - After ~1 second, should redirect to `/`
   - No 404 error

3. Navigate to `/admin` while not logged in
   - Should show "Checking permissions..." spinner
   - After ~1 second, should redirect to `/`

### 2. Test TypeScript Compilation

```bash
npx tsc --noEmit
```
- No TypeScript errors
- All imports resolve correctly

### 3. Test Route Navigation

In browser console:
```javascript
// Check current route
console.log(window.location.pathname);

// Navigate to protected route
window.location.href = '/profile';
// Should redirect to / if not logged in
```

### 4. Verify Console Behavior

With DevTools open:
- Check for "Access denied" message when non-admin tries to access /admin
- No console errors about undefined user or missing context
- LoadingSpinner displays with appropriate message

### 5. Mock Authentication Test (Optional)

Add temporary test in **src/components/ProtectedRoute.tsx**:

```typescript
// Temporary: Add a test button to simulate auth state
// Remove this before production
const isTest = new URLSearchParams(window.location.search).has('test');
if (isTest) {
  return (
    <div className="p-4">
      <p className="text-yellow-600 font-bold">TEST MODE - Protected content visible</p>
      <button
        onClick={() => window.location.reload()}
        className="mt-2 px-4 py-2 bg-blue-600 text-white rounded"
      >
        Reload
      </button>
      {children}
    </div>
  );
}
```

Then test:
- `/profile?test` shows protected content
- `/profile` redirects to home

### 6. Verify Component Exports

Check **src/components/ProtectedRoute.tsx** and **src/components/AdminRoute.tsx**:
```typescript
export default function ProtectedRoute(...) { }
// Should be importable as: import ProtectedRoute from '...'

export default function AdminRoute(...) { }
// Should be importable as: import AdminRoute from '...'
```

## Success Criteria
- ProtectedRoute redirects unauthenticated users to home
- AdminRoute redirects non-admin users to home
- Loading spinner displays while checking auth state
- All routes render correctly when authenticated
- TypeScript compilation succeeds in strict mode
- No console errors when accessing protected routes
- Navigation occurs silently without showing errors
- Browser history is preserved correctly (replace navigation)
