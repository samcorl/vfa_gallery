# Build 155: UI Native Web Share API

## Goal

Implement native Web Share API for mobile devices. Automatically uses device's native share sheet when available, otherwise falls back to custom share buttons component.

---

## Spec Extract

From **01-TECHNICAL-SPEC.md** and Mobile Requirements:

- **Native Share API Support:**
  - Detect `navigator.share` availability
  - Use native OS share sheet on mobile (iOS, Android)
  - Proper fallback for desktop browsers and older devices
  - Support multiple share targets (Messages, Mail, Notes, etc.)

- **Content Shared:**
  - Title: Artwork title
  - Text: Description + "on VFA.gallery"
  - URL: Page URL
  - Image/File: Artwork image (if supported)

- **User Experience:**
  - Large native share button for mobile
  - Seamless fallback to custom share buttons
  - No UI difference - same component handles both
  - Proper error handling

- **Device Support:**
  - iOS: iMessage, Mail, Notes, AirDrop, etc.
  - Android: Share dialog with installed apps
  - Desktop: Falls back to custom buttons
  - Chrome, Safari, Firefox, Edge

---

## Prerequisites

- **154-UI-SHARE-BUTTONS.md** - Share buttons component for fallback
- **28-REACT-TOAST-SYSTEM.md** - Toast notifications for errors
- **24-REACT-ROUTER-SETUP.md** - React Router configured

---

## Steps

### 1. Create Native Share Utilities

Create **src/utils/nativeShare.ts**:

```typescript
/**
 * Native Web Share API utilities
 */

export interface ShareData {
  title?: string;
  text?: string;
  url?: string;
  files?: File[];
}

/**
 * Check if native Share API is available
 */
export function isNativeShareAvailable(): boolean {
  // Check for navigator.share API
  return typeof navigator !== 'undefined' && 'share' in navigator;
}

/**
 * Check if we're on a mobile device
 * Used to decide whether to prefer native sharing
 */
export function isMobileDevice(): boolean {
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';

  // User agent patterns for mobile devices
  const mobilePatterns = [
    /Android/i,
    /webOS/i,
    /iPhone/i,
    /iPad/i,
    /iPod/i,
    /BlackBerry/i,
    /Windows Phone/i,
    /Opera Mini/i,
    /IEMobile/i,
  ];

  return mobilePatterns.some((pattern) => pattern.test(userAgent));
}

/**
 * Check if native Share API is available AND device is mobile
 * This is the best indicator of whether to use native sharing
 */
export function shouldUseNativeShare(): boolean {
  return isNativeShareAvailable() && isMobileDevice();
}

/**
 * Share content using native Share API
 * Returns promise that resolves when share is complete
 * Rejects if share is cancelled or not available
 */
export async function shareNative(data: ShareData): Promise<void> {
  if (!isNativeShareAvailable()) {
    throw new Error('Native Share API not available');
  }

  try {
    // Filter out undefined properties
    const shareData: any = {};
    if (data.title) shareData.title = data.title;
    if (data.text) shareData.text = data.text;
    if (data.url) shareData.url = data.url;
    if (data.files && data.files.length > 0) {
      shareData.files = data.files;
    }

    // Ensure at least one property is set
    if (Object.keys(shareData).length === 0) {
      throw new Error('At least one of title, text, or url must be provided');
    }

    // Perform the share
    await navigator.share(shareData);
  } catch (error: any) {
    // AbortError is thrown when user cancels share dialog
    // This is expected behavior, not an error
    if (error.name !== 'AbortError') {
      throw error;
    }
  }
}

/**
 * Get ideal share data for artwork
 */
export function getArtworkShareData(
  title: string,
  description?: string,
  url?: string,
  image?: string
): ShareData {
  return {
    title: title,
    text: description ? `${description} - shared from VFA.gallery` : 'Check out this artwork on VFA.gallery',
    url: url,
    // Note: Files API with image would require fetching image as blob
    // Most platforms handle this via URL only
  };
}

/**
 * Fetch image as blob for sharing (iOS requires this for images)
 * Note: May trigger CORS issues if image from different domain
 */
export async function fetchImageAsBlob(imageUrl: string): Promise<Blob> {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }
    return await response.blob();
  } catch (error) {
    console.error('Failed to fetch image blob:', error);
    throw error;
  }
}

/**
 * Convert blob to File for sharing
 */
export function blobToFile(blob: Blob, fileName: string): File {
  return new File([blob], fileName, { type: blob.type });
}
```

### 2. Create Native Share Hook

Create **src/hooks/useNativeShare.ts**:

```typescript
import { useCallback } from 'react';
import { useToast } from '../contexts/ToastContext';
import {
  shouldUseNativeShare,
  shareNative,
  getArtworkShareData,
  ShareData,
} from '../utils/nativeShare';

interface UseNativeShareOptions {
  /**
   * Callback when share completes (regardless of method)
   */
  onSuccess?: () => void;

  /**
   * Callback when share fails
   */
  onError?: (error: Error) => void;

  /**
   * Show toast on success/error
   * Default: true
   */
  showToast?: boolean;
}

/**
 * Hook to handle sharing with native API (mobile) or fallback (desktop)
 * Usage:
 * const { canShare, share } = useNativeShare();
 *
 * if (canShare) {
 *   <button onClick={() => share({ title: 'My Artwork', url: '...' })}>
 *     Share
 *   </button>
 * } else {
 *   <ShareButtons ... />
 * }
 */
export function useNativeShare(options: UseNativeShareOptions = {}) {
  const { showToast = true } = options;
  const { success, error: showError } = useToast();

  const canShare = shouldUseNativeShare();

  const share = useCallback(
    async (data: ShareData) => {
      try {
        await shareNative(data);

        if (showToast) {
          success('Shared successfully!');
        }

        options.onSuccess?.();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to share';

        if (showToast) {
          showError(`Share failed: ${errorMessage}`);
        }

        options.onError?.(error instanceof Error ? error : new Error(errorMessage));
      }
    },
    [showToast, success, showError, options]
  );

  return {
    canShare,
    share,
  };
}
```

### 3. Create Smart Share Component (Native + Fallback)

Create **src/components/ui/SmartShareButtons.tsx**:

```typescript
import React from 'react';
import { useNativeShare } from '../../hooks/useNativeShare';
import { ShareButtons } from './ShareButtons';
import { ShareContent } from '../../utils/shareUrls';
import { getArtworkShareData } from '../../utils/nativeShare';

interface SmartShareButtonsProps {
  /**
   * Content to share
   */
  content: ShareContent;

  /**
   * Size of buttons
   * Default: 'md'
   */
  size?: 'sm' | 'md' | 'lg';

  /**
   * Layout direction
   * Default: 'row'
   */
  layout?: 'row' | 'column';

  /**
   * Custom className
   */
  className?: string;

  /**
   * Show labels
   * Default: false
   */
  showLabels?: boolean;

  /**
   * Callback when sharing completes
   */
  onShare?: () => void;
}

/**
 * Smart share component that:
 * 1. Uses native Share API on mobile if available
 * 2. Falls back to custom ShareButtons on desktop
 * 3. Seamless experience for both
 */
export function SmartShareButtons({
  content,
  size = 'md',
  layout = 'row',
  className = '',
  showLabels = false,
  onShare,
}: SmartShareButtonsProps) {
  const { canShare, share } = useNativeShare({
    showToast: true,
    onSuccess: onShare,
  });

  if (canShare) {
    // On mobile with native support, show single native share button
    return (
      <button
        onClick={() => {
          const shareData = getArtworkShareData(
            content.title,
            content.description,
            content.url,
            content.image
          );
          share(shareData);
        }}
        className={`
          px-6 py-3
          bg-blue-600 hover:bg-blue-700
          text-white font-semibold
          rounded-lg
          transition-all duration-200
          transform hover:scale-105 active:scale-95
          focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
          flex items-center justify-center gap-2
          ${className}
        `}
        aria-label="Share"
      >
        <span>↗</span> Share
      </button>
    );
  }

  // On desktop or older mobile browsers, show custom buttons
  return (
    <ShareButtons
      content={content}
      platforms={['copy', 'twitter', 'facebook', 'pinterest']}
      size={size}
      style="icons"
      layout={layout}
      className={className}
      showLabels={showLabels}
    />
  );
}
```

### 4. Create Artwork Share Wrapper Component

Create **src/components/artwork/ArtworkShareWrapper.tsx**:

```typescript
import React from 'react';
import { SmartShareButtons } from '../ui/SmartShareButtons';
import { ShareContent } from '../../utils/shareUrls';
import { shouldUseNativeShare } from '../../utils/nativeShare';

interface ArtworkShareWrapperProps {
  /**
   * Artwork title
   */
  title: string;

  /**
   * Artwork description (optional)
   */
  description?: string;

  /**
   * Artwork display image URL
   */
  imageUrl: string;

  /**
   * Full page URL to share
   */
  pageUrl: string;

  /**
   * Artist name (optional, for description)
   */
  artistName?: string;

  /**
   * Show section header
   * Default: true
   */
  showHeader?: boolean;

  /**
   * Custom className
   */
  className?: string;

  /**
   * Callback when share completes
   */
  onShare?: () => void;
}

export function ArtworkShareWrapper({
  title,
  description,
  imageUrl,
  pageUrl,
  artistName,
  showHeader = true,
  className = '',
  onShare,
}: ArtworkShareWrapperProps) {
  const shareContent: ShareContent = {
    url: pageUrl,
    title,
    description: description || (artistName ? `by ${artistName}` : 'Amazing artwork on VFA.gallery'),
    image: imageUrl,
  };

  const isNativeMobile = shouldUseNativeShare();

  return (
    <div className={`border-t border-gray-200 pt-6 ${className}`}>
      {showHeader && (
        <h3 className="text-sm font-semibold text-gray-900 mb-4">
          {isNativeMobile ? 'Share This Artwork' : 'Share This Artwork'}
        </h3>
      )}

      <div className={isNativeMobile ? 'flex justify-start' : 'flex items-center gap-4'}>
        {!isNativeMobile && <span className="text-xs text-gray-600">Share on:</span>}

        <SmartShareButtons
          content={shareContent}
          size={isNativeMobile ? 'lg' : 'md'}
          layout={isNativeMobile ? 'row' : 'row'}
          showLabels={false}
          onShare={onShare}
        />
      </div>

      {!isNativeMobile && (
        <p className="text-xs text-gray-500 mt-3">
          Share this artwork with your network and help emerging artists get discovered.
        </p>
      )}
    </div>
  );
}
```

### 5. Update Artwork Page with Smart Share

Update **src/pages/ArtworkPage.tsx**:

```typescript
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ArtworkShareWrapper } from '../components/artwork/ArtworkShareWrapper';
import { getAbsoluteUrl } from '../utils/openGraph';

interface ArtworkData {
  title: string;
  slug: string;
  description?: string;
  display_url: string;
  created_at?: string;
  artist_slug?: string;
  artist_name?: string;
}

export default function ArtworkPage() {
  const { artistSlug, gallerySlug, collectionSlug, artworkSlug } = useParams<{
    artistSlug: string;
    gallerySlug: string;
    collectionSlug: string;
    artworkSlug: string;
  }>();
  const [artwork, setArtwork] = useState<ArtworkData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchArtwork = async () => {
      try {
        const response = await fetch(
          `/api/public/artworks/${artworkSlug}?artist=${artistSlug}&gallery=${gallerySlug}&collection=${collectionSlug}`
        );
        const data = await response.json();
        setArtwork(data);
      } catch (error) {
        console.error('Failed to fetch artwork:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchArtwork();
  }, [artworkSlug, artistSlug, gallerySlug, collectionSlug]);

  if (loading) return <div>Loading...</div>;
  if (!artwork) return <div>Artwork not found</div>;

  const pageUrl = getAbsoluteUrl(`/${artistSlug}/${gallerySlug}/${collectionSlug}/${artworkSlug}`);

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="mb-8">
        <img
          src={artwork.display_url}
          alt={artwork.title}
          className="w-full h-auto rounded-lg shadow-lg"
        />
      </div>

      <div className="bg-white rounded-lg p-6">
        <h1 className="text-3xl font-bold mb-2">{artwork.title}</h1>

        {artwork.description && (
          <p className="text-gray-600 mb-6">{artwork.description}</p>
        )}

        {/* Smart Share Wrapper - handles native and fallback */}
        <ArtworkShareWrapper
          title={artwork.title}
          description={artwork.description}
          imageUrl={artwork.display_url}
          pageUrl={pageUrl}
          artistName={artwork.artist_name}
          onShare={() => {
            // Optional: track analytics when shared
            console.log('Artwork shared:', artwork.title);
          }}
        />
      </div>
    </div>
  );
}
```

### 6. Create Native Share Detection Example

Create **src/components/NativeShareDemo.tsx** (for testing):

```typescript
import React, { useState } from 'react';
import { useNativeShare } from '../hooks/useNativeShare';
import { shouldUseNativeShare, isNativeShareAvailable, isMobileDevice } from '../utils/nativeShare';
import { ShareData } from '../utils/nativeShare';

export function NativeShareDemo() {
  const { canShare, share } = useNativeShare();
  const [shareData] = useState<ShareData>({
    title: 'Check This Out!',
    text: 'I found this amazing artwork on VFA.gallery',
    url: 'https://vfa.gallery/sample-artist/gallery/collection/artwork',
  });

  const nativeAvailable = isNativeShareAvailable();
  const isMobile = isMobileDevice();
  const shouldUse = shouldUseNativeShare();

  return (
    <div className="p-8 bg-gray-50 rounded-lg max-w-2xl">
      <h2 className="text-2xl font-bold mb-6">Native Share API Detection</h2>

      <div className="bg-white p-6 rounded-lg space-y-4 mb-6">
        <div className="flex justify-between items-center border-b pb-3">
          <span className="font-semibold">Native Share API Available:</span>
          <span className={nativeAvailable ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>
            {nativeAvailable ? '✓ Yes' : '✗ No'}
          </span>
        </div>

        <div className="flex justify-between items-center border-b pb-3">
          <span className="font-semibold">Mobile Device Detected:</span>
          <span className={isMobile ? 'text-green-600 font-bold' : 'text-gray-600 font-bold'}>
            {isMobile ? '✓ Yes' : '✗ No (Desktop)'}
          </span>
        </div>

        <div className="flex justify-between items-center">
          <span className="font-semibold">Use Native Share:</span>
          <span className={shouldUse ? 'text-green-600 font-bold' : 'text-gray-600 font-bold'}>
            {shouldUse ? '✓ Yes' : '✗ No (Use Fallback)'}
          </span>
        </div>
      </div>

      <div className="bg-blue-50 p-4 rounded-lg mb-6">
        <p className="text-sm text-blue-800">
          {shouldUse
            ? 'Native share dialog will appear when you click the button below.'
            : 'Custom share buttons will be displayed. Native Share API is not available on this device/browser.'}
        </p>
      </div>

      <button
        onClick={() => share(shareData)}
        disabled={!canShare}
        className={`
          w-full px-6 py-3
          font-semibold rounded-lg
          transition-all duration-200
          ${
            canShare
              ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer active:scale-95'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }
        `}
      >
        {canShare ? '↗ Try Native Share' : 'Native Share Not Available'}
      </button>

      <div className="mt-6 p-4 bg-gray-100 rounded-lg">
        <p className="text-xs text-gray-600 font-mono">
          <strong>Share Data:</strong>
          <br />
          {JSON.stringify(shareData, null, 2)}
        </p>
      </div>
    </div>
  );
}
```

---

## Files to Create/Modify

### Create:
- `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/utils/nativeShare.ts`
- `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/hooks/useNativeShare.ts`
- `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/components/ui/SmartShareButtons.tsx`
- `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/components/artwork/ArtworkShareWrapper.tsx`
- `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/components/NativeShareDemo.tsx` (optional, for testing)

### Modify:
- `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/pages/ArtworkPage.tsx`

---

## Verification

### 1. Test Native Share Detection on Mobile

On iPhone or Android device with Chrome/Safari:

1. Open browser DevTools (if available)
2. Navigate to artwork page
3. Verify:
   - "Share This Artwork" shows single large button
   - Button text: "↗ Share"
   - Native share sheet appears on click
   - Can select Messages, Mail, AirDrop, etc.
   - Artwork title and URL included in share data

### 2. Test Native Share on iOS

On iPhone/iPad:

1. Open artwork page
2. Click share button
3. Verify native iOS share sheet appears with:
   - Messages
   - Mail
   - Notes
   - AirDrop
   - Other installed share services
4. Select a service and verify artwork URL included
5. Verify "Shared successfully!" toast appears

### 3. Test Native Share on Android

On Android device:

1. Open artwork page
2. Click share button
3. Verify native Android share sheet appears with:
   - Installed messaging apps
   - Email
   - Social media apps
   - Other services
4. Select a service and verify artwork URL included
5. Verify "Shared successfully!" toast appears

### 4. Test Fallback on Desktop

On desktop browser:

1. Open artwork page
2. Verify ShareButtons component displays instead of native button
3. Verify shows: Copy Link, Twitter, Facebook, Pinterest buttons
4. Test each button works
5. Test copy button shows correct toast

### 5. Test Fallback on Unsupported Browsers

On older browsers without native Share API:

1. Use browser that doesn't support navigator.share
2. Navigate to artwork page
3. Verify custom ShareButtons displays
4. Verify all buttons functional
5. No errors in console

### 6. Test Share Data Content

On mobile:

1. Click share button
2. Verify share data includes:
   - **Title:** Artwork title
   - **Text:** Artwork description + "shared from VFA.gallery"
   - **URL:** Correct page URL
3. Share to Messages/Mail and verify content

### 7. Test Error Handling

1. On mobile, click share button
2. Start to share but cancel before completing
3. Verify:
   - No error toast appears (cancel is expected)
   - App remains in good state
   - Can click share again

### 8. Test Toast Notifications

**On Mobile (Native Share):**
- Success: "Shared successfully!"
- Error: "Share failed: [reason]"

**On Desktop (Fallback):**
- Copy Link: "Link copied to clipboard!"
- Errors for other share methods

### 9. Test Responsive Layout

**Mobile:**
- Share button takes appropriate width
- Full width or auto depending on layout
- Touch-friendly size (minimum 44x44px)

**Desktop:**
- ShareButtons with multiple button options
- Icons only layout
- Proper spacing

### 10. Test Multiple Share Methods

1. Test native share on mobile
2. Navigate back to same page
3. Test again - verify consistent behavior
4. Test multiple artworks - verify correct data for each

### 11. Test Callback Execution

In ArtworkPage or parent component:

```typescript
<ArtworkShareWrapper
  onShare={() => console.log('Shared!')}
  ...
/>
```

1. Click share button
2. Complete share
3. Verify callback executes
4. Can use for analytics

### 12. Test TypeScript

```bash
npx tsc --noEmit
```

Should have no errors in strict mode.

### 13. Test Detection Functions

Create a test component to verify detection:

```typescript
import { shouldUseNativeShare, isNativeShareAvailable, isMobileDevice } from '../utils/nativeShare';

// Log results
console.log('Native Share Available:', isNativeShareAvailable());
console.log('Is Mobile:', isMobileDevice());
console.log('Should Use Native:', shouldUseNativeShare());
```

Verify results match actual device/browser.

### 14. Test Browser Compatibility

Test on:
- Chrome (mobile & desktop)
- Safari (iOS & macOS)
- Firefox (mobile & desktop)
- Edge (Windows & mobile)
- Samsung Internet (Android)

Expected results:
- Mobile browsers: Native share works
- Desktop browsers: Fallback to custom buttons
- Older browsers: Graceful fallback

### 15. Test useNativeShare Hook

In a test component:

```typescript
const { canShare, share } = useNativeShare({ showToast: true });

// canShare should match shouldUseNativeShare()
// share() should trigger native share or error handling
```

Verify hook behavior on mobile and desktop.

---

## Success Criteria

- Native Share API detected correctly on mobile devices
- Native share sheet appears on iOS and Android
- Fallback ShareButtons appear on desktop
- Share data includes correct title, text, and URL
- Toast notifications display for success/error
- Seamless experience between native and fallback
- No console errors
- TypeScript strict mode passes
- Proper error handling for cancelled shares
- Works on all major browsers and mobile OS
- Responsive layout on mobile and desktop
- All callbacks (onShare, onSuccess, onError) execute correctly
