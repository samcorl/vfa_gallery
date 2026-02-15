/**
 * Artwork data matching our API response format (camelCase)
 */
export interface Artwork {
  id: string
  userId: string
  slug: string
  title: string
  description: string | null
  materials: string | null
  dimensions: string | null
  createdDate: string | null
  category: string
  tags: string[]
  imageKey: string
  thumbnailUrl: string
  iconUrl: string
  displayUrl: string
  isPublic: boolean
  status: 'active' | 'draft' | 'deleted'
  isFeatured: boolean
  createdAt: string
  updatedAt: string
}

/**
 * Paginated artworks API response
 */
export interface PaginatedArtworks {
  data: Artwork[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}
