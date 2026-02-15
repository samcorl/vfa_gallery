import { createBrowserRouter } from 'react-router-dom'
import type { RouteObject } from 'react-router-dom'

// Layout
import AppShell from './components/layout/AppShell'

// Route guards
import ProtectedRoute from './components/ProtectedRoute'
import AdminRoute from './components/AdminRoute'

// Public pages
import HomePage from './pages/HomePage'
import BrowsePage from './pages/BrowsePage'
import SearchPage from './pages/SearchPage'
import GroupPage from './pages/GroupPage'
import ArtistProfilePage from './pages/ArtistProfilePage'
import GalleryPage from './pages/GalleryPage'
import CollectionPage from './pages/CollectionPage'
import ArtworkPage from './pages/ArtworkPage'
import NotFoundPage from './pages/NotFoundPage'

// Landing pages (existing)
import { Docs } from './pages/Docs'
import { EduDocs } from './pages/EduDocs'
import { About } from './pages/About'

// Protected pages
import ProfilePage from './pages/ProfilePage'
import ProfileEditPage from './pages/ProfileEditPage'
import GalleriesPage from './pages/GalleriesPage'
import ArtworksPage from './pages/ArtworksPage'
import ArtworkUploadPage from './pages/ArtworkUploadPage'
import ArtworkEditPage from './pages/ArtworkEditPage'
import GalleryCreatePage from './pages/GalleryCreatePage'
import GalleryManagerPage from './pages/GalleryManagerPage'
import GalleryEditPage from './pages/GalleryEditPage'
import CollectionManagerPage from './pages/CollectionManagerPage'
import MessagesPage from './pages/MessagesPage'
import MessageComposePage from './pages/MessageComposePage'
import MessageThreadPage from './pages/MessageThreadPage'
import GroupManagePage from './pages/GroupManagePage'

// Admin pages
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminUsers from './pages/admin/AdminUsers'
import AdminReports from './pages/admin/AdminReports'
import AdminModeration from './pages/admin/AdminModeration'

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
        path: '/groups/:slug/manage',
        element: (
          <ProtectedRoute>
            <GroupManagePage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/groups/:slug',
        element: <GroupPage />,
      },
      // Landing pages
      {
        path: '/docs',
        element: <Docs />,
      },
      {
        path: '/edu',
        element: <EduDocs />,
      },
      {
        path: '/about',
        element: <About />,
      },
      // Protected routes
      {
        path: '/profile',
        element: (
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/profile/edit',
        element: (
          <ProtectedRoute>
            <ProfileEditPage />
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
        path: '/profile/galleries/new',
        element: (
          <ProtectedRoute>
            <GalleryCreatePage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/profile/galleries/:id',
        element: (
          <ProtectedRoute>
            <GalleryManagerPage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/profile/galleries/:id/edit',
        element: (
          <ProtectedRoute>
            <GalleryEditPage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/profile/galleries/:gid/collections/:cid',
        element: (
          <ProtectedRoute>
            <CollectionManagerPage />
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
        path: '/artworks/upload',
        element: (
          <ProtectedRoute>
            <ArtworkUploadPage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/profile/artworks/:id/edit',
        element: (
          <ProtectedRoute>
            <ArtworkEditPage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/profile/messages/compose',
        element: (
          <ProtectedRoute>
            <MessageComposePage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/profile/messages/:id',
        element: (
          <ProtectedRoute>
            <MessageThreadPage />
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
      // Admin routes
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
        path: '/admin/moderation',
        element: (
          <AdminRoute>
            <AdminModeration />
          </AdminRoute>
        ),
      },
      // Artist routes (must be after specific routes to avoid catching /profile, /admin, etc.)
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
      // 404 catch-all
      {
        path: '*',
        element: <NotFoundPage />,
      },
    ],
  },
]

export const router = createBrowserRouter(routes)
