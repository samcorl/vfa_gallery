/** Check if a key event is an activation key (Enter or Space) */
export function isActivationKey(e: React.KeyboardEvent): boolean {
  return e.key === 'Enter' || e.key === ' '
}

/** Handle activation key events — calls handler and prevents default for Space */
export function handleActivation(e: React.KeyboardEvent, handler: () => void) {
  if (isActivationKey(e)) {
    if (e.key === ' ') e.preventDefault() // Prevent page scroll on Space
    handler()
  }
}

/** Arrow key direction helper for menu/list navigation */
export type ArrowDirection = 'up' | 'down' | 'left' | 'right'

export function getArrowDirection(e: React.KeyboardEvent): ArrowDirection | null {
  switch (e.key) {
    case 'ArrowUp': return 'up'
    case 'ArrowDown': return 'down'
    case 'ArrowLeft': return 'left'
    case 'ArrowRight': return 'right'
    default: return null
  }
}

/** Navigate a list with arrow keys (wrapping) */
export function handleArrowNavigation(
  e: React.KeyboardEvent,
  currentIndex: number,
  totalItems: number,
  onIndexChange: (newIndex: number) => void,
  orientation: 'vertical' | 'horizontal' = 'vertical'
) {
  const direction = getArrowDirection(e)
  if (!direction) return

  const isForward =
    (orientation === 'vertical' && direction === 'down') ||
    (orientation === 'horizontal' && direction === 'right')
  const isBackward =
    (orientation === 'vertical' && direction === 'up') ||
    (orientation === 'horizontal' && direction === 'left')

  if (!isForward && !isBackward) return

  e.preventDefault()

  if (isForward) {
    onIndexChange(currentIndex >= totalItems - 1 ? 0 : currentIndex + 1)
  } else {
    onIndexChange(currentIndex <= 0 ? totalItems - 1 : currentIndex - 1)
  }
}
