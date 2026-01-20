# 162-A11Y-KEYBOARD-NAV.md

## Goal

Implement full keyboard navigation support throughout the application. Enable logical tab order, visible focus indicators, skip links, Escape key to close modals/dropdowns, arrow keys in menus, and Enter/Space to activate buttons.

---

## Spec Extract

From TECHNICAL-SPEC.md - Accessibility:

- **Keyboard Navigation:**
  - Tab order follows logical flow
  - Visible focus indicators (ring style)
  - Skip link to main content
  - Escape closes modals/dropdowns
  - Arrow keys navigate menus
  - Enter/Space activates buttons
- **Focus Management:**
  - Focus visible on all interactive elements
  - Focus outline 2-3px ring
  - High contrast focus indicators
  - Focus trap in modals
- **Screen Reader Support:**
  - Semantic HTML
  - ARIA labels and descriptions
  - Live regions for dynamic content

---

## Prerequisites

**Must complete before starting:**
- **27-REACT-LAYOUT-SHELL.md** - App shell layout
- **28-REACT-TOAST-SYSTEM.md** - Toast system
- **29-REACT-ERROR-BOUNDARY.md** - Error boundary

---

## Steps

### Step 1: Create Focus Styles Utility

Create Tailwind utilities for focus states.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/styles/focus.css`

```css
/* Base focus styles */
:focus-visible {
  outline: 2px solid #2563eb;
  outline-offset: 2px;
}

/* Better focus for buttons */
button:focus-visible,
a:focus-visible,
input:focus-visible,
select:focus-visible,
textarea:focus-visible {
  outline: 2px solid #2563eb;
  outline-offset: 2px;
  border-radius: 0.25rem;
}

/* Modal focus trap - prevent focus escape */
.modal-focus-trap:focus-visible {
  outline: 2px solid #dc2626;
  outline-offset: -2px;
}

/* High contrast focus for dark mode */
@media (prefers-color-scheme: dark) {
  :focus-visible {
    outline-color: #60a5fa;
  }
}

/* Reduce animations for users who prefer reduced motion */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

### Step 2: Create Skip Link Component

Create skip link for keyboard navigation.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/a11y/SkipLink.tsx`

```typescript
/**
 * Skip link component
 * Allows users to skip navigation and go directly to main content
 * Only visible when focused with keyboard
 */
export default function SkipLink() {
  const handleSkipClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    const mainContent = document.getElementById('main-content')
    if (mainContent) {
      mainContent.focus()
      mainContent.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <a
      href="#main-content"
      onClick={handleSkipClick}
      className="absolute top-0 left-0 z-50 px-4 py-2 bg-blue-600 text-white text-sm font-medium -translate-y-full focus-visible:translate-y-0 transition-transform"
    >
      Skip to main content
    </a>
  )
}
```

---

### Step 3: Create Focus Management Hook

Create hook for managing focus in modals and complex interactions.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/hooks/useFocusManagement.ts`

```typescript
import { useEffect, useRef, useCallback } from 'react'

interface UseFocusManagementOptions {
  enabled?: boolean
  returnFocusOnUnmount?: boolean
}

/**
 * Hook for managing focus in modals and dialogs
 * - Traps focus within container
 * - Returns focus when closed
 * - Handles keyboard navigation
 */
export function useFocusManagement(
  options: UseFocusManagementOptions = {}
) {
  const {
    enabled = true,
    returnFocusOnUnmount = true,
  } = options

  const containerRef = useRef<HTMLDivElement>(null)
  const previousActiveElement = useRef<HTMLElement | null>(null)

  // Handle Escape key
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      // This will be handled by parent component's onClose
      const event = new CustomEvent('escapePressed')
      window.dispatchEvent(event)
    }
  }, [])

  useEffect(() => {
    if (!enabled || !containerRef.current) return

    // Store the element that had focus before modal opened
    previousActiveElement.current = document.activeElement as HTMLElement

    // Add keyboard handler
    document.addEventListener('keydown', handleKeyDown)

    // Get all focusable elements
    const getFocusableElements = () => {
      const focusableSelectors = [
        'button',
        '[href]',
        'input',
        'select',
        'textarea',
        '[tabindex]:not([tabindex="-1"])',
      ]
      return Array.from(
        containerRef.current?.querySelectorAll(focusableSelectors.join(',')) || []
      ) as HTMLElement[]
    }

    const focusableElements = getFocusableElements()
    const firstElement = focusableElements[0]
    const lastElement = focusableElements[focusableElements.length - 1]

    // Focus first element in modal
    if (firstElement) {
      setTimeout(() => firstElement.focus(), 0)
    }

    // Handle Tab key for focus trapping
    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return

      if (e.shiftKey) {
        // Shift + Tab - going backwards
        if (document.activeElement === firstElement) {
          e.preventDefault()
          lastElement?.focus()
        }
      } else {
        // Tab - going forward
        if (document.activeElement === lastElement) {
          e.preventDefault()
          firstElement?.focus()
        }
      }
    }

    containerRef.current?.addEventListener('keydown', handleTabKey)

    // Cleanup
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      containerRef.current?.removeEventListener('keydown', handleTabKey)

      // Return focus to previous element
      if (returnFocusOnUnmount && previousActiveElement.current) {
        previousActiveElement.current.focus()
      }
    }
  }, [enabled, handleKeyDown, returnFocusOnUnmount])

  return containerRef
}
```

---

### Step 4: Create Keyboard Navigation Utilities

Create utilities for keyboard handling.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/keyboard.ts`

```typescript
/**
 * Keyboard navigation utilities
 */

export const KEYS = {
  ENTER: 'Enter',
  SPACE: ' ',
  ESCAPE: 'Escape',
  ARROW_UP: 'ArrowUp',
  ARROW_DOWN: 'ArrowDown',
  ARROW_LEFT: 'ArrowLeft',
  ARROW_RIGHT: 'ArrowRight',
  TAB: 'Tab',
  HOME: 'Home',
  END: 'End',
}

/**
 * Check if keyboard event is for activation (Enter or Space)
 */
export function isActivationKey(event: KeyboardEvent): boolean {
  return event.key === KEYS.ENTER || event.key === KEYS.SPACE
}

/**
 * Check if event is arrow key
 */
export function isArrowKey(event: KeyboardEvent): boolean {
  return [
    KEYS.ARROW_UP,
    KEYS.ARROW_DOWN,
    KEYS.ARROW_LEFT,
    KEYS.ARROW_RIGHT,
  ].includes(event.key)
}

/**
 * Check if event is vertical arrow
 */
export function isVerticalArrow(event: KeyboardEvent): boolean {
  return [KEYS.ARROW_UP, KEYS.ARROW_DOWN].includes(event.key)
}

/**
 * Check if event is horizontal arrow
 */
export function isHorizontalArrow(event: KeyboardEvent): boolean {
  return [KEYS.ARROW_LEFT, KEYS.ARROW_RIGHT].includes(event.key)
}
```

---

### Step 5: Update Button Component with Keyboard Support

Enhance button components for keyboard accessibility.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/common/Button.tsx`

```typescript
import { forwardRef, ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  children: React.ReactNode
}

/**
 * Accessible button component with keyboard support
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      disabled = false,
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles = 'font-medium transition-colors focus-visible:outline-2 focus-visible:outline-blue-600'

    const variantStyles = {
      primary: 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400',
      secondary: 'bg-gray-200 text-gray-900 hover:bg-gray-300 disabled:bg-gray-100',
      danger: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-gray-400',
    }

    const sizeStyles = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2 text-base',
      lg: 'px-6 py-3 text-lg',
    }

    return (
      <button
        ref={ref}
        disabled={disabled}
        className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
        aria-disabled={disabled}
        {...props}
      >
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'
```

---

### Step 6: Create Modal with Keyboard Trap

Update modal components to support keyboard navigation.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/common/Modal.tsx`

```typescript
import { useEffect } from 'react'
import { useFocusManagement } from '../../hooks/useFocusManagement'
import { KEYS } from '../../lib/keyboard'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
}

/**
 * Accessible modal component with keyboard support
 * - Escape to close
 * - Focus trapping
 * - Focus management
 */
export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
}: ModalProps) {
  const containerRef = useFocusManagement({
    enabled: isOpen,
    returnFocusOnUnmount: true,
  })

  // Handle Escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === KEYS.ESCAPE && isOpen) {
        event.preventDefault()
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'auto'
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
      role="presentation"
    >
      <div
        ref={containerRef}
        className={`bg-white rounded-lg shadow-lg p-6 ${sizeClasses[size]}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
      >
        {title && (
          <h2 id="modal-title" className="text-xl font-bold mb-4">
            {title}
          </h2>
        )}

        {children}

        {/* Close hint for keyboard users */}
        <div className="mt-4 text-xs text-gray-500 text-center">
          Press <kbd className="px-1 py-0.5 bg-gray-200 rounded">Esc</kbd> to close
        </div>
      </div>
    </div>
  )
}
```

---

### Step 7: Create Menu Component with Arrow Keys

Create menu component with arrow key navigation.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/common/Menu.tsx`

```typescript
import { useState, useRef, useEffect } from 'react'
import { KEYS } from '../../lib/keyboard'

interface MenuItem {
  label: string
  onSelect: () => void
  disabled?: boolean
}

interface MenuProps {
  items: MenuItem[]
  trigger: React.ReactNode
  onClose?: () => void
}

/**
 * Accessible menu component with arrow key navigation
 */
export default function Menu({ items, trigger, onClose }: MenuProps) {
  const [open, setOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const menuRef = useRef<HTMLDivElement>(null)
  const itemsRef = useRef<HTMLButtonElement[]>([])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    switch (e.key) {
      case KEYS.ARROW_DOWN:
        e.preventDefault()
        setSelectedIndex((prev) => {
          const next = prev + 1
          return next >= items.length ? 0 : next
        })
        break
      case KEYS.ARROW_UP:
        e.preventDefault()
        setSelectedIndex((prev) => {
          const next = prev - 1
          return next < 0 ? items.length - 1 : next
        })
        break
      case KEYS.ENTER:
      case ' ':
        e.preventDefault()
        if (items[selectedIndex] && !items[selectedIndex].disabled) {
          items[selectedIndex].onSelect()
          setOpen(false)
        }
        break
      case KEYS.ESCAPE:
        e.preventDefault()
        setOpen(false)
        break
    }
  }

  // Focus selected item
  useEffect(() => {
    if (open && itemsRef.current[selectedIndex]) {
      itemsRef.current[selectedIndex]?.focus()
    }
  }, [open, selectedIndex])

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        open &&
        menuRef.current &&
        !menuRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  return (
    <div ref={menuRef} className="relative inline-block">
      <button
        onClick={() => {
          setOpen(!open)
          setSelectedIndex(0)
        }}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {trigger}
      </button>

      {open && (
        <div
          role="menu"
          onKeyDown={handleKeyDown}
          className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded shadow-lg"
        >
          {items.map((item, index) => (
            <button
              key={index}
              ref={(el) => {
                if (el) itemsRef.current[index] = el
              }}
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                if (!item.disabled) {
                  item.onSelect()
                  setOpen(false)
                  onClose?.()
                }
              }}
              className="block w-full text-left px-4 py-2 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:bg-blue-100 focus-visible:outline-none"
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
```

---

### Step 8: Update App Shell with Skip Link

Add skip link to main app layout.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/layout/AppShell.tsx`

Add import and component:

```typescript
import SkipLink from '../a11y/SkipLink'

export default function AppShell() {
  return (
    <>
      {/* Skip link for keyboard users */}
      <SkipLink />

      <div className="flex flex-col h-screen bg-white">
        {/* Top Navigation */}
        <TopNav />

        {/* Breadcrumbs */}
        <Breadcrumbs />

        {/* Main Content */}
        <main id="main-content" className="flex-1 overflow-y-auto pb-20 md:pb-0" tabIndex={-1}>
          <Outlet />
        </main>

        {/* Bottom Navigation */}
        <BottomNav />
      </div>
    </>
  )
}
```

---

## Files to Create/Modify

**New files to create:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/styles/focus.css`
2. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/a11y/SkipLink.tsx`
3. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/hooks/useFocusManagement.ts`
4. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/keyboard.ts`
5. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/common/Button.tsx` (if not exists)
6. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/common/Modal.tsx`
7. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/common/Menu.tsx`

**Files to modify:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/layout/AppShell.tsx` - Add SkipLink and tabIndex
2. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/index.css` or `/Volumes/DataSSD/gitsrc/vfa_gallery/src/main.css` - Import focus.css

---

## Verification

### Test 1: TypeScript Compilation

```bash
cd /Volumes/DataSSD/gitsrc/vfa_gallery
npx tsc --noEmit
```

Expected: No type errors

---

### Test 2: Tab Navigation

1. Start app
2. Press Tab key repeatedly
3. Verify:
   - Focus moves through all interactive elements
   - Order is logical (left to right, top to bottom)
   - No focus loss or skipping

---

### Test 3: Skip Link

1. Start app
2. Press Tab immediately
3. Verify:
   - Skip link appears and is focused
   - Text visible: "Skip to main content"
   - Clicking moves focus to main content area

---

### Test 4: Focus Indicators

1. Tab through page
2. Verify:
   - All focusable elements show blue outline
   - Outline is 2px thick
   - Outline has 2px offset
   - Outline is visible on all element types

---

### Test 5: Button Keyboard Support

1. Tab to button
2. Press Enter or Space
3. Verify:
   - Button activates/action occurs
   - No page reload
   - Focus remains on button

---

### Test 6: Modal Escape Key

1. Open a modal
2. Press Escape
3. Verify:
   - Modal closes
   - Focus returns to button that opened modal

---

### Test 7: Modal Focus Trapping

1. Open modal
2. Tab repeatedly
3. Verify:
   - Focus stays within modal
   - Cannot tab outside to page elements
   - Shift+Tab works backwards
   - Focus wraps at start/end

---

### Test 8: Menu Arrow Keys

1. Open menu component
2. Press Arrow Down
3. Verify:
   - Highlights next menu item
   - Cycles to beginning at end
4. Press Arrow Up
5. Verify:
   - Highlights previous menu item
6. Press Enter
7. Verify:
   - Menu item activates
   - Menu closes

---

### Test 9: Dropdown Keyboard Support

1. Tab to dropdown
2. Press Arrow Down
3. Verify:
   - Options open
   - First option focused
4. Use arrows to navigate
5. Press Enter to select

---

### Test 10: Multiple Modals

1. Open modal A
2. Open modal B inside modal A
3. Verify:
   - Tab stays in modal B
   - Escape closes modal B only
   - Focus returns to modal A

---

### Test 11: High Contrast Mode

1. Enable Windows High Contrast
2. Navigate page with keyboard
3. Verify:
   - Focus indicators still visible
   - Clear contrast

---

### Test 12: Reduced Motion

1. Set system preference for reduced motion
2. Navigate app
3. Verify:
   - Animations are minimal/none
   - App is still usable

---

### Test 13: Logical Tab Order

Test tab order on different pages:
- [ ] Homepage - logo → nav items → buttons
- [ ] Search - input → buttons → results
- [ ] Modal - title → form → buttons
- [ ] Menu - trigger → menu items

---

### Test 14: Input Field Navigation

1. Tab to input fields
2. Verify:
   - Focus indicator visible
   - Can type
   - Tab to next element
   - Tab order makes sense

---

### Test 15: Form Keyboard Navigation

1. Create test form with inputs
2. Tab through all fields
3. Use keyboard only (no mouse)
4. Verify:
   - Can complete entire form with keyboard
   - Tab order logical
   - Submit works with Enter

---

## Success Criteria

- [ ] TypeScript compiles without errors
- [ ] Skip link component created and visible when focused
- [ ] All interactive elements focusable with Tab
- [ ] Focus order is logical and intuitive
- [ ] Focus indicators visible (2px blue outline)
- [ ] All buttons work with Enter and Space keys
- [ ] Modals close with Escape key
- [ ] Focus trapped in open modals
- [ ] Focus returns to trigger when modal closes
- [ ] Menus navigable with arrow keys
- [ ] Form elements navigable with Tab
- [ ] No keyboard traps
- [ ] useFocusManagement hook works
- [ ] Modal component supports focus trapping
- [ ] Menu component supports arrow navigation
- [ ] Focus styles work in high contrast mode

---

## Next Steps

Once this build is verified, the app has full accessibility support for keyboard navigation. Consider documenting keyboard shortcuts and continuing with other accessibility improvements.
