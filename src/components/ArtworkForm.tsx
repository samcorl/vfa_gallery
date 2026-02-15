import { useState } from 'react'

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
  { value: 'other', label: 'Other' },
]

export function ArtworkForm({
  onSubmit,
  isLoading = false,
  disabled = false,
}: ArtworkFormProps) {
  const [formData, setFormData] = useState<ArtworkFormData>({
    title: '',
    description: '',
    category: 'painting',
    materials: '',
    dimensions: '',
    dateCreated: new Date().toISOString().slice(0, 7),
    tags: [],
  })
  const [tagInput, setTagInput] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}
    if (!formData.title.trim()) {
      newErrors.title = 'Title is required'
    } else if (formData.title.length > 200) {
      newErrors.title = 'Title must be 200 characters or less'
    }
    if (formData.description && formData.description.length > 2000) {
      newErrors.description = 'Description must be 2000 characters or less'
    }
    if (formData.tags.length > 20) {
      newErrors.tags = 'Maximum 20 tags allowed'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.currentTarget
    setFormData((prev) => ({ ...prev, [name]: value }))
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }))
    }
  }

  const handleAddTag = () => {
    const tag = tagInput.trim().toLowerCase()
    if (!tag || tag.length > 50 || formData.tags.includes(tag) || formData.tags.length >= 20) return
    setFormData((prev) => ({ ...prev, tags: [...prev.tags, tag] }))
    setTagInput('')
  }

  const handleRemoveTag = (tag: string) => {
    setFormData((prev) => ({ ...prev, tags: prev.tags.filter((t) => t !== tag) }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (validateForm()) onSubmit(formData)
  }

  const isDisabled = disabled || isLoading

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 w-full max-w-2xl mx-auto">
      {/* Title */}
      <div className="flex flex-col gap-1">
        <label htmlFor="title" className="font-semibold text-gray-900">
          Title <span className="text-red-600">*</span>
        </label>
        <input
          id="title"
          name="title"
          type="text"
          value={formData.title}
          onChange={handleChange}
          disabled={isDisabled}
          placeholder="Enter artwork title"
          maxLength={200}
          className="px-3 py-2 border border-gray-300 rounded-lg text-base bg-white focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 disabled:opacity-60 disabled:bg-gray-50"
        />
        {errors.title && <p className="text-sm text-red-600">{errors.title}</p>}
      </div>

      {/* Description */}
      <div className="flex flex-col gap-1">
        <label htmlFor="description" className="font-semibold text-gray-900">Description</label>
        <textarea
          id="description"
          name="description"
          value={formData.description}
          onChange={handleChange}
          disabled={isDisabled}
          placeholder="Describe your artwork (optional)"
          maxLength={2000}
          rows={4}
          className="px-3 py-2 border border-gray-300 rounded-lg text-base bg-white focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 disabled:opacity-60 disabled:bg-gray-50 resize-vertical"
        />
        {errors.description && <p className="text-sm text-red-600">{errors.description}</p>}
      </div>

      {/* Category */}
      <div className="flex flex-col gap-1">
        <label htmlFor="category" className="font-semibold text-gray-900">Category</label>
        <select
          id="category"
          name="category"
          value={formData.category}
          onChange={handleChange}
          disabled={isDisabled}
          className="px-3 py-2 border border-gray-300 rounded-lg text-base bg-white focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 disabled:opacity-60 disabled:bg-gray-50"
        >
          {CATEGORIES.map((cat) => (
            <option key={cat.value} value={cat.value}>{cat.label}</option>
          ))}
        </select>
      </div>

      {/* Materials */}
      <div className="flex flex-col gap-1">
        <label htmlFor="materials" className="font-semibold text-gray-900">Materials/Tools</label>
        <input
          id="materials"
          name="materials"
          type="text"
          value={formData.materials}
          onChange={handleChange}
          disabled={isDisabled}
          placeholder="e.g., Digital, Procreate, Oil on canvas"
          maxLength={500}
          className="px-3 py-2 border border-gray-300 rounded-lg text-base bg-white focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 disabled:opacity-60 disabled:bg-gray-50"
        />
      </div>

      {/* Dimensions */}
      <div className="flex flex-col gap-1">
        <label htmlFor="dimensions" className="font-semibold text-gray-900">Dimensions</label>
        <input
          id="dimensions"
          name="dimensions"
          type="text"
          value={formData.dimensions}
          onChange={handleChange}
          disabled={isDisabled}
          placeholder="e.g., 3000x4000px or 100x150cm"
          maxLength={200}
          className="px-3 py-2 border border-gray-300 rounded-lg text-base bg-white focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 disabled:opacity-60 disabled:bg-gray-50"
        />
      </div>

      {/* Date Created */}
      <div className="flex flex-col gap-1">
        <label htmlFor="dateCreated" className="font-semibold text-gray-900">Date Created</label>
        <input
          id="dateCreated"
          name="dateCreated"
          type="month"
          value={formData.dateCreated}
          onChange={handleChange}
          disabled={isDisabled}
          className="px-3 py-2 border border-gray-300 rounded-lg text-base bg-white focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 disabled:opacity-60 disabled:bg-gray-50"
        />
      </div>

      {/* Tags */}
      <div className="flex flex-col gap-1">
        <label htmlFor="tagInput" className="font-semibold text-gray-900">Tags</label>
        <div className="flex gap-2">
          <input
            id="tagInput"
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.currentTarget.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddTag() } }}
            disabled={isDisabled || formData.tags.length >= 20}
            placeholder="Add tags (press Enter)"
            maxLength={50}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-base bg-white focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 disabled:opacity-60 disabled:bg-gray-50"
          />
          <button
            type="button"
            onClick={handleAddTag}
            disabled={isDisabled || !tagInput.trim() || formData.tags.length >= 20}
            className="px-4 py-2 bg-gray-900 text-white rounded-lg font-semibold hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Add
          </button>
        </div>
        <div className="flex flex-wrap gap-2 mt-2">
          {formData.tags.map((tag) => (
            <span key={tag} className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 border border-gray-200 rounded-full text-sm">
              {tag}
              <button
                type="button"
                onClick={() => handleRemoveTag(tag)}
                disabled={isDisabled}
                className="text-gray-500 hover:text-red-600 text-base leading-none"
                aria-label={`Remove tag ${tag}`}
              >
                &times;
              </button>
            </span>
          ))}
        </div>
        {errors.tags && <p className="text-sm text-red-600">{errors.tags}</p>}
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={isDisabled}
        className="px-6 py-3 bg-gray-900 text-white rounded-lg font-semibold text-base hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
      >
        {isLoading ? 'Creating artwork...' : 'Create Artwork'}
      </button>
    </form>
  )
}
