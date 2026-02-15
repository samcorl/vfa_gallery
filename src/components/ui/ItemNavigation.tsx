import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight } from 'lucide-react'

interface NavItem {
  slug: string
  title: string
  thumbnailUrl?: string
}

interface ItemNavigationProps {
  previous: NavItem | null
  next: NavItem | null
  basePath: string
  previousLabel?: string
  nextLabel?: string
  keyboardHint?: string
}

export default function ItemNavigation({
  previous,
  next,
  basePath,
  previousLabel = 'Previous',
  nextLabel = 'Next',
  keyboardHint = 'Use arrow keys to navigate',
}: ItemNavigationProps) {
  if (!previous && !next) return null

  return (
    <div className="border-t border-gray-200 pt-8 mt-8">
      <div className="flex items-center justify-between">
        {previous ? (
          <Link
            to={`${basePath}/${previous.slug}`}
            className="flex items-center gap-3 text-gray-600 hover:text-gray-900 transition group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            {previous.thumbnailUrl && (
              <img
                src={previous.thumbnailUrl}
                alt={previous.title}
                className="w-12 h-12 rounded object-cover bg-gray-200 hidden sm:block"
              />
            )}
            <div>
              <p className="text-xs text-gray-400">{previousLabel}</p>
              <p className="text-sm font-medium">{previous.title}</p>
            </div>
          </Link>
        ) : (
          <div />
        )}

        {next ? (
          <Link
            to={`${basePath}/${next.slug}`}
            className="flex items-center gap-3 text-gray-600 hover:text-gray-900 transition group text-right"
          >
            <div>
              <p className="text-xs text-gray-400">{nextLabel}</p>
              <p className="text-sm font-medium">{next.title}</p>
            </div>
            {next.thumbnailUrl && (
              <img
                src={next.thumbnailUrl}
                alt={next.title}
                className="w-12 h-12 rounded object-cover bg-gray-200 hidden sm:block"
              />
            )}
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        ) : (
          <div />
        )}
      </div>
      <p className="text-xs text-gray-400 text-center mt-4">{keyboardHint}</p>
    </div>
  )
}
