# Build 60: Gallery Edit UI

## Goal
Create a gallery edit page that allows gallery owners to modify gallery details, manage status, and delete galleries. Reuses the form component from build 59.

## Spec Extract

From **04-UI-UX-SPEC.md** and **03-API-ENDPOINTS.md**:
- Same form as create (name, description, welcome message)
- Additional: Status toggle (active/hidden/archived)
- Delete button with confirmation modal
- Delete button disabled for default gallery (is_default = true)
- Save and Cancel buttons
- API endpoints:
  - `PATCH /api/galleries/:id` - Update gallery
  - `DELETE /api/galleries/:id` - Delete gallery
  - `GET /api/galleries/:id` - Fetch gallery details

---

## Prerequisites

**Must complete before starting:**
- **55-UI-GALLERIES-DETAIL-FETCH.md** - Gallery data fetching implemented
- **59-UI-GALLERY-CREATE.md** - Gallery form component created

---

## Steps

### Step 1: Create Confirmation Modal

This reusable component will be used for delete confirmations.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/common/ConfirmDialog.tsx`

```typescript
import { useState } from 'react';

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDangerous?: boolean;
  isLoading?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isDangerous = false,
  isLoading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setError(null);
    try {
      await onConfirm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-lg max-w-sm w-full">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className={`text-lg font-bold ${isDangerous ? 'text-red-600' : 'text-gray-900'}`}>
            {title}
          </h2>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          <p className="text-gray-700">{message}</p>
          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            disabled={isLoading}
            className={`px-4 py-2 text-white rounded-lg font-medium flex items-center gap-2 disabled:opacity-50 ${
              isDangerous
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {isLoading && (
              <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
```

### Step 2: Create Gallery Edit Page

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/pages/GalleryEdit.tsx`

```typescript
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import GalleryForm, { GalleryFormData } from '../components/gallery/GalleryForm';
import ConfirmDialog from '../components/common/ConfirmDialog';
import { useToast } from '../contexts/ToastContext';

interface Gallery extends GalleryFormData {
  id: string;
  is_default: boolean;
  status: 'active' | 'hidden' | 'archived';
  created_at: string;
  updated_at: string;
}

export default function GalleryEdit() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { showToast } = useToast();

  const [gallery, setGallery] = useState<Gallery | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [status, setStatus] = useState<'active' | 'hidden' | 'archived'>('active');

  // Fetch gallery on mount
  useEffect(() => {
    fetchGallery();
  }, [id]);

  const fetchGallery = async () => {
    if (!id) return;

    setIsLoading(true);
    setFetchError(null);

    try {
      const response = await fetch(`/api/galleries/${id}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Gallery not found');
        }
        throw new Error('Failed to load gallery');
      }

      const data = await response.json();
      setGallery(data);
      setStatus(data.status || 'active');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load gallery';
      setFetchError(message);
      showToast({
        type: 'error',
        message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (formData: GalleryFormData) => {
    if (!id) return;

    setIsSaving(true);

    try {
      const response = await fetch(`/api/galleries/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          ...formData,
          status,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update gallery');
      }

      const updated = await response.json();
      setGallery(updated);

      showToast({
        type: 'success',
        message: 'Gallery updated successfully',
      });
    } catch (error) {
      showToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to update gallery',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!id || gallery?.is_default) return;

    setIsDeleting(true);

    try {
      const response = await fetch(`/api/galleries/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete gallery');
      }

      showToast({
        type: 'success',
        message: 'Gallery deleted successfully',
      });

      navigate('/profile/galleries');
    } catch (error) {
      showToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to delete gallery',
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleCancel = () => {
    navigate('/profile/galleries');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-blue-600" />
      </div>
    );
  }

  if (fetchError || !gallery) {
    return (
      <div className="min-h-screen bg-white px-4 py-8">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Error</h1>
          <p className="text-gray-600 mb-6">{fetchError || 'Gallery not found'}</p>
          <button
            onClick={handleCancel}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to Galleries
          </button>
        </div>
      </div>
    );
  }

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
          <h1 className="text-3xl font-bold text-gray-900">Edit Gallery</h1>
          <p className="text-gray-600 mt-2">
            {gallery.name}
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-8 md:px-6">
        <div className="max-w-2xl mx-auto space-y-8">
          {/* Gallery Form */}
          <GalleryForm
            initialData={{
              name: gallery.name,
              description: gallery.description,
              welcome_message: gallery.welcome_message,
              theme_id: gallery.theme_id,
            }}
            isLoading={isSaving}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            submitLabel="Save Changes"
          />

          {/* Divider */}
          <div className="border-t border-gray-200 pt-8">
            {/* Status Section */}
            <div className="mb-8">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Gallery Status</h2>
              <div className="space-y-3">
                <label className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="status"
                    value="active"
                    checked={status === 'active'}
                    onChange={(e) => setStatus(e.target.value as any)}
                    disabled={isSaving}
                    className="w-4 h-4"
                  />
                  <div>
                    <p className="font-medium text-gray-900">Active</p>
                    <p className="text-sm text-gray-600">Gallery is visible to the public</p>
                  </div>
                </label>

                <label className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="status"
                    value="hidden"
                    checked={status === 'hidden'}
                    onChange={(e) => setStatus(e.target.value as any)}
                    disabled={isSaving}
                    className="w-4 h-4"
                  />
                  <div>
                    <p className="font-medium text-gray-900">Hidden</p>
                    <p className="text-sm text-gray-600">Only visible to you via direct link</p>
                  </div>
                </label>

                <label className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="status"
                    value="archived"
                    checked={status === 'archived'}
                    onChange={(e) => setStatus(e.target.value as any)}
                    disabled={isSaving}
                    className="w-4 h-4"
                  />
                  <div>
                    <p className="font-medium text-gray-900">Archived</p>
                    <p className="text-sm text-gray-600">Hidden and not accessible (can be restored later)</p>
                  </div>
                </label>
              </div>
            </div>

            {/* Danger Zone */}
            <div className="border-t border-gray-200 pt-8">
              <h2 className="text-lg font-bold text-red-600 mb-4">Danger Zone</h2>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                disabled={gallery.is_default || isSaving}
                title={gallery.is_default ? 'Cannot delete the default gallery' : ''}
                className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                Delete Gallery
              </button>
              {gallery.is_default && (
                <p className="mt-2 text-sm text-gray-600">
                  The default gallery cannot be deleted
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="Delete Gallery?"
        message={`Are you sure you want to delete "${gallery.name}"? This action cannot be undone. All collections and artworks in this gallery will be deleted.`}
        confirmText="Delete"
        cancelText="Cancel"
        isDangerous={true}
        isLoading={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
}
```

### Step 3: Update Routes

Add the edit route to your router configuration.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/router.tsx`

Add the route (make sure it comes after the `/new` route):

```typescript
{
  path: '/profile/galleries/:id',
  element: <GalleryEdit />,
  name: 'Edit Gallery',
}
```

### Step 4: Link from Galleries List

Update the galleries list page to link to the edit page.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/pages/GalleriesList.tsx`

Wrap each gallery card with a link:

```typescript
import { Link } from 'react-router-dom';

// In your gallery grid:
<Link
  to={`/profile/galleries/${gallery.id}`}
  className="block hover:shadow-lg transition-shadow"
>
  <GalleryCard gallery={gallery} />
</Link>
```

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/common/ConfirmDialog.tsx` | Create |
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/pages/GalleryEdit.tsx` | Create |
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/router.tsx` | Modify - add route |
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/pages/GalleriesList.tsx` | Modify - add links |

---

## Verification

1. Create a test gallery via build 59
2. Navigate to `/profile/galleries/{id}` for that gallery
3. Verify gallery details are loaded and pre-populated in form
4. Edit gallery name and description, click Save
5. Verify changes are saved and toast shows success
6. Change status to "Hidden", save
7. Verify status persists on page reload
8. Click Delete Gallery button (if not default)
9. Confirm deletion dialog appears
10. Click Cancel, dialog closes
11. Click Delete again, confirm, verify gallery is deleted and redirects to list
12. For default gallery: verify Delete button is disabled

Test delete confirmation modal appears with correct warning message.

Test on mobile and desktop layouts.
