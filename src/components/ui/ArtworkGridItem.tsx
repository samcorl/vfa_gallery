import { Link } from 'react-router-dom'

interface ArtworkGridItemProps {
  artwork: {
    id: string
    slug?: string
    title: string
    thumbnailUrl: string
    category?: string | null
    artist?: {
      username: string
      displayName: string | null
    }
  }
  linkTo?: string
}

export default function ArtworkGridItem({ artwork, linkTo }: ArtworkGridItemProps) {
  const content = (
    <>
      <div className="aspect-square rounded-lg overflow-hidden bg-gray-100">
        <img
          src={artwork.thumbnailUrl}
          alt={artwork.title}
          className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
          loading="lazy"
        />
      </div>
      <div className="mt-2">
        <h3 className="text-sm font-medium text-gray-900 truncate">{artwork.title}</h3>
        {artwork.artist && (
          <p className="text-xs text-gray-500">{artwork.artist.displayName || artwork.artist.username}</p>
        )}
      </div>
    </>
  )

  if (linkTo) {
    return (
      <Link to={linkTo} className="group block">
        {content}
      </Link>
    )
  }

  return <div className="group block">{content}</div>
}
