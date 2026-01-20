# Build 112: Theme Preview Component

## Goal

Create a React component that displays how a theme looks with a sample layout showing theme colors, fonts, and visual styling applied. The preview component is used in the theme picker and theme editor to give users a live demonstration of theme appearance.

---

## Spec Extract

**Component:** `ThemePreview`

**Props:**
```typescript
interface ThemePreviewProps {
  theme: ThemeResponse;
  size?: 'small' | 'medium' | 'large'; // Preview size (default: medium)
  interactive?: boolean; // Whether to show interactive elements
}
```

**Display Elements:**
- Header area with background color and text color
- Hero/banner section showcasing primary colors
- Accent color demonstrations
- Typography samples (headings, body text)
- Button examples showing primary, secondary, and disabled states
- Mini artwork grid mockup (3-4 cards) with theme applied
- Footer area with theme colors

**Visual Layout:**
```
┌──────────────────────────┐
│ Theme Name Preview       │
├──────────────────────────┤
│ [Hero Section]           │
│  Theme Colors:           │
│  Primary: [COLOR]        │
│  Secondary: [COLOR]      │
│  Accent: [COLOR]         │
├──────────────────────────┤
│ Heading Style            │
│ Body text sample         │
│ [Button] [Button] [Btn]  │
├──────────────────────────┤
│ [Card] [Card] [Card]     │
│ Artwork Grid Mockup      │
├──────────────────────────┤
│ Footer with theme colors │
└──────────────────────────┘
```

---

## Prerequisites

**Must complete before starting:**
- **111-UI-THEME-PICKER.md** - Theme types and API responses
- **27-REACT-LAYOUT-SHELL.md** - Base styling patterns and layout components
- **28-REACT-TOAST-SYSTEM.md** - Optional toast feedback for copying colors

**Reason:** Component needs theme types from picker, uses shared layout patterns, and may use toast for user feedback.

---

## Steps

### Step 1: Create Theme Preview Component

Create the main preview component that renders theme mockup layout.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/ThemePreview.tsx`

```typescript
import { useMemo } from 'react'
import { ThemeResponse } from '../types/theme'

interface ThemePreviewProps {
  theme: ThemeResponse
  size?: 'small' | 'medium' | 'large'
  interactive?: boolean
}

/**
 * ThemePreview component displays a visual mockup of how a theme looks
 * Shows colors, typography, and sample UI elements
 */
export function ThemePreview({
  theme,
  size = 'medium',
  interactive = false,
}: ThemePreviewProps) {
  const sizeClasses = useMemo(() => {
    switch (size) {
      case 'small':
        return 'p-2 text-sm'
      case 'large':
        return 'p-6 text-base'
      case 'medium':
      default:
        return 'p-4 text-sm'
    }
  }, [size])

  // Parse theme colors
  const colors = useMemo(() => {
    try {
      return typeof theme.colors === 'string'
        ? JSON.parse(theme.colors)
        : theme.colors
    } catch {
      return {
        primary: '#000000',
        secondary: '#666666',
        accent: '#0066cc',
        background: '#ffffff',
        text: '#000000',
      }
    }
  }, [theme])

  // Parse theme fonts
  const fonts = useMemo(() => {
    try {
      return typeof theme.fonts === 'string'
        ? JSON.parse(theme.fonts)
        : theme.fonts
    } catch {
      return {
        headingFont: 'system-ui',
        bodyFont: 'system-ui',
      }
    }
  }, [theme])

  const previewStyles = {
    backgroundColor: colors.background,
    color: colors.text,
  }

  const heroStyles = {
    backgroundColor: colors.primary,
    color: '#ffffff',
  }

  const accentStyles = {
    backgroundColor: colors.accent,
    color: '#ffffff',
  }

  return (
    <div
      className={`border border-gray-300 rounded overflow-hidden ${sizeClasses}`}
      style={previewStyles}
    >
      {/* Header */}
      <div
        className="py-3 px-3 mb-3 rounded text-white font-bold"
        style={heroStyles}
      >
        {theme.name}
      </div>

      {/* Color Swatches */}
      <div className="mb-4">
        <h3 className="font-semibold mb-2">Colors</h3>
        <div className="flex gap-2">
          <div
            className="w-12 h-12 rounded border border-gray-200 cursor-pointer flex items-center justify-center text-xs font-mono"
            style={{ backgroundColor: colors.primary }}
            title="Primary color"
          >
            P
          </div>
          <div
            className="w-12 h-12 rounded border border-gray-200 cursor-pointer flex items-center justify-center text-xs font-mono"
            style={{ backgroundColor: colors.secondary }}
            title="Secondary color"
          >
            S
          </div>
          <div
            className="w-12 h-12 rounded border border-gray-200 cursor-pointer flex items-center justify-center text-xs font-mono"
            style={{ backgroundColor: colors.accent }}
            title="Accent color"
          >
            A
          </div>
        </div>
      </div>

      {/* Typography */}
      <div className="mb-4">
        <h3
          className="font-bold text-lg mb-2"
          style={{ fontFamily: fonts.headingFont }}
        >
          Heading
        </h3>
        <p
          className="text-sm mb-2"
          style={{ fontFamily: fonts.bodyFont }}
        >
          This is body text using the theme's font. It displays how regular
          content appears.
        </p>
      </div>

      {/* Buttons */}
      <div className="mb-4">
        <h3 className="font-semibold mb-2">Buttons</h3>
        <div className="flex gap-2 flex-wrap">
          <button
            className="px-3 py-1 rounded text-white text-xs font-medium"
            style={{ backgroundColor: colors.primary }}
            disabled={!interactive}
          >
            Primary
          </button>
          <button
            className="px-3 py-1 rounded text-white text-xs font-medium"
            style={{ backgroundColor: colors.secondary }}
            disabled={!interactive}
          >
            Secondary
          </button>
          <button
            className="px-3 py-1 rounded text-xs font-medium"
            style={{
              backgroundColor: colors.accent,
              color: '#ffffff',
            }}
            disabled={!interactive}
          >
            Accent
          </button>
          <button
            className="px-3 py-1 rounded text-xs font-medium bg-gray-300 text-gray-600 cursor-not-allowed"
            disabled
          >
            Disabled
          </button>
        </div>
      </div>

      {/* Artwork Grid Mockup */}
      <div>
        <h3 className="font-semibold mb-2">Artwork Grid</h3>
        <div className="grid grid-cols-3 gap-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded overflow-hidden"
              style={{ backgroundColor: colors.secondary + '20' }}
            >
              <div
                className="aspect-square flex items-center justify-center text-gray-400 text-xs"
                style={{ backgroundColor: colors.secondary + '10' }}
              >
                Artwork
              </div>
              <div className="p-2">
                <p
                  className="text-xs font-medium truncate"
                  style={{ fontFamily: fonts.bodyFont }}
                >
                  Title
                </p>
                <p className="text-xs text-gray-500">Artist</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
```

---

### Step 2: Create Theme Preview Hook

Create a hook for handling theme preview interactions.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/hooks/useThemePreview.ts`

```typescript
import { useState, useCallback } from 'react'
import { ThemeResponse } from '../types/theme'

interface UseThemePreviewOptions {
  onColorCopy?: (color: string, name: string) => void
}

export function useThemePreview(options?: UseThemePreviewOptions) {
  const [copiedColor, setCopiedColor] = useState<string | null>(null)

  const copyColorToClipboard = useCallback(
    (color: string, name: string) => {
      navigator.clipboard.writeText(color).then(() => {
        setCopiedColor(color)
        options?.onColorCopy?.(color, name)

        // Clear "copied" state after 2 seconds
        setTimeout(() => setCopiedColor(null), 2000)
      })
    },
    [options]
  )

  return {
    copiedColor,
    copyColorToClipboard,
  }
}
```

---

### Step 3: Integrate ThemePreview into ThemePicker

Update the theme picker to display preview cards.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/ThemePicker.tsx`

Add the ThemePreview component to each theme card:

```typescript
import { ThemePreview } from './ThemePreview'

// Inside the theme card rendering:
{
  themes.map((theme) => (
    <div key={theme.id} className="border rounded-lg overflow-hidden hover:shadow-lg transition-shadow">
      <ThemePreview theme={theme} size="small" />
      <div className="p-3 border-t">
        <h3 className="font-semibold text-sm mb-2">{theme.name}</h3>
        <div className="flex gap-2">
          <button
            onClick={() => onThemeSelect(theme)}
            className="flex-1 px-2 py-1 bg-blue-600 text-white text-xs rounded"
          >
            Select
          </button>
          {onCopyTheme && (
            <button
              onClick={() => onCopyTheme(theme.id)}
              className="flex-1 px-2 py-1 bg-gray-200 text-gray-900 text-xs rounded"
            >
              Copy
            </button>
          )}
        </div>
      </div>
    </div>
  ))
}
```

---

### Step 4: Create Theme Editor Integration

Create a component for live theme preview in the theme editor.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/ThemeEditorPreview.tsx`

```typescript
import { ThemeResponse } from '../types/theme'
import { ThemePreview } from './ThemePreview'

interface ThemeEditorPreviewProps {
  currentTheme: Partial<ThemeResponse>
  isDirty: boolean
}

/**
 * Live preview component used in theme editor
 * Updates in real-time as user modifies theme values
 */
export function ThemeEditorPreview({
  currentTheme,
  isDirty,
}: ThemeEditorPreviewProps) {
  // Convert partial theme to full response for preview
  const previewTheme: ThemeResponse = {
    id: currentTheme.id || 'preview',
    name: currentTheme.name || 'Theme Preview',
    colors: currentTheme.colors || '{}',
    fonts: currentTheme.fonts || '{}',
    isPublic: currentTheme.isPublic || false,
    ownerId: currentTheme.ownerId || '',
    createdAt: currentTheme.createdAt || new Date().toISOString(),
    updatedAt: currentTheme.updatedAt || new Date().toISOString(),
  }

  return (
    <div className="border-2 rounded-lg p-4 bg-gray-50">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm">Live Preview</h3>
        {isDirty && <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">Unsaved</span>}
      </div>
      <ThemePreview theme={previewTheme} size="medium" />
    </div>
  )
}
```

---

## Files to Create/Modify

**New files:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/ThemePreview.tsx` - Main preview component
2. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/hooks/useThemePreview.ts` - Preview interactions hook
3. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/ThemeEditorPreview.tsx` - Editor integration

**Modified files:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/ThemePicker.tsx` - Integrate ThemePreview

---

## Verification

### Test 1: Verify TypeScript Compilation

```bash
npx tsc --noEmit
```

Expected: No errors

---

### Test 2: Theme Preview Renders Correctly

In browser, navigate to theme picker or theme editor:

```bash
npm run dev
# Open http://localhost:5173/galleries/default/themes
```

Expected: Theme preview cards display with colors, typography, and sample grid

---

### Test 3: Colors Display Correctly

Look at color swatches in preview:
- Primary color displays correctly
- Secondary color displays correctly
- Accent color displays correctly

Expected: Colors match theme definition

---

### Test 4: Multiple Theme Previews

Create or select multiple themes:

Expected: Each preview shows different colors and styling

---

### Test 5: Typography Renders

Check that heading and body text samples display with correct font families

Expected: Fonts render without errors, text is readable

---

### Test 6: Button States

Verify button examples show all states (primary, secondary, accent, disabled)

Expected: All button states display with correct styling

---

### Test 7: Artwork Grid Mockup

Verify mini grid displays 3 cards with theme colors applied

Expected: Cards render with theme background colors and text colors

---

### Test 8: Size Variations

Test small, medium, and large sizes:

```typescript
<ThemePreview theme={theme} size="small" />
<ThemePreview theme={theme} size="medium" />
<ThemePreview theme={theme} size="large" />
```

Expected: Component scales appropriately for each size

---

### Test 9: Color Parsing Edge Cases

Test with themes containing malformed JSON:

Expected: Fallback to default colors without errors

---

### Test 10: Live Preview in Editor

Edit theme colors in editor:

Expected: Preview updates in real-time, shows unsaved indicator when dirty

---

## Success Criteria

- [ ] TypeScript compilation succeeds
- [ ] ThemePreview component renders without errors
- [ ] Colors from theme object display correctly
- [ ] Typography displays with theme fonts
- [ ] Button examples show all states
- [ ] Artwork grid mockup displays
- [ ] Size prop controls component dimensions
- [ ] Color swatches show primary, secondary, accent
- [ ] Preview integrates into theme picker
- [ ] Preview integrates into theme editor
- [ ] Live preview updates when theme changes
- [ ] Fallback colors work for invalid theme data
- [ ] Component responsive on mobile

---

## Next Steps

Once this build is verified, proceed to **127-UI-GROUP-PUBLIC.md** to create the public group page.
