# Build 29: React Error Boundary

## Goal
Create error boundary class component that catches React errors and displays fallback UI with retry functionality, improving app stability and user experience during unexpected failures.

## Spec Extract

From **04-UI-UX-SPEC.md**:
- Error handling for graceful degradation
- User-friendly error messages
- Ability to recover from errors

## Prerequisites
- **24-REACT-ROUTER-SETUP.md** - Router configured

## Steps

### 1. Create Error Fallback Component

Create **src/components/ErrorFallback.tsx**:

```typescript
interface ErrorFallbackProps {
  error: Error;
  resetErrorBoundary: () => void;
}

export default function ErrorFallback({ error, resetErrorBoundary }: ErrorFallbackProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        {/* Error Icon */}
        <div className="mb-4 text-6xl">⚠️</div>

        {/* Heading */}
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Something went wrong</h1>

        {/* Description */}
        <p className="text-gray-600 mb-6">
          We encountered an unexpected error. Please try again or contact support if the problem persists.
        </p>

        {/* Error Details (only in development) */}
        {process.env.NODE_ENV === 'development' && (
          <details className="mb-6 text-left bg-gray-100 p-4 rounded text-xs text-gray-700 overflow-auto max-h-40">
            <summary className="font-semibold cursor-pointer mb-2">Error details</summary>
            <pre className="whitespace-pre-wrap break-words">{error.toString()}</pre>
          </details>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col gap-3">
          <button
            onClick={resetErrorBoundary}
            className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Try Again
          </button>

          <a
            href="/"
            className="w-full px-4 py-3 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 transition-colors font-medium text-center"
          >
            Go to Homepage
          </a>
        </div>

        {/* Support Info */}
        <p className="mt-6 text-xs text-gray-500">
          If this continues, please contact{' '}
          <a href="mailto:support@vfa.gallery" className="text-blue-600 hover:underline">
            support@vfa.gallery
          </a>
        </p>
      </div>
    </div>
  );
}
```

### 2. Create Error Boundary Class Component

Create **src/components/ErrorBoundary.tsx**:

```typescript
import React, { ReactNode, ErrorInfo } from 'react';
import ErrorFallback from './ErrorFallback';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary Component
 * Catches JavaScript errors anywhere in child component tree,
 * logs those errors, and displays a fallback UI
 */
export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  /**
   * Update state so the next render will show the fallback UI
   */
  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  /**
   * Log error details for debugging and monitoring
   */
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Error Boundary caught an error:');
      console.error(error);
      console.error('Error Info:', errorInfo);
    }

    // TODO: Send to error tracking service in production
    // Example: Sentry, LogRocket, Bugsnag, etc.
    // if (process.env.NODE_ENV === 'production') {
    //   reportErrorToService(error, errorInfo);
    // }
  }

  /**
   * Reset error boundary state
   */
  resetError = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      return <ErrorFallback error={this.state.error} resetErrorBoundary={this.resetError} />;
    }

    return this.props.children;
  }
}
```

### 3. Wrap App with Error Boundary

Update **src/App.tsx**:

```typescript
import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { ToastContainer } from './components/ui/ToastContainer';
import ErrorBoundary from './components/ErrorBoundary';
import './App.css';

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ToastProvider>
          <RouterProvider router={router} />
          <ToastContainer />
        </ToastProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
```

### 4. Create Test Error Component (Optional)

Create **src/components/ErrorTester.tsx** (for testing/documentation):

```typescript
import { useState } from 'react';

/**
 * Component that intentionally throws an error
 * Used to test the Error Boundary during development
 */
function BuggyComponent() {
  throw new Error('This is a test error from BuggyComponent');
}

export function ErrorTester() {
  const [showError, setShowError] = useState(false);

  if (showError) {
    return <BuggyComponent />;
  }

  return (
    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
      <p className="text-sm text-gray-700 mb-3">
        <strong>Error Boundary Tester:</strong> Click the button below to test the error boundary.
      </p>
      <button
        onClick={() => setShowError(true)}
        className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-sm font-medium"
      >
        Trigger Error (Test Only)
      </button>
    </div>
  );
}
```

## Files to Create/Modify

### Create:
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/ErrorFallback.tsx`
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/ErrorBoundary.tsx`
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/ErrorTester.tsx` (optional, for testing)

### Modify:
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/App.tsx`

## Verification

### 1. Test Error Boundary Wrapping

Verify **src/App.tsx** has ErrorBoundary as the outermost wrapper:

```typescript
export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        {/* ... rest of providers ... */}
      </AuthProvider>
    </ErrorBoundary>
  );
}
```

### 2. Test Component Compilation

```bash
npm run dev
```

- App compiles without errors
- No console errors on page load
- ErrorBoundary and ErrorFallback render correctly

### 3. Test Error Catching in Development

Add ErrorTester to **src/pages/HomePage.tsx** temporarily:

```typescript
import { ErrorTester } from '../components/ErrorTester';

export default function HomePage() {
  return (
    <div className="p-4">
      <h1 className="text-3xl font-bold">Home</h1>
      <div className="mt-6">
        <ErrorTester />
      </div>
    </div>
  );
}
```

Now test:
1. Click "Trigger Error" button
2. Error is caught by Error Boundary
3. ErrorFallback UI displays with:
   - Warning icon
   - "Something went wrong" message
   - Error details in expandable section (development only)
   - "Try Again" button
   - "Go to Homepage" link

### 4. Test Try Again Button

1. Error is displayed
2. Click "Try Again" button
3. ErrorBoundary resets
4. App returns to normal state
5. ErrorTester component is visible again

### 5. Test Homepage Link

1. Error is displayed
2. Click "Go to Homepage" link
3. Navigate to home page
4. Error boundary is reset
5. App works normally

### 6. Test Production Behavior

Build the app:
```bash
npm run build
npm run preview
```

Access the app:
1. Error details should NOT be shown in production
2. Only user-friendly error message displays
3. Support email address is visible

### 7. Test Error in Nested Component

Create **src/components/ProblematicComponent.tsx**:

```typescript
export default function ProblematicComponent() {
  // Simulate an error that occurs during render
  const data = null;
  return <div>{data.property}</div>; // Will throw error
}
```

Add to HomePage:
```typescript
import ProblematicComponent from '../components/ProblematicComponent';

export default function HomePage() {
  return (
    <div className="p-4">
      <h1>Home</h1>
      <ProblematicComponent /> {/* Should be caught */}
    </div>
  );
}
```

Verify:
- Error is caught by Error Boundary
- Fallback UI is shown
- Error doesn't crash entire app

### 8. Test TypeScript Compilation

```bash
npx tsc --noEmit
```

- No TypeScript errors in strict mode
- React.Component type is correct
- Props and State interfaces are valid

### 9. Verify Error Logging

Open DevTools Console with error displayed:
- Error message is logged in development
- Stack trace is visible
- Component that threw error is identified

### 10. Test Error Details Display

**Development mode:**
1. Trigger error
2. Click "Error details" to expand
3. Error message and stack trace display correctly

**Production mode:**
1. Error details are hidden
2. Generic message shown instead

## Success Criteria
- ErrorBoundary is a valid React class component
- Error Fallback renders correctly when error occurs
- Errors are caught and don't crash the app
- "Try Again" button resets the boundary
- "Go to Homepage" link navigates correctly
- Error details show in development only
- Support email is visible in fallback UI
- TypeScript compilation succeeds in strict mode
- Error logging works in console during development
- Component is properly positioned as outermost wrapper
- Errors in nested components are caught
- Styling is responsive and user-friendly
