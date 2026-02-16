import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import type { Gallery, PaginatedGalleries } from '../types/gallery'

// Simple relative time formatter (no date-fns needed)
function formatRelativeTime(dateString: string): string {
  const now = new Date()
  const date = new Date(dateString)
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 30) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

interface CreateGalleryForm {
  name: string
  description: string
}

export default function GalleriesPage() {
  const navigate = useNavigate()
  const { isLoading: authLoading } = useAuth()
  const toast = useToast()

  const [galleries, setGalleries] = useState<Gallery[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [total, setTotal] = useState(0)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [formData, setFormData] = useState<CreateGalleryForm>({
    name: '',
    description: '',
  })
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const fetchGalleries = useCallback(async (pageNum: number) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        page: String(pageNum),
        pageSize: '20',
        status: 'active',
      })

      const res = await fetch(`/api/galleries?${params}`, {
        credentials: 'include',
      })

      if (!res.ok) throw new Error('Failed to load galleries')

      const data: PaginatedGalleries = await res.json()
      setGalleries(data.data)
      setTotalPages(data.pagination.totalPages)
      setTotal(data.pagination.total)
      setPage(data.pagination.page)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load galleries'
      setError(message)
      toast.error(message)
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    if (!authLoading) {
      fetchGalleries(1)
    }
  }, [fetchGalleries, authLoading])

  const handleCreateGallery = async () => {
    setFormError(null)

    if (!formData.name.trim()) {
      setFormError('Gallery name is required')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/galleries', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          description: formData.description.trim() || undefined,
        }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.message || 'Failed to create gallery')
      }

      toast.success('Gallery created successfully')
      setShowCreateModal(false)
      setFormData({ name: '', description: '' })
      fetchGalleries(1)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create gallery'
      setFormError(message)
      toast.error(message)
      console.error(err)
    } finally {
      setSubmitting(false)
    }
  }

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      fetchGalleries(newPage)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const totalCollections = galleries.reduce((sum, g) => sum + g.collectionCount, 0)

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Galleries</h1>
          <p className="text-gray-500 mt-1">
            {total} {total === 1 ? 'gallery' : 'galleries'} · {totalCollections} total{' '}
            {totalCollections === 1 ? 'collection' : 'collections'}
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center px-5 py-2.5 bg-gray-900 text-white rounded-lg font-semibold hover:bg-gray-800 text-sm"
        >
          + New Gallery
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-gray-900 font-medium">Error loading galleries</p>
              <p className="text-gray-600 text-sm">{error}</p>
            </div>
            <button
              onClick={() => fetchGalleries(1)}
              className="text-gray-600 hover:text-gray-900 text-sm font-medium whitespace-nowrap ml-4"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Gallery Grid */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="aspect-square bg-gray-100 rounded-lg animate-pulse"
            />
          ))}
        </div>
      ) : galleries.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-gray-600 text-lg font-medium mb-2">No galleries yet</p>
          <p className="text-gray-500 mb-6">Create your first gallery to get started</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center px-4 py-2 bg-gray-900 text-white rounded-lg font-semibold hover:bg-gray-800 text-sm"
          >
            Create Gallery
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {/* New Gallery card */}
          <button
            onClick={() => setShowCreateModal(true)}
            className="aspect-square rounded-lg border-2 border-dashed border-gray-300 hover:border-gray-400 flex flex-col items-center justify-center bg-gray-50 hover:bg-gray-100 transition-colors group"
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
              Create Gallery
            </span>
          </button>

          {/* Gallery cards */}
          {galleries.map((gallery) => (
            <button
              key={gallery.id}
              onClick={() => navigate(`/profile/galleries/${gallery.id}`)}
              className="aspect-square rounded-lg border border-gray-200 hover:border-gray-300 bg-white p-4 text-left transition-all hover:shadow-md flex flex-col justify-between"
            >
              <div className="min-w-0">
                <h3 className="font-semibold text-gray-900 truncate">{gallery.name}</h3>
                <p className="text-sm text-gray-500 mt-1">
                  {gallery.collectionCount} {gallery.collectionCount === 1 ? 'collection' : 'collections'}
                </p>
              </div>
              <div className="flex items-end justify-between gap-2 mt-auto pt-3 border-t border-gray-100">
                <span className="text-xs text-gray-400">
                  {formatRelativeTime(gallery.updatedAt)}
                </span>
                {gallery.isDefault && (
                  <span className="inline-flex items-center bg-gray-900 text-white px-2 py-0.5 rounded-full text-xs font-medium">
                    Default
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-10">
          <button
            onClick={() => handlePageChange(page - 1)}
            disabled={page <= 1}
            className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Previous
          </button>

          {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
            const p = Math.max(1, Math.min(page - 2, totalPages - 4)) + i
            if (p > totalPages) return null
            return (
              <button
                key={p}
                onClick={() => handlePageChange(p)}
                className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors ${
                  p === page
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                {p}
              </button>
            )
          })}

          <button
            onClick={() => handlePageChange(page + 1)}
            disabled={page >= totalPages}
            className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}

      {/* Create Gallery Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => !submitting && setShowCreateModal(false)}
          />

          {/* Modal */}
          <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Create Gallery</h2>

            {/* Form Error */}
            {formError && (
              <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                <p className="text-sm text-gray-600">{formError}</p>
              </div>
            )}

            {/* Form */}
            <div className="space-y-4 mb-6">
              <div>
                <label htmlFor="gallery-name" className="block text-sm font-medium text-gray-700 mb-1">
                  Gallery Name
                </label>
                <input
                  id="gallery-name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  disabled={submitting}
                  placeholder="e.g., Spring Collection"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:border-gray-900 disabled:opacity-50"
                />
              </div>
              <div>
                <label htmlFor="gallery-description" className="block text-sm font-medium text-gray-700 mb-1">
                  Description (Optional)
                </label>
                <textarea
                  id="gallery-description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  disabled={submitting}
                  placeholder="Add a description for your gallery..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:border-gray-900 disabled:opacity-50 resize-none"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => !submitting && setShowCreateModal(false)}
                disabled={submitting}
                className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateGallery}
                disabled={submitting || !formData.name.trim()}
                className="flex-1 px-4 py-2 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
