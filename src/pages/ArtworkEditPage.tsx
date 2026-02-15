import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useToast } from '../contexts/ToastContext'
import { ImageDropzone } from '../components/ImageDropzone'
import { ConfirmDialog } from '../components/ConfirmDialog'
import type { Artwork } from '../types/artwork'

const CATEGORIES = [
  { value: 'painting', label: 'Painting' },
  { value: 'sculpture', label: 'Sculpture' },
  { value: 'photography', label: 'Photography' },
  { value: 'digital', label: 'Digital' },
  { value: 'drawing', label: 'Drawing' },
  { value: 'printmaking', label: 'Printmaking' },
  { value: 'mixed-media', label: 'Mixed Media' },
  { value: 'other', label: 'Other' },
]

export default function ArtworkEditPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useToast()

  const [artwork, setArtwork] = useState<Artwork | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showReplaceImage, setShowReplaceImage] = useState(false)
  const [replacingImage, setReplacingImage] = useState(false)

  // Form state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [materials, setMaterials] = useState('')
  const [dimensions, setDimensions] = useState('')
  const [createdDate, setCreatedDate] = useState('')
  const [category, setCategory] = useState('other')
  const [tagInput, setTagInput] = useState('')
  const [tags, setTags] = useState<string[]>([])

  // Fetch artwork
  useEffect(() => {
    if (!id) return
    const fetchArtwork = async () => {
      try {
        const res = await fetch(`/api/artworks/${id}`, { credentials: 'include' })
        if (!res.ok) throw new Error(res.status === 404 ? 'Artwork not found' : 'Failed to load')
        const data: Artwork = await res.json()
        setArtwork(data)
        setTitle(data.title)
        setDescription(data.description || '')
        setMaterials(data.materials || '')
        setDimensions(data.dimensions || '')
        setCreatedDate(data.createdDate || '')
        setCategory(data.category || 'other')
        setTags(data.tags || [])
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to load artwork')
      } finally {
        setLoading(false)
      }
    }
    fetchArtwork()
  }, [id, toast])

  // Save metadata
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!artwork) return
    if (!title.trim()) { toast.error('Title is required'); return }

    setSaving(true)
    try {
      const res = await fetch(`/api/artworks/${artwork.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          materials: materials.trim() || null,
          dimensions: dimensions.trim() || null,
          createdDate: createdDate || null,
          category,
          tags,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.error?.message || 'Failed to save')
      }

      const updated: Artwork = await res.json()
      setArtwork(updated)
      toast.success('Artwork updated')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  // Delete artwork
  const handleDelete = async () => {
    if (!artwork) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/artworks/${artwork.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!res.ok) throw new Error('Failed to delete')
      toast.success('Artwork deleted')
      navigate('/profile/artworks')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete')
    } finally {
      setDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  // Replace image
  const handleReplaceImage = async (file: File) => {
    if (!artwork) return
    setReplacingImage(true)
    try {
      // Step 1: Upload new image
      const formData = new FormData()
      formData.append('file', file)
      const uploadRes = await fetch('/api/artworks/upload', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })
      if (!uploadRes.ok) throw new Error('Failed to upload image')
      const { key } = await uploadRes.json()

      // Step 2: Replace image on artwork
      const replaceRes = await fetch(`/api/artworks/${artwork.id}/replace-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          imageKey: key,
          oldImageKey: artwork.imageKey,
        }),
      })
      if (!replaceRes.ok) throw new Error('Failed to replace image')
      const updated: Artwork = await replaceRes.json()
      setArtwork(updated)
      setShowReplaceImage(false)
      toast.success('Image replaced')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to replace image')
    } finally {
      setReplacingImage(false)
    }
  }

  // Tag helpers
  const addTag = () => {
    const tag = tagInput.trim().toLowerCase()
    if (!tag || tags.includes(tag) || tags.length >= 20) return
    setTags([...tags, tag])
    setTagInput('')
  }

  const removeTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag))
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="w-10 h-10 border-4 border-gray-200 border-t-gray-900 rounded-full animate-spin mx-auto" />
      </div>
    )
  }

  if (!artwork) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <p className="text-gray-500">Artwork not found</p>
      </div>
    )
  }

  const inputClass = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-base bg-white focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 disabled:opacity-60 disabled:bg-gray-50'

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Edit Artwork</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Sidebar: Image + Actions */}
        <div className="lg:col-span-1">
          <div className="sticky top-8 space-y-4">
            {/* Current image */}
            <div className="rounded-lg overflow-hidden bg-gray-100">
              <img
                src={artwork.displayUrl || artwork.thumbnailUrl}
                alt={artwork.title}
                className="w-full aspect-square object-cover"
              />
            </div>

            {/* Replace image */}
            {!showReplaceImage ? (
              <button
                onClick={() => setShowReplaceImage(true)}
                className="w-full px-4 py-2 border border-gray-200 text-gray-700 rounded-lg font-medium text-sm hover:bg-gray-50"
              >
                Replace Image
              </button>
            ) : (
              <div className="space-y-3">
                <ImageDropzone
                  onImageSelected={handleReplaceImage}
                  onError={(msg) => toast.error(msg)}
                  disabled={replacingImage}
                />
                {replacingImage && (
                  <p className="text-sm text-gray-500 text-center">Uploading...</p>
                )}
                <button
                  onClick={() => setShowReplaceImage(false)}
                  disabled={replacingImage}
                  className="w-full text-sm text-gray-500 hover:text-gray-900 underline"
                >
                  Cancel
                </button>
              </div>
            )}

            {/* Delete */}
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full px-4 py-2 text-red-600 border border-red-200 rounded-lg font-medium text-sm hover:bg-red-50"
            >
              Delete Artwork
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSave} className="lg:col-span-2 space-y-6">
          {/* Title */}
          <div>
            <label htmlFor="title" className="block font-semibold text-gray-900 mb-1">
              Title <span className="text-red-600">*</span>
            </label>
            <input
              id="title" type="text" value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={saving} maxLength={200}
              className={inputClass}
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block font-semibold text-gray-900 mb-1">Description</label>
            <textarea
              id="description" value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={saving} maxLength={2000} rows={4}
              className={`${inputClass} resize-vertical`}
            />
          </div>

          {/* Category */}
          <div>
            <label htmlFor="category" className="block font-semibold text-gray-900 mb-1">Category</label>
            <select
              id="category" value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={saving}
              className={inputClass}
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          {/* Materials */}
          <div>
            <label htmlFor="materials" className="block font-semibold text-gray-900 mb-1">Materials/Tools</label>
            <input
              id="materials" type="text" value={materials}
              onChange={(e) => setMaterials(e.target.value)}
              disabled={saving} maxLength={500}
              placeholder="e.g., Digital, Procreate, Oil on canvas"
              className={inputClass}
            />
          </div>

          {/* Dimensions */}
          <div>
            <label htmlFor="dimensions" className="block font-semibold text-gray-900 mb-1">Dimensions</label>
            <input
              id="dimensions" type="text" value={dimensions}
              onChange={(e) => setDimensions(e.target.value)}
              disabled={saving}
              placeholder="e.g., 3000x4000px or 100x150cm"
              className={inputClass}
            />
          </div>

          {/* Created Date */}
          <div>
            <label htmlFor="createdDate" className="block font-semibold text-gray-900 mb-1">Date Created</label>
            <input
              id="createdDate" type="month" value={createdDate}
              onChange={(e) => setCreatedDate(e.target.value)}
              disabled={saving}
              className={inputClass}
            />
          </div>

          {/* Tags */}
          <div>
            <label htmlFor="tagInput" className="block font-semibold text-gray-900 mb-1">Tags</label>
            <div className="flex gap-2">
              <input
                id="tagInput" type="text" value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
                disabled={saving || tags.length >= 20}
                placeholder="Add tags (press Enter)"
                maxLength={50}
                className={`flex-1 ${inputClass}`}
              />
              <button
                type="button" onClick={addTag}
                disabled={saving || !tagInput.trim() || tags.length >= 20}
                className="px-4 py-2 bg-gray-900 text-white rounded-lg font-semibold text-sm hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {tags.map((tag) => (
                <span key={tag} className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 border border-gray-200 rounded-full text-sm">
                  {tag}
                  <button type="button" onClick={() => removeTag(tag)} disabled={saving}
                    className="text-gray-400 hover:text-red-600 text-base leading-none" aria-label={`Remove ${tag}`}>
                    &times;
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={() => navigate('/profile/artworks')}
              disabled={saving}
              className="px-5 py-2.5 border border-gray-200 text-gray-700 rounded-lg font-semibold text-sm hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 bg-gray-900 text-white rounded-lg font-semibold text-sm hover:bg-gray-800 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <ConfirmDialog
          title="Delete Artwork"
          message={`Are you sure you want to delete "${artwork.title}"? This action cannot be undone.`}
          confirmText="Delete"
          confirmVariant="danger"
          loading={deleting}
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </div>
  )
}
