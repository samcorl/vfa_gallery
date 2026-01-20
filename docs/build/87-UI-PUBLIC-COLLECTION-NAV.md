# Build 87: Collection Navigation Component

## Goal

Create a polished previous/next collection navigation component with keyboard support, animated tooltips, and accessible button patterns for browsing between collections in the same gallery.

---

## Spec Extract

**Navigation Features:**
- Previous/next collection buttons with arrow icons
- Keyboard navigation: Left arrow → previous, Right arrow → next
- Tooltips showing collection names on hover/focus
- Buttons disabled/hidden when no adjacent collection exists
- Smooth animations and transitions
- Touch-friendly on mobile (larger tap targets)
- Accessible keyboard focus indicators
- Semantic HTML with proper ARIA labels

**Layout:**
- Grid layout on both mobile and desktop
- Previous button on left (with left arrow)
- Next button on right (with right arrow)
- Empty space if collection doesn't exist
- Smooth hover/focus transitions

---

## Prerequisites

**Must complete before starting:**
- **85-UI-PUBLIC-COLLECTION.md** - Collection page using this component
- **84-API-PUBLIC-COLLECTION.md** - Navigation data from API

**Reason:** This component integrates with the collection page and uses navigation data.

---

## Steps

### Step 1: Create Enhanced Navigation Component

Create the advanced navigation component with keyboard support:

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/public/CollectionNavigation.tsx`

```typescript
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

interface CollectionNavProps {
  previousCollection: { slug: string; name: string } | null;
  nextCollection: { slug: string; name: string } | null;
  artist: string;
  gallery: string;
}

export default function CollectionNavigation({
  previousCollection,
  nextCollection,
  artist,
  gallery,
}: CollectionNavProps) {
  const navigate = useNavigate();
  const [hoveredButton, setHoveredButton] = useState<'prev' | 'next' | null>(null);

  // Keyboard navigation support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only respond to arrow keys if not typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === 'ArrowLeft' && previousCollection) {
        e.preventDefault();
        navigate(`/${artist}/${gallery}/${previousCollection.slug}`);
      } else if (e.key === 'ArrowRight' && nextCollection) {
        e.preventDefault();
        navigate(`/${artist}/${gallery}/${nextCollection.slug}`);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previousCollection, nextCollection, artist, gallery, navigate]);

  // Don't render if no navigation available
  if (!previousCollection && !nextCollection) {
    return null;
  }

  const handleNavigatePrevious = () => {
    if (previousCollection) {
      navigate(`/${artist}/${gallery}/${previousCollection.slug}`);
    }
  };

  const handleNavigateNext = () => {
    if (nextCollection) {
      navigate(`/${artist}/${gallery}/${nextCollection.slug}`);
    }
  };

  return (
    <nav
      className="flex flex-col sm:flex-row gap-4 sm:gap-8"
      aria-label="Collection navigation"
    >
      {/* Previous Collection Button */}
      <div className="flex-1">
        {previousCollection ? (
          <button
            onClick={handleNavigatePrevious}
            onMouseEnter={() => setHoveredButton('prev')}
            onMouseLeave={() => setHoveredButton(null)}
            className="group relative w-full sm:w-auto flex flex-col items-start space-y-2 p-4 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
            aria-label={`Previous: ${previousCollection.name}`}
            title={previousCollection.name}
          >
            {/* Icon */}
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 group-hover:bg-blue-100 dark:group-hover:bg-blue-900 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              <ChevronLeftIcon className="w-5 h-5 transition-transform group-hover:-translate-x-0.5" />
            </span>

            {/* Label */}
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Previous
            </span>

            {/* Collection Name */}
            <span className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate max-w-xs sm:max-w-sm">
              {previousCollection.name}
            </span>

            {/* Keyboard hint */}
            <span className="text-xs text-gray-400 dark:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity">
              ← Left Arrow
            </span>

            {/* Animated underline */}
            <div className="absolute bottom-0 left-4 h-0.5 bg-blue-500 w-0 group-hover:w-12 transition-all duration-300" />
          </button>
        ) : (
          // Empty placeholder to maintain layout
          <div className="h-24 sm:h-auto" />
        )}
      </div>

      {/* Next Collection Button */}
      <div className="flex-1">
        {nextCollection ? (
          <button
            onClick={handleNavigateNext}
            onMouseEnter={() => setHoveredButton('next')}
            onMouseLeave={() => setHoveredButton(null)}
            className="group relative w-full sm:w-auto flex flex-col items-end space-y-2 p-4 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 text-right"
            aria-label={`Next: ${nextCollection.name}`}
            title={nextCollection.name}
          >
            {/* Icon */}
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 group-hover:bg-blue-100 dark:group-hover:bg-blue-900 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              <ChevronRightIcon className="w-5 h-5 transition-transform group-hover:translate-x-0.5" />
            </span>

            {/* Label */}
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Next
            </span>

            {/* Collection Name */}
            <span className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate max-w-xs sm:max-w-sm">
              {nextCollection.name}
            </span>

            {/* Keyboard hint */}
            <span className="text-xs text-gray-400 dark:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity">
              Right Arrow →
            </span>

            {/* Animated underline */}
            <div className="absolute bottom-0 right-4 h-0.5 bg-blue-500 w-0 group-hover:w-12 transition-all duration-300" />
          </button>
        ) : (
          // Empty placeholder to maintain layout
          <div className="h-24 sm:h-auto" />
        )}
      </div>
    </nav>
  );
}
```

### Step 2: Create Keyboard Navigation Hook

Create a reusable hook for keyboard navigation:

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/hooks/useKeyboardNavigation.ts`

```typescript
import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

interface NavigationKeys {
  ArrowLeft?: {
    url: string;
    description: string;
  };
  ArrowRight?: {
    url: string;
    description: string;
  };
}

/**
 * Hook for handling keyboard navigation with arrow keys
 * Respects content-editable elements and input fields
 */
export function useKeyboardNavigation(navigationKeys: NavigationKeys) {
  const navigate = useNavigate();

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Don't navigate if user is typing in an input
      const activeElement = document.activeElement as HTMLElement;
      if (
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        activeElement?.isContentEditable
      ) {
        return;
      }

      if (e.key === 'ArrowLeft' && navigationKeys.ArrowLeft) {
        e.preventDefault();
        navigate(navigationKeys.ArrowLeft.url);
      } else if (e.key === 'ArrowRight' && navigationKeys.ArrowRight) {
        e.preventDefault();
        navigate(navigationKeys.ArrowRight.url);
      }
    },
    [navigationKeys, navigate]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
```

### Step 3: Create Navigation Button Component

Create a reusable navigation button:

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/public/NavigationButton.tsx`

```typescript
import React, { ReactNode } from 'react';

interface NavigationButtonProps {
  direction: 'previous' | 'next';
  collectionName: string;
  onClick: () => void;
  icon: ReactNode;
  keyboardHint: string;
  ariaLabel: string;
}

export default function NavigationButton({
  direction,
  collectionName,
  onClick,
  icon,
  keyboardHint,
  ariaLabel,
}: NavigationButtonProps) {
  const isPrevious = direction === 'previous';

  return (
    <div className="flex-1">
      <button
        onClick={onClick}
        className={`group relative w-full sm:w-auto flex flex-col space-y-2 p-4 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 ${
          isPrevious ? 'items-start' : 'items-end'
        } ${!isPrevious ? 'text-right' : ''}`}
        aria-label={ariaLabel}
        title={collectionName}
      >
        {/* Icon Container */}
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 group-hover:bg-blue-100 dark:group-hover:bg-blue-900 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
          {icon}
        </span>

        {/* Direction Label */}
        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          {direction}
        </span>

        {/* Collection Name */}
        <span className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate max-w-xs sm:max-w-sm">
          {collectionName}
        </span>

        {/* Keyboard Hint */}
        <span className="text-xs text-gray-400 dark:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity">
          {keyboardHint}
        </span>

        {/* Animated Underline */}
        <div
          className={`absolute bottom-0 h-0.5 bg-blue-500 w-0 group-hover:w-12 transition-all duration-300 ${
            isPrevious ? 'left-4' : 'right-4'
          }`}
        />
      </button>
    </div>
  );
}
```

### Step 4: Create CSS Module for Navigation

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/public/CollectionNavigation.module.css`

```css
.navigationContainer {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-top: 3rem;
  padding-top: 2rem;
  border-top: 1px solid rgb(229 231 235);
}

.navigationContainer:dark {
  border-top-color: rgb(55 65 81);
}

@media (min-width: 640px) {
  .navigationContainer {
    flex-direction: row;
    gap: 2rem;
  }
}

.navButton {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  padding: 1rem;
  border-radius: 0.5rem;
  border: none;
  background-color: transparent;
  cursor: pointer;
  transition: all 200ms;
  focus-visible: outline 2px solid rgb(59 130 246);
  focus-visible: outline-offset: 2px;
}

.navButton:hover {
  background-color: rgb(249 250 251);
}

.navButton:dark:hover {
  background-color: rgb(31 41 55);
}

.navButton:focus-visible {
  outline: 2px solid rgb(59 130 246);
  outline-offset: 2px;
}

.navButton.previous {
  align-items: flex-start;
}

.navButton.next {
  align-items: flex-end;
  text-align: right;
}

.navIcon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  background-color: rgb(243 244 246);
  transition: all 200ms;
}

.navIcon:dark {
  background-color: rgb(55 65 81);
}

.navButton:hover .navIcon {
  background-color: rgb(219 234 254);
  color: rgb(37 99 235);
}

.navButton:dark:hover .navIcon {
  background-color: rgb(30 58 138);
  color: rgb(147 197 253);
}

.navLabel {
  font-size: 0.75rem;
  font-weight: 600;
  color: rgb(107 114 128);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.navLabel:dark {
  color: rgb(156 163 175);
}

.navName {
  font-size: 1rem;
  font-weight: 600;
  color: rgb(17 24 39);
  transition: color 200ms;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 20rem;
}

.navName:dark {
  color: rgb(243 244 246);
}

.navButton:hover .navName {
  color: rgb(37 99 235);
}

.navButton:dark:hover .navName {
  color: rgb(147 197 253);
}

@media (min-width: 640px) {
  .navName {
    font-size: 1.125rem;
  }
}

.keyboardHint {
  font-size: 0.75rem;
  color: rgb(156 163 175);
  opacity: 0;
  transition: opacity 200ms;
}

.keyboardHint:dark {
  color: rgb(107 114 128);
}

.navButton:hover .keyboardHint {
  opacity: 1;
}

.underline {
  position: absolute;
  bottom: 0;
  height: 2px;
  background-color: rgb(59 130 246);
  width: 0;
  transition: width 300ms;
}

.navButton.previous .underline {
  left: 1rem;
}

.navButton.next .underline {
  right: 1rem;
}

.navButton:hover .underline {
  width: 3rem;
}
```

### Step 5: Add Keyboard Shortcut Help

Create a keyboard shortcuts help component:

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/public/KeyboardShortcutsHelp.tsx`

```typescript
import React, { useState } from 'react';

export default function KeyboardShortcutsHelp() {
  const [showHelp, setShowHelp] = useState(false);

  return (
    <>
      {/* Help Toggle Button */}
      <button
        onClick={() => setShowHelp(!showHelp)}
        className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 w-10 h-10 rounded-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 flex items-center justify-center shadow-lg hover:shadow-xl transition-all z-40 focus:outline-none focus:ring-2 focus:ring-blue-500"
        aria-label="Show keyboard shortcuts"
        title="Keyboard shortcuts (Ctrl+?)"
      >
        <span className="text-lg font-bold">?</span>
      </button>

      {/* Help Modal */}
      {showHelp && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-md w-full max-h-96 overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">Keyboard Shortcuts</h2>
                <button
                  onClick={() => setShowHelp(false)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                  aria-label="Close help"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="flex items-center space-x-2 mb-1">
                    <kbd className="px-2 py-1 text-sm font-semibold text-gray-800 dark:text-white bg-gray-100 dark:bg-gray-800 rounded border border-gray-300 dark:border-gray-600">
                      ← Left
                    </kbd>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      View previous collection
                    </span>
                  </div>
                </div>

                <div>
                  <div className="flex items-center space-x-2 mb-1">
                    <kbd className="px-2 py-1 text-sm font-semibold text-gray-800 dark:text-white bg-gray-100 dark:bg-gray-800 rounded border border-gray-300 dark:border-gray-600">
                      Right →
                    </kbd>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      View next collection
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setShowHelp(false)}
                className="mt-6 w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
```

### Step 6: Update Collection Page to Use New Component

Update the collection page to include the new navigation:

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/pages/PublicCollectionPage.tsx` (modifications)

Replace the navigation section with:

```typescript
{/* Navigation */}
{(collection.navigation.previousCollection || collection.navigation.nextCollection) && (
  <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
    <CollectionNavigation
      previousCollection={collection.navigation.previousCollection}
      nextCollection={collection.navigation.nextCollection}
      artist={collection.parent.artist.username}
      gallery={collection.parent.gallery.slug}
    />
  </div>
)}

{/* Add help at bottom */}
<KeyboardShortcutsHelp />
```

### Step 7: Test Navigation

Start the development server:

```bash
cd /Volumes/DataSSD/gitsrc/vfa_gallery
npm run dev
```

Test keyboard navigation:
- Press Left Arrow key → should navigate to previous collection
- Press Right Arrow key → should navigate to next collection
- Typing in an input → arrow keys should not trigger navigation

---

## Files to Create/Modify

**Create:**
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/public/CollectionNavigation.tsx` - Main nav component
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/public/NavigationButton.tsx` - Reusable button
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/public/CollectionNavigation.module.css` - Styles
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/public/KeyboardShortcutsHelp.tsx` - Help component
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/hooks/useKeyboardNavigation.ts` - Navigation hook

**Modify:**
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/pages/PublicCollectionPage.tsx` - Add navigation and help

---

## Verification

### Test 1: Previous Collection Navigation

- Navigate to a collection with a previous collection
- Click "Previous" button
- Should navigate to previous collection
- URL should update correctly

### Test 2: Next Collection Navigation

- Navigate to a collection with a next collection
- Click "Next" button
- Should navigate to next collection
- URL should update correctly

### Test 3: Keyboard Navigation - Left Arrow

- Load collection page
- Press Left Arrow key
- Should navigate to previous collection (if exists)
- Should not navigate if already at first collection

### Test 4: Keyboard Navigation - Right Arrow

- Load collection page
- Press Right Arrow key
- Should navigate to next collection (if exists)
- Should not navigate if already at last collection

### Test 5: Input Element Respects Arrow Keys

- Click in a text input on the page
- Press Left/Right arrows
- Should not trigger collection navigation
- Should work normally for text input

### Test 6: Button Tooltips Show Collection Names

- Hover over navigation button
- Tooltip appears with collection name
- Focus with keyboard Tab: name visible
- Keyboard hint appears on hover

### Test 7: Mobile Layout

- Open on mobile viewport
- Buttons stack vertically
- Touch-friendly size (min 44px tap target)
- Text truncates appropriately

### Test 8: No Navigation When Missing

- Collection with no previous/next
- No buttons displayed
- No empty space left
- Section not rendered at all

---

## Success Criteria

- [ ] Previous/next navigation buttons render
- [ ] Buttons show only when collection exists
- [ ] Left Arrow key navigates to previous collection
- [ ] Right Arrow key navigates to next collection
- [ ] Arrow keys respect input/textarea elements
- [ ] Tooltips display collection names
- [ ] Keyboard hints show on hover
- [ ] Mobile layout responsive and touch-friendly
- [ ] Dark mode colors correct
- [ ] Buttons are properly focused and accessible
- [ ] All 8 test cases pass

---

## Next Steps

Once verified, proceed to:
- **Build 88:** Public artwork detail API endpoint
- **Build 89:** Public artwork detail page
