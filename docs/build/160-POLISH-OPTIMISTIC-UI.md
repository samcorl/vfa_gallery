# 160-POLISH-OPTIMISTIC-UI.md

## Goal

Implement optimistic UI updates where the interface updates immediately before API confirmation, with automatic rollback on errors to provide instant feedback and improve perceived responsiveness.

---

## Spec Extract

From TECHNICAL-SPEC.md and Performance Requirements:

- **Optimistic Updates:**
  - Update UI immediately on user action
  - Don't wait for API response
  - Rollback if API fails
  - Apply to: likes/favorites, reordering, status changes, visibility toggles

- **State Management:**
  - Maintain both optimistic and real state
  - Sync real state when API responds
  - Handle conflicts gracefully
  - Preserve user input on errors

- **User Feedback:**
  - Visual indication of pending state
  - Toast notification on success
  - Error toast with retry option
  - Smooth animations during transitions

- **Scenarios to Support:**
  - Like/unlike artwork
  - Reorder collections or artworks
  - Publish/hide content
  - Feature/unfeature content
  - Favorite/unfavorite galleries

---

## Prerequisites

**Must complete before starting:**
- **28-REACT-TOAST-SYSTEM.md** - Toast system implemented
- **51-UI-ARTWORK-CARD.md** - Artwork card component
- **25-REACT-AUTH-CONTEXT.md** - Auth context established

---

## Steps

### Step 1: Create useOptimisticUpdate Hook

Create a hook for managing optimistic state changes.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/hooks/useOptimisticUpdate.ts`

```typescript
import { useState, useCallback, useRef } from 'react'
import { useToast } from './useToast'

interface UseOptimisticUpdateProps<T, U> {
  /**
   * Current value
   */
  initialValue: T

  /**
   * Function that updates the value optimistically
   * Returns the optimistic state
   */
  optimisticUpdate: (currentValue: T, payload: U) => T

  /**
   * API call to confirm the update
   * Should return the final state from server
   */
  apiCall: (payload: U) => Promise<T>

  /**
   * Optional: Function to transform API response to state
   */
  transformResponse?: (response: any) => T

  /**
   * Optional: Custom error message
   */
  errorMessage?: string

  /**
   * Optional: Custom success message
   */
  successMessage?: string

  /**
   * Whether to show toast notifications
   * Default: true
   */
  showNotifications?: boolean
}

interface OptimisticState<T> {
  /**
   * Current state (may be optimistic)
   */
  value: T

  /**
   * Whether an update is pending
   */
  isPending: boolean

  /**
   * Whether the current state is optimistic
   */
  isOptimistic: boolean

  /**
   * Error message if update failed
   */
  error: string | null
}

/**
 * useOptimisticUpdate Hook
 * Manages optimistic updates with automatic rollback
 *
 * Features:
 * - Immediate UI updates
 * - Automatic rollback on error
 * - Configurable notifications
 * - Error handling with retry
 *
 * Usage:
 * const { value, isPending, updateAsync } = useOptimisticUpdate({
 *   initialValue: artwork,
 *   optimisticUpdate: (current, payload) => ({
 *     ...current,
 *     liked: payload.liked
 *   }),
 *   apiCall: (payload) => api.updateArtwork(artwork.id, payload)
 * })
 */
export function useOptimisticUpdate<T, U>({
  initialValue,
  optimisticUpdate,
  apiCall,
  transformResponse,
  errorMessage = 'Failed to update',
  successMessage = 'Updated successfully',
  showNotifications = true
}: UseOptimisticUpdateProps<T, U>) {
  const [state, setState] = useState<OptimisticState<T>>({
    value: initialValue,
    isPending: false,
    isOptimistic: false,
    error: null
  })

  const previousStateRef = useRef<T>(initialValue)
  const { toast } = useToast()

  /**
   * Perform optimistic update
   */
  const updateAsync = useCallback(
    async (payload: U) => {
      // Store previous state for rollback
      previousStateRef.current = state.value

      // Calculate optimistic state
      const optimisticState = optimisticUpdate(state.value, payload)

      // Update UI immediately (optimistic)
      setState({
        value: optimisticState,
        isPending: true,
        isOptimistic: true,
        error: null
      })

      try {
        // Call API in background
        const response = await apiCall(payload)

        // Transform response if needed
        const finalValue = transformResponse ? transformResponse(response) : response

        // Update with confirmed state
        setState({
          value: finalValue,
          isPending: false,
          isOptimistic: false,
          error: null
        })

        // Show success notification
        if (showNotifications) {
          toast({
            type: 'success',
            message: successMessage
          })
        }

        return { success: true, data: finalValue }
      } catch (error) {
        // Rollback to previous state on error
        setState({
          value: previousStateRef.current,
          isPending: false,
          isOptimistic: false,
          error: errorMessage
        })

        // Show error notification with retry option
        if (showNotifications) {
          toast({
            type: 'error',
            message: errorMessage,
            action: {
              label: 'Retry',
              onClick: () => updateAsync(payload)
            }
          })
        }

        return {
          success: false,
          error: error instanceof Error ? error.message : errorMessage
        }
      }
    },
    [state.value, optimisticUpdate, apiCall, transformResponse, errorMessage, successMessage, showNotifications, toast]
  )

  /**
   * Reset to initial state
   */
  const reset = useCallback(() => {
    setState({
      value: initialValue,
      isPending: false,
      isOptimistic: false,
      error: null
    })
    previousStateRef.current = initialValue
  }, [initialValue])

  /**
   * Manually set state (useful for syncing external updates)
   */
  const setValue = useCallback((newValue: T) => {
    setState({
      value: newValue,
      isPending: false,
      isOptimistic: false,
      error: null
    })
    previousStateRef.current = newValue
  }, [])

  return {
    ...state,
    updateAsync,
    reset,
    setValue
  }
}
```

---

### Step 2: Create useOptimisticList Hook

Create a hook for managing list updates (likes, favorites, reordering).

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/hooks/useOptimisticList.ts`

```typescript
import { useState, useCallback, useRef } from 'react'
import { useToast } from './useToast'

interface ListItem {
  id: string | number
  [key: string]: any
}

interface UseOptimisticListProps<T extends ListItem> {
  /**
   * Initial list of items
   */
  initialList: T[]

  /**
   * Function to find and update item in list
   */
  updateItem: (list: T[], id: string | number, updates: Partial<T>) => T[]

  /**
   * Function to reorder items
   */
  reorderItems?: (list: T[], from: number, to: number) => T[]

  /**
   * API call for update
   */
  apiCall: (id: string | number, updates: Partial<T>) => Promise<T>

  /**
   * API call for reorder
   */
  reorderApiCall?: (ids: (string | number)[]) => Promise<T[]>

  /**
   * Show toast notifications
   * Default: true
   */
  showNotifications?: boolean
}

interface OptimisticListState<T> {
  /**
   * Current list (may be optimistic)
   */
  items: T[]

  /**
   * Items pending confirmation
   */
  pendingIds: Set<string | number>

  /**
   * Error state per item
   */
  errors: Map<string | number, string>
}

/**
 * useOptimisticList Hook
 * Manages optimistic updates for list items
 *
 * Features:
 * - Update individual items optimistically
 * - Reorder items with confirmation
 * - Track pending updates per item
 * - Automatic rollback on error
 *
 * Usage:
 * const { items, updateItem } = useOptimisticList({
 *   initialList: artworks,
 *   updateItem: (list, id, updates) => list.map(item =>
 *     item.id === id ? { ...item, ...updates } : item
 *   ),
 *   apiCall: (id, updates) => api.updateArtwork(id, updates)
 * })
 */
export function useOptimisticList<T extends ListItem>({
  initialList,
  updateItem,
  reorderItems,
  apiCall,
  reorderApiCall,
  showNotifications = true
}: UseOptimisticListProps<T>) {
  const [state, setState] = useState<OptimisticListState<T>>({
    items: initialList,
    pendingIds: new Set(),
    errors: new Map()
  })

  const previousStateRef = useRef<T[]>(initialList)
  const { toast } = useToast()

  /**
   * Update a single item optimistically
   */
  const updateItemOptimistic = useCallback(
    async (id: string | number, updates: Partial<T>) => {
      // Save previous state
      previousStateRef.current = state.items

      // Update optimistically
      const optimisticList = updateItem(state.items, id, updates)

      setState(prev => ({
        ...prev,
        items: optimisticList,
        pendingIds: new Set([...prev.pendingIds, id])
      }))

      try {
        // Confirm with API
        const result = await apiCall(id, updates)

        // Update with server response
        const confirmedList = updateItem(state.items, id, result)

        setState(prev => {
          const newPendingIds = new Set(prev.pendingIds)
          newPendingIds.delete(id)
          const newErrors = new Map(prev.errors)
          newErrors.delete(id)

          return {
            ...prev,
            items: confirmedList,
            pendingIds: newPendingIds,
            errors: newErrors
          }
        })

        return { success: true }
      } catch (error) {
        // Rollback on error
        setState(prev => {
          const newPendingIds = new Set(prev.pendingIds)
          newPendingIds.delete(id)
          const newErrors = new Map(prev.errors)
          newErrors.set(id, error instanceof Error ? error.message : 'Update failed')

          return {
            ...prev,
            items: previousStateRef.current,
            pendingIds: newPendingIds,
            errors: newErrors
          }
        })

        if (showNotifications) {
          toast({
            type: 'error',
            message: 'Failed to update item',
            action: {
              label: 'Retry',
              onClick: () => updateItemOptimistic(id, updates)
            }
          })
        }

        return { success: false }
      }
    },
    [state.items, updateItem, apiCall, showNotifications, toast]
  )

  /**
   * Reorder items in list
   */
  const reorderListOptimistic = useCallback(
    async (from: number, to: number) => {
      if (!reorderItems || !reorderApiCall) {
        console.warn('Reorder not configured')
        return
      }

      // Save previous state
      previousStateRef.current = state.items

      // Reorder optimistically
      const optimisticList = reorderItems(state.items, from, to)

      setState(prev => ({
        ...prev,
        items: optimisticList
      }))

      try {
        // Get new order IDs
        const newOrder = optimisticList.map(item => item.id)

        // Confirm with API
        const result = await reorderApiCall(newOrder)

        setState(prev => ({
          ...prev,
          items: result
        }))

        if (showNotifications) {
          toast({
            type: 'success',
            message: 'Reordered successfully'
          })
        }

        return { success: true }
      } catch (error) {
        // Rollback on error
        setState(prev => ({
          ...prev,
          items: previousStateRef.current
        }))

        if (showNotifications) {
          toast({
            type: 'error',
            message: 'Failed to reorder items'
          })
        }

        return { success: false }
      }
    },
    [state.items, reorderItems, reorderApiCall, showNotifications, toast]
  )

  /**
   * Replace entire list
   */
  const setItems = useCallback((newItems: T[]) => {
    setState(prev => ({
      ...prev,
      items: newItems,
      pendingIds: new Set(),
      errors: new Map()
    }))
    previousStateRef.current = newItems
  }, [])

  /**
   * Clear errors for specific item
   */
  const clearError = useCallback((id: string | number) => {
    setState(prev => {
      const newErrors = new Map(prev.errors)
      newErrors.delete(id)
      return { ...prev, errors: newErrors }
    })
  }, [])

  return {
    items: state.items,
    pendingIds: state.pendingIds,
    errors: state.errors,
    updateItem: updateItemOptimistic,
    reorderList: reorderListOptimistic,
    setItems,
    clearError,
    isPending: state.pendingIds.size > 0
  }
}
```

---

### Step 3: Create useOptimisticToggle Hook

Create a specialized hook for boolean toggle states.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/hooks/useOptimisticToggle.ts`

```typescript
import { useState, useCallback, useRef } from 'react'
import { useToast } from './useToast'

interface UseOptimisticToggleProps {
  /**
   * Initial boolean value
   */
  initialValue: boolean

  /**
   * Function to toggle value on API
   */
  apiCall: (value: boolean) => Promise<boolean>

  /**
   * Error message
   */
  errorMessage?: string

  /**
   * Success message
   */
  successMessage?: string

  /**
   * Show notifications
   */
  showNotifications?: boolean
}

/**
 * useOptimisticToggle Hook
 * Simplified optimistic updates for boolean values
 *
 * Perfect for:
 * - Like/unlike buttons
 * - Show/hide toggles
 * - Feature/unfeature buttons
 * - Favorite/unfavorite toggles
 *
 * Usage:
 * const { isActive, toggle, isPending } = useOptimisticToggle({
 *   initialValue: artwork.liked,
 *   apiCall: (value) => api.setLiked(artworkId, value)
 * })
 */
export function useOptimisticToggle({
  initialValue,
  apiCall,
  errorMessage = 'Failed to update',
  successMessage = 'Updated',
  showNotifications = false
}: UseOptimisticToggleProps) {
  const [value, setValue] = useState(initialValue)
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const previousValueRef = useRef(initialValue)
  const { toast } = useToast()

  const toggle = useCallback(async () => {
    // Save previous value
    previousValueRef.current = value

    // Toggle optimistically
    const newValue = !value
    setValue(newValue)
    setIsPending(true)
    setError(null)

    try {
      // Confirm with API
      const result = await apiCall(newValue)

      setValue(result)
      setIsPending(false)

      if (showNotifications) {
        toast({
          type: 'success',
          message: successMessage
        })
      }

      return { success: true }
    } catch (err) {
      // Rollback on error
      setValue(previousValueRef.current)
      setIsPending(false)

      const errMsg = err instanceof Error ? err.message : errorMessage
      setError(errMsg)

      if (showNotifications) {
        toast({
          type: 'error',
          message: errMsg,
          action: {
            label: 'Retry',
            onClick: () => toggle()
          }
        })
      }

      return { success: false }
    }
  }, [value, apiCall, errorMessage, successMessage, showNotifications, toast])

  return {
    value,
    isPending,
    error,
    toggle,
    setValue
  }
}
```

---

### Step 4: Update ArtworkCard for Like Button

Add optimistic like functionality to artwork card.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/components/artwork/ArtworkCard.tsx` (modify)

```typescript
// Add to imports
import { useOptimisticToggle } from '../../hooks/useOptimisticToggle'
import { api } from '../../services/api'

// Inside ArtworkCard component, add:
const { value: isLiked, isPending: likesPending, toggle: toggleLike } = useOptimisticToggle({
  initialValue: artwork.liked || false,
  apiCall: async (value) => {
    const response = await api.updateArtwork(artwork.id, { liked: value })
    return response.liked
  },
  successMessage: isLiked ? 'Liked!' : 'Unliked',
  showNotifications: true
})

// In the JSX, add a like button:
<button
  onClick={toggleLike}
  disabled={likesPending}
  className={`absolute top-3 left-2 p-2 rounded-full transition-all ${
    isLiked
      ? 'bg-red-500 text-white'
      : 'bg-gray-400/50 text-white hover:bg-gray-500/70'
  } ${likesPending ? 'opacity-50' : ''}`}
  aria-label={isLiked ? 'Unlike artwork' : 'Like artwork'}
>
  <svg className="w-5 h-5" fill={isLiked ? 'currentColor' : 'none'} viewBox="0 0 24 24">
    <path
      stroke="currentColor"
      strokeWidth={2}
      d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
    />
  </svg>
</button>
```

---

### Step 5: Create Optimistic Update Provider

Create a context provider for managing global optimistic updates.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/context/OptimisticUpdateContext.tsx`

```typescript
import React, { createContext, useContext, ReactNode } from 'react'

interface OptimisticUpdate {
  id: string
  itemId: string | number
  type: 'like' | 'favorite' | 'reorder' | 'publish' | 'feature'
  timestamp: number
  isPending: boolean
}

interface OptimisticUpdateContextType {
  /**
   * Active optimistic updates
   */
  updates: Map<string, OptimisticUpdate>

  /**
   * Register an optimistic update
   */
  registerUpdate: (update: OptimisticUpdate) => void

  /**
   * Mark update as confirmed
   */
  confirmUpdate: (id: string) => void

  /**
   * Remove update (rollback)
   */
  removeUpdate: (id: string) => void

  /**
   * Check if item has pending updates
   */
  isPending: (itemId: string | number) => boolean
}

const OptimisticUpdateContext = createContext<OptimisticUpdateContextType | undefined>(undefined)

/**
 * OptimisticUpdateProvider
 * Provides context for managing optimistic updates across application
 */
export const OptimisticUpdateProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [updates, setUpdates] = React.useState<Map<string, OptimisticUpdate>>(new Map())

  const registerUpdate = React.useCallback((update: OptimisticUpdate) => {
    setUpdates(prev => new Map(prev).set(update.id, update))
  }, [])

  const confirmUpdate = React.useCallback((id: string) => {
    setUpdates(prev => {
      const next = new Map(prev)
      next.delete(id)
      return next
    })
  }, [])

  const removeUpdate = React.useCallback((id: string) => {
    setUpdates(prev => {
      const next = new Map(prev)
      next.delete(id)
      return next
    })
  }, [])

  const isPending = React.useCallback(
    (itemId: string | number) => {
      for (const update of updates.values()) {
        if (update.itemId === itemId && update.isPending) {
          return true
        }
      }
      return false
    },
    [updates]
  )

  const value: OptimisticUpdateContextType = {
    updates,
    registerUpdate,
    confirmUpdate,
    removeUpdate,
    isPending
  }

  return (
    <OptimisticUpdateContext.Provider value={value}>
      {children}
    </OptimisticUpdateContext.Provider>
  )
}

/**
 * useOptimisticUpdateContext Hook
 * Access optimistic update context
 */
export const useOptimisticUpdateContext = () => {
  const context = useContext(OptimisticUpdateContext)
  if (!context) {
    throw new Error(
      'useOptimisticUpdateContext must be used within OptimisticUpdateProvider'
    )
  }
  return context
}
```

---

### Step 6: Create Optimistic Button Component

Create a reusable button for optimistic updates.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/components/common/OptimisticButton.tsx`

```typescript
import React from 'react'

interface OptimisticButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * Icon to show when inactive
   */
  icon: React.ReactNode

  /**
   * Icon to show when active
   */
  activeIcon?: React.ReactNode

  /**
   * Label text
   */
  label: string

  /**
   * Active state
   */
  isActive?: boolean

  /**
   * Pending state
   */
  isPending?: boolean

  /**
   * Color when active
   * Default: 'red'
   */
  activeColor?: 'red' | 'blue' | 'green' | 'yellow'

  /**
   * Size of button
   */
  size?: 'sm' | 'md' | 'lg'
}

/**
 * OptimisticButton Component
 * Button for optimistic toggle actions
 *
 * Usage:
 * <OptimisticButton
 *   icon={<HeartIcon />}
 *   activeIcon={<HeartFilledIcon />}
 *   label="Like"
 *   isActive={liked}
 *   isPending={likePending}
 *   onClick={toggleLike}
 * />
 */
export const OptimisticButton: React.FC<OptimisticButtonProps> = ({
  icon,
  activeIcon,
  label,
  isActive = false,
  isPending = false,
  activeColor = 'red',
  size = 'md',
  className = '',
  ...props
}) => {
  const colorMap = {
    red: 'bg-red-500 text-white',
    blue: 'bg-blue-500 text-white',
    green: 'bg-green-500 text-white',
    yellow: 'bg-yellow-500 text-gray-900'
  }

  const sizeMap = {
    sm: 'p-1.5',
    md: 'p-2',
    lg: 'p-3'
  }

  const bgColor = isActive
    ? colorMap[activeColor]
    : 'bg-gray-400/50 text-white hover:bg-gray-500/70'

  return (
    <button
      className={`
        rounded-full transition-all flex items-center justify-center gap-1
        ${sizeMap[size]}
        ${bgColor}
        ${isPending ? 'opacity-50 cursor-wait' : ''}
        ${className}
      `}
      disabled={isPending}
      title={label}
      aria-label={label}
      aria-pressed={isActive}
      {...props}
    >
      {isPending ? (
        <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={2} opacity={0.25} />
          <path
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      ) : isActive && activeIcon ? (
        activeIcon
      ) : (
        icon
      )}
    </button>
  )
}
```

---

## Files to Create/Modify

1. **Create:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/hooks/useOptimisticUpdate.ts`
2. **Create:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/hooks/useOptimisticList.ts`
3. **Create:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/hooks/useOptimisticToggle.ts`
4. **Create:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/context/OptimisticUpdateContext.tsx`
5. **Create:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/components/common/OptimisticButton.tsx`
6. **Modify:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/components/artwork/ArtworkCard.tsx` - Add like button with optimistic toggle

---

## Verification

1. **Optimistic Update Hook:**
   - UI updates immediately on action
   - API call happens in background
   - State confirmed when API responds
   - Error rolls back to previous state

2. **Optimistic Toggle:**
   - Boolean state toggles instantly
   - Pending state disabled user interaction
   - Success notification shows
   - Error notification with retry works

3. **Optimistic List:**
   - Individual items update optimistically
   - Multiple pending items tracked
   - Reordering works with confirmation
   - Rollback on error restores list

4. **Like Button:**
   - Heart icon fills when liked
   - Click toggles like state instantly
   - Like count updates immediately
   - API confirms in background

5. **Error Handling:**
   - Failed update rolls back to previous state
   - Error message displays
   - Retry button available
   - No data loss on failure

6. **Performance:**
   - Instant UI feedback
   - No perceived lag
   - Smooth animations
   - Network requests don't block UI

7. **Accessibility:**
   - Buttons have aria-labels
   - aria-pressed reflects state
   - Disabled state on pending
   - Keyboard accessible

8. **Network Scenarios:**
   - Slow network shows pending state
   - Offline handling works
   - Timeout/failure recovers
   - Multiple concurrent updates safe

9. **State Consistency:**
   - Optimistic matches final state usually
   - Conflicts handled gracefully
   - No race condition issues
   - State always consistent

10. **User Experience:**
    - Feels instant and responsive
    - Clear visual feedback
    - Error recovery straightforward
    - No jarring transitions
