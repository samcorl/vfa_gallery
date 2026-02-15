import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

export default function TopNav() {
  const { user, isAuthenticated, login, logout } = useAuth()
  const location = useLocation()

  const navItems = [
    { label: 'Home', href: '/' },
    { label: 'Browse', href: '/browse' },
    { label: 'Search', href: '/search' },
  ]

  const isActive = (href: string) => location.pathname === href

  return (
    <nav className="hidden md:flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white sticky top-0 z-40">
      <Link to="/" className="text-2xl font-bold text-blue-600 mr-8">
        VFA.gallery
      </Link>

      <div className="flex gap-6">
        {navItems.map((item) => (
          <Link
            key={item.href}
            to={item.href}
            className={`px-3 py-2 rounded-lg transition-colors ${
              isActive(item.href)
                ? 'bg-blue-100 text-blue-600 font-semibold'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            {item.label}
          </Link>
        ))}
      </div>

      <div className="flex items-center gap-4">
        {isAuthenticated && (
          <Link
            to="/profile/artworks/upload"
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            Upload
          </Link>
        )}

        {isAuthenticated ? (
          <div className="flex items-center gap-4">
            <Link to="/profile" className="text-gray-700 hover:text-blue-600 transition-colors">
              {user?.displayName || user?.username}
            </Link>
            <button
              onClick={logout}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Logout
            </button>
          </div>
        ) : (
          <button
            onClick={login}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Sign In
          </button>
        )}
      </div>
    </nav>
  )
}
