# 136-UI-ADMIN-DASHBOARD.md

## Goal

Create the admin dashboard page at `/admin` that displays platform overview with stats cards, quick action links, and recent activity feed showing the last 10-20 actions.

---

## Spec Extract

From TECHNICAL-SPEC.md - Admin Tools:

- **Route:** `/admin`
- **Authentication:** Required (must be logged in)
- **Authorization:** Admin role required
- **Page Components:**
  1. **Header:** "Admin Dashboard" with timestamp
  2. **Stats Overview Cards:**
     - Total Users (with active count)
     - Total Galleries (with active count)
     - Total Artworks (with flagged count)
     - Total Messages (with pending review count)
  3. **Quick Action Section:**
     - Link to User Management (/admin/users)
     - Link to Moderation Queue (/admin/messages)
     - Link to System Settings (future)
  4. **Recent Activity Feed:**
     - Last 10-20 activity log entries
     - Shows action, entity type, user, timestamp
     - Actionable entries (e.g., click to review flagged artwork)
- **Responsive Design:** Mobile-friendly with Tailwind CSS
- **Permissions:** Only accessible by admins (role='admin')

---

## Prerequisites

**Must complete before starting:**
- **134-API-ADMIN-STATS.md** - GET /api/admin/stats endpoint
- **135-API-ADMIN-ACTIVITY.md** - GET /api/admin/activity endpoint
- **02-TAILWIND-SETUP.md** - Tailwind CSS configured
- **16-API-MIDDLEWARE-AUTH.md** - Authentication working

---

## Steps

### Step 1: Create Admin Layout Component

Create a reusable layout for admin pages.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/admin/AdminLayout.tsx`

```typescript
import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

interface AdminLayoutProps {
  children: React.ReactNode
  title?: string
}

export function AdminLayout({ children, title = 'Admin' }: AdminLayoutProps) {
  const navigate = useNavigate()
  const { user, isAdmin, logout } = useAuth()

  // Redirect non-admins
  React.useEffect(() => {
    if (!isAdmin) {
      navigate('/')
    }
  }, [isAdmin, navigate])

  if (!isAdmin) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Admin Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">
                {user?.username} (Admin)
              </span>
              <button
                onClick={() => {
                  logout()
                  navigate('/')
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Admin Navigation */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8" aria-label="Admin tabs">
            <a
              href="/admin"
              className="px-1 py-4 border-b-2 border-blue-500 font-medium text-sm text-blue-600"
            >
              Dashboard
            </a>
            <a
              href="/admin/users"
              className="px-1 py-4 border-b-2 border-transparent font-medium text-sm text-gray-500 hover:text-gray-700 hover:border-gray-300"
            >
              Users
            </a>
            <a
              href="/admin/messages"
              className="px-1 py-4 border-b-2 border-transparent font-medium text-sm text-gray-500 hover:text-gray-700 hover:border-gray-300"
            >
              Moderation
            </a>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">{children}</main>
    </div>
  )
}

export default AdminLayout
```

---

### Step 2: Create Stats Card Component

Create a reusable stats card.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/admin/StatsCard.tsx`

```typescript
import React from 'react'

interface StatsCardProps {
  title: string
  total: number
  subtitle?: string
  subtotalCount?: number
  icon?: React.ReactNode
  onClick?: () => void
}

export function StatsCard({
  title,
  total,
  subtitle,
  subtotalCount,
  icon,
  onClick,
}: StatsCardProps) {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-lg shadow p-6 ${
        onClick ? 'cursor-pointer hover:shadow-lg transition-shadow' : ''
      }`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{total}</p>
          {subtitle && subtotalCount !== undefined && (
            <p className="mt-1 text-sm text-gray-500">
              {subtitle}: <span className="font-semibold">{subtotalCount}</span>
            </p>
          )}
        </div>
        {icon && <div className="text-3xl text-gray-400">{icon}</div>}
      </div>
    </div>
  )
}

export default StatsCard
```

---

### Step 3: Create Activity Feed Component

Create a component to display recent activity.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/admin/ActivityFeed.tsx`

```typescript
import React from 'react'
import type { ActivityLogEntry } from '../../types/adminActivity'

interface ActivityFeedProps {
  activities: ActivityLogEntry[]
  isLoading?: boolean
}

export function ActivityFeed({ activities, isLoading }: ActivityFeedProps) {
  if (isLoading) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Loading activity...</p>
      </div>
    )
  }

  if (activities.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No recent activity</p>
      </div>
    )
  }

  // Format action name for display
  const formatAction = (action: string): string => {
    return action
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  // Get badge color based on action
  const getActionColor = (action: string): string => {
    switch (action) {
      case 'create':
      case 'upload':
        return 'bg-green-100 text-green-800'
      case 'update':
      case 'edit':
        return 'bg-blue-100 text-blue-800'
      case 'delete':
        return 'bg-red-100 text-red-800'
      case 'flag':
      case 'review':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">Recent Activity</h3>
      </div>
      <div className="divide-y divide-gray-200">
        {activities.map((activity) => (
          <div key={activity.id} className="px-6 py-4 hover:bg-gray-50">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getActionColor(
                      activity.action
                    )}`}
                  >
                    {formatAction(activity.action)}
                  </span>
                  {activity.entityType && (
                    <span className="text-sm text-gray-600 capitalize">
                      {activity.entityType}
                    </span>
                  )}
                </div>
                <div className="mt-2">
                  {activity.username ? (
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">{activity.username}</span>
                      {activity.userEmail && (
                        <span className="text-gray-500"> ({activity.userEmail})</span>
                      )}
                    </p>
                  ) : (
                    <p className="text-sm text-gray-500">System action</p>
                  )}
                </div>
                {activity.metadata && Object.keys(activity.metadata).length > 0 && (
                  <div className="mt-2 text-xs text-gray-600">
                    {JSON.stringify(activity.metadata).substring(0, 100)}...
                  </div>
                )}
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">
                  {new Date(activity.createdAt).toLocaleDateString()}{' '}
                  {new Date(activity.createdAt).toLocaleTimeString()}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default ActivityFeed
```

---

### Step 4: Create Admin Dashboard Page

Create the main dashboard page.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/pages/admin/Dashboard.tsx`

```typescript
import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import AdminLayout from '../../components/admin/AdminLayout'
import StatsCard from '../../components/admin/StatsCard'
import ActivityFeed from '../../components/admin/ActivityFeed'
import type { AdminStatsData } from '../../types/adminStats'
import type { ActivityLogEntry } from '../../types/adminActivity'

export function AdminDashboard() {
  const navigate = useNavigate()
  const { isAdmin, token } = useAuth()
  const [stats, setStats] = useState<AdminStatsData | null>(null)
  const [activities, setActivities] = useState<ActivityLogEntry[]>([])
  const [isLoadingStats, setIsLoadingStats] = useState(true)
  const [isLoadingActivity, setIsLoadingActivity] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch stats and activity on mount
  useEffect(() => {
    if (!isAdmin) {
      navigate('/')
      return
    }

    fetchStats()
    fetchActivity()
  }, [isAdmin, token, navigate])

  const fetchStats = async () => {
    try {
      setIsLoadingStats(true)
      const response = await fetch('/api/admin/stats', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to fetch stats')
      }

      const data = await response.json()
      setStats(data.data)
      setError(null)
    } catch (err) {
      console.error('Error fetching stats:', err)
      setError('Failed to load statistics')
    } finally {
      setIsLoadingStats(false)
    }
  }

  const fetchActivity = async () => {
    try {
      setIsLoadingActivity(true)
      const response = await fetch('/api/admin/activity?limit=20', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to fetch activity')
      }

      const data = await response.json()
      setActivities(data.data.activities)
    } catch (err) {
      console.error('Error fetching activity:', err)
    } finally {
      setIsLoadingActivity(false)
    }
  }

  return (
    <AdminLayout title="Admin Dashboard">
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Stats Grid */}
      {isLoadingStats ? (
        <div className="text-center py-12">
          <p className="text-gray-500">Loading statistics...</p>
        </div>
      ) : stats ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          <StatsCard
            title="Total Users"
            total={stats.users.total}
            subtitle="Active"
            subtotalCount={stats.users.active}
            icon="👥"
            onClick={() => navigate('/admin/users')}
          />
          <StatsCard
            title="Total Galleries"
            total={stats.galleries.total}
            subtitle="Active"
            subtotalCount={stats.galleries.active}
            icon="🏛️"
          />
          <StatsCard
            title="Total Artworks"
            total={stats.artworks.total}
            subtitle="Flagged"
            subtotalCount={stats.artworks.flagged}
            icon="🖼️"
          />
          <StatsCard
            title="Messages"
            total={stats.messages.total}
            subtitle="Pending Review"
            subtotalCount={stats.messages.pending_review}
            icon="💬"
            onClick={() => navigate('/admin/messages')}
          />
        </div>
      ) : null}

      {/* Quick Actions */}
      <div className="mb-8 bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <button
            onClick={() => navigate('/admin/users')}
            className="px-4 py-3 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors font-medium text-sm"
          >
            👥 Manage Users
          </button>
          <button
            onClick={() => navigate('/admin/messages')}
            className="px-4 py-3 bg-yellow-50 text-yellow-700 rounded-lg hover:bg-yellow-100 transition-colors font-medium text-sm"
          >
            ⚠️ Moderation Queue
          </button>
          <button
            onClick={() => {
              alert('System settings coming soon')
            }}
            className="px-4 py-3 bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors font-medium text-sm disabled:opacity-50"
            disabled
          >
            ⚙️ System Settings
          </button>
        </div>
      </div>

      {/* Recent Activity */}
      <ActivityFeed activities={activities} isLoading={isLoadingActivity} />
    </AdminLayout>
  )
}

export default AdminDashboard
```

---

### Step 5: Add Admin Route to Router Configuration

Add the admin dashboard route.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/routes/index.tsx` (or your router file)

Add this import:

```typescript
import AdminDashboard from '../pages/admin/Dashboard'
```

Add this route in your route definitions:

```typescript
{
  path: '/admin',
  element: <AdminDashboard />,
  // Add requiresAuth and requiresAdmin guards if using route guards
}
```

If using React Router v6 with lazy loading:

```typescript
{
  path: '/admin',
  lazy: () => import('../pages/admin/Dashboard').then(m => ({ Component: m.default }))
}
```

---

### Step 6: Add useAuth Hook Update (if needed)

Ensure the useAuth hook includes isAdmin check.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/hooks/useAuth.ts`

Make sure it includes:

```typescript
export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    // Load from localStorage on mount
    const stored = localStorage.getItem('auth')
    if (stored) {
      const { user: u, token: t } = JSON.parse(stored)
      setUser(u)
      setToken(t)
      setIsAdmin(u?.role === 'admin')
    }
  }, [])

  return {
    user,
    token,
    isAdmin,
    // ... other methods
  }
}
```

---

## Files to Create/Modify

**New files to create:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/admin/AdminLayout.tsx`
2. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/admin/StatsCard.tsx`
3. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/admin/ActivityFeed.tsx`
4. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/pages/admin/Dashboard.tsx`

**Files to modify:**
1. Your router configuration file (add /admin route)
2. `useAuth` hook if needed (ensure isAdmin is set)

---

## Verification

### Test 1: TypeScript Compilation

```bash
cd /Volumes/DataSSD/gitsrc/vfa_gallery
npx tsc --noEmit
```

Expected: No type errors

---

### Test 2: Dev Server Starts

```bash
npx wrangler pages dev
```

Expected: No build errors

---

### Test 3: Access as Non-Authenticated User

Visit `http://localhost:8788/admin` without logging in

Expected: Redirect to home page (/)

---

### Test 4: Access as Regular User

1. Log in as regular user
2. Visit `http://localhost:8788/admin`

Expected: Redirect to home page (/)

---

### Test 5: Access as Admin User

1. Log in as admin user
2. Visit `http://localhost:8788/admin`

Expected: Dashboard displays with all components

---

### Test 6: Stats Cards Display

```bash
curl -H "Authorization: Bearer {Admin_Token}" \
  http://localhost:8788/api/admin/stats | jq '.data'
```

Then check that the dashboard shows:
- User card with total and active count
- Gallery card with total and active count
- Artwork card with total and flagged count
- Messages card with total and pending review count

---

### Test 7: Quick Action Links

1. Click "Manage Users" button
2. Click "Moderation Queue" button

Expected: Navigate to respective pages (even if pages don't exist yet)

---

### Test 8: Recent Activity Feed

1. Create some activity (upload artwork, etc.)
2. Return to dashboard

Expected: Recent activity appears in feed with:
- Action badge (colored)
- Entity type
- Username
- Timestamp

---

### Test 9: Responsive Design

Test on:
- Desktop (1200px+)
- Tablet (768px)
- Mobile (375px)

Expected: Layout adapts properly, cards stack on mobile

---

### Test 10: Navigation Tabs

- Dashboard tab should be highlighted
- Clicking Users and Moderation tabs should navigate (or show as disabled if not implemented)

---

### Test 11: Logout Button

Click logout button

Expected: User logs out and redirects to home page

---

### Test 12: Refresh Page

While logged in as admin, refresh dashboard

Expected: Dashboard reloads with fresh data

---

### Test 13: Error Handling

1. Mock API error (use browser dev tools to block /api/admin/stats)
2. Visit dashboard

Expected: Shows error message but doesn't crash

---

### Test 14: Empty State

1. With fresh database (no activity)
2. Visit dashboard

Expected: Activity feed shows "No recent activity"

---

## Success Criteria

- [ ] TypeScript compiles without errors
- [ ] Admin dashboard page loads at /admin
- [ ] Non-admins redirected to home page
- [ ] Stats cards display user, gallery, artwork, message counts
- [ ] Stats cards show relevant sub-metrics (active, flagged, pending)
- [ ] Quick action buttons navigate to user and moderation pages
- [ ] Recent activity feed displays last 10-20 entries
- [ ] Activity items show action, entity type, user, timestamp
- [ ] Admin can logout from dashboard
- [ ] Dashboard responsive on mobile, tablet, desktop
- [ ] Error states handled gracefully
- [ ] Empty state displays when no activity

---

## Next Steps

Once this build is verified, proceed to **137-API-ADMIN-USERS-LIST.md** for user management endpoints, and **143-API-ADMIN-MESSAGES-PENDING.md** for moderation queue.
