# Build 35: Social Links Configuration

## Goal
Create a social links configuration component that allows users to add, edit, and remove their social media handles in the profile edit form. Supports Instagram, Twitter/X, TikTok, YouTube, Bluesky, and Threads with intelligent URL parsing that accepts either full URLs or just usernames.

---

## Spec Extract

**Supported Platforms:**
- Instagram (@username or https://instagram.com/username)
- Twitter/X (@handle or https://twitter.com/handle)
- TikTok (@username or https://tiktok.com/@username)
- YouTube (@channel or https://youtube.com/@channel)
- Bluesky (@handle.bsky.social or https://bsky.app/profile/handle.bsky.social)
- Threads (@username or https://threads.net/@username)

**Input Handling:**
- Each platform has a dedicated input field with platform icon
- Accept either full URL or just username/handle
- Normalize input to consistent format (username only) for storage
- Show platform-specific placeholder examples
- Real-time validation and normalization

**Storage Format:**
- Store in `socials` JSON object in user profile
- Format: `{ instagram: "username", twitter: "handle", ... }`
- Null/empty string for platforms without handles

**UI/UX:**
- Collapsible section in profile edit form (labeled "Social Links")
- Section expandable to show all social fields
- Platform icons and labels for each field
- Clear placeholder text with example formats
- No validation required (platforms optional)
- Seamlessly integrates with ProfileForm

---

## Prerequisites

**Must complete before starting:**
- **34-UI-PROFILE-EDIT.md** - Profile edit page and ProfileForm component
- **30-API-USER-ME.md** - User API returns socials field

**Reason:** SocialsEditor integrates as a section within ProfileEdit page and processes the socials data from user profile.

---

## Steps

### Step 1: Create Socials Parser Utility

This utility handles parsing and normalizing social media handles/URLs.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/socials.ts`

```typescript
/**
 * Parse social media input (URL or username) to extract normalized username
 * Handles various URL formats and extracts the username/handle
 */
export interface SocialPlatform {
  key: string;
  label: string;
  icon: string;
  placeholder: string;
  patterns: {
    url: RegExp;
    extractUsername: (input: string) => string | null;
  };
}

export const SOCIAL_PLATFORMS: SocialPlatform[] = [
  {
    key: 'instagram',
    label: 'Instagram',
    icon: '📷',
    placeholder: 'username or https://instagram.com/username',
    patterns: {
      url: /^(?:https?:\/\/)?(?:www\.)?instagram\.com\//i,
      extractUsername: (input) => {
        // If it's just a username (no URL)
        if (!input.includes('/') && !input.includes('.')) {
          return input.toLowerCase().trim();
        }
        // Extract from URL
        const match = input.match(/instagram\.com\/([^/?]+)/i);
        return match ? match[1].toLowerCase() : null;
      },
    },
  },
  {
    key: 'twitter',
    label: 'Twitter/X',
    icon: '𝕏',
    placeholder: '@handle or https://twitter.com/handle',
    patterns: {
      url: /^(?:https?:\/\/)?(?:www\.)?(?:twitter|x)\.com\//i,
      extractUsername: (input) => {
        // Remove @ symbol if present
        const cleaned = input.replace(/^@/, '').toLowerCase().trim();
        // If it's just a handle (no URL)
        if (!cleaned.includes('/') && !cleaned.includes('.')) {
          return cleaned;
        }
        // Extract from URL
        const match = cleaned.match(/(?:twitter|x)\.com\/([^/?]+)/i);
        return match ? match[1].toLowerCase() : null;
      },
    },
  },
  {
    key: 'tiktok',
    label: 'TikTok',
    icon: '🎵',
    placeholder: '@username or https://tiktok.com/@username',
    patterns: {
      url: /^(?:https?:\/\/)?(?:www\.)?tiktok\.com\//i,
      extractUsername: (input) => {
        // Remove @ symbol if present
        const cleaned = input.replace(/^@/, '').toLowerCase().trim();
        // If it's just a username (no URL)
        if (!cleaned.includes('/') && !cleaned.includes('.')) {
          return cleaned;
        }
        // Extract from URL
        const match = cleaned.match(/tiktok\.com\/@?([^/?]+)/i);
        return match ? match[1].toLowerCase() : null;
      },
    },
  },
  {
    key: 'youtube',
    label: 'YouTube',
    icon: '▶️',
    placeholder: '@channel or https://youtube.com/@channel',
    patterns: {
      url: /^(?:https?:\/\/)?(?:www\.)?youtube\.com\//i,
      extractUsername: (input) => {
        // Remove @ symbol if present
        const cleaned = input.replace(/^@/, '').toLowerCase().trim();
        // If it's just a channel name (no URL)
        if (!cleaned.includes('/') && !cleaned.includes('.')) {
          return cleaned;
        }
        // Extract from URL (handles both @channel and /c/channel formats)
        let match = cleaned.match(/youtube\.com\/(?:@|c\/)([^/?]+)/i);
        if (!match) {
          // Try /user/ format
          match = cleaned.match(/youtube\.com\/user\/([^/?]+)/i);
        }
        return match ? match[1].toLowerCase() : null;
      },
    },
  },
  {
    key: 'bluesky',
    label: 'Bluesky',
    icon: '🦋',
    placeholder: '@handle.bsky.social or https://bsky.app/profile/handle.bsky.social',
    patterns: {
      url: /^(?:https?:\/\/)?(?:www\.)?bsky\.app\//i,
      extractUsername: (input) => {
        // Remove @ symbol if present
        const cleaned = input.replace(/^@/, '').toLowerCase().trim();
        // If it's a handle with .bsky.social domain
        if (cleaned.endsWith('.bsky.social')) {
          return cleaned;
        }
        // If it's just a handle without domain
        if (!cleaned.includes('/') && !cleaned.includes('.')) {
          return `${cleaned}.bsky.social`;
        }
        // Extract from URL
        const match = cleaned.match(/bsky\.app\/profile\/([^/?]+)/i);
        return match ? match[1].toLowerCase() : null;
      },
    },
  },
  {
    key: 'threads',
    label: 'Threads',
    icon: '🧵',
    placeholder: '@username or https://threads.net/@username',
    patterns: {
      url: /^(?:https?:\/\/)?(?:www\.)?threads\.net\//i,
      extractUsername: (input) => {
        // Remove @ symbol if present
        const cleaned = input.replace(/^@/, '').toLowerCase().trim();
        // If it's just a username (no URL)
        if (!cleaned.includes('/') && !cleaned.includes('.')) {
          return cleaned;
        }
        // Extract from URL
        const match = cleaned.match(/threads\.net\/@?([^/?]+)/i);
        return match ? match[1].toLowerCase() : null;
      },
    },
  },
];

/**
 * Normalize social media input by extracting the username/handle
 * Returns the normalized username or null if cannot parse
 */
export function normalizeSocialInput(platform: string, input: string): string | null {
  if (!input || !input.trim()) {
    return null;
  }

  const platformConfig = SOCIAL_PLATFORMS.find((p) => p.key === platform);
  if (!platformConfig) {
    return null;
  }

  return platformConfig.patterns.extractUsername(input);
}

/**
 * Get the URL for a social media handle
 */
export function getSocialUrl(platform: string, handle: string): string | null {
  const platformConfig = SOCIAL_PLATFORMS.find((p) => p.key === platform);
  if (!platformConfig) {
    return null;
  }

  switch (platform) {
    case 'instagram':
      return `https://instagram.com/${handle}`;
    case 'twitter':
      return `https://twitter.com/${handle}`;
    case 'tiktok':
      return `https://tiktok.com/@${handle}`;
    case 'youtube':
      return `https://youtube.com/@${handle}`;
    case 'bluesky':
      return `https://bsky.app/profile/${handle}`;
    case 'threads':
      return `https://threads.net/@${handle}`;
    default:
      return null;
  }
}
```

### Step 2: Create Socials Editor Component

This component provides the UI for editing social links.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/profile/SocialsEditor.tsx`

```typescript
import { useState, ChangeEvent } from 'react';
import { SOCIAL_PLATFORMS, normalizeSocialInput } from '../../lib/socials';

interface SocialsEditorProps {
  socials: {
    instagram: string | null;
    twitter: string | null;
    tiktok: string | null;
    youtube: string | null;
    bluesky: string | null;
    threads: string | null;
  };
  onChange: (socials: typeof socials) => void;
  isExpanded?: boolean;
  onToggleExpand?: (expanded: boolean) => void;
  isDisabled?: boolean;
}

export default function SocialsEditor({
  socials,
  onChange,
  isExpanded = true,
  onToggleExpand,
  isDisabled = false,
}: SocialsEditorProps) {
  const [expanded, setExpanded] = useState(isExpanded);

  const handleToggle = () => {
    const newExpanded = !expanded;
    setExpanded(newExpanded);
    onToggleExpand?.(newExpanded);
  };

  const handleSocialChange = (platform: string, value: string) => {
    // Normalize the input
    const normalized = normalizeSocialInput(platform, value);

    // Update socials object
    const updatedSocials = {
      ...socials,
      [platform]: normalized,
    };

    onChange(updatedSocials);
  };

  // Count how many socials are filled
  const filledCount = Object.values(socials).filter((v) => v !== null).length;

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* Header/Toggle */}
      <button
        type="button"
        onClick={handleToggle}
        disabled={isDisabled}
        className={`w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors ${
          isDisabled ? 'cursor-not-allowed opacity-50' : ''
        }`}
      >
        <div className="flex items-center gap-3">
          <span className="text-lg">🔗</span>
          <div className="text-left">
            <h3 className="font-semibold text-gray-900">Social Links</h3>
            <p className="text-xs text-gray-600">
              {filledCount > 0
                ? `${filledCount} platform${filledCount !== 1 ? 's' : ''} added`
                : 'Add your social media handles'}
            </p>
          </div>
        </div>
        <span className={`text-gray-600 transition-transform ${expanded ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </button>

      {/* Expanded Content */}
      {expanded && (
        <div className="border-t border-gray-200 p-4 space-y-4 bg-white">
          <p className="text-sm text-gray-600">
            Enter your social media handles or profile URLs. You can use just the username or a full URL.
          </p>

          {/* Social Fields Grid */}
          <div className="space-y-4">
            {SOCIAL_PLATFORMS.map((platform) => {
              const value = socials[platform.key as keyof typeof socials] || '';

              return (
                <div key={platform.key}>
                  <label
                    htmlFor={`social-${platform.key}`}
                    className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2"
                  >
                    <span className="text-lg">{platform.icon}</span>
                    <span>{platform.label}</span>
                  </label>
                  <input
                    type="text"
                    id={`social-${platform.key}`}
                    value={value}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      handleSocialChange(platform.key, e.target.value)
                    }
                    placeholder={platform.placeholder}
                    disabled={isDisabled}
                    className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                      isDisabled ? 'bg-gray-50 cursor-not-allowed' : ''
                    }`}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {value
                      ? `Saved as: ${value}`
                      : `Example: ${platform.placeholder.split(' or ')[0]}`}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Info Note */}
          <div className="bg-blue-50 border border-blue-200 rounded p-3 mt-4">
            <p className="text-xs text-blue-800">
              ℹ️ <span className="font-semibold">Tip:</span> Socials are optional. Enter only the
              platforms you use. The input is flexible - you can enter just your username or a full URL.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
```

### Step 3: Integrate SocialsEditor into ProfileEdit

Update the ProfileEdit page to include the SocialsEditor.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/pages/ProfileEdit.tsx` (modify)

In the ProfileEdit component, update to include socials handling:

```typescript
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import AvatarUpload from '../components/profile/AvatarUpload';
import ProfileForm, { ProfileFormData } from '../components/profile/ProfileForm';
import SocialsEditor from '../components/profile/SocialsEditor';
import type { UserProfileResponse } from '../types/user';

// ... existing code ...

export default function ProfileEdit() {
  // ... existing state ...
  const [socials, setSocials] = useState<UserProfileResponse['socials'] | null>(null);
  const [socialsExpanded, setSocialsExpanded] = useState(false);

  // ... existing useEffect for fetchProfile ...
  // Update to also set socials:
  useEffect(() => {
    const fetchProfile = async () => {
      // ... existing fetch code ...
      const data = await response.json();
      setUser(data);
      setSocials(data.socials); // Add this line
    };
    // ... rest of useEffect ...
  }, [authUser, authLoading, navigate, showToast]);

  // ... existing handleAvatarUpload ...

  /**
   * Handle profile form submission with socials
   */
  const handleFormSubmit = async (formData: ProfileFormData) => {
    try {
      setIsSaving(true);

      // Include socials in the request
      const requestData = {
        displayName: formData.displayName,
        bio: formData.bio,
        website: formData.website,
        phone: formData.phone,
        socials: socials, // Add socials data
      };

      const response = await fetch('/api/users/me', {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to update profile');
      }

      const updatedUser = await response.json();
      setUser(updatedUser);
      setSocials(updatedUser.socials); // Update socials state
      showToast('Profile updated successfully', 'success');

      setTimeout(() => {
        navigate('/profile');
      }, 1500);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update profile';
      showToast(message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // ... existing render code, but add SocialsEditor before form actions ...
  // In the ProfileForm section, add:

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-4 py-8 md:py-12">
        {/* ... existing header and avatar sections ... */}

        {/* Profile Form and Socials Section */}
        <div className="bg-white border border-gray-200 rounded-lg p-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Profile Information</h2>

          <ProfileForm
            user={user}
            onSubmit={handleFormSubmit}
            isLoading={isSaving}
          />

          {/* Social Links Section */}
          {socials && (
            <div className="mt-8 pt-8 border-t border-gray-200">
              <SocialsEditor
                socials={socials}
                onChange={setSocials}
                isExpanded={socialsExpanded}
                onToggleExpand={setSocialsExpanded}
                isDisabled={isSaving}
              />
            </div>
          )}

          {/* Cancel Button */}
          <div className="mt-4">
            <button
              type="button"
              onClick={() => navigate('/profile')}
              disabled={isSaving}
              className={`w-full px-6 py-3 border border-gray-300 rounded-lg font-medium transition-colors ${
                isSaving
                  ? 'bg-gray-50 text-gray-500 cursor-not-allowed'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

### Step 4: Update API to Accept Socials

Verify the PATCH /api/users/me endpoint accepts and stores socials data.

**File:** Check `/Volumes/DataSSD/gitsrc/vfa_gallery/site/functions/api/users/me.ts`

The endpoint should accept `socials` in the request body and store it in the database:

```typescript
// In the PATCH handler, ensure socials is included:
const { displayName, bio, website, phone, socials } = await c.req.json();

// Update the user with all fields including socials
const updateResult = await db
  .prepare(`
    UPDATE users SET
      display_name = ?1,
      bio = ?2,
      website = ?3,
      phone = ?4,
      socials = ?5,
      updated_at = datetime('now')
    WHERE id = ?6
  `)
  .bind(
    displayName || null,
    bio || null,
    website || null,
    phone || null,
    socials ? JSON.stringify(socials) : null,
    authUser.userId
  )
  .run();
```

### Step 5: Test Socials Parsing Utility

Create a test file to verify the parsing logic works correctly:

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/__tests__/socials.test.ts` (optional)

```typescript
import { normalizeSocialInput } from '../socials';

describe('normalizeSocialInput', () => {
  describe('Instagram', () => {
    it('accepts username', () => {
      expect(normalizeSocialInput('instagram', 'samcorl')).toBe('samcorl');
    });

    it('extracts from URL', () => {
      expect(normalizeSocialInput('instagram', 'https://instagram.com/samcorl')).toBe('samcorl');
    });

    it('extracts from URL with www', () => {
      expect(normalizeSocialInput('instagram', 'www.instagram.com/samcorl')).toBe('samcorl');
    });
  });

  describe('Twitter', () => {
    it('accepts handle', () => {
      expect(normalizeSocialInput('twitter', 'samcorl')).toBe('samcorl');
    });

    it('removes @ symbol', () => {
      expect(normalizeSocialInput('twitter', '@samcorl')).toBe('samcorl');
    });

    it('extracts from URL', () => {
      expect(normalizeSocialInput('twitter', 'https://twitter.com/samcorl')).toBe('samcorl');
    });

    it('handles X domain', () => {
      expect(normalizeSocialInput('twitter', 'https://x.com/samcorl')).toBe('samcorl');
    });
  });

  describe('Bluesky', () => {
    it('accepts handle with domain', () => {
      expect(normalizeSocialInput('bluesky', 'samcorl.bsky.social')).toBe('samcorl.bsky.social');
    });

    it('adds domain to bare handle', () => {
      expect(normalizeSocialInput('bluesky', 'samcorl')).toBe('samcorl.bsky.social');
    });

    it('extracts from URL', () => {
      expect(normalizeSocialInput('bluesky', 'https://bsky.app/profile/samcorl.bsky.social')).toBe(
        'samcorl.bsky.social'
      );
    });
  });
});
```

---

## Files to Create/Modify

**Create:**
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/socials.ts` - Social media parsing utility
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/profile/SocialsEditor.tsx` - Socials editing component
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/__tests__/socials.test.ts` (optional) - Unit tests

**Modify:**
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/pages/ProfileEdit.tsx` - Integrate SocialsEditor component

---

## Verification

### Test 1: Socials Editor Appears

1. Navigate to `/profile/edit`
2. Look for "Social Links" section

Expected: Section visible, collapsed or expanded based on configuration.

### Test 2: Add Instagram Handle

1. Click to expand "Social Links" (if collapsed)
2. Enter "samcorl" in Instagram field
3. Tab out or move to next field

Expected:
- Field shows "Saved as: samcorl"
- Successfully normalized

### Test 3: Parse Instagram URL

1. Enter "https://instagram.com/samcorl" in Instagram field
2. Tab out

Expected: Normalized to "samcorl"

### Test 4: Parse Twitter Handle with @

1. Enter "@samcorl" in Twitter field
2. Tab out

Expected: Normalized to "samcorl"

### Test 5: Parse Twitter URL

1. Enter "https://twitter.com/samcorl" in Twitter field
2. Tab out

Expected: Normalized to "samcorl"

### Test 6: Parse Bluesky Handle

1. Enter "samcorl" in Bluesky field
2. Tab out

Expected: Normalized to "samcorl.bsky.social"

### Test 7: Parse Bluesky URL

1. Enter "https://bsky.app/profile/samcorl.bsky.social" in Bluesky field
2. Tab out

Expected: Normalized to "samcorl.bsky.social"

### Test 8: Parse TikTok URL

1. Enter "https://tiktok.com/@samcorl" in TikTok field
2. Tab out

Expected: Normalized to "samcorl"

### Test 9: Clear Social Field

1. Enter a handle, then clear the field
2. Tab out

Expected: Field saves as empty/null

### Test 10: Save Profile with Socials

1. Add multiple social handles
2. Click "Save Changes"

Expected:
- API call includes socials data
- Success toast appears
- Socials are saved to database

### Test 11: Load Saved Socials

1. Complete test 10, then navigate back to `/profile/edit`

Expected: All previously entered socials are pre-populated in form fields.

### Test 12: Display Socials on Profile

1. Navigate to `/profile` after saving socials

Expected: Social links display in profile with correct icons and usernames.

### Test 13: Responsive Socials Editor

**Mobile (<640px):**
- Section title and toggle are readable
- Input fields are full width
- Text doesn't overflow

**Desktop (≥640px):**
- Layout looks good in wider viewport
- All platform labels and inputs visible

### Test 14: All Platforms Support URL Parsing

Test each platform with its URL format:

**Instagram:** `https://instagram.com/username` → `username`
**Twitter:** `https://twitter.com/handle` → `handle`
**TikTok:** `https://tiktok.com/@username` → `username`
**YouTube:** `https://youtube.com/@channel` → `channel`
**Bluesky:** `https://bsky.app/profile/handle.bsky.social` → `handle.bsky.social`
**Threads:** `https://threads.net/@username` → `username`

### Test 15: Collapse/Expand Functionality

1. Click section header to collapse
2. Click again to expand

Expected: Section toggles collapsed/expanded state smoothly.

### Test 16: Filled Count Display

1. Add some socials
2. Observe section header

Expected: Shows "N platform(s) added" when socials are present.

### Test 17: Disable During Save

1. Start saving form with socials
2. Observe SocialsEditor inputs

Expected: All inputs are disabled while saving.

---

## Success Criteria

- [ ] SocialsEditor component created and renders
- [ ] Component integrates into ProfileEdit page
- [ ] All 6 platforms display correctly
- [ ] Username-only input works for all platforms
- [ ] URL parsing works for all platforms
- [ ] URL normalization correctly extracts usernames
- [ ] Bluesky correctly adds .bsky.social domain
- [ ] Twitter accepts @ symbol and removes it
- [ ] TikTok accepts @ prefix in URL
- [ ] Empty/null socials handled correctly
- [ ] Section toggles collapsed/expanded
- [ ] Filled count displays accurately
- [ ] Inputs disabled during save operation
- [ ] Socials data sent to API in request
- [ ] Socials data loaded from API response
- [ ] Socials display correctly on profile view
- [ ] All platforms have appropriate icons
- [ ] Placeholder text helpful for each platform
- [ ] Responsive layout on mobile and desktop
- [ ] No TypeScript errors

---

## Next Steps

Once verified, proceed to:
- **Display socials prominently on profile view** (already in Build 33 SocialLinks component)
- **Add social link validation** if needed
- **Implement social profile verification** (advanced feature)
- Profile completion percentage indicator
