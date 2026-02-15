# 47-UI-ARTWORK-UPLOAD.md

## Goal
Create a mobile-first artwork upload page at `src/pages/ArtworkUploadPage.tsx` that enables artists to upload images with drag-and-drop/file picker, preview before upload, enter metadata, show upload progress, and view the created artwork.

---

## Spec Extract

From actual stack:
- **Frontend**: React + TypeScript + Tailwind CSS (Tailwind classes only, NO CSS modules)
- **Router**: React Router (routes defined in `src/router.tsx`)
- **Auth**: `useAuth()` hook from `src/contexts/AuthContext`
- **API calls**: `fetch()` with JWT from auth context
- **Toast**: Toast notification system from earlier phases
- **Upload Limit**: 10MB per image
- **Accepted Types**: JPEG, PNG, GIF, WebP
- **Categories**: painting, sculpture, photography, digital, drawing, printmaking, mixed-media, other
- **Image preview**: Uses `URL.createObjectURL()` for local preview before upload

Upload flow:
1. User picks/drops file
2. Client calls `POST /api/artworks/upload` with multipart form data
3. Server returns `{ key, cdnUrl, contentType, size }`
4. User fills in metadata form
5. Client calls `POST /api/artworks` with `{ title, imageKey, description, category, ... }`
6. Server creates artwork record, returns artwork with image URLs

UI Requirements:
- Camera button (mobile) or drag-drop zone (desktop)
- Image preview before metadata entry
- Metadata form: title (required), description (textarea), category (dropdown), materials, dimensions, date created, tags (comma-separated)
- Progress indicator during upload/processing
- Success state with link to view created artwork

---

## Prerequisites

**Must complete before starting:**
- **Auth Context** (`src/contexts/AuthContext`) with `useAuth()` hook
- **Toast System** - Toast notification system for user feedback
- **Router Setup** (`src/router.tsx`) with route configuration

---

## Steps

### Step 1: Create ImageDropzone Component

Create a reusable drag-and-drop image input component using Tailwind CSS only.

**File:** `src/components/ImageDropzone.tsx`

```typescript
import React, { useState, useRef, useCallback } from 'react'

export interface ImageDropzoneProps {
  onImageSelected: (file: File) => void
  onError: (error: string) => void
  disabled?: boolean
}

/**
 * Image dropzone component with drag-drop and file picker
 * Supports JPEG, PNG, GIF, WebP up to 10MB
 */
export function ImageDropzone({
  onImageSelected,
  onError,
  disabled = false
}: ImageDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

  const validateFile = (file: File): boolean => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      onError('Invalid file type. Accepted: JPEG, PNG, GIF, WebP')
      return false
    }

    if (file.size > MAX_FILE_SIZE) {
      onError(
        `File too large. Maximum 10MB allowed. Your file: ${(file.size / 1024 / 1024).toFixed(1)}MB`
      )
      return false
    }

    return true
  }

  const handleFileSelect = (file: File) => {
    if (validateFile(file)) {
      onImageSelected(file)
    }
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (!disabled) {
      setIsDragging(true)
    }
  }

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    if (disabled) return

    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleFileSelect(files[0])
    }
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files
    if (files && files.length > 0) {
      handleFileSelect(files[0])
    }
  }

  return (
    <div
      className={`
        relative w-full min-h-[300px] border-2 border-dashed border-gray-300
        rounded-lg flex items-center justify-center cursor-pointer
        bg-gray-50 transition-all duration-200 p-8 text-center
        ${isDragging ? 'border-gray-900 bg-gray-100 shadow-lg' : ''}
        ${disabled ? 'cursor-not-allowed opacity-60 bg-gray-50' : 'hover:border-gray-900 hover:bg-gray-100'}
      `}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => !disabled && fileInputRef.current?.click()}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={ALLOWED_TYPES.join(',')}
        onChange={handleFileInputChange}
        disabled={disabled}
        style={{ display: 'none' }}
        aria-label="Select image file"
      />

      <div className="w-full flex flex-col items-center justify-center gap-4">
        {/* Mobile: Show camera icon */}
        <div className="hidden sm:hidden md:hidden lg:hidden xl:hidden w-12 h-12 text-gray-600">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
        </div>

        {/* Desktop: Show upload icon and text */}
        <div className="flex flex-col items-center gap-2">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="w-12 h-12 text-gray-600"
            aria-hidden="true"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>

          <p className="text-lg font-semibold text-gray-900">
            Drag & drop your artwork here
          </p>
          <p className="text-sm text-gray-600">
            or click to select (JPEG, PNG, GIF, WebP up to 10MB)
          </p>
        </div>
      </div>
    </div>
  )
}
```

### Step 2: Create ArtworkForm Component

Create metadata input form component using Tailwind CSS only.

**File:** `src/components/ArtworkForm.tsx`

```typescript
import React, { useState } from 'react'

export interface ArtworkFormData {
  title: string
  description?: string
  category: string
  materials?: string
  dimensions?: string
  dateCreated?: string
  tags: string[]
}

export interface ArtworkFormProps {
  onSubmit: (data: ArtworkFormData) => void
  isLoading?: boolean
  disabled?: boolean
}

const CATEGORIES = [
  { value: 'painting', label: 'Painting' },
  { value: 'sculpture', label: 'Sculpture' },
  { value: 'photography', label: 'Photography' },
  { value: 'digital', label: 'Digital' },
  { value: 'drawing', label: 'Drawing' },
  { value: 'printmaking', label: 'Printmaking' },
  { value: 'mixed-media', label: 'Mixed Media' },
  { value: 'other', label: 'Other' }
]

/**
 * Artwork metadata form component
 */
export function ArtworkForm({
  onSubmit,
  isLoading = false,
  disabled = false
}: ArtworkFormProps) {
  const [formData, setFormData] = useState<ArtworkFormData>({
    title: '',
    description: '',
    category: 'painting',
    materials: '',
    dimensions: '',
    dateCreated: new Date().toISOString().split('T')[0].substring(0, 7), // YYYY-MM
    tags: []
  })

  const [tagInput, setTagInput] = useState('')
  const [errors, setErrors] = useState<Partial<ArtworkFormData>>({})

  const validateForm = (): boolean => {
    const newErrors: Partial<ArtworkFormData> = {}

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required'
    }

    if (formData.title.length > 500) {
      newErrors.title = 'Title must be 500 characters or less'
    }

    if (formData.description && formData.description.length > 5000) {
      newErrors.description = 'Description must be 5000 characters or less'
    }

    if (formData.tags.length > 20) {
      newErrors.tags = 'Maximum 20 tags allowed' as any
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.currentTarget
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
    // Clear error when user starts typing
    if (errors[name as keyof ArtworkFormData]) {
      setErrors(prev => ({
        ...prev,
        [name]: undefined
      }))
    }
  }

  const handleAddTag = () => {
    const tag = tagInput.trim().toLowerCase()

    if (!tag) return
    if (tag.length > 50) {
      setErrors(prev => ({
        ...prev,
        tags: 'Each tag must be 50 characters or less' as any
      }))
      return
    }
    if (formData.tags.includes(tag)) return
    if (formData.tags.length >= 20) return

    setFormData(prev => ({
      ...prev,
      tags: [...prev.tags, tag]
    }))
    setTagInput('')
  }

  const handleRemoveTag = (tag: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(t => t !== tag)
    }))
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddTag()
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (validateForm()) {
      onSubmit(formData)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-8 w-full max-w-2xl mx-auto">
      {/* Title Field */}
      <div className="flex flex-col gap-2">
        <label htmlFor="title" className="font-semibold text-gray-900">
          Title <span className="text-red-600">*</span>
        </label>
        <input
          id="title"
          type="text"
          name="title"
          value={formData.title}
          onChange={handleChange}
          disabled={disabled || isLoading}
          placeholder="Enter artwork title"
          maxLength={500}
          className="px-3 py-2 border border-gray-300 rounded-lg font-inherit text-base text-gray-900 bg-white transition-colors focus:outline-none focus:border-gray-900 focus:ring-2 focus:ring-gray-100 disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-gray-50"
          aria-invalid={!!errors.title}
          aria-describedby={errors.title ? 'title-error' : undefined}
        />
        <div className="text-right text-xs text-gray-600">
          {formData.title.length}/500
        </div>
        {errors.title && (
          <div id="title-error" className="text-sm text-red-600 mt-1">
            {errors.title}
          </div>
        )}
      </div>

      {/* Description Field */}
      <div className="flex flex-col gap-2">
        <label htmlFor="description" className="font-semibold text-gray-900">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          value={formData.description}
          onChange={handleChange}
          disabled={disabled || isLoading}
          placeholder="Describe your artwork (optional)"
          maxLength={5000}
          rows={4}
          className="px-3 py-2 border border-gray-300 rounded-lg font-inherit text-base text-gray-900 bg-white transition-colors focus:outline-none focus:border-gray-900 focus:ring-2 focus:ring-gray-100 disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-gray-50 resize-vertical"
          aria-describedby={errors.description ? 'description-error' : undefined}
        />
        <div className="text-right text-xs text-gray-600">
          {formData.description?.length || 0}/5000
        </div>
        {errors.description && (
          <div id="description-error" className="text-sm text-red-600 mt-1">
            {errors.description}
          </div>
        )}
      </div>

      {/* Category Dropdown */}
      <div className="flex flex-col gap-2">
        <label htmlFor="category" className="font-semibold text-gray-900">
          Category
        </label>
        <select
          id="category"
          name="category"
          value={formData.category}
          onChange={handleChange}
          disabled={disabled || isLoading}
          className="px-3 py-2 border border-gray-300 rounded-lg font-inherit text-base text-gray-900 bg-white transition-colors focus:outline-none focus:border-gray-900 focus:ring-2 focus:ring-gray-100 disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-gray-50"
        >
          {CATEGORIES.map(cat => (
            <option key={cat.value} value={cat.value}>
              {cat.label}
            </option>
          ))}
        </select>
      </div>

      {/* Materials Field */}
      <div className="flex flex-col gap-2">
        <label htmlFor="materials" className="font-semibold text-gray-900">
          Materials/Tools
        </label>
        <input
          id="materials"
          type="text"
          name="materials"
          value={formData.materials}
          onChange={handleChange}
          disabled={disabled || isLoading}
          placeholder="e.g., Digital, Procreate, Oil on canvas"
          maxLength={500}
          className="px-3 py-2 border border-gray-300 rounded-lg font-inherit text-base text-gray-900 bg-white transition-colors focus:outline-none focus:border-gray-900 focus:ring-2 focus:ring-gray-100 disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-gray-50"
        />
      </div>

      {/* Dimensions Field */}
      <div className="flex flex-col gap-2">
        <label htmlFor="dimensions" className="font-semibold text-gray-900">
          Dimensions
        </label>
        <input
          id="dimensions"
          type="text"
          name="dimensions"
          value={formData.dimensions}
          onChange={handleChange}
          disabled={disabled || isLoading}
          placeholder="e.g., 3000x4000px or 100x150cm"
          maxLength={200}
          className="px-3 py-2 border border-gray-300 rounded-lg font-inherit text-base text-gray-900 bg-white transition-colors focus:outline-none focus:border-gray-900 focus:ring-2 focus:ring-gray-100 disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-gray-50"
        />
      </div>

      {/* Created Date Field */}
      <div className="flex flex-col gap-2">
        <label htmlFor="dateCreated" className="font-semibold text-gray-900">
          Date Created
        </label>
        <input
          id="dateCreated"
          type="month"
          name="dateCreated"
          value={formData.dateCreated}
          onChange={handleChange}
          disabled={disabled || isLoading}
          className="px-3 py-2 border border-gray-300 rounded-lg font-inherit text-base text-gray-900 bg-white transition-colors focus:outline-none focus:border-gray-900 focus:ring-2 focus:ring-gray-100 disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-gray-50"
        />
      </div>

      {/* Tags Field */}
      <div className="flex flex-col gap-2">
        <label htmlFor="tagInput" className="font-semibold text-gray-900">
          Tags
        </label>
        <div className="flex gap-2">
          <input
            id="tagInput"
            type="text"
            value={tagInput}
            onChange={e => setTagInput(e.currentTarget.value)}
            onKeyPress={handleKeyPress}
            disabled={disabled || isLoading || formData.tags.length >= 20}
            placeholder="Add tags (press Enter)"
            maxLength={50}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg font-inherit text-base text-gray-900 bg-white transition-colors focus:outline-none focus:border-gray-900 focus:ring-2 focus:ring-gray-100 disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-gray-50"
          />
          <button
            type="button"
            onClick={handleAddTag}
            disabled={disabled || isLoading || !tagInput.trim() || formData.tags.length >= 20}
            className="px-4 py-2 bg-gray-900 text-white border-none rounded-lg font-semibold cursor-pointer transition-colors hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Add
          </button>
        </div>
        <div className="flex flex-wrap gap-2 mt-2">
          {formData.tags.map(tag => (
            <span
              key={tag}
              className="inline-flex items-center gap-2 px-3 py-1 bg-gray-100 border border-gray-300 rounded-full text-sm text-gray-900"
            >
              {tag}
              <button
                type="button"
                onClick={() => handleRemoveTag(tag)}
                disabled={disabled || isLoading}
                className="bg-none border-none text-gray-600 cursor-pointer px-0 py-0 text-lg leading-none transition-colors hover:text-red-600 disabled:text-gray-400"
                aria-label={`Remove tag ${tag}`}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
        {formData.tags.length >= 20 && (
          <div className="text-sm text-gray-600 mt-1">
            Maximum 20 tags reached
          </div>
        )}
        {errors.tags && (
          <div className="text-sm text-red-600 mt-1">
            {errors.tags}
          </div>
        )}
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={disabled || isLoading}
        className="px-6 py-3 bg-gray-900 text-white border-none rounded-lg font-semibold text-base cursor-pointer transition-colors hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed mt-4"
      >
        {isLoading ? 'Creating artwork...' : 'Create Artwork'}
      </button>
    </form>
  )
}
```

### Step 3: Create Main Upload Page Component

Create the main artwork upload page that orchestrates everything.

**File:** `src/pages/ArtworkUploadPage.tsx`

```typescript
import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { ImageDropzone } from '../components/ImageDropzone'
import { ArtworkForm, type ArtworkFormData } from '../components/ArtworkForm'

interface UploadState {
  file: File | null
  preview: string | null
  step: 'upload' | 'form' | 'processing' | 'success'
  uploadProgress: number
  error: string | null
  artwork: any | null
}

/**
 * Artwork upload page component
 * Flow: Image upload -> Metadata form -> Processing -> Success
 */
export function ArtworkUploadPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { addToast } = useToast()

  const [state, setState] = useState<UploadState>({
    file: null,
    preview: null,
    step: 'upload',
    uploadProgress: 0,
    error: null,
    artwork: null
  })

  const handleImageSelected = (file: File) => {
    const preview = URL.createObjectURL(file)
    setState(prev => ({
      ...prev,
      file,
      preview,
      step: 'form',
      error: null
    }))
  }

  const handleFormError = (error: string) => {
    setState(prev => ({ ...prev, error }))
  }

  const handleFormSubmit = async (formData: ArtworkFormData) => {
    if (!state.file || !user?.id) {
      setState(prev => ({ ...prev, error: 'Missing file or user' }))
      return
    }

    setState(prev => ({
      ...prev,
      step: 'processing',
      uploadProgress: 0,
      error: null
    }))

    try {
      // Step 1: Upload image file
      setState(prev => ({ ...prev, uploadProgress: 25 }))

      const formDataUpload = new FormData()
      formDataUpload.append('file', state.file)

      const uploadResponse = await fetch('/api/artworks/upload', {
        method: 'POST',
        body: formDataUpload
      })

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload image')
      }

      const { key, cdnUrl, contentType, size } = await uploadResponse.json()

      // Step 2: Create artwork with metadata
      setState(prev => ({ ...prev, uploadProgress: 75 }))

      const artworkResponse = await fetch('/api/artworks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description || null,
          category: formData.category,
          materials: formData.materials || null,
          dimensions: formData.dimensions || null,
          dateCreated: formData.dateCreated || null,
          tags: formData.tags,
          imageKey: key
        })
      })

      if (!artworkResponse.ok) {
        const error = await artworkResponse.json()
        throw new Error(error.error || 'Failed to create artwork')
      }

      const artwork = await artworkResponse.json()

      setState(prev => ({
        ...prev,
        uploadProgress: 100,
        step: 'success',
        artwork
      }))

      addToast({
        type: 'success',
        title: 'Artwork created!',
        message: `"${artwork.title}" has been uploaded successfully.`
      })
    } catch (error) {
      console.error('Upload error:', error)
      setState(prev => ({
        ...prev,
        step: 'upload',
        error: error instanceof Error ? error.message : 'Upload failed'
      }))

      addToast({
        type: 'error',
        title: 'Upload failed',
        message: error instanceof Error ? error.message : 'Something went wrong'
      })
    }
  }

  const handleViewArtwork = () => {
    if (state.artwork) {
      navigate(`/artworks/${state.artwork.id}`)
    }
  }

  const handleCreateAnother = () => {
    // Clean up the preview URL
    if (state.preview) {
      URL.revokeObjectURL(state.preview)
    }

    setState({
      file: null,
      preview: null,
      step: 'upload',
      uploadProgress: 0,
      error: null,
      artwork: null
    })
  }

  return (
    <div className="min-h-screen bg-white px-4 py-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <header className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-900 mb-2">Upload Artwork</h1>
          <p className="text-xl text-gray-600">
            Share your creative work with the world
          </p>
        </header>

        {/* Upload Step */}
        {state.step === 'upload' && (
          <section className="mb-8">
            <ImageDropzone
              onImageSelected={handleImageSelected}
              onError={handleFormError}
              disabled={false}
            />
            {state.error && (
              <div className="mt-4 px-4 py-3 bg-red-50 border border-red-300 text-red-900 rounded-lg text-base">
                {state.error}
              </div>
            )}
          </section>
        )}

        {/* Form Step */}
        {state.step === 'form' && state.preview && (
          <section className="mb-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
              {/* Preview */}
              <div className="sticky top-8">
                <img
                  src={state.preview}
                  alt="Preview"
                  className="w-full max-h-96 object-contain rounded-lg bg-gray-100"
                />
              </div>

              {/* Form */}
              <div>
                <ArtworkForm
                  onSubmit={handleFormSubmit}
                  isLoading={false}
                  disabled={false}
                />

                <button
                  onClick={() => {
                    setState(prev => ({ ...prev, step: 'upload' }))
                  }}
                  className="mt-6 px-4 py-2 bg-white border border-gray-300 text-gray-900 rounded-lg font-semibold cursor-pointer transition-colors hover:bg-gray-100 text-base"
                >
                  ← Back to upload
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Processing Step */}
        {state.step === 'processing' && (
          <section className="mb-8">
            <div className="text-center py-16">
              {/* Spinner */}
              <div className="w-12 h-12 border-4 border-gray-300 border-t-gray-900 rounded-full animate-spin mx-auto mb-8" />

              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Processing Your Artwork
              </h2>
              <p className="text-gray-600 mb-8">
                Uploading image and creating your artwork...
              </p>

              {/* Progress Bar */}
              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mb-4">
                <div
                  className="h-full bg-gray-900 transition-all duration-300"
                  style={{ width: `${state.uploadProgress}%` }}
                />
              </div>

              <p className="font-semibold text-gray-900">
                {state.uploadProgress}%
              </p>
            </div>
          </section>
        )}

        {/* Success Step */}
        {state.step === 'success' && state.artwork && (
          <section className="mb-8">
            <div className="text-center py-12">
              {/* Success Icon */}
              <div className="text-6xl text-green-600 mb-4">✓</div>

              <h2 className="text-3xl font-bold text-gray-900 mb-2">
                Artwork Created Successfully!
              </h2>
              <p className="text-gray-600 mb-8">
                Your artwork "{state.artwork.title}" is now live.
              </p>

              {/* Success Image */}
              <img
                src={state.artwork.displayUrl || state.artwork.cdnUrl}
                alt={state.artwork.title}
                className="w-full max-w-96 max-h-96 object-contain rounded-lg bg-gray-100 mx-auto mb-8"
              />

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={handleViewArtwork}
                  className="px-6 py-3 bg-gray-900 text-white border-none rounded-lg font-semibold cursor-pointer transition-colors hover:bg-gray-800 text-base"
                >
                  View Artwork
                </button>
                <button
                  onClick={handleCreateAnother}
                  className="px-6 py-3 bg-gray-100 text-gray-900 border border-gray-300 rounded-lg font-semibold cursor-pointer transition-colors hover:bg-gray-200 text-base"
                >
                  Upload Another
                </button>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

export default ArtworkUploadPage
```

### Step 4: Add Route to Router

Update the router configuration to include the new upload page.

**File:** `src/router.tsx`

Add this route to your router configuration:

```typescript
import ArtworkUploadPage from './pages/ArtworkUploadPage'
import { ProtectedRoute } from './components/ProtectedRoute'

// In your route definitions:
{
  path: '/artworks/upload',
  element: (
    <ProtectedRoute>
      <ArtworkUploadPage />
    </ProtectedRoute>
  )
}
```

---

## Files to Create/Modify

| Path | Type | Purpose |
|------|------|---------|
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/ImageDropzone.tsx` | Create | Drag-drop image input component |
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/ArtworkForm.tsx` | Create | Metadata form component |
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/pages/ArtworkUploadPage.tsx` | Create | Main upload page |
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/router.tsx` | Modify | Add upload route |

---

## Verification

### Test 1: Image Upload
1. Navigate to `/artworks/upload`
2. Click dropzone or drag image
3. Select valid image (JPEG, PNG, GIF, WebP under 10MB)
4. Verify preview displays correctly

### Test 2: Form Validation
1. Try to submit with empty title
2. Verify error message displays
3. Fill in title and submit
4. Verify form processes correctly

### Test 3: Full Upload Flow
1. Upload image
2. Fill metadata (try all fields)
3. Submit form
4. Monitor processing indicator (should show 0% → 25% → 75% → 100%)
5. Verify success page displays with artwork thumbnail
6. Click "View Artwork" and verify navigation works
7. Click "Upload Another" and verify form resets

### Test 4: File Validation
1. Try uploading file larger than 10MB
2. Verify error message appears
3. Try uploading non-image file (e.g., .txt)
4. Verify error message appears
5. Try uploading unsupported image format
6. Verify error message appears

### Test 5: Mobile Experience
1. Test on mobile device or responsive mode
2. Verify camera icon displays (use mobile viewport)
3. Test file picker works on mobile
4. Verify layout is responsive (single column on mobile)
5. Verify buttons are touch-friendly

### Test 6: Tag Management
1. Add tags with Enter key
2. Add tags with Add button
3. Remove tags with X button
4. Try adding more than 20 tags (should be blocked)
5. Try adding tags longer than 50 characters (should show error)

---

## Notes

- **Tailwind CSS Only**: All styles use Tailwind classes, no CSS modules or styled-components
- **Mobile-first**: Single column on mobile, two-column preview + form on desktop
- **File Validation**: Checks file size (10MB max) and type before upload
- **Progress Tracking**: Shows upload progress (25% upload, 75% create, 100% done)
- **Image Preview**: Uses `URL.createObjectURL()` for instant local preview
- **Resource Cleanup**: Revokes object URL when creating another artwork
- **Accessibility**: Proper labels, error associations, ARIA attributes
- **Error Handling**: User-friendly error messages at each step
- **Toast Integration**: Shows success/error notifications
- **Auth Integration**: Uses `useAuth()` hook for user context
- **Categories**: Updated to actual spec (painting, sculpture, photography, digital, drawing, printmaking, mixed-media, other)
- **File Limit**: 10MB maximum file size

