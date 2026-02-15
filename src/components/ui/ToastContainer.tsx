import { useToast } from '../../contexts/ToastContext'
import { Toast } from './Toast'

export function ToastContainer() {
  const { toasts } = useToast()

  return (
    <div
      className="fixed z-50 pointer-events-none
        bottom-4 left-1/2 -translate-x-1/2 w-full max-w-sm px-4
        md:bottom-6 md:right-6 md:left-auto md:translate-x-0
        flex flex-col gap-3"
    >
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <Toast toast={toast} />
        </div>
      ))}
    </div>
  )
}
