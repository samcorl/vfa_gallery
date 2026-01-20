# Build 59: Gallery Create UI

## Goal
Create a gallery creation form that allows authenticated users to start a new gallery with basic metadata (name, description, welcome message).

## Spec Extract

From **04-UI-UX-SPEC.md** and **03-API-ENDPOINTS.md**:
- Modal or dedicated page for gallery creation
- Required fields: Gallery name (3-100 characters)
- Optional fields: Description, welcome message
- Theme picker (optional, can be set later in manager)
- Create button with loading state
- Cancel returns to galleries list
- Success navigates to Gallery Manager page
- API endpoint: `POST /api/galleries`

---

## Prerequisites

**Must complete before starting:**
- **52-UI-GALLERIES-LIST.md** - Gallery list page created
- **58-REACT-FORM-PATTERNS.md** - Form utilities and validation helpers established

---

## Steps

### Step 1: Create Reusable Gallery Form Component

This component will be used for both create and edit flows.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/gallery/GalleryForm.tsx`

```typescript
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export interface GalleryFormData {
  name: string;
  description?: string;
  welcome_message?: string;
  theme_id?: string;
}

export interface GalleryFormProps {
  initialData?: GalleryFormData;
  isLoading?: boolean;
  onSubmit: (data: GalleryFormData) => Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
}

export default function GalleryForm({
  initialData,
  isLoading = false,
  onSubmit,
  onCancel,
  submitLabel = 'Create Gallery'
}: GalleryFormProps) {
  const [formData, setFormData] = useState<GalleryFormData>(
    initialData || {
      name: '',
      description: '',
      welcome_message: '',
      theme_id: ''
    }
  );

  const [errors, setErrors] = useState<Partial<Record<keyof GalleryFormData, string>>>({});
  const [isTouched, setIsTouched] = useState<Partial<Record<keyof GalleryFormData, boolean>>>({});

  // Validate gallery name
  const validateName = (value: string): string | undefined => {
    if (!value.trim()) {
      return 'Gallery name is required';
    }
    if (value.length < 3) {
      return 'Gallery name must be at least 3 characters';
    }
    if (value.length > 100) {
      return 'Gallery name must be 100 characters or less';
    }
    return undefined;
  };

  // Validate description
  const validateDescription = (value?: string): string | undefined => {
    if (value && value.length > 500) {
      return 'Description must be 500 characters or less';
    }
    return undefined;
  };

  // Validate welcome message
  const validateWelcomeMessage = (value?: string): string | undefined => {
    if (value && value.length > 1000) {
      return 'Welcome message must be 1000 characters or less';
    }
    return undefined;
  };

  // Handle field changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const fieldName = name as keyof GalleryFormData;

    setFormData(prev => ({
      ...prev,
      [fieldName]: value
    }));

    // Validate on change if field has been touched
    if (isTouched[fieldName]) {
      validateField(fieldName, value);
    }
  };

  // Handle field blur (mark as touched)
  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const fieldName = name as keyof GalleryFormData;

    setIsTouched(prev => ({
      ...prev,
      [fieldName]: true
    }));

    validateField(fieldName, value);
  };

  // Validate individual field
  const validateField = (fieldName: keyof GalleryFormData, value: any) => {
    let error: string | undefined;

    if (fieldName === 'name') {
      error = validateName(value);
    } else if (fieldName === 'description') {
      error = validateDescription(value);
    } else if (fieldName === 'welcome_message') {
      error = validateWelcomeMessage(value);
    }

    setErrors(prev => ({
      ...prev,
      [fieldName]: error
    }));
  };

  // Validate entire form
  const isFormValid = (): boolean => {
    const nameError = validateName(formData.name);
    const descError = validateDescription(formData.description);
    const welcomeError = validateWelcomeMessage(formData.welcome_message);

    const newErrors = {
      name: nameError,
      description: descError,
      welcome_message: welcomeError
    };

    setErrors(newErrors);
    return !nameError && !descError && !welcomeError;
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isFormValid()) {
      return;
    }

    try {
      await onSubmit(formData);
    } catch (error) {
      // Error handled by parent component
      console.error('Form submission error:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Gallery Name */}
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-900 mb-2">
          Gallery Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="name"
          name="name"
          value={formData.name}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder="e.g., Manga Collection 2024"
          disabled={isLoading}
          className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed ${
            errors.name ? 'border-red-500' : 'border-gray-300'
          }`}
        />
        {errors.name && (
          <p className="mt-1 text-sm text-red-500">{errors.name}</p>
        )}
        <p className="mt-1 text-xs text-gray-500">
          {formData.name.length}/100 characters
        </p>
      </div>

      {/* Description */}
      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-900 mb-2">
          Description (Optional)
        </label>
        <textarea
          id="description"
          name="description"
          value={formData.description || ''}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder="Tell visitors about this gallery..."
          disabled={isLoading}
          rows={4}
          className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed resize-none ${
            errors.description ? 'border-red-500' : 'border-gray-300'
          }`}
        />
        {errors.description && (
          <p className="mt-1 text-sm text-red-500">{errors.description}</p>
        )}
        <p className="mt-1 text-xs text-gray-500">
          {(formData.description || '').length}/500 characters
        </p>
      </div>

      {/* Welcome Message */}
      <div>
        <label htmlFor="welcome_message" className="block text-sm font-medium text-gray-900 mb-2">
          Welcome Message (Optional)
        </label>
        <textarea
          id="welcome_message"
          name="welcome_message"
          value={formData.welcome_message || ''}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder="A personal welcome for visitors when they enter your gallery..."
          disabled={isLoading}
          rows={4}
          className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed resize-none ${
            errors.welcome_message ? 'border-red-500' : 'border-gray-300'
          }`}
        />
        {errors.welcome_message && (
          <p className="mt-1 text-sm text-red-500">{errors.welcome_message}</p>
        )}
        <p className="mt-1 text-xs text-gray-500">
          {(formData.welcome_message || '').length}/1000 characters
        </p>
      </div>

      {/* Theme Selector (Optional, disabled for now) */}
      <div>
        <label htmlFor="theme_id" className="block text-sm font-medium text-gray-900 mb-2">
          Theme (Optional - Can set later)
        </label>
        <select
          id="theme_id"
          name="theme_id"
          value={formData.theme_id || ''}
          onChange={handleChange}
          disabled={isLoading}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
        >
          <option value="">Default Theme</option>
          <option value="minimal">Minimal</option>
          <option value="dark">Dark</option>
          <option value="colorful">Colorful</option>
        </select>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 justify-end">
        <button
          type="button"
          onClick={onCancel}
          disabled={isLoading}
          className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isLoading && (
            <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          )}
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
```

### Step 2: Create Gallery Create Page

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/pages/GalleryCreate.tsx`

```typescript
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import GalleryForm, { GalleryFormData } from '../components/gallery/GalleryForm';
import { useToast } from '../contexts/ToastContext';

export default function GalleryCreate() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (formData: GalleryFormData) => {
    setIsLoading(true);

    try {
      const response = await fetch('/api/galleries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create gallery');
      }

      const data = await response.json();

      showToast({
        type: 'success',
        message: `Gallery "${formData.name}" created successfully!`,
      });

      // Navigate to gallery manager for this new gallery
      navigate(`/profile/galleries/${data.id}`);
    } catch (error) {
      showToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to create gallery',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    navigate('/profile/galleries');
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b border-gray-200 px-4 py-6 md:px-6">
        <div className="max-w-2xl mx-auto">
          <button
            onClick={handleCancel}
            className="text-blue-600 hover:text-blue-700 font-medium mb-4 flex items-center gap-1"
          >
            ← Back to Galleries
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Create New Gallery</h1>
          <p className="text-gray-600 mt-2">
            Start a new gallery to organize and showcase your collections
          </p>
        </div>
      </div>

      {/* Form Container */}
      <div className="px-4 py-8 md:px-6">
        <div className="max-w-2xl mx-auto">
          <GalleryForm
            isLoading={isLoading}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            submitLabel="Create Gallery"
          />
        </div>
      </div>
    </div>
  );
}
```

### Step 3: Update Routes

Add the new route to your router configuration.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/router.tsx` (or where routes are defined)

Find the galleries routes section and add:

```typescript
{
  path: '/profile/galleries/new',
  element: <GalleryCreate />,
  name: 'Create Gallery',
}
```

**Note:** Ensure this route is defined BEFORE the `/profile/galleries/:id` route so it takes precedence.

### Step 4: Import and Link from Galleries List

Update the galleries list page to include a link to create a new gallery.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/pages/GalleriesList.tsx`

Find the location where you display galleries and ensure there's a "New Gallery" button/link:

```typescript
import { Link } from 'react-router-dom';

// In your component:
<Link
  to="/profile/galleries/new"
  className="flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-8 hover:border-gray-400 hover:bg-gray-50 transition-colors"
>
  <div className="text-center">
    <div className="text-4xl mb-2">+</div>
    <p className="text-gray-700 font-medium">Create New Gallery</p>
  </div>
</Link>
```

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/gallery/GalleryForm.tsx` | Create |
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/pages/GalleryCreate.tsx` | Create |
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/router.tsx` | Modify - add new route |
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/pages/GalleriesList.tsx` | Modify - add Create link |

---

## Verification

1. Navigate to `/profile/galleries`
2. Click "Create New Gallery" button
3. Verify form appears with all fields (name, description, welcome message, theme)
4. Try submitting with empty name - should show error
5. Try submitting with name > 100 chars - should show error
6. Enter valid gallery name and submit
7. Should show success toast
8. Should redirect to Gallery Manager page for new gallery
9. Cancel button should return to galleries list

Test on both mobile (<640px) and desktop (>1024px) to ensure responsive layout works correctly.
