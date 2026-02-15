interface ErrorFallbackProps {
  error: Error
  resetErrorBoundary: () => void
}

export default function ErrorFallback({ error, resetErrorBoundary }: ErrorFallbackProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="mb-4 text-6xl">&#9888;</div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">Something went wrong</h1>

        <p className="text-gray-600 mb-6">
          We encountered an unexpected error. Please try again or contact support if the problem
          persists.
        </p>

        {import.meta.env.DEV && (
          <details className="mb-6 text-left bg-gray-100 p-4 rounded text-xs text-gray-700 overflow-auto max-h-40">
            <summary className="font-semibold cursor-pointer mb-2">Error details</summary>
            <pre className="whitespace-pre-wrap break-words">{error.toString()}</pre>
          </details>
        )}

        <div className="flex flex-col gap-3">
          <button
            onClick={resetErrorBoundary}
            className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Try Again
          </button>

          <a
            href="/"
            className="w-full px-4 py-3 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 transition-colors font-medium text-center"
          >
            Go to Homepage
          </a>
        </div>

        <p className="mt-6 text-xs text-gray-500">
          If this continues, please contact{' '}
          <a href="mailto:support@vfa.gallery" className="text-blue-600 hover:underline">
            support@vfa.gallery
          </a>
        </p>
      </div>
    </div>
  )
}
