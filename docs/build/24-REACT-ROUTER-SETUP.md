# Build 24: React Router Setup

## Goal
Set up React Router with complete route structure supporting nested routes for artist profiles, galleries, collections, and artworks, plus protected profile and admin routes.

## Spec Extract

From **04-UI-UX-SPEC.md**:
- Routing layer must support deep nesting: Artist > Gallery > Collection > Artwork
- Protected routes for authenticated users (profile section)
- Admin routes for moderation
- Clean URL structure: `/:artist/:gallery/:collection/:artwork`
- Homepage, Browse, and Search as main entry points

## Prerequisites
- **01-PROJECT-SETUP.md** - React + TypeScript project initialized
- **02-TAILWIND-SETUP.md** - Tailwind CSS configured

## Steps

### 1. Install React Router DOM

```bash
npm install react-router-dom
npm install -D @types/react-router-dom
```

### 2. Create Route Structure File

Create **src/router.tsx**:

```typescript
import { createBrowserRouter, RouteObject } from 'react-router-dom';
import App from './App';

// Layout & Shell (to be created in build 27)
import AppShell from './components/layout/AppShell';

// Page components - create placeholder pages for now
import HomePage from './pages/HomePage';
import BrowsePage from './pages/BrowsePage';
import SearchPage from './pages/SearchPage';
import ArtistProfilePage from './pages/ArtistProfilePage';
import GalleryPage from './pages/GalleryPage';
import CollectionPage from './pages/CollectionPage';
import ArtworkPage from './pages/ArtworkPage';
import GroupPage from './pages/GroupPage';
import ProfilePage from './pages/ProfilePage';
import GalleriesPage from './pages/GalleriesPage';
import ArtworksPage from './pages/ArtworksPage';
import MessagesPage from './pages/MessagesPage';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminUsers from './pages/admin/AdminUsers';
import AdminReports from './pages/admin/AdminReports';
import NotFoundPage from './pages/NotFoundPage';

// Protected route wrapper (to be created in build 26)
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';

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
      // Artist profile and nested routes
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
      // Protected routes
      {
        path: '/profile',
        element: <ProtectedRoute><ProfilePage /></ProtectedRoute>,
      },
      {
        path: '/profile/galleries',
        element: <ProtectedRoute><GalleriesPage /></ProtectedRoute>,
      },
      {
        path: '/profile/artworks',
        element: <ProtectedRoute><ArtworksPage /></ProtectedRoute>,
      },
      {
        path: '/profile/messages',
        element: <ProtectedRoute><MessagesPage /></ProtectedRoute>,
      },
      // Admin routes (protected + role check)
      {
        path: '/admin',
        element: <AdminRoute><AdminDashboard /></AdminRoute>,
      },
      {
        path: '/admin/users',
        element: <AdminRoute><AdminUsers /></AdminRoute>,
      },
      {
        path: '/admin/reports',
        element: <AdminRoute><AdminReports /></AdminRoute>,
      },
      // 404 catch-all
      {
        path: '*',
        element: <NotFoundPage />,
      },
    ],
  },
];

export const router = createBrowserRouter(routes);
```

### 3. Create Placeholder Page Components

Create **src/pages/HomePage.tsx**:
```typescript
export default function HomePage() {
  return (
    <div className="p-4">
      <h1 className="text-3xl font-bold">Home</h1>
      <p className="text-gray-600 mt-2">Homepage placeholder</p>
    </div>
  );
}
```

Create **src/pages/BrowsePage.tsx**:
```typescript
export default function BrowsePage() {
  return (
    <div className="p-4">
      <h1 className="text-3xl font-bold">Browse</h1>
      <p className="text-gray-600 mt-2">Browse artworks placeholder</p>
    </div>
  );
}
```

Create **src/pages/SearchPage.tsx**:
```typescript
export default function SearchPage() {
  return (
    <div className="p-4">
      <h1 className="text-3xl font-bold">Search</h1>
      <p className="text-gray-600 mt-2">Search placeholder</p>
    </div>
  );
}
```

Create **src/pages/GroupPage.tsx**:
```typescript
import { useParams } from 'react-router-dom';

export default function GroupPage() {
  const { slug } = useParams<{ slug: string }>();
  return (
    <div className="p-4">
      <h1 className="text-3xl font-bold">Group: {slug}</h1>
      <p className="text-gray-600 mt-2">Group detail placeholder</p>
    </div>
  );
}
```

Create **src/pages/ArtistProfilePage.tsx**:
```typescript
import { useParams } from 'react-router-dom';

export default function ArtistProfilePage() {
  const { artist } = useParams<{ artist: string }>();
  return (
    <div className="p-4">
      <h1 className="text-3xl font-bold">Artist: {artist}</h1>
      <p className="text-gray-600 mt-2">Artist profile placeholder</p>
    </div>
  );
}
```

Create **src/pages/GalleryPage.tsx**:
```typescript
import { useParams } from 'react-router-dom';

export default function GalleryPage() {
  const { artist, gallery } = useParams<{ artist: string; gallery: string }>();
  return (
    <div className="p-4">
      <h1 className="text-3xl font-bold">
        {artist} / {gallery}
      </h1>
      <p className="text-gray-600 mt-2">Gallery placeholder</p>
    </div>
  );
}
```

Create **src/pages/CollectionPage.tsx**:
```typescript
import { useParams } from 'react-router-dom';

export default function CollectionPage() {
  const { artist, gallery, collection } = useParams<{
    artist: string;
    gallery: string;
    collection: string;
  }>();
  return (
    <div className="p-4">
      <h1 className="text-3xl font-bold">
        {artist} / {gallery} / {collection}
      </h1>
      <p className="text-gray-600 mt-2">Collection placeholder</p>
    </div>
  );
}
```

Create **src/pages/ArtworkPage.tsx**:
```typescript
import { useParams } from 'react-router-dom';

export default function ArtworkPage() {
  const { artist, gallery, collection, artwork } = useParams<{
    artist: string;
    gallery: string;
    collection: string;
    artwork: string;
  }>();
  return (
    <div className="p-4">
      <h1 className="text-3xl font-bold">
        {artist} / {gallery} / {collection} / {artwork}
      </h1>
      <p className="text-gray-600 mt-2">Artwork detail placeholder</p>
    </div>
  );
}
```

Create **src/pages/ProfilePage.tsx**:
```typescript
export default function ProfilePage() {
  return (
    <div className="p-4">
      <h1 className="text-3xl font-bold">My Profile</h1>
      <p className="text-gray-600 mt-2">Profile placeholder (protected route)</p>
    </div>
  );
}
```

Create **src/pages/GalleriesPage.tsx**:
```typescript
export default function GalleriesPage() {
  return (
    <div className="p-4">
      <h1 className="text-3xl font-bold">My Galleries</h1>
      <p className="text-gray-600 mt-2">Galleries management placeholder</p>
    </div>
  );
}
```

Create **src/pages/ArtworksPage.tsx**:
```typescript
export default function ArtworksPage() {
  return (
    <div className="p-4">
      <h1 className="text-3xl font-bold">My Artworks</h1>
      <p className="text-gray-600 mt-2">Artworks management placeholder</p>
    </div>
  );
}
```

Create **src/pages/MessagesPage.tsx**:
```typescript
export default function MessagesPage() {
  return (
    <div className="p-4">
      <h1 className="text-3xl font-bold">Messages</h1>
      <p className="text-gray-600 mt-2">Messages placeholder</p>
    </div>
  );
}
```

Create **src/pages/admin/AdminDashboard.tsx**:
```typescript
export default function AdminDashboard() {
  return (
    <div className="p-4">
      <h1 className="text-3xl font-bold">Admin Dashboard</h1>
      <p className="text-gray-600 mt-2">Admin dashboard placeholder</p>
    </div>
  );
}
```

Create **src/pages/admin/AdminUsers.tsx**:
```typescript
export default function AdminUsers() {
  return (
    <div className="p-4">
      <h1 className="text-3xl font-bold">Manage Users</h1>
      <p className="text-gray-600 mt-2">User management placeholder</p>
    </div>
  );
}
```

Create **src/pages/admin/AdminReports.tsx**:
```typescript
export default function AdminReports() {
  return (
    <div className="p-4">
      <h1 className="text-3xl font-bold">Report Center</h1>
      <p className="text-gray-600 mt-2">Reports placeholder</p>
    </div>
  );
}
```

Create **src/pages/NotFoundPage.tsx**:
```typescript
import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <h1 className="text-6xl font-bold text-gray-900">404</h1>
      <p className="text-xl text-gray-600 mt-4">Page not found</p>
      <Link
        to="/"
        className="mt-6 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
      >
        Go Home
      </Link>
    </div>
  );
}
```

### 4. Update App.tsx to Use RouterProvider

Update **src/App.tsx**:

```typescript
import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import './App.css';

export default function App() {
  return <RouterProvider router={router} />;
}
```

### 5. Update main.tsx

Ensure **src/main.tsx** renders the App component:

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

## Files to Create/Modify

### Create:
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/router.tsx`
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/pages/HomePage.tsx`
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/pages/BrowsePage.tsx`
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/pages/SearchPage.tsx`
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/pages/GroupPage.tsx`
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/pages/ArtistProfilePage.tsx`
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/pages/GalleryPage.tsx`
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/pages/CollectionPage.tsx`
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/pages/ArtworkPage.tsx`
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/pages/ProfilePage.tsx`
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/pages/GalleriesPage.tsx`
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/pages/ArtworksPage.tsx`
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/pages/MessagesPage.tsx`
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/pages/admin/AdminDashboard.tsx`
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/pages/admin/AdminUsers.tsx`
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/pages/admin/AdminReports.tsx`
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/pages/NotFoundPage.tsx`

### Modify:
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/App.tsx`

## Verification

1. **Verify installation:**
   ```bash
   npm run dev
   ```
   - App compiles without errors
   - Browser opens without console errors

2. **Test all routes:**
   - Navigate to `http://localhost:5173/` → HomePage renders
   - Navigate to `http://localhost:5173/browse` → BrowsePage renders
   - Navigate to `http://localhost:5173/search` → SearchPage renders
   - Navigate to `http://localhost:5173/groups/abstract-art` → GroupPage renders with slug
   - Navigate to `http://localhost:5173/picasso` → ArtistProfilePage renders with artist param
   - Navigate to `http://localhost:5173/picasso/abstracts` → GalleryPage renders
   - Navigate to `http://localhost:5173/picasso/abstracts/blue-period` → CollectionPage renders
   - Navigate to `http://localhost:5173/picasso/abstracts/blue-period/weeping-woman` → ArtworkPage renders
   - Navigate to `http://localhost:5173/invalid-route` → NotFoundPage renders

3. **Test protected routes (will fail until build 26 is complete):**
   - Navigate to `http://localhost:5173/profile` → ProtectedRoute component shows (or redirects)

4. **Verify no console errors:**
   - Open DevTools (F12)
   - Check Console tab for any React Router or component errors
   - All route parameters display correctly in URL bar

## Success Criteria
- All 19 routes are defined and accessible
- All placeholder pages render their route parameters
- No TypeScript errors in strict mode
- No console warnings or errors
- Router configuration is modular and easy to extend
