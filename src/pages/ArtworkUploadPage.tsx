import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { ImageDropzone } from '../components/ImageDropzone'
import { ArtworkForm, type ArtworkFormData } from '../components/ArtworkForm'

type Step = 'upload' | 'form' | 'processing' | 'success'

interface UploadResult {
  key: string
  cdnUrl: string
  contentType: string
  size: number
}

export default function ArtworkUploadPage() {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()

  const [step, setStep] = useState<Step>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [artwork, setArtwork] = useState<any>(null)

  const handleImageSelected = (selectedFile: File) => {
    setFile(selectedFile)
    setPreview(URL.createObjectURL(selectedFile))
    setStep('form')
    setError(null)
  }

  const handleFormSubmit = async (formData: ArtworkFormData) => {
    if (!file || !isAuthenticated) {
      setError('Missing file or authentication')
      return
    }

    setStep('processing')
    setProgress(0)
    setError(null)

    try {
      // Step 1: Upload image
      setProgress(25)
      const uploadFormData = new FormData()
      uploadFormData.append('file', file)

      const uploadRes = await fetch('/api/artworks/upload', {
        method: 'POST',
        credentials: 'include',
        body: uploadFormData,
      })

      if (!uploadRes.ok) {
        const err = await uploadRes.json().catch(() => null)
        throw new Error(err?.error?.message || 'Failed to upload image')
      }

      const uploadResult: UploadResult = await uploadRes.json()

      // Step 2: Create artwork record
      setProgress(75)

      const createRes = await fetch('/api/artworks', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description || null,
          category: formData.category,
          materials: formData.materials || null,
          dimensions: formData.dimensions || null,
          createdDate: formData.dateCreated || null,
          tags: formData.tags,
          imageKey: uploadResult.key,
        }),
      })

      if (!createRes.ok) {
        const err = await createRes.json().catch(() => null)
        throw new Error(err?.error?.message || 'Failed to create artwork')
      }

      const createdArtwork = await createRes.json()
      setProgress(100)
      setArtwork(createdArtwork)
      setStep('success')
    } catch (err) {
      console.error('Upload error:', err)
      setError(err instanceof Error ? err.message : 'Upload failed')
      setStep('form')
    }
  }

  const handleReset = () => {
    if (preview) URL.revokeObjectURL(preview)
    setFile(null)
    setPreview(null)
    setStep('upload')
    setProgress(0)
    setError(null)
    setArtwork(null)
  }

  return (
    <div className="min-h-screen bg-white px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <header className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Upload Artwork</h1>
          <p className="text-lg text-gray-500">Share your creative work with the world</p>
        </header>

        {error && (
          <div className="mb-6 px-4 py-3 bg-red-50 border border-red-200 text-red-800 rounded-lg">
            {error}
          </div>
        )}

        {/* Upload Step */}
        {step === 'upload' && (
          <ImageDropzone onImageSelected={handleImageSelected} onError={setError} />
        )}

        {/* Form Step */}
        {step === 'form' && preview && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
            <div className="sticky top-8">
              <img
                src={preview}
                alt="Preview"
                className="w-full max-h-96 object-contain rounded-lg bg-gray-100"
              />
              <button
                onClick={() => setStep('upload')}
                className="mt-4 text-sm text-gray-500 hover:text-gray-900 underline"
              >
                Choose a different image
              </button>
            </div>
            <ArtworkForm onSubmit={handleFormSubmit} />
          </div>
        )}

        {/* Processing Step */}
        {step === 'processing' && (
          <div className="text-center py-16">
            <div className="w-12 h-12 border-4 border-gray-200 border-t-gray-900 rounded-full animate-spin mx-auto mb-6" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Processing Your Artwork</h2>
            <p className="text-gray-500 mb-6">Uploading image and creating your artwork...</p>
            <div className="w-full max-w-md mx-auto h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gray-900 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-2 font-semibold text-gray-900">{progress}%</p>
          </div>
        )}

        {/* Success Step */}
        {step === 'success' && artwork && (
          <div className="text-center py-12">
            <div className="text-5xl mb-4 text-green-600">&#10003;</div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Artwork Created!</h2>
            <p className="text-gray-500 mb-8">
              &ldquo;{artwork.title}&rdquo; has been uploaded successfully.
            </p>
            {artwork.displayUrl && (
              <img
                src={artwork.displayUrl}
                alt={artwork.title}
                className="w-full max-w-md max-h-96 object-contain rounded-lg bg-gray-100 mx-auto mb-8"
              />
            )}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => navigate(`/profile/artworks`)}
                className="px-6 py-3 bg-gray-900 text-white rounded-lg font-semibold hover:bg-gray-800"
              >
                View My Artworks
              </button>
              <button
                onClick={handleReset}
                className="px-6 py-3 bg-gray-100 text-gray-900 border border-gray-200 rounded-lg font-semibold hover:bg-gray-200"
              >
                Upload Another
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
