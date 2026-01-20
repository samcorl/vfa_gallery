# Build 27: React Layout Shell

## Goal
Create responsive app shell with adaptive navigation that switches between bottom tab bar (mobile) and top header (desktop), including breadcrumbs and back navigation.

## Spec Extract

From **04-UI-UX-SPEC.md**:
- Mobile view (<640px): Bottom tab bar with Home, Browse, Upload, Profile
- Desktop view (≥640px): Top header with same navigation options
- Upload button only visible to authenticated users
- Back button in nested views for mobile
- Breadcrumbs on desktop for nested content
- Responsive breakpoints: Mobile <640px, Tablet 640-1024px, Desktop >1024px

## Prerequisites
- **24-REACT-ROUTER-SETUP.md** - Router configured
- **25-REACT-AUTH-CONTEXT.md** - Auth context available

## Steps

### 1. Create AppShell Layout Component

Create **src/components/layout/AppShell.tsx**:

```typescript
import { Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import TopNav from './TopNav';
import BottomNav from './BottomNav';
import Breadcrumbs from './Breadcrumbs';

/**
 * Main application shell that wraps all routes
 * Manages responsive navigation layout
 */
export default function AppShell() {
  const location = useLocation();
  const { isLoading } = useAuth();

  // Show loading state during auth check
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-blue-600" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Top Navigation - Desktop only */}
      <TopNav />

      {/* Breadcrumbs - Desktop only, nested routes */}
      <Breadcrumbs />

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
        <Outlet />
      </main>

      {/* Bottom Navigation - Mobile only */}
      <BottomNav />
    </div>
  );
}
```

### 2. Create TopNav Component

Create **src/components/layout/TopNav.tsx**:

```typescript
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export default function TopNav() {
  const { user, isAuthenticated, login, logout } = useAuth();
  const location = useLocation();

  const navItems = [
    { label: 'Home', href: '/', icon: '🏠' },
    { label: 'Browse', href: '/browse', icon: '📚' },
    { label: 'Search', href: '/search', icon: '🔍' },
  ];

  const isActive = (href: string) => location.pathname === href;

  return (
    <nav className="hidden md:flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white sticky top-0 z-40">
      {/* Logo */}
      <Link to="/" className="text-2xl font-bold text-blue-600 mr-8">
        VFA.gallery
      </Link>

      {/* Navigation Links */}
      <div className="flex gap-8">
        {navItems.map((item) => (
          <Link
            key={item.href}
            to={item.href}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
              isActive(item.href)
                ? 'bg-blue-100 text-blue-600 font-semibold'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <span className="text-lg">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </div>

      {/* Right Side: Upload + Profile */}
      <div className="flex items-center gap-4">
        {isAuthenticated && (
          <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
            Upload
          </button>
        )}

        {isAuthenticated ? (
          <div className="flex items-center gap-4">
            <Link to="/profile" className="text-gray-700 hover:text-blue-600 transition-colors">
              {user?.displayName || user?.username}
            </Link>
            <button
              onClick={logout}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Logout
            </button>
          </div>
        ) : (
          <button
            onClick={login}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Sign In
          </button>
        )}
      </div>
    </nav>
  );
}
```

### 3. Create BottomNav Component

Create **src/components/layout/BottomNav.tsx**:

```typescript
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

interface NavItem {
  label: string;
  href: string;
  icon: string;
}

export default function BottomNav() {
  const { user, isAuthenticated, login, logout } = useAuth();
  const location = useLocation();

  const navItems: NavItem[] = [
    { label: 'Home', href: '/', icon: '🏠' },
    { label: 'Browse', href: '/browse', icon: '📚' },
    ...(isAuthenticated ? [{ label: 'Upload', href: '#upload', icon: '⬆️' }] : []),
    { label: 'Profile', href: isAuthenticated ? '/profile' : '#', icon: '👤' },
  ];

  const isActive = (href: string) => {
    // Don't highlight action items like upload
    if (href === '#upload') return false;
    return location.pathname === href || location.pathname.startsWith(href + '/');
  };

  const handleUploadClick = (e: React.MouseEvent) => {
    e.preventDefault();
    // TODO: Open upload modal in build 30+
    console.log('Upload clicked');
  };

  const handleProfileClick = (e: React.MouseEvent) => {
    if (!isAuthenticated) {
      e.preventDefault();
      login();
    }
  };

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40">
      <div className="flex justify-around items-center">
        {navItems.map((item) => {
          const isActionItem = item.href.startsWith('#');

          return (
            <Link
              key={item.label}
              to={isActionItem ? '#' : item.href}
              onClick={
                item.label === 'Upload' ? handleUploadClick : item.label === 'Profile' ? handleProfileClick : undefined
              }
              className={`flex flex-col items-center justify-center w-1/4 py-3 gap-1 transition-colors ${
                isActive(item.href)
                  ? 'text-blue-600 border-t-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>

      {/* Auth buttons in mobile menu - positioned above bottom nav or in hamburger */}
      {!isAuthenticated && (
        <div className="flex justify-center py-2 border-t border-gray-200 bg-gray-50">
          <button
            onClick={login}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
          >
            Sign In
          </button>
        </div>
      )}
    </nav>
  );
}
```

### 4. Create Breadcrumbs Component

Create **src/components/layout/Breadcrumbs.tsx**:

```typescript
import { Link, useLocation } from 'react-router-dom';
import { useMemo } from 'react';

interface Breadcrumb {
  label: string;
  path: string;
}

export default function Breadcrumbs() {
  const location = useLocation();

  const breadcrumbs = useMemo(() => {
    const paths = location.pathname.split('/').filter(Boolean);

    // Don't show breadcrumbs on home page or single-level routes
    if (paths.length <= 1) {
      return [];
    }

    // Build breadcrumb trail
    const crumbs: Breadcrumb[] = [{ label: 'Home', path: '/' }];

    // Map route patterns to breadcrumb labels
    const segments = paths.slice();
    let currentPath = '';

    // Special handling for artist/gallery/collection/artwork routes
    if (segments[0] && !segments[0].startsWith(':')) {
      // Artist name
      currentPath = `/${segments[0]}`;
      crumbs.push({ label: decodeURIComponent(segments[0]), path: currentPath });

      if (segments[1]) {
        // Gallery name
        currentPath = `/${segments[0]}/${segments[1]}`;
        crumbs.push({ label: decodeURIComponent(segments[1]), path: currentPath });

        if (segments[2]) {
          // Collection name
          currentPath = `/${segments[0]}/${segments[1]}/${segments[2]}`;
          crumbs.push({ label: decodeURIComponent(segments[2]), path: currentPath });

          if (segments[3]) {
            // Artwork name
            currentPath = `/${segments[0]}/${segments[1]}/${segments[2]}/${segments[3]}`;
            crumbs.push({ label: decodeURIComponent(segments[3]), path: currentPath });
          }
        }
      }
    }

    // Handle other routes
    if (location.pathname.startsWith('/profile')) {
      crumbs.push({ label: 'Profile', path: '/profile' });
    }

    if (location.pathname.startsWith('/browse')) {
      crumbs.push({ label: 'Browse', path: '/browse' });
    }

    if (location.pathname.startsWith('/search')) {
      crumbs.push({ label: 'Search', path: '/search' });
    }

    if (location.pathname.startsWith('/admin')) {
      crumbs.push({ label: 'Admin', path: '/admin' });
    }

    return crumbs;
  }, [location.pathname]);

  // Hide breadcrumbs on mobile or if only home crumb
  if (breadcrumbs.length <= 1) {
    return null;
  }

  return (
    <nav className="hidden md:block px-6 py-3 border-b border-gray-100 bg-gray-50 sticky top-16 z-30">
      <ol className="flex items-center gap-2 text-sm">
        {breadcrumbs.map((crumb, index) => (
          <li key={crumb.path} className="flex items-center gap-2">
            {index > 0 && <span className="text-gray-400">/</span>}
            {index === breadcrumbs.length - 1 ? (
              <span className="text-gray-700 font-medium">{crumb.label}</span>
            ) : (
              <Link
                to={crumb.path}
                className="text-blue-600 hover:text-blue-700 hover:underline transition-colors"
              >
                {crumb.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
```

### 5. Update AppShell in Router

Verify **src/router.tsx** has AppShell as the root layout:

```typescript
const routes: RouteObject[] = [
  {
    element: <AppShell />,
    children: [
      // ... all other routes
    ],
  },
];
```

## Files to Create/Modify

### Create:
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/layout/AppShell.tsx`
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/layout/TopNav.tsx`
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/layout/BottomNav.tsx`
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/layout/Breadcrumbs.tsx`

### Modify:
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/router.tsx` (verify AppShell is root)

## Verification

### 1. Test Responsive Layout

Run dev server:
```bash
npm run dev
```

**Desktop View (>640px):**
- Open DevTools → Toggle device toolbar
- Set to Desktop view
- Verify TopNav appears with logo, links, and auth buttons
- Verify BottomNav is hidden (hidden md:...)
- Verify breadcrumbs appear below TopNav

**Mobile View (<640px):**
- Open DevTools → Toggle device toolbar
- Set to iPhone/mobile
- Verify BottomNav appears at bottom with 3-4 tabs
- Verify TopNav is hidden (md:hidden)
- Verify breadcrumbs are hidden

### 2. Test Navigation

**Desktop:**
- Click "Home", "Browse", "Search" links
- Active link should highlight with blue background
- Page content updates

**Mobile:**
- Swipe or click bottom tabs
- Active tab should highlight with blue bottom border
- Correct icon and label show

### 3. Test Authentication-Dependent Elements

**Not Logged In:**
- Desktop: "Sign In" button visible, "Upload" hidden
- Mobile: 3 tabs (Home, Browse, Profile), "Sign In" button shown, Upload not visible

**Logged In (mock):**
- Desktop: "Upload" button visible, user name displayed, "Logout" button visible
- Mobile: 4 tabs (Home, Browse, Upload, Profile), "Sign In" hidden

### 4. Test Breadcrumbs

Navigate through nested routes:
- Go to `/picasso`
- Go to `/picasso/abstracts`
- Go to `/picasso/abstracts/blue-period`
- Go to `/picasso/abstracts/blue-period/weeping-woman`

Each level should show breadcrumb trail:
- Home > picasso > abstracts > blue-period > weeping-woman

### 5. Test Scroll Behavior

- Main content area should scroll independently
- BottomNav should stay fixed at bottom on mobile
- TopNav and Breadcrumbs should stay at top on desktop

### 6. Verify TypeScript Compilation

```bash
npx tsc --noEmit
```
- No errors in strict mode

### 7. Check Responsive Classes

Open DevTools and resize browser:
- TopNav appears/disappears at 640px breakpoint
- BottomNav appears/disappears at 640px breakpoint
- Breadcrumbs appear/disappear at 640px breakpoint
- No layout shift when resizing

## Success Criteria
- TopNav displays on desktop (≥640px), hidden on mobile
- BottomNav displays on mobile (<640px), hidden on desktop
- Breadcrumbs display on desktop, hidden on mobile
- All navigation links work and update active state
- Upload button only shows when authenticated
- Auth buttons (Sign In/Logout) appear/disappear correctly
- Main content area scrolls independently from navigation
- Navigation stays fixed while scrolling content
- Responsive behavior works at 640px breakpoint
- No TypeScript errors in strict mode
- Navigation is keyboard accessible
