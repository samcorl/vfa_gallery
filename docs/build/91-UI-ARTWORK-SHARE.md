# Build 91: Share Buttons Component

## Goal

Create a share buttons component for the artwork detail page that provides copy link, Twitter, Facebook, and Pinterest sharing options with native Web Share API support on mobile devices.

---

## Spec Extract

**Features:**
- Copy Link: Copies artwork URL to clipboard, shows toast notification
- Twitter: Opens Twitter intent with artwork title and link
- Facebook: Opens Facebook sharer dialog
- Pinterest: Opens Pinterest pin/create dialog
- Native Web Share API: On mobile, shows system share sheet if available
- Toast notification when link copied
- Responsive button layout

**Share URLs:**
- Twitter: `https://twitter.com/intent/tweet?url=...&text=...`
- Facebook: `https://www.facebook.com/sharer/sharer.php?u=...`
- Pinterest: `https://www.pinterest.com/pin/create/button/?url=...&media=...&description=...`

**Mobile Behavior:**
- If Web Share API available: Show "Share" button that opens native share sheet
- Share sheet includes all options (Twitter, Facebook, etc.)
- Copy Link shows toast notification

---

## Prerequisites

**Must complete before starting:**
- **89-UI-PUBLIC-ARTWORK.md** - Artwork detail page
- **28-REACT-TOAST-SYSTEM.md** - Toast notification system

**Reason:** Share component integrates into artwork metadata sidebar and uses toast for feedback.

---

## Steps

### Step 1: Create Share Types

Create types for share options:

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/types/share.ts`

```typescript
export type SharePlatform = 'twitter' | 'facebook' | 'pinterest' | 'copy' | 'native';

export interface ShareOptions {
  url: string;
  title: string;
  description?: string;
  imageUrl?: string;
}

export interface ShareAction {
  platform: SharePlatform;
  label: string;
  icon?: string;
  action: (options: ShareOptions) => void | Promise<void>;
}
```

### Step 2: Create Share Utility Functions

Create helper functions for generating share URLs:

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/utils/shareUtils.ts`

```typescript
import type { ShareOptions, SharePlatform } from '../types/share';

/**
 * Generate Twitter share URL
 */
export function getTwitterShareUrl(options: ShareOptions): string {
  const params = new URLSearchParams({
    url: options.url,
    text: options.title,
  });
  return `https://twitter.com/intent/tweet?${params.toString()}`;
}

/**
 * Generate Facebook share URL
 */
export function getFacebookShareUrl(options: ShareOptions): string {
  const params = new URLSearchParams({
    u: options.url,
    quote: options.title,
  });
  return `https://www.facebook.com/sharer/sharer.php?${params.toString()}`;
}

/**
 * Generate Pinterest share URL
 */
export function getPinterestShareUrl(options: ShareOptions): string {
  const params = new URLSearchParams({
    url: options.url,
    media: options.imageUrl || '',
    description: options.description || options.title,
  });
  return `https://www.pinterest.com/pin/create/button/?${params.toString()}`;
}

/**
 * Check if Web Share API is available
 */
export function isWebShareApiAvailable(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.share;
}

/**
 * Use Web Share API if available, fallback to manual sharing
 */
export async function shareViaWebApi(options: ShareOptions): Promise<void> {
  if (!isWebShareApiAvailable()) {
    throw new Error('Web Share API not available');
  }

  try {
    await navigator.share({
      title: options.title,
      text: options.description || options.title,
      url: options.url,
    });
  } catch (error) {
    // User cancelled the share dialog, this is not an error
    if ((error as Error).name !== 'AbortError') {
      throw error;
    }
  }
}

/**
 * Copy URL to clipboard
 */
export async function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard && window.isSecureContext) {
    // Use modern Clipboard API if available
    await navigator.clipboard.writeText(text);
  } else {
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
      document.execCommand('copy');
    } finally {
      document.body.removeChild(textArea);
    }
  }
}

/**
 * Open share URL in new window
 */
export function openShareWindow(url: string, platform: string): void {
  const width = 600;
  const height = 400;
  const left = window.screenX + (window.outerWidth - width) / 2;
  const top = window.screenY + (window.outerHeight - height) / 2;

  window.open(
    url,
    `share-${platform}`,
    `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`
  );
}
```

### Step 3: Create Share Buttons Component

Create the main share buttons component:

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/public/ArtworkShare.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import {
  LinkIcon,
  ArrowUpTrayIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { useToast } from '../../context/ToastContext';
import type { ShareOptions } from '../../types/share';
import {
  getTwitterShareUrl,
  getFacebookShareUrl,
  getPinterestShareUrl,
  isWebShareApiAvailable,
  shareViaWebApi,
  copyToClipboard,
  openShareWindow,
} from '../../utils/shareUtils';

interface ArtworkShareProps {
  artworkUrl: string;
  artworkTitle: string;
  artworkDescription?: string;
  artworkImageUrl?: string;
}

interface ShareButton {
  id: string;
  label: string;
  icon: React.ComponentType<{ className: string }>;
  color: string;
  hoverColor: string;
  action: (options: ShareOptions) => void | Promise<void>;
}

export default function ArtworkShare({
  artworkUrl,
  artworkTitle,
  artworkDescription,
  artworkImageUrl,
}: ArtworkShareProps) {
  const { success: showSuccess, error: showError } = useToast();
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasWebShareApi, setHasWebShareApi] = useState(false);

  // Check for Web Share API on mount
  useEffect(() => {
    setHasWebShareApi(isWebShareApiAvailable());
  }, []);

  const shareOptions: ShareOptions = {
    url: artworkUrl,
    title: artworkTitle,
    description: artworkDescription,
    imageUrl: artworkImageUrl,
  };

  // Handle copy link
  const handleCopyLink = async () => {
    try {
      setIsLoading(true);
      await copyToClipboard(artworkUrl);
      showSuccess('Link copied to clipboard');
    } catch (error) {
      console.error('Failed to copy link:', error);
      showError('Failed to copy link');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Twitter share
  const handleTwitterShare = () => {
    try {
      const url = getTwitterShareUrl(shareOptions);
      openShareWindow(url, 'twitter');
    } catch (error) {
      console.error('Failed to open Twitter share:', error);
      showError('Failed to open Twitter share');
    }
  };

  // Handle Facebook share
  const handleFacebookShare = () => {
    try {
      const url = getFacebookShareUrl(shareOptions);
      openShareWindow(url, 'facebook');
    } catch (error) {
      console.error('Failed to open Facebook share:', error);
      showError('Failed to open Facebook share');
    }
  };

  // Handle Pinterest share
  const handlePinterestShare = () => {
    try {
      const url = getPinterestShareUrl(shareOptions);
      openShareWindow(url, 'pinterest');
    } catch (error) {
      console.error('Failed to open Pinterest share:', error);
      showError('Failed to open Pinterest share');
    }
  };

  // Handle Web Share API
  const handleWebShare = async () => {
    try {
      setIsLoading(true);
      await shareViaWebApi(shareOptions);
    } catch (error) {
      console.error('Failed to share:', error);
      showError('Failed to share');
    } finally {
      setIsLoading(false);
      setShowMoreOptions(false);
    }
  };

  // Define share buttons
  const buttons: ShareButton[] = [
    {
      id: 'copy',
      label: 'Copy Link',
      icon: LinkIcon,
      color: 'bg-gray-200',
      hoverColor: 'hover:bg-gray-300',
      action: handleCopyLink,
    },
    {
      id: 'twitter',
      label: 'Twitter',
      icon: TwitterIcon,
      color: 'bg-blue-400',
      hoverColor: 'hover:bg-blue-500',
      action: handleTwitterShare,
    },
    {
      id: 'facebook',
      label: 'Facebook',
      icon: FacebookIcon,
      color: 'bg-blue-600',
      hoverColor: 'hover:bg-blue-700',
      action: handleFacebookShare,
    },
    {
      id: 'pinterest',
      label: 'Pinterest',
      icon: PinterestIcon,
      color: 'bg-red-500',
      hoverColor: 'hover:bg-red-600',
      action: handlePinterestShare,
    },
  ];

  return (
    <div className="space-y-2">
      {/* Primary Buttons (Mobile and Desktop) */}
      <div className="flex gap-2">
        {/* Copy Link Button */}
        <button
          onClick={handleCopyLink}
          disabled={isLoading}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white text-sm font-medium rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Copy link to clipboard"
        >
          <LinkIcon className="w-4 h-4" />
          <span className="hidden sm:inline">Copy</span>
        </button>

        {/* Twitter Button */}
        <button
          onClick={handleTwitterShare}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-400 hover:bg-blue-500 text-white text-sm font-medium rounded transition-colors"
          title="Share on Twitter"
        >
          <TwitterIcon className="w-4 h-4" />
          <span className="hidden sm:inline">X</span>
        </button>

        {/* More Options Button */}
        <div className="relative">
          <button
            onClick={() => setShowMoreOptions(!showMoreOptions)}
            className="px-3 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded transition-colors"
            title="More share options"
            aria-label="More share options"
          >
            {showMoreOptions ? (
              <XMarkIcon className="w-4 h-4" />
            ) : (
              <span className="text-lg">•••</span>
            )}
          </button>

          {/* Dropdown Menu */}
          {showMoreOptions && (
            <div className="absolute top-full right-0 mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10 min-w-max">
              <div className="py-1">
                {/* Facebook */}
                <button
                  onClick={() => {
                    handleFacebookShare();
                    setShowMoreOptions(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  title="Share on Facebook"
                >
                  <FacebookIcon className="w-4 h-4" />
                  <span>Facebook</span>
                </button>

                {/* Pinterest */}
                <button
                  onClick={() => {
                    handlePinterestShare();
                    setShowMoreOptions(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  title="Share on Pinterest"
                >
                  <PinterestIcon className="w-4 h-4" />
                  <span>Pinterest</span>
                </button>

                {/* Web Share API Button (if available) */}
                {hasWebShareApi && (
                  <>
                    <div className="border-t border-gray-200 dark:border-gray-700" />
                    <button
                      onClick={() => {
                        handleWebShare();
                        setShowMoreOptions(false);
                      }}
                      disabled={isLoading}
                      className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                      title="Share using system share sheet"
                    >
                      <ArrowUpTrayIcon className="w-4 h-4" />
                      <span>More</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Help text */}
      <p className="text-xs text-gray-600 dark:text-gray-400 text-center">
        Share this artwork
      </p>
    </div>
  );
}

/**
 * Twitter icon component
 */
function TwitterIcon({ className }: { className: string }) {
  return (
    <svg
      className={className}
      fill="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path d="M8.29 20c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-7.122 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
    </svg>
  );
}

/**
 * Facebook icon component
 */
function FacebookIcon({ className }: { className: string }) {
  return (
    <svg
      className={className}
      fill="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

/**
 * Pinterest icon component
 */
function PinterestIcon({ className }: { className: string }) {
  return (
    <svg
      className={className}
      fill="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path d="M12 0C5.383 0 0 5.383 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.937-.2-2.378.04-3.369.219-.937 1.406-5.957 1.406-5.957s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.767 1.518 1.686 0 1.026-.653 2.561-.99 3.986-.281 1.19.597 2.159 1.769 2.159 2.123 0 3.756-2.239 3.756-5.471 0-2.861-2.056-4.86-4.991-4.86-3.398 0-5.393 2.549-5.393 5.184 0 1.027.395 2.127.889 2.726.098.12.112.224.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.631-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146 1.124.347 2.317.535 3.554.535 6.617 0 12-5.383 12-12 0-6.617-5.383-12-12-12z" />
    </svg>
  );
}
```

### Step 4: Update Artwork Metadata Sidebar

Update the ArtworkMetadata component to use the new share buttons:

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/public/ArtworkMetadata.tsx`

Replace the Share section with the new component:

```typescript
import React from 'react';
import { Link } from 'react-router-dom';
import type { PublicArtworkResponse } from '../../types/public';
import ArtworkShare from './ArtworkShare';

interface ArtworkMetadataProps {
  artwork: PublicArtworkResponse;
}

export default function ArtworkMetadata({ artwork }: ArtworkMetadataProps) {
  const uploadDate = new Date(artwork.metadata.uploadedAt).toLocaleDateString(
    'en-US',
    { year: 'numeric', month: 'long', day: 'numeric' }
  );

  return (
    <div className="space-y-6">
      {/* Artist Credit */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase mb-3">
          Artist
        </h3>
        <Link
          to={`/${artwork.artist.username}`}
          className="flex items-center space-x-3 hover:opacity-70 transition-opacity"
        >
          {artwork.artist.avatarUrl && (
            <img
              src={artwork.artist.avatarUrl}
              alt={artwork.artist.username}
              className="w-10 h-10 rounded-full"
            />
          )}
          <div>
            <p className="font-semibold text-gray-900 dark:text-white">
              {artwork.artist.displayName || artwork.artist.username}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              @{artwork.artist.username}
            </p>
          </div>
        </Link>
      </div>

      {/* Image Info */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase mb-3">
          Image Info
        </h3>
        <div className="space-y-2 text-sm">
          {artwork.metadata.width && artwork.metadata.height && (
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Dimensions:</span>
              <span className="text-gray-900 dark:text-white font-mono">
                {artwork.metadata.width} × {artwork.metadata.height}
              </span>
            </div>
          )}
          {artwork.metadata.mimeType && (
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Type:</span>
              <span className="text-gray-900 dark:text-white font-mono uppercase text-xs">
                {artwork.metadata.mimeType.split('/')[1]}
              </span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Uploaded:</span>
            <span className="text-gray-900 dark:text-white text-xs">{uploadDate}</span>
          </div>
        </div>
      </div>

      {/* Collection Info */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase mb-3">
          Collection
        </h3>
        <Link
          to={`/${artwork.artist.username}/${artwork.parent.gallery.slug}/${artwork.parent.collection.slug}`}
          className="text-blue-600 dark:text-blue-400 hover:underline text-sm font-medium"
        >
          {artwork.parent.collection.name}
        </Link>
        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
          in {artwork.parent.gallery.name}
        </p>
      </div>

      {/* Share Buttons */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase mb-3">
          Share
        </h3>
        <ArtworkShare
          artworkUrl={window.location.href}
          artworkTitle={artwork.title}
          artworkDescription={artwork.description}
          artworkImageUrl={artwork.displayUrl}
        />
      </div>
    </div>
  );
}
```

---

## Files to Create/Modify

**Create:**
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/types/share.ts` - Share types
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/utils/shareUtils.ts` - Share utility functions
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/public/ArtworkShare.tsx` - Share buttons component

**Modify:**
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/public/ArtworkMetadata.tsx` - Import and use ArtworkShare

---

## Verification

### Test 1: Copy Link Button

- Click "Copy" button
- Toast shows "Link copied to clipboard"
- URL is actually in clipboard (paste elsewhere to verify)

### Test 2: Twitter Share

- Click "X" button
- New window opens with Twitter intent
- Pre-filled with artwork title and link
- URL and text are encoded properly

### Test 3: Facebook Share

- Click dropdown "•••"
- Click "Facebook"
- New window opens with Facebook sharer
- URL is passed correctly
- Quote/description shows artwork title

### Test 4: Pinterest Share

- Click dropdown "•••"
- Click "Pinterest"
- New window opens with Pinterest dialog
- Image URL passed
- Description shows artwork title

### Test 5: Web Share API (Mobile/Supporting Browsers)

- On iOS/Android or browsers supporting Web Share API
- Click dropdown "•••"
- If "More" option visible, click it
- Native share sheet opens
- Can select any app installed on device

### Test 6: Dropdown Toggle

- Click "•••" button
- Dropdown opens
- Click "•••" again
- Dropdown closes
- Click outside dropdown
- Dropdown closes

### Test 7: Responsive Design

- Desktop: "Copy" and "X" buttons visible + dropdown
- Mobile: "Copy" icon (no text) and "X" icon (no text) + dropdown
- Buttons stack properly on small screens

### Test 8: Dark Mode

- Toggle dark mode
- All buttons have proper dark mode colors
- Text is readable
- Hover states work in dark mode

### Test 9: Error Handling

- Block clipboard access
- Click "Copy"
- Error toast shows
- App doesn't crash

### Test 10: Multiple Shares

- Share multiple times
- Each share opens new window (or native sheet)
- No memory leaks
- Toast notifications appear correctly each time

---

## Success Criteria

- [ ] Share component created
- [ ] Copy link works with toast notification
- [ ] Twitter share opens with correct URL and text
- [ ] Facebook share opens with correct URL
- [ ] Pinterest share opens with image and description
- [ ] Web Share API integrated for mobile
- [ ] Dropdown menu toggles correctly
- [ ] All buttons have proper colors and hover states
- [ ] Dark mode styling works
- [ ] Error handling works gracefully
- [ ] Responsive design on mobile and desktop
- [ ] All 10 test cases pass

---

## Next Steps

Once verified, proceed to:
- **Build 92:** Message artist button
