# Build 33: Profile Page Display

## Goal
Create the profile page at `/profile` that displays the current user's profile information including avatar, display name, username, bio, website, social links, and statistics about their galleries and artworks.

---

## Spec Extract

**UI Layout:**
- Hero section with user avatar (circular, 120px), display name, username
- Bio text (multi-line, supports markdown)
- Website link with icon (opens in new tab)
- Social links as icon buttons (Instagram, Twitter, TikTok, YouTube, Bluesky, Threads)
- Stats section: number of galleries, number of artworks
- Edit button (pencil icon) that links to `/profile/edit`
- Responsive: Single column mobile, optional sidebar on desktop

**Avatar Display:**
- Circular image, 120px diameter on mobile, 160px on desktop
- Fallback: Show user's initials (first letters of display name) in blue circle if no avatar
- Missing image: Graceful fallback to initials

**Social Icons:**
- Use standard platform colors/icons
- Non-interactive display (just show presence)
- Edit functionality on profile edit page

**Stats:**
- Gallery count fetched from API or aggregated
- Artwork count fetched from API or aggregated
- Display with icons and labels

---

## Prerequisites

**Must complete before starting:**
- **25-REACT-AUTH-CONTEXT.md** - Auth context and useAuth hook
- **30-API-USER-ME.md** - GET /api/auth/me endpoint returns user data with socials

**Reason:** Profile page displays authenticated user data from the API.

---

## Steps

### Step 1: Create Profile Avatar Component

This component handles avatar display with initials fallback.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/profile/ProfileAvatar.tsx`

```typescript
interface ProfileAvatarProps {
  avatarUrl: string | null;
  displayName: string | null;
  username: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'w-16 h-16 text-sm',
  md: 'w-24 h-24 text-lg',
  lg: 'w-40 h-40 text-4xl',
};

/**
 * Get initials from display name
 * Falls back to username if display name not available
 */
function getInitials(displayName: string | null, username: string): string {
  if (displayName) {
    return displayName
      .split(' ')
      .slice(0, 2)
      .map(part => part[0])
      .join('')
      .toUpperCase();
  }
  return username.substring(0, 2).toUpperCase();
}

export default function ProfileAvatar({
  avatarUrl,
  displayName,
  username,
  size = 'md',
}: ProfileAvatarProps) {
  const initials = getInitials(displayName, username);

  return (
    <div className={`relative flex-shrink-0 ${sizeClasses[size]}`}>
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={displayName || username}
          className="w-full h-full rounded-full object-cover bg-gray-200"
          onError={(e) => {
            // Fallback to initials if image fails
            e.currentTarget.style.display = 'none';
          }}
        />
      ) : (
        <div className="w-full h-full rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold">
          {initials}
        </div>
      )}
    </div>
  );
}
```

### Step 2: Create Social Links Display Component

Shows social media icons/usernames in a grid.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/profile/SocialLinks.tsx`

```typescript
interface SocialLinksProps {
  socials: {
    instagram: string | null;
    twitter: string | null;
    tiktok: string | null;
    youtube: string | null;
    bluesky: string | null;
    threads: string | null;
  };
}

const SOCIAL_PLATFORMS = [
  {
    key: 'instagram',
    label: 'Instagram',
    icon: '📷',
    baseUrl: 'https://instagram.com',
  },
  {
    key: 'twitter',
    label: 'Twitter/X',
    icon: '𝕏',
    baseUrl: 'https://twitter.com',
  },
  {
    key: 'tiktok',
    label: 'TikTok',
    icon: '🎵',
    baseUrl: 'https://tiktok.com/@',
  },
  {
    key: 'youtube',
    label: 'YouTube',
    icon: '▶️',
    baseUrl: 'https://youtube.com/@',
  },
  {
    key: 'bluesky',
    label: 'Bluesky',
    icon: '🦋',
    baseUrl: 'https://bsky.app/profile',
  },
  {
    key: 'threads',
    label: 'Threads',
    icon: '🧵',
    baseUrl: 'https://threads.net/@',
  },
];

export default function SocialLinks({ socials }: SocialLinksProps) {
  const activeSocials = SOCIAL_PLATFORMS.filter(
    (platform) => socials[platform.key as keyof typeof socials]
  );

  if (activeSocials.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-3">
      {activeSocials.map((platform) => {
        const handle = socials[platform.key as keyof typeof socials];
        const url = `${platform.baseUrl}${handle}`;

        return (
          <a
            key={platform.key}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            title={`${platform.label}: ${handle}`}
            className="inline-flex items-center gap-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
          >
            <span className="text-lg">{platform.icon}</span>
            <span className="text-xs font-medium text-gray-700">{handle}</span>
          </a>
        );
      })}
    </div>
  );
}
```

### Step 3: Create Profile Stats Component

Displays gallery and artwork counts.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/profile/ProfileStats.tsx`

```typescript
interface ProfileStatsProps {
  galleriesCount: number;
  artworksCount: number;
}

export default function ProfileStats({
  galleriesCount,
  artworksCount,
}: ProfileStatsProps) {
  return (
    <div className="flex gap-8">
      <div className="text-center">
        <div className="text-3xl font-bold text-gray-900">{galleriesCount}</div>
        <div className="text-sm text-gray-600 mt-1">
          {galleriesCount === 1 ? 'Gallery' : 'Galleries'}
        </div>
      </div>
      <div className="text-center">
        <div className="text-3xl font-bold text-gray-900">{artworksCount}</div>
        <div className="text-sm text-gray-600 mt-1">
          {artworksCount === 1 ? 'Artwork' : 'Artworks'}
        </div>
      </div>
    </div>
  );
}
```

### Step 4: Create Main Profile Page Component

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/pages/Profile.tsx`

```typescript
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import ProfileAvatar from '../components/profile/ProfileAvatar';
import SocialLinks from '../components/profile/SocialLinks';
import ProfileStats from '../components/profile/ProfileStats';
import type { UserProfileResponse } from '../types/user';

export default function Profile() {
  const navigate = useNavigate();
  const { user: authUser, isLoading: authLoading } = useAuth();
  const { showToast } = useToast();

  const [user, setUser] = useState<UserProfileResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch full user profile (includes stats)
  useEffect(() => {
    const fetchProfile = async () => {
      if (authLoading) {
        return; // Wait for auth check to complete
      }

      if (!authUser) {
        navigate('/'); // Redirect to home if not authenticated
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch('/api/auth/me', {
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error('Failed to fetch profile');
        }

        const data = await response.json();
        setUser(data);

        // TODO: Fetch stats from separate endpoint when available
        // For now, stats are placeholders or included in user response
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
        showToast(message, 'error');
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [authUser, authLoading, navigate, showToast]);

  // Show loading state while checking auth
  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-blue-600" />
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-600 font-semibold mb-4">
            {error || 'Profile not found'}
          </p>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Return Home
          </button>
        </div>
      </div>
    );
  }

  const galleriesCount = 0; // TODO: Fetch from API
  const artworksCount = 0; // TODO: Fetch from API

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section with Avatar */}
      <div className="bg-gradient-to-b from-gray-50 to-white px-4 py-8 md:py-12">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-col md:flex-row gap-8 items-start">
            {/* Avatar Section */}
            <div className="w-full md:w-auto flex justify-center md:justify-start">
              <ProfileAvatar
                avatarUrl={user.avatarUrl}
                displayName={user.displayName}
                username={user.username}
                size="lg"
              />
            </div>

            {/* User Info Section */}
            <div className="flex-1 w-full">
              {/* Name and Username */}
              <div className="mb-4">
                {user.displayName && (
                  <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-1">
                    {user.displayName}
                  </h1>
                )}
                <p className="text-lg text-gray-600">@{user.username}</p>
              </div>

              {/* Bio */}
              {user.bio && (
                <p className="text-gray-700 mb-4 whitespace-pre-wrap max-w-xl">
                  {user.bio}
                </p>
              )}

              {/* Website Link */}
              {user.website && (
                <div className="mb-6">
                  <a
                    href={user.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 hover:underline"
                  >
                    <span>🔗</span>
                    <span className="break-all">{user.website}</span>
                  </a>
                </div>
              )}

              {/* Social Links */}
              {user.socials && <SocialLinks socials={user.socials} />}
            </div>

            {/* Edit Button */}
            <div className="w-full md:w-auto">
              <button
                onClick={() => navigate('/profile/edit')}
                className="w-full md:w-auto px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center justify-center gap-2"
              >
                <span>✏️</span>
                <span>Edit Profile</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <div className="border-t border-gray-200 px-4 py-8 md:py-12">
        <div className="max-w-4xl mx-auto">
          <ProfileStats
            galleriesCount={galleriesCount}
            artworksCount={artworksCount}
          />
        </div>
      </div>

      {/* Placeholder Section: Galleries Grid */}
      <div className="px-4 py-8 md:py-12">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Galleries</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* TODO: Render gallery cards here - implement in build 60+ */}
            <div className="h-40 bg-gray-100 rounded-lg flex items-center justify-center text-gray-500">
              No galleries yet
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

### Step 5: Register Profile Route

Update the router to include the profile route:

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/router.tsx` (modify routes array)

```typescript
import Profile from './pages/Profile';

const routes: RouteObject[] = [
  {
    element: <AppShell />,
    children: [
      // ... other routes ...
      {
        path: '/profile',
        element: <Profile />,
        // protected: true, // if using protection wrapper
      },
      // ... rest of routes ...
    ],
  },
];
```

### Step 6: Update App.tsx to Include Toast Context

The profile page uses toast for error messages. Verify your toast context is set up:

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/App.tsx`

```typescript
import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext'; // if not already included
import './App.css';

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </AuthProvider>
  );
}
```

### Step 7: Verify User Types File

Confirm that the user types from Build 30 are properly exported:

```bash
grep -n "export interface UserProfileResponse" /Volumes/DataSSD/gitsrc/vfa_gallery/src/types/user.ts
```

Expected output: Shows UserProfileResponse interface definition.

---

## Files to Create/Modify

**Create:**
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/profile/ProfileAvatar.tsx` - Avatar display with fallback
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/profile/SocialLinks.tsx` - Social media links display
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/profile/ProfileStats.tsx` - Stats display component
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/pages/Profile.tsx` - Main profile page

**Modify:**
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/router.tsx` - Add profile route
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/App.tsx` - Ensure ToastProvider is present

---

## Verification

### Test 1: Access Profile While Logged In

1. Start dev server: `npm run dev`
2. Log in with valid credentials
3. Navigate to `/profile`

Expected: Profile page displays with user data loaded.

### Test 2: Avatar Display

Check avatar rendering:
- If user has avatar_url: Avatar image displays as circle
- If user has no avatar_url: Initials display in blue circle
- If image fails to load: Falls back to initials

```bash
curl -X GET http://localhost:8787/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN" | jq '.avatarUrl'
```

### Test 3: User Information Displays Correctly

Verify all fields render:
```bash
curl -X GET http://localhost:8787/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN" | jq '.displayName, .username, .bio, .website'
```

All fields should display correctly on profile page.

### Test 4: Social Links Render

If user has socials set:
- Social links appear in a grid
- Each shows icon and username
- Clicking opens social platform in new tab

Test with a user that has socials:
```bash
curl -X GET http://localhost:8787/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN" | jq '.socials'
```

### Test 5: Edit Button Links to Edit Page

Click "Edit Profile" button:
- Should navigate to `/profile/edit`
- Current URL changes to `/profile/edit`

### Test 6: Not Authenticated Redirects

1. Clear auth token/cookies
2. Navigate directly to `/profile`

Expected: Redirects to home page

### Test 7: Responsive Layout

**Mobile (<640px):**
- Avatar displays centered above user info
- All text is readable and wraps properly
- Edit button spans full width
- Stats section is vertically stacked

**Desktop (≥640px):**
- Avatar appears on left
- User info appears on right
- Edit button appears in top right
- Stats appear horizontally

### Test 8: Loading States

During profile fetch:
- Loading spinner appears
- Once loaded, profile info displays

---

## Success Criteria

- [ ] Profile page accessible at `/profile`
- [ ] Profile page requires authentication (redirects to home if not logged in)
- [ ] Avatar displays as circular image or initials fallback
- [ ] Display name, username (@), bio all display correctly
- [ ] Website link displays and opens in new tab
- [ ] Social links display with icons and usernames
- [ ] Edit button navigates to `/profile/edit`
- [ ] Stats section displays (counts may be 0 for now)
- [ ] Page is responsive on mobile and desktop
- [ ] Loading spinner shows while fetching
- [ ] Error toast appears if fetch fails
- [ ] ProfileAvatar component handles null avatarUrl
- [ ] SocialLinks component only shows platforms with data
- [ ] All TypeScript types are correct, no errors

---

## Next Steps

Once verified, proceed to:
- **Build 34:** Profile edit form (ProfileEdit page)
- **Build 35:** Social links configuration in profile edit
- Implement gallery and artwork count endpoints
- Implement gallery grid on profile page
