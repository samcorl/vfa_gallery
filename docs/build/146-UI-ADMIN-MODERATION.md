# 146-UI-ADMIN-MODERATION.md

## Goal

Create the moderation queue page (`/admin/moderation`) with a list of pending messages for review. Display sender/recipient info, subject, preview, tone score badge, context links, and approve/reject action buttons with confirmation modals.

---

## Spec Extract

From TECHNICAL-SPEC.md - Admin Tools & Moderation:

- **Route:** `/admin/moderation`
- **Access:** Admin users only
- **Display Elements:**
  - List of pending messages
  - Sender name and avatar
  - Recipient name
  - Subject and body preview
  - Tone score badge (color-coded)
  - Context link (artwork/gallery name)
  - Timestamp
  - Approve and Reject buttons
- **Interactions:**
  - Click to expand full message body
  - Approve with confirmation modal
  - Reject with reason input and confirmation
  - Real-time list refresh after action
  - Filters: flagged only, sort by tone/date

---

## Prerequisites

**Must complete before starting:**
- **143-API-ADMIN-MESSAGES-PENDING.md** - Pending messages endpoint
- **144-API-ADMIN-MESSAGES-APPROVE.md** - Approve endpoint
- **145-API-ADMIN-MESSAGES-REJECT.md** - Reject endpoint
- **136-UI-ADMIN-DASHBOARD.md** - Admin layout/nav
- **27-REACT-LAYOUT-SHELL.md** - App shell layout

---

## Steps

### Step 1: Create Moderation Page Component

Create the main moderation queue page.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/pages/admin/Moderation.tsx`

```typescript
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../hooks/useToast'
import ModerationList from '../../components/admin/ModerationList'
import ModerationFilters from '../../components/admin/ModerationFilters'

interface PendingMessage {
  id: string
  senderUsername: string | null
  senderEmail: string | null
  recipientUsername: string | null
  recipientEmail: string | null
  subject: string | null
  body: string
  toneScore: number | null
  flaggedReason: string | null
  contextType: string | null
  contextId: string | null
  contextTitle: string | null
  createdAt: string
}

export default function ModerationPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { toast } = useToast()

  const [messages, setMessages] = useState<PendingMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(0)
  const [flaggedOnly, setFlaggedOnly] = useState(false)
  const [sortBy, setSortBy] = useState<'created_at' | 'tone_score'>('created_at')

  // Redirect non-admin users
  useEffect(() => {
    if (user && user.role !== 'admin') {
      navigate('/')
    }
  }, [user, navigate])

  // Load pending messages
  useEffect(() => {
    loadMessages()
  }, [page, flaggedOnly, sortBy])

  const loadMessages = async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        flagged_only: flaggedOnly.toString(),
        sort_by: sortBy,
      })

      const response = await fetch(
        `/api/admin/messages/pending?${params.toString()}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          },
        }
      )

      if (!response.ok) {
        throw new Error(`Failed to load messages: ${response.status}`)
      }

      const data = await response.json()
      setMessages(data.data.messages)
      setTotal(data.data.pagination.total)
      setPages(data.data.pagination.pages)
    } catch (err: any) {
      setError(err.message || 'Failed to load moderation queue')
      toast({
        type: 'error',
        message: 'Failed to load moderation queue',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleFilterChange = (
    newFlaggedOnly: boolean,
    newSortBy: 'created_at' | 'tone_score'
  ) => {
    setFlaggedOnly(newFlaggedOnly)
    setSortBy(newSortBy)
    setPage(1)
  }

  const handleMessageAction = () => {
    // Refresh the list after approve/reject
    loadMessages()
  }

  if (!user || user.role !== 'admin') {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Message Moderation</h1>
          <p className="mt-2 text-gray-600">
            Review {total} pending messages · Sort by {sortBy === 'tone_score' ? 'Tone Score' : 'Date'}
            {flaggedOnly && ' · Flagged Only'}
          </p>
        </div>

        {/* Filters */}
        <ModerationFilters
          flaggedOnly={flaggedOnly}
          sortBy={sortBy}
          onFilterChange={handleFilterChange}
        />

        {/* Error State */}
        {error && (
          <div className="rounded-md bg-red-50 p-4 mb-6">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-blue-600" />
          </div>
        )}

        {/* Empty State */}
        {!loading && messages.length === 0 && (
          <div className="rounded-lg border border-dashed border-gray-300 p-12 text-center">
            <p className="text-gray-600">No pending messages to review</p>
          </div>
        )}

        {/* Messages List */}
        {!loading && messages.length > 0 && (
          <ModerationList
            messages={messages}
            onMessageAction={handleMessageAction}
          />
        )}

        {/* Pagination */}
        {!loading && pages > 1 && (
          <div className="mt-8 flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Page {page} of {pages} ({total} total)
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(p => Math.min(pages, p + 1))}
                disabled={page === pages}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
```

---

### Step 2: Create Moderation List Component

Create the list component displaying messages.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/admin/ModerationList.tsx`

```typescript
import { useState } from 'react'
import ModerationListItem from './ModerationListItem'

interface PendingMessage {
  id: string
  senderUsername: string | null
  senderEmail: string | null
  recipientUsername: string | null
  recipientEmail: string | null
  subject: string | null
  body: string
  toneScore: number | null
  flaggedReason: string | null
  contextType: string | null
  contextId: string | null
  contextTitle: string | null
  createdAt: string
}

interface ModerationListProps {
  messages: PendingMessage[]
  onMessageAction: () => void
}

export default function ModerationList({
  messages,
  onMessageAction,
}: ModerationListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  return (
    <div className="space-y-4">
      {messages.map((message) => (
        <ModerationListItem
          key={message.id}
          message={message}
          isExpanded={expandedId === message.id}
          onToggleExpand={() =>
            setExpandedId(expandedId === message.id ? null : message.id)
          }
          onAction={onMessageAction}
        />
      ))}
    </div>
  )
}
```

---

### Step 3: Create Moderation List Item Component

Create individual message display component.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/admin/ModerationListItem.tsx`

```typescript
import { useState } from 'react'
import { useToast } from '../../hooks/useToast'
import ApproveConfirmModal from './ApproveConfirmModal'
import RejectConfirmModal from './RejectConfirmModal'

interface PendingMessage {
  id: string
  senderUsername: string | null
  senderEmail: string | null
  recipientUsername: string | null
  recipientEmail: string | null
  subject: string | null
  body: string
  toneScore: number | null
  flaggedReason: string | null
  contextType: string | null
  contextId: string | null
  contextTitle: string | null
  createdAt: string
}

interface ModerationListItemProps {
  message: PendingMessage
  isExpanded: boolean
  onToggleExpand: () => void
  onAction: () => void
}

export default function ModerationListItem({
  message,
  isExpanded,
  onToggleExpand,
  onAction,
}: ModerationListItemProps) {
  const { toast } = useToast()
  const [approveModalOpen, setApproveModalOpen] = useState(false)
  const [rejectModalOpen, setRejectModalOpen] = useState(false)
  const [actioning, setActioning] = useState(false)

  const getToneScoreBadgeColor = (score: number | null) => {
    if (score === null) return 'gray'
    if (score >= 0.7) return 'red'
    if (score >= 0.4) return 'yellow'
    return 'green'
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const handleApprove = async () => {
    setActioning(true)
    try {
      const response = await fetch(
        `/api/admin/messages/${message.id}/approve`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          },
        }
      )

      if (!response.ok) {
        throw new Error('Failed to approve message')
      }

      toast({
        type: 'success',
        message: 'Message approved',
      })

      setApproveModalOpen(false)
      onAction()
    } catch (err: any) {
      toast({
        type: 'error',
        message: err.message || 'Failed to approve message',
      })
    } finally {
      setActioning(false)
    }
  }

  const handleReject = async (reason: string) => {
    setActioning(true)
    try {
      const response = await fetch(
        `/api/admin/messages/${message.id}/reject`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ reason: reason || undefined }),
        }
      )

      if (!response.ok) {
        throw new Error('Failed to reject message')
      }

      toast({
        type: 'success',
        message: 'Message rejected',
      })

      setRejectModalOpen(false)
      onAction()
    } catch (err: any) {
      toast({
        type: 'error',
        message: err.message || 'Failed to reject message',
      })
    } finally {
      setActioning(false)
    }
  }

  const colorClasses = {
    red: 'bg-red-100 text-red-800',
    yellow: 'bg-yellow-100 text-yellow-800',
    green: 'bg-green-100 text-green-800',
    gray: 'bg-gray-100 text-gray-800',
  }

  const toneColor = getToneScoreBadgeColor(message.toneScore)

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
      {/* Collapsed View */}
      <div
        onClick={onToggleExpand}
        className="p-4 cursor-pointer hover:bg-gray-50 transition"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-semibold text-gray-900 truncate">
                {message.subject || '(No subject)'}
              </h3>
              {message.toneScore !== null && (
                <span
                  className={`px-2 py-1 rounded text-xs font-medium ${
                    colorClasses[toneColor as keyof typeof colorClasses]
                  }`}
                >
                  Tone: {(message.toneScore * 100).toFixed(0)}%
                </span>
              )}
              {message.flaggedReason && (
                <span className="px-2 py-1 rounded text-xs font-medium bg-orange-100 text-orange-800">
                  Flagged
                </span>
              )}
            </div>

            <p className="text-sm text-gray-600 mb-2">
              <strong>From:</strong> {message.senderUsername || message.senderEmail || 'Unknown'}
            </p>

            <p className="text-sm text-gray-600 mb-2 line-clamp-2">
              {message.body.substring(0, 150)}...
            </p>

            <div className="flex items-center gap-4 text-xs text-gray-500">
              {message.contextType && message.contextTitle && (
                <span>
                  {message.contextType}: {message.contextTitle}
                </span>
              )}
              <span>{formatDate(message.createdAt)}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation()
                setApproveModalOpen(true)
              }}
              disabled={actioning}
              className="px-3 py-2 bg-green-600 text-white text-sm font-medium rounded hover:bg-green-700 disabled:opacity-50"
            >
              Approve
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                setRejectModalOpen(true)
              }}
              disabled={actioning}
              className="px-3 py-2 bg-red-600 text-white text-sm font-medium rounded hover:bg-red-700 disabled:opacity-50"
            >
              Reject
            </button>
          </div>
        </div>
      </div>

      {/* Expanded View */}
      {isExpanded && (
        <div className="border-t border-gray-200 p-4 bg-gray-50">
          <div className="mb-4">
            <h4 className="font-semibold text-gray-900 mb-2">Full Message</h4>
            <div className="bg-white p-3 rounded border border-gray-200 text-sm text-gray-700 whitespace-pre-wrap">
              {message.body}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-600">
                <strong>To:</strong> {message.recipientUsername || message.recipientEmail || 'Unknown'}
              </p>
            </div>
            {message.flaggedReason && (
              <div>
                <p className="text-gray-600">
                  <strong>Flag Reason:</strong> {message.flaggedReason}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      <ApproveConfirmModal
        isOpen={approveModalOpen}
        isLoading={actioning}
        onConfirm={handleApprove}
        onCancel={() => setApproveModalOpen(false)}
        subject={message.subject}
      />

      <RejectConfirmModal
        isOpen={rejectModalOpen}
        isLoading={actioning}
        onConfirm={handleReject}
        onCancel={() => setRejectModalOpen(false)}
        subject={message.subject}
      />
    </div>
  )
}
```

---

### Step 4: Create Moderation Filters Component

Create filters component.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/admin/ModerationFilters.tsx`

```typescript
interface ModerationFiltersProps {
  flaggedOnly: boolean
  sortBy: 'created_at' | 'tone_score'
  onFilterChange: (flaggedOnly: boolean, sortBy: 'created_at' | 'tone_score') => void
}

export default function ModerationFilters({
  flaggedOnly,
  sortBy,
  onFilterChange,
}: ModerationFiltersProps) {
  return (
    <div className="mb-6 flex gap-4 flex-wrap items-center">
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={flaggedOnly}
          onChange={(e) => onFilterChange(e.target.checked, sortBy)}
          className="rounded border-gray-300"
        />
        <span className="text-sm text-gray-700">Flagged Messages Only</span>
      </label>

      <select
        value={sortBy}
        onChange={(e) =>
          onFilterChange(flaggedOnly, e.target.value as 'created_at' | 'tone_score')
        }
        className="px-3 py-2 border border-gray-300 rounded text-sm"
      >
        <option value="created_at">Sort by Date (Newest)</option>
        <option value="tone_score">Sort by Tone Score (Highest)</option>
      </select>
    </div>
  )
}
```

---

### Step 5: Create Confirm Modals

Create confirmation modals.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/admin/ApproveConfirmModal.tsx`

```typescript
interface ApproveConfirmModalProps {
  isOpen: boolean
  isLoading: boolean
  onConfirm: () => void
  onCancel: () => void
  subject?: string | null
}

export default function ApproveConfirmModal({
  isOpen,
  isLoading,
  onConfirm,
  onCancel,
  subject,
}: ApproveConfirmModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-sm">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Approve Message?
        </h3>
        <p className="text-gray-600 mb-6">
          Approving will allow this message to be delivered to the recipient.
          {subject && <p className="mt-2 text-sm"><strong>Subject:</strong> {subject}</p>}
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 px-4 py-2 border border-gray-300 rounded text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 px-4 py-2 bg-green-600 text-white rounded font-medium hover:bg-green-700 disabled:opacity-50"
          >
            {isLoading ? 'Approving...' : 'Approve'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/admin/RejectConfirmModal.tsx`

```typescript
import { useState } from 'react'

interface RejectConfirmModalProps {
  isOpen: boolean
  isLoading: boolean
  onConfirm: (reason: string) => void
  onCancel: () => void
  subject?: string | null
}

export default function RejectConfirmModal({
  isOpen,
  isLoading,
  onConfirm,
  onCancel,
  subject,
}: RejectConfirmModalProps) {
  const [reason, setReason] = useState('')

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-sm">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Reject Message?
        </h3>
        <p className="text-gray-600 mb-4">
          Rejecting will prevent this message from being delivered.
          {subject && <p className="mt-2 text-sm"><strong>Subject:</strong> {subject}</p>}
        </p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Optional rejection reason..."
          maxLength={1000}
          className="w-full px-3 py-2 border border-gray-300 rounded mb-4 text-sm resize-none"
          rows={3}
        />
        <p className="text-xs text-gray-500 mb-4">{reason.length}/1000 characters</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 px-4 py-2 border border-gray-300 rounded text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(reason)}
            disabled={isLoading}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded font-medium hover:bg-red-700 disabled:opacity-50"
          >
            {isLoading ? 'Rejecting...' : 'Reject'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

---

### Step 6: Add Route to Router

Add route to main router.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/routes.tsx`

Add this import:

```typescript
import ModerationPage from '../pages/admin/Moderation'
```

Add this route in admin routes group:

```typescript
{
  path: '/admin/moderation',
  element: <ModerationPage />,
}
```

---

## Files to Create/Modify

**New files to create:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/pages/admin/Moderation.tsx`
2. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/admin/ModerationList.tsx`
3. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/admin/ModerationListItem.tsx`
4. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/admin/ModerationFilters.tsx`
5. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/admin/ApproveConfirmModal.tsx`
6. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/admin/RejectConfirmModal.tsx`

**Files to modify:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/routes.tsx` - Add moderation route

---

## Verification

### Test 1: TypeScript Compilation

```bash
cd /Volumes/DataSSD/gitsrc/vfa_gallery
npx tsc --noEmit
```

Expected: No type errors

---

### Test 2: Access Without Authentication

Navigate to `http://localhost:5173/admin/moderation`

Expected: Redirect to login

---

### Test 3: Access as Non-Admin

1. Log in as regular user
2. Navigate to `/admin/moderation`

Expected: Redirect to home page

---

### Test 4: Access as Admin

1. Log in as admin user
2. Navigate to `/admin/moderation`

Expected: Page loads with moderation queue

---

### Test 5: Display Pending Messages

1. Create multiple pending messages in database
2. Verify page displays all messages
3. Verify each message shows:
   - Subject
   - Sender name
   - Message preview
   - Tone score badge
   - Timestamp

---

### Test 6: Expand Message

1. Click on a message
2. Verify full message body displays
3. Click again to collapse

---

### Test 7: Approve Message

1. Click Approve button
2. Verify confirmation modal appears with subject
3. Click Confirm
4. Verify success toast
5. Verify message removed from list or marked as approved

---

### Test 8: Reject Message

1. Click Reject button
2. Verify confirmation modal appears
3. Enter rejection reason (optional)
4. Click Confirm
5. Verify success toast
6. Verify message removed from list

---

### Test 9: Filters

1. Check "Flagged Only"
2. Verify only flagged messages display
3. Change sort to "Tone Score"
4. Verify messages sorted by tone (highest first)

---

### Test 10: Pagination

1. Create 25+ pending messages
2. Verify pagination controls appear
3. Verify page changes work correctly

---

## Success Criteria

- [ ] Page requires admin authentication
- [ ] Non-admins redirected to home
- [ ] Page displays pending messages
- [ ] Each message shows sender, subject, preview
- [ ] Tone score badge displays and colors correctly
- [ ] Can expand message to see full body
- [ ] Approve button opens confirmation modal
- [ ] Reject button opens confirmation modal with reason input
- [ ] Approve removes message from list after action
- [ ] Reject removes message from list after action
- [ ] Filters work (flagged only, sort by)
- [ ] Pagination works with 20 items per page
- [ ] Success toasts show after approve/reject
- [ ] Error toasts show on failures

---

## Next Steps

Once this build is verified, proceed to **156-ADS-SLOT-COMPONENT.md** for ad integration features.
