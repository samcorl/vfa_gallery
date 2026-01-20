# Build 34: Profile Edit Form

## Goal
Create the profile edit page at `/profile/edit` that allows users to update their profile information including avatar upload, display name, bio, website, and phone number. Integrates with PATCH /api/users/me and POST /api/users/me/avatar endpoints.

---

## Spec Extract

**Form Fields:**
- Avatar upload with camera icon overlay (click to upload image)
- Display name text input
- Bio textarea (multi-line)
- Website URL input (validates URL format)
- Phone number input (optional)
- Save button with loading state
- Cancel button returns to profile view
- Form validation with error messages
- Toast notification on success/error

**Avatar Upload:**
- Camera icon overlay appears on avatar hover
- Click overlay to open file picker
- Support: JPG, PNG, WebP, GIF (max 5MB)
- Show upload progress (optional)
- Update avatar immediately or with save

**Form Validation:**
- Display name: Optional, max 100 characters
- Bio: Optional, max 500 characters
- Website: Must be valid URL if provided
- Phone: Optional, basic format validation
- Real-time validation feedback

**Behavior:**
- Pre-populate form with current user values
- Disable save button while loading
- Show spinner on save button during request
- Toast on success: "Profile updated successfully"
- Toast on error: Show error message
- Redirect to `/profile` on success
- Can cancel and return to `/profile` without saving

---

## Prerequisites

**Must complete before starting:**
- **33-UI-PROFILE-VIEW.md** - Profile view page exists
- **31-API-USER-UPDATE.md** - PATCH /api/users/me endpoint
- **32-API-USER-AVATAR.md** - POST /api/users/me/avatar endpoint
- **28-REACT-TOAST-SYSTEM.md** - Toast context available

**Reason:** This page edits user profile and requires all the API endpoints and UI utilities.

---

## Steps

### Step 1: Create Profile Form Component

This component handles the form fields and validation.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/profile/ProfileForm.tsx`

```typescript
import { useState, ChangeEvent, FormEvent } from 'react';
import type { UserProfileResponse } from '../../types/user';

interface ProfileFormProps {
  user: UserProfileResponse;
  onSubmit: (data: ProfileFormData) => Promise<void>;
  isLoading: boolean;
}

export interface ProfileFormData {
  displayName: string | null;
  bio: string | null;
  website: string | null;
  phone: string | null;
}

interface FormErrors {
  displayName?: string;
  bio?: string;
  website?: string;
  phone?: string;
}

/**
 * Validate website URL format
 */
function validateWebsite(url: string | null): string | undefined {
  if (!url) {
    return undefined; // Optional field
  }

  try {
    new URL(url);
    return undefined; // Valid URL
  } catch {
    return 'Please enter a valid URL (e.g., https://example.com)';
  }
}

/**
 * Validate phone number (simple format check)
 */
function validatePhone(phone: string | null): string | undefined {
  if (!phone) {
    return undefined; // Optional field
  }

  // Allow various formats: +1234567890, (123) 456-7890, 123-456-7890, etc.
  const phoneRegex = /^[\d\s\-\+\(\)]+$/;
  if (!phoneRegex.test(phone)) {
    return 'Please enter a valid phone number';
  }

  if (phone.replace(/\D/g, '').length < 10) {
    return 'Phone number must have at least 10 digits';
  }

  return undefined;
}

export default function ProfileForm({
  user,
  onSubmit,
  isLoading,
}: ProfileFormProps) {
  const [formData, setFormData] = useState<ProfileFormData>({
    displayName: user.displayName || '',
    bio: user.bio || '',
    website: user.website || '',
    phone: user.phone || '',
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  /**
   * Handle field changes
   */
  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value || null,
    }));

    // Clear error when user starts typing
    if (touched[name]) {
      validateField(name, value);
    }
  };

  /**
   * Handle field blur (mark as touched and validate)
   */
  const handleBlur = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setTouched((prev) => ({
      ...prev,
      [name]: true,
    }));
    validateField(name, value);
  };

  /**
   * Validate individual field
   */
  const validateField = (name: string, value: string) => {
    const newErrors = { ...errors };

    switch (name) {
      case 'displayName':
        if (value.length > 100) {
          newErrors.displayName = 'Display name must be 100 characters or less';
        } else {
          delete newErrors.displayName;
        }
        break;

      case 'bio':
        if (value.length > 500) {
          newErrors.bio = 'Bio must be 500 characters or less';
        } else {
          delete newErrors.bio;
        }
        break;

      case 'website':
        const websiteError = validateWebsite(value || null);
        if (websiteError) {
          newErrors.website = websiteError;
        } else {
          delete newErrors.website;
        }
        break;

      case 'phone':
        const phoneError = validatePhone(value || null);
        if (phoneError) {
          newErrors.phone = phoneError;
        } else {
          delete newErrors.phone;
        }
        break;
    }

    setErrors(newErrors);
  };

  /**
   * Validate all fields before submit
   */
  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (formData.displayName && formData.displayName.length > 100) {
      newErrors.displayName = 'Display name must be 100 characters or less';
    }

    if (formData.bio && formData.bio.length > 500) {
      newErrors.bio = 'Bio must be 500 characters or less';
    }

    const websiteError = validateWebsite(formData.website);
    if (websiteError) {
      newErrors.website = websiteError;
    }

    const phoneError = validatePhone(formData.phone);
    if (phoneError) {
      newErrors.phone = phoneError;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /**
   * Handle form submission
   */
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    await onSubmit(formData);
  };

  const charCount = {
    displayName: formData.displayName?.length || 0,
    bio: formData.bio?.length || 0,
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Display Name */}
      <div>
        <label htmlFor="displayName" className="block text-sm font-medium text-gray-700 mb-2">
          Display Name
        </label>
        <input
          type="text"
          id="displayName"
          name="displayName"
          value={formData.displayName || ''}
          onChange={handleChange}
          onBlur={handleBlur}
          maxLength={100}
          placeholder="Your display name"
          disabled={isLoading}
          className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
            touched['displayName'] && errors.displayName
              ? 'border-red-500 focus:ring-red-500'
              : 'border-gray-300 focus:ring-blue-500'
          } ${isLoading ? 'bg-gray-50 cursor-not-allowed' : ''}`}
        />
        <div className="flex justify-between mt-1">
          {touched['displayName'] && errors.displayName && (
            <p className="text-sm text-red-600">{errors.displayName}</p>
          )}
          <p className={`text-xs ml-auto ${
            charCount.displayName > 90 ? 'text-orange-600' : 'text-gray-500'
          }`}>
            {charCount.displayName}/100
          </p>
        </div>
      </div>

      {/* Bio */}
      <div>
        <label htmlFor="bio" className="block text-sm font-medium text-gray-700 mb-2">
          Bio
        </label>
        <textarea
          id="bio"
          name="bio"
          value={formData.bio || ''}
          onChange={handleChange}
          onBlur={handleBlur}
          maxLength={500}
          rows={4}
          placeholder="Tell us about yourself"
          disabled={isLoading}
          className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 transition-colors resize-vertical ${
            touched['bio'] && errors.bio
              ? 'border-red-500 focus:ring-red-500'
              : 'border-gray-300 focus:ring-blue-500'
          } ${isLoading ? 'bg-gray-50 cursor-not-allowed' : ''}`}
        />
        <div className="flex justify-between mt-1">
          {touched['bio'] && errors.bio && (
            <p className="text-sm text-red-600">{errors.bio}</p>
          )}
          <p className={`text-xs ml-auto ${
            charCount.bio > 450 ? 'text-orange-600' : 'text-gray-500'
          }`}>
            {charCount.bio}/500
          </p>
        </div>
      </div>

      {/* Website */}
      <div>
        <label htmlFor="website" className="block text-sm font-medium text-gray-700 mb-2">
          Website
        </label>
        <input
          type="url"
          id="website"
          name="website"
          value={formData.website || ''}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder="https://example.com"
          disabled={isLoading}
          className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
            touched['website'] && errors.website
              ? 'border-red-500 focus:ring-red-500'
              : 'border-gray-300 focus:ring-blue-500'
          } ${isLoading ? 'bg-gray-50 cursor-not-allowed' : ''}`}
        />
        {touched['website'] && errors.website && (
          <p className="text-sm text-red-600 mt-1">{errors.website}</p>
        )}
      </div>

      {/* Phone */}
      <div>
        <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
          Phone (Optional)
        </label>
        <input
          type="tel"
          id="phone"
          name="phone"
          value={formData.phone || ''}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder="(123) 456-7890"
          disabled={isLoading}
          className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
            touched['phone'] && errors.phone
              ? 'border-red-500 focus:ring-red-500'
              : 'border-gray-300 focus:ring-blue-500'
          } ${isLoading ? 'bg-gray-50 cursor-not-allowed' : ''}`}
        />
        {touched['phone'] && errors.phone && (
          <p className="text-sm text-red-600 mt-1">{errors.phone}</p>
        )}
      </div>

      {/* Form Actions */}
      <div className="flex gap-4 pt-6">
        <button
          type="submit"
          disabled={isLoading || Object.keys(errors).length > 0}
          className={`flex-1 px-6 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
            isLoading || Object.keys(errors).length > 0
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {isLoading && (
            <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
          )}
          <span>{isLoading ? 'Saving...' : 'Save Changes'}</span>
        </button>
      </div>
    </form>
  );
}
```

### Step 2: Create Avatar Upload Component

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/profile/AvatarUpload.tsx`

```typescript
import { useRef, ChangeEvent } from 'react';
import ProfileAvatar from './ProfileAvatar';
import type { UserProfileResponse } from '../../types/user';

interface AvatarUploadProps {
  user: UserProfileResponse;
  onUpload: (file: File) => Promise<void>;
  isLoading: boolean;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export default function AvatarUpload({
  user,
  onUpload,
  isLoading,
}: AvatarUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }

    // Validate file
    if (!ALLOWED_TYPES.includes(file.type)) {
      alert('Please select a JPG, PNG, WebP, or GIF image');
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      alert('Image must be smaller than 5MB');
      return;
    }

    await onUpload(file);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Avatar with camera overlay */}
      <div className="relative">
        <ProfileAvatar
          avatarUrl={user.avatarUrl}
          displayName={user.displayName}
          username={user.username}
          size="lg"
        />

        {/* Camera icon overlay */}
        <button
          type="button"
          onClick={handleClick}
          disabled={isLoading}
          className={`absolute bottom-0 right-0 bg-blue-600 text-white rounded-full p-3 hover:bg-blue-700 transition-colors shadow-lg ${
            isLoading ? 'opacity-50 cursor-not-allowed' : ''
          }`}
          title="Change avatar"
        >
          <span className="text-xl">📷</span>
        </button>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ALLOWED_TYPES.join(',')}
        onChange={handleFileSelect}
        className="hidden"
        disabled={isLoading}
      />

      {/* Helper text */}
      <p className="text-sm text-gray-600 text-center">
        Click the camera icon to change your avatar
        <br />
        <span className="text-xs text-gray-500">JPG, PNG, WebP or GIF (max 5MB)</span>
      </p>
    </div>
  );
}
```

### Step 3: Create Profile Edit Page

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/pages/ProfileEdit.tsx`

```typescript
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import AvatarUpload from '../components/profile/AvatarUpload';
import ProfileForm, { ProfileFormData } from '../components/profile/ProfileForm';
import type { UserProfileResponse } from '../types/user';

export default function ProfileEdit() {
  const navigate = useNavigate();
  const { user: authUser, isLoading: authLoading } = useAuth();
  const { showToast } = useToast();

  const [user, setUser] = useState<UserProfileResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch current user profile
  useEffect(() => {
    const fetchProfile = async () => {
      if (authLoading) {
        return;
      }

      if (!authUser) {
        navigate('/');
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch('/api/auth/me', {
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error('Failed to fetch profile');
        }

        const data = await response.json();
        setUser(data);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
        showToast(message, 'error');
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [authUser, authLoading, navigate, showToast]);

  /**
   * Handle avatar upload
   */
  const handleAvatarUpload = async (file: File) => {
    try {
      setIsSaving(true);

      const formData = new FormData();
      formData.append('avatar', file);

      const response = await fetch('/api/users/me/avatar', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to upload avatar');
      }

      const updatedUser = await response.json();
      setUser(updatedUser);
      showToast('Avatar updated successfully', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to upload avatar';
      showToast(message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Handle profile form submission
   */
  const handleFormSubmit = async (formData: ProfileFormData) => {
    try {
      setIsSaving(true);

      const response = await fetch('/api/users/me', {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          displayName: formData.displayName,
          bio: formData.bio,
          website: formData.website,
          phone: formData.phone,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to update profile');
      }

      const updatedUser = await response.json();
      setUser(updatedUser);
      showToast('Profile updated successfully', 'success');

      // Redirect to profile view after a short delay
      setTimeout(() => {
        navigate('/profile');
      }, 1500);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update profile';
      showToast(message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Show loading state
  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-blue-600" />
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-600 font-semibold mb-4">
            {error || 'Profile not found'}
          </p>
          <button
            onClick={() => navigate('/profile')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to Profile
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-4 py-8 md:py-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Edit Profile</h1>
          <p className="text-gray-600">Update your profile information</p>
        </div>

        {/* Avatar Upload Section */}
        <div className="bg-gray-50 rounded-lg p-8 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Profile Picture</h2>
          <AvatarUpload
            user={user}
            onUpload={handleAvatarUpload}
            isLoading={isSaving}
          />
        </div>

        {/* Profile Form Section */}
        <div className="bg-white border border-gray-200 rounded-lg p-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Profile Information</h2>
          <ProfileForm
            user={user}
            onSubmit={handleFormSubmit}
            isLoading={isSaving}
          />

          {/* Cancel Button */}
          <div className="mt-4">
            <button
              type="button"
              onClick={() => navigate('/profile')}
              disabled={isSaving}
              className={`w-full px-6 py-3 border border-gray-300 rounded-lg font-medium transition-colors ${
                isSaving
                  ? 'bg-gray-50 text-gray-500 cursor-not-allowed'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

### Step 4: Register Profile Edit Route

Update the router to include the profile edit route:

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/router.tsx` (modify routes array)

```typescript
import ProfileEdit from './pages/ProfileEdit';

const routes: RouteObject[] = [
  {
    element: <AppShell />,
    children: [
      // ... other routes ...
      {
        path: '/profile',
        element: <Profile />,
      },
      {
        path: '/profile/edit',
        element: <ProfileEdit />,
      },
      // ... rest of routes ...
    ],
  },
];
```

### Step 5: Verify API Endpoints Exist

Confirm both API endpoints are properly set up:

```bash
# Check PATCH /api/users/me endpoint
grep -r "api/users/me" /Volumes/DataSSD/gitsrc/vfa_gallery/site/functions/ | grep -v ".git"

# Check POST /api/users/me/avatar endpoint
grep -r "api/users/me/avatar" /Volumes/DataSSD/gitsrc/vfa_gallery/site/functions/ | grep -v ".git"
```

Expected: Both endpoint files should exist.

### Step 6: Test Form Validation Locally

Start dev server and test form validation:

```bash
cd /Volumes/DataSSD/gitsrc/vfa_gallery
npm run dev
```

---

## Files to Create/Modify

**Create:**
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/profile/ProfileForm.tsx` - Form component with validation
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/profile/AvatarUpload.tsx` - Avatar upload with preview
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/pages/ProfileEdit.tsx` - Profile edit page

**Modify:**
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/router.tsx` - Add profile/edit route

---

## Verification

### Test 1: Navigate to Profile Edit

1. Start dev server: `npm run dev`
2. Log in with valid credentials
3. Navigate to `/profile`
4. Click "Edit Profile" button

Expected: Navigates to `/profile/edit` with form pre-populated with current user data.

### Test 2: Form Pre-Population

Verify form fields are filled with current values:

```bash
curl -X GET http://localhost:8787/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN" | jq '.displayName, .bio, .website, .phone'
```

All fields should match what appears in the form.

### Test 3: Display Name Validation

1. Clear display name field
2. Enter 101 characters
3. Tab out of field

Expected: Error message "Display name must be 100 characters or less" appears.

### Test 4: Bio Validation

1. Enter 501 characters in bio field
2. Tab out

Expected: Error message "Bio must be 500 characters or less" appears.

### Test 5: Website URL Validation

1. Enter "not a url" in website field
2. Tab out

Expected: Error message appears about valid URL format.

2. Enter "https://example.com"
2. Tab out

Expected: No error, field accepts valid URL.

### Test 6: Phone Validation

1. Enter "12" (only 2 digits)
2. Tab out

Expected: Error message "Phone number must have at least 10 digits".

2. Enter "(123) 456-7890"
2. Tab out

Expected: No error, valid phone accepted.

### Test 7: Avatar Upload

1. Click camera icon on avatar
2. Select an image file
3. Wait for upload to complete

Expected:
- File picker opens
- Avatar updates after upload
- Success toast appears: "Avatar updated successfully"

### Test 8: Avatar Validation

1. Try to upload file > 5MB

Expected: Alert message "Image must be smaller than 5MB"

2. Try to upload non-image file (e.g., .txt)

Expected: Alert message "Please select a JPG, PNG, WebP, or GIF image"

### Test 9: Form Submission

1. Modify one or more fields
2. Click "Save Changes"

Expected:
- Button shows "Saving..." with spinner
- API call to PATCH /api/users/me with form data
- Success toast appears
- Redirects to `/profile` after ~1.5 seconds

### Test 10: Form Submission Error

1. Modify a field with invalid data (e.g., website)
2. Try to click "Save Changes"

Expected:
- Save button is disabled (grayed out)
- Cannot submit form with errors

### Test 11: Cancel Button

1. Make changes to form
2. Click "Cancel" button

Expected:
- Returns to `/profile` without saving
- Changes are discarded

### Test 12: Loading States

1. Start avatar upload
2. Observe form and buttons

Expected:
- Form inputs are disabled
- Buttons are disabled
- Cannot interact while saving

### Test 13: Responsive Layout

**Mobile (<640px):**
- Avatar section displays centered
- Form fields take full width
- Buttons are readable and touchable

**Desktop (≥640px):**
- Layout looks good in wider viewport
- Form is easy to scan

### Test 14: Character Count Display

1. Type in display name field
2. Observe character count

Expected:
- Shows "N/100" next to field
- Changes color to orange when > 90 characters

3. Type in bio field
4. Observe character count

Expected:
- Shows "N/500" next to field
- Changes color to orange when > 450 characters

---

## Success Criteria

- [ ] Profile edit page accessible at `/profile/edit`
- [ ] Form fields pre-populated with current user data
- [ ] Display name validation works (max 100 chars)
- [ ] Bio validation works (max 500 chars)
- [ ] Website validation checks for valid URL
- [ ] Phone validation checks format and digit count
- [ ] Character counts display and update in real-time
- [ ] Avatar upload works with file picker
- [ ] Avatar upload validates file type (JPG, PNG, WebP, GIF)
- [ ] Avatar upload validates file size (max 5MB)
- [ ] Save button disabled when form has errors
- [ ] Save button shows loading spinner during submission
- [ ] PATCH /api/users/me called with correct data
- [ ] POST /api/users/me/avatar called for avatar uploads
- [ ] Success toast shown on update
- [ ] Error toast shown on failure
- [ ] Redirects to `/profile` on success
- [ ] Cancel button returns to `/profile` without saving
- [ ] All form inputs disabled during submission
- [ ] All TypeScript types correct, no errors

---

## Next Steps

Once verified, proceed to:
- **Build 35:** Social links configuration (SocialsEditor component)
- Add social links section to ProfileEdit page
- Implement optional gallery preview on profile
