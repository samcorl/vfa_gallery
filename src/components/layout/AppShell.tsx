import { Outlet } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import TopNav from './TopNav'
import BottomNav from './BottomNav'
import Breadcrumbs from './Breadcrumbs'

export default function AppShell() {
  const { isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-blue-600" />
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <TopNav />
      <Breadcrumbs />
      <main className="flex-1 pb-20 md:pb-0">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}
