import { useState, useCallback, useRef } from 'react'
import { useToast } from '../contexts/ToastContext'

interface UseOptimisticToggleOptions {
  /** API call for when toggling ON */
  onActivate: () => Promise<void>
  /** API call for when toggling OFF */
  onDeactivate: () => Promise<void>
  /** Optional success messages */
  activateMessage?: string
  deactivateMessage?: string
  /** Optional error message */
  errorMessage?: string
}

interface OptimisticToggle {
  /** Current toggle state */
  isActive: boolean
  /** Whether an API call is in progress */
  isPending: boolean
  /** Toggle the state */
  toggle: () => Promise<void>
}

export function useOptimisticToggle(
  initialState: boolean,
  options: UseOptimisticToggleOptions
): OptimisticToggle {
  const [isActive, setIsActive] = useState(initialState)
  const [isPending, setIsPending] = useState(false)
  const previousState = useRef(initialState)
  const { success, error } = useToast()

  const toggle = useCallback(async () => {
    if (isPending) return // Prevent double-clicks

    const newState = !isActive
    previousState.current = isActive
    setIsActive(newState) // Optimistic toggle
    setIsPending(true)

    try {
      if (newState) {
        await options.onActivate()
        if (options.activateMessage) {
          success(options.activateMessage)
        }
      } else {
        await options.onDeactivate()
        if (options.deactivateMessage) {
          success(options.deactivateMessage)
        }
      }
    } catch (err) {
      // Rollback
      setIsActive(previousState.current)
      const message = options.errorMessage || 'Action failed. Please try again.'
      error(message)
    } finally {
      setIsPending(false)
    }
  }, [isActive, isPending, options, success, error])

  return { isActive, isPending, toggle }
}
