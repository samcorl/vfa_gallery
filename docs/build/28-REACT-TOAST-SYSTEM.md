# Build 28: React Toast System

## Goal
Create reusable toast notification system with context provider and useToast hook supporting success, error, and info messages with auto-dismiss and responsive positioning.

## Spec Extract

From **04-UI-UX-SPEC.md**:
- Toast notifications for user feedback
- Success (green): "Artwork uploaded!"
- Error (red): "Upload failed. Try again."
- Info (blue): "Saving..."
- Auto-dismiss after 3 seconds
- Mobile: bottom-center, Desktop: bottom-right
- Fixed positioning visible during scroll

## Prerequisites
- **24-REACT-ROUTER-SETUP.md** - Router configured

## Steps

### 1. Create Toast Types

Create **src/types/toast.ts**:

```typescript
export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number; // milliseconds, 0 = permanent
}

export interface ToastContextType {
  toasts: Toast[];
  success: (message: string, duration?: number) => string;
  error: (message: string, duration?: number) => string;
  info: (message: string, duration?: number) => string;
  warning: (message: string, duration?: number) => string;
  dismiss: (id: string) => void;
  dismissAll: () => void;
}
```

### 2. Create Toast Context

Create **src/contexts/ToastContext.tsx**:

```typescript
import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { Toast, ToastContextType, ToastType } from '../types/toast';

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Generate unique ID for each toast
  const generateId = useCallback(() => {
    return `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  // Add toast and auto-dismiss if duration is set
  const addToast = useCallback(
    (message: string, type: ToastType, duration: number = 3000): string => {
      const id = generateId();
      const toast: Toast = { id, message, type, duration };

      setToasts((prev) => [...prev, toast]);

      // Auto-dismiss after duration (unless duration is 0)
      if (duration > 0) {
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== id));
        }, duration);
      }

      return id;
    },
    [generateId]
  );

  const success = useCallback(
    (message: string, duration?: number) => addToast(message, 'success', duration),
    [addToast]
  );

  const error = useCallback(
    (message: string, duration?: number) => addToast(message, 'error', duration),
    [addToast]
  );

  const info = useCallback(
    (message: string, duration?: number) => addToast(message, 'info', duration),
    [addToast]
  );

  const warning = useCallback(
    (message: string, duration?: number) => addToast(message, 'warning', duration),
    [addToast]
  );

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const dismissAll = useCallback(() => {
    setToasts([]);
  }, []);

  const value: ToastContextType = {
    toasts,
    success,
    error,
    info,
    warning,
    dismiss,
    dismissAll,
  };

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToast(): ToastContextType {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}
```

### 3. Create Toast Component

Create **src/components/ui/Toast.tsx**:

```typescript
import { useEffect, useState } from 'react';
import { Toast as ToastType } from '../../types/toast';
import { useToast } from '../../contexts/ToastContext';

interface ToastProps {
  toast: ToastType;
}

export function Toast({ toast }: ToastProps) {
  const { dismiss } = useToast();
  const [isExiting, setIsExiting] = useState(false);

  const typeConfig = {
    success: {
      bgColor: 'bg-green-500',
      icon: '✓',
      textColor: 'text-white',
    },
    error: {
      bgColor: 'bg-red-500',
      icon: '✕',
      textColor: 'text-white',
    },
    info: {
      bgColor: 'bg-blue-500',
      icon: 'ⓘ',
      textColor: 'text-white',
    },
    warning: {
      bgColor: 'bg-yellow-500',
      icon: '⚠',
      textColor: 'text-white',
    },
  };

  const config = typeConfig[toast.type];

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => {
      dismiss(toast.id);
    }, 300); // Match animation duration
  };

  // Auto-dismiss progress bar
  useEffect(() => {
    if (toast.duration && toast.duration > 0) {
      const timer = setTimeout(() => {
        setIsExiting(true);
      }, toast.duration - 300); // Start fade 300ms before actual dismiss
      return () => clearTimeout(timer);
    }
  }, [toast.duration, toast.id]);

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg transition-all duration-300 ${
        config.bgColor
      } ${config.textColor} ${isExiting ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'}`}
      role="alert"
      aria-live="polite"
    >
      {/* Icon */}
      <span className="flex-shrink-0 font-bold text-lg">{config.icon}</span>

      {/* Message */}
      <span className="flex-1 text-sm font-medium">{toast.message}</span>

      {/* Close button */}
      <button
        onClick={handleClose}
        className="flex-shrink-0 ml-2 text-lg hover:opacity-75 transition-opacity"
        aria-label="Close notification"
      >
        ×
      </button>
    </div>
  );
}
```

### 4. Create Toast Container Component

Create **src/components/ui/ToastContainer.tsx**:

```typescript
import { useToast } from '../../contexts/ToastContext';
import { Toast } from './Toast';

export function ToastContainer() {
  const { toasts } = useToast();

  return (
    <div
      className="fixed z-50 pointer-events-none
        /* Mobile: bottom-center */
        bottom-4 left-1/2 -translate-x-1/2 w-full max-w-sm px-4
        /* Desktop: bottom-right */
        md:bottom-6 md:right-6 md:left-auto md:translate-x-0
        flex flex-col gap-3"
    >
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <Toast toast={toast} />
        </div>
      ))}
    </div>
  );
}
```

### 5. Update App to Include Toast Provider and Container

Update **src/App.tsx**:

```typescript
import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { ToastContainer } from './components/ui/ToastContainer';
import './App.css';

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <RouterProvider router={router} />
        <ToastContainer />
      </ToastProvider>
    </AuthProvider>
  );
}
```

### 6. Create Example/Test Component

Create **src/components/ToastExamples.tsx** (for testing/documentation):

```typescript
import { useToast } from '../contexts/ToastContext';

export function ToastExamples() {
  const { success, error, info, warning, dismissAll } = useToast();

  return (
    <div className="p-4 bg-gray-100 rounded-lg space-y-3">
      <p className="text-sm font-semibold text-gray-700 mb-4">Toast Examples:</p>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => success('Artwork uploaded successfully!')}
          className="px-3 py-2 bg-green-500 text-white rounded text-sm hover:bg-green-600 transition-colors"
        >
          Success
        </button>

        <button
          onClick={() => error('Upload failed. Try again.')}
          className="px-3 py-2 bg-red-500 text-white rounded text-sm hover:bg-red-600 transition-colors"
        >
          Error
        </button>

        <button
          onClick={() => info('Saving your changes...')}
          className="px-3 py-2 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 transition-colors"
        >
          Info
        </button>

        <button
          onClick={() => warning('Please check your input')}
          className="px-3 py-2 bg-yellow-500 text-white rounded text-sm hover:bg-yellow-600 transition-colors"
        >
          Warning
        </button>
      </div>

      <button
        onClick={dismissAll}
        className="w-full px-3 py-2 bg-gray-400 text-white rounded text-sm hover:bg-gray-500 transition-colors"
      >
        Dismiss All
      </button>
    </div>
  );
}
```

## Files to Create/Modify

### Create:
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/types/toast.ts`
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/contexts/ToastContext.tsx`
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/ui/Toast.tsx`
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/ui/ToastContainer.tsx`
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/ToastExamples.tsx` (optional, for testing)

### Modify:
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/App.tsx`

## Verification

### 1. Test Toast Display

Add ToastExamples temporarily to **src/pages/HomePage.tsx**:

```typescript
import { useAuth } from '../contexts/AuthContext';
import { ToastExamples } from '../components/ToastExamples';

export default function HomePage() {
  const { isLoading } = useAuth();

  if (isLoading) {
    return <div className="p-4">Loading...</div>;
  }

  return (
    <div className="p-4">
      <h1 className="text-3xl font-bold">Home</h1>
      <div className="mt-6">
        <ToastExamples />
      </div>
    </div>
  );
}
```

Run dev server:
```bash
npm run dev
```

### 2. Test Each Toast Type

1. Click "Success" button
   - Green toast appears at bottom-right (desktop) or bottom-center (mobile)
   - Shows checkmark icon
   - Displays "Artwork uploaded successfully!"
   - Auto-dismisses after 3 seconds

2. Click "Error" button
   - Red toast appears
   - Shows X icon
   - Displays error message
   - Auto-dismisses after 3 seconds

3. Click "Info" button
   - Blue toast appears
   - Shows info icon
   - Displays info message
   - Auto-dismisses after 3 seconds

4. Click "Warning" button
   - Yellow/amber toast appears
   - Shows warning icon
   - Displays warning message
   - Auto-dismisses after 3 seconds

### 3. Test Manual Dismiss

- Click X button on any toast
- Toast closes immediately with fade animation
- No error in console

### 4. Test Multiple Toasts

1. Click Success, Info, Error in quick succession
2. All 3 toasts stack vertically
3. Each dismisses after 3 seconds (or click X)
4. Others remain visible

### 5. Test Responsive Positioning

**Desktop (>640px):**
- Toasts appear at bottom-right
- Stay visible during scroll

**Mobile (<640px):**
- Toasts appear at bottom-center
- Stay visible during scroll
- Full width minus padding

### 6. Test useToast Hook

In any component:
```typescript
const { success, error } = useToast();

// This should work without errors
success('Test message');
error('Error message');
```

### 7. Test TypeScript

```bash
npx tsc --noEmit
```
- No TypeScript errors in strict mode

### 8. Test Accessibility

- Toast has `role="alert"` and `aria-live="polite"`
- Close button has `aria-label`
- Keyboard navigation works (Tab to close button, Enter to close)

## Success Criteria
- All 4 toast types (success, error, info, warning) display correctly
- Toasts show appropriate icons and colors
- Auto-dismiss works after 3 seconds
- Manual dismiss via X button works
- Multiple toasts stack vertically
- Responsive positioning works (bottom-right desktop, bottom-center mobile)
- Toasts remain visible during scroll
- useToast hook can be used in any component
- No TypeScript errors in strict mode
- Animations are smooth (fade in/out, translate)
- Accessibility features present (role, aria-live, aria-label)
