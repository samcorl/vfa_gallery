import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { Home, Search, Upload, User } from 'lucide-react'

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
}

export default function BottomNav() {
  const { isAuthenticated, login } = useAuth()
  const location = useLocation()

  const navItems: NavItem[] = [
    { label: 'Home', href: '/', icon: <Home size={20} /> },
    { label: 'Search', href: '/search', icon: <Search size={20} /> },
    ...(isAuthenticated
      ? [{ label: 'Upload', href: '/profile/artworks/upload', icon: <Upload size={20} /> }]
      : []),
    { label: 'Profile', href: isAuthenticated ? '/profile' : '#login', icon: <User size={20} /> },
  ]

  const isActive = (href: string) => {
    if (href === '#login') return false
    return location.pathname === href || location.pathname.startsWith(href + '/')
  }

  const handleProfileClick = (e: React.MouseEvent, href: string) => {
    if (href === '#login') {
      e.preventDefault()
      login()
    }
  }

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40 safe-area-pb">
      <div className="flex justify-around items-center">
        {navItems.map((item) => (
          <Link
            key={item.label}
            to={item.href === '#login' ? '#' : item.href}
            onClick={(e) => handleProfileClick(e, item.href)}
            className={`flex flex-col items-center justify-center flex-1 py-3 gap-1 transition-colors ${
              isActive(item.href)
                ? 'text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {item.icon}
            <span className="text-xs font-medium">{item.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  )
}
