import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import Avatar from '../components/ui/Avatar'
import { UserPlus, Trash2, Shield } from 'lucide-react'
import type { GalleryDetail } from '../types/gallery'

interface GalleryRole {
  userId: string
  username: string
  displayName: string | null
  avatarUrl: string | null
  role: 'creator' | 'admin'
  grantedAt: string
  grantedBy: string | null
}

export default function GalleryManagerPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const { isLoading: authLoading } = useAuth()
  const toast = useToast()

  const [gallery, setGallery] = useState<GalleryDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newCollectionName, setNewCollectionName] = useState('')
  const [newCollectionDescription, setNewCollectionDescription] = useState('')
  const [creating, setCreating] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'collections' | 'roles'>('collections')
  const [roles, setRoles] = useState<GalleryRole[]>([])
  const [rolesLoading, setRolesLoading] = useState(false)
  const [rolesError, setRolesError] = useState<string | null>(null)
  const [addUsername, setAddUsername] = useState('')
  const [addingRole, setAddingRole] = useState(false)

  const fetchGallery = useCallback(async () => {
    if (!id) return

    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/galleries/${id}`, {
        credentials: 'include',
      })

      if (!res.ok) {
        if (res.status === 404) {
          setError('Gallery not found')
        } else {
          throw new Error('Failed to load gallery')
        }
        return
      }

      const data: GalleryDetail = await res.json()
      setGallery(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load gallery'
      setError(message)
      toast.error(message)
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [id, toast])

  const fetchRoles = useCallback(async () => {
    if (!id) return
    setRolesLoading(true)
    setRolesError(null)
    try {
      const res = await fetch(`/api/galleries/${id}/roles`, {
        credentials: 'include',
      })
      if (!res.ok) throw new Error('Failed to load roles')
      const data = await res.json()
      setRoles(data.data || [])
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load roles'
      setRolesError(message)
    } finally {
      setRolesLoading(false)
    }
  }, [id])

  useEffect(() => {
    if (!authLoading) {
      fetchGallery()
    }
  }, [fetchGallery, authLoading])

  useEffect(() => {
    if (activeTab === 'roles' && roles.length === 0 && !rolesLoading) {
      fetchRoles()
    }
  }, [activeTab, roles.length, rolesLoading, fetchRoles])

  const handleCreateCollection = async () => {
    setFormError(null)

    if (!newCollectionName.trim()) {
      setFormError('Collection name is required')
      return
    }

    if (!id) return

    setCreating(true)
    try {
      const res = await fetch(`/api/galleries/${id}/collections`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCollectionName.trim(),
          description: newCollectionDescription.trim() || undefined,
        }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.message || 'Failed to create collection')
      }

      toast.success('Collection created successfully')
      setShowCreateModal(false)
      setNewCollectionName('')
      setNewCollectionDescription('')
      fetchGallery()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create collection'
      setFormError(message)
      toast.error(message)
      console.error(err)
    } finally {
      setCreating(false)
    }
  }

  const handleAddAdmin = async () => {
    if (!addUsername.trim() || !id) return
    setAddingRole(true)
    try {
      const res = await fetch(`/api/galleries/${id}/roles`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: addUsername.trim(), role: 'admin' }),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error?.message || 'Failed to add admin')
      }
      const data = await res.json()
      setRoles([...roles, data.data])
      setAddUsername('')
      toast.success('Admin added successfully')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add admin')
    } finally {
      setAddingRole(false)
    }
  }

  const handleRemoveAdmin = async (userId: string, username: string) => {
    if (!window.confirm(`Remove admin access for @${username}?`)) return
    try {
      const res = await fetch(`/api/galleries/${id}/roles/${userId}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error?.message || 'Failed to remove admin')
      }
      setRoles(roles.filter((r) => r.userId !== userId))
      toast.success('Admin removed successfully')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove admin')
    }
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header skeleton */}
        <div className="mb-8">
          <div className="h-10 bg-gray-100 rounded-lg w-32 mb-4 animate-pulse" />
          <div className="h-8 bg-gray-100 rounded-lg w-64 mb-2 animate-pulse" />
          <div className="h-5 bg-gray-100 rounded-lg w-48 animate-pulse" />
        </div>

        {/* Cards skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="rounded-lg border border-gray-200 bg-white p-4 h-40 animate-pulse"
            />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <button
          onClick={() => navigate('/profile/galleries')}
          className="text-gray-600 hover:text-gray-900 text-sm font-medium mb-6 flex items-center gap-1"
        >
          ← My Galleries
        </button>

        <div className="text-center py-16 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-gray-900 font-medium text-lg mb-4">{error}</p>
          <button
            onClick={() => fetchGallery()}
            className="inline-flex items-center px-4 py-2 bg-gray-900 text-white rounded-lg font-semibold hover:bg-gray-800 text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!gallery) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <button
          onClick={() => navigate('/profile/galleries')}
          className="text-gray-600 hover:text-gray-900 text-sm font-medium mb-6 flex items-center gap-1"
        >
          ← My Galleries
        </button>

        <div className="text-center py-16 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-gray-900 font-medium text-lg">Gallery not found</p>
        </div>
      </div>
    )
  }

  const statusBadgeColor = {
    active: 'bg-gray-100 text-gray-700',
    archived: 'bg-gray-200 text-gray-500',
    draft: 'bg-gray-100 text-gray-500',
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Back link */}
      <button
        onClick={() => navigate('/profile/galleries')}
        className="text-gray-600 hover:text-gray-900 text-sm font-medium mb-6 flex items-center gap-1"
      >
        ← My Galleries
      </button>

      {/* Header Section */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">{gallery.name}</h1>
        {gallery.description && (
          <p className="text-gray-500 mt-1">{gallery.description}</p>
        )}

        {/* Action buttons row */}
        <div className="flex flex-wrap items-center gap-3 mt-4">
          <button
            onClick={() => navigate(`/profile/galleries/${gallery.id}/edit`)}
            className="px-4 py-2 border border-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-50 text-sm"
          >
            Edit Gallery
          </button>

          {/* Status badge */}
          <span
            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
              statusBadgeColor[gallery.status as keyof typeof statusBadgeColor]
            }`}
          >
            {gallery.status.charAt(0).toUpperCase() + gallery.status.slice(1)}
          </span>

          {/* Default badge */}
          {gallery.isDefault && (
            <span className="inline-flex items-center px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
              Default
            </span>
          )}
        </div>
      </div>

      {/* Tab Bar */}
      <div className="border-b border-gray-200 mb-8">
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTab('collections')}
            className={`px-4 py-3 font-medium border-b-2 transition-colors text-sm ${
              activeTab === 'collections'
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Collections ({gallery.collections.length})
          </button>
          <button
            onClick={() => setActiveTab('roles')}
            className={`px-4 py-3 font-medium border-b-2 transition-colors text-sm ${
              activeTab === 'roles'
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Shield className="w-4 h-4 inline mr-1" />
            Roles
          </button>
        </div>
      </div>

      {/* Collections Section */}
      {activeTab === 'collections' && (
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">
            Collections ({gallery.collections.length})
          </h2>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 text-sm"
          >
            + New Collection
          </button>
        </div>

        {gallery.collections.length === 0 ? (
          <div className="text-center py-16 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-gray-600 text-lg font-medium mb-2">No collections yet</p>
            <p className="text-gray-500 mb-6">
              Create your first collection to start organizing artworks
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center px-4 py-2 bg-gray-900 text-white rounded-lg font-semibold hover:bg-gray-800 text-sm"
            >
              Create Collection
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* New Collection Card */}
            <button
              onClick={() => setShowCreateModal(true)}
              className="rounded-lg border-2 border-dashed border-gray-300 hover:border-gray-400 bg-white p-4 flex flex-col items-center justify-center min-h-40 transition-colors group hover:bg-gray-50"
            >
              <svg
                className="w-8 h-8 text-gray-400 group-hover:text-gray-500 mb-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              <span className="text-sm font-semibold text-gray-600 group-hover:text-gray-700">
                Add Collection
              </span>
            </button>

            {/* Collection Cards */}
            {gallery.collections.map((collection) => (
              <button
                key={collection.id}
                onClick={() =>
                  navigate(
                    `/profile/galleries/${gallery.id}/collections/${collection.id}`
                  )
                }
                className="rounded-lg border border-gray-200 bg-white p-4 text-left transition-all hover:shadow-md hover:border-gray-300"
              >
                <div className="mb-3 min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate">
                    {collection.name}
                  </h3>
                  {collection.description && (
                    <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                      {collection.description}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2 pt-3 border-t border-gray-100">
                  <span className="text-sm text-gray-500">
                    {collection.artworkCount} {collection.artworkCount === 1 ? 'artwork' : 'artworks'}
                  </span>
                  {collection.isDefault && (
                    <span className="inline-flex items-center bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full text-xs font-medium">
                      Default
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
      )}

      {/* Roles Tab Content */}
      {activeTab === 'roles' && (
        <div className="mb-8">
          {rolesLoading ? (
            <div className="text-center py-12">
              <div className="h-6 w-6 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin mx-auto" />
            </div>
          ) : rolesError ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-gray-600">{rolesError}</p>
              <button
                onClick={fetchRoles}
                className="mt-4 px-4 py-2 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 text-sm"
              >
                Retry
              </button>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Creator */}
              {roles.filter(r => r.role === 'creator').map((role) => (
                <div key={role.userId}>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Creator</h3>
                  <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <Avatar src={role.avatarUrl} name={role.displayName || role.username} size="md" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{role.displayName || role.username}</p>
                      <p className="text-sm text-gray-500">@{role.username}</p>
                    </div>
                    <span className="px-2 py-1 bg-gray-800 text-white text-xs font-medium rounded">Creator</span>
                  </div>
                </div>
              ))}

              {/* Admins */}
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  Admins ({roles.filter(r => r.role === 'admin').length})
                </h3>

                {roles.filter(r => r.role === 'admin').length === 0 ? (
                  <p className="text-gray-500 py-4">No admins assigned yet.</p>
                ) : (
                  <div className="space-y-2">
                    {roles.filter(r => r.role === 'admin').map((role) => (
                      <div key={role.userId} className="flex items-center gap-3 p-4 rounded-lg border border-gray-200">
                        <Avatar src={role.avatarUrl} name={role.displayName || role.username} size="md" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate">{role.displayName || role.username}</p>
                          <p className="text-sm text-gray-500">@{role.username}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            Added {new Date(role.grantedAt).toLocaleDateString()}
                          </p>
                        </div>
                        <button
                          onClick={() => handleRemoveAdmin(role.userId, role.username)}
                          className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                          title="Remove admin"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add Admin */}
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Add Admin</h3>
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={addUsername}
                      onChange={(e) => setAddUsername(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleAddAdmin() }}
                      placeholder="Enter username"
                      disabled={addingRole}
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:border-gray-900 disabled:opacity-50"
                    />
                    <button
                      onClick={handleAddAdmin}
                      disabled={addingRole || !addUsername.trim()}
                      className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    >
                      <UserPlus className="w-4 h-4" />
                      {addingRole ? 'Adding...' : 'Add'}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Enter the username of the person you want to make an admin.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create Collection Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => !creating && setShowCreateModal(false)}
          />

          {/* Modal */}
          <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Create Collection</h2>

            {/* Form Error */}
            {formError && (
              <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                <p className="text-sm text-gray-600">{formError}</p>
              </div>
            )}

            {/* Form */}
            <div className="space-y-4 mb-6">
              <div>
                <label
                  htmlFor="collection-name"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Collection Name
                </label>
                <input
                  id="collection-name"
                  type="text"
                  value={newCollectionName}
                  onChange={(e) => setNewCollectionName(e.target.value)}
                  disabled={creating}
                  placeholder="e.g., Summer Landscapes"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:border-gray-900 disabled:opacity-50"
                />
              </div>
              <div>
                <label
                  htmlFor="collection-description"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Description (Optional)
                </label>
                <textarea
                  id="collection-description"
                  value={newCollectionDescription}
                  onChange={(e) => setNewCollectionDescription(e.target.value)}
                  disabled={creating}
                  placeholder="Add a description for your collection..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:border-gray-900 disabled:opacity-50 resize-none"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => !creating && setShowCreateModal(false)}
                disabled={creating}
                className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateCollection}
                disabled={creating || !newCollectionName.trim()}
                className="flex-1 px-4 py-2 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
