import type { UserSocial } from './user'

export type UserRole = 'user' | 'admin'

export interface User {
  id: string
  email: string
  username: string
  displayName: string | null
  avatarUrl: string | null
  bio: string | null
  website: string | null
  phone: string | null
  socials: UserSocial[]
  status: string
  role: UserRole
  limits: {
    galleries: number
    collections: number
    artworks: number
    dailyUploads: number
  }
  createdAt: string
  updatedAt: string
  lastLoginAt: string | null
}

export interface AuthContextType {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  login: () => void
  logout: () => Promise<void>
}
