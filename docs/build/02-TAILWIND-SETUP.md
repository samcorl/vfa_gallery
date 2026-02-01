# 02-TAILWIND-SETUP.md
## Configure Tailwind CSS with Mobile-First Breakpoints

**Goal:** Install and configure Tailwind CSS with PostCSS, define mobile-first breakpoints, and verify Tailwind classes work in React components.

---

## Spec Extract

From **01-TECHNICAL-SPEC.md**:
- **Styling:** Tailwind CSS

From **04-UI-UX-SPEC.md**:
- **Design Principles:** Mobile-first design
- **Responsive Breakpoints:**
  - Mobile: `<640px`
  - Tablet: `640px - 1024px`
  - Desktop: `>1024px`

---

## Prerequisites

**Must Complete First:**
- 01-PROJECT-SCAFFOLD.md ✓

---

## Steps

### Step 1: Install Tailwind CSS and Dependencies

From the project root (`/site`), run:

```bash
npm install -D tailwindcss postcss autoprefixer
```

This installs:
- `tailwindcss` - The Tailwind CSS framework
- `postcss` - CSS processor required by Tailwind
- `autoprefixer` - Adds vendor prefixes to CSS

### Step 2: Initialize Tailwind Configuration

```bash
npx tailwindcss init -p
```

This creates two files:
- `tailwind.config.js` - Tailwind configuration
- `postcss.config.js` - PostCSS configuration

Both files will be generated in `/site/` (project root).

### Step 3: Configure Tailwind Content Paths

Edit `/site/tailwind.config.js` and set the `content` array to:

```javascript
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

This tells Tailwind to scan all React files for class names and only include used styles in the final CSS bundle.

### Step 4: Define Mobile-First Breakpoints

Update `/site/tailwind.config.js` to explicitly define breakpoints (these match Tailwind defaults, but we're making them explicit):

```javascript
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      screens: {
        'sm': '640px',   // Tablet breakpoint
        'md': '768px',   // Medium breakpoint
        'lg': '1024px',  // Desktop breakpoint
        'xl': '1280px',  // Large desktop
        '2xl': '1536px', // Extra large
      },
    },
  },
  plugins: [],
}
```

**Breakpoint Usage in Components:**
- `mobile: <640px` (no prefix, default styles)
- `sm:` prefix for `>=640px` (tablets)
- `lg:` prefix for `>=1024px` (desktop)

Example:
```tsx
<div className="text-sm sm:text-base lg:text-lg">
  // text-sm on mobile, text-base on tablet, text-lg on desktop
</div>
```

### Step 5: Add Tailwind Directives to Global CSS

Edit `/site/src/index.css` (or create it if missing) and replace entire contents with:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Optional: Add custom utilities or resets here */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
```

### Step 6: Import Global CSS in main.tsx

Edit `/site/src/main.tsx` and ensure it imports the CSS file:

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

The `import './index.css'` line must be present.

### Step 7: Update App.tsx with Tailwind Classes

Edit `/site/src/App.tsx` to use Tailwind classes:

```tsx
import React from 'react';

function App() {
  return (
    <div className="min-h-screen bg-white">
      <header className="bg-gradient-to-r from-purple-600 to-blue-600 text-white py-8 px-4">
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold">VFA.gallery</h1>
        <p className="text-base sm:text-lg mt-2">Let art speak for itself</p>
      </header>

      <main className="p-4 sm:p-6 lg:p-8">
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-gray-100 rounded-lg p-4 shadow">
            <h2 className="font-semibold text-lg">Foundation</h2>
            <p className="text-gray-600 text-sm">React + TypeScript + Tailwind CSS</p>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
```

### Step 8: Start Development Server

```bash
npm run dev
```

Navigate to `http://localhost:5173` in your browser.

### Step 9: Test Responsive Design

In browser DevTools (F12):
1. Toggle device toolbar (mobile view)
2. Verify styles change at breakpoints:
   - At `<640px`: Smaller text, single column
   - At `>=640px`: Medium text, two columns (if on tablet)
   - At `>=1024px`: Larger text, three columns (desktop)
3. No console errors should appear

### Step 10: Test Tailwind Classes Compile

Tailwind should inject its CSS into the page. In browser DevTools:
1. Open **Inspector** (Elements tab)
2. Right-click on the heading
3. Click **Inspect Element**
4. Verify computed styles show Tailwind's utilities (e.g., `text-3xl`, `font-bold`)

---

## Files to Create/Modify

**Created:**
- `/site/tailwind.config.js` - Tailwind configuration with breakpoints
- `/site/postcss.config.js` - PostCSS configuration (auto-generated)
- `/site/src/index.css` - Global CSS with @tailwind directives

**Modified:**
- `/site/src/App.tsx` - Add Tailwind classes to markup
- `/site/src/main.tsx` - Import index.css
- `/site/package.json` - Added dev dependencies

---

## Verification Checklist

- [ ] `npm run dev` starts successfully with no errors
- [ ] Browser displays styled page with gradient header and grid layout
- [ ] Browser DevTools shows computed Tailwind CSS classes (e.g., `text-3xl`)
- [ ] Mobile view (`<640px`): Single column, smaller text
- [ ] Tablet view (`>=640px`): Two columns, medium text
- [ ] Desktop view (`>=1024px`): Three columns, larger text
- [ ] No console errors in browser
- [ ] No TypeScript errors (`npx tsc --noEmit`)

Once all items checked, proceed to **03-CLOUDFLARE-PAGES-INIT.md**.
