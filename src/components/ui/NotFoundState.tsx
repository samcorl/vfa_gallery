import { Link } from 'react-router-dom'

interface NotFoundLink {
  to: string
  label: string
}

interface NotFoundStateProps {
  title: string
  message: string
  links: NotFoundLink[]
}

export default function NotFoundState({ title, message, links }: NotFoundStateProps) {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-gray-900 mb-4">{title}</h1>
      <p className="text-gray-600 mb-8">{message}</p>
      <div className="flex gap-4">
        {links.map((link) => (
          <Link key={link.to} to={link.to} className="text-blue-600 hover:underline">
            {link.label}
          </Link>
        ))}
      </div>
    </div>
  )
}
