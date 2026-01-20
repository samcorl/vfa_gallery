# 156-ADS-SLOT-COMPONENT.md

## Goal

Create a reusable ad slot placeholder component with configurable size options (banner, rectangle, leaderboard). Display a placeholder box in development mode with dimensions and data attributes for ad providers. Respect user preference if ads are disabled.

---

## Spec Extract

From TECHNICAL-SPEC.md - Ad Integration:

- **Component:** Reusable `<AdSlot />` component
- **Size Variants:**
  - `banner` - 300x250px (mobile)
  - `rectangle` - 300x250px (desktop)
  - `leaderboard` - 728x90px (top/bottom)
- **Features:**
  - Placeholder display in development
  - Dimensions shown on placeholder
  - Data attributes for ad network targeting
  - Respects user ad preference
  - Responsive sizing
  - Dev mode indicator

---

## Prerequisites

**Must complete before starting:**
- **27-REACT-LAYOUT-SHELL.md** - App shell layout
- **25-REACT-AUTH-CONTEXT.md** - Auth context for user preferences

---

## Steps

### Step 1: Create Ad Slot Type

Define types for ad slots.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/types/ads.ts`

```typescript
export type AdSlotSize = 'banner' | 'rectangle' | 'leaderboard'

export interface AdSlotConfig {
  size: AdSlotSize
  id?: string
  className?: string
  enabled?: boolean
}

export const AD_DIMENSIONS: Record<AdSlotSize, { width: number; height: number }> = {
  banner: { width: 300, height: 250 },
  rectangle: { width: 300, height: 250 },
  leaderboard: { width: 728, height: 90 },
}
```

---

### Step 2: Create AdSlot Component

Create the main ad slot component.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/ads/AdSlot.tsx`

```typescript
import { useEffect, useRef } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { AD_DIMENSIONS, type AdSlotConfig } from '../../types/ads'

/**
 * Reusable ad slot component
 * Displays ad placeholder in dev mode, renders ads in production
 * Respects user ad preferences
 */
export default function AdSlot({
  size,
  id,
  className = '',
  enabled = true,
}: AdSlotConfig) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { user } = useAuth()
  const isDev = process.env.NODE_ENV === 'development'

  // Check if ads are disabled for user
  const adsDisabled =
    !enabled || (user && user.preferences?.ads_disabled === true)

  // Get dimensions for size
  const dimensions = AD_DIMENSIONS[size]
  const slotId = id || `ad-slot-${size}-${Math.random().toString(36).substr(2, 9)}`

  useEffect(() => {
    // In production, load ad network script
    if (!isDev && !adsDisabled && containerRef.current) {
      // Example: Load Google AdSense or other ad network
      // This would typically load the ad network's script and render ads
      try {
        // Ad network initialization would go here
        console.log(`[Ad Slot] Loading ads for slot: ${slotId}`)
      } catch (err) {
        console.error(`[Ad Slot] Failed to load ads: ${err}`)
      }
    }
  }, [slotId, isDev, adsDisabled])

  // Don't render if ads are disabled
  if (adsDisabled) {
    return null
  }

  return (
    <div
      ref={containerRef}
      id={slotId}
      className={`ad-slot-container ${className}`}
      data-ad-size={size}
      data-ad-slot={slotId}
      style={{
        width: dimensions.width,
        height: dimensions.height,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {isDev ? (
        // Development placeholder
        <div
          className="flex items-center justify-center bg-gray-200 border-2 border-dashed border-gray-400 rounded w-full h-full"
          style={{
            width: dimensions.width,
            height: dimensions.height,
          }}
        >
          <div className="text-center">
            <p className="text-gray-600 font-semibold text-sm">Ad Slot</p>
            <p className="text-gray-500 text-xs">
              {dimensions.width}x{dimensions.height}px
            </p>
            <p className="text-gray-400 text-xs mt-1">{size}</p>
          </div>
        </div>
      ) : (
        // Production: Ad will be rendered here by ad network script
        <div style={{ width: dimensions.width, height: dimensions.height }} />
      )}
    </div>
  )
}
```

---

### Step 3: Create Ad Container Hook

Create a hook for managing multiple ad slots.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/hooks/useAdSlots.ts`

```typescript
import { useMemo } from 'react'
import { useAuth } from '../contexts/AuthContext'

interface AdSlotPlacement {
  id: string
  size: 'banner' | 'rectangle' | 'leaderboard'
  position: string
}

export function useAdSlots() {
  const { user } = useAuth()

  const adsEnabled = useMemo(() => {
    // Ads disabled if user preference says so
    if (user && user.preferences?.ads_disabled === true) {
      return false
    }
    // Ads disabled for authenticated users on some pages
    // (can be customized based on app policy)
    return true
  }, [user])

  const shouldShowAds = (placement: AdSlotPlacement): boolean => {
    if (!adsEnabled) return false

    // Add custom logic for ad placement rules
    // e.g., don't show ads on certain pages for certain user types

    return true
  }

  return {
    adsEnabled,
    shouldShowAds,
  }
}
```

---

### Step 4: Create Ad Provider Context (Optional)

For global ad configuration.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/contexts/AdContext.tsx`

```typescript
import { createContext, useContext, ReactNode } from 'react'

interface AdContextType {
  networkId?: string
  testMode: boolean
}

const AdContext = createContext<AdContextType | undefined>(undefined)

export function AdProvider({
  children,
  networkId,
  testMode = process.env.NODE_ENV === 'development',
}: {
  children: ReactNode
  networkId?: string
  testMode?: boolean
}) {
  return (
    <AdContext.Provider value={{ networkId, testMode }}>
      {children}
    </AdContext.Provider>
  )
}

export function useAds() {
  const context = useContext(AdContext)
  if (!context) {
    throw new Error('useAds must be used within AdProvider')
  }
  return context
}
```

---

### Step 5: Add Provider to App

Update main app to include ad provider.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/main.tsx` or `/Volumes/DataSSD/gitsrc/vfa_gallery/src/App.tsx`

```typescript
import { AdProvider } from './contexts/AdContext'

export default function App() {
  return (
    <AdProvider networkId={import.meta.env.VITE_AD_NETWORK_ID}>
      {/* Rest of app */}
    </AdProvider>
  )
}
```

---

## Files to Create/Modify

**New files to create:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/types/ads.ts`
2. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/ads/AdSlot.tsx`
3. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/hooks/useAdSlots.ts`
4. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/contexts/AdContext.tsx`

**Files to modify:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/main.tsx` or equivalent - Add AdProvider

---

## Verification

### Test 1: TypeScript Compilation

```bash
cd /Volumes/DataSSD/gitsrc/vfa_gallery
npx tsc --noEmit
```

Expected: No type errors

---

### Test 2: Development Mode Rendering

1. Run dev server: `npm run dev`
2. Verify ad slot placeholders display
3. Each should show:
   - Gray dashed border
   - "Ad Slot" text
   - Dimensions (300x250, 728x90, etc.)
   - Size variant (banner, rectangle, leaderboard)

---

### Test 3: AdSlot Component Props

```typescript
<AdSlot size="banner" />
<AdSlot size="rectangle" id="ad-main" />
<AdSlot size="leaderboard" className="my-custom-class" />
```

Expected: All render correctly with proper dimensions

---

### Test 4: Ad Dimensions

Create test component:

```typescript
import AdSlot from './components/ads/AdSlot'

export function TestAds() {
  return (
    <div className="p-4 space-y-4">
      <div>
        <p>Banner (300x250):</p>
        <AdSlot size="banner" />
      </div>
      <div>
        <p>Rectangle (300x250):</p>
        <AdSlot size="rectangle" />
      </div>
      <div>
        <p>Leaderboard (728x90):</p>
        <AdSlot size="leaderboard" />
      </div>
    </div>
  )
}
```

Expected: Each renders at correct dimensions

---

### Test 5: Ads Disabled - No Render

Mock user with `ads_disabled: true`:

```typescript
// In test
const mockUser = {
  id: 'test',
  preferences: { ads_disabled: true },
}
```

Render AdSlot and verify:
- Component returns null
- No HTML rendered
- No network calls

---

### Test 6: Enabled Prop

```typescript
<AdSlot size="banner" enabled={false} />
```

Expected: Returns null, no placeholder

---

### Test 7: Custom Styling

```typescript
<AdSlot
  size="rectangle"
  className="mt-4 mb-4 border-2 border-blue-500"
/>
```

Expected: Custom class applied to container

---

### Test 8: Data Attributes

Inspect HTML of rendered ad:

```bash
# Should have:
# data-ad-size="banner"
# data-ad-slot="ad-slot-banner-xxxxx"
```

Expected: Data attributes present for ad network targeting

---

### Test 9: useAdSlots Hook

Test component using hook:

```typescript
import { useAdSlots } from '../hooks/useAdSlots'

export function TestHook() {
  const { adsEnabled, shouldShowAds } = useAdSlots()

  return (
    <div>
      <p>Ads Enabled: {adsEnabled ? 'Yes' : 'No'}</p>
      <p>
        Show Ad: {shouldShowAds({ id: 'test', size: 'banner', position: 'top' })
          ? 'Yes'
          : 'No'}
      </p>
    </div>
  )
}
```

Expected: Hook returns correct values based on user preferences

---

### Test 10: Multiple AdSlots

Render multiple slots on same page:

```typescript
<AdSlot size="leaderboard" />
<div className="content">Content</div>
<AdSlot size="rectangle" />
```

Expected:
- All slots render
- Each has unique ID
- Layout correct

---

## Success Criteria

- [ ] TypeScript compiles without errors
- [ ] AdSlot component renders placeholder in dev mode
- [ ] Placeholder shows correct dimensions
- [ ] Placeholder shows size variant
- [ ] Component accepts size prop (banner, rectangle, leaderboard)
- [ ] Component accepts optional id prop
- [ ] Component accepts optional className prop
- [ ] Component accepts optional enabled prop
- [ ] Data attributes present for ad network
- [ ] Respects user ads_disabled preference
- [ ] Returns null when ads disabled
- [ ] useAdSlots hook works correctly
- [ ] AdProvider can be added to app
- [ ] Multiple slots on same page work
- [ ] Responsive sizing ready for production

---

## Next Steps

Once this build is verified, proceed to **157-ADS-FOOTER-PLACEMENT.md** to integrate ads into page layouts.
