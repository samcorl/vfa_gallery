# 47-UI-ARTWORK-UPLOAD.md

## Goal
Create a comprehensive artwork upload page at `/profile/artworks/new` that enables artists to upload images with drag-and-drop/file picker, preview before upload, enter metadata, show upload progress, and optionally add the artwork to collections after creation.

---

## Spec Extract

From TECHNICAL-SPEC.md:
- **Upload Limit**: 5MB per image
- **Accepted Types**: JPEG, PNG, GIF, WebP
- **Categories**: manga, comic, illustration, concept-art, fan-art, other
- **Mobile-first Design**: Camera button for mobile, drag-drop for desktop
- **Minimalist**: Let the art speak for itself

UI Requirements:
- Camera button (mobile) or file picker
- Drag & drop zone (desktop)
- Image preview before upload
- Metadata form: title (required), description, category (dropdown), materials, dimensions, date created, tags
- Progress indicator during upload/processing
- Success state with "Add to collection?" prompt

Response Integration:
- Uses presigned URL endpoint (Build 36)
- Calls POST /api/artworks to create artwork (Build 40)
- Optionally adds to collections

---

## Prerequisites

**Must complete before starting:**
- **36-WORKER-IMAGE-UPLOAD-URL.md** - Presigned URL generation
- **40-IMAGE-PIPELINE-ORCHESTRATION.md** - Image pipeline orchestration
- **41-API-ARTWORK-CREATE.md** - Artwork creation endpoint
- **28-REACT-TOAST-SYSTEM.md** - Toast notifications
- **26-REACT-PROTECTED-ROUTES.md** - Protected routes

---

## Steps

### Step 1: Create Image Dropzone Component

Create a reusable drag-and-drop image input component.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/artwork/ImageDropzone.tsx`

```typescript
import React, { useState, useRef, useCallback } from 'react'
import styles from './ImageDropzone.module.css'

export interface ImageDropzoneProps {
  onImageSelected: (file: File) => void
  onError: (error: string) => void
  disabled?: boolean
}

/**
 * Image dropzone component with drag-drop and file picker
 * Supports JPEG, PNG, GIF, WebP up to 5MB
 */
export function ImageDropzone({
  onImageSelected,
  onError,
  disabled = false
}: ImageDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

  const validateFile = (file: File): boolean => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      onError(
        'Invalid file type. Accepted: JPEG, PNG, GIF, WebP'
      )
      return false
    }

    if (file.size > MAX_FILE_SIZE) {
      onError(
        `File too large. Maximum 5MB allowed. Your file: ${(file.size / 1024 / 1024).toFixed(1)}MB`
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

  const handleCameraClick = () => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  return (
    <div
      className={`${styles.dropzone} ${isDragging ? styles.dragging : ''} ${
        disabled ? styles.disabled : ''
      }`}
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

      <div className={styles.content}>
        {/* Mobile: Show camera icon */}
        <div className={styles.mobileIcon}>
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
        <div className={styles.desktopContent}>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>

          <p className={styles.mainText}>
            Drag & drop your artwork here
          </p>
          <p className={styles.secondaryText}>
            or click to select (JPEG, PNG, GIF, WebP up to 5MB)
          </p>
        </div>
      </div>
    </div>
  )
}
```

### Step 2: Create CSS Module for Dropzone

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/artwork/ImageDropzone.module.css`

```css
.dropzone {
  position: relative;
  width: 100%;
  min-height: 300px;
  border: 2px dashed var(--color-border, #ccc);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  background-color: var(--color-bg-secondary, #fafafa);
  transition: all 0.2s ease;
  padding: 2rem;
  text-align: center;
}

.dropzone:hover {
  border-color: var(--color-primary, #333);
  background-color: var(--color-bg-tertiary, #f5f5f5);
}

.dropzone.dragging {
  border-color: var(--color-primary, #333);
  background-color: var(--color-primary-light, #f0f0f0);
  box-shadow: 0 0 0 3px rgba(0, 0, 0, 0.1);
}

.dropzone.disabled {
  cursor: not-allowed;
  opacity: 0.6;
  background-color: var(--color-bg-secondary, #fafafa);
}

.content {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 1rem;
}

.mobileIcon {
  display: none;
  width: 48px;
  height: 48px;
  color: var(--color-text-secondary, #666);
}

.desktopContent {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.desktopContent svg {
  width: 48px;
  height: 48px;
  color: var(--color-text-secondary, #666);
  margin-bottom: 0.5rem;
}

.mainText {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--color-text, #000);
  margin: 0;
}

.secondaryText {
  font-size: 0.875rem;
  color: var(--color-text-secondary, #666);
  margin: 0;
}

/* Mobile styles */
@media (max-width: 640px) {
  .dropzone {
    min-height: 200px;
    padding: 1rem;
  }

  .mobileIcon {
    display: block;
  }

  .desktopContent {
    display: none;
  }

  .mainText,
  .secondaryText {
    display: none;
  }
}
```

### Step 3: Create Artwork Form Component

Create metadata input form component.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/artwork/ArtworkForm.tsx`

```typescript
import React, { useState } from 'react'
import styles from './ArtworkForm.module.css'

export interface ArtworkFormData {
  title: string
  description?: string
  category: string
  materials?: string
  dimensions?: string
  createdDate?: string
  tags: string[]
}

export interface ArtworkFormProps {
  onSubmit: (data: ArtworkFormData) => void
  isLoading?: boolean
  disabled?: boolean
}

const CATEGORIES = [
  { value: 'illustration', label: 'Illustration' },
  { value: 'manga', label: 'Manga' },
  { value: 'comic', label: 'Comic' },
  { value: 'concept-art', label: 'Concept Art' },
  { value: 'fan-art', label: 'Fan Art' },
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
    category: 'illustration',
    materials: '',
    dimensions: '',
    createdDate: new Date().toISOString().split('T')[0].substring(0, 7), // YYYY-MM
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
    <form onSubmit={handleSubmit} className={styles.form}>
      {/* Title Field */}
      <div className={styles.formGroup}>
        <label htmlFor="title" className={styles.label}>
          Title <span className={styles.required}>*</span>
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
          className={styles.input}
          aria-invalid={!!errors.title}
          aria-describedby={errors.title ? 'title-error' : undefined}
        />
        <div className={styles.charCount}>
          {formData.title.length}/500
        </div>
        {errors.title && (
          <div id="title-error" className={styles.error}>
            {errors.title}
          </div>
        )}
      </div>

      {/* Description Field */}
      <div className={styles.formGroup}>
        <label htmlFor="description" className={styles.label}>
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
          className={styles.textarea}
          aria-describedby={errors.description ? 'description-error' : undefined}
        />
        <div className={styles.charCount}>
          {formData.description?.length || 0}/5000
        </div>
        {errors.description && (
          <div id="description-error" className={styles.error}>
            {errors.description}
          </div>
        )}
      </div>

      {/* Category Dropdown */}
      <div className={styles.formGroup}>
        <label htmlFor="category" className={styles.label}>
          Category
        </label>
        <select
          id="category"
          name="category"
          value={formData.category}
          onChange={handleChange}
          disabled={disabled || isLoading}
          className={styles.select}
        >
          {CATEGORIES.map(cat => (
            <option key={cat.value} value={cat.value}>
              {cat.label}
            </option>
          ))}
        </select>
      </div>

      {/* Materials Field */}
      <div className={styles.formGroup}>
        <label htmlFor="materials" className={styles.label}>
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
          className={styles.input}
        />
      </div>

      {/* Dimensions Field */}
      <div className={styles.formGroup}>
        <label htmlFor="dimensions" className={styles.label}>
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
          className={styles.input}
        />
      </div>

      {/* Created Date Field */}
      <div className={styles.formGroup}>
        <label htmlFor="createdDate" className={styles.label}>
          Date Created
        </label>
        <input
          id="createdDate"
          type="month"
          name="createdDate"
          value={formData.createdDate}
          onChange={handleChange}
          disabled={disabled || isLoading}
          className={styles.input}
        />
      </div>

      {/* Tags Field */}
      <div className={styles.formGroup}>
        <label htmlFor="tagInput" className={styles.label}>
          Tags
        </label>
        <div className={styles.tagInput}>
          <input
            id="tagInput"
            type="text"
            value={tagInput}
            onChange={e => setTagInput(e.currentTarget.value)}
            onKeyPress={handleKeyPress}
            disabled={disabled || isLoading || formData.tags.length >= 20}
            placeholder="Add tags (press Enter)"
            maxLength={50}
            className={styles.input}
          />
          <button
            type="button"
            onClick={handleAddTag}
            disabled={disabled || isLoading || !tagInput.trim() || formData.tags.length >= 20}
            className={styles.addTagBtn}
          >
            Add
          </button>
        </div>
        <div className={styles.tags}>
          {formData.tags.map(tag => (
            <span key={tag} className={styles.tag}>
              {tag}
              <button
                type="button"
                onClick={() => handleRemoveTag(tag)}
                disabled={disabled || isLoading}
                className={styles.removeTag}
                aria-label={`Remove tag ${tag}`}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
        {formData.tags.length >= 20 && (
          <div className={styles.info}>
            Maximum 20 tags reached
          </div>
        )}
        {errors.tags && (
          <div className={styles.error}>
            {errors.tags}
          </div>
        )}
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={disabled || isLoading}
        className={styles.submitBtn}
      >
        {isLoading ? 'Creating artwork...' : 'Create Artwork'}
      </button>
    </form>
  )
}
```

### Step 4: Create CSS Module for Form

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/artwork/ArtworkForm.module.css`

```css
.form {
  display: flex;
  flex-direction: column;
  gap: 2rem;
  width: 100%;
  max-width: 600px;
  margin: 0 auto;
}

.formGroup {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.label {
  font-weight: 600;
  font-size: 0.95rem;
  color: var(--color-text, #000);
}

.required {
  color: var(--color-error, #dc2626);
}

.input,
.textarea,
.select {
  padding: 0.75rem;
  border: 1px solid var(--color-border, #ccc);
  border-radius: 6px;
  font-family: inherit;
  font-size: 1rem;
  color: var(--color-text, #000);
  background-color: var(--color-bg, #fff);
  transition: border-color 0.2s ease;
}

.input:focus,
.textarea:focus,
.select:focus {
  outline: none;
  border-color: var(--color-primary, #333);
  box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.05);
}

.input:disabled,
.textarea:disabled,
.select:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  background-color: var(--color-bg-secondary, #f5f5f5);
}

.textarea {
  resize: vertical;
  min-height: 120px;
}

.charCount {
  font-size: 0.8rem;
  color: var(--color-text-secondary, #666);
  text-align: right;
}

.error {
  color: var(--color-error, #dc2626);
  font-size: 0.875rem;
  margin-top: 0.25rem;
}

.info {
  color: var(--color-text-secondary, #666);
  font-size: 0.875rem;
  margin-top: 0.25rem;
}

.tagInput {
  display: flex;
  gap: 0.5rem;
}

.tagInput .input {
  flex: 1;
}

.addTagBtn {
  padding: 0.75rem 1.5rem;
  background-color: var(--color-primary, #333);
  color: white;
  border: none;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.addTagBtn:hover:not(:disabled) {
  background-color: var(--color-primary-dark, #222);
}

.addTagBtn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.tag {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.8rem;
  background-color: var(--color-bg-secondary, #f5f5f5);
  border: 1px solid var(--color-border, #ccc);
  border-radius: 20px;
  font-size: 0.875rem;
  color: var(--color-text, #000);
}

.removeTag {
  background: none;
  border: none;
  color: var(--color-text-secondary, #666);
  cursor: pointer;
  padding: 0;
  font-size: 1.2rem;
  line-height: 1;
  transition: color 0.2s ease;
}

.removeTag:hover:not(:disabled) {
  color: var(--color-error, #dc2626);
}

.submitBtn {
  padding: 1rem;
  background-color: var(--color-primary, #333);
  color: white;
  border: none;
  border-radius: 6px;
  font-weight: 600;
  font-size: 1rem;
  cursor: pointer;
  transition: background-color 0.2s ease;
  margin-top: 1rem;
}

.submitBtn:hover:not(:disabled) {
  background-color: var(--color-primary-dark, #222);
}

.submitBtn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Mobile responsive */
@media (max-width: 640px) {
  .form {
    gap: 1.5rem;
    max-width: 100%;
  }

  .label {
    font-size: 0.9rem;
  }
}
```

### Step 5: Create Main Upload Page Component

Create the main artwork upload page that orchestrates everything.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/pages/ArtworkUpload.tsx`

```typescript
import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '$lib/context/AuthContext'
import { useToast } from '$lib/context/ToastContext'
import { ImageDropzone } from '$components/artwork/ImageDropzone'
import { ArtworkForm, type ArtworkFormData } from '$components/artwork/ArtworkForm'
import styles from './ArtworkUpload.module.css'

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
 * Flow: Image upload -> Metadata form -> Processing -> Collection assignment
 */
export function ArtworkUpload() {
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
    const reader = new FileReader()
    reader.onload = e => {
      setState(prev => ({
        ...prev,
        file,
        preview: e.target?.result as string,
        step: 'form',
        error: null
      }))
    }
    reader.onerror = () => {
      setState(prev => ({
        ...prev,
        error: 'Failed to read file'
      }))
    }
    reader.readAsDataURL(file)
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
      // Step 1: Get presigned URL
      const urlResponse = await fetch('/api/artworks/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: state.file.name,
          contentType: state.file.type
        })
      })

      if (!urlResponse.ok) {
        throw new Error('Failed to get upload URL')
      }

      const { uploadUrl, key } = await urlResponse.json()

      // Step 2: Upload to R2
      setState(prev => ({ ...prev, uploadProgress: 33 }))
      const uploadResult = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': state.file.type },
        body: state.file
      })

      if (!uploadResult.ok) {
        throw new Error('Failed to upload image')
      }

      // Step 3: Create artwork via API
      setState(prev => ({ ...prev, uploadProgress: 66 }))
      const artworkResponse = await fetch('/api/artworks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          originalKey: key
        })
      })

      if (!artworkResponse.ok) {
        const error = await artworkResponse.json()
        throw new Error(error.error || 'Failed to create artwork')
      }

      const { data: artwork } = await artworkResponse.json()

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
    <div className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <h1>Upload Artwork</h1>
          <p className={styles.subtitle}>
            Share your creative work with the world
          </p>
        </header>

        {/* Upload Step */}
        {state.step === 'upload' && (
          <section className={styles.section}>
            <ImageDropzone
              onImageSelected={handleImageSelected}
              onError={handleFormError}
              disabled={false}
            />
            {state.error && (
              <div className={styles.error}>
                {state.error}
              </div>
            )}
          </section>
        )}

        {/* Form Step */}
        {state.step === 'form' && state.preview && (
          <section className={styles.section}>
            <div className={styles.formWithPreview}>
              <div className={styles.preview}>
                <img
                  src={state.preview}
                  alt="Preview"
                  className={styles.previewImage}
                />
              </div>

              <ArtworkForm
                onSubmit={handleFormSubmit}
                isLoading={false}
                disabled={false}
              />

              <button
                onClick={() => setState(prev => ({ ...prev, step: 'upload' }))}
                className={styles.backBtn}
              >
                ← Back to upload
              </button>
            </div>
          </section>
        )}

        {/* Processing Step */}
        {state.step === 'processing' && (
          <section className={styles.section}>
            <div className={styles.processing}>
              <div className={styles.spinner} />
              <h2>Processing Your Artwork</h2>
              <p>Uploading image and generating variants...</p>
              <div className={styles.progressBar}>
                <div
                  className={styles.progress}
                  style={{ width: `${state.uploadProgress}%` }}
                />
              </div>
              <p className={styles.progressText}>
                {state.uploadProgress}%
              </p>
            </div>
          </section>
        )}

        {/* Success Step */}
        {state.step === 'success' && state.artwork && (
          <section className={styles.section}>
            <div className={styles.success}>
              <div className={styles.successIcon}>✓</div>
              <h2>Artwork Created Successfully!</h2>
              <p>
                Your artwork "{state.artwork.title}" is now live.
              </p>

              <img
                src={state.artwork.displayUrl}
                alt={state.artwork.title}
                className={styles.successImage}
              />

              <div className={styles.actions}>
                <button
                  onClick={handleViewArtwork}
                  className={styles.primaryBtn}
                >
                  View Artwork
                </button>
                <button
                  onClick={handleCreateAnother}
                  className={styles.secondaryBtn}
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

export default ArtworkUpload
```

### Step 6: Create CSS Module for Upload Page

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/pages/ArtworkUpload.module.css`

```css
.page {
  min-height: 100vh;
  background-color: var(--color-bg, #fff);
  padding: 2rem 1rem;
}

.container {
  max-width: 900px;
  margin: 0 auto;
}

.header {
  text-align: center;
  margin-bottom: 3rem;
}

.header h1 {
  font-size: 2.5rem;
  font-weight: 700;
  color: var(--color-text, #000);
  margin: 0 0 0.5rem 0;
}

.subtitle {
  font-size: 1.125rem;
  color: var(--color-text-secondary, #666);
  margin: 0;
}

.section {
  margin-bottom: 2rem;
}

.error {
  background-color: var(--color-error-light, #fee);
  border: 1px solid var(--color-error, #dc2626);
  color: var(--color-error-dark, #991b1b);
  padding: 1rem;
  border-radius: 6px;
  margin-top: 1rem;
  font-size: 0.95rem;
}

.formWithPreview {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 3rem;
  align-items: start;
}

.preview {
  position: sticky;
  top: 2rem;
}

.previewImage {
  width: 100%;
  max-height: 500px;
  object-fit: contain;
  border-radius: 8px;
  background-color: var(--color-bg-secondary, #f5f5f5);
}

.backBtn {
  margin-top: 1.5rem;
  padding: 0.75rem 1.5rem;
  background: none;
  border: 1px solid var(--color-border, #ccc);
  border-radius: 6px;
  color: var(--color-text, #000);
  cursor: pointer;
  font-size: 0.95rem;
  transition: all 0.2s ease;
}

.backBtn:hover {
  border-color: var(--color-text, #000);
  background-color: var(--color-bg-secondary, #f5f5f5);
}

.processing {
  text-align: center;
  padding: 4rem 2rem;
}

.spinner {
  width: 48px;
  height: 48px;
  border: 4px solid var(--color-border, #ccc);
  border-top-color: var(--color-primary, #333);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 2rem;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.processing h2 {
  font-size: 1.5rem;
  margin: 1rem 0 0.5rem 0;
}

.processing p {
  color: var(--color-text-secondary, #666);
  margin: 0.5rem 0;
}

.progressBar {
  width: 100%;
  height: 8px;
  background-color: var(--color-bg-secondary, #f5f5f5);
  border-radius: 4px;
  margin: 2rem 0;
  overflow: hidden;
}

.progress {
  height: 100%;
  background-color: var(--color-primary, #333);
  transition: width 0.3s ease;
}

.progressText {
  font-weight: 600;
  color: var(--color-text, #000);
}

.success {
  text-align: center;
  padding: 2rem;
}

.successIcon {
  font-size: 4rem;
  color: var(--color-success, #16a34a);
  margin-bottom: 1rem;
}

.success h2 {
  font-size: 1.75rem;
  margin: 0 0 0.5rem 0;
}

.success > p {
  color: var(--color-text-secondary, #666);
  margin-bottom: 2rem;
}

.successImage {
  width: 100%;
  max-width: 400px;
  max-height: 400px;
  object-fit: contain;
  border-radius: 8px;
  background-color: var(--color-bg-secondary, #f5f5f5);
  margin: 2rem 0;
}

.actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
  margin-top: 2rem;
}

.primaryBtn,
.secondaryBtn {
  padding: 0.75rem 2rem;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
  font-size: 1rem;
}

.primaryBtn {
  background-color: var(--color-primary, #333);
  color: white;
}

.primaryBtn:hover {
  background-color: var(--color-primary-dark, #222);
}

.secondaryBtn {
  background-color: var(--color-bg-secondary, #f5f5f5);
  color: var(--color-text, #000);
  border: 1px solid var(--color-border, #ccc);
}

.secondaryBtn:hover {
  background-color: var(--color-bg-tertiary, #efefef);
}

/* Mobile responsive */
@media (max-width: 768px) {
  .header h1 {
    font-size: 2rem;
  }

  .formWithPreview {
    grid-template-columns: 1fr;
    gap: 2rem;
  }

  .preview {
    position: static;
  }

  .processing {
    padding: 2rem 1rem;
  }

  .actions {
    flex-direction: column;
  }

  .primaryBtn,
  .secondaryBtn {
    width: 100%;
  }
}
```

### Step 7: Add Route to Router

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/App.tsx` (Update router configuration)

```typescript
import { ArtworkUpload } from '$pages/ArtworkUpload'
import { ProtectedRoute } from '$components/ProtectedRoute'

// In your routes array:
{
  path: '/profile/artworks/new',
  element: (
    <ProtectedRoute>
      <ArtworkUpload />
    </ProtectedRoute>
  )
}
```

---

## Files to Create/Modify

| Path | Type | Purpose |
|------|------|---------|
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/artwork/ImageDropzone.tsx` | Create | Drag-drop image input component |
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/artwork/ImageDropzone.module.css` | Create | Dropzone styles |
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/artwork/ArtworkForm.tsx` | Create | Metadata form component |
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/artwork/ArtworkForm.module.css` | Create | Form styles |
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/pages/ArtworkUpload.tsx` | Create | Main upload page |
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/pages/ArtworkUpload.module.css` | Create | Page styles |
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/App.tsx` | Modify | Add route |

---

## Verification

### Test 1: Image Upload
1. Navigate to `/profile/artworks/new`
2. Click dropzone or drag image
3. Select valid image (JPEG, PNG, GIF, WebP under 5MB)
4. Verify preview displays

### Test 2: Form Validation
1. Try to submit with empty title
2. Verify error message displays
3. Fill in title and submit
4. Verify form processes correctly

### Test 3: Full Upload Flow
1. Upload image
2. Fill metadata
3. Submit
4. Monitor processing indicator
5. Verify success page displays with artwork thumbnail

### Test 4: Mobile Experience
1. Test on mobile device
2. Verify camera button displays
3. Test file picker works
4. Verify layout is responsive

### Test 5: Error Handling
1. Try uploading file larger than 5MB
2. Verify error message
3. Try uploading non-image file
4. Verify error message

---

## Notes

- **Mobile-first**: Camera icon on mobile, drag-drop on desktop
- **File Validation**: Checks file size and type before upload
- **Progress Tracking**: Shows upload progress during processing
- **Responsive Design**: Adapts from desktop two-column to mobile single-column
- **Accessibility**: Proper labels, error associations, ARIA attributes
- **Error Handling**: User-friendly error messages at each step
- **Integration**: Uses presigned URLs (Build 36) and artwork API (Build 40)

