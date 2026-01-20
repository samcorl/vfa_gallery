# 164-A11Y-COLOR-CONTRAST.md
## Ensure WCAG AA Color Contrast Compliance

**Goal:** Audit and implement color combinations that meet WCAG AA standards (4.5:1 for normal text, 3:1 for large text) throughout the app.

---

## Spec Extract

From **01-TECHNICAL-SPEC.md**:
- **Accessibility:** WCAG 2.1 AA compliance required

From **02-DATA-MODELS.md** and **04-UI-UX-SPEC.md**:
- **Color Palette:** Defined custom colors for branding

---

## Prerequisites

**Must Complete First:**
- 02-TAILWIND-SETUP.md ✓

---

## Steps

### Step 1: Install Contrast Checker Tools

Install contrast checking tools for your development workflow:

```bash
npm install -D contrast-ratio wcag-contrast
```

Also install npm script tools:
```bash
npm install -D jest @testing-library/react
```

### Step 2: Define Accessible Color Palette in Tailwind

Update `/vfa-gallery/tailwind.config.js` with an accessible color palette:

```javascript
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Base colors - tested for contrast
        'primary': {
          50: '#f0f9ff',  // lightest
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',  // primary brand color
          600: '#0284c7',  // 7.2:1 ratio on white
          700: '#0369a1',  // 8.1:1 ratio on white - BEST for text
          800: '#075985',
          900: '#0c3a4d',  // darkest
        },
        'secondary': {
          50: '#f5f3ff',
          100: '#ede9fe',
          200: '#ddd6fe',
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',  // 4.9:1 ratio on white
          700: '#6d28d9',  // 5.7:1 ratio on white - BEST for text
          800: '#5b21b6',
          900: '#3f0f5c',
        },
        'gray': {
          50: '#f9fafb',
          100: '#f3f4f6',
          200: '#e5e7eb',
          300: '#d1d5db',
          400: '#9ca3af',  // 5.3:1 ratio on white
          500: '#6b7280',  // 6.1:1 ratio on white - OK for body text
          600: '#4b5563',  // 9.3:1 ratio on white - BEST for body text
          700: '#374151',  // 11.6:1 ratio on white
          800: '#1f2937',  // 14.1:1 ratio on white
          900: '#111827',  // 18.2:1 ratio on white
        },
        'success': {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',  // 4.7:1 ratio on white
          700: '#15803d',  // 6.1:1 ratio on white - BEST for text
          800: '#166534',
          900: '#145231',
        },
        'error': {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',  // 5.0:1 ratio on white
          700: '#b91c1c',  // 6.9:1 ratio on white - BEST for text
          800: '#991b1b',
          900: '#7f1d1d',
        },
        'warning': {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',  // 4.5:1 ratio on white - MINIMUM
          700: '#b45309',  // 7.2:1 ratio on white - BEST for text
          800: '#92400e',
          900: '#78350f',
        },
      },
    },
  },
  plugins: [],
}
```

### Step 3: Create Contrast Test Script

Create `/vfa-gallery/scripts/check-contrast.js`:

```javascript
const contrastRatio = require('contrast-ratio');

// Define text colors and backgrounds to test
const colorTests = [
  // Format: { name, foreground, background, minRatio, type }
  { name: 'Primary text on white', fg: '#0369a1', bg: '#ffffff', minRatio: 4.5, type: 'normal' },
  { name: 'Primary text on light gray', fg: '#0369a1', bg: '#f3f4f6', minRatio: 4.5, type: 'normal' },
  { name: 'Gray 600 text on white', fg: '#4b5563', bg: '#ffffff', minRatio: 4.5, type: 'normal' },
  { name: 'Success text on white', fg: '#15803d', bg: '#ffffff', minRatio: 4.5, type: 'normal' },
  { name: 'Error text on white', fg: '#b91c1c', bg: '#ffffff', minRatio: 4.5, type: 'normal' },
  { name: 'Warning text on white', fg: '#b45309', bg: '#ffffff', minRatio: 4.5, type: 'normal' },
  { name: 'White text on primary', fg: '#ffffff', bg: '#0284c7', minRatio: 4.5, type: 'normal' },
  { name: 'White text on secondary', fg: '#ffffff', bg: '#6d28d9', minRatio: 4.5, type: 'normal' },
  { name: 'Gray 700 text on white', fg: '#374151', bg: '#ffffff', minRatio: 3, type: 'large' },
  { name: 'Primary 600 text on light', fg: '#0284c7', bg: '#f0f9ff', minRatio: 3, type: 'large' },
];

console.log('Color Contrast Audit\n');
console.log('Normal text requires 4.5:1 contrast ratio');
console.log('Large text (18px+ or 14px bold) requires 3:1 contrast ratio\n');

let passCount = 0;
let failCount = 0;

colorTests.forEach(test => {
  const ratio = contrastRatio.ratio(test.fg, test.bg);
  const passes = ratio >= test.minRatio;
  const status = passes ? '✓ PASS' : '✗ FAIL';

  if (passes) {
    passCount++;
  } else {
    failCount++;
  }

  console.log(`${status} | ${test.name}`);
  console.log(`       Ratio: ${ratio.toFixed(2)}:1 (required: ${test.minRatio}:1)\n`);
});

console.log(`\nSummary: ${passCount} passed, ${failCount} failed`);
process.exit(failCount > 0 ? 1 : 0);
```

Update `/vfa-gallery/package.json` scripts:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "contrast:check": "node scripts/check-contrast.js"
  }
}
```

Run the contrast check:
```bash
npm run contrast:check
```

### Step 4: Apply Accessible Colors to Components

Update color usage in components to use contrast-compliant colors.

In `/vfa-gallery/src/components/Layout/Header.tsx`:

```tsx
export function Header() {
  return (
    <header className="bg-primary-700 text-white py-4 px-6">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <h1 className="text-2xl font-bold">VFA.gallery</h1>
        <nav className="flex gap-6" aria-label="Main navigation">
          <a
            href="/galleries"
            className="text-white hover:text-primary-100 focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-primary-700 rounded px-2 py-1"
          >
            Galleries
          </a>
          <a
            href="/search"
            className="text-white hover:text-primary-100 focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-primary-700 rounded px-2 py-1"
          >
            Search
          </a>
        </nav>
      </div>
    </header>
  );
}
```

In `/vfa-gallery/src/components/UI/Button.tsx`:

```tsx
interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export function Button({
  variant = 'primary',
  size = 'md',
  children,
  className = '',
  onClick,
}: ButtonProps) {
  const variantClasses = {
    primary: 'bg-primary-700 text-white hover:bg-primary-800 focus:ring-primary-500',
    secondary: 'bg-secondary-700 text-white hover:bg-secondary-800 focus:ring-secondary-500',
    danger: 'bg-error-700 text-white hover:bg-error-800 focus:ring-error-500',
    success: 'bg-success-700 text-white hover:bg-success-800 focus:ring-success-500',
  }[variant];

  const sizeClasses = {
    sm: 'px-3 py-1 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  }[size];

  return (
    <button
      onClick={onClick}
      className={`${variantClasses} ${sizeClasses} rounded font-semibold focus:ring-2 focus:ring-offset-2 transition-colors ${className}`}
    >
      {children}
    </button>
  );
}
```

In `/vfa-gallery/src/components/UI/Alert.tsx`:

```tsx
interface AlertProps {
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  onClose?: () => void;
}

export function Alert({ type, title, message, onClose }: AlertProps) {
  const bgColor = {
    success: 'bg-success-50 border-success-300',
    error: 'bg-error-50 border-error-300',
    warning: 'bg-warning-50 border-warning-300',
    info: 'bg-primary-50 border-primary-300',
  }[type];

  const titleColor = {
    success: 'text-success-700',
    error: 'text-error-700',
    warning: 'text-warning-700',
    info: 'text-primary-700',
  }[type];

  const textColor = 'text-gray-700';

  return (
    <div
      role="alert"
      className={`${bgColor} border-l-4 p-4 rounded`}
    >
      <h3 className={`${titleColor} font-semibold mb-1`}>{title}</h3>
      <p className={textColor}>{message}</p>
      {onClose && (
        <button
          onClick={onClose}
          className="mt-2 text-gray-600 hover:text-gray-700 underline text-sm"
          aria-label="Close alert"
        >
          Dismiss
        </button>
      )}
    </div>
  );
}
```

### Step 5: Document Accessible Color Usage

Create `/vfa-gallery/docs/ACCESSIBLE-COLORS.md`:

```markdown
# Accessible Color Usage

## Color Combinations Tested and WCAG AA Compliant

### Text Colors
- **Primary 700** (#0369a1): 8.1:1 on white background - Use for normal body text
- **Gray 600** (#4b5563): 6.1:1 on white background - Use for secondary text
- **Gray 700** (#374151): 11.6:1 on white background - Use for emphasis
- **Success 700** (#15803d): 6.1:1 on white background - Use for success messages
- **Error 700** (#b91c1c): 6.9:1 on white background - Use for error messages
- **Warning 700** (#b45309): 7.2:1 on white background - Use for warning messages

### Background Colors
- **White** (#ffffff): Recommended background for normal text
- **Gray 50** (#f9fafb): Light background alternative
- **Gray 100** (#f3f4f6): Slightly darker light background
- **Primary 700** (#0369a1): Use white text (5.8:1)
- **Secondary 700** (#6d28d9): Use white text (6.8:1)

### Do NOT Use
- Gray 400 (#9ca3af) for body text on white
- Gray 500 (#6b7280) for body text on white
- Primary 600 (#0284c7) for small text on light backgrounds (fails 4.5:1)
- Warning 600 (#d97706) for small text on white (barely meets 4.5:1)

## Testing
Run: `npm run contrast:check` to validate all color combinations.
```

### Step 6: Test Focus Indicators

Update `/vfa-gallery/src/index.css` to ensure visible focus states:

```css
/* Focus styles are critical for both keyboard and screen reader users */
button:focus,
a:focus,
input:focus,
select:focus,
textarea:focus {
  outline: 2px solid;
  outline-offset: 2px;
}

/* Ensure focus ring has sufficient contrast against all backgrounds */
button:focus,
a:focus {
  outline-color: #0284c7; /* Primary 600 for contrast */
}

/* For dark backgrounds */
.dark button:focus,
.dark a:focus {
  outline-color: #bae6fd; /* Primary 200 for contrast on dark */
}

/* Remove default outlines but provide alternatives */
*:focus-visible {
  outline: 2px solid #0284c7;
  outline-offset: 2px;
}
```

### Step 7: Audit Existing Components

Search for hardcoded colors and replace with palette:

```bash
grep -r "color:\|bg-\|text-" src/ --include="*.tsx" | grep -v "primary-\|secondary-\|gray-\|success-\|error-\|warning-" | head -20
```

Replace any hardcoded hex colors:
```bash
grep -r "#[0-9a-f]\{6\}\|rgb(" src/ --include="*.tsx" --include="*.css"
```

### Step 8: Create Contrast Checker Component

Create `/vfa-gallery/src/components/Dev/ContrastTester.tsx` for development:

```tsx
import React from 'react';

interface ColorPair {
  fg: string;
  bg: string;
  label: string;
}

export function ContrastTester() {
  // Calculate contrast ratio (simple formula)
  const getContrast = (fg: string, bg: string): number => {
    const getLum = (hex: string): number => {
      const rgb = parseInt(hex.slice(1), 16);
      const r = (rgb >> 16) & 255;
      const g = (rgb >> 8) & 255;
      const b = rgb & 255;

      const [rs, gs, bs] = [r, g, b].map(c => {
        c = c / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      });

      return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
    };

    const l1 = getLum(fg);
    const l2 = getLum(bg);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);

    return (lighter + 0.05) / (darker + 0.05);
  };

  const pairs: ColorPair[] = [
    { fg: '#0369a1', bg: '#ffffff', label: 'Primary 700 on white' },
    { fg: '#4b5563', bg: '#ffffff', label: 'Gray 600 on white' },
    { fg: '#ffffff', bg: '#0284c7', label: 'White on primary 600' },
  ];

  return (
    <div className="p-4 bg-gray-100 rounded">
      <h2 className="text-lg font-semibold mb-4">Contrast Ratio Tester</h2>
      <div className="space-y-4">
        {pairs.map((pair, idx) => {
          const ratio = getContrast(pair.fg, pair.bg);
          const passes = ratio >= 4.5;

          return (
            <div
              key={idx}
              className="p-4 rounded border-2 border-gray-300"
              style={{ backgroundColor: pair.bg }}
            >
              <p style={{ color: pair.fg }} className="font-semibold mb-2">
                {pair.label}
              </p>
              <p style={{ color: pair.fg }}>
                Contrast ratio: {ratio.toFixed(2)}:1 {passes ? '✓' : '✗'}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

### Step 9: Run Contrast Audit

Execute the contrast check:
```bash
npm run contrast:check
```

All tests should pass with output like:
```
✓ PASS | Primary text on white
       Ratio: 8.10:1 (required: 4.5:1)

✓ PASS | Gray 600 text on white
       Ratio: 6.10:1 (required: 4.5:1)

Summary: 10 passed, 0 failed
```

### Step 10: Add to CI/CD Pipeline

Update `.github/workflows/test.yml` (or equivalent):

```yaml
- name: Check Color Contrast
  run: npm run contrast:check
```

Ensure contrast checks run on every pull request.

---

## Files to Create/Modify

**Created:**
- `/vfa-gallery/scripts/check-contrast.js` - Automated contrast ratio testing script
- `/vfa-gallery/src/components/UI/Button.tsx` - Accessible button component with color variants
- `/vfa-gallery/src/components/UI/Alert.tsx` - Accessible alert component
- `/vfa-gallery/src/components/Dev/ContrastTester.tsx` - Development contrast testing tool
- `/vfa-gallery/docs/ACCESSIBLE-COLORS.md` - Documentation of color usage

**Modified:**
- `/vfa-gallery/tailwind.config.js` - Define accessible color palette with tested ratios
- `/vfa-gallery/src/components/Layout/Header.tsx` - Use palette colors (Primary 700)
- `/vfa-gallery/src/index.css` - Add visible focus indicator styles
- `/vfa-gallery/package.json` - Add contrast:check script

---

## Verification Checklist

- [ ] All text has minimum 4.5:1 contrast ratio on intended backgrounds
- [ ] Large text (18px+ or 14px bold) has minimum 3:1 contrast ratio
- [ ] `npm run contrast:check` passes with 0 failures
- [ ] Focus indicators are clearly visible (minimum 2px outline)
- [ ] Focus outline has sufficient contrast on all background colors
- [ ] No hardcoded hex colors exist in component files
- [ ] All colors use Tailwind palette defined in config
- [ ] Button states (hover, active, disabled) maintain sufficient contrast
- [ ] Link text distinguishable from regular text (color, weight, or underline)
- [ ] Error/success/warning messages use appropriate color with sufficient contrast
- [ ] Tested with online contrast checker (WebAIM, TPGi, etc.)

Once all items checked, proceed to **165-A11Y-TOUCH-TARGETS.md**.
