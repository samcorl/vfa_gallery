import { lazy, Suspense } from 'react'
import { createBrowserRouter } from 'react-router-dom'
import type { RouteObject } from 'react-router-dom'

// Layout
import AppShell from './components/layout/AppShell'

// Route guards
import ProtectedRoute from './components/ProtectedRoute'
import AdminRoute from './components/AdminRoute'

// Error boundary
import { ChunkErrorBoundary } from './components/ChunkErrorBoundary'

// Skeleton fallbacks
import {
  GridPageSkeleton,
  DetailPageSkeleton,
  ProfilePageSkeleton,
  FormPageSkeleton,
  AdminPageSkeleton,
} from './components/ui/SkeletonPage'

// Public pages (lazy loaded)
const HomePage = lazy(() => import('./pages/HomePage'))
const BrowsePage = lazy(() => import('./pages/BrowsePage'))
const SearchPage = lazy(() => import('./pages/SearchPage'))
const GroupPage = lazy(() => import('./pages/GroupPage'))
const ArtistProfilePage = lazy(() => import('./pages/ArtistProfilePage'))
const GalleryPage = lazy(() => import('./pages/GalleryPage'))
const CollectionPage = lazy(() => import('./pages/CollectionPage'))
const ArtworkPage = lazy(() => import('./pages/ArtworkPage'))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'))

// Landing pages (lazy loaded with named export handling)
const Docs = lazy(() => import('./pages/Docs').then(m => ({ default: m.Docs })))
const EduDocs = lazy(() => import('./pages/EduDocs').then(m => ({ default: m.EduDocs })))
const About = lazy(() => import('./pages/About').then(m => ({ default: m.About })))

// Protected pages (lazy loaded)
const ProfilePage = lazy(() => import('./pages/ProfilePage'))
const ProfileEditPage = lazy(() => import('./pages/ProfileEditPage'))
const GalleriesPage = lazy(() => import('./pages/GalleriesPage'))
const ArtworksPage = lazy(() => import('./pages/ArtworksPage'))
const ArtworkUploadPage = lazy(() => import('./pages/ArtworkUploadPage'))
const ArtworkEditPage = lazy(() => import('./pages/ArtworkEditPage'))
const GalleryCreatePage = lazy(() => import('./pages/GalleryCreatePage'))
const GalleryManagerPage = lazy(() => import('./pages/GalleryManagerPage'))
const GalleryEditPage = lazy(() => import('./pages/GalleryEditPage'))
const CollectionManagerPage = lazy(() => import('./pages/CollectionManagerPage'))
const MessagesPage = lazy(() => import('./pages/MessagesPage'))
const MessageComposePage = lazy(() => import('./pages/MessageComposePage'))
const MessageThreadPage = lazy(() => import('./pages/MessageThreadPage'))
const GroupManagePage = lazy(() => import('./pages/GroupManagePage'))

// Admin pages (lazy loaded)
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'))
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers'))
const AdminReports = lazy(() => import('./pages/admin/AdminReports'))
const AdminModeration = lazy(() => import('./pages/admin/AdminModeration'))

const routes: RouteObject[] = [
  {
    element: (
      <ChunkErrorBoundary>
        <AppShell />
      </ChunkErrorBoundary>
    ),
    children: [
      // Public routes
      {
        path: '/',
        element: (
          <Suspense fallback={<GridPageSkeleton />}>
            <HomePage />
          </Suspense>
        ),
      },
      {
        path: '/browse',
        element: (
          <Suspense fallback={<GridPageSkeleton />}>
            <BrowsePage />
          </Suspense>
        ),
      },
      {
        path: '/search',
        element: (
          <Suspense fallback={<GridPageSkeleton />}>
            <SearchPage />
          </Suspense>
        ),
      },
      {
        path: '/groups/:slug/manage',
        element: (
          <ProtectedRoute>
            <Suspense fallback={<GridPageSkeleton />}>
              <GroupManagePage />
            </Suspense>
          </ProtectedRoute>
        ),
      },
      {
        path: '/groups/:slug',
        element: (
          <Suspense fallback={<DetailPageSkeleton />}>
            <GroupPage />
          </Suspense>
        ),
      },
      // Landing pages
      {
        path: '/docs',
        element: (
          <Suspense fallback={<GridPageSkeleton />}>
            <Docs />
          </Suspense>
        ),
      },
      {
        path: '/edu',
        element: (
          <Suspense fallback={<GridPageSkeleton />}>
            <EduDocs />
          </Suspense>
        ),
      },
      {
        path: '/about',
        element: (
          <Suspense fallback={<GridPageSkeleton />}>
            <About />
          </Suspense>
        ),
      },
      // Protected routes
      {
        path: '/profile',
        element: (
          <ProtectedRoute>
            <Suspense fallback={<ProfilePageSkeleton />}>
              <ProfilePage />
            </Suspense>
          </ProtectedRoute>
        ),
      },
      {
        path: '/profile/edit',
        element: (
          <ProtectedRoute>
            <Suspense fallback={<FormPageSkeleton />}>
              <ProfileEditPage />
            </Suspense>
          </ProtectedRoute>
        ),
      },
      {
        path: '/profile/galleries',
        element: (
          <ProtectedRoute>
            <Suspense fallback={<GridPageSkeleton />}>
              <GalleriesPage />
            </Suspense>
          </ProtectedRoute>
        ),
      },
      {
        path: '/profile/galleries/new',
        element: (
          <ProtectedRoute>
            <Suspense fallback={<FormPageSkeleton />}>
              <GalleryCreatePage />
            </Suspense>
          </ProtectedRoute>
        ),
      },
      {
        path: '/profile/galleries/:id',
        element: (
          <ProtectedRoute>
            <Suspense fallback={<GridPageSkeleton />}>
              <GalleryManagerPage />
            </Suspense>
          </ProtectedRoute>
        ),
      },
      {
        path: '/profile/galleries/:id/edit',
        element: (
          <ProtectedRoute>
            <Suspense fallback={<FormPageSkeleton />}>
              <GalleryEditPage />
            </Suspense>
          </ProtectedRoute>
        ),
      },
      {
        path: '/profile/galleries/:gid/collections/:cid',
        element: (
          <ProtectedRoute>
            <Suspense fallback={<GridPageSkeleton />}>
              <CollectionManagerPage />
            </Suspense>
          </ProtectedRoute>
        ),
      },
      {
        path: '/profile/artworks',
        element: (
          <ProtectedRoute>
            <Suspense fallback={<GridPageSkeleton />}>
              <ArtworksPage />
            </Suspense>
          </ProtectedRoute>
        ),
      },
      {
        path: '/artworks/upload',
        element: (
          <ProtectedRoute>
            <Suspense fallback={<FormPageSkeleton />}>
              <ArtworkUploadPage />
            </Suspense>
          </ProtectedRoute>
        ),
      },
      {
        path: '/profile/artworks/:id/edit',
        element: (
          <ProtectedRoute>
            <Suspense fallback={<FormPageSkeleton />}>
              <ArtworkEditPage />
            </Suspense>
          </ProtectedRoute>
        ),
      },
      {
        path: '/profile/messages/compose',
        element: (
          <ProtectedRoute>
            <Suspense fallback={<FormPageSkeleton />}>
              <MessageComposePage />
            </Suspense>
          </ProtectedRoute>
        ),
      },
      {
        path: '/profile/messages/:id',
        element: (
          <ProtectedRoute>
            <Suspense fallback={<DetailPageSkeleton />}>
              <MessageThreadPage />
            </Suspense>
          </ProtectedRoute>
        ),
      },
      {
        path: '/profile/messages',
        element: (
          <ProtectedRoute>
            <Suspense fallback={<GridPageSkeleton />}>
              <MessagesPage />
            </Suspense>
          </ProtectedRoute>
        ),
      },
      // Admin routes
      {
        path: '/admin',
        element: (
          <AdminRoute>
            <Suspense fallback={<AdminPageSkeleton />}>
              <AdminDashboard />
            </Suspense>
          </AdminRoute>
        ),
      },
      {
        path: '/admin/users',
        element: (
          <AdminRoute>
            <Suspense fallback={<AdminPageSkeleton />}>
              <AdminUsers />
            </Suspense>
          </AdminRoute>
        ),
      },
      {
        path: '/admin/reports',
        element: (
          <AdminRoute>
            <Suspense fallback={<AdminPageSkeleton />}>
              <AdminReports />
            </Suspense>
          </AdminRoute>
        ),
      },
      {
        path: '/admin/moderation',
        element: (
          <AdminRoute>
            <Suspense fallback={<AdminPageSkeleton />}>
              <AdminModeration />
            </Suspense>
          </AdminRoute>
        ),
      },
      // Artist routes (must be after specific routes to avoid catching /profile, /admin, etc.)
      {
        path: '/:artist',
        element: (
          <Suspense fallback={<DetailPageSkeleton />}>
            <ArtistProfilePage />
          </Suspense>
        ),
      },
      {
        path: '/:artist/:gallery',
        element: (
          <Suspense fallback={<DetailPageSkeleton />}>
            <GalleryPage />
          </Suspense>
        ),
      },
      {
        path: '/:artist/:gallery/:collection',
        element: (
          <Suspense fallback={<DetailPageSkeleton />}>
            <CollectionPage />
          </Suspense>
        ),
      },
      {
        path: '/:artist/:gallery/:collection/:artwork',
        element: (
          <Suspense fallback={<DetailPageSkeleton />}>
            <ArtworkPage />
          </Suspense>
        ),
      },
      // 404 catch-all
      {
        path: '*',
        element: (
          <Suspense fallback={<GridPageSkeleton />}>
            <NotFoundPage />
          </Suspense>
        ),
      },
    ],
  },
]

export const router = createBrowserRouter(routes)
