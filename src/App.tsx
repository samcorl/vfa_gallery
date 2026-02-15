import { RouterProvider } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { router } from './router'
import { AuthProvider } from './contexts/AuthContext'
import { ToastProvider } from './contexts/ToastContext'
import { ToastContainer } from './components/ui/ToastContainer'
import ErrorBoundary from './components/ErrorBoundary'

export default function App() {
  return (
    <ErrorBoundary>
      <HelmetProvider>
        <AuthProvider>
          <ToastProvider>
            <RouterProvider router={router} />
            <ToastContainer />
          </ToastProvider>
        </AuthProvider>
      </HelmetProvider>
    </ErrorBoundary>
  )
}
