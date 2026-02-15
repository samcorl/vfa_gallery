import { useEffect, useState } from 'react'
import type { Toast as ToastType } from '../../types/toast'
import { useToast } from '../../contexts/ToastContext'

interface ToastProps {
  toast: ToastType
}

export function Toast({ toast }: ToastProps) {
  const { dismiss } = useToast()
  const [isExiting, setIsExiting] = useState(false)

  const typeConfig = {
    success: {
      bgColor: 'bg-green-500',
      icon: '\u2713',
      textColor: 'text-white',
    },
    error: {
      bgColor: 'bg-red-500',
      icon: '\u2715',
      textColor: 'text-white',
    },
    info: {
      bgColor: 'bg-blue-500',
      icon: '\u24D8',
      textColor: 'text-white',
    },
    warning: {
      bgColor: 'bg-yellow-500',
      icon: '\u26A0',
      textColor: 'text-white',
    },
  }

  const config = typeConfig[toast.type]

  const handleClose = () => {
    setIsExiting(true)
    setTimeout(() => {
      dismiss(toast.id)
    }, 300)
  }

  useEffect(() => {
    if (toast.duration && toast.duration > 0) {
      const timer = setTimeout(() => {
        setIsExiting(true)
      }, toast.duration - 300)
      return () => clearTimeout(timer)
    }
  }, [toast.duration, toast.id])

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg transition-all duration-300 ${
        config.bgColor
      } ${config.textColor} ${isExiting ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'}`}
      role="alert"
      aria-live="polite"
    >
      <span className="flex-shrink-0 font-bold text-lg">{config.icon}</span>
      <span className="flex-1 text-sm font-medium">{toast.message}</span>
      <button
        onClick={handleClose}
        className="flex-shrink-0 ml-2 text-lg hover:opacity-75 transition-opacity"
        aria-label="Close notification"
      >
        &times;
      </button>
    </div>
  )
}
