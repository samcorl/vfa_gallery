# Build 111: Theme Picker Component

## Goal

Create a React component that allows users to browse, preview, and select themes for their galleries or collections. The component displays system themes, public user themes, and the user's own custom themes in tabbed interface with visual preview cards.

---

## Spec Extract

**Component:** `ThemePicker`

**Props:**
```typescript
interface ThemePickerProps {
  currentThemeId?: string | null;
  onThemeSelect: (theme: ThemeResponse) => void;
  onCopyTheme?: (themeId: string, name?: string) => void;
  context?: 'gallery' | 'collection'; // To show relevant help text
  showMyThemes?: boolean; // Show user's custom themes tab (requires auth)
}
```

**Tabs:**
1. **System Themes** - System-provided default themes
2. **Public Themes** - Public user-created themes
3. **My Themes** (if authenticated) - User's custom themes with edit/delete options

**Features:**
- Search/filter by name (optional)
- Visual preview card for each theme showing colors and typography
- "Copy" button for public/system themes
- "Select" button to apply theme
- "Edit" and "Delete" buttons for user's own themes
- Current selection highlighted
- Pagination with lazy loading
- Loading states
- Error handling

**Visual Layout:**
```
┌─────────────────────────────────────────┐
│ Theme Picker                        [×] │
├─────────────────────────────────────────┤
│ [System] [Public] [My Themes]           │
├─────────────────────────────────────────┤
│ ┌─────────────┐  ┌─────────────┐       │
│ │ Theme Name  │  │ Theme Name  │       │
│ │ [Preview]   │  │ [Preview]   │       │
│ │             │  │             │       │
│ │  [Select]   │  │  [Copy]     │       │
│ └─────────────┘  └─────────────┘       │
│                                         │
│ [Load More] or Pagination               │
└─────────────────────────────────────────┘
```

---

## Prerequisites

**Must complete before starting:**
- **25-REACT-AUTH-CONTEXT.md** - Authentication context for checking if user is logged in
- **28-REACT-TOAST-SYSTEM.md** - Toast notifications for feedback
- **105-API-THEME-LIST.md** - GET /api/themes endpoint
- **106-API-THEME-MINE.md** - GET /api/themes/mine endpoint
- **110-API-THEME-COPY.md** - POST /api/themes/:id/copy endpoint

**Reason:** Component needs authentication context, needs to fetch themes from API endpoints, and uses toast system for feedback.

---

## Steps

### Step 1: Create Theme Response Hook

Create a custom hook for fetching themes from API:

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/hooks/useThemes.ts`

```typescript
import { useState, useEffect, useCallback } from 'react';
import type { ThemeResponse } from '../types/theme';

export interface UseThemesOptions {
  limit?: number;
  sortBy?: 'name' | 'created_at' | 'popularity';
  includeSystem?: boolean;
}

interface PaginationInfo {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export function usePublicThemes(options: UseThemesOptions = {}) {
  const [themes, setThemes] = useState<ThemeResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [offset, setOffset] = useState(0);

  const limit = options.limit || 50;
  const sortBy = options.sortBy || 'name';

  const fetchThemes = useCallback(
    async (pageOffset = 0) => {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        params.append('limit', limit.toString());
        params.append('offset', pageOffset.toString());
        params.append('sortBy', sortBy);

        const response = await fetch(`/api/themes?${params.toString()}`);

        if (!response.ok) {
          throw new Error('Failed to fetch themes');
        }

        const data = await response.json();
        setThemes(pageOffset === 0 ? data.data : [...themes, ...data.data]);
        setPagination(data.pagination);
        setOffset(pageOffset);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    },
    [limit, sortBy, themes]
  );

  useEffect(() => {
    fetchThemes(0);
  }, []);

  return {
    themes,
    loading,
    error,
    pagination,
    loadMore: () => fetchThemes(offset + limit),
  };
}

export function useUserThemes(options: UseThemesOptions = {}) {
  const [themes, setThemes] = useState<ThemeResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [offset, setOffset] = useState(0);

  const limit = options.limit || 50;

  const fetchThemes = useCallback(
    async (pageOffset = 0) => {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        params.append('limit', limit.toString());
        params.append('offset', pageOffset.toString());
        if (options.includeSystem) {
          params.append('includeSystem', 'true');
        }

        const response = await fetch(`/api/themes/mine?${params.toString()}`);

        if (!response.ok) {
          if (response.status === 401) {
            throw new Error('Authentication required');
          }
          throw new Error('Failed to fetch your themes');
        }

        const data = await response.json();
        setThemes(pageOffset === 0 ? data.data : [...themes, ...data.data]);
        setPagination(data.pagination);
        setOffset(pageOffset);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    },
    [limit, options.includeSystem, themes]
  );

  useEffect(() => {
    fetchThemes(0);
  }, []);

  return {
    themes,
    loading,
    error,
    pagination,
    loadMore: () => fetchThemes(offset + limit),
    refetch: () => fetchThemes(0),
  };
}
```

### Step 2: Create Theme Card Component

Create a reusable card component for displaying individual themes:

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/ThemeCard.tsx`

```typescript
import React from 'react';
import type { ThemeResponse } from '../types/theme';
import { ThemePreview } from './ThemePreview';

interface ThemeCardProps {
  theme: ThemeResponse;
  selected?: boolean;
  onSelect?: (theme: ThemeResponse) => void;
  onCopy?: (themeId: string) => void;
  onEdit?: (theme: ThemeResponse) => void;
  onDelete?: (themeId: string) => void;
  showActions?: boolean;
  isOwn?: boolean;
}

export const ThemeCard: React.FC<ThemeCardProps> = ({
  theme,
  selected = false,
  onSelect,
  onCopy,
  onEdit,
  onDelete,
  showActions = true,
  isOwn = false,
}) => {
  return (
    <div
      className={`
        p-4 border-2 rounded-lg transition-all
        ${
          selected
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-200 bg-white hover:border-gray-300'
        }
      `}
    >
      {/* Theme Name */}
      <h3 className="font-semibold text-lg mb-2">{theme.name}</h3>

      {/* Description */}
      {theme.description && (
        <p className="text-sm text-gray-600 mb-3">{theme.description}</p>
      )}

      {/* Creator Info */}
      {theme.creator && !isOwn && (
        <div className="text-xs text-gray-500 mb-3">
          By {theme.creator.displayName || theme.creator.username}
        </div>
      )}

      {/* Theme Preview */}
      <div className="mb-4">
        <ThemePreview theme={theme} compact={true} />
      </div>

      {/* Copy Badge */}
      {theme.copiedFrom && (
        <div className="text-xs text-gray-500 mb-2">
          Copied from original theme
        </div>
      )}

      {/* Actions */}
      {showActions && (
        <div className="flex gap-2">
          {onSelect && (
            <button
              onClick={() => onSelect(theme)}
              className={`
                flex-1 py-2 rounded font-medium transition-colors
                ${
                  selected
                    ? 'bg-blue-500 text-white'
                    : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                }
              `}
            >
              {selected ? 'Selected' : 'Select'}
            </button>
          )}

          {onCopy && !isOwn && (
            <button
              onClick={() => onCopy(theme.id)}
              className="flex-1 py-2 rounded font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
            >
              Copy
            </button>
          )}

          {isOwn && onEdit && (
            <button
              onClick={() => onEdit(theme)}
              className="flex-1 py-2 rounded font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
            >
              Edit
            </button>
          )}

          {isOwn && onDelete && (
            <button
              onClick={() => onDelete(theme.id)}
              className="flex-1 py-2 rounded font-medium bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
            >
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
};
```

### Step 3: Create Theme Picker Component

Create the main ThemePicker component:

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/ThemePicker.tsx`

```typescript
import React, { useState, useMemo } from 'react';
import type { ThemeResponse } from '../types/theme';
import { usePublicThemes, useUserThemes } from '../hooks/useThemes';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { ThemeCard } from './ThemeCard';

type TabType = 'system' | 'public' | 'my-themes';

interface ThemePickerProps {
  currentThemeId?: string | null;
  onThemeSelect: (theme: ThemeResponse) => void;
  onCopyTheme?: (themeId: string, name?: string) => void;
  context?: 'gallery' | 'collection';
  showMyThemes?: boolean;
  onClose?: () => void;
}

export const ThemePicker: React.FC<ThemePickerProps> = ({
  currentThemeId,
  onThemeSelect,
  onCopyTheme,
  context = 'gallery',
  showMyThemes = true,
  onClose,
}) => {
  const { isAuthenticated } = useAuth();
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState<TabType>('system');
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch public themes
  const publicThemes = usePublicThemes({ sortBy: 'name' });

  // Fetch user themes
  const userThemes = useUserThemes();

  // Filter themes by search query
  const filteredPublicThemes = useMemo(
    () =>
      publicThemes.themes.filter((t) =>
        t.name.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [publicThemes.themes, searchQuery]
  );

  const filteredUserThemes = useMemo(
    () =>
      userThemes.themes.filter((t) =>
        t.name.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [userThemes.themes, searchQuery]
  );

  // Filter public themes to only show system themes
  const systemThemes = useMemo(
    () => filteredPublicThemes.filter((t) => t.isSystem),
    [filteredPublicThemes]
  );

  // Filter public themes to only show non-system public themes
  const publicUserThemes = useMemo(
    () => filteredPublicThemes.filter((t) => !t.isSystem && t.isPublic),
    [filteredPublicThemes]
  );

  // Get current tab themes
  const getCurrentTabThemes = () => {
    switch (activeTab) {
      case 'system':
        return systemThemes;
      case 'public':
        return publicUserThemes;
      case 'my-themes':
        return filteredUserThemes;
      default:
        return [];
    }
  };

  const currentTabThemes = getCurrentTabThemes();
  const isLoadingCurrent =
    activeTab === 'system' || activeTab === 'public'
      ? publicThemes.loading
      : userThemes.loading;

  const handleCopyTheme = async (themeId: string) => {
    if (!onCopyTheme) return;

    try {
      onCopyTheme(themeId);
      addToast('Theme copied successfully!', 'success');
      // Refetch user themes
      userThemes.refetch();
    } catch (err) {
      addToast('Failed to copy theme', 'error');
    }
  };

  const handleDeleteTheme = async (themeId: string) => {
    if (!confirm('Are you sure you want to delete this theme?')) return;

    try {
      const response = await fetch(`/api/themes/${themeId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete theme');
      }

      addToast('Theme deleted successfully', 'success');
      userThemes.refetch();
    } catch (err) {
      addToast('Failed to delete theme', 'error');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-semibold">
            Choose {context} Theme
          </h2>
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl"
            >
              ×
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-b px-4">
          <button
            onClick={() => setActiveTab('system')}
            className={`
              px-4 py-3 font-medium border-b-2 transition-colors
              ${
                activeTab === 'system'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }
            `}
          >
            System Themes
          </button>
          <button
            onClick={() => setActiveTab('public')}
            className={`
              px-4 py-3 font-medium border-b-2 transition-colors
              ${
                activeTab === 'public'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }
            `}
          >
            Public Themes
          </button>
          {isAuthenticated && showMyThemes && (
            <button
              onClick={() => setActiveTab('my-themes')}
              className={`
                px-4 py-3 font-medium border-b-2 transition-colors
                ${
                  activeTab === 'my-themes'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }
              `}
            >
              My Themes
            </button>
          )}
        </div>

        {/* Search */}
        <div className="p-4 border-b">
          <input
            type="text"
            placeholder="Search themes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoadingCurrent ? (
            <div className="text-center py-8 text-gray-500">
              Loading themes...
            </div>
          ) : currentTabThemes.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No themes found
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {currentTabThemes.map((theme) => (
                <ThemeCard
                  key={theme.id}
                  theme={theme}
                  selected={currentThemeId === theme.id}
                  onSelect={onThemeSelect}
                  onCopy={
                    activeTab !== 'my-themes'
                      ? handleCopyTheme
                      : undefined
                  }
                  onDelete={
                    activeTab === 'my-themes'
                      ? handleDeleteTheme
                      : undefined
                  }
                  isOwn={activeTab === 'my-themes'}
                />
              ))}
            </div>
          )}

          {/* Load More */}
          {activeTab !== 'my-themes' &&
            publicThemes.pagination?.hasMore && (
              <div className="mt-4 text-center">
                <button
                  onClick={() => publicThemes.loadMore()}
                  disabled={publicThemes.loading}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50"
                >
                  {publicThemes.loading ? 'Loading...' : 'Load More'}
                </button>
              </div>
            )}
        </div>
      </div>
    </div>
  );
};
```

### Step 4: Create ThemePreview Component

Create the preview component that shows a sample with theme colors:

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/ThemePreview.tsx`

```typescript
import React from 'react';
import type { ThemeResponse } from '../types/theme';

interface ThemePreviewProps {
  theme: ThemeResponse;
  compact?: boolean;
}

export const ThemePreview: React.FC<ThemePreviewProps> = ({
  theme,
  compact = false,
}) => {
  const { styles } = theme;

  if (compact) {
    return (
      <div
        className="h-24 rounded border p-3 flex items-center gap-2"
        style={{ backgroundColor: styles.background, color: styles.text }}
      >
        {/* Color swatches */}
        <div className="flex gap-1">
          <div
            className="w-4 h-4 rounded"
            style={{ backgroundColor: styles.primary }}
            title="Primary"
          />
          <div
            className="w-4 h-4 rounded"
            style={{ backgroundColor: styles.secondary }}
            title="Secondary"
          />
          <div
            className="w-4 h-4 rounded"
            style={{ backgroundColor: styles.accent }}
            title="Accent"
          />
          <div
            className="w-4 h-4 rounded"
            style={{ backgroundColor: styles.surface }}
            title="Surface"
          />
        </div>

        {/* Typography sample */}
        <div className="flex-1">
          <div
            className="text-sm font-bold"
            style={{
              fontFamily: styles.fontFamily,
              fontSize: styles.fontSizeBase,
            }}
          >
            Aa
          </div>
          <div
            className="text-xs"
            style={{
              fontFamily: styles.fontFamily,
              color: styles.textSecondary,
            }}
          >
            Text
          </div>
        </div>
      </div>
    );
  }

  // Full preview
  return (
    <div
      className="p-6 rounded border"
      style={{ backgroundColor: styles.background, color: styles.text }}
    >
      {/* Header */}
      <div className="mb-4 pb-4 border-b" style={{ borderColor: styles.border }}>
        <h4
          className="font-bold mb-2"
          style={{ fontFamily: styles.fontFamily, fontSize: '18px' }}
        >
          Sample Gallery Header
        </h4>
        <p
          className="text-sm"
          style={{
            fontFamily: styles.fontFamily,
            color: styles.textSecondary,
            fontSize: styles.fontSizeBase,
          }}
        >
          This demonstrates how your theme will look
        </p>
      </div>

      {/* Card/Surface Example */}
      <div
        className="p-4 rounded mb-4"
        style={{ backgroundColor: styles.surface }}
      >
        <h5
          className="font-semibold mb-2"
          style={{ fontFamily: styles.fontFamily }}
        >
          Card Title
        </h5>
        <p
          style={{
            fontFamily: styles.fontFamily,
            color: styles.textSecondary,
            fontSize: styles.fontSizeBase,
          }}
        >
          This is a sample card demonstrating surface styling.
        </p>
      </div>

      {/* Button Example */}
      <div className="flex gap-2">
        <button
          className="px-4 py-2 rounded font-medium text-white"
          style={{ backgroundColor: styles.primary }}
        >
          Primary Button
        </button>
        <button
          className="px-4 py-2 rounded font-medium"
          style={{
            backgroundColor: styles.accent,
            color: styles.background,
          }}
        >
          Accent Button
        </button>
      </div>

      {/* Color Reference */}
      <div className="mt-4 pt-4 border-t" style={{ borderColor: styles.border }}>
        <div className="text-xs font-semibold mb-2">Colors used:</div>
        <div className="grid grid-cols-4 gap-2">
          <div>
            <div
              className="w-8 h-8 rounded mb-1"
              style={{ backgroundColor: styles.primary }}
            />
            <div className="text-xs truncate">Primary</div>
          </div>
          <div>
            <div
              className="w-8 h-8 rounded mb-1"
              style={{ backgroundColor: styles.accent }}
            />
            <div className="text-xs truncate">Accent</div>
          </div>
          <div>
            <div
              className="w-8 h-8 rounded mb-1"
              style={{ backgroundColor: styles.surface }}
            />
            <div className="text-xs truncate">Surface</div>
          </div>
          <div>
            <div
              className="w-8 h-8 rounded border"
              style={{
                backgroundColor: styles.border,
                borderColor: styles.textSecondary,
              }}
            />
            <div className="text-xs truncate">Border</div>
          </div>
        </div>
      </div>
    </div>
  );
};
```

### Step 5: Export Components

Create barrel exports for easier imports:

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/index.ts` (modify existing to add)

```typescript
// ... existing exports ...
export { ThemePicker } from './ThemePicker';
export { ThemeCard } from './ThemeCard';
export { ThemePreview } from './ThemePreview';
export type { ThemeCardProps } from './ThemeCard';
```

### Step 6: Test Component Integration

Create a demo page to test the component:

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/pages/ThemePickerDemo.tsx` (test file, optional)

```typescript
import React, { useState } from 'react';
import { ThemePicker } from '../components/ThemePicker';
import type { ThemeResponse } from '../types/theme';

export const ThemePickerDemo: React.FC = () => {
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  const handleThemeSelect = (theme: ThemeResponse) => {
    setSelectedTheme(theme.id);
    setShowPicker(false);
    console.log('Selected theme:', theme);
  };

  const handleCopyTheme = (themeId: string) => {
    console.log('Copy theme:', themeId);
    // Call API to copy theme
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Theme Picker Demo</h1>

      <div className="mb-4">
        <p>Selected Theme ID: {selectedTheme || 'None'}</p>
        <button
          onClick={() => setShowPicker(true)}
          className="px-4 py-2 bg-blue-500 text-white rounded"
        >
          Open Theme Picker
        </button>
      </div>

      {showPicker && (
        <ThemePicker
          currentThemeId={selectedTheme}
          onThemeSelect={handleThemeSelect}
          onCopyTheme={handleCopyTheme}
          context="gallery"
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  );
};
```

---

## Files to Create/Modify

**Create:**
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/hooks/useThemes.ts` - Custom hooks for fetching themes
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/ThemePicker.tsx` - Main picker component
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/ThemeCard.tsx` - Theme card component
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/ThemePreview.tsx` - Preview component

**Modify:**
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/index.ts` - Add component exports

---

## Verification

### Test 1: Component Renders Without Errors

```bash
cd /Volumes/DataSSD/gitsrc/vfa_gallery
npm run dev
```

Navigate to any page and open the component in browser console.

### Test 2: Theme Picker Opens and Closes

- Click "Open Theme Picker" button
- Verify modal appears
- Click the X button to close
- Verify modal closes

### Test 3: System Themes Tab Shows Themes

- Open theme picker
- Go to "System Themes" tab
- Verify at least one system theme displays
- Verify each has a preview

### Test 4: Public Themes Tab Works

- Open theme picker
- Go to "Public Themes" tab
- Verify themes are listed (if any exist)

### Test 5: My Themes Tab (If Authenticated)

- Log in
- Open theme picker
- Verify "My Themes" tab appears
- Click tab
- Verify user's custom themes display

### Test 6: Search Filters Themes

- Open theme picker
- Type in search box
- Verify themes are filtered by name

### Test 7: Select Theme Works

- Open theme picker
- Click "Select" on a theme
- Verify onThemeSelect callback is called
- Verify selected theme is highlighted with blue border

### Test 8: Copy Theme Works

- Open theme picker
- Go to "System Themes" tab
- Click "Copy" button on a theme
- Verify API call is made
- Verify toast notification appears

### Test 9: Load More Works

- Open theme picker
- Scroll to bottom
- If hasMore is true, verify "Load More" button appears
- Click button
- Verify more themes load

### Test 10: Theme Preview Shows Colors

- Open theme picker
- Select a theme
- Verify preview shows color swatches
- Verify preview shows sample text

### Test 11: Edit/Delete Buttons For Own Themes

- Log in
- Go to "My Themes" tab
- For user's own themes, verify "Edit" and "Delete" buttons appear
- For non-own themes, verify "Copy" button appears

### Test 12: Current Theme Highlighted

- Pass currentThemeId prop
- Verify that theme has blue border
- Verify "Select" button shows "Selected"

---

## Success Criteria

- [ ] useThemes custom hooks created for fetching public and user themes
- [ ] ThemePicker component created with tabs for System/Public/My Themes
- [ ] ThemeCard component created for displaying individual themes
- [ ] ThemePreview component created showing theme colors and sample layout
- [ ] Component renders without errors
- [ ] Theme tabs work correctly
- [ ] Search/filter by name works
- [ ] Select theme callback works
- [ ] Copy theme works (calls API)
- [ ] Load more pagination works
- [ ] Current selection highlighted
- [ ] Edit/Delete buttons visible for user's themes
- [ ] Responsive design works on mobile
- [ ] Loading states display correctly
- [ ] Error handling displays messages

---

## Next Steps

Once verified, proceed to:
- **Build 112:** UI Theme Preview component (full page version)
- **Build 113:** Integrate Theme Picker into Gallery Create/Edit UI
- **Build 114:** Integrate Theme Picker into Collection Create/Edit UI
