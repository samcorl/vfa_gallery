import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useToast } from '../contexts/ToastContext'
import { ConfirmDialog } from '../components/ConfirmDialog'
import GalleryForm from '../components/gallery/GalleryForm'
import type { GalleryFormData } from '../components/gallery/GalleryForm'
import type { GalleryDetail, GalleryDeleteInfo } from '../types/gallery'

export default function GalleryEditPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useToast()

  const [gallery, setGallery] = useState<GalleryDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteInfo, setDeleteInfo] = useState<GalleryDeleteInfo | null>(null)

  // Fetch gallery data
  useEffect(() => {
    if (!id) return
    const fetchGallery = async () => {
      try {
        const res = await fetch(`/api/galleries/${id}`, { credentials: 'include' })
        if (!res.ok) throw new Error(res.status === 404 ? 'Gallery not found' : 'Failed to load')
        const data: GalleryDetail = await res.json()
        setGallery(data)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load gallery'
        setError(message)
        toast.error(message)
      } finally {
        setLoading(false)
      }
    }
    fetchGallery()
  }, [id, toast])

  // Handle form submit
  const handleSubmit = async (data: GalleryFormData) => {
    if (!gallery) return

    setSaving(true)
    try {
      const res = await fetch(`/api/galleries/${gallery.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: data.name,
          description: data.description || null,
          welcomeMessage: data.welcomeMessage || null,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.error?.message || 'Failed to save')
      }

      const updated: GalleryDetail = await res.json()
      setGallery(updated)
      toast.success('Gallery updated')
    } catch (err) {
      throw err
    } finally {
      setSaving(false)
    }
  }

  // Handle status change
  const handleStatusChange = async (newStatus: 'active' | 'archived' | 'draft') => {
    if (!gallery) return

    try {
      const res = await fetch(`/api/galleries/${gallery.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.error?.message || 'Failed to update status')
      }

      const updated: GalleryDetail = await res.json()
      setGallery(updated)
      toast.success('Gallery status updated')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update status'
      toast.error(message)
    }
  }

  // Handle delete button click
  const handleDeleteClick = async () => {
    if (!gallery) return

    try {
      const res = await fetch(`/api/galleries/${gallery.id}/delete-info`, {
        credentials: 'include',
      })

      if (!res.ok) throw new Error('Failed to load delete info')

      const info: GalleryDeleteInfo = await res.json()
      setDeleteInfo(info)
      setShowDeleteConfirm(true)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load delete info'
      toast.error(message)
    }
  }

  // Handle delete confirmation
  const handleConfirmDelete = async () => {
    if (!gallery) return

    setDeleting(true)
    try {
      const res = await fetch(`/api/galleries/${gallery.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })

      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.error?.message || 'Failed to delete')
      }

      toast.success('Gallery deleted')
      navigate('/profile/galleries')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete'
      toast.error(message)
    } finally {
      setDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  const handleCancel = () => {
    navigate(gallery ? `/profile/galleries/${gallery.id}` : '/profile/galleries')
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin h-8 w-8 border-4 border-gray-200 border-t-gray-900 rounded-full" />
      </div>
    )
  }

  if (error || !gallery) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-700">{error || 'Gallery not found'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={handleCancel}
            className="text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
          >
            ← Back to {gallery.name}
          </button>
        </div>
        <h1 className="text-3xl font-bold text-gray-900">Edit Gallery</h1>
      </div>

      {/* Form */}
      <GalleryForm
        initialData={{
          name: gallery.name,
          description: gallery.description || '',
          welcomeMessage: gallery.welcomeMessage || '',
        }}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        submitLabel="Save Changes"
        isLoading={saving}
      />

      {/* Status Section */}
      <div className="mt-8 bg-white border border-gray-200 rounded-lg p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Gallery Status</h2>

        <fieldset className="space-y-3">
          {/* Active */}
          <label className="flex items-start cursor-pointer">
            <input
              type="radio"
              name="status"
              value="active"
              checked={gallery.status === 'active'}
              onChange={(e) => handleStatusChange(e.target.value as 'active' | 'archived' | 'draft')}
              className="mt-1 h-4 w-4 text-gray-900 cursor-pointer"
            />
            <div className="ml-3">
              <p className="font-medium text-gray-900">Active</p>
              <p className="text-sm text-gray-500">Gallery is visible and accessible</p>
            </div>
          </label>

          {/* Archived */}
          <label className="flex items-start cursor-pointer">
            <input
              type="radio"
              name="status"
              value="archived"
              checked={gallery.status === 'archived'}
              onChange={(e) => handleStatusChange(e.target.value as 'active' | 'archived' | 'draft')}
              className="mt-1 h-4 w-4 text-gray-900 cursor-pointer"
            />
            <div className="ml-3">
              <p className="font-medium text-gray-900">Archived</p>
              <p className="text-sm text-gray-500">Gallery is hidden but preserved</p>
            </div>
          </label>

          {/* Draft */}
          <label className="flex items-start cursor-pointer">
            <input
              type="radio"
              name="status"
              value="draft"
              checked={gallery.status === 'draft'}
              onChange={(e) => handleStatusChange(e.target.value as 'active' | 'archived' | 'draft')}
              className="mt-1 h-4 w-4 text-gray-900 cursor-pointer"
            />
            <div className="ml-3">
              <p className="font-medium text-gray-900">Draft</p>
              <p className="text-sm text-gray-500">Gallery is not yet published</p>
            </div>
          </label>
        </fieldset>
      </div>

      {/* Danger Zone */}
      <div className="mt-8 border border-red-200 bg-red-50 rounded-lg p-6">
        <h2 className="text-lg font-bold text-red-900 mb-4">Delete Gallery</h2>
        <p className="text-sm text-red-700 mb-6">
          This will permanently delete this gallery and all its collections. Artworks will be preserved in your library.
        </p>

        {gallery.isDefault ? (
          <p className="text-sm text-red-700">Cannot delete the default gallery</p>
        ) : (
          <button
            onClick={handleDeleteClick}
            className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
          >
            Delete Gallery
          </button>
        )}
      </div>

      {/* Delete Confirm Dialog */}
      {showDeleteConfirm && deleteInfo && (
        <ConfirmDialog
          title="Delete Gallery"
          message={`Are you sure you want to delete "${gallery.name}"? This will remove ${deleteInfo.collectionCount} collection(s) and unlink ${deleteInfo.artworkCount} artwork(s).`}
          confirmText="Delete Gallery"
          confirmVariant="danger"
          loading={deleting}
          onConfirm={handleConfirmDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </div>
  )
}
