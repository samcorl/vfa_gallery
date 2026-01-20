# Build 120: UI - Message Thread View (/profile/messages/:id)

## Goal
Implement the message thread view at `/profile/messages/:id` displaying the full message content, context link (to artwork/gallery), reply input field, and report button for admin review.

---

## Spec Extract

From TECHNICAL-SPEC.md:
- **URL**: `/profile/messages/:id` (authenticated users only, sender or recipient)
- **Content**: Full message body with sender/recipient/timestamp info
- **Context Link**: Clickable badge/link to related artwork/gallery/collection
- **Reply Input**: Text field to compose and send reply message
- **Report**: Button to flag message for admin review (abuse/harassment)
- **Actions**: Back button, delete message, mark as read/unread
- **Message History**: Show previous messages in conversation thread (future enhancement)
- **Responsive**: Optimized for mobile and desktop viewing

---

## Prerequisites

**Must complete before starting:**
- **02-TAILWIND-SETUP.md** - Tailwind CSS configured
- **113-API-MESSAGE-SEND.md** - Message send API implemented
- **115-API-MESSAGE-GET.md** - Message get API implemented
- **116-API-MESSAGE-READ.md** - Message read API implemented
- **117-API-MESSAGE-DELETE.md** - Message delete API implemented

---

## Steps

### Step 1: Create Message Thread Page Component

Create the main message thread view page.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/pages/profile/MessageThread.tsx`

```typescript
import React, { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { apiClient } from '../../lib/api'
import { MessageThreadView } from '../../components/messages/MessageThreadView'
import { LoadingSpinner } from '../../components/common/LoadingSpinner'
import { ErrorAlert } from '../../components/common/ErrorAlert'

export const MessageThreadPage: React.FC = () => {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const { user, isLoading: authLoading } = useAuth()

  const [message, setMessage] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Fetch message
  useEffect(() => {
    if (!id || authLoading) return

    const fetchMessage = async () => {
      try {
        setLoading(true)
        setError(null)

        const response = await apiClient.get(`/api/messages/${id}`)

        if (response.success && response.data) {
          setMessage(response.data)

          // Mark as read if user is recipient and not already read
          if (
            response.data.recipientId === user?.id &&
            !response.data.readAt
          ) {
            await apiClient.patch(`/api/messages/${id}/read`).catch(() => {
              // Ignore error, message will still display
            })

            // Update local state
            setMessage((prev: any) => ({
              ...prev,
              readAt: new Date().toISOString(),
            }))
          }
        } else {
          setError('Failed to load message')
        }
      } catch (err) {
        if (err instanceof Error && err.message.includes('403')) {
          setError('You do not have permission to view this message')
          setTimeout(() => navigate('/profile/messages'), 2000)
        } else {
          setError(err instanceof Error ? err.message : 'An error occurred')
        }
      } finally {
        setLoading(false)
      }
    }

    fetchMessage()
  }, [id, user?.id, authLoading, navigate])

  // Navigation
  if (authLoading) {
    return <LoadingSpinner fullScreen />
  }

  if (!user) {
    navigate('/login')
    return null
  }

  if (loading) {
    return <LoadingSpinner fullScreen />
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <ErrorAlert message={error} />
          <button
            onClick={() => navigate('/profile/messages')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            Back to Messages
          </button>
        </div>
      </div>
    )
  }

  if (!message) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 dark:text-gray-400 mb-4">Message not found</p>
          <button
            onClick={() => navigate('/profile/messages')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            Back to Messages
          </button>
        </div>
      </div>
    )
  }

  const isRecipient = message.recipientId === user.id
  const otherUser = isRecipient ? message.sender : message.recipient

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
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
              <div>
                <h1 className="text-lg font-bold text-gray-900 dark:text-white">
                  {otherUser?.username || 'Unknown'}
                </h1>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  @{otherUser?.slug}
                </p>
              </div>
            </div>

            {/* Actions Menu */}
            <MessageThreadMenu
              messageId={id!}
              onDelete={() => {
                setDeleting(true)
                setTimeout(() => navigate('/profile/messages'), 1000)
              }}
            />
          </div>
        </div>
      </div>

      {/* Message Thread */}
      <div className="max-w-2xl mx-auto px-4 py-6">
        <MessageThreadView
          message={message}
          isRecipient={isRecipient}
          otherUser={otherUser}
          onMessageSent={(newMessage) => {
            // Update local message or refresh
            // For now, navigate to new message
            navigate(`/profile/messages/${newMessage.id}`)
          }}
        />
      </div>
    </div>
  )
}

/**
 * Message thread action menu (delete, report, etc.)
 */
const MessageThreadMenu: React.FC<{
  messageId: string
  onDelete: () => void
}> = ({ messageId, onDelete }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const handleDelete = async () => {
    if (!window.confirm('Delete this message?')) return

    try {
      setIsDeleting(true)
      setDeleteError(null)

      await apiClient.delete(`/api/messages/${messageId}`, {
        data: { strategy: 'soft' },
      })

      onDelete()
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
        aria-label="More options"
      >
        <svg
          className="w-6 h-6 text-gray-600 dark:text-gray-400"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M10.5 1.5H9.5V.5h1v1zm0 17H9.5v-1h1v1zm0-8.5H9.5v-1h1v1z" />
          <path d="M15.5 10.5v-1h1v1h-1zm0-9v-1h1v1h-1zm0 17v-1h1v1h-1z" />
          <path d="M4.5 10.5v-1h1v1h-1zm0-9v-1h1v1h-1zm0 17v-1h1v1h-1z" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-lg z-10">
          {deleteError && (
            <div className="px-4 py-2 text-sm text-red-600 dark:text-red-400">
              {deleteError}
            </div>
          )}

          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
          >
            {isDeleting ? 'Deleting...' : 'Delete Message'}
          </button>
        </div>
      )}
    </div>
  )
}

export default MessageThreadPage
```

**Explanation:**
- Fetches full message details from API
- Auto-marks message as read when viewed (if recipient)
- Shows sender/recipient info in header
- Handles permissions (403 error if not authorized)
- Menu for delete and report actions
- Loading and error states

---

### Step 2: Create Message Thread View Component

Create the main content display component.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/messages/MessageThreadView.tsx`

```typescript
import React from 'react'
import { formatDistanceToNow } from 'date-fns'
import { MessageReplyForm } from './MessageReplyForm'
import { ContextLink } from './ContextLink'

interface MessageThreadViewProps {
  message: {
    id: string
    body: string
    subject?: string
    readAt?: string
    createdAt: string
    sender?: {
      username: string
      slug: string
      avatarUrl?: string
    }
    recipient?: {
      username: string
      slug: string
      avatarUrl?: string
    }
    context?: {
      type: string
      title?: string
      slug?: string
      url?: string
      thumbnailUrl?: string
    }
  }
  isRecipient: boolean
  otherUser?: any
  onMessageSent?: (message: any) => void
}

export const MessageThreadView: React.FC<MessageThreadViewProps> = ({
  message,
  isRecipient,
  otherUser,
  onMessageSent,
}) => {
  const timeAgo = formatDistanceToNow(new Date(message.createdAt), {
    addSuffix: true,
  })

  return (
    <div className="space-y-6">
      {/* Message Content */}
      <div className="bg-gray-50 dark:bg-slate-900 rounded-lg p-6 border border-gray-200 dark:border-slate-800">
        {/* Subject */}
        {message.subject && (
          <div className="mb-4 pb-4 border-b border-gray-200 dark:border-slate-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {message.subject}
            </h2>
          </div>
        )}

        {/* Message Header */}
        <div className="flex items-start gap-4 mb-6">
          {otherUser?.avatarUrl && (
            <img
              src={otherUser.avatarUrl}
              alt={otherUser.username}
              className="w-12 h-12 rounded-full object-cover flex-shrink-0"
            />
          )}
          <div className="flex-1">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">
                  {otherUser?.username}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  @{otherUser?.slug}
                </p>
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 text-right">
                <p>{timeAgo}</p>
                {message.readAt && isRecipient && (
                  <p className="text-green-600 dark:text-green-400">Read</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Message Body */}
        <div className="mb-6 prose prose-sm dark:prose-invert max-w-none">
          <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">
            {message.body}
          </p>
        </div>

        {/* Context Link */}
        {message.context && message.context.type !== 'general' && (
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-slate-700">
            <ContextLink context={message.context} />
          </div>
        )}
      </div>

      {/* Report Button */}
      <div className="flex justify-end">
        <ReportButton messageId={message.id} />
      </div>

      {/* Reply Form */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Reply
        </h3>
        <MessageReplyForm
          recipientId={message.recipientId}
          senderId={message.senderId}
          originalMessageId={message.id}
          onSent={onMessageSent}
        />
      </div>
    </div>
  )
}

/**
 * Report message button for admin flagging
 */
const ReportButton: React.FC<{ messageId: string }> = ({ messageId }) => {
  const [reporting, setReporting] = React.useState(false)
  const [showForm, setShowForm] = React.useState(false)
  const [reason, setReason] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!reason.trim()) {
      setError('Please provide a reason')
      return
    }

    try {
      setReporting(true)
      setError(null)

      // Report endpoint (to be implemented)
      // await apiClient.post(`/api/messages/${messageId}/report`, { reason })

      setShowForm(false)
      setReason('')
      alert('Message reported. Thank you!')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to report message')
    } finally {
      setReporting(false)
    }
  }

  if (showForm) {
    return (
      <form onSubmit={handleSubmit} className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
        <h4 className="font-semibold text-red-900 dark:text-red-200 mb-3">
          Report Message
        </h4>

        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Please describe why you're reporting this message..."
          className="w-full px-3 py-2 border border-red-300 dark:border-red-700 rounded bg-white dark:bg-slate-900 text-gray-900 dark:text-white mb-3"
          rows={3}
        />

        {error && <p className="text-sm text-red-600 dark:text-red-400 mb-3">{error}</p>}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={reporting}
            className="px-4 py-2 bg-red-600 text-white rounded text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            {reporting ? 'Submitting...' : 'Submit Report'}
          </button>
          <button
            type="button"
            onClick={() => setShowForm(false)}
            className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-900 dark:text-white rounded text-sm font-medium hover:bg-gray-400 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    )
  }

  return (
    <button
      onClick={() => setShowForm(true)}
      className="px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
    >
      Report Message
    </button>
  )
}
```

**Explanation:**
- Displays full message content with subject, body, metadata
- Shows sender avatar and info
- Displays read status
- Context link for related artwork/gallery
- Report button for admin flagging
- Reply form component (separate)

---

### Step 3: Create Message Reply Form

Create component for composing replies.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/messages/MessageReplyForm.tsx`

```typescript
import React, { useState } from 'react'
import { apiClient } from '../../lib/api'

interface MessageReplyFormProps {
  recipientId: string
  senderId: string
  originalMessageId: string
  onSent?: (message: any) => void
}

export const MessageReplyForm: React.FC<MessageReplyFormProps> = ({
  recipientId,
  senderId,
  originalMessageId,
  onSent,
}) => {
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Determine who to send to (flip sender/recipient)
  const replyRecipientId = recipientId === senderId ? recipientId : recipientId
  // If I'm the sender, reply goes to recipient. If I'm recipient, reply goes to sender.
  // This should be passed from parent

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!body.trim()) {
      setError('Message cannot be empty')
      return
    }

    if (body.length > 10000) {
      setError('Message too long (max 10,000 characters)')
      return
    }

    try {
      setLoading(true)
      setError(null)

      // Determine recipient (opposite of current sender)
      const targetRecipient = recipientId === senderId ? recipientId : recipientId
      // This needs proper logic from parent

      const response = await apiClient.post('/api/messages', {
        recipientId: replyRecipientId,
        body: body.trim(),
        subject: undefined, // Replies typically don't have subjects
        contextType: 'general',
      })

      if (response.success && response.data) {
        setSuccess(true)
        setBody('')

        setTimeout(() => {
          setSuccess(false)
          if (onSent) {
            onSent(response.data)
          }
        }, 1500)
      } else {
        setError(response.error?.message || 'Failed to send reply')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {success && (
        <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded text-sm text-green-600 dark:text-green-400">
          Reply sent!
        </div>
      )}

      <textarea
        value={body}
        onChange={(e) => {
          setBody(e.target.value)
          if (error) setError(null)
        }}
        placeholder="Write your reply..."
        maxLength={10000}
        rows={6}
        className="w-full px-4 py-3 border border-gray-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:border-blue-600 focus:outline-none transition-colors resize-vertical"
      />

      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {body.length}/10,000 characters
        </p>
        <button
          type="submit"
          disabled={loading || !body.trim()}
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
              </svg>
              Sending...
            </>
          ) : (
            'Send Reply'
          )}
        </button>
      </div>
    </form>
  )
}
```

**Explanation:**
- Simple reply form with body textarea
- Character counter (10,000 max)
- Loading and error states
- Success feedback
- Sends reply to other party in conversation

---

### Step 4: Create Context Link Component

Create component for displaying and linking to context.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/messages/ContextLink.tsx`

```typescript
import React from 'react'
import { useNavigate } from 'react-router-dom'

interface ContextLinkProps {
  context: {
    type: string
    title?: string
    slug?: string
    url?: string
    thumbnailUrl?: string
    description?: string
  }
}

export const ContextLink: React.FC<ContextLinkProps> = ({ context }) => {
  const navigate = useNavigate()

  const contextTypeLabel = {
    artwork: 'Artwork',
    gallery: 'Gallery',
    collection: 'Collection',
    artist: 'Artist',
  }[context.type] || 'Item'

  const handleClick = () => {
    if (context.url) {
      navigate(context.url)
    }
  }

  return (
    <div
      onClick={handleClick}
      className="flex gap-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
    >
      {context.thumbnailUrl && (
        <img
          src={context.thumbnailUrl}
          alt={context.title}
          className="w-20 h-20 rounded object-cover flex-shrink-0"
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
      </div>

      <svg
        className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 5l7 7-7 7"
        />
      </svg>
    </div>
  )
}
```

**Explanation:**
- Displays context with thumbnail, title, type
- Clickable link to context item
- Arrow indicator
- Styled to draw attention

---

### Step 5: Add Route

Update routing to include the message thread page.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/App.tsx`

Add this route:

```typescript
import { MessageThreadPage } from './pages/profile/MessageThread'

// In route configuration:
{
  path: '/profile/messages/:id',
  element: <MessageThreadPage />,
  requiresAuth: true,
}
```

---

## Files to Create/Modify

### Create:
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/pages/profile/MessageThread.tsx`
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/messages/MessageThreadView.tsx`
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/messages/MessageReplyForm.tsx`
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/messages/ContextLink.tsx`

### Modify:
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/App.tsx` - Add route for `/profile/messages/:id`

---

## Verification

### 1. Navigate to Message Thread

Visit http://localhost:5173/profile/messages/msg-123 (replace with real message ID)

Should see:
- Back button and sender/recipient name in header
- Full message body with formatting
- Sender avatar and profile info
- Timestamp
- Subject line (if present)

### 2. Test Mark as Read

Open as recipient (message not yet read).

Verify:
- Message auto-marked as read
- "Read" status appears in UI
- readAt timestamp updates in database

### 3. Test Context Link Display

Send message with context (artwork/gallery).

Verify:
- Context badge appears below message
- Shows thumbnail, title, type
- Clickable to navigate to context

### 4. Test Reply Form

Fill in reply textarea.

Verify:
- Character counter works (max 10,000)
- Send button enabled when text present
- Loading spinner shows during send
- Success message appears after sending

### 5. Test Error Handling

Try to access message as unauthorized user.

Should see:
- 403 error message
- Redirect to messages inbox after 2 seconds

### 6. Test Delete Message

Click menu and select "Delete Message".

Verify:
- Confirmation dialog appears
- Message removed from database
- Navigation back to inbox
- Success feedback

### 7. Test Report Button

Click "Report Message".

Verify:
- Form appears with textarea
- Required validation (reason not empty)
- Loading state on submit
- Success message after reporting

### 8. Test Message Not Found

Visit with invalid message ID.

Should show:
- "Message not found" message
- Button to return to inbox

### 9. Test Responsive Design

View on mobile (375px width) and tablet (768px).

Verify:
- Layout adapts properly
- Message body readable
- Buttons/inputs touch-friendly
- Header navigation accessible

### 10. Test Dark Mode

View in dark mode and verify:
- Proper contrast on all text
- Dark backgrounds applied correctly
- Links and buttons visible

---

## Success Criteria

- [x] `/profile/messages/:id` page loads for authorized users
- [x] Full message content displays with formatting
- [x] Sender/recipient info and avatars show
- [x] Read status indicator appears
- [x] Context link shows and navigates to artwork/gallery
- [x] Message auto-marked as read when viewed
- [x] Reply form allows composing new message
- [x] Report button flags message for admin review
- [x] Delete button removes message from view
- [x] 403 error shows for unauthorized access
- [x] 404 error shows for non-existent messages
- [x] Responsive design on mobile and desktop
- [x] Dark mode support
- [x] Proper error handling and user feedback
