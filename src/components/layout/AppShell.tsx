import { Outlet } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import TopNav from './TopNav'
import BottomNav from './BottomNav'
import Breadcrumbs from './Breadcrumbs'
import { SkipLink } from '../a11y/SkipLink'

export default function AppShell() {
  const { isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen" role="status" aria-label="Loading application">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-blue-600" />
        <span className="sr-only">Loading...</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <SkipLink />
      <TopNav />
      <Breadcrumbs />
      <main id="main-content" className="flex-1 pb-20 md:pb-0" role="main">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}
