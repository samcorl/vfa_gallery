export interface LoadingSpinnerProps {
  message?: string
  size?: 'small' | 'medium' | 'large'
}

export function LoadingSpinner({ message = 'Loading...', size = 'medium' }: LoadingSpinnerProps) {
  const sizeClasses = {
    small: 'h-6 w-6',
    medium: 'h-12 w-12',
    large: 'h-16 w-16',
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <div
        className={`${sizeClasses[size]} animate-spin rounded-full border-4 border-gray-200 border-t-blue-600`}
      />
      <p className="text-gray-600">{message}</p>
    </div>
  )
}
