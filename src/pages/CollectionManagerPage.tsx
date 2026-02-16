import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import type { CollectionDetail } from '../types/collection'

export default function CollectionManagerPage() {
  const navigate = useNavigate()
  const { gid, cid } = useParams<{ gid: string; cid: string }>()
  const { isLoading: authLoading } = useAuth()
  const { error: toastError, success: toastSuccess } = useToast()

  // Data states
  const [collection, setCollection] = useState<CollectionDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Edit mode states
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [saving, setSaving] = useState(false)

  // Add artwork modal states
  const [showAddModal, setShowAddModal] = useState(false)
  const [userArtworks, setUserArtworks] = useState<any[]>([])
  const [loadingArtworks, setLoadingArtworks] = useState(false)
  const [selectedArtworkIds, setSelectedArtworkIds] = useState<Set<string>>(
    new Set()
  )

  const fetchCollection = useCallback(async () => {
    if (!cid) return

    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/collections/${cid}`, {
        credentials: 'include',
      })

      if (!res.ok) {
        if (res.status === 404) {
          setError('Collection not found')
        } else {
          throw new Error('Failed to load collection')
        }
        return
      }

      const data: CollectionDetail = await res.json()
      setCollection(data)
      setEditName(data.name)
      setEditDescription(data.description || '')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load collection'
      setError(message)
      toastError(message)
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [cid, toastError])

  useEffect(() => {
    if (!authLoading) {
      fetchCollection()
    }
  }, [fetchCollection, authLoading])

  const handleSaveCollection = async () => {
    if (!cid || !editName.trim()) {
      toastError('Collection name is required')
      return
    }

    setSaving(true)
    try {
      const res = await fetch(`/api/collections/${cid}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
          description: editDescription.trim() || null,
        }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.message || 'Failed to update collection')
      }

      toastSuccess('Collection updated successfully')
      setEditing(false)
      fetchCollection()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update collection'
      toastError(message)
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  const handleOpenAddModal = async () => {
    setShowAddModal(true)
    setLoadingArtworks(true)

    try {
      const res = await fetch(
        '/api/artworks?page=1&pageSize=50&status=active',
        {
          credentials: 'include',
        }
      )

      if (!res.ok) {
        throw new Error('Failed to load artworks')
      }

      const data = await res.json()
      setUserArtworks(data.data || [])
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load artworks'
      toastError(message)
      console.error(err)
    } finally {
      setLoadingArtworks(false)
    }
  }

  const toggleArtworkSelection = (artworkId: string) => {
    const newSelected = new Set(selectedArtworkIds)
    if (newSelected.has(artworkId)) {
      newSelected.delete(artworkId)
    } else {
      newSelected.add(artworkId)
    }
    setSelectedArtworkIds(newSelected)
  }

  const handleAddSelected = async () => {
    if (!cid || selectedArtworkIds.size === 0) return

    const artworkIds = Array.from(selectedArtworkIds)

    try {
      // Add each selected artwork to the collection
      const results = await Promise.all(
        artworkIds.map((artworkId) =>
          fetch(`/api/collections/${cid}/artworks`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ artworkId }),
          })
        )
      )

      // Check if all requests were successful
      const allSuccessful = results.every((res) => res.ok)
      if (!allSuccessful) {
        const errorRes = results.find((res) => !res.ok)
        const errData = await errorRes?.json().catch(() => ({}))
        throw new Error(
          errData?.message || 'Failed to add some artworks to collection'
        )
      }

      toastSuccess(`Added ${artworkIds.length} artwork(s) to collection`)
      setShowAddModal(false)
      setSelectedArtworkIds(new Set())
      fetchCollection()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add artworks'
      toastError(message)
      console.error(err)
    }
  }

  const handleRemoveArtwork = async (artworkId: string) => {
    if (!cid) return

    try {
      const res = await fetch(
        `/api/collections/${cid}/artworks/${artworkId}`,
        {
          method: 'DELETE',
          credentials: 'include',
        }
      )

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData?.message || 'Failed to remove artwork')
      }

      toastSuccess('Artwork removed from collection')
      fetchCollection()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to remove artwork'
      toastError(message)
      console.error(err)
    }
  }

  const statusBadgeColor = {
    active: 'bg-gray-100 text-gray-700',
    archived: 'bg-gray-200 text-gray-500',
    draft: 'bg-gray-100 text-gray-500',
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header skeleton */}
        <div className="mb-8">
          <div className="h-6 bg-gray-100 rounded-lg w-32 mb-4 animate-pulse" />
          <div className="h-10 bg-gray-100 rounded-lg w-64 mb-2 animate-pulse" />
          <div className="h-5 bg-gray-100 rounded-lg w-96 mb-4 animate-pulse" />
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <div
                key={i}
                className="h-8 bg-gray-100 rounded-lg w-24 animate-pulse"
              />
            ))}
          </div>
        </div>

        {/* Artworks section skeleton */}
        <div className="mb-8">
          <div className="h-8 bg-gray-100 rounded-lg w-40 mb-6 animate-pulse" />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="rounded-lg bg-gray-100 aspect-square animate-pulse"
              />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <button
          onClick={() => navigate(`/profile/galleries/${gid}`)}
          className="text-gray-600 hover:text-gray-900 text-sm font-medium mb-6 flex items-center gap-1"
        >
          ← Back to Gallery
        </button>

        <div className="text-center py-16 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-gray-900 font-medium text-lg mb-4">{error}</p>
          <button
            onClick={() => fetchCollection()}
            className="inline-flex items-center px-4 py-2 bg-gray-900 text-white rounded-lg font-semibold hover:bg-gray-800 text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!collection) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <button
          onClick={() => navigate(`/profile/galleries/${gid}`)}
          className="text-gray-600 hover:text-gray-900 text-sm font-medium mb-6 flex items-center gap-1"
        >
          ← Back to Gallery
        </button>

        <div className="text-center py-16 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-gray-900 font-medium text-lg">Collection not found</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Back link */}
      <button
        onClick={() => navigate(`/profile/galleries/${gid}`)}
        className="text-gray-600 hover:text-gray-900 text-sm font-medium mb-6 flex items-center gap-1"
      >
        ← Back to Gallery
      </button>

      {/* Header Section */}
      {!editing ? (
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">{collection.name}</h1>
          {collection.description && (
            <p className="text-gray-500 mt-1">{collection.description}</p>
          )}

          {/* Action buttons row */}
          <div className="flex flex-wrap items-center gap-3 mt-4">
            <button
              onClick={() => setEditing(true)}
              className="px-4 py-2 border border-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-50 text-sm"
            >
              Edit Collection
            </button>

            {/* Status badge */}
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                statusBadgeColor[collection.status as keyof typeof statusBadgeColor]
              }`}
            >
              {collection.status.charAt(0).toUpperCase() + collection.status.slice(1)}
            </span>

            {/* Default badge */}
            {collection.isDefault && (
              <span className="inline-flex items-center px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
                Default
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className="mb-8 p-6 bg-gray-50 rounded-lg border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Edit Collection</h2>

          <div className="space-y-4 mb-6">
            <div>
              <label
                htmlFor="edit-name"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Collection Name
              </label>
              <input
                id="edit-name"
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                disabled={saving}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:border-gray-900 disabled:opacity-50"
              />
            </div>

            <div>
              <label
                htmlFor="edit-description"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Description (Optional)
              </label>
              <textarea
                id="edit-description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                disabled={saving}
                rows={3}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:border-gray-900 disabled:opacity-50 resize-none"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={() => setEditing(false)}
              disabled={saving}
              className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveCollection}
              disabled={saving || !editName.trim()}
              className="flex-1 px-4 py-2 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {/* Artworks Section */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">
            Artworks ({collection.artworks.length})
          </h2>
          <button
            onClick={handleOpenAddModal}
            className="px-4 py-2 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 text-sm"
          >
            + Add Artwork
          </button>
        </div>

        {collection.artworks.length === 0 ? (
          <div className="text-center py-16 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-gray-600 text-lg font-medium mb-2">
              No artworks in this collection
            </p>
            <p className="text-gray-500 mb-6">Add your first artwork to get started</p>
            <button
              onClick={handleOpenAddModal}
              className="inline-flex items-center px-4 py-2 bg-gray-900 text-white rounded-lg font-semibold hover:bg-gray-800 text-sm"
            >
              Add Artwork
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {collection.artworks.map((artwork) => (
              <div
                key={artwork.id}
                className="relative group rounded-lg overflow-hidden bg-gray-100"
              >
                {/* Thumbnail */}
                <img
                  src={artwork.thumbnailUrl}
                  alt={artwork.title}
                  className="w-full aspect-square object-cover"
                />

                {/* Overlay */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />

                {/* Remove button */}
                <button
                  onClick={() => handleRemoveArtwork(artwork.id)}
                  className="absolute top-2 right-2 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-100"
                  title="Remove artwork"
                >
                  <svg
                    className="w-5 h-5 text-gray-900"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>

                {/* Info below image */}
                <div className="p-2">
                  <h3 className="text-sm font-semibold text-gray-900 truncate">
                    {artwork.title}
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Position {artwork.position}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Artwork Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => !loadingArtworks && setShowAddModal(false)}
          />

          {/* Modal */}
          <div className="relative bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] flex flex-col p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">Add Artwork</h2>
              <button
                onClick={() => setShowAddModal(false)}
                disabled={loadingArtworks}
                className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Artworks grid */}
            <div className="flex-1 overflow-y-auto mb-6">
              {loadingArtworks ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div
                      key={i}
                      className="rounded-lg bg-gray-100 aspect-square animate-pulse"
                    />
                  ))}
                </div>
              ) : userArtworks.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-500">No artworks available</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {userArtworks.map((artwork) => {
                    const isAlreadyAdded = collection?.artworks.some(
                      (a) => a.id === artwork.id
                    )
                    return (
                      <button
                        key={artwork.id}
                        onClick={() =>
                          !isAlreadyAdded && toggleArtworkSelection(artwork.id)
                        }
                        disabled={isAlreadyAdded}
                        className={`relative rounded-lg overflow-hidden group ${
                          isAlreadyAdded
                            ? 'opacity-50 cursor-not-allowed'
                            : selectedArtworkIds.has(artwork.id)
                            ? 'ring-2 ring-offset-2 ring-gray-900'
                            : ''
                        }`}
                      >
                      <img
                        src={artwork.thumbnailUrl}
                        alt={artwork.title}
                        className="w-full aspect-square object-cover"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />

                      {/* Checkmark for selected */}
                      {selectedArtworkIds.has(artwork.id) && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                          <svg
                            className="w-6 h-6 text-white"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </div>
                      )}

                      {/* Title on hover */}
                      <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                        <p className="text-xs font-semibold text-white truncate">
                          {artwork.title}
                        </p>
                      </div>

                      {/* Already added badge */}
                      {isAlreadyAdded && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                          <span className="text-xs font-semibold text-white bg-gray-900 px-2 py-1 rounded">
                            Added
                          </span>
                        </div>
                      )}
                    </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 border-t border-gray-200 pt-6">
              <button
                onClick={() => setShowAddModal(false)}
                disabled={loadingArtworks}
                className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAddSelected}
                disabled={loadingArtworks || selectedArtworkIds.size === 0}
                className="flex-1 px-4 py-2 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add Selected ({selectedArtworkIds.size})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
