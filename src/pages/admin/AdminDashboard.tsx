import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { Users, Image, LayoutGrid, Mail, Activity, AlertTriangle } from 'lucide-react'

interface AdminStats {
  users: { total: number; active: number; pending: number; suspended: number; deactivated: number }
  galleries: { total: number; active: number; archived: number; draft: number }
  artworks: { total: number; active: number; hidden: number; flagged: number; deleted: number }
  messages: { total: number; sent: number; pending_review: number; approved: number; rejected: number }
  recentActivity: Array<{
    action: string
    entityType: string | null
    userId: string | null
    username: string | null
    createdAt: string
  }>
  generatedAt: string
}

interface ActivityEntry {
  id: string
  action: string
  entityType: string | null
  entityId: string | null
  userId: string | null
  username: string | null
  userEmail: string | null
  metadata: Record<string, any> | null
  ipAddress: string | null
  userAgent: string | null
  createdAt: string
}

export default function AdminDashboard() {
  const { } = useAuth()
  const { error: toastError } = useToast()
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [activities, setActivities] = useState<ActivityEntry[]>([])
  const [statsLoading, setStatsLoading] = useState(true)
  const [activityLoading, setActivityLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchStats = useCallback(async () => {
    try {
      setStatsLoading(true)
      setError(null)
      const response = await fetch('/api/admin/stats', {
        credentials: 'include',
      })
      if (!response.ok) throw new Error('Failed to fetch stats')
      const data = await response.json()
      setStats(data.data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch stats'
      setError(message)
      toastError(message)
    } finally {
      setStatsLoading(false)
    }
  }, [toastError])

  const fetchActivity = useCallback(async () => {
    try {
      setActivityLoading(true)
      const response = await fetch('/api/admin/activity?limit=20', {
        credentials: 'include',
      })
      if (!response.ok) throw new Error('Failed to fetch activity')
      const data = await response.json()
      setActivities(data.data.activities || [])
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch activity'
      console.error(message)
    } finally {
      setActivityLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStats()
    fetchActivity()
  }, [fetchStats, fetchActivity])

  const formatAction = (action: string) =>
    action.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-500 mt-1">System overview and management tools.</p>
      </div>

      {error && (
        <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {statsLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="h-4 w-24 bg-gray-200 rounded animate-pulse"></div>
                <div className="h-5 w-5 bg-gray-200 rounded animate-pulse"></div>
              </div>
              <div className="h-9 w-16 bg-gray-200 rounded animate-pulse mb-2"></div>
              <div className="h-4 w-32 bg-gray-100 rounded animate-pulse"></div>
            </div>
          ))}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-600">Users</p>
              <Users className="w-5 h-5 text-gray-400" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{stats.users.total}</p>
            <p className="text-sm text-gray-500 mt-1">
              Active: <span className="font-semibold">{stats.users.active}</span>
            </p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-600">Galleries</p>
              <LayoutGrid className="w-5 h-5 text-gray-400" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{stats.galleries.total}</p>
            <p className="text-sm text-gray-500 mt-1">
              Active: <span className="font-semibold">{stats.galleries.active}</span>
            </p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-600">Artworks</p>
              <Image className="w-5 h-5 text-gray-400" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{stats.artworks.total}</p>
            <p className="text-sm text-gray-500 mt-1">
              Flagged: <span className="font-semibold inline-flex items-center gap-1">
                {stats.artworks.flagged}
                {stats.artworks.flagged > 0 && <AlertTriangle className="w-3 h-3" />}
              </span>
            </p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-600">Messages</p>
              <Mail className="w-5 h-5 text-gray-400" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{stats.messages.total}</p>
            <p className="text-sm text-gray-500 mt-1">
              Pending Review: <span className="font-semibold">{stats.messages.pending_review}</span>
            </p>
          </div>
        </div>
      ) : null}

      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/admin/users"
            className="px-4 py-2 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 text-sm"
          >
            Manage Users
          </Link>
          <Link
            to="/admin/reports"
            className="px-4 py-2 border border-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-50 text-sm"
          >
            View Reports
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-2">
          <Activity className="w-5 h-5 text-gray-400" />
          <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
        </div>

        {activityLoading ? (
          <div className="px-6 py-8 flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border border-gray-200 border-t-gray-900"></div>
          </div>
        ) : activities.length === 0 ? (
          <div className="px-6 py-8 text-center">
            <p className="text-gray-500">No recent activity</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {activities.map((activity, idx) => (
              <div key={idx} className="px-6 py-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                        {formatAction(activity.action)}
                      </span>
                      {activity.entityType && (
                        <span className="text-sm text-gray-500 capitalize">{activity.entityType}</span>
                      )}
                    </div>
                    {activity.username && (
                      <p className="text-sm text-gray-600 mt-1">
                        by <span className="font-medium">@{activity.username}</span>
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-gray-400 whitespace-nowrap">
                    {new Date(activity.createdAt).toLocaleDateString()} {new Date(activity.createdAt).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
