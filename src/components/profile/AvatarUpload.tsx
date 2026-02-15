import { useState, useRef } from 'react'
import { Upload, X } from 'lucide-react'
import { useToast } from '../../contexts/ToastContext'
import { validateAvatarUpload } from '../../lib/validation/users'
import type { UserProfileResponse } from '../../types/user'
import { ProfileAvatar } from './ProfileAvatar'

interface AvatarUploadProps {
  user: UserProfileResponse
  onSuccess: (updatedUser: UserProfileResponse) => void
}

export function AvatarUpload({ user, onSuccess }: AvatarUploadProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const toast = useToast()

  const handleFileSelect = async (file: File) => {
    // Validate file
    const errors = validateAvatarUpload(file)
    if (errors.length > 0) {
      errors.forEach((error) => {
        toast.error(error.message)
      })
      return
    }

    // Show preview
    const reader = new FileReader()
    reader.onload = (e) => {
      setPreview(e.target?.result as string)
    }
    reader.readAsDataURL(file)

    // Upload file
    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/users/me/avatar', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error?.message || 'Upload failed')
      }

      const data = await response.json()
      onSuccess(data.user)
      setPreview(null)
      toast.success('Avatar updated successfully')

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (error) {
      console.error('Avatar upload error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to upload avatar')
      setPreview(null)
    } finally {
      setIsUploading(false)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()

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
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">Profile Picture</h3>

      <div className="flex flex-col sm:flex-row gap-6">
        {/* Current/Preview Avatar */}
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <ProfileAvatar user={user} size="xl" />
            {preview && (
              <div className="absolute inset-0 rounded-full overflow-hidden">
                <img src={preview} alt="Preview" className="w-full h-full object-cover" />
              </div>
            )}
            {isUploading && (
              <div className="absolute inset-0 rounded-full bg-black bg-opacity-50 flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
          {preview && (
            <button
              type="button"
              onClick={() => setPreview(null)}
              className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
            >
              <X className="w-4 h-4" />
              Clear preview
            </button>
          )}
        </div>

        {/* Upload Area */}
        <div className="flex-1 flex flex-col justify-center">
          <div
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-700 mb-1">
              {isUploading ? 'Uploading...' : 'Drag and drop your image here'}
            </p>
            <p className="text-xs text-gray-500">
              or click to select (JPEG, PNG, WebP, GIF • Max 5MB)
            </p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileInputChange}
            disabled={isUploading}
            className="hidden"
          />
        </div>
      </div>
    </div>
  )
}
