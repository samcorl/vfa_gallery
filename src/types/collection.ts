export interface Collection {
  id: string
  galleryId: string
  slug: string
  name: string
  description: string | null
  heroImageUrl: string | null
  themeId: string | null
  isDefault: boolean
  status: 'active' | 'archived' | 'draft'
  artworkCount: number
  createdAt: string
  updatedAt: string
}

export interface CollectionArtwork {
  position: number
  addedAt: string
  id: string
  slug: string
  title: string
  description: string | null
  imageKey: string
  thumbnailUrl: string
  iconUrl: string
  displayUrl: string
  createdAt: string
}

export interface CollectionDetail extends Omit<Collection, 'artworkCount'> {
  artworks: CollectionArtwork[]
  theme: {
    id: string
    name: string
    config: Record<string, unknown>
  } | null
}

export interface PaginatedCollections {
  data: Collection[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}
