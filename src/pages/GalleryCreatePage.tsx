import { useNavigate } from 'react-router-dom'
import { useToast } from '../contexts/ToastContext'
import GalleryForm from '../components/gallery/GalleryForm'
import type { GalleryFormData } from '../components/gallery/GalleryForm'
import type { Gallery } from '../types/gallery'

export default function GalleryCreatePage() {
  const navigate = useNavigate()
  const toast = useToast()

  const handleSubmit = async (data: GalleryFormData) => {
    try {
      const res = await fetch('/api/galleries', {
        method: 'POST',
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
        throw new Error(err?.error?.message || 'Failed to create gallery')
      }

      const newGallery: Gallery = await res.json()
      toast.success('Gallery created')
      navigate(`/profile/galleries/${newGallery.id}`)
    } catch (err) {
      throw err
    }
  }

  const handleCancel = () => {
    navigate('/profile/galleries')
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
            ← Back to Galleries
          </button>
        </div>
        <h1 className="text-3xl font-bold text-gray-900">Create Gallery</h1>
      </div>

      {/* Form */}
      <GalleryForm
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        submitLabel="Create Gallery"
      />
    </div>
  )
}
