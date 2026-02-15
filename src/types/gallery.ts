export interface Gallery {
  id: string
  userId: string
  slug: string
  name: string
  description: string | null
  welcomeMessage: string | null
  themeId: string | null
  isDefault: boolean
  status: 'active' | 'archived' | 'draft'
  collectionCount: number
  createdAt: string
  updatedAt: string
}

export interface GalleryCollection {
  id: string
  galleryId: string
  slug: string
  name: string
  description: string | null
  artworkCount: number
  isDefault: boolean
  status: string
  createdAt: string
  updatedAt: string
}

export interface GalleryTheme {
  id: string
  name: string
  config: Record<string, unknown>
}

export interface GalleryDetail extends Omit<Gallery, 'collectionCount'> {
  collections: GalleryCollection[]
  theme: GalleryTheme | null
}

export interface PaginatedGalleries {
  data: Gallery[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}

export interface GalleryDeleteInfo {
  galleryId: string
  galleryName: string
  collectionCount: number
  artworkCount: number
  canDelete: boolean
  reason: string | null
}
