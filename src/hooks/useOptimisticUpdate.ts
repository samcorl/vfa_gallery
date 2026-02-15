import { useState, useCallback, useRef } from 'react'
import { useToast } from '../contexts/ToastContext'

interface UseOptimisticUpdateOptions<T> {
  /** Function that performs the API call. Should throw on failure. */
  apiFn: (data: T) => Promise<void>
  /** Optional success message for toast */
  successMessage?: string
  /** Optional error message prefix for toast */
  errorMessage?: string
}

interface OptimisticState<T> {
  /** Current optimistic value */
  value: T
  /** Whether an API call is in progress */
  isPending: boolean
  /** Update with optimistic state, then call API. Rolls back on failure. */
  update: (newValue: T) => Promise<void>
}

export function useOptimisticUpdate<T>(
  initialValue: T,
  options: UseOptimisticUpdateOptions<T>
): OptimisticState<T> {
  const [value, setValue] = useState<T>(initialValue)
  const [isPending, setIsPending] = useState(false)
  const previousValue = useRef<T>(initialValue)
  const { success, error } = useToast()

  const update = useCallback(
    async (newValue: T) => {
      previousValue.current = value
      setValue(newValue) // Optimistic update
      setIsPending(true)

      try {
        await options.apiFn(newValue)
        if (options.successMessage) {
          success(options.successMessage)
        }
      } catch (err) {
        // Rollback
        setValue(previousValue.current)
        const message = options.errorMessage
          ? `${options.errorMessage}: ${err instanceof Error ? err.message : 'Unknown error'}`
          : 'Action failed. Please try again.'
        error(message)
      } finally {
        setIsPending(false)
      }
    },
    [value, options, success, error]
  )

  return { value, isPending, update }
}
