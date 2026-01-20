# 78-UI-PUBLIC-ARTIST.md

## Goal
Create the public artist profile page at `/:artist` that displays an artist's profile information, bio, social links, and links to their galleries. This page is publicly accessible and shows a compelling artist portfolio overview.

---

## Spec Extract

From TECHNICAL-SPEC.md:
- **Route:** `/:artist` (where artist is username)
- **Public Access:** No authentication required
- **Layout:** Hero section with avatar, name, bio, website, socials
- **Display:** Avatar (circular, large), displayName, username, bio (multiline), website link
- **Socials:** Show available social links (Instagram, Twitter, TikTok, YouTube, Bluesky, Threads)
- **Gallery Grid:** Display artist's galleries below
- **Error handling:** Show 404 gracefully if artist not found
- **Responsive:** Mobile-first design

---

## Prerequisites

**Must complete before starting:**
- **76-API-PUBLIC-USER.md** - Public user profile endpoint
- **77-API-PUBLIC-USER-GALLERIES.md** - Public galleries list endpoint
- **24-REACT-ROUTER-SETUP.md** - React Router configured for dynamic routes

**Reason:** Need public API endpoints to fetch data and routing infrastructure.

---

## Steps

### Step 1: Create Avatar Component for Public Display

Create a reusable avatar component for public profiles.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/public/PublicAvatar.tsx`

```typescript
import React from 'react'

interface PublicAvatarProps {
  avatarUrl: string | null
  displayName: string | null
  username: string
  size?: 'sm' | 'md' | 'lg'
}

/**
 * Get initials from display name for fallback
 */
function getInitials(displayName: string | null, username: string): string {
  if (displayName) {
    return displayName
      .split(' ')
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase()
  }
  return username.substring(0, 2).toUpperCase()
}

const sizeClasses = {
  sm: 'w-20 h-20 text-sm',
  md: 'w-32 h-32 text-xl',
  lg: 'w-48 h-48 text-4xl',
}

export default function PublicAvatar({
  avatarUrl,
  displayName,
  username,
  size = 'md',
}: PublicAvatarProps) {
  const [imageError, setImageError] = React.useState(false)
  const initials = getInitials(displayName, username)

  return (
    <div className={`flex-shrink-0 rounded-full overflow-hidden ${sizeClasses[size]}`}>
      {avatarUrl && !imageError ? (
        <img
          src={avatarUrl}
          alt={displayName || username}
          className="w-full h-full object-cover bg-gray-200"
          onError={() => setImageError(true)}
        />
      ) : (
        <div className="w-full h-full rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold">
          {initials}
        </div>
      )}
    </div>
  )
}
```

**Explanation:**
- Supports three sizes: small, medium, large
- Falls back to initials if avatar URL missing or image fails to load
- Uses gradient background for initials fallback
- Handles image load errors gracefully

---

### Step 2: Create Social Links Component

Display social media links for the artist.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/public/SocialLinks.tsx`

```typescript
import React from 'react'

interface Socials {
  instagram: string | null
  twitter: string | null
  tiktok: string | null
  youtube: string | null
  bluesky: string | null
  threads: string | null
}

interface SocialLinksProps {
  socials: Socials
  className?: string
}

const SOCIAL_PLATFORMS = [
  {
    key: 'instagram' as const,
    label: 'Instagram',
    icon: '📷',
    baseUrl: 'https://instagram.com',
  },
  {
    key: 'twitter' as const,
    label: 'Twitter/X',
    icon: '𝕏',
    baseUrl: 'https://twitter.com',
  },
  {
    key: 'tiktok' as const,
    label: 'TikTok',
    icon: '🎵',
    baseUrl: 'https://tiktok.com/@',
  },
  {
    key: 'youtube' as const,
    label: 'YouTube',
    icon: '▶️',
    baseUrl: 'https://youtube.com/@',
  },
  {
    key: 'bluesky' as const,
    label: 'Bluesky',
    icon: '🦋',
    baseUrl: 'https://bsky.app/profile',
  },
  {
    key: 'threads' as const,
    label: 'Threads',
    icon: '🧵',
    baseUrl: 'https://threads.net/@',
  },
]

export default function SocialLinks({
  socials,
  className = '',
}: SocialLinksProps) {
  const activeSocials = SOCIAL_PLATFORMS.filter(
    (platform) => socials[platform.key]
  )

  if (activeSocials.length === 0) {
    return null
  }

  return (
    <div className={`flex gap-3 flex-wrap ${className}`}>
      {activeSocials.map((platform) => {
        const handle = socials[platform.key]
        if (!handle) return null

        // Build URL based on platform
        let url = platform.baseUrl
        if (platform.key === 'bluesky') {
          url = `${url}/${handle}`
        } else if (['tiktok', 'youtube', 'threads'].includes(platform.key)) {
          url = `${url}${handle}`
        } else {
          url = `${url}/${handle}`
        }

        return (
          <a
            key={platform.key}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            title={`${platform.label}: ${handle}`}
            className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-gray-200 hover:bg-gray-300 transition-colors"
          >
            <span className="text-lg">{platform.icon}</span>
          </a>
        )
      })}
    </div>
  )
}
```

**Explanation:**
- Maps socials array to clickable platform links
- Handles different URL patterns for each platform
- Returns null if no socials available
- Opens links in new tab with security headers

---

### Step 3: Create Public Artist Profile Page

Create the main artist profile page component.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/pages/PublicArtist.tsx`

```typescript
import React, { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import PublicAvatar from '../components/public/PublicAvatar'
import SocialLinks from '../components/public/SocialLinks'
import ErrorBoundary from '../components/error/ErrorBoundary'

interface ArtistProfile {
  username: string
  displayName: string | null
  avatarUrl: string | null
  bio: string | null
  website: string | null
  socials: {
    instagram: string | null
    twitter: string | null
    tiktok: string | null
    youtube: string | null
    bluesky: string | null
    threads: string | null
  }
  galleriesCount: number
  artworksCount: number
}

export default function PublicArtist() {
  const { artist } = useParams<{ artist: string }>()
  const [profile, setProfile] = useState<ArtistProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!artist) {
      setError('Artist username is required')
      setLoading(false)
      return
    }

    const fetchProfile = async () => {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch(`/api/users/${encodeURIComponent(artist)}`)

        if (!response.ok) {
          if (response.status === 404) {
            setError(`Artist '${artist}' not found`)
          } else {
            setError('Failed to load artist profile')
          }
          setProfile(null)
          return
        }

        const data = await response.json()
        setProfile(data.data)
      } catch (err) {
        console.error('Error fetching artist profile:', err)
        setError('Failed to load artist profile')
        setProfile(null)
      } finally {
        setLoading(false)
      }
    }

    fetchProfile()
  }, [artist])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          <p className="mt-4 text-gray-600">Loading artist profile...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">404</h1>
          <p className="text-lg text-gray-600 mb-8">{error}</p>
          <Link
            to="/"
            className="inline-block px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            Back to Home
          </Link>
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">Artist profile not found</p>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50">
        {/* Hero Section */}
        <div className="bg-white border-b">
          <div className="max-w-4xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row gap-8 items-start">
              {/* Avatar */}
              <PublicAvatar
                avatarUrl={profile.avatarUrl}
                displayName={profile.displayName}
                username={profile.username}
                size="lg"
              />

              {/* Profile Info */}
              <div className="flex-1">
                {/* Name and Username */}
                <div className="mb-4">
                  <h1 className="text-4xl font-bold text-gray-900">
                    {profile.displayName || profile.username}
                  </h1>
                  <p className="text-lg text-gray-600">@{profile.username}</p>
                </div>

                {/* Bio */}
                {profile.bio && (
                  <p className="text-gray-700 mb-6 text-lg leading-relaxed">
                    {profile.bio}
                  </p>
                )}

                {/* Website */}
                {profile.website && (
                  <p className="mb-6">
                    <a
                      href={profile.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:underline flex items-center gap-2"
                    >
                      <span>🔗</span>
                      {profile.website.replace(/^https?:\/\/(www\.)?/, '')}
                    </a>
                  </p>
                )}

                {/* Social Links */}
                <SocialLinks socials={profile.socials} className="mb-8" />

                {/* Stats */}
                <div className="flex gap-8">
                  <div>
                    <p className="text-2xl font-bold text-gray-900">
                      {profile.galleriesCount}
                    </p>
                    <p className="text-gray-600">
                      {profile.galleriesCount === 1 ? 'Gallery' : 'Galleries'}
                    </p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">
                      {profile.artworksCount}
                    </p>
                    <p className="text-gray-600">
                      {profile.artworksCount === 1 ? 'Artwork' : 'Artworks'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Galleries Section */}
        <div className="max-w-4xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-8">Galleries</h2>
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <p className="text-gray-600 mb-4">
              Gallery list will be displayed here
            </p>
            <Link
              to={`/${artist}`}
              className="text-blue-500 hover:underline"
            >
              View all galleries
            </Link>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  )
}
```

**Explanation:**
- Fetches artist profile from `/api/users/:artist` endpoint
- Shows loading spinner while fetching
- Shows 404 error message if artist not found
- Displays hero section with avatar and profile info
- Shows social links and statistics
- Responsive design: stacked on mobile, side-by-side on desktop
- Error boundary wraps component for safety

---

### Step 4: Register Route in React Router

Add the public artist route to the React Router configuration.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/pages/index.tsx` (or wherever routes are defined)

Add this import:

```typescript
import PublicArtist from './PublicArtist'
```

Add this route definition:

```typescript
{
  path: '/:artist',
  element: <PublicArtist />,
  errorElement: <ErrorPage />,
},
```

This should be added AFTER any more specific routes but BEFORE the catch-all route (if one exists).

**Example complete routes:**

```typescript
const routes = [
  // Public routes
  {
    path: '/',
    element: <Home />,
  },
  {
    path: '/:artist',
    element: <PublicArtist />,
    errorElement: <ErrorPage />,
  },
  // Protected routes would come here (login required)
  // Catch-all 404
  {
    path: '*',
    element: <NotFound />,
  },
]
```

**Explanation:**
- Route matches any single path segment (the artist username)
- `:artist` parameter is extracted from URL
- Rendered at the app's main level

---

### Step 5: Create 404 Error Page Component

Create a graceful error page for missing artists.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/error/ErrorPage.tsx`

```typescript
import { useRouteError, Link } from 'react-router-dom'

export default function ErrorPage() {
  const error = useRouteError() as any

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <h1 className="text-6xl font-bold text-gray-900 mb-4">
          {error?.status || '404'}
        </h1>
        <p className="text-xl text-gray-600 mb-2">
          {error?.statusText || 'Page not found'}
        </p>
        <p className="text-gray-500 mb-8">
          {error?.message || 'The page you are looking for does not exist.'}
        </p>
        <Link
          to="/"
          className="inline-block px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          Back to Home
        </Link>
      </div>
    </div>
  )
}
```

---

## Files to Create/Modify

**New files to create:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/public/PublicAvatar.tsx`
2. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/public/SocialLinks.tsx`
3. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/pages/PublicArtist.tsx`
4. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/error/ErrorPage.tsx`

**Files to modify:**
1. React Router configuration file - Add `/:artist` route

---

## Verification

### Test 1: Navigate to Artist Profile

Visit in browser:
```
http://localhost:5173/testuser
```

Expected:
- Page loads with artist profile information
- Avatar displays (or initials fallback)
- Name, username, bio are visible
- Social links are displayed and clickable
- Statistics show (galleries count, artworks count)

---

### Test 2: Verify 404 for Non-Existent Artist

```
http://localhost:5173/nonexistentartist
```

Expected:
- Shows 404 error message
- Shows "Back to Home" link
- No profile data displayed

---

### Test 3: Verify Social Links Are Clickable

Click each social link icon:
- Verify correct URL opens in new tab
- Example: Instagram link should go to `https://instagram.com/<handle>`

---

### Test 4: Verify Responsive Design

Test on mobile viewport:
- Avatar and name stack vertically
- All content is readable
- Social links wrap appropriately

Test on desktop viewport:
- Avatar and name appear side-by-side
- Layout is balanced

---

### Test 5: Verify Website Link Works

If artist has website:
- Click website link
- Should open in new tab
- Should display domain without protocol

---

### Test 6: Verify Loading State

- Check network tab in browser dev tools
- Slow down network to 3G
- Verify loading spinner shows during fetch
- Verify profile loads correctly after data arrives

---

### Test 7: Verify Data Is Fresh

Navigate to artist profile multiple times:
- First visit fetches from API
- Changes API data manually
- Refresh page and verify new data appears

---

## Summary

This build creates the public artist profile page:
- Beautiful hero section with avatar and basic info
- Social links with proper URL formatting
- Gallery and artwork statistics
- 404 handling for missing artists
- Fully responsive mobile and desktop design
- Error boundary protection
- Foundation for viewing artist portfolios publicly

---

**Next step:** Proceed to **79-UI-PUBLIC-ARTIST-GALLERIES.md** to create the galleries grid component for the artist profile page.
