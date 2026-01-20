# Build 154: UI Share Buttons Component

## Goal

Create a reusable share buttons component for artwork pages with options to copy link, share to Twitter, Facebook, and Pinterest. Copy link action shows toast notification confirmation.

---

## Spec Extract

From **01-TECHNICAL-SPEC.md** and UI Requirements:

- **Share Button Options:**
  - Copy Link - Copy page URL to clipboard with toast confirmation
  - Twitter - Open Twitter share dialog with pre-filled text
  - Facebook - Open Facebook share dialog
  - Pinterest - Open Pinterest save dialog with artwork image
  - (Optional) Email - Open email client

- **Behavior:**
  - Each button opens share destination in new tab/window
  - Copy Link shows success toast: "Link copied to clipboard!"
  - Social buttons use standard share URLs with page URL and title
  - Responsive: Row on desktop, stack on mobile if needed
  - Accessible with proper aria labels

- **Integration Points:**
  - Used on artwork detail pages
  - Can be used in modal/overlay
  - Uses toast system (build 28) for feedback

---

## Prerequisites

- **28-REACT-TOAST-SYSTEM.md** - Toast notifications available
- **24-REACT-ROUTER-SETUP.md** - React Router for link generation
- **152-SEO-OPEN-GRAPH.md** - Meta tags for proper sharing

---

## Steps

### 1. Create Share Utilities

Create **src/utils/shareUrls.ts**:

```typescript
/**
 * Generate share URLs for various social platforms
 */

export interface ShareContent {
  url: string;
  title: string;
  description?: string;
  image?: string;
}

/**
 * Generate Twitter share URL
 * Format: https://twitter.com/intent/tweet?url=...&text=...&via=vfagallery
 */
export function getTwitterShareUrl(content: ShareContent): string {
  const params = new URLSearchParams({
    url: content.url,
    text: `${content.title} on VFA.gallery`,
    via: 'vfagallery',
  });

  return `https://twitter.com/intent/tweet?${params.toString()}`;
}

/**
 * Generate Facebook share URL
 * Format: https://www.facebook.com/sharer/sharer.php?u=...&quote=...
 */
export function getFacebookShareUrl(content: ShareContent): string {
  const params = new URLSearchParams({
    u: content.url,
    quote: `${content.title} - Check out this artwork on VFA.gallery`,
  });

  return `https://www.facebook.com/sharer/sharer.php?${params.toString()}`;
}

/**
 * Generate Pinterest share URL
 * Format: https://pinterest.com/pin/create/button/?url=...&media=...&description=...
 */
export function getPinterestShareUrl(content: ShareContent): string {
  const params = new URLSearchParams({
    url: content.url,
    media: content.image || content.url,
    description: `${content.title}\n${content.description || 'Amazing artwork on VFA.gallery'}`,
  });

  return `https://pinterest.com/pin/create/button/?${params.toString()}`;
}

/**
 * Generate email share URL
 * Format: mailto:?subject=...&body=...
 */
export function getEmailShareUrl(content: ShareContent): string {
  const subject = encodeURIComponent(`Check out: ${content.title}`);
  const body = encodeURIComponent(
    `I found this amazing artwork on VFA.gallery!\n\n${content.title}\n${content.description || ''}\n\nView it here: ${content.url}`
  );

  return `mailto:?subject=${subject}&body=${body}`;
}

/**
 * Copy URL to clipboard
 * Returns true if successful, false otherwise
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    // Use modern Clipboard API if available
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    } else {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);

      const success = document.execCommand('copy');
      textArea.remove();

      return success;
    }
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
}

/**
 * Open share URL in a new window
 * Size optimized for share dialogs
 */
export function openShareWindow(url: string, title: string = 'Share'): Window | null {
  const width = 600;
  const height = 400;
  const left = window.screenX + (window.outerWidth - width) / 2;
  const top = window.screenY + (window.outerHeight - height) / 2;

  return window.open(
    url,
    title,
    `width=${width},height=${height},left=${left},top=${top},resizable,scrollbars`
  );
}
```

### 2. Create Share Buttons Component

Create **src/components/ui/ShareButtons.tsx**:

```typescript
import React, { useState } from 'react';
import { useToast } from '../../contexts/ToastContext';
import {
  getTwitterShareUrl,
  getFacebookShareUrl,
  getPinterestShareUrl,
  getEmailShareUrl,
  copyToClipboard,
  openShareWindow,
  ShareContent,
} from '../../utils/shareUrls';

interface ShareButtonsProps {
  /**
   * Content to share (URL, title, description, image)
   */
  content: ShareContent;

  /**
   * Which platforms to show
   * Default: all platforms
   */
  platforms?: Array<'twitter' | 'facebook' | 'pinterest' | 'email' | 'copy'>;

  /**
   * Button size variant
   * Default: 'md'
   */
  size?: 'sm' | 'md' | 'lg';

  /**
   * Display style
   * Default: 'icons'
   */
  style?: 'icons' | 'text' | 'both';

  /**
   * Layout direction
   * Default: 'row'
   */
  layout?: 'row' | 'column';

  /**
   * Custom className for container
   */
  className?: string;

  /**
   * Show labels below icons
   * Default: false
   */
  showLabels?: boolean;
}

interface ButtonConfig {
  id: 'twitter' | 'facebook' | 'pinterest' | 'email' | 'copy';
  label: string;
  icon: string;
  color: string;
  bgColor: string;
  hoverBgColor: string;
  getUrl?: (content: ShareContent) => string;
}

const BUTTON_CONFIGS: Record<string, ButtonConfig> = {
  twitter: {
    id: 'twitter',
    label: 'Twitter',
    icon: '𝕏',
    color: 'text-white',
    bgColor: 'bg-black',
    hoverBgColor: 'hover:bg-gray-800',
  },
  facebook: {
    id: 'facebook',
    label: 'Facebook',
    icon: 'f',
    color: 'text-white',
    bgColor: 'bg-blue-600',
    hoverBgColor: 'hover:bg-blue-700',
  },
  pinterest: {
    id: 'pinterest',
    label: 'Pinterest',
    icon: 'P',
    color: 'text-white',
    bgColor: 'bg-red-600',
    hoverBgColor: 'hover:bg-red-700',
  },
  email: {
    id: 'email',
    label: 'Email',
    icon: '✉',
    color: 'text-white',
    bgColor: 'bg-gray-600',
    hoverBgColor: 'hover:bg-gray-700',
  },
  copy: {
    id: 'copy',
    label: 'Copy Link',
    icon: '⎘',
    color: 'text-white',
    bgColor: 'bg-green-600',
    hoverBgColor: 'hover:bg-green-700',
  },
};

const SIZE_CLASSES = {
  sm: 'w-8 h-8 text-sm',
  md: 'w-10 h-10 text-base',
  lg: 'w-12 h-12 text-lg',
};

export function ShareButtons({
  content,
  platforms = ['copy', 'twitter', 'facebook', 'pinterest', 'email'],
  size = 'md',
  style = 'icons',
  layout = 'row',
  className = '',
  showLabels = false,
}: ShareButtonsProps) {
  const { success, error } = useToast();
  const [copiedTimeout, setCopiedTimeout] = useState<NodeJS.Timeout | null>(null);

  const handleShareClick = async (platform: string, event: React.MouseEvent) => {
    event.preventDefault();

    const config = BUTTON_CONFIGS[platform];
    if (!config) return;

    if (platform === 'copy') {
      // Copy to clipboard
      const success_ = await copyToClipboard(content.url);
      if (success_) {
        success('Link copied to clipboard!');
      } else {
        error('Failed to copy link. Please try again.');
      }
    } else {
      // Open share window
      let shareUrl = '';
      switch (platform) {
        case 'twitter':
          shareUrl = getTwitterShareUrl(content);
          break;
        case 'facebook':
          shareUrl = getFacebookShareUrl(content);
          break;
        case 'pinterest':
          shareUrl = getPinterestShareUrl(content);
          break;
        case 'email':
          shareUrl = getEmailShareUrl(content);
          break;
      }

      if (shareUrl) {
        if (platform === 'email') {
          // Email uses mailto, just open it
          window.location.href = shareUrl;
        } else {
          // Social platforms open in new window
          openShareWindow(shareUrl, `Share on ${config.label}`);
        }
      }
    }
  };

  const containerClass = layout === 'row' ? 'flex flex-row gap-2' : 'flex flex-col gap-3';
  const sizeClass = SIZE_CLASSES[size];

  return (
    <div className={`${containerClass} ${className}`}>
      {platforms
        .map((platform) => BUTTON_CONFIGS[platform])
        .filter(Boolean)
        .map((config) => (
          <div
            key={config.id}
            className={showLabels && layout === 'column' ? 'flex flex-col items-center gap-1' : ''}
          >
            <button
              onClick={(e) => handleShareClick(config.id, e)}
              className={`
                ${sizeClass}
                ${config.bgColor}
                ${config.hoverBgColor}
                ${config.color}
                rounded-lg
                flex items-center justify-center
                font-bold
                transition-all duration-200
                transform hover:scale-105
                active:scale-95
                focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
                flex-shrink-0
              `}
              aria-label={`Share on ${config.label}`}
              title={config.label}
            >
              {style === 'icons' || style === 'both' ? (
                <span className={`${size === 'sm' ? 'text-xs' : size === 'md' ? 'text-sm' : 'text-base'}`}>
                  {config.icon}
                </span>
              ) : null}
              {(style === 'text' || style === 'both') && size !== 'sm' ? (
                <span className="ml-1 text-xs font-semibold">{config.label}</span>
              ) : null}
            </button>

            {showLabels && layout === 'column' && (
              <span className="text-xs text-gray-600 text-center font-medium">{config.label}</span>
            )}
          </div>
        ))}
    </div>
  );
}
```

### 3. Create Share Buttons Container Variant

Create **src/components/ui/ShareButtonsRow.tsx** (simplified preset):

```typescript
import React from 'react';
import { ShareButtons } from './ShareButtons';
import { ShareContent } from '../../utils/shareUrls';

interface ShareButtonsRowProps {
  /**
   * Content to share
   */
  content: ShareContent;

  /**
   * Show labels under buttons
   * Default: false
   */
  showLabels?: boolean;

  /**
   * Custom className
   */
  className?: string;
}

/**
 * Preset ShareButtons component for horizontal row layout
 * Shows: Copy Link, Twitter, Facebook, Pinterest
 */
export function ShareButtonsRow({ content, showLabels = false, className = '' }: ShareButtonsRowProps) {
  return (
    <ShareButtons
      content={content}
      platforms={['copy', 'twitter', 'facebook', 'pinterest']}
      size="md"
      style="icons"
      layout="row"
      className={className}
      showLabels={showLabels}
    />
  );
}
```

### 4. Create Share Section for Artwork Page

Create **src/components/artwork/ArtworkShareSection.tsx**:

```typescript
import React from 'react';
import { ShareButtons } from '../ui/ShareButtons';
import { ShareContent } from '../../utils/shareUrls';

interface ArtworkShareSectionProps {
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
}

export function ArtworkShareSection({
  title,
  description,
  imageUrl,
  pageUrl,
  artistName,
}: ArtworkShareSectionProps) {
  const shareContent: ShareContent = {
    url: pageUrl,
    title,
    description: description || (artistName ? `by ${artistName}` : 'Amazing artwork on VFA.gallery'),
    image: imageUrl,
  };

  return (
    <div className="border-t border-gray-200 pt-6">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Share This Artwork</h3>

      <div className="flex items-center gap-4">
        <span className="text-xs text-gray-600">Share on:</span>
        <ShareButtons
          content={shareContent}
          platforms={['copy', 'twitter', 'facebook', 'pinterest']}
          size="md"
          style="icons"
          layout="row"
        />
      </div>

      <p className="text-xs text-gray-500 mt-3">
        Share this artwork with your network and help emerging artists get discovered.
      </p>
    </div>
  );
}
```

### 5. Update Artwork Page to Include Share Buttons

Update **src/pages/ArtworkPage.tsx**:

```typescript
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ArtworkShareSection } from '../components/artwork/ArtworkShareSection';
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

        {/* Share Section */}
        <ArtworkShareSection
          title={artwork.title}
          description={artwork.description}
          imageUrl={artwork.display_url}
          pageUrl={pageUrl}
          artistName={artwork.artist_name}
        />
      </div>
    </div>
  );
}
```

### 6. Create Share Buttons Story/Example

Create **src/components/ShareButtonsExample.tsx** (for testing):

```typescript
import { ShareButtons } from './ui/ShareButtons';
import { ShareButtonsRow } from './ui/ShareButtonsRow';
import { ShareContent } from '../utils/shareUrls';

const exampleContent: ShareContent = {
  url: 'https://vfa.gallery/sample-artist/gallery/collection/artwork',
  title: 'Amazing Artwork',
  description: 'A stunning piece by a talented artist',
  image: 'https://via.placeholder.com/1200x630',
};

export function ShareButtonsExample() {
  return (
    <div className="p-8 bg-gray-50 space-y-12">
      <section>
        <h2 className="text-2xl font-bold mb-6">Share Buttons - Icons Only</h2>
        <ShareButtons
          content={exampleContent}
          style="icons"
          layout="row"
          className="bg-white p-4 rounded"
        />
      </section>

      <section>
        <h2 className="text-2xl font-bold mb-6">Share Buttons - Text + Icons</h2>
        <ShareButtons
          content={exampleContent}
          style="both"
          layout="row"
          size="md"
          className="bg-white p-4 rounded"
        />
      </section>

      <section>
        <h2 className="text-2xl font-bold mb-6">Share Buttons - Vertical Stack</h2>
        <ShareButtons
          content={exampleContent}
          style="icons"
          layout="column"
          showLabels={true}
          className="bg-white p-4 rounded w-fit"
        />
      </section>

      <section>
        <h2 className="text-2xl font-bold mb-6">Share Buttons - Row Preset</h2>
        <ShareButtonsRow
          content={exampleContent}
          className="bg-white p-4 rounded"
        />
      </section>

      <section>
        <h2 className="text-2xl font-bold mb-6">Share Buttons - Small Size</h2>
        <ShareButtons
          content={exampleContent}
          size="sm"
          style="icons"
          layout="row"
          className="bg-white p-4 rounded"
        />
      </section>

      <section>
        <h2 className="text-2xl font-bold mb-6">Share Buttons - Large Size</h2>
        <ShareButtons
          content={exampleContent}
          size="lg"
          style="icons"
          layout="row"
          className="bg-white p-4 rounded"
        />
      </section>
    </div>
  );
}
```

---

## Files to Create/Modify

### Create:
- `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/utils/shareUrls.ts`
- `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/components/ui/ShareButtons.tsx`
- `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/components/ui/ShareButtonsRow.tsx`
- `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/components/artwork/ArtworkShareSection.tsx`
- `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/components/ShareButtonsExample.tsx` (optional, for testing)

### Modify:
- `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/pages/ArtworkPage.tsx`

---

## Verification

### 1. Test Copy Link Button

1. Click Copy Link button
2. Verify toast appears: "Link copied to clipboard!"
3. Paste in another app (Cmd+V or Ctrl+V)
4. Verify correct URL pasted

### 2. Test Twitter Share Button

1. Click Twitter button
2. Verify new window opens with Twitter share dialog
3. Verify pre-filled text: "[Artwork Title] on VFA.gallery"
4. Verify page URL included in share
5. Close window without sharing

### 3. Test Facebook Share Button

1. Click Facebook button
2. Verify new window opens with Facebook share dialog
3. Verify quote: "[Artwork Title] - Check out this artwork on VFA.gallery"
4. Verify page URL included
5. Close window without sharing

### 4. Test Pinterest Share Button

1. Click Pinterest button
2. Verify new window opens with Pinterest save dialog
3. Verify artwork image pre-loaded
4. Verify description includes artwork title
5. Close window without saving

### 5. Test Email Share Button

1. Click Email button
2. Verify email client opens with pre-filled subject and body
3. Verify subject includes artwork title
4. Verify body includes artwork title, description, and URL
5. Close without sending

### 6. Test Copy Button Feedback

1. Test on artwork page
2. Click copy button
3. Verify:
   - Toast appears immediately
   - Toast disappears after 3 seconds
   - No errors in console
   - URL is correctly copied

### 7. Test Button Sizes

Test all size variants:
- **Small (sm):** 32px icon buttons
- **Medium (md):** 40px icon buttons (default)
- **Large (lg):** 48px icon buttons

### 8. Test Button Styles

Test all style variants:
- **icons:** Only icon symbols
- **text:** Only text labels
- **both:** Icon + text (for larger sizes)

### 9. Test Layouts

Test both layout options:
- **row:** Buttons horizontal (default)
- **column:** Buttons stacked vertically with optional labels

### 10. Test Accessibility

- Each button has `aria-label`
- Buttons focusable with Tab key
- Enter/Space activates button
- Hover/focus states clear
- Color contrast sufficient for WCAG AA

### 11. Test Mobile Responsive

- Buttons stack on small screens if needed
- Touch targets at least 44x44px
- No horizontal scroll on mobile
- All buttons clickable on touch

### 12. Test Share Section Component

In artwork page:
1. Navigate to artwork page
2. Scroll down to share section
3. Verify section displays with title
4. Verify all 4 buttons present
5. Test each button works
6. Verify section only appears on appropriate pages

### 13. Test Error Handling

1. Block clipboard permission
2. Try to copy link
3. Verify error toast: "Failed to copy link. Please try again."
4. Verify graceful degradation

### 14. Test TypeScript

```bash
npx tsc --noEmit
```

Should have no errors in strict mode.

### 15. Test URL Encoding

Verify all share URLs properly encode:
- Special characters in title
- Special characters in description
- Image URLs with query parameters
- Long URLs properly truncated where needed

---

## Success Criteria

- Copy Link button copies correct URL to clipboard
- Copy Link shows success toast notification
- Twitter button opens share dialog with pre-filled text
- Facebook button opens share dialog with pre-filled quote
- Pinterest button opens save dialog with image
- Email button opens email client with pre-filled content
- All buttons open in new windows/tabs
- All buttons have proper aria-labels
- Buttons responsive to size and style props
- Share buttons appear on artwork detail pages
- No console errors
- TypeScript strict mode passes
- URL encoding correct for all platforms
- Mobile touch targets adequate (44x44px minimum)
