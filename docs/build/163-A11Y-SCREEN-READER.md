# 163-A11Y-SCREEN-READER.md
## Implement Screen Reader Support Throughout the App

**Goal:** Add comprehensive screen reader support using semantic HTML and ARIA labels to enable full accessibility for users with visual impairments.

---

## Spec Extract

From **01-TECHNICAL-SPEC.md**:
- **Accessibility:** WCAG 2.1 AA compliance required

From **04-UI-UX-SPEC.md**:
- **Accessibility Focus:** Screen reader navigation and announcements

---

## Prerequisites

**Must Complete First:**
- 162-A11Y-KEYBOARD-NAV.md ✓

---

## Steps

### Step 1: Audit Current HTML Structure

Before implementing screen reader support, audit your component files in `/vfa-gallery/src/`:

```bash
grep -r "<div\|<span" src/ | grep -i "button\|link\|nav\|menu" | head -20
```

This identifies non-semantic HTML that should be replaced with semantic elements.

### Step 2: Implement Semantic HTML Structure

Replace generic `<div>` and `<span>` elements with semantic alternatives. In all layout components:

Edit `/vfa-gallery/src/components/Layout/Header.tsx`:
```tsx
// Before (BAD)
<div className="header">
  <div>VFA.gallery</div>
  <div className="nav-menu">
    <div className="nav-item"><a href="/galleries">Galleries</a></div>
  </div>
</div>

// After (GOOD)
<header className="header bg-gray-900 text-white py-4 px-6">
  <div className="flex justify-between items-center">
    <h1 className="text-2xl font-bold">VFA.gallery</h1>
    <nav className="flex gap-6" aria-label="Main navigation">
      <a href="/galleries" className="hover:underline">
        Galleries
      </a>
      <a href="/search" className="hover:underline">
        Search
      </a>
    </nav>
  </div>
</header>
```

Edit `/vfa-gallery/src/components/Layout/Main.tsx`:
```tsx
<main className="main-content flex-1 p-4 sm:p-6 lg:p-8">
  {children}
</main>
```

Edit `/vfa-gallery/src/components/Layout/Sidebar.tsx`:
```tsx
<aside className="sidebar w-64 bg-gray-100" aria-label="Sidebar navigation">
  <nav className="p-4">
    {/* Navigation items */}
  </nav>
</aside>
```

Edit `/vfa-gallery/src/components/Layout/Footer.tsx`:
```tsx
<footer className="footer bg-gray-900 text-white py-8 px-6 mt-16">
  <article className="max-w-6xl mx-auto">
    <section className="grid grid-cols-1 md:grid-cols-3 gap-8">
      {/* Footer content */}
    </section>
  </article>
</footer>
```

### Step 3: Add ARIA Labels to Icon Buttons

In `/vfa-gallery/src/components/UI/IconButton.tsx`, create a reusable component:

```tsx
import React from 'react';

interface IconButtonProps {
  icon: React.ReactNode;
  ariaLabel: string;
  onClick?: () => void;
  className?: string;
}

export function IconButton({
  icon,
  ariaLabel,
  onClick,
  className = ''
}: IconButtonProps) {
  return (
    <button
      aria-label={ariaLabel}
      onClick={onClick}
      className={`p-2 rounded hover:bg-gray-200 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${className}`}
    >
      {icon}
    </button>
  );
}
```

Usage in components:
```tsx
<IconButton
  icon={<SearchIcon />}
  ariaLabel="Search galleries"
  onClick={handleSearch}
/>

<IconButton
  icon={<MenuIcon />}
  ariaLabel="Toggle navigation menu"
  onClick={toggleMenu}
/>

<IconButton
  icon={<HeartIcon />}
  ariaLabel={isFavorited ? "Remove from favorites" : "Add to favorites"}
  onClick={toggleFavorite}
/>
```

### Step 4: Add ARIA Labels to Images

In `/vfa-gallery/src/components/Gallery/ArtworkCard.tsx`:

```tsx
interface ArtworkCardProps {
  id: string;
  title: string;
  artist: string;
  imageUrl: string;
  description?: string;
}

export function ArtworkCard({
  id,
  title,
  artist,
  imageUrl,
  description
}: ArtworkCardProps) {
  return (
    <article className="artwork-card">
      <img
        src={imageUrl}
        alt={`${title} by ${artist}`}
        className="w-full h-64 object-cover rounded"
        title={description}
      />
      <div className="p-4">
        <h3 className="font-semibold text-lg">{title}</h3>
        <p className="text-gray-600">{artist}</p>
      </div>
    </article>
  );
}
```

For decorative images (use `alt=""` and `aria-hidden="true"`):
```tsx
<img
  src="/logo.png"
  alt=""
  aria-hidden="true"
  className="h-8 w-8"
/>
```

### Step 5: Implement aria-live Regions for Dynamic Content

In `/vfa-gallery/src/components/UI/Toast.tsx`:

```tsx
interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  isVisible: boolean;
}

export function Toast({ message, type, isVisible }: ToastProps) {
  const bgColor = {
    success: 'bg-green-100',
    error: 'bg-red-100',
    info: 'bg-blue-100',
    warning: 'bg-yellow-100',
  }[type];

  const textColor = {
    success: 'text-green-800',
    error: 'text-red-800',
    info: 'text-blue-800',
    warning: 'text-yellow-800',
  }[type];

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={`${bgColor} ${textColor} p-4 rounded fixed bottom-4 right-4 ${
        isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      } transition-opacity`}
    >
      {message}
    </div>
  );
}
```

In `/vfa-gallery/src/components/UI/LoadingSpinner.tsx`:

```tsx
export function LoadingSpinner() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading content"
      className="flex items-center justify-center"
    >
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
    </div>
  );
}
```

In `/vfa-gallery/src/components/Search/SearchResults.tsx`:

```tsx
interface SearchResultsProps {
  results: Artwork[];
  isLoading: boolean;
  query: string;
}

export function SearchResults({ results, isLoading, query }: SearchResultsProps) {
  return (
    <section
      role="region"
      aria-live="assertive"
      aria-label={`Search results for ${query}`}
      className="search-results"
    >
      {isLoading ? (
        <LoadingSpinner />
      ) : results.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {results.map(artwork => (
            <ArtworkCard key={artwork.id} {...artwork} />
          ))}
        </div>
      ) : (
        <p className="text-center text-gray-600">
          No results found for "{query}"
        </p>
      )}
    </section>
  );
}
```

### Step 6: Create sr-only CSS Class

In `/vfa-gallery/src/index.css`, add the sr-only utility class:

```css
/* Screen reader only class - visually hidden but accessible */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
```

Or add to Tailwind config in `/vfa-gallery/tailwind.config.js`:

```javascript
export default {
  theme: {
    extend: {
      // ... other extensions
    },
  },
  plugins: [
    function({ addUtilities }) {
      addUtilities({
        '.sr-only': {
          position: 'absolute',
          width: '1px',
          height: '1px',
          padding: '0',
          margin: '-1px',
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          'white-space': 'nowrap',
          'border-width': '0',
        },
      });
    },
  ],
}
```

### Step 7: Use sr-only for Hidden Text

In components with icon-only buttons or unclear labels, add hidden text for screen readers:

In `/vfa-gallery/src/components/UI/IconButton.tsx`:
```tsx
export function IconButton({
  icon,
  ariaLabel,
  onClick,
  className = ''
}: IconButtonProps) {
  return (
    <button
      aria-label={ariaLabel}
      onClick={onClick}
      className={`p-2 rounded hover:bg-gray-200 focus:ring-2 focus:ring-blue-500 ${className}`}
    >
      {icon}
      <span className="sr-only">{ariaLabel}</span>
    </button>
  );
}
```

In `/vfa-gallery/src/components/Gallery/GalleryGrid.tsx`:
```tsx
<div className="gallery-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
  <h2 className="sr-only">Gallery Collection</h2>
  {galleries.map(gallery => (
    <GalleryCard key={gallery.id} {...gallery} />
  ))}
</div>
```

### Step 8: Set Proper Heading Hierarchy

Review all components and ensure proper heading hierarchy (h1 → h2 → h3, etc., no skipping levels):

In `/vfa-gallery/src/pages/GalleryPage.tsx`:
```tsx
export function GalleryPage() {
  return (
    <main>
      {/* Only ONE h1 per page */}
      <h1 className="text-4xl font-bold mb-8">Featured Galleries</h1>

      {/* Subsections use h2 */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-6">Recent Updates</h2>
        <div className="grid grid-cols-3 gap-4">
          {/* Content */}
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-6">Popular This Week</h2>
        {/* Subsections use h3 */}
        <article>
          <h3 className="text-xl font-semibold mb-4">Category: Portraits</h3>
          {/* Content */}
        </article>
      </section>
    </main>
  );
}
```

### Step 9: Test with Screen Reader

Install and test with:
- **macOS**: VoiceOver (built-in) - Enable with `Cmd + F5`
- **Windows**: NVDA (free, open-source) - Download from https://www.nvaccess.org/
- **Chrome**: ChromeVox extension

Test with VoiceOver on macOS:
1. Enable VoiceOver: System Preferences → Accessibility → VoiceOver → Enable
2. Press `VO` (usually Control-Option) + U to open Web Rotor
3. Navigate through headings, links, buttons, and form controls
4. Verify:
   - All interactive elements are announced correctly
   - Heading hierarchy is logical
   - Form labels are associated with inputs
   - Dynamic content updates are announced

### Step 10: Add ARIA Labels to Form Controls

In `/vfa-gallery/src/components/Forms/SearchForm.tsx`:

```tsx
export function SearchForm() {
  const [query, setQuery] = React.useState('');

  return (
    <form className="search-form flex gap-2" onSubmit={handleSubmit}>
      <label htmlFor="search-input" className="sr-only">
        Search artworks
      </label>
      <input
        id="search-input"
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search artworks, artists, galleries..."
        className="flex-1 px-4 py-2 border rounded focus:ring-2 focus:ring-blue-500"
        aria-describedby="search-help"
      />
      <button
        type="submit"
        aria-label="Search"
        className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        Search
      </button>
      <p id="search-help" className="sr-only">
        Enter artwork title, artist name, or gallery name
      </p>
    </form>
  );
}
```

---

## Files to Create/Modify

**Created:**
- `/vfa-gallery/src/components/UI/IconButton.tsx` - Reusable icon button with ARIA labels
- `/vfa-gallery/src/components/UI/Toast.tsx` - Toast notifications with aria-live
- `/vfa-gallery/src/components/UI/LoadingSpinner.tsx` - Loading spinner with role and aria-label

**Modified:**
- `/vfa-gallery/src/components/Layout/Header.tsx` - Use `<header>` and `<nav>` with aria-label
- `/vfa-gallery/src/components/Layout/Main.tsx` - Use `<main>` semantic element
- `/vfa-gallery/src/components/Layout/Sidebar.tsx` - Use `<aside>` with aria-label
- `/vfa-gallery/src/components/Layout/Footer.tsx` - Use `<footer>` and `<article>`
- `/vfa-gallery/src/components/Gallery/ArtworkCard.tsx` - Add proper alt text to images
- `/vfa-gallery/src/components/Search/SearchResults.tsx` - Add role and aria-live
- `/vfa-gallery/src/components/Forms/SearchForm.tsx` - Associate labels with inputs
- `/vfa-gallery/src/index.css` - Add sr-only class
- `/vfa-gallery/tailwind.config.js` - Add sr-only utility (if not in index.css)

---

## Verification Checklist

- [ ] VoiceOver/NVDA can navigate through all headings using rotor
- [ ] All icon buttons have proper aria-labels
- [ ] All images have meaningful alt text (or alt="" for decorative images)
- [ ] Toast notifications are announced when they appear
- [ ] Loading spinners are announced
- [ ] Search results region updates are announced
- [ ] No heading hierarchy skips levels (h1 → h2 → h3 only)
- [ ] Form inputs have associated `<label>` elements
- [ ] All interactive elements are reachable via keyboard
- [ ] Screen reader announces page structure correctly
- [ ] No console errors when testing with screen reader

Once all items checked, proceed to **164-A11Y-COLOR-CONTRAST.md**.
