# 50-UI-ARTWORK-EDIT.md

## Goal

Create the artwork edit page (`/profile/artworks/:id/edit`) that allows users to modify artwork metadata, replace images, toggle visibility status, and delete artworks with confirmation dialogs.

---

## Spec Extract

From TECHNICAL-SPEC.md and UI Requirements:

- **Artwork Metadata Editing:**
  - Display current image as read-only preview
  - Reuse ArtworkForm component for editing metadata
  - Fields: title, description, materials, dimensions, createdDate, category, tags
  - All fields optional except title

- **Image Replacement Flow:**
  - "Replace Image" button opens modal/dialog
  - Modal includes upload input and preview
  - Submitting replacement uploads new image and updates display_url
  - Previous images remain in R2 storage

- **Status Management:**
  - Toggle between active/hidden status
  - Affects visibility in galleries

- **Delete Functionality:**
  - Delete button with confirmation modal
  - Confirmation shows artwork title
  - Soft delete (status = 'hidden') or hard delete (remove from database)
  - Delete removes from all collections (cascade)

- **Navigation:**
  - Save button returns to artwork detail or gallery
  - Cancel button returns without saving changes

---

## Prerequisites

**Must complete before starting:**
- **44-API-ARTWORK-UPDATE.md** - PATCH /api/artworks/:id endpoint (assumed exists)
- **47-API-ARTWORK-DELETE.md** - DELETE /api/artworks/:id endpoint (assumed exists)
- **48-UI-ARTWORK-GRID.md** - ArtworkGrid and related components
- **49-UI-MY-ARTWORKS.md** - Artwork types and hooks

---

## Steps

### Step 1: Create Artwork Edit Page Component

Create the main edit page component that orchestrates loading, editing, and deletion.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/pages/ArtworkEdit.tsx`

```typescript
import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useToast } from '../contexts/ToastContext'
import { useAuth } from '../contexts/AuthContext'
import { Artwork } from '../types/artwork'
import { ArtworkForm } from '../components/artwork/ArtworkForm'
import { ConfirmDialog } from '../components/common/ConfirmDialog'
import { ReplaceImageModal } from '../components/artwork/ReplaceImageModal'
import { LoadingSpinner } from '../components/common/LoadingSpinner'
import { ErrorBoundary } from '../components/common/ErrorBoundary'

/**
 * Artwork Edit Page Component
 * Allows authenticated users to edit artwork metadata, replace images, and delete artworks
 */
export const ArtworkEdit: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { user } = useAuth()

  // Local state
  const [artwork, setArtwork] = useState<Artwork | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showReplaceImage, setShowReplaceImage] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Fetch artwork on mount
  useEffect(() => {
    const fetchArtwork = async () => {
      if (!id || !user) return

      try {
        setLoading(true)
        setError(null)

        const response = await fetch(`/api/artworks/${id}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'include'
        })

        if (!response.ok) {
          throw new Error(
            response.status === 404
              ? 'Artwork not found'
              : 'Failed to load artwork'
          )
        }

        const data = await response.json()
        setArtwork(data.data)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load artwork'
        setError(message)
        showToast(message, 'error')
      } finally {
        setLoading(false)
      }
    }

    fetchArtwork()
  }, [id, user, showToast])

  /**
   * Handle artwork metadata updates
   * Sends PATCH request to update artwork record
   */
  const handleSaveMetadata = async (formData: Partial<Artwork>) => {
    if (!artwork) return

    try {
      setSaving(true)
      setError(null)

      const response = await fetch(`/api/artworks/${artwork.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          materials: formData.materials,
          dimensions: formData.dimensions,
          createdDate: formData.createdDate,
          category: formData.category,
          tags: formData.tags,
          status: formData.status
        })
      })

      if (!response.ok) {
        throw new Error('Failed to save artwork')
      }

      const data = await response.json()
      setArtwork(data.data)
      showToast('Artwork updated successfully', 'success')

      // Redirect to artwork detail or gallery after successful save
      setTimeout(() => {
        navigate(`/profile/artworks/${artwork.id}`)
      }, 1500)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save artwork'
      setError(message)
      showToast(message, 'error')
    } finally {
      setSaving(false)
    }
  }

  /**
   * Handle artwork deletion
   * Calls DELETE /api/artworks/:id
   */
  const handleDeleteArtwork = async () => {
    if (!artwork) return

    try {
      setDeleting(true)
      setError(null)

      const response = await fetch(`/api/artworks/${artwork.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      })

      if (!response.ok) {
        throw new Error('Failed to delete artwork')
      }

      showToast('Artwork deleted successfully', 'success')

      // Redirect to my artworks list after deletion
      setTimeout(() => {
        navigate('/profile/artworks')
      }, 1500)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete artwork'
      setError(message)
      showToast(message, 'error')
    } finally {
      setDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  /**
   * Handle image replacement
   * Updates the display_url and refreshes artwork state
   */
  const handleImageReplaced = (updatedArtwork: Artwork) => {
    setArtwork(updatedArtwork)
    setShowReplaceImage(false)
    showToast('Image replaced successfully', 'success')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
    )
  }

  if (!artwork) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-4">
          <p className="text-red-800 dark:text-red-200">{error || 'Artwork not found'}</p>
        </div>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <div className="max-w-4xl mx-auto p-6">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Edit Artwork</h1>
          <p className="text-gray-600 dark:text-gray-400">{artwork.title}</p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-4">
            <p className="text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {/* Content Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Current Image Preview */}
          <div className="lg:col-span-1">
            <div className="sticky top-6">
              <div className="bg-gray-100 dark:bg-gray-800 rounded overflow-hidden aspect-square mb-4">
                <img
                  src={artwork.thumbnail_url || artwork.display_url}
                  alt={artwork.title}
                  className="w-full h-full object-cover"
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 text-center mb-4">
                Current image (read-only preview)
              </p>

              {/* Image Actions */}
              <button
                onClick={() => setShowReplaceImage(true)}
                className="w-full mb-3 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium transition-colors"
              >
                Replace Image
              </button>

              {/* Status Toggle */}
              <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800/50 rounded border border-gray-200 dark:border-gray-700">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={artwork.status === 'active'}
                    onChange={(e) => {
                      setArtwork({
                        ...artwork,
                        status: e.target.checked ? 'active' : 'hidden'
                      })
                    }}
                    className="w-4 h-4 rounded"
                  />
                  <span className="ml-3 text-sm font-medium">
                    {artwork.status === 'active' ? 'Visible' : 'Hidden'}
                  </span>
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  {artwork.status === 'active'
                    ? 'This artwork is visible in your galleries'
                    : 'This artwork is hidden from public view'}
                </p>
              </div>

              {/* Delete Section */}
              <button
                onClick={() => setShowDeleteConfirm(true)}
                disabled={deleting}
                className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded font-medium transition-colors"
              >
                {deleting ? 'Deleting...' : 'Delete Artwork'}
              </button>
            </div>
          </div>

          {/* Edit Form */}
          <div className="lg:col-span-2">
            <ArtworkForm
              artwork={artwork}
              onSave={handleSaveMetadata}
              onCancel={() => navigate(`/profile/artworks/${artwork.id}`)}
              loading={saving}
            />
          </div>
        </div>

        {/* Replace Image Modal */}
        {showReplaceImage && (
          <ReplaceImageModal
            artworkId={artwork.id}
            artworkTitle={artwork.title}
            onSuccess={handleImageReplaced}
            onClose={() => setShowReplaceImage(false)}
          />
        )}

        {/* Delete Confirmation Dialog */}
        {showDeleteConfirm && (
          <ConfirmDialog
            title="Delete Artwork"
            message={`Are you sure you want to delete "${artwork.title}"? This cannot be undone.`}
            confirmText="Delete"
            confirmVariant="danger"
            loading={deleting}
            onConfirm={handleDeleteArtwork}
            onCancel={() => setShowDeleteConfirm(false)}
          />
        )}
      </div>
    </ErrorBoundary>
  )
}

export default ArtworkEdit
```

---

### Step 2: Create Replace Image Modal Component

Create a modal component that handles the image replacement flow.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/components/artwork/ReplaceImageModal.tsx`

```typescript
import React, { useState, useRef } from 'react'
import { useToast } from '../../contexts/ToastContext'
import { Modal } from '../common/Modal'
import { Artwork } from '../../types/artwork'
import { FileUpload } from '../common/FileUpload'

interface ReplaceImageModalProps {
  artworkId: string
  artworkTitle: string
  onSuccess: (updatedArtwork: Artwork) => void
  onClose: () => void
}

/**
 * Replace Image Modal Component
 * Handles uploading a new image to replace existing artwork image
 * Integrates with R2 upload flow and image processing pipeline
 */
export const ReplaceImageModal: React.FC<ReplaceImageModalProps> = ({
  artworkId,
  artworkTitle,
  onSuccess,
  onClose
}) => {
  const { showToast } = useToast()
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Handle file selection and create preview
   */
  const handleFileSelect = (file: File) => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file')
      return
    }

    // Validate file size (5MB limit from spec)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be smaller than 5MB')
      return
    }

    setSelectedFile(file)
    setError(null)

    // Create preview
    const reader = new FileReader()
    reader.onload = (e) => {
      setPreview(e.target?.result as string)
    }
    reader.readAsDataURL(file)
  }

  /**
   * Handle image replacement upload
   * 1. Get upload URL from /api/upload-url
   * 2. Upload to R2
   * 3. PATCH /api/artworks/:id with new originalKey
   * 4. Image processing pipeline generates new display_url/thumbnail_url
   */
  const handleUpload = async () => {
    if (!selectedFile) {
      setError('No file selected')
      return
    }

    try {
      setUploading(true)
      setError(null)

      // Step 1: Get upload URL from backend
      const uploadUrlResponse = await fetch('/api/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          filename: selectedFile.name,
          contentType: selectedFile.type
        })
      })

      if (!uploadUrlResponse.ok) {
        throw new Error('Failed to get upload URL')
      }

      const { uploadUrl, key } = await uploadUrlResponse.json()

      // Step 2: Upload file to R2
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': selectedFile.type
        },
        body: selectedFile
      })

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload image to storage')
      }

      // Step 3: Update artwork with new image key
      const updateResponse = await fetch(`/api/artworks/${artworkId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          originalKey: key
          // Backend will trigger image processing pipeline
          // and update display_url, thumbnail_url, icon_url
        })
      })

      if (!updateResponse.ok) {
        throw new Error('Failed to update artwork with new image')
      }

      const { data: updatedArtwork } = await updateResponse.json()
      onSuccess(updatedArtwork)
      showToast('Image replaced successfully', 'success')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to replace image'
      setError(message)
      showToast(message, 'error')
    } finally {
      setUploading(false)
    }
  }

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Replace Image"
      size="lg"
    >
      <div className="space-y-6">
        {/* Current Info */}
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Artwork: <span className="font-medium">{artworkTitle}</span>
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-3">
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {/* File Upload */}
        <div>
          <FileUpload
            onSelect={handleFileSelect}
            accept="image/*"
            maxSize={5 * 1024 * 1024}
            disabled={uploading}
          />
        </div>

        {/* Preview */}
        {preview && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Preview
            </label>
            <div className="bg-gray-100 dark:bg-gray-800 rounded overflow-hidden aspect-square">
              <img
                src={preview}
                alt="Preview"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        )}

        {/* Info */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded p-3">
          <p className="text-xs text-blue-800 dark:text-blue-200">
            Images are limited to 5MB. After upload, the image will be processed and optimized automatically.
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={uploading}
            className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded font-medium transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={!selectedFile || uploading}
            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded font-medium transition-colors"
          >
            {uploading ? 'Uploading...' : 'Replace Image'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
```

---

### Step 3: Create or Update ArtworkForm Component

Create a reusable form component for editing artwork metadata.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/components/artwork/ArtworkForm.tsx`

```typescript
import React, { useState, useEffect } from 'react'
import { Artwork } from '../../types/artwork'

interface ArtworkFormProps {
  artwork: Artwork
  onSave: (data: Partial<Artwork>) => void
  onCancel: () => void
  loading?: boolean
}

/**
 * Artwork Form Component
 * Reusable form for editing artwork metadata
 * Used in both artwork creation and edit flows
 */
export const ArtworkForm: React.FC<ArtworkFormProps> = ({
  artwork,
  onSave,
  onCancel,
  loading = false
}) => {
  const [formData, setFormData] = useState<Partial<Artwork>>({
    title: artwork.title,
    description: artwork.description,
    materials: artwork.materials,
    dimensions: artwork.dimensions,
    createdDate: artwork.createdDate,
    category: artwork.category,
    tags: artwork.tags,
    status: artwork.status
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  /**
   * Validate form data
   * Title is required, all other fields optional
   */
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.title?.trim()) {
      newErrors.title = 'Title is required'
    }

    if (formData.title && formData.title.length > 200) {
      newErrors.title = 'Title must be 200 characters or less'
    }

    if (formData.description && formData.description.length > 2000) {
      newErrors.description = 'Description must be 2000 characters or less'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (validateForm()) {
      onSave(formData)
    }
  }

  const handleChange = (
    field: keyof Artwork,
    value: any
  ) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Title */}
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Title <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="title"
          maxLength={200}
          value={formData.title || ''}
          onChange={(e) => handleChange('title', e.target.value)}
          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
            errors.title
              ? 'border-red-300 focus:ring-red-500'
              : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500'
          } dark:bg-gray-800 dark:text-white`}
          placeholder="Enter artwork title"
          disabled={loading}
        />
        {errors.title && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.title}</p>
        )}
      </div>

      {/* Description */}
      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Description
        </label>
        <textarea
          id="description"
          maxLength={2000}
          rows={4}
          value={formData.description || ''}
          onChange={(e) => handleChange('description', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white resize-none"
          placeholder="Describe your artwork..."
          disabled={loading}
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {(formData.description || '').length} / 2000 characters
        </p>
      </div>

      {/* Category */}
      <div>
        <label htmlFor="category" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Category
        </label>
        <select
          id="category"
          value={formData.category || ''}
          onChange={(e) => handleChange('category', e.target.value || undefined)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
          disabled={loading}
        >
          <option value="">Select a category</option>
          <option value="illustration">Illustration</option>
          <option value="manga">Manga</option>
          <option value="comic">Comic</option>
          <option value="character-design">Character Design</option>
          <option value="concept-art">Concept Art</option>
          <option value="fan-art">Fan Art</option>
          <option value="other">Other</option>
        </select>
      </div>

      {/* Materials */}
      <div>
        <label htmlFor="materials" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Materials
        </label>
        <input
          type="text"
          id="materials"
          value={formData.materials || ''}
          onChange={(e) => handleChange('materials', e.target.value || undefined)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
          placeholder="e.g., Digital, Procreate, Ink on paper"
          disabled={loading}
        />
      </div>

      {/* Dimensions */}
      <div>
        <label htmlFor="dimensions" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Dimensions
        </label>
        <input
          type="text"
          id="dimensions"
          value={formData.dimensions || ''}
          onChange={(e) => handleChange('dimensions', e.target.value || undefined)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
          placeholder="e.g., 3000x4000px or 11x14 inches"
          disabled={loading}
        />
      </div>

      {/* Created Date */}
      <div>
        <label htmlFor="createdDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Created Date
        </label>
        <input
          type="month"
          id="createdDate"
          value={formData.createdDate || ''}
          onChange={(e) => handleChange('createdDate', e.target.value || undefined)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
          disabled={loading}
        />
      </div>

      {/* Tags */}
      <div>
        <label htmlFor="tags" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Tags
        </label>
        <input
          type="text"
          id="tags"
          value={Array.isArray(formData.tags) ? formData.tags.join(', ') : ''}
          onChange={(e) => {
            const tags = e.target.value
              .split(',')
              .map(t => t.trim())
              .filter(t => t.length > 0)
            handleChange('tags', tags.length > 0 ? tags : undefined)
          }}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
          placeholder="Separate tags with commas"
          disabled={loading}
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Enter tags separated by commas (e.g., dragon, fantasy, digital art)
        </p>
      </div>

      {/* Form Actions */}
      <div className="flex gap-3 pt-6 border-t border-gray-200 dark:border-gray-700">
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded font-medium transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded font-medium transition-colors"
        >
          {loading ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </form>
  )
}
```

---

### Step 4: Create Supporting Components

Create the ConfirmDialog and Modal components if they don't exist.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/components/common/ConfirmDialog.tsx`

```typescript
import React from 'react'
import { Modal } from './Modal'

interface ConfirmDialogProps {
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  confirmVariant?: 'default' | 'danger' | 'warning'
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Confirmation Dialog Component
 * Reusable dialog for confirming destructive or important actions
 */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmVariant = 'default',
  loading = false,
  onConfirm,
  onCancel
}) => {
  const getButtonStyles = () => {
    switch (confirmVariant) {
      case 'danger':
        return 'bg-red-600 hover:bg-red-700 disabled:bg-red-400'
      case 'warning':
        return 'bg-yellow-600 hover:bg-yellow-700 disabled:bg-yellow-400'
      default:
        return 'bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400'
    }
  }

  return (
    <Modal isOpen={true} onClose={onCancel} title={title} size="sm">
      <div className="space-y-6">
        <p className="text-gray-700 dark:text-gray-300">{message}</p>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded font-medium transition-colors disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 px-4 py-2 text-white rounded font-medium transition-colors ${getButtonStyles()}`}
          >
            {loading ? 'Please wait...' : confirmText}
          </button>
        </div>
      </div>
    </Modal>
  )
}
```

---

## Files to Create/Modify

1. **Create:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/pages/ArtworkEdit.tsx`
2. **Create:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/components/artwork/ReplaceImageModal.tsx`
3. **Create or Update:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/components/artwork/ArtworkForm.tsx`
4. **Create or Update:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/components/common/ConfirmDialog.tsx`
5. **Update:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/index.tsx` - Add route `/profile/artworks/:id/edit`

---

## Route Configuration

Add to router configuration (likely in main app router file):

```typescript
{
  path: '/profile/artworks/:id/edit',
  element: <ProtectedRoute component={ArtworkEdit} />,
  errorElement: <ErrorBoundary />
}
```

---

## Verification

1. **Navigate to Edit Page:**
   - Visit `/profile/artworks/[artwork-id]/edit`
   - Page loads with artwork details and current image preview
   - Form is populated with current metadata values

2. **Edit Metadata:**
   - Change title, description, category, materials, dimensions, or tags
   - Click "Save Changes"
   - Toast shows success message
   - Page redirects to artwork detail page
   - Verify changes persisted in database

3. **Replace Image:**
   - Click "Replace Image" button
   - Modal opens with file upload
   - Select new image file
   - Preview shows selected image
   - Click "Replace Image"
   - Image processing completes
   - Page shows new image
   - Artwork still has same ID and slug

4. **Toggle Status:**
   - Click status toggle to switch between active/hidden
   - Save changes
   - Verify status changes are persisted

5. **Delete Artwork:**
   - Click "Delete Artwork" button
   - Confirmation dialog appears with artwork title
   - Click "Delete"
   - Toast shows success
   - User is redirected to /profile/artworks
   - Artwork no longer appears in list

6. **Error Handling:**
   - Try to save with empty title
   - Form shows validation error
   - Try to upload file >5MB
   - Modal shows size error
   - Try to delete without confirming
   - Deletion is cancelled
