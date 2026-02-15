interface ConfirmDialogProps {
  title: string
  message: string
  confirmText?: string
  confirmVariant?: 'danger' | 'default'
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  title,
  message,
  confirmText = 'Confirm',
  confirmVariant = 'default',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />

      {/* Dialog */}
      <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-2">{title}</h2>
        <p className="text-gray-600 mb-6">{message}</p>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 px-4 py-2 text-white rounded-lg font-medium disabled:opacity-50 ${
              confirmVariant === 'danger'
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-gray-900 hover:bg-gray-800'
            }`}
          >
            {loading ? 'Please wait...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
