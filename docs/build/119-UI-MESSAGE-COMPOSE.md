# Build 119: UI - Message Compose Form (/profile/messages/compose)

## Goal
Implement a message composition form at `/profile/messages/compose` with recipient picker, subject and body input fields, context display if coming from artwork page, and send button with loading state.

---

## Spec Extract

From TECHNICAL-SPEC.md:
- **URL**: `/profile/messages/compose` (authenticated users only)
- **Recipient Picker**: Search and select from available users
- **Pre-filled Context**: If coming from artwork/gallery page, show context info
- **Form Fields**: Recipient, Subject (optional), Body (required)
- **Validation**: Subject ≤200 chars, Body required, ≤10,000 chars
- **Submit Behavior**: Show loading state, disable submit during send
- **Success**: Navigate to message thread or inbox
- **Errors**: Display validation errors and API errors

---

## Prerequisites

**Must complete before starting:**
- **02-TAILWIND-SETUP.md** - Tailwind CSS configured
- **06-SCHEMA-USERS.md** - Users table for recipient search
- **113-API-MESSAGE-SEND.md** - Message send API implemented
- **114-API-MESSAGE-LIST.md** - Message list API implemented

---

## Steps

### Step 1: Create Message Compose Page Component

Create the main compose page component.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/pages/profile/MessageCompose.tsx`

```typescript
import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { MessageComposeForm } from '../../components/messages/MessageComposeForm'
import { LoadingSpinner } from '../../components/common/LoadingSpinner'

export const MessageComposePage: React.FC = () => {
  const navigate = useNavigate()
  const { user, isLoading: authLoading } = useAuth()
  const [searchParams] = useSearchParams()

  // Get context from URL params (if coming from artwork/gallery page)
  const contextType = searchParams.get('contextType') as
    | 'artwork'
    | 'gallery'
    | 'collection'
    | 'artist'
    | undefined
  const contextId = searchParams.get('contextId') || undefined
  const recipientId = searchParams.get('recipientId') || undefined

  // Navigation for non-authenticated users
  if (authLoading) {
    return <LoadingSpinner fullScreen />
  }

  if (!user) {
    navigate('/login')
    return null
  }

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/profile/messages')}
              className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              aria-label="Back"
            >
              <svg
                className="w-6 h-6 text-gray-600 dark:text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              New Message
            </h1>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-2xl mx-auto px-4 py-6">
        <MessageComposeForm
          contextType={contextType}
          contextId={contextId}
          recipientId={recipientId}
          onSent={(messageId) => {
            // Navigate to message thread
            navigate(`/profile/messages/${messageId}`)
          }}
        />
      </div>
    </div>
  )
}

export default MessageComposePage
```

**Explanation:**
- Back button to return to inbox
- Extracts context from URL params
- Pre-fills recipient if provided
- Shows context preview if present
- Navigates to message thread after sending

---

### Step 2: Create Message Compose Form Component

Create the form component with all fields and validation.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/messages/MessageComposeForm.tsx`

```typescript
import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiClient } from '../../lib/api'
import { RecipientPicker } from './RecipientPicker'
import { ContextPreview } from './ContextPreview'
import { ErrorAlert } from '../common/ErrorAlert'
import { LoadingSpinner } from '../common/LoadingSpinner'

interface MessageComposeFormProps {
  contextType?: 'artwork' | 'gallery' | 'collection' | 'artist'
  contextId?: string
  recipientId?: string
  onSent?: (messageId: string) => void
}

interface FormData {
  recipientId: string
  subject: string
  body: string
}

interface FormErrors {
  recipientId?: string
  subject?: string
  body?: string
  submit?: string
}

export const MessageComposeForm: React.FC<MessageComposeFormProps> = ({
  contextType,
  contextId,
  recipientId: initialRecipientId,
  onSent,
}) => {
  const navigate = useNavigate()

  // Form state
  const [formData, setFormData] = useState<FormData>({
    recipientId: initialRecipientId || '',
    subject: '',
    body: '',
  })

  const [errors, setErrors] = useState<FormErrors>({})
  const [loading, setLoading] = useState(false)
  const [context, setContext] = useState<any>(null)
  const [contextLoading, setContextLoading] = useState(!!contextId)

  // Fetch context if provided
  useEffect(() => {
    if (contextId && contextType) {
      const fetchContext = async () => {
        try {
          // Fetch context details based on type
          let endpoint = ''
          if (contextType === 'artwork') {
            endpoint = `/api/artworks/${contextId}`
          } else if (contextType === 'gallery') {
            endpoint = `/api/galleries/${contextId}`
          } else if (contextType === 'collection') {
            endpoint = `/api/collections/${contextId}`
          }

          if (endpoint) {
            const response = await apiClient.get(endpoint)
            if (response.success && response.data) {
              setContext({
                type: contextType,
                id: contextId,
                ...response.data,
              })
            }
          }
        } catch (err) {
          console.error('Failed to fetch context:', err)
        } finally {
          setContextLoading(false)
        }
      }

      fetchContext()
    }
  }, [contextId, contextType])

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: FormErrors = {}

    if (!formData.recipientId.trim()) {
      newErrors.recipientId = 'Recipient is required'
    }

    if (formData.subject && formData.subject.length > 200) {
      newErrors.subject = 'Subject cannot exceed 200 characters'
    }

    if (!formData.body.trim()) {
      newErrors.body = 'Message body is required'
    } else if (formData.body.length > 10000) {
      newErrors.body = 'Message body cannot exceed 10,000 characters'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Handle submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    try {
      setLoading(true)
      setErrors({})

      const response = await apiClient.post('/api/messages', {
        recipientId: formData.recipientId,
        subject: formData.subject || undefined,
        body: formData.body,
        contextType: contextType || 'general',
        contextId: contextId || undefined,
      })

      if (response.success && response.data) {
        // Call success callback
        if (onSent) {
          onSent(response.data.id)
        } else {
          navigate('/profile/messages')
        }
      } else {
        setErrors({
          submit: response.error?.message || 'Failed to send message',
        })
      }
    } catch (err) {
      setErrors({
        submit:
          err instanceof Error ? err.message : 'An error occurred',
      })
    } finally {
      setLoading(false)
    }
  }

  // Update form data
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    // Clear error when user starts typing
    if (errors[name as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }))
    }
  }

  if (contextLoading) {
    return <LoadingSpinner />
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Error Alert */}
      {errors.submit && <ErrorAlert message={errors.submit} />}

      {/* Context Preview */}
      {context && (
        <ContextPreview context={context} />
      )}

      {/* Recipient Field */}
      <div>
        <label htmlFor="recipient" className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
          To <span className="text-red-600">*</span>
        </label>
        <RecipientPicker
          value={formData.recipientId}
          onChange={(id) =>
            setFormData((prev) => ({ ...prev, recipientId: id }))
          }
          error={errors.recipientId}
        />
        {errors.recipientId && (
          <p className="mt-1 text-sm text-red-600">{errors.recipientId}</p>
        )}
      </div>

      {/* Subject Field */}
      <div>
        <label
          htmlFor="subject"
          className="block text-sm font-medium text-gray-900 dark:text-white mb-2"
        >
          Subject <span className="text-gray-500 dark:text-gray-400">(optional)</span>
        </label>
        <input
          type="text"
          id="subject"
          name="subject"
          value={formData.subject}
          onChange={handleChange}
          placeholder="Message subject"
          maxLength={200}
          className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors ${
            errors.subject
              ? 'border-red-600'
              : 'border-gray-300 dark:border-slate-700 focus:border-blue-600 focus:outline-none'
          }`}
        />
        <div className="mt-1 flex items-center justify-between">
          {errors.subject && (
            <p className="text-sm text-red-600">{errors.subject}</p>
          )}
          <p className="text-xs text-gray-500 dark:text-gray-400 ml-auto">
            {formData.subject.length}/200
          </p>
        </div>
      </div>

      {/* Body Field */}
      <div>
        <label
          htmlFor="body"
          className="block text-sm font-medium text-gray-900 dark:text-white mb-2"
        >
          Message <span className="text-red-600">*</span>
        </label>
        <textarea
          id="body"
          name="body"
          value={formData.body}
          onChange={handleChange}
          placeholder="Write your message here..."
          maxLength={10000}
          rows={8}
          className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors resize-vertical ${
            errors.body
              ? 'border-red-600'
              : 'border-gray-300 dark:border-slate-700 focus:border-blue-600 focus:outline-none'
          }`}
        />
        <div className="mt-1 flex items-center justify-between">
          {errors.body && (
            <p className="text-sm text-red-600">{errors.body}</p>
          )}
          <p className="text-xs text-gray-500 dark:text-gray-400 ml-auto">
            {formData.body.length}/10,000
          </p>
        </div>
      </div>

      {/* Buttons */}
      <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-slate-700">
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors font-medium flex items-center gap-2"
        >
          {loading ? (
            <>
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Sending...
            </>
          ) : (
            'Send Message'
          )}
        </button>
        <button
          type="button"
          onClick={() => navigate('/profile/messages')}
          disabled={loading}
          className="px-6 py-2 bg-gray-200 dark:bg-slate-800 text-gray-900 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors font-medium"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
```

**Explanation:**
- Form with recipient, subject (optional), and body (required) fields
- Validation with character limits (subject 200, body 10,000)
- RecipientPicker component for selecting recipient
- Shows context preview if provided
- Loading state on submit button
- Error messages for validation failures
- Character counters for subject and body
- Dark mode support

---

### Step 3: Create Recipient Picker Component

Create component for searching and selecting recipients.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/messages/RecipientPicker.tsx`

```typescript
import React, { useState, useEffect, useRef } from 'react'
import { apiClient } from '../../lib/api'

interface User {
  id: string
  username: string
  slug: string
  avatarUrl?: string
}

interface RecipientPickerProps {
  value: string
  onChange: (id: string) => void
  error?: string
}

export const RecipientPicker: React.FC<RecipientPickerProps> = ({
  value,
  onChange,
  error,
}) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [suggestions, setSuggestions] = useState<User[]>([])
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Search for users
  useEffect(() => {
    const searchUsers = async () => {
      if (searchQuery.trim().length < 2) {
        setSuggestions([])
        return
      }

      try {
        setLoading(true)
        const response = await apiClient.get('/api/users/search', {
          params: { q: searchQuery, limit: 10 },
        })

        if (response.success && response.data) {
          setSuggestions(response.data.users || [])
        }
      } catch (err) {
        console.error('Failed to search users:', err)
      } finally {
        setLoading(false)
      }
    }

    const timer = setTimeout(searchUsers, 300) // Debounce
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Handle outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Handle selection
  const handleSelect = (user: User) => {
    setSelectedUser(user)
    onChange(user.id)
    setIsOpen(false)
    setSearchQuery('')
  }

  return (
    <div className="relative">
      {selectedUser ? (
        // Selected user display
        <div
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center gap-3 px-4 py-2 border rounded-lg bg-white dark:bg-slate-900 cursor-pointer transition-colors ${
            error
              ? 'border-red-600'
              : 'border-gray-300 dark:border-slate-700 hover:border-gray-400 dark:hover:border-slate-600'
          }`}
        >
          {selectedUser.avatarUrl && (
            <img
              src={selectedUser.avatarUrl}
              alt={selectedUser.username}
              className="w-8 h-8 rounded-full object-cover"
            />
          )}
          <span className="text-gray-900 dark:text-white font-medium flex-1">
            {selectedUser.username}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation()
              setSelectedUser(null)
              onChange('')
              setSearchQuery('')
            }}
            className="p-1 hover:bg-gray-100 dark:hover:bg-slate-800 rounded transition-colors"
          >
            <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      ) : (
        // Search input
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              setIsOpen(true)
            }}
            onFocus={() => setIsOpen(true)}
            placeholder="Search for a user..."
            className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors ${
              error
                ? 'border-red-600'
                : 'border-gray-300 dark:border-slate-700 focus:border-blue-600 focus:outline-none'
            }`}
          />
          {loading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <svg className="animate-spin w-4 h-4 text-gray-400" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
              </svg>
            </div>
          )}
        </div>
      )}

      {/* Dropdown */}
      {isOpen && !selectedUser && (
        <div
          ref={dropdownRef}
          className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-lg shadow-lg z-10"
        >
          {loading && (
            <div className="p-4 text-center text-gray-500 dark:text-gray-400">
              Searching...
            </div>
          )}

          {!loading && suggestions.length === 0 && searchQuery.trim().length > 0 && (
            <div className="p-4 text-center text-gray-500 dark:text-gray-400">
              No users found
            </div>
          )}

          {!loading && searchQuery.trim().length < 2 && (
            <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">
              Type at least 2 characters to search
            </div>
          )}

          {suggestions.map((user) => (
            <button
              key={user.id}
              onClick={() => handleSelect(user)}
              className="w-full px-4 py-3 text-left hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-3"
            >
              {user.avatarUrl && (
                <img
                  src={user.avatarUrl}
                  alt={user.username}
                  className="w-8 h-8 rounded-full object-cover"
                />
              )}
              <div>
                <div className="font-medium text-gray-900 dark:text-white">
                  {user.username}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  @{user.slug}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
```

**Explanation:**
- Search input with debounce (300ms)
- Dropdown with search suggestions
- Selected user display with option to change
- Avatar thumbnails in suggestions and display
- Loading indicator while searching
- Handles outside clicks to close dropdown

---

### Step 4: Create Context Preview Component

Create component to display context information.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/messages/ContextPreview.tsx`

```typescript
import React from 'react'

interface ContextPreviewProps {
  context: {
    type: string
    title?: string
    slug?: string
    thumbnailUrl?: string
    description?: string
    artist?: {
      username: string
      slug: string
    }
  }
}

export const ContextPreview: React.FC<ContextPreviewProps> = ({ context }) => {
  const contextTypeLabel = {
    artwork: 'Artwork',
    gallery: 'Gallery',
    collection: 'Collection',
    artist: 'Artist',
  }[context.type] || 'Item'

  return (
    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
      <div className="flex gap-3">
        {context.thumbnailUrl && (
          <img
            src={context.thumbnailUrl}
            alt={context.title}
            className="w-16 h-16 rounded object-cover flex-shrink-0"
          />
        )}
        <div className="flex-1">
          <p className="text-xs text-blue-600 dark:text-blue-400 font-medium mb-1">
            {contextTypeLabel}
          </p>
          <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
            {context.title || context.slug || 'Untitled'}
          </h3>
          {context.description && (
            <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
              {context.description}
            </p>
          )}
          {context.artist && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              By {context.artist.username}
            </p>
          )}
        </div>
      </div>
      <p className="text-xs text-blue-600 dark:text-blue-400 mt-3">
        This message will be linked to this {contextTypeLabel.toLowerCase()}
      </p>
    </div>
  )
}
```

**Explanation:**
- Displays context thumbnail, title, and description
- Shows context type label
- Displays artist info for artworks
- Indicates that message will be linked to context

---

### Step 5: Add Route

Update routing to include the compose page.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/App.tsx`

Add this route:

```typescript
import { MessageComposePage } from './pages/profile/MessageCompose'

// In route configuration:
{
  path: '/profile/messages/compose',
  element: <MessageComposePage />,
  requiresAuth: true,
}
```

---

### Step 6: Add Quick Compose from Artwork Page (Optional)

Add button on artwork page to send message to artist.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/pages/ArtworkDetail.tsx`

Add this button in artwork header/actions section:

```typescript
import { useNavigate } from 'react-router-dom'

const handleMessageArtist = () => {
  navigate(`/profile/messages/compose?contextType=artwork&contextId=${artwork.id}`)
}

// In component:
<button
  onClick={handleMessageArtist}
  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium flex items-center gap-2"
>
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
  Message Artist
</button>
```

---

## Files to Create/Modify

### Create:
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/pages/profile/MessageCompose.tsx`
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/messages/MessageComposeForm.tsx`
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/messages/RecipientPicker.tsx`
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/messages/ContextPreview.tsx`

### Modify:
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/App.tsx` - Add route for `/profile/messages/compose`
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/pages/ArtworkDetail.tsx` - Add message button (optional)

---

## Verification

### 1. Navigate to Compose Page

Visit http://localhost:5173/profile/messages/compose (when authenticated)

Should see:
- "New Message" header with back button
- Recipient search field
- Subject input (optional label)
- Message body textarea
- Send and Cancel buttons

### 2. Test Recipient Search

Type in recipient field and verify:
- Minimum 2 characters before search
- Dropdown appears with suggestions
- Avatar thumbnails show
- Username and slug display
- Loading indicator shows while searching

### 3. Test Recipient Selection

Click on a suggestion and verify:
- User selected in field
- Dropdown closes
- Shows avatar and username
- X button appears to change selection

### 4. Test Form Validation

Try to submit empty form:
- "Recipient is required" error
- "Message body is required" error
- Submit button disabled if errors

### 5. Test Character Limits

Type in subject field:
- Counter shows "X/200"
- Cannot type over 200 chars
- Body shows "X/10,000"
- Cannot type over 10,000 chars

### 6. Test Message Send

Fill form and click Send:
- Loading spinner shows on button
- Submit button disabled during send
- Navigates to message thread after success
- Error message shows on API failure

### 7. Test Context Pre-fill

Visit with URL params:
```
http://localhost:5173/profile/messages/compose?contextType=artwork&contextId=art-123
```

Should show:
- Context preview with artwork thumbnail
- "This message will be linked to this artwork"
- Message sent includes context_type and context_id

### 8. Test Message from Artwork Page

On artwork detail page, find "Message Artist" button:
- Clicking opens compose with context pre-filled
- Artist is pre-selected if possible
- Context preview shows artwork info

### 9. Test Dark Mode

View in dark mode and verify:
- Form inputs have proper contrast
- Dark background colors applied
- Text readable in all states

### 10. Test Mobile Responsiveness

View on 375px width and verify:
- Form takes full width with padding
- Avatar thumbnails visible
- Touch targets adequate (40px+)
- Dropdown doesn't overflow

---

## Success Criteria

- [x] `/profile/messages/compose` page loads
- [x] Recipient search works with minimum 2 character requirement
- [x] Subject is optional, body is required
- [x] Character limits enforced (subject 200, body 10,000)
- [x] Context preview shows when linking to artwork/gallery/collection
- [x] Loading state shows during submit
- [x] Navigation occurs on successful send
- [x] Validation errors display clearly
- [x] Pre-fill works from URL params
- [x] Message Artist button works on artwork pages
- [x] Responsive design on mobile
- [x] Dark mode support
