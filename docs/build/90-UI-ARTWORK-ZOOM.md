# Build 90: Artwork Zoom Viewer

## Goal

Create a tap-to-zoom image viewer component for the artwork detail page that displays artwork in fullscreen mode with pinch-zoom support on mobile, pan capabilities when zoomed, and keyboard/touch gestures to close.

---

## Spec Extract

**Features:**
- Fullscreen modal overlay
- Mouse wheel zoom on desktop
- Pinch zoom on mobile devices
- Pan/drag when zoomed in
- Tap or escape key to close
- Dark semi-transparent backdrop
- Smooth animations
- Touch gesture support (two-finger pinch)
- Maintains aspect ratio

**Responsive Behavior:**
- Mobile: Optimized for touch gestures
- Desktop: Mouse wheel and trackpad support
- All: Keyboard escape to close

---

## Prerequisites

**Must complete before starting:**
- **89-UI-PUBLIC-ARTWORK.md** - Artwork detail page with ArtworkDisplay component

**Reason:** The zoom component is triggered from the ArtworkDisplay component and displays the same image in fullscreen mode.

---

## Steps

### Step 1: Create Zoom Component Types

Create the types for zoom state and gesture tracking:

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/types/zoom.ts`

```typescript
export interface ZoomState {
  scale: number;
  translateX: number;
  translateY: number;
}

export interface TouchState {
  initialDistance: number;
  initialScale: number;
  initialTranslateX: number;
  initialTranslateY: number;
}

export interface Point {
  x: number;
  y: number;
}
```

### Step 2: Create Zoom Utility Functions

Create helper functions for zoom calculations:

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/utils/zoomCalculations.ts`

```typescript
import type { Point, ZoomState } from '../types/zoom';

/**
 * Calculate distance between two touch points (for pinch zoom)
 */
export function calculateDistance(point1: Point, point2: Point): number {
  const dx = point2.x - point1.x;
  const dy = point2.y - point1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Get center point between two touch points
 */
export function getCenterPoint(point1: Point, point2: Point): Point {
  return {
    x: (point1.x + point2.x) / 2,
    y: (point1.y + point2.y) / 2,
  };
}

/**
 * Constrain zoom level between min and max
 */
export function constrainScale(scale: number, minScale: number = 1, maxScale: number = 5): number {
  return Math.max(minScale, Math.min(maxScale, scale));
}

/**
 * Calculate constrained translate values to prevent panning outside image
 */
export function constrainTranslate(
  translateX: number,
  translateY: number,
  scale: number,
  containerWidth: number,
  containerHeight: number,
  imageWidth: number,
  imageHeight: number
): { x: number; y: number } {
  const scaledWidth = imageWidth * scale;
  const scaledHeight = imageHeight * scale;

  // Calculate maximum pan distances
  const maxTranslateX = (scaledWidth - containerWidth) / 2;
  const maxTranslateY = (scaledHeight - containerHeight) / 2;

  return {
    x: Math.max(-maxTranslateX, Math.min(maxTranslateX, translateX)),
    y: Math.max(-maxTranslateY, Math.min(maxTranslateY, translateY)),
  };
}

/**
 * Calculate new scale and translate for pinch zoom
 */
export function calculatePinchZoom(
  previousScale: number,
  previousTranslateX: number,
  previousTranslateY: number,
  centerPoint: Point,
  newDistance: number,
  previousDistance: number,
  containerWidth: number,
  containerHeight: number,
  imageWidth: number,
  imageHeight: number
): ZoomState {
  // Calculate scale change from pinch distance
  const scaleFactor = newDistance / previousDistance;
  const newScale = constrainScale(previousScale * scaleFactor);

  // Calculate offset from center point to maintain focus
  const offsetX = centerPoint.x - containerWidth / 2;
  const offsetY = centerPoint.y - containerHeight / 2;

  // Calculate new translate positions
  const scaleDifference = newScale / previousScale;
  let newTranslateX = centerPoint.x / scaleDifference - centerPoint.x + previousTranslateX;
  let newTranslateY = centerPoint.y / scaleDifference - centerPoint.y + previousTranslateY;

  // Constrain translate
  const constrained = constrainTranslate(
    newTranslateX,
    newTranslateY,
    newScale,
    containerWidth,
    containerHeight,
    imageWidth,
    imageHeight
  );

  return {
    scale: newScale,
    translateX: constrained.x,
    translateY: constrained.y,
  };
}
```

### Step 3: Create Artwork Zoom Component

Create the main fullscreen zoom viewer component:

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/public/ArtworkZoom.tsx`

```typescript
import React, { useEffect, useRef, useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import type { ZoomState, TouchState, Point } from '../../types/zoom';
import {
  calculateDistance,
  getCenterPoint,
  constrainScale,
  calculatePinchZoom,
  constrainTranslate,
} from '../../utils/zoomCalculations';

interface ArtworkZoomProps {
  imageUrl: string;
  title: string;
  onClose: () => void;
}

export default function ArtworkZoom({ imageUrl, title, onClose }: ArtworkZoomProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [zoom, setZoom] = useState<ZoomState>({ scale: 1, translateX: 0, translateY: 0 });
  const [touchState, setTouchState] = useState<TouchState | null>(null);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  // Handle keyboard escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Handle image load to get dimensions
  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setImageDimensions({ width: img.naturalWidth, height: img.naturalHeight });
  };

  // Handle mouse wheel zoom
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();

    if (!containerRef.current || !imageRef.current) return;

    const container = containerRef.current;
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const scaleChange = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = constrainScale(zoom.scale * scaleChange);

    // Calculate position to zoom towards cursor
    const mouseX = x - container.clientWidth / 2;
    const mouseY = y - container.clientHeight / 2;

    const scaleDiff = newScale / zoom.scale;
    const newTranslateX = mouseX - (mouseX / scaleDiff - zoom.translateX);
    const newTranslateY = mouseY - (mouseY / scaleDiff - zoom.translateY);

    const constrained = constrainTranslate(
      newTranslateX,
      newTranslateY,
      newScale,
      container.clientWidth,
      container.clientHeight,
      imageDimensions.width,
      imageDimensions.height
    );

    setZoom({
      scale: newScale,
      translateX: constrained.x,
      translateY: constrained.y,
    });
  };

  // Handle touch start (pinch zoom or pan start)
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2) {
      // Two-finger pinch zoom
      const touch1: Point = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      const touch2: Point = { x: e.touches[1].clientX, y: e.touches[1].clientY };

      const distance = calculateDistance(touch1, touch2);

      setTouchState({
        initialDistance: distance,
        initialScale: zoom.scale,
        initialTranslateX: zoom.translateX,
        initialTranslateY: zoom.translateY,
      });
    } else if (e.touches.length === 1 && zoom.scale > 1) {
      // Single finger drag when zoomed
      setIsDragging(true);
      dragStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
      };
    }
  };

  // Handle touch move (pinch or pan)
  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;

    const container = containerRef.current;

    if (e.touches.length === 2 && touchState) {
      // Pinch zoom
      e.preventDefault();

      const touch1: Point = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      const touch2: Point = { x: e.touches[1].clientX, y: e.touches[1].clientY };

      const newDistance = calculateDistance(touch1, touch2);
      const centerPoint = getCenterPoint(touch1, touch2);
      const rect = container.getBoundingClientRect();
      const relativeCenter = {
        x: centerPoint.x - rect.left,
        y: centerPoint.y - rect.top,
      };

      const newZoom = calculatePinchZoom(
        touchState.initialScale,
        touchState.initialTranslateX,
        touchState.initialTranslateY,
        relativeCenter,
        newDistance,
        touchState.initialDistance,
        container.clientWidth,
        container.clientHeight,
        imageDimensions.width,
        imageDimensions.height
      );

      setZoom(newZoom);
    } else if (isDragging && e.touches.length === 1 && zoom.scale > 1) {
      // Single finger drag when zoomed
      e.preventDefault();

      const touch = e.touches[0];
      const deltaX = touch.clientX - dragStartRef.current.x;
      const deltaY = touch.clientY - dragStartRef.current.y;

      const constrained = constrainTranslate(
        zoom.translateX + deltaX,
        zoom.translateY + deltaY,
        zoom.scale,
        container.clientWidth,
        container.clientHeight,
        imageDimensions.width,
        imageDimensions.height
      );

      setZoom({
        ...zoom,
        translateX: constrained.x,
        translateY: constrained.y,
      });

      dragStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
      };
    }
  };

  // Handle touch end
  const handleTouchEnd = () => {
    setTouchState(null);
    setIsDragging(false);
  };

  // Handle mouse down for desktop drag
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (zoom.scale <= 1 || e.button !== 0) return; // Only left mouse button

    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
    };
  };

  // Handle mouse move for desktop drag
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || !containerRef.current || zoom.scale <= 1) return;

    const container = containerRef.current;
    const deltaX = e.clientX - dragStartRef.current.x;
    const deltaY = e.clientY - dragStartRef.current.y;

    const constrained = constrainTranslate(
      zoom.translateX + deltaX,
      zoom.translateY + deltaY,
      zoom.scale,
      container.clientWidth,
      container.clientHeight,
      imageDimensions.width,
      imageDimensions.height
    );

    setZoom({
      ...zoom,
      translateX: constrained.x,
      translateY: constrained.y,
    });

    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
    };
  };

  // Handle mouse up
  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Handle double click to reset zoom
  const handleDoubleClick = () => {
    setZoom({ scale: 1, translateX: 0, translateY: 0 });
  };

  // Close on background click
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center"
      onClick={handleBackdropClick}
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Close Button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white bg-opacity-20 hover:bg-opacity-30 transition-all text-white"
        aria-label="Close zoom viewer"
        title="Close (Esc)"
      >
        <XMarkIcon className="w-6 h-6" />
      </button>

      {/* Zoom Controls Info */}
      <div className="absolute bottom-4 left-4 right-4 flex justify-center">
        <div className="bg-black bg-opacity-50 text-white text-sm px-4 py-2 rounded-lg text-center max-w-xs">
          {zoom.scale > 1 ? (
            <>Drag to pan • Double-click to reset</>
          ) : (
            <>Scroll or pinch to zoom • Double-click to fit</>
          )}
        </div>
      </div>

      {/* Image Container */}
      <div
        ref={containerRef}
        className="relative w-full h-full overflow-hidden cursor-grab active:cursor-grabbing"
        onDoubleClick={handleDoubleClick}
      >
        <img
          ref={imageRef}
          src={imageUrl}
          alt={title}
          className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 select-none pointer-events-none"
          style={{
            transform: `translate(calc(-50% + ${zoom.translateX}px), calc(-50% + ${zoom.translateY}px)) scale(${zoom.scale})`,
            transition: isDragging ? 'none' : 'transform 0.1s ease-out',
            maxWidth: 'none',
            maxHeight: 'none',
          }}
          onLoad={handleImageLoad}
          draggable={false}
        />
      </div>

      {/* Zoom Level Indicator (optional) */}
      {zoom.scale > 1 && (
        <div className="absolute top-4 left-4 bg-black bg-opacity-50 text-white text-sm px-3 py-1 rounded-lg">
          {Math.round(zoom.scale * 100)}%
        </div>
      )}
    </div>
  );
}
```

### Step 4: Update ArtworkDisplay Component

Update the ArtworkDisplay component to use the new ArtworkZoom:

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/public/ArtworkDisplay.tsx`

Replace the import and component to ensure it's using the new zoom component:

```typescript
import React, { useState } from 'react';
import type { PublicArtworkResponse } from '../../types/public';
import ArtworkZoom from './ArtworkZoom';

interface ArtworkDisplayProps {
  artwork: PublicArtworkResponse;
}

export default function ArtworkDisplay({ artwork }: ArtworkDisplayProps) {
  const [showZoom, setShowZoom] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <>
      {/* Image Container */}
      <div className="bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
        {/* Mobile: Responsive width */}
        <div className="relative w-full">
          {!imageLoaded && !imageFailed && (
            <div className="absolute inset-0 bg-gray-200 dark:bg-gray-700 animate-pulse" />
          )}

          {imageFailed ? (
            <div className="w-full aspect-square flex items-center justify-center bg-gray-100 dark:bg-gray-800">
              <div className="text-center">
                <svg
                  className="w-12 h-12 text-gray-400 mx-auto mb-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="m2.25 15.75l5.159-5.159a2.25 2.25 0 012.12-.912l6.519.659a2.25 2.25 0 012.12.912l5.158 5.159m-1.5-4.5l.75.75m-2.25 2.25l.75.75"
                  />
                </svg>
                <p className="text-gray-500 dark:text-gray-400">Failed to load image</p>
              </div>
            </div>
          ) : (
            <img
              src={artwork.displayUrl}
              alt={artwork.title}
              className={`w-full h-auto transition-opacity duration-300 cursor-zoom-in hover:opacity-90 ${
                imageLoaded ? 'opacity-100' : 'opacity-0'
              }`}
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageFailed(true)}
              onClick={() => setShowZoom(true)}
              loading="eager"
              decoding="async"
            />
          )}
        </div>

        {/* Click to Zoom Hint */}
        {imageLoaded && (
          <div className="p-3 bg-gray-50 dark:bg-gray-700 flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-300">
              {artwork.metadata.width && artwork.metadata.height
                ? `${artwork.metadata.width} × ${artwork.metadata.height} px`
                : 'Image'}
            </span>
            <button
              onClick={() => setShowZoom(true)}
              className="text-blue-600 dark:text-blue-400 hover:underline text-sm font-medium"
            >
              Click to zoom
            </button>
          </div>
        )}
      </div>

      {/* Title and Description */}
      <div className="mt-6">
        <h1 className="text-3xl sm:text-4xl font-bold mb-2">{artwork.title}</h1>
        {artwork.description && (
          <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap text-base leading-relaxed">
            {artwork.description}
          </p>
        )}
      </div>

      {/* Zoom Modal */}
      {showZoom && (
        <ArtworkZoom
          imageUrl={artwork.displayUrl}
          title={artwork.title}
          onClose={() => setShowZoom(false)}
        />
      )}
    </>
  );
}
```

---

## Files to Create/Modify

**Create:**
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/types/zoom.ts` - Zoom state types
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/utils/zoomCalculations.ts` - Zoom utility functions
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/public/ArtworkZoom.tsx` - Fullscreen zoom viewer

**Modify:**
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/public/ArtworkDisplay.tsx` - Import and use ArtworkZoom

---

## Verification

### Test 1: Open Zoom Viewer

- Click "Click to zoom" button on artwork
- Fullscreen modal opens with dark backdrop
- Close button visible in top-right
- Image centered and visible

### Test 2: Desktop Zoom (Mouse Wheel)

- Scroll up to zoom in
- Scroll down to zoom out
- Cursor zooms towards cursor position
- Scale info shows percentage (e.g., "150%")

### Test 3: Desktop Pan (Click and Drag)

- Zoom in to > 1x
- Click and drag image to pan
- Image stays within bounds
- Cursor shows grab/grabbing state

### Test 4: Mobile Pinch Zoom

- Use two fingers to pinch on image
- Scale increases/decreases smoothly
- Pinch point stays centered

### Test 5: Mobile Pan (Touch Drag)

- Zoom in on mobile
- Single finger drag to pan
- Pan respects image bounds

### Test 6: Keyboard Escape

- Press Escape key
- Zoom modal closes
- Returns to artwork detail page

### Test 7: Backdrop Click

- Click outside image area
- Modal closes

### Test 8: Double Click

- Double-click image
- Zoom resets to 1x
- Pan resets to center

### Test 9: Touch Gestures

- One finger swipe: only works when zoomed (pans)
- Two finger swipe: pans the already-zoomed image
- Pinch: pinch zooms smoothly

### Test 10: Zoom Constraints

- Max zoom (5x): cannot zoom past 5x
- Min zoom (1x): cannot zoom below 1x
- Pan bounds: cannot pan beyond image edges

---

## Success Criteria

- [ ] Zoom component created with fullscreen modal
- [ ] Mouse wheel zoom works on desktop
- [ ] Pinch zoom works on mobile
- [ ] Pan/drag works when zoomed
- [ ] Keyboard escape closes viewer
- [ ] Double-click resets zoom
- [ ] Backdrop click closes viewer
- [ ] Zoom level indicator displays
- [ ] Touch gestures work smoothly on mobile
- [ ] Desktop drag and pan work smoothly
- [ ] All constraints applied (min/max zoom, pan bounds)
- [ ] All 10 test cases pass

---

## Next Steps

Once verified, proceed to:
- **Build 91:** Share buttons component
- **Build 92:** Message artist button
