import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { LoadingSpinner } from './ui/LoadingSpinner'

interface AdminRouteProps {
  children: ReactNode
}

export default function AdminRoute({ children }: AdminRouteProps) {
  const { user, isLoading, isAuthenticated } = useAuth()

  if (isLoading) {
    return <LoadingSpinner message="Checking permissions..." />
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />
  }

  if (user?.role !== 'admin') {
    console.warn(`Access denied: User role '${user?.role}' is not 'admin'`)
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
