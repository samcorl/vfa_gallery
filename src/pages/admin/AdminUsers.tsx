import { useState, useEffect, useCallback } from 'react'
import { useToast } from '../../contexts/ToastContext'
import { Search, Ban, CheckCircle, ChevronLeft, ChevronRight, X } from 'lucide-react'

interface AdminUserRow {
  id: string
  username: string
  email: string
  displayName: string | null
  status: string
  role: string
  artworkCount: number
  createdAt: string
  updatedAt: string
  lastLoginAt: string | null
}

interface UserDetail {
  id: string
  username: string
  email: string
  displayName: string | null
  avatarUrl: string | null
  bio: string | null
  website: string | null
  phone: string | null
  socials: Array<{ platform: string; url: string }>
  status: string
  role: string
  galleries: number
  collections: number
  artworks: number
  galleryLimit: number
  collectionLimit: number
  artworkLimit: number
  dailyUploadLimit: number
  emailVerifiedAt: string | null
  createdAt: string
  updatedAt: string
  lastLoginAt: string | null
  activity: {
    uploads: number
    messages: number
  }
}

interface Pagination {
  page: number
  limit: number
  total: number
  pages: number
}

export default function AdminUsers() {
  const { error: toastError, success: toastSuccess } = useToast()

  // State
  const [users, setUsers] = useState<AdminUserRow[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sort, setSort] = useState('created_at')
  const [order, setOrder] = useState('desc')
  const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [showDetail, setShowDetail] = useState(false)

  // Format date helper
  const formatDate = (dateString: string | null) => {
    if (!dateString) return '—'
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // Fetch users list
  const fetchUsers = useCallback(
    async (pageOverride?: number) => {
      try {
        setLoading(true)
        const params = new URLSearchParams({
          page: String(pageOverride || 1),
          limit: '20',
          search: search,
          status: statusFilter,
          sort: sort,
          order: order,
        })

        const response = await fetch(`/api/admin/users?${params}`, {
          credentials: 'include',
        })

        if (!response.ok) {
          throw new Error('Failed to fetch users')
        }

        const result = await response.json()
        setUsers(result.data.users)
        setPagination(result.data.pagination)
      } catch (error) {
        console.error('Error fetching users:', error)
        toastError('Failed to load users')
      } finally {
        setLoading(false)
      }
    },
    [search, statusFilter, sort, order, toastError]
  )

  // Fetch user detail
  const fetchUserDetail = useCallback(async (userId: string) => {
    try {
      setDetailLoading(true)
      setShowDetail(true)

      const response = await fetch(`/api/admin/users/${userId}`, {
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to fetch user details')
      }

      const result = await response.json()
      setSelectedUser(result.data)
    } catch (error) {
      console.error('Error fetching user detail:', error)
      toastError('Failed to load user details')
      setShowDetail(false)
    } finally {
      setDetailLoading(false)
    }
  }, [toastError])

  // Handle suspend
  const handleSuspend = useCallback(
    async (userId: string) => {
      if (!confirm('Are you sure you want to suspend this user?')) {
        return
      }

      try {
        const response = await fetch(`/api/admin/users/${userId}/suspend`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        })

        if (!response.ok) {
          throw new Error('Failed to suspend user')
        }

        toastSuccess('User suspended')
        setShowDetail(false)
        await fetchUsers()
      } catch (error) {
        console.error('Error suspending user:', error)
        toastError('Failed to suspend user')
      }
    },
    [toastSuccess, fetchUsers]
  )

  // Handle activate
  const handleActivate = useCallback(
    async (userId: string) => {
      if (!confirm('Are you sure you want to activate this user?')) {
        return
      }

      try {
        const response = await fetch(`/api/admin/users/${userId}/activate`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        })

        if (!response.ok) {
          throw new Error('Failed to activate user')
        }

        toastSuccess('User activated')
        setShowDetail(false)
        await fetchUsers()
      } catch (error) {
        console.error('Error activating user:', error)
        toastError('Failed to activate user')
      }
    },
    [toastSuccess, fetchUsers]
  )

  // Handle sort
  const handleSort = (field: string) => {
    if (sort === field) {
      setOrder(order === 'asc' ? 'desc' : 'asc')
    } else {
      setSort(field)
      setOrder('asc')
    }
  }

  // Handle search submit
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    fetchUsers(1)
  }

  // Handle status filter change
  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setStatusFilter(e.target.value)
  }

  // Fetch on mount and when filters change
  useEffect(() => {
    fetchUsers(1)
  }, [fetchUsers])

  // Get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">
            Active
          </span>
        )
      case 'pending':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-50 text-yellow-700">
            Pending
          </span>
        )
      case 'suspended':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700">
            Suspended
          </span>
        )
      case 'deleted':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
            Deleted
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-50 text-gray-700">
            {status}
          </span>
        )
    }
  }

  // Loading skeleton
  const SkeletonRow = () => (
    <tr className="border-b hover:bg-gray-50">
      <td className="px-6 py-4">
        <div className="h-4 bg-gray-200 rounded animate-pulse w-32"></div>
      </td>
      <td className="px-6 py-4">
        <div className="h-4 bg-gray-200 rounded animate-pulse w-48"></div>
      </td>
      <td className="px-6 py-4">
        <div className="h-4 bg-gray-200 rounded animate-pulse w-24"></div>
      </td>
      <td className="px-6 py-4 text-right">
        <div className="h-4 bg-gray-200 rounded animate-pulse w-12 ml-auto"></div>
      </td>
      <td className="px-6 py-4">
        <div className="h-4 bg-gray-200 rounded animate-pulse w-32"></div>
      </td>
      <td className="px-6 py-4">
        <div className="h-4 bg-gray-200 rounded animate-pulse w-20"></div>
      </td>
    </tr>
  )

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Manage Users</h1>
      <p className="text-gray-600 mb-8">View and manage user accounts.</p>

      {/* Toolbar */}
      <div className="bg-white rounded-lg shadow p-4 mb-6 flex flex-wrap gap-4 items-center">
        <form onSubmit={handleSearchSubmit} className="flex-1 min-w-[200px]">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search username or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition"
            >
              Search
            </button>
          </div>
        </form>

        <select
          value={statusFilter}
          onChange={handleStatusChange}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
        >
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="deleted">Deleted</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th
                  className="px-6 py-3 text-left font-semibold text-gray-900 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('username')}
                >
                  Username {sort === 'username' && (order === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-6 py-3 text-left font-semibold text-gray-900">Email</th>
                <th className="px-6 py-3 text-left font-semibold text-gray-900">Status</th>
                <th className="px-6 py-3 text-right font-semibold text-gray-900">Artworks</th>
                <th
                  className="px-6 py-3 text-left font-semibold text-gray-900 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('created_at')}
                >
                  Created {sort === 'created_at' && (order === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-6 py-3 text-left font-semibold text-gray-900">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <>
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                </>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    No users found
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b hover:bg-gray-50 cursor-pointer transition"
                    onClick={() => fetchUserDetail(user.id)}
                  >
                    <td className="px-6 py-4 font-medium text-gray-900">{user.username}</td>
                    <td className="px-6 py-4 text-gray-500">{user.email}</td>
                    <td className="px-6 py-4">{getStatusBadge(user.status)}</td>
                    <td className="px-6 py-4 text-right text-gray-900">{user.artworkCount}</td>
                    <td className="px-6 py-4 text-gray-500">{formatDate(user.createdAt)}</td>
                    <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                      {user.status === 'active' ? (
                        <button
                          onClick={() => handleSuspend(user.id)}
                          className="inline-flex items-center gap-1 px-3 py-1 rounded text-sm font-medium text-red-600 hover:bg-red-50 transition"
                        >
                          <Ban className="w-4 h-4" />
                          Suspend
                        </button>
                      ) : (
                        <button
                          onClick={() => handleActivate(user.id)}
                          className="inline-flex items-center gap-1 px-3 py-1 rounded text-sm font-medium text-green-600 hover:bg-green-50 transition"
                        >
                          <CheckCircle className="w-4 h-4" />
                          Activate
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination && (
          <div className="px-6 py-4 border-t flex items-center justify-between bg-gray-50">
            <span className="text-sm text-gray-600">
              Page {pagination.page} of {pagination.pages} ({pagination.total} users)
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => fetchUsers(pagination.page - 1)}
                disabled={pagination.page === 1}
                className="inline-flex items-center gap-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </button>
              <button
                onClick={() => fetchUsers(pagination.page + 1)}
                disabled={pagination.page === pagination.pages}
                className="inline-flex items-center gap-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* User Detail Modal */}
      {showDetail && selectedUser && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setShowDetail(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b flex items-center justify-between bg-gray-50 sticky top-0">
              <h2 className="text-xl font-semibold text-gray-900">{selectedUser.username}</h2>
              <button
                onClick={() => setShowDetail(false)}
                className="p-1 hover:bg-gray-200 rounded transition"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Modal Content */}
            {detailLoading ? (
              <div className="p-6 flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
              </div>
            ) : (
              <div className="p-6 space-y-6">
                {/* Profile Section */}
                <section>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">Profile</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs font-medium text-gray-500">Email</p>
                      <p className="text-sm text-gray-900 font-medium">{selectedUser.email}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500">Display Name</p>
                      <p className="text-sm text-gray-900">{selectedUser.displayName || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500">Status</p>
                      <div className="mt-1">{getStatusBadge(selectedUser.status)}</div>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500">Role</p>
                      <p className="text-sm text-gray-900 font-medium">{selectedUser.role}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500">Email Verified</p>
                      <p className="text-sm text-gray-900">
                        {selectedUser.emailVerifiedAt ? 'Yes' : 'No'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500">Member Since</p>
                      <p className="text-sm text-gray-900">{formatDate(selectedUser.createdAt)}</p>
                    </div>
                  </div>
                </section>

                {/* Resources Section */}
                <section>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">Resources</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs font-medium text-gray-500">Galleries</p>
                      <p className="text-sm text-gray-900">
                        {selectedUser.galleries} / {selectedUser.galleryLimit}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500">Collections</p>
                      <p className="text-sm text-gray-900">
                        {selectedUser.collections} / {selectedUser.collectionLimit}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500">Artworks</p>
                      <p className="text-sm text-gray-900">
                        {selectedUser.artworks} / {selectedUser.artworkLimit}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500">Daily Upload Limit</p>
                      <p className="text-sm text-gray-900">{selectedUser.dailyUploadLimit}</p>
                    </div>
                  </div>
                </section>

                {/* Activity Section */}
                <section>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">Activity</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs font-medium text-gray-500">Recent Uploads (30d)</p>
                      <p className="text-sm text-gray-900">{selectedUser.activity.uploads}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500">Messages</p>
                      <p className="text-sm text-gray-900">{selectedUser.activity.messages}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs font-medium text-gray-500">Last Login</p>
                      <p className="text-sm text-gray-900">
                        {selectedUser.lastLoginAt ? formatDate(selectedUser.lastLoginAt) : 'Never'}
                      </p>
                    </div>
                  </div>
                </section>
              </div>
            )}

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t flex justify-end gap-3 bg-gray-50">
              {selectedUser.status === 'active' ? (
                <button
                  onClick={() => handleSuspend(selectedUser.id)}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition"
                >
                  Suspend User
                </button>
              ) : (
                <button
                  onClick={() => handleActivate(selectedUser.id)}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition"
                >
                  Activate User
                </button>
              )}
              <button
                onClick={() => setShowDetail(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
