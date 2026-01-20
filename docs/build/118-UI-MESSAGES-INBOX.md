# Build 118: UI - Messages Inbox (/profile/messages)

## Goal
Implement the Messages page at `/profile/messages` with Inbox/Sent tabs, message list with previews, unread indicators, and context badges showing related artworks/galleries.

---

## Spec Extract

From TECHNICAL-SPEC.md:
- **URL**: `/profile/messages` (authenticated users only)
- **Components**: Inbox and Sent tabs with full message lists
- **Message Preview**: Subject line, body preview, sender/recipient info
- **Unread Indicator**: Bold text or dot indicator for unread messages
- **Context Badge**: Shows related artwork/gallery/collection title and thumbnail
- **Pagination**: Load more / infinite scroll or numbered pages
- **Actions**: Delete, mark as read, compose new message buttons
- **Responsive**: Mobile-first design, optimized for viewing on all devices

---

## Prerequisites

**Must complete before starting:**
- **02-TAILWIND-SETUP.md** - Tailwind CSS configured
- **113-API-MESSAGE-SEND.md** - Message send API implemented
- **114-API-MESSAGE-LIST.md** - Message list API implemented
- **116-API-MESSAGE-READ.md** - Message read API implemented
- **117-API-MESSAGE-DELETE.md** - Message delete API implemented

---

## Steps

### Step 1: Create Messages Page Component

Create the main messages page component with tab navigation.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/pages/profile/Messages.tsx`

```typescript
import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { MessageList } from '../../components/messages/MessageList'
import { MessageComposeFab } from '../../components/messages/MessageComposeFab'
import { LoadingSpinner } from '../../components/common/LoadingSpinner'
import { ErrorAlert } from '../../components/common/ErrorAlert'

export const MessagesPage: React.FC = () => {
  const navigate = useNavigate()
  const { user, isLoading: authLoading } = useAuth()

  // Tab state
  const [activeTab, setActiveTab] = useState<'inbox' | 'sent'>('inbox')

  // Navigation
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
      <div className="sticky top-0 z-40 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Messages
            </h1>
            <button
              onClick={() => navigate('/profile/messages/compose')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              New Message
            </button>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-1 border-b border-gray-200 dark:border-slate-700">
            <button
              onClick={() => setActiveTab('inbox')}
              className={`px-4 py-3 font-medium text-sm transition-colors border-b-2 ${
                activeTab === 'inbox'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300'
              }`}
            >
              Inbox
            </button>
            <button
              onClick={() => setActiveTab('sent')}
              className={`px-4 py-3 font-medium text-sm transition-colors border-b-2 ${
                activeTab === 'sent'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300'
              }`}
            >
              Sent
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        <MessageList folder={activeTab} />
      </div>

      {/* Compose FAB (Floating Action Button) */}
      <MessageComposeFab />
    </div>
  )
}

export default MessagesPage
```

**Explanation:**
- Responsive header with "New Message" button
- Tab navigation for Inbox/Sent folders
- Uses MessageList component for folder content
- Floating action button for quick message composition
- Dark mode support with Tailwind classes

---

### Step 2: Create Message List Component

Create the component to display and manage message lists.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/messages/MessageList.tsx`

```typescript
import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiClient } from '../../lib/api'
import { MessageListItem } from './MessageListItem'
import { LoadingSpinner } from '../common/LoadingSpinner'
import { ErrorAlert } from '../common/ErrorAlert'
import { PaginationControls } from '../common/PaginationControls'

interface Props {
  folder: 'inbox' | 'sent'
}

export const MessageList: React.FC<Props> = ({ folder }) => {
  const navigate = useNavigate()

  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({
    total: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  })

  const [selectedMessages, setSelectedMessages] = useState(new Set<string>())
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Fetch messages
  useEffect(() => {
    const fetchMessages = async () => {
      try {
        setLoading(true)
        setError(null)

        const response = await apiClient.get('/api/messages', {
          params: {
            folder,
            page,
            limit: 20,
          },
        })

        if (response.success && response.data) {
          setMessages(response.data.messages || [])
          setPagination(response.data.pagination)
        } else {
          setError('Failed to load messages')
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setLoading(false)
      }
    }

    fetchMessages()
  }, [folder, page])

  // Handle mark as read
  const handleMarkAsRead = async (messageId: string) => {
    try {
      await apiClient.patch(`/api/messages/${messageId}/read`)

      // Update local state
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId ? { ...msg, readAt: new Date().toISOString() } : msg
        )
      )
    } catch (err) {
      console.error('Failed to mark as read:', err)
    }
  }

  // Handle delete
  const handleDelete = async (messageIds: string[]) => {
    try {
      await apiClient.post('/api/messages/delete-bulk', {
        messageIds,
        strategy: 'soft',
      })

      // Remove from local state
      setMessages((prev) =>
        prev.filter((msg) => !messageIds.includes(msg.id))
      )
      setSelectedMessages(new Set())
      setShowDeleteConfirm(false)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to delete messages'
      )
    }
  }

  // Handle select all
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedMessages(new Set(messages.map((msg) => msg.id)))
    } else {
      setSelectedMessages(new Set())
    }
  }

  // Handle select single
  const handleSelectMessage = (messageId: string, checked: boolean) => {
    const newSelected = new Set(selectedMessages)
    if (checked) {
      newSelected.add(messageId)
    } else {
      newSelected.delete(messageId)
    }
    setSelectedMessages(newSelected)
  }

  if (loading && messages.length === 0) {
    return <LoadingSpinner />
  }

  if (error) {
    return <ErrorAlert message={error} />
  }

  if (messages.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400 mb-4">
          {folder === 'inbox' ? 'No messages in inbox' : 'No messages sent'}
        </p>
        <button
          onClick={() => navigate('/profile/messages/compose')}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          Send a Message
        </button>
      </div>
    )
  }

  return (
    <div>
      {/* Toolbar */}
      {selectedMessages.size > 0 && (
        <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-center justify-between">
          <span className="text-sm text-gray-700 dark:text-gray-300">
            {selectedMessages.size} message(s) selected
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
            Delete {selectedMessages.size} message(s)?
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => handleDelete(Array.from(selectedMessages))}
              className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
            >
              Confirm Delete
            </button>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="px-3 py-1 text-sm bg-gray-300 dark:bg-gray-600 text-gray-900 dark:text-white rounded hover:bg-gray-400"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Message List */}
      <div className="space-y-2">
        {/* Select All Checkbox */}
        <div className="px-4 py-2 flex items-center gap-3 border-b border-gray-200 dark:border-slate-700">
          <input
            type="checkbox"
            checked={
              selectedMessages.size > 0 &&
              selectedMessages.size === messages.length
            }
            onChange={(e) => handleSelectAll(e.target.checked)}
            className="w-4 h-4 rounded"
          />
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {selectedMessages.size > 0 ? `${selectedMessages.size} selected` : 'Select all'}
          </span>
        </div>

        {/* Message Items */}
        {messages.map((message) => (
          <div
            key={message.id}
            className="flex items-start gap-3 px-4 py-3 border-b border-gray-100 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-900/50 transition-colors cursor-pointer"
            onClick={() => navigate(`/profile/messages/${message.id}`)}
          >
            {/* Checkbox */}
            <input
              type="checkbox"
              checked={selectedMessages.has(message.id)}
              onChange={(e) => {
                e.stopPropagation()
                handleSelectMessage(message.id, e.target.checked)
              }}
              className="w-4 h-4 rounded mt-1 flex-shrink-0"
            />

            {/* Message Item */}
            <div className="flex-1 min-w-0">
              <MessageListItem
                message={message}
                isUnread={!message.readAt}
                onMarkAsRead={() => handleMarkAsRead(message.id)}
              />
            </div>

            {/* Context Badge */}
            {message.context && (
              <div className="flex-shrink-0 hidden sm:block">
                <ContextBadge context={message.context} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="mt-6">
          <PaginationControls
            page={page}
            totalPages={pagination.totalPages}
            onPageChange={setPage}
          />
        </div>
      )}
    </div>
  )
}
```

**Explanation:**
- Fetches messages from API with folder and page parameters
- Displays list of messages with checkboxes for bulk operations
- Supports mark as read, delete single/bulk operations
- Shows pagination controls
- Context badges for related artworks/galleries
- Mobile-friendly with responsive layout

---

### Step 3: Create Message List Item Component

Create the component for individual message display.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/messages/MessageListItem.tsx`

```typescript
import React from 'react'
import { formatDistanceToNow } from 'date-fns'

interface MessageListItemProps {
  message: {
    id: string
    senderId: string
    recipientId: string
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
    subject?: string
    body: string
    readAt?: string
    createdAt: string
  }
  isUnread: boolean
  onMarkAsRead?: () => void
}

export const MessageListItem: React.FC<MessageListItemProps> = ({
  message,
  isUnread,
  onMarkAsRead,
}) => {
  const otherUser = message.sender?.username ? message.sender : message.recipient
  const avatar = otherUser?.avatarUrl
  const timeAgo = formatDistanceToNow(new Date(message.createdAt), {
    addSuffix: true,
  })

  // Extract subject or use body preview
  const title = message.subject || message.body.substring(0, 50)
  const preview =
    message.subject && message.body ? message.body.substring(0, 80) : ''

  return (
    <div className="flex-1">
      {/* Header: From/To and Time */}
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <span
          className={`text-sm ${
            isUnread
              ? 'font-bold text-gray-900 dark:text-white'
              : 'font-medium text-gray-700 dark:text-gray-300'
          }`}
        >
          {otherUser?.username || 'Unknown'}
        </span>
        <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
          {timeAgo}
        </span>
      </div>

      {/* Subject */}
      <div
        className={`text-sm mb-1 truncate ${
          isUnread
            ? 'font-bold text-gray-900 dark:text-white'
            : 'font-medium text-gray-700 dark:text-gray-300'
        }`}
      >
        {title}
      </div>

      {/* Preview */}
      {preview && (
        <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
          {preview}
        </p>
      )}

      {/* Unread Indicator */}
      {isUnread && (
        <div className="mt-1 flex items-center gap-2">
          <span className="inline-block w-2 h-2 bg-blue-600 rounded-full"></span>
          <span className="text-xs text-blue-600 dark:text-blue-400">Unread</span>
        </div>
      )}
    </div>
  )
}
```

**Explanation:**
- Displays sender/recipient, subject, and body preview
- Shows unread indicator (blue dot + "Unread" label)
- Bold text for unread messages
- Relative timestamps (e.g., "2 hours ago")
- Responsive layout with truncation

---

### Step 4: Create Context Badge Component

Create badge to show linked artwork/gallery context.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/messages/ContextBadge.tsx`

```typescript
import React from 'react'
import { useNavigate } from 'react-router-dom'

interface ContextBadgeProps {
  context: {
    type: string
    id: string
    title?: string
    slug?: string
    thumbnailUrl?: string
    url?: string
  }
}

export const ContextBadge: React.FC<ContextBadgeProps> = ({ context }) => {
  const navigate = useNavigate()

  const contextTypeLabel = {
    artwork: 'Artwork',
    gallery: 'Gallery',
    collection: 'Collection',
    artist: 'Artist',
  }[context.type] || 'Item'

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (context.url) {
      navigate(context.url)
    }
  }

  return (
    <div
      onClick={handleClick}
      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors cursor-pointer group"
    >
      {context.thumbnailUrl && (
        <img
          src={context.thumbnailUrl}
          alt={context.title}
          className="w-6 h-6 rounded object-cover"
        />
      )}
      <div className="flex flex-col">
        <span className="text-xs text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-300">
          {contextTypeLabel}
        </span>
        <span className="text-xs font-medium text-gray-900 dark:text-white truncate max-w-[100px]">
          {context.title || context.slug || 'Untitled'}
        </span>
      </div>
    </div>
  )
}
```

**Explanation:**
- Displays context type (Artwork, Gallery, etc.)
- Shows thumbnail if available
- Links to context item on click
- Prevents navigation when clicking message item

---

### Step 5: Create Message Compose FAB

Create floating action button for quick message composition.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/messages/MessageComposeFab.tsx`

```typescript
import React from 'react'
import { useNavigate } from 'react-router-dom'

export const MessageComposeFab: React.FC = () => {
  const navigate = useNavigate()

  return (
    <button
      onClick={() => navigate('/profile/messages/compose')}
      className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 hover:shadow-xl transition-all flex items-center justify-center"
      aria-label="New message"
      title="New message"
    >
      <svg
        className="w-6 h-6"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 4v16m8-8H4"
        />
      </svg>
    </button>
  )
}
```

**Explanation:**
- Fixed position button in bottom-right corner
- Opens compose form when clicked
- Visible on all message pages

---

### Step 6: Create Unread Count Hook

Create hook to track unread message count for UI badges.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/hooks/useUnreadMessageCount.ts`

```typescript
import { useState, useEffect } from 'react'
import { apiClient } from '../lib/api'

export function useUnreadMessageCount() {
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)

  const fetchUnreadCount = async () => {
    try {
      setLoading(true)
      const response = await apiClient.get('/api/messages/unread-count')
      if (response.success && response.data) {
        setUnreadCount(response.data.unreadCount || 0)
      }
    } catch (error) {
      console.error('Failed to fetch unread count:', error)
    } finally {
      setLoading(false)
    }
  }

  // Fetch on mount
  useEffect(() => {
    fetchUnreadCount()

    // Poll every 30 seconds for new messages
    const interval = setInterval(fetchUnreadCount, 30000)
    return () => clearInterval(interval)
  }, [])

  return { unreadCount, loading, refetch: fetchUnreadCount }
}
```

**Explanation:**
- Provides unread count for UI badges
- Polls API every 30 seconds for updates
- Can be manually refreshed
- Used in navigation and message lists

---

### Step 7: Add Route

Update the routing to include the messages page.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/App.tsx`

Add this route in your profile routes section:

```typescript
import { MessagesPage } from './pages/profile/Messages'

// In your route configuration:
{
  path: '/profile/messages',
  element: <MessagesPage />,
  requiresAuth: true,
}
```

---

## Files to Create/Modify

### Create:
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/pages/profile/Messages.tsx`
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/messages/MessageList.tsx`
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/messages/MessageListItem.tsx`
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/messages/ContextBadge.tsx`
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/messages/MessageComposeFab.tsx`
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/hooks/useUnreadMessageCount.ts`

### Modify:
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/App.tsx` - Add route for `/profile/messages`
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/layout/Navigation.tsx` - Add unread count badge to messages nav

---

## Verification

### 1. Navigate to Messages Page

Visit http://localhost:5173/profile/messages (when authenticated)

Should see:
- Page title "Messages"
- Inbox/Sent tabs
- "New Message" button
- Empty state if no messages

### 2. Test Tab Switching

Click Inbox and Sent tabs.

Should show appropriate messages and update URL query param.

### 3. Test Message List Display

After sending test messages, verify:
- Sender/recipient usernames appear
- Bold text for unread messages
- Blue dot indicator for unread
- Timestamps show relative time ("2 hours ago")
- Message preview shows (first 80 chars of body)

### 4. Test Context Badges

Send a message with context (artwork/gallery) and verify:
- Badge appears with thumbnail
- Label shows context type
- Badge links to context item on click

### 5. Test Pagination

Create >20 messages and verify:
- Pagination controls appear
- Clicking next/prev loads different pages
- Page count is correct

### 6. Test Mark as Read

Click on unread message.

Verify:
- Message appears as read in list
- Blue indicator disappears
- Bold text removed

### 7. Test Bulk Delete

Check multiple messages and click Delete.

Verify:
- Confirmation dialog appears
- Messages removed after confirmation
- Toolbar updates selection count

### 8. Test Responsive Design

View on mobile (375px width) and tablet (768px).

Verify:
- Layout adapts properly
- Context badges hide/show appropriately
- Touch targets are adequate (40px+)

### 9. Test Unread Count Badge

Check navigation header for unread count.

Verify:
- Count updates after sending new message
- Count decreases when marking as read

### 10. Test FAB

Verify floating action button:
- Appears in bottom-right
- Opens compose on click
- Visible on mobile

---

## Success Criteria

- [x] `/profile/messages` page loads for authenticated users
- [x] Inbox and Sent tabs work correctly
- [x] Messages display with sender/recipient, subject, preview
- [x] Unread messages show bold text and blue indicator
- [x] Context badges show related artwork/gallery with thumbnail
- [x] Pagination supports large message lists
- [x] Mark as read removes unread indicator
- [x] Bulk delete works with confirmation
- [x] Responsive design works on mobile and desktop
- [x] Unread count badge appears in navigation
- [x] FAB opens compose form
- [x] Relative timestamps display correctly
