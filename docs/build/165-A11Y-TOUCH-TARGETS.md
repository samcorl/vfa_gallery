# 165-A11Y-TOUCH-TARGETS.md
## Implement Adequate Touch Target Sizing for Mobile Accessibility

**Goal:** Ensure all interactive elements meet WCAG AAA touch target requirements (minimum 44x44 CSS pixels) with adequate spacing to prevent mis-taps on mobile devices.

---

## Spec Extract

From **01-TECHNICAL-SPEC.md**:
- **Accessibility:** WCAG 2.1 AA compliance required
- **Target Users:** Mobile and desktop users

From **04-UI-UX-SPEC.md**:
- **Mobile-First Design:** Responsive design for all devices
- **Touch-Friendly:** Adequate spacing and sizing for touch input

---

## Prerequisites

**Must Complete First:**
- 27-RESPONSIVE-LAYOUT.md ✓

---

## Steps

### Step 1: Install Touch Target Auditing Tools

Install development dependencies:

```bash
npm install -D @testing-library/react @testing-library/jest-dom jest
```

### Step 2: Define Touch Target Base Sizes

Update `/vfa-gallery/tailwind.config.js` to add custom utilities for touch targets:

```javascript
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      spacing: {
        'touch-target': '44px', // WCAG AAA standard
        'touch-spacing': '8px',  // Minimum spacing between targets
      },
    },
  },
  plugins: [
    function({ addUtilities }) {
      addUtilities({
        '.touch-target': {
          minHeight: '44px',
          minWidth: '44px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        },
        '.touch-target-text': {
          minHeight: '44px',
          minWidth: '44px',
          padding: '8px',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        },
        '.touch-spacing': {
          gap: '8px',
        },
        '.touch-spacing-x': {
          columnGap: '8px',
        },
        '.touch-spacing-y': {
          rowGap: '8px',
        },
      });
    },
  ],
}
```

### Step 3: Create Touch-Target Base Component

Create `/vfa-gallery/src/components/UI/TouchButton.tsx`:

```tsx
import React from 'react';

interface TouchButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  ariaLabel?: string;
  className?: string;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
}

/**
 * Button component that ensures minimum 44x44px touch target size
 * Meets WCAG AAA guidelines for mobile accessibility
 */
export function TouchButton({
  children,
  onClick,
  ariaLabel,
  className = '',
  disabled = false,
  type = 'button',
}: TouchButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      aria-label={ariaLabel}
      disabled={disabled}
      className={`
        touch-target
        px-4 py-3
        rounded
        font-semibold
        transition-all
        focus:ring-2
        focus:ring-offset-2
        focus:ring-blue-500
        hover:bg-opacity-90
        disabled:opacity-50
        disabled:cursor-not-allowed
        ${className}
      `}
    >
      {children}
    </button>
  );
}
```

### Step 4: Create Touch-Target Link Component

Create `/vfa-gallery/src/components/UI/TouchLink.tsx`:

```tsx
import React from 'react';

interface TouchLinkProps {
  href: string;
  children: React.ReactNode;
  ariaLabel?: string;
  className?: string;
  target?: '_blank' | '_self';
  rel?: string;
}

/**
 * Link component that ensures minimum 44x44px touch target size
 * Includes adequate padding for mobile touch
 */
export function TouchLink({
  href,
  children,
  ariaLabel,
  className = '',
  target,
  rel,
}: TouchLinkProps) {
  return (
    <a
      href={href}
      aria-label={ariaLabel}
      target={target}
      rel={rel}
      className={`
        touch-target-text
        rounded
        transition-colors
        focus:ring-2
        focus:ring-offset-2
        focus:ring-blue-500
        hover:underline
        ${className}
      `}
    >
      {children}
    </a>
  );
}
```

### Step 5: Update Icon Button Component for Touch

Update `/vfa-gallery/src/components/UI/IconButton.tsx` to ensure touch target compliance:

```tsx
import React from 'react';

interface IconButtonProps {
  icon: React.ReactNode;
  ariaLabel: string;
  onClick?: () => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Icon button that maintains 44x44px touch target minimum
 * Hit area includes padding beyond visible icon
 */
export function IconButton({
  icon,
  ariaLabel,
  onClick,
  className = '',
  size = 'md',
}: IconButtonProps) {
  const sizeClasses = {
    sm: 'h-10 w-10',      // 40x40px - near minimum
    md: 'h-11 w-11',      // 44x44px - WCAG AAA
    lg: 'h-14 w-14',      // 56x56px - extra comfortable
  }[size];

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      className={`
        ${sizeClasses}
        rounded
        flex
        items-center
        justify-center
        transition-colors
        hover:bg-gray-200
        focus:ring-2
        focus:ring-offset-2
        focus:ring-blue-500
        ${className}
      `}
    >
      {icon}
      <span className="sr-only">{ariaLabel}</span>
    </button>
  );
}
```

### Step 6: Implement Touch Spacing in Grids

Create `/vfa-gallery/src/components/Gallery/GalleryGrid.tsx` with proper touch spacing:

```tsx
import React from 'react';
import { ArtworkCard } from './ArtworkCard';

interface Gallery {
  id: string;
  title: string;
  thumbnail: string;
}

interface GalleryGridProps {
  galleries: Gallery[];
}

/**
 * Gallery grid with touch-friendly spacing (minimum 8px between items)
 * Ensures no accidental taps on adjacent items
 */
export function GalleryGrid({ galleries }: GalleryGridProps) {
  return (
    <div className="w-full">
      <div
        className={`
          grid
          grid-cols-1
          sm:grid-cols-2
          lg:grid-cols-3
          2xl:grid-cols-4
          gap-6
          touch-spacing
        `}
      >
        {galleries.map(gallery => (
          <ArtworkCard key={gallery.id} {...gallery} />
        ))}
      </div>
    </div>
  );
}
```

### Step 7: Update Form Controls for Touch

Create `/vfa-gallery/src/components/Forms/TouchInput.tsx`:

```tsx
import React from 'react';

interface TouchInputProps {
  id: string;
  label: string;
  type?: string;
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

/**
 * Input component with touch-friendly sizing
 * Maintains 44px minimum height for comfortable touch
 */
export function TouchInput({
  id,
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  required,
  disabled,
  className = '',
}: TouchInputProps) {
  return (
    <div className="mb-4">
      <label htmlFor={id} className="block font-semibold text-gray-700 mb-2">
        {label}
        {required && <span className="text-red-600 ml-1">*</span>}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={e => onChange?.(e.target.value)}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        className={`
          w-full
          px-4
          py-3
          h-12
          border
          border-gray-300
          rounded
          text-base
          focus:ring-2
          focus:ring-blue-500
          focus:border-transparent
          disabled:bg-gray-100
          disabled:cursor-not-allowed
          transition-all
          ${className}
        `}
      />
    </div>
  );
}
```

### Step 8: Create Touch-Friendly Dropdown/Select

Create `/vfa-gallery/src/components/Forms/TouchSelect.tsx`:

```tsx
import React, { useState } from 'react';

interface Option {
  value: string;
  label: string;
}

interface TouchSelectProps {
  id: string;
  label: string;
  options: Option[];
  value?: string;
  onChange?: (value: string) => void;
  required?: boolean;
}

/**
 * Select component with touch-friendly touch target sizing
 * Minimum 44px height for comfortable selection
 */
export function TouchSelect({
  id,
  label,
  options,
  value,
  onChange,
  required,
}: TouchSelectProps) {
  return (
    <div className="mb-4">
      <label htmlFor={id} className="block font-semibold text-gray-700 mb-2">
        {label}
        {required && <span className="text-red-600 ml-1">*</span>}
      </label>
      <select
        id={id}
        value={value}
        onChange={e => onChange?.(e.target.value)}
        required={required}
        className={`
          w-full
          px-4
          py-3
          h-12
          border
          border-gray-300
          rounded
          text-base
          focus:ring-2
          focus:ring-blue-500
          focus:border-transparent
          transition-all
        `}
      >
        <option value="">Select an option</option>
        {options.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
```

### Step 9: Create Touch-Friendly List Items

Update `/vfa-gallery/src/components/UI/ListItem.tsx`:

```tsx
import React from 'react';

interface ListItemProps {
  children: React.ReactNode;
  onClick?: () => void;
  href?: string;
  className?: string;
  isSelected?: boolean;
}

/**
 * List item with touch-friendly touch target sizing
 * Maintains minimum 44px height with adequate padding
 */
export function ListItem({
  children,
  onClick,
  href,
  className = '',
  isSelected,
}: ListItemProps) {
  const Component = href ? 'a' : 'button';

  const baseClasses = `
    w-full
    px-4
    py-3
    min-h-12
    rounded
    text-left
    transition-colors
    focus:ring-2
    focus:ring-offset-2
    focus:ring-blue-500
    ${isSelected ? 'bg-blue-100 text-blue-900 font-semibold' : 'hover:bg-gray-100'}
    ${className}
  `;

  if (href) {
    return (
      <a href={href} className={baseClasses}>
        {children}
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={baseClasses}
    >
      {children}
    </button>
  );
}
```

### Step 10: Audit Existing Interactive Elements

Create an audit script at `/vfa-gallery/scripts/audit-touch-targets.ts`:

```typescript
import fs from 'fs';
import path from 'path';

interface TouchTarget {
  file: string;
  line: number;
  element: string;
  status: 'pass' | 'warn' | 'fail';
  message: string;
}

const results: TouchTarget[] = [];

// Scan src directory for interactive elements
const srcDir = path.join(process.cwd(), 'src');

function scanFile(filePath: string) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  lines.forEach((line, idx) => {
    // Check for small buttons or links without touch utilities
    if (line.includes('<button') || line.includes('<a')) {
      if (!line.includes('touch-target') && !line.includes('h-12') && !line.includes('p-3')) {
        results.push({
          file: filePath.replace(srcDir, 'src'),
          line: idx + 1,
          element: line.trim().slice(0, 50),
          status: 'warn',
          message: 'Interactive element may not meet 44x44px minimum',
        });
      }
    }

    // Check for inputs without adequate height
    if (line.includes('<input') || line.includes('<select')) {
      if (!line.includes('h-12') && !line.includes('py-3')) {
        results.push({
          file: filePath.replace(srcDir, 'src'),
          line: idx + 1,
          element: line.trim().slice(0, 50),
          status: 'warn',
          message: 'Form input may not have adequate touch height',
        });
      }
    }
  });
}

function walkDir(dir: string) {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      walkDir(filePath);
    } else if (filePath.endsWith('.tsx') || filePath.endsWith('.jsx')) {
      scanFile(filePath);
    }
  });
}

walkDir(srcDir);

console.log('\n📱 Touch Target Audit Report\n');
console.log(`Found ${results.length} potential issues:\n`);

results.forEach(result => {
  console.log(`${result.status.toUpperCase()} | ${result.file}:${result.line}`);
  console.log(`      ${result.element}...`);
  console.log(`      ${result.message}\n`);
});

process.exit(results.length > 0 ? 1 : 0);
```

Update `/vfa-gallery/package.json`:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "audit:touch": "ts-node scripts/audit-touch-targets.ts"
  }
}
```

### Step 11: Test on Real Mobile Devices

Test on actual mobile devices to verify touch targets:

**iOS Testing:**
1. Open app in Safari
2. Test each button, link, and form input
3. Verify no mis-taps occur
4. Ensure fingers don't overlap adjacent targets

**Android Testing:**
1. Open app in Chrome
2. Use Chrome DevTools device emulation
3. Enable "Show touch" in DevTools
4. Tap each interactive element and verify touch point is detected within the target

**Desktop Testing (DevTools):**
```bash
npm run dev
# Open browser DevTools (F12)
# Toggle device toolbar (Cmd+Shift+M)
# Test in phone/tablet sizes
```

### Step 12: Implement Touch-Friendly Navigation

Update `/vfa-gallery/src/components/Nav/MainNav.tsx`:

```tsx
import React from 'react';
import { TouchLink } from '../UI/TouchLink';

export function MainNav() {
  return (
    <nav
      className="flex touch-spacing-x gap-2 sm:gap-0"
      aria-label="Main navigation"
    >
      <TouchLink href="/galleries" className="text-blue-600 hover:text-blue-800">
        Galleries
      </TouchLink>
      <TouchLink href="/search" className="text-blue-600 hover:text-blue-800">
        Search
      </TouchLink>
      <TouchLink href="/profile" className="text-blue-600 hover:text-blue-800">
        Profile
      </TouchLink>
    </nav>
  );
}
```

### Step 13: Document Touch Target Requirements

Create `/vfa-gallery/docs/TOUCH-TARGETS.md`:

```markdown
# Touch Target Accessibility Guidelines

## Minimum Sizes (WCAG AAA)
- **Interactive elements:** Minimum 44x44 CSS pixels
- **Spacing between targets:** Minimum 8px

## Implementation

### Using TouchButton Component
```tsx
import { TouchButton } from '@/components/UI/TouchButton';

<TouchButton onClick={handleClick}>
  Save Gallery
</TouchButton>
```

### Using TouchLink Component
```tsx
import { TouchLink } from '@/components/UI/TouchLink';

<TouchLink href="/gallery/123">
  View Gallery
</TouchLink>
```

### Using Tailwind Utilities
```tsx
// Direct approach
<button className="touch-target px-4 py-3 rounded">
  Click me
</button>
```

## Testing Checklist
- [ ] All buttons are at least 44x44px
- [ ] All links have at least 44px height/width
- [ ] Form inputs have at least 44px height
- [ ] Spacing between targets is at least 8px
- [ ] No accidental taps on adjacent elements
- [ ] Focus states are clearly visible
- [ ] Touch works smoothly on real devices

## Common Mistakes to Avoid
- ❌ Using very small icon buttons (< 32px)
- ❌ Placing buttons too close together
- ❌ Small form inputs without adequate padding
- ❌ Forgetting to add padding around elements
- ❌ Relying on hover states (not available on touch)

## Mobile Testing Tools
- Chrome DevTools device emulation (press F12, then Cmd+Shift+M)
- Physical device testing (iOS Safari, Android Chrome)
- Lighthouse accessibility audit (built into DevTools)
```

---

## Files to Create/Modify

**Created:**
- `/vfa-gallery/src/components/UI/TouchButton.tsx` - Touch-target-safe button component
- `/vfa-gallery/src/components/UI/TouchLink.tsx` - Touch-target-safe link component
- `/vfa-gallery/src/components/Forms/TouchInput.tsx` - Touch-target-safe input component
- `/vfa-gallery/src/components/Forms/TouchSelect.tsx` - Touch-target-safe select component
- `/vfa-gallery/src/components/UI/ListItem.tsx` - Touch-target-safe list item
- `/vfa-gallery/scripts/audit-touch-targets.ts` - Automated touch target audit script
- `/vfa-gallery/docs/TOUCH-TARGETS.md` - Touch target implementation guide

**Modified:**
- `/vfa-gallery/tailwind.config.js` - Add touch-target and touch-spacing utilities
- `/vfa-gallery/src/components/UI/IconButton.tsx` - Update to use md size default (44x44px)
- `/vfa-gallery/src/components/Gallery/GalleryGrid.tsx` - Add gap-6 and touch-spacing
- `/vfa-gallery/src/components/Nav/MainNav.tsx` - Use TouchLink components
- `/vfa-gallery/package.json` - Add audit:touch script

---

## Verification Checklist

- [ ] All buttons have minimum 44x44px dimension
- [ ] All links have minimum 44px height or width
- [ ] Form inputs have minimum 44px height
- [ ] Spacing between interactive elements is minimum 8px
- [ ] IconButton uses size="md" by default (44x44px)
- [ ] Touch-target utilities defined in Tailwind config
- [ ] `npm run audit:touch` completes with no high-severity warnings
- [ ] Tested on real mobile device (iOS and Android)
- [ ] No console errors during touch interactions
- [ ] Tap-to-click works smoothly without mis-taps
- [ ] Focus states are visible after touch activation
- [ ] Form submission works via touch without mis-taps

Once all items checked, all accessibility requirements are complete!
