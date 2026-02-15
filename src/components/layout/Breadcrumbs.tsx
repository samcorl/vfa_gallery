import { Link, useLocation } from 'react-router-dom'
import { useMemo } from 'react'

interface Breadcrumb {
  label: string
  path: string
}

export default function Breadcrumbs() {
  const location = useLocation()

  const breadcrumbs = useMemo(() => {
    const paths = location.pathname.split('/').filter(Boolean)

    if (paths.length <= 1) {
      return []
    }

    const crumbs: Breadcrumb[] = [{ label: 'Home', path: '/' }]
    const segments = paths.slice()
    let currentPath = ''

    // Handle known routes
    if (location.pathname.startsWith('/profile')) {
      crumbs.push({ label: 'Profile', path: '/profile' })
      if (segments[1]) {
        currentPath = `/profile/${segments[1]}`
        const label = segments[1].charAt(0).toUpperCase() + segments[1].slice(1)
        crumbs.push({ label, path: currentPath })
      }
    } else if (location.pathname.startsWith('/browse')) {
      crumbs.push({ label: 'Browse', path: '/browse' })
    } else if (location.pathname.startsWith('/search')) {
      crumbs.push({ label: 'Search', path: '/search' })
    } else if (location.pathname.startsWith('/admin')) {
      crumbs.push({ label: 'Admin', path: '/admin' })
      if (segments[1]) {
        currentPath = `/admin/${segments[1]}`
        const label = segments[1].charAt(0).toUpperCase() + segments[1].slice(1)
        crumbs.push({ label, path: currentPath })
      }
    } else if (location.pathname.startsWith('/groups/')) {
      crumbs.push({ label: 'Groups', path: '/groups' })
      if (segments[1]) {
        crumbs.push({ label: decodeURIComponent(segments[1]), path: `/groups/${segments[1]}` })
      }
    } else if (segments[0] && !['browse', 'search', 'profile', 'admin', 'groups'].includes(segments[0])) {
      // Artist routes: /:artist/:gallery/:collection/:artwork
      currentPath = `/${segments[0]}`
      crumbs.push({ label: decodeURIComponent(segments[0]), path: currentPath })

      if (segments[1]) {
        currentPath = `/${segments[0]}/${segments[1]}`
        crumbs.push({ label: decodeURIComponent(segments[1]), path: currentPath })

        if (segments[2]) {
          currentPath = `/${segments[0]}/${segments[1]}/${segments[2]}`
          crumbs.push({ label: decodeURIComponent(segments[2]), path: currentPath })

          if (segments[3]) {
            currentPath = `/${segments[0]}/${segments[1]}/${segments[2]}/${segments[3]}`
            crumbs.push({ label: decodeURIComponent(segments[3]), path: currentPath })
          }
        }
      }
    }

    return crumbs
  }, [location.pathname])

  if (breadcrumbs.length <= 1) {
    return null
  }

  return (
    <nav className="hidden md:block px-6 py-3 border-b border-gray-100 bg-gray-50 sticky top-16 z-30">
      <ol className="flex items-center gap-2 text-sm">
        {breadcrumbs.map((crumb, index) => (
          <li key={crumb.path} className="flex items-center gap-2">
            {index > 0 && <span className="text-gray-400">/</span>}
            {index === breadcrumbs.length - 1 ? (
              <span className="text-gray-700 font-medium">{crumb.label}</span>
            ) : (
              <Link
                to={crumb.path}
                className="text-blue-600 hover:text-blue-700 hover:underline transition-colors"
              >
                {crumb.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}
