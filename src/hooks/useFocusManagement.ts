import { useEffect, useRef, useCallback } from 'react'

/**
 * Manages focus trapping within a container (for modals/dialogs).
 * - Traps Tab/Shift+Tab within the container
 * - Closes on Escape key
 * - Returns focus to the trigger element on close
 */
export function useFocusManagement(isOpen: boolean, onClose?: () => void) {
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLElement | null>(null)

  // Capture the element that opened the dialog
  useEffect(() => {
    if (isOpen) {
      triggerRef.current = document.activeElement as HTMLElement
    }
  }, [isOpen])

  // Focus the first focusable element when opened
  useEffect(() => {
    if (!isOpen || !containerRef.current) return

    const focusableElements = getFocusableElements(containerRef.current)
    if (focusableElements.length > 0) {
      ;(focusableElements[0] as HTMLElement).focus()
    }
  }, [isOpen])

  // Restore focus when closed
  useEffect(() => {
    if (!isOpen && triggerRef.current) {
      triggerRef.current.focus()
      triggerRef.current = null
    }
  }, [isOpen])

  // Handle keyboard events (trap focus + Escape)
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) {
        e.preventDefault()
        onClose()
        return
      }

      if (e.key !== 'Tab' || !containerRef.current) return

      const focusableElements = getFocusableElements(containerRef.current)
      if (focusableElements.length === 0) return

      const firstElement = focusableElements[0] as HTMLElement
      const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement

      if (e.shiftKey) {
        // Shift+Tab: wrap from first to last
        if (document.activeElement === firstElement) {
          e.preventDefault()
          lastElement.focus()
        }
      } else {
        // Tab: wrap from last to first
        if (document.activeElement === lastElement) {
          e.preventDefault()
          firstElement.focus()
        }
      }
    },
    [onClose]
  )

  return { containerRef, handleKeyDown }
}

function getFocusableElements(container: HTMLElement): NodeListOf<Element> {
  return container.querySelectorAll(
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )
}
