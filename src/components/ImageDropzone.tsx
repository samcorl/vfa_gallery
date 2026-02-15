import { useState, useRef } from 'react'

export interface ImageDropzoneProps {
  onImageSelected: (file: File) => void
  onError: (error: string) => void
  disabled?: boolean
}

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

export function ImageDropzone({
  onImageSelected,
  onError,
  disabled = false,
}: ImageDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const validateFile = (file: File): boolean => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      onError('Invalid file type. Accepted: JPEG, PNG, GIF, WebP')
      return false
    }
    if (file.size > MAX_FILE_SIZE) {
      onError(`File too large. Maximum 10MB allowed. Your file: ${(file.size / 1024 / 1024).toFixed(1)}MB`)
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
    if (!disabled) setIsDragging(true)
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
    if (files.length > 0) handleFileSelect(files[0])
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files
    if (files && files.length > 0) handleFileSelect(files[0])
  }

  return (
    <div
      className={`relative w-full min-h-[300px] border-2 border-dashed rounded-lg flex items-center justify-center cursor-pointer bg-gray-50 transition-all duration-200 p-8 text-center ${
        isDragging ? 'border-gray-900 bg-gray-100 shadow-lg' : 'border-gray-300'
      } ${disabled ? 'cursor-not-allowed opacity-60' : 'hover:border-gray-900 hover:bg-gray-100'}`}
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
        className="hidden"
        aria-label="Select image file"
      />
      <div className="flex flex-col items-center gap-2">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="w-12 h-12 text-gray-400"
          aria-hidden="true"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        <p className="text-lg font-semibold text-gray-900">
          Drag & drop your artwork here
        </p>
        <p className="text-sm text-gray-500">
          or click to select (JPEG, PNG, GIF, WebP up to 10MB)
        </p>
      </div>
    </div>
  )
}
