# 161-POLISH-BUNDLE-SPLITTING.md

## Goal

Implement code splitting for route-based components using React.lazy and Suspense, reducing initial bundle size and improving page load performance by loading admin section and other features on-demand.

---

## Spec Extract

From TECHNICAL-SPEC.md and Performance Requirements:

- **Route-Based Code Splitting:**
  - React.lazy for route components
  - Suspense boundaries with loading fallback
  - Separate chunks for admin section
  - Separate chunks for profile pages
  - Lazy load heavy components

- **Loading Fallbacks:**
  - Skeleton components during chunk load
  - Progress indicator for major sections
  - Smooth transitions
  - No blank pages

- **Bundle Optimization:**
  - Identify split points (route level)
  - Minimize redundant code across chunks
  - Vendor code optimization
  - Lazy loading of utilities

- **Performance Goals:**
  - Reduce initial bundle by 40%+
  - Admin section loads on demand
  - Critical path optimized
  - Time to Interactive (TTI) improved

---

## Prerequisites

**Must complete before starting:**
- **24-REACT-ROUTER-SETUP.md** - Router structure established
- **27-REACT-LAYOUT-SHELL.md** - Layout shell complete
- **159-POLISH-SKELETON-LOADERS.md** - Skeleton components available

---

## Steps

### Step 1: Create Code Splitting Configuration

Create utility for consistent code splitting setup.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/utils/codeSplitting.ts`

```typescript
import React, { LazyExoticComponent, ReactNode } from 'react'

interface LazyComponentOptions {
  /**
   * Component module path (for debugging)
   */
  path?: string

  /**
   * Custom loading component
   */
  fallback?: ReactNode

  /**
   * Load delay for perceived performance
   * Default: 0
   */
  delay?: number

  /**
   * Whether to show suspense boundary
   * Default: true
   */
  showSuspense?: boolean
}

/**
 * Create a lazy-loaded component with consistent setup
 *
 * Usage:
 * const AdminDashboard = createLazyComponent(
 *   () => import('./pages/admin/Dashboard'),
 *   { fallback: <SkeletonGrid /> }
 * )
 */
export function createLazyComponent<T extends React.ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  options: LazyComponentOptions = {}
): LazyExoticComponent<T> {
  const LazyComponent = React.lazy(importFn)
  return LazyComponent
}

/**
 * Create a suspense boundary with fallback
 *
 * Usage:
 * <SuspenseBoundary fallback={<SkeletonGrid />}>
 *   <LazyComponent />
 * </SuspenseBoundary>
 */
interface SuspenseBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error) => void
}

export const SuspenseBoundary: React.FC<SuspenseBoundaryProps> = ({
  children,
  fallback = null,
  onError
}) => {
  return (
    <React.Suspense fallback={fallback}>
      {children}
    </React.Suspense>
  )
}

/**
 * Create multiple lazy routes
 *
 * Usage:
 * const routes = createLazyRoutes({
 *   dashboard: () => import('./pages/admin/Dashboard'),
 *   users: () => import('./pages/admin/Users')
 * })
 */
export function createLazyRoutes<T extends Record<string, () => Promise<{ default: React.ComponentType<any> }>>>(
  routes: T
) {
  return Object.entries(routes).reduce((acc, [key, importFn]) => {
    acc[key as keyof T] = React.lazy(importFn) as any
    return acc
  }, {} as Record<keyof T, LazyExoticComponent<any>>)
}
```

---

### Step 2: Create Lazy Route Configuration

Define all lazy-loaded routes.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/config/lazyRoutes.ts`

```typescript
import React from 'react'

/**
 * Lazy-loaded route components
 * These will be split into separate chunks by bundler
 */

// Public routes (should load with initial bundle)
export const LazyRoutes = {
  // Landing/Home
  Landing: React.lazy(() => import('../pages/Landing')),
  Browse: React.lazy(() => import('../pages/Browse')),

  // User Profile Pages
  ProfileView: React.lazy(() => import('../pages/profile/ProfileView')),
  ProfileEdit: React.lazy(() => import('../pages/profile/ProfileEdit')),

  // Artwork Pages
  ArtworkDetail: React.lazy(() => import('../pages/artwork/ArtworkDetail')),
  ArtworkCreate: React.lazy(() => import('../pages/artwork/ArtworkCreate')),
  ArtworkEdit: React.lazy(() => import('../pages/artwork/ArtworkEdit')),

  // Gallery Pages
  GalleryList: React.lazy(() => import('../pages/gallery/GalleryList')),
  GalleryCreate: React.lazy(() => import('../pages/gallery/GalleryCreate')),
  GalleryEdit: React.lazy(() => import('../pages/gallery/GalleryEdit')),
  GalleryView: React.lazy(() => import('../pages/gallery/GalleryView')),

  // Collection Pages
  CollectionList: React.lazy(() => import('../pages/collection/CollectionList')),
  CollectionCreate: React.lazy(() => import('../pages/collection/CollectionCreate')),
  CollectionEdit: React.lazy(() => import('../pages/collection/CollectionEdit')),
  CollectionView: React.lazy(() => import('../pages/collection/CollectionView')),

  // Admin Section (larger chunk, loaded on demand)
  AdminDashboard: React.lazy(() => import('../pages/admin/Dashboard')),
  AdminUsers: React.lazy(() => import('../pages/admin/Users')),
  AdminArtworks: React.lazy(() => import('../pages/admin/Artworks')),
  AdminGalleries: React.lazy(() => import('../pages/admin/Galleries')),
  AdminAnalytics: React.lazy(() => import('../pages/admin/Analytics')),
  AdminModeration: React.lazy(() => import('../pages/admin/Moderation')),

  // Error Pages
  NotFound: React.lazy(() => import('../pages/NotFound')),
  ErrorBoundary: React.lazy(() => import('../pages/ErrorFallback'))
} as const

/**
 * Eagerly loaded components
 * These load with the initial bundle (critical path)
 */
export const EagerRoutes = {
  Shell: () => import('../pages/Shell'),
  Login: () => import('../pages/auth/Login'),
  Register: () => import('../pages/auth/Register')
} as const
```

---

### Step 3: Update Router Configuration

Update the router to use lazy-loaded routes.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/pages/routes.tsx`

```typescript
import React from 'react'
import { RouteObject, Navigate } from 'react-router-dom'
import { LazyRoutes } from '../config/lazyRoutes'
import { SuspenseBoundary } from '../utils/codeSplitting'
import { SkeletonGrid } from '../components/common/SkeletonGrid'
import { SkeletonText } from '../components/common/SkeletonText'
import { Shell } from './Shell'

/**
 * Loading fallback components for different sections
 */
const LoadingFallback = {
  grid: <SkeletonGrid count={8} />,
  detail: <SkeletonText lines={5} />,
  admin: <SkeletonGrid count={12} />
}

/**
 * Application routes with code splitting
 */
export const routes: RouteObject[] = [
  {
    element: <Shell />,
    children: [
      // Public Routes
      {
        index: true,
        element: (
          <SuspenseBoundary fallback={LoadingFallback.detail}>
            <LazyRoutes.Landing />
          </SuspenseBoundary>
        )
      },

      {
        path: 'browse',
        element: (
          <SuspenseBoundary fallback={LoadingFallback.grid}>
            <LazyRoutes.Browse />
          </SuspenseBoundary>
        )
      },

      // User Profile Routes
      {
        path: 'profile',
        children: [
          {
            path: ':userId',
            element: (
              <SuspenseBoundary fallback={LoadingFallback.detail}>
                <LazyRoutes.ProfileView />
              </SuspenseBoundary>
            )
          },
          {
            path: 'edit',
            element: (
              <SuspenseBoundary fallback={LoadingFallback.detail}>
                <LazyRoutes.ProfileEdit />
              </SuspenseBoundary>
            ),
            meta: { requiresAuth: true }
          }
        ]
      },

      // Artwork Routes
      {
        path: 'artworks',
        children: [
          {
            path: 'create',
            element: (
              <SuspenseBoundary fallback={LoadingFallback.detail}>
                <LazyRoutes.ArtworkCreate />
              </SuspenseBoundary>
            ),
            meta: { requiresAuth: true }
          },
          {
            path: ':artworkId',
            children: [
              {
                index: true,
                element: (
                  <SuspenseBoundary fallback={LoadingFallback.detail}>
                    <LazyRoutes.ArtworkDetail />
                  </SuspenseBoundary>
                )
              },
              {
                path: 'edit',
                element: (
                  <SuspenseBoundary fallback={LoadingFallback.detail}>
                    <LazyRoutes.ArtworkEdit />
                  </SuspenseBoundary>
                ),
                meta: { requiresAuth: true }
              }
            ]
          }
        ]
      },

      // Gallery Routes
      {
        path: 'galleries',
        children: [
          {
            index: true,
            element: (
              <SuspenseBoundary fallback={LoadingFallback.grid}>
                <LazyRoutes.GalleryList />
              </SuspenseBoundary>
            )
          },
          {
            path: 'create',
            element: (
              <SuspenseBoundary fallback={LoadingFallback.detail}>
                <LazyRoutes.GalleryCreate />
              </SuspenseBoundary>
            ),
            meta: { requiresAuth: true }
          },
          {
            path: ':galleryId',
            children: [
              {
                index: true,
                element: (
                  <SuspenseBoundary fallback={LoadingFallback.detail}>
                    <LazyRoutes.GalleryView />
                  </SuspenseBoundary>
                )
              },
              {
                path: 'edit',
                element: (
                  <SuspenseBoundary fallback={LoadingFallback.detail}>
                    <LazyRoutes.GalleryEdit />
                  </SuspenseBoundary>
                ),
                meta: { requiresAuth: true }
              }
            ]
          }
        ]
      },

      // Collection Routes
      {
        path: 'collections',
        children: [
          {
            index: true,
            element: (
              <SuspenseBoundary fallback={LoadingFallback.grid}>
                <LazyRoutes.CollectionList />
              </SuspenseBoundary>
            )
          },
          {
            path: 'create',
            element: (
              <SuspenseBoundary fallback={LoadingFallback.detail}>
                <LazyRoutes.CollectionCreate />
              </SuspenseBoundary>
            ),
            meta: { requiresAuth: true }
          },
          {
            path: ':collectionId',
            children: [
              {
                index: true,
                element: (
                  <SuspenseBoundary fallback={LoadingFallback.detail}>
                    <LazyRoutes.CollectionView />
                  </SuspenseBoundary>
                )
              },
              {
                path: 'edit',
                element: (
                  <SuspenseBoundary fallback={LoadingFallback.detail}>
                    <LazyRoutes.CollectionEdit />
                  </SuspenseBoundary>
                ),
                meta: { requiresAuth: true }
              }
            ]
          }
        ]
      },

      // Admin Routes (separate chunk)
      {
        path: 'admin',
        children: [
          {
            path: 'dashboard',
            element: (
              <SuspenseBoundary fallback={LoadingFallback.admin}>
                <LazyRoutes.AdminDashboard />
              </SuspenseBoundary>
            ),
            meta: { requiresAuth: true, requiresAdmin: true }
          },
          {
            path: 'users',
            element: (
              <SuspenseBoundary fallback={LoadingFallback.grid}>
                <LazyRoutes.AdminUsers />
              </SuspenseBoundary>
            ),
            meta: { requiresAuth: true, requiresAdmin: true }
          },
          {
            path: 'artworks',
            element: (
              <SuspenseBoundary fallback={LoadingFallback.grid}>
                <LazyRoutes.AdminArtworks />
              </SuspenseBoundary>
            ),
            meta: { requiresAuth: true, requiresAdmin: true }
          },
          {
            path: 'galleries',
            element: (
              <SuspenseBoundary fallback={LoadingFallback.grid}>
                <LazyRoutes.AdminGalleries />
              </SuspenseBoundary>
            ),
            meta: { requiresAuth: true, requiresAdmin: true }
          },
          {
            path: 'analytics',
            element: (
              <SuspenseBoundary fallback={LoadingFallback.detail}>
                <LazyRoutes.AdminAnalytics />
              </SuspenseBoundary>
            ),
            meta: { requiresAuth: true, requiresAdmin: true }
          },
          {
            path: 'moderation',
            element: (
              <SuspenseBoundary fallback={LoadingFallback.detail}>
                <LazyRoutes.AdminModeration />
              </SuspenseBoundary>
            ),
            meta: { requiresAuth: true, requiresAdmin: true }
          }
        ]
      },

      // Error Routes
      {
        path: '*',
        element: (
          <SuspenseBoundary fallback={null}>
            <LazyRoutes.NotFound />
          </SuspenseBoundary>
        )
      }
    ]
  }
]
```

---

### Step 4: Create Loading Boundary Component

Create a custom error boundary for chunk loading errors.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/components/common/ChunkErrorBoundary.tsx`

```typescript
import React, { ReactNode } from 'react'
import { useToast } from '../../hooks/useToast'

interface ChunkErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
}

interface ChunkErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

/**
 * Error boundary for chunk loading failures
 * Handles cases where code chunks fail to load
 */
export class ChunkErrorBoundary extends React.Component<
  ChunkErrorBoundaryProps,
  ChunkErrorBoundaryState
> {
  constructor(props: ChunkErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null
    }
  }

  static getDerivedStateFromError(error: Error) {
    // Detect chunk loading error
    const isChunkError =
      error instanceof Error &&
      (error.message.includes('Loading chunk') ||
        error.message.includes('Failed to import'))

    return {
      hasError: isChunkError,
      error: isChunkError ? error : null
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Chunk loading error:', error, errorInfo)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Loading Error
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Failed to load this section. Please try again.
            </p>
            <button
              onClick={this.handleRetry}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Reload
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
```

---

### Step 5: Create Bundle Analysis Utilities

Create utilities for analyzing bundle size.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/utils/bundleAnalysis.ts`

```typescript
/**
 * Bundle size tracking utilities
 * Help monitor and optimize bundle splitting
 */

interface BundleMetrics {
  /**
   * Chunk name
   */
  name: string

  /**
   * Size in bytes
   */
  size: number

  /**
   * Size in KB
   */
  sizeKB: number

  /**
   * Load time estimate in ms (on 3G)
   */
  loadTimeMs: number

  /**
   * Gzip size in bytes
   */
  gzipSize: number

  /**
   * Gzip size in KB
   */
  gzipSizeKB: number
}

/**
 * Calculate estimated load time
 * Based on 3G speed (384 kbps)
 */
export function estimateLoadTime(sizeBytes: number): number {
  const SPEED_3G = 384000 / 8 // bits per second to bytes per second
  return Math.round((sizeBytes / SPEED_3G) * 1000)
}

/**
 * Log bundle metrics
 */
export function logBundleMetrics(metrics: BundleMetrics) {
  console.group(`📦 Bundle: ${metrics.name}`)
  console.log(`Size: ${metrics.sizeKB}KB (gzip: ${metrics.gzipSizeKB}KB)`)
  console.log(`Est. load time (3G): ${metrics.loadTimeMs}ms`)
  console.groupEnd()
}

/**
 * Monitor chunk loading performance
 */
export function monitorChunkLoad(chunkName: string) {
  const startTime = performance.now()

  return {
    complete: () => {
      const duration = performance.now() - startTime
      console.log(`✓ Chunk loaded: ${chunkName} (${duration.toFixed(2)}ms)`)
    }
  }
}

/**
 * Report Web Vitals for chunk loading
 */
export function reportChunkLoadVitals(
  chunkName: string,
  duration: number
) {
  const vitals = {
    chunkName,
    duration,
    timestamp: new Date().toISOString(),
    isSlowLoad: duration > 3000 // 3 second threshold
  }

  // Send to analytics
  if (window.gtag) {
    window.gtag('event', 'chunk_load', {
      chunk_name: chunkName,
      duration_ms: duration,
      slow_load: vitals.isSlowLoad
    })
  }

  return vitals
}
```

---

### Step 6: Create Dynamic Import Wrapper

Create a wrapper for safe dynamic imports.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/utils/dynamicImport.ts`

```typescript
import React from 'react'

/**
 * Options for dynamic imports
 */
interface DynamicImportOptions {
  /**
   * Fallback component to show while loading
   */
  fallback?: React.ReactNode

  /**
   * Delay before showing fallback (ms)
   * Prevents flash on fast connections
   * Default: 200
   */
  delay?: number

  /**
   * Timeout for chunk load (ms)
   * Default: 10000
   */
  timeout?: number

  /**
   * Error component to show on failure
   */
  onError?: (error: Error) => React.ReactNode
}

/**
 * Safely import a component with retry logic
 */
export async function safeImport<T>(
  importFn: () => Promise<{ default: T }>,
  retries = 3
): Promise<T> {
  let lastError: Error | null = null

  for (let i = 0; i < retries; i++) {
    try {
      const module = await importFn()
      return module.default
    } catch (error) {
      lastError = error as Error

      // Exponential backoff
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)))
      }
    }
  }

  throw lastError || new Error('Failed to import component')
}

/**
 * Create a lazy component with automatic retry
 */
export function lazyWithRetry<T extends React.ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  options: DynamicImportOptions = {}
) {
  return React.lazy(async () => {
    try {
      return await safeImport(importFn, 3)
    } catch (error) {
      console.error('Failed to load component:', error)
      throw error
    }
  })
}

/**
 * Preload a chunk
 * Useful for prefetching chunks before navigation
 */
export function preloadChunk(
  importFn: () => Promise<{ default: any }>
) {
  return importFn().catch(error => {
    console.warn('Preload failed:', error)
  })
}
```

---

### Step 7: Update Vite/Build Configuration

Configure code splitting in build settings.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/vite.config.ts` (modify)

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    /**
     * Code splitting configuration
     */
    rollupOptions: {
      output: {
        /**
         * Manual chunks configuration
         * Optimize chunk size and dependencies
         */
        manualChunks: {
          // React ecosystem
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],

          // UI/Styling
          'vendor-ui': ['tailwindcss', 'clsx'],

          // Admin features (separate chunk)
          'admin': [
            './src/pages/admin/Dashboard',
            './src/pages/admin/Users',
            './src/pages/admin/Artworks',
            './src/pages/admin/Galleries'
          ],

          // Utilities
          'utils': ['axios', 'date-fns']
        }
      }
    },

    /**
     * Chunk size warnings
     */
    chunkSizeWarningLimit: 500, // 500 KB

    /**
     * Source maps for production (optional)
     */
    sourcemap: false,

    /**
     * Minification
     */
    minify: 'terser',

    /**
     * Assets
     */
    assetsDir: 'assets',
    assetsInlineLimit: 4096
  }
})
```

---

## Files to Create/Modify

1. **Create:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/utils/codeSplitting.ts`
2. **Create:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/config/lazyRoutes.ts`
3. **Create:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/components/common/ChunkErrorBoundary.tsx`
4. **Create:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/utils/bundleAnalysis.ts`
5. **Create:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/utils/dynamicImport.ts`
6. **Modify:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/pages/routes.tsx` - Update with lazy routes and suspense boundaries
7. **Modify:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/vite.config.ts` - Add code splitting configuration

---

## Verification

1. **Initial Bundle Size:**
   - Measure initial bundle (before visiting non-critical pages)
   - Should be significantly smaller than monolithic bundle
   - Vendor chunks loaded once and cached

2. **Lazy Loading:**
   - Navigate to admin section
   - Verify admin chunk loads in Network tab
   - Chunk only loads once, then cached
   - No duplicate code across chunks

3. **Route-Based Splitting:**
   - Each route has its own chunk in Network tab
   - Profile routes in one chunk
   - Admin routes in separate chunk
   - Gallery/collection routes split appropriately

4. **Loading Fallbacks:**
   - Skeletons appear while chunk loads
   - Smooth transition to loaded content
   - No blank page during load
   - Loading appears fast on 3G

5. **Error Handling:**
   - Simulate chunk load failure
   - Error boundary displays
   - Reload button available
   - Graceful error message shown

6. **Performance Impact:**
   - First Contentful Paint (FCP) improved
   - Time to Interactive (TTI) faster
   - Largest Contentful Paint (LCP) acceptable
   - Total Blocking Time (TBT) reduced

7. **Browser DevTools:**
   - Coverage tab shows unused code
   - Network tab shows chunk files
   - Performance profiler shows chunk load timing
   - No errors in console

8. **Bundle Analysis:**
   - Use `npm run analyze` to inspect bundle
   - Identify large dependencies
   - Verify manual chunks applied
   - Check for duplicate code

9. **Build Output:**
   - Separate chunk files created
   - Chunk names meaningful (vendor-react, admin, etc.)
   - Hash added to filenames
   - Source maps (if enabled) generated

10. **Cross-Browser:**
    - Works in Chrome
    - Works in Firefox
    - Works in Safari
    - Works in Edge
    - Graceful degradation on older browsers
