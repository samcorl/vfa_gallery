interface ErrorStateProps {
  error: string
  title?: string
  onRetry?: () => void
}

export default function ErrorState({ error, title = 'Something went wrong', onRetry }: ErrorStateProps) {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-gray-900 mb-4">{title}</h1>
      <p className="text-gray-600 mb-8">{error}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-gray-900 text-white rounded hover:bg-gray-800 transition"
        >
          Try again
        </button>
      )}
    </div>
  )
}
