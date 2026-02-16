import { useState, useEffect, useCallback } from 'react'
import { useToast } from '../../contexts/ToastContext'
import {
  Mail,
  CheckCircle,
  XCircle,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
} from 'lucide-react'

interface PendingMessage {
  id: string
  senderUserId: string | null
  senderUsername: string | null
  senderEmail: string | null
  recipientUserId: string | null
  recipientUsername: string | null
  recipientEmail: string | null
  subject: string | null
  body: string
  status: string
  toneScore: number | null
  flaggedReason: string | null
  contextType: string | null
  contextId: string | null
  contextTitle: string | null
  reviewedBy: string | null
  reviewedAt: string | null
  createdAt: string
}

interface Pagination {
  page: number
  limit: number
  total: number
  pages: number
}

export default function AdminModeration() {
  const { error: toastError, success: toastSuccess } = useToast()

  const [messages, setMessages] = useState<PendingMessage[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, pages: 0 })
  const [loading, setLoading] = useState(true)
  const [flaggedOnly, setFlaggedOnly] = useState(false)
  const [sortBy, setSortBy] = useState<'created_at' | 'tone_score'>('created_at')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [actioningId, setActioningId] = useState<string | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const fetchMessages = useCallback(async (page = 1) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        flagged_only: flaggedOnly.toString(),
        sort_by: sortBy,
      })

      const res = await fetch(`/api/admin/messages/pending?${params}`, {
        credentials: 'include',
      })

      if (!res.ok) throw new Error('Failed to load messages')

      const json = await res.json()
      setMessages(json.data.messages)
      setPagination(json.data.pagination)
    } catch (err: any) {
      toastError(err.message || 'Failed to load moderation queue')
    } finally {
      setLoading(false)
    }
  }, [flaggedOnly, sortBy, toastError])

  useEffect(() => {
    fetchMessages(1)
  }, [fetchMessages])

  const handleApprove = async (messageId: string) => {
    if (!confirm('Approve this message for delivery?')) return

    setActioningId(messageId)
    try {
      const res = await fetch(`/api/admin/messages/${messageId}/approve`, {
        method: 'POST',
        credentials: 'include',
      })

      if (!res.ok) throw new Error('Failed to approve message')

      toastSuccess('Message approved')
      fetchMessages(pagination.page)
    } catch (err: any) {
      toastError(err.message || 'Failed to approve message')
    } finally {
      setActioningId(null)
    }
  }

  const handleReject = async (messageId: string) => {
    setActioningId(messageId)
    try {
      const res = await fetch(`/api/admin/messages/${messageId}/reject`, {
        method: 'POST',
        credentials: 'include',
        headers: rejectReason ? { 'Content-Type': 'application/json' } : {},
        body: rejectReason ? JSON.stringify({ reason: rejectReason }) : undefined,
      })

      if (!res.ok) throw new Error('Failed to reject message')

      toastSuccess('Message rejected')
      setRejectingId(null)
      setRejectReason('')
      fetchMessages(pagination.page)
    } catch (err: any) {
      toastError(err.message || 'Failed to reject message')
    } finally {
      setActioningId(null)
    }
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  function getToneColor(score: number | null): string {
    if (score === null) return 'bg-gray-100 text-gray-600'
    if (score >= 0.7) return 'bg-red-100 text-red-700'
    if (score >= 0.4) return 'bg-yellow-100 text-yellow-700'
    return 'bg-green-100 text-green-700'
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-1">Message Moderation</h1>
        <p className="text-gray-600">
          {pagination.total} pending message{pagination.total !== 1 ? 's' : ''} to review
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-4 mb-6">
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={flaggedOnly}
            onChange={(e) => setFlaggedOnly(e.target.checked)}
            className="rounded border-gray-300"
          />
          Flagged only
        </label>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as 'created_at' | 'tone_score')}
          className="px-3 py-1.5 border border-gray-300 rounded-md text-sm text-gray-700"
        >
          <option value="created_at">Sort by Date</option>
          <option value="tone_score">Sort by Tone Score</option>
        </select>
      </div>

      {/* Loading */}
      {loading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-lg border border-gray-200 p-4 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/3 mb-3" />
              <div className="h-3 bg-gray-200 rounded w-1/4 mb-2" />
              <div className="h-3 bg-gray-200 rounded w-2/3" />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && messages.length === 0 && (
        <div className="bg-white rounded-lg border border-dashed border-gray-300 p-12 text-center">
          <Mail className="mx-auto h-12 w-12 text-gray-300 mb-3" />
          <p className="text-gray-500 text-lg">No pending messages to review</p>
          <p className="text-gray-400 text-sm mt-1">Messages requiring moderation will appear here</p>
        </div>
      )}

      {/* Message cards */}
      {!loading && messages.length > 0 && (
        <div className="space-y-3">
          {messages.map((msg) => {
            const isExpanded = expandedId === msg.id
            const isActioning = actioningId === msg.id
            const isRejecting = rejectingId === msg.id

            return (
              <div key={msg.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                {/* Header row */}
                <div
                  className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : msg.id)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <h3 className="font-semibold text-gray-900 truncate">
                          {msg.subject || '(No subject)'}
                        </h3>
                        {msg.toneScore !== null && (
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${getToneColor(msg.toneScore)}`}>
                            Tone: {(msg.toneScore * 100).toFixed(0)}%
                          </span>
                        )}
                        {msg.flaggedReason && (
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700 flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            Flagged
                          </span>
                        )}
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-gray-400 flex-shrink-0" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />
                        )}
                      </div>

                      <p className="text-sm text-gray-600 mb-1">
                        From: <span className="font-medium">{msg.senderUsername || msg.senderEmail || 'Unknown'}</span>
                        {' → '}
                        <span className="font-medium">{msg.recipientUsername || msg.recipientEmail || 'Unknown'}</span>
                      </p>

                      <p className="text-sm text-gray-500 line-clamp-2">
                        {msg.body.length > 150 ? msg.body.substring(0, 150) + '...' : msg.body}
                      </p>

                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                        {msg.contextType && msg.contextTitle && (
                          <span className="capitalize">{msg.contextType}: {msg.contextTitle}</span>
                        )}
                        <span>{formatDate(msg.createdAt)}</span>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleApprove(msg.id)}
                        disabled={isActioning}
                        className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors"
                      >
                        <CheckCircle className="h-4 w-4" />
                        Approve
                      </button>
                      <button
                        onClick={() => {
                          if (isRejecting) {
                            setRejectingId(null)
                            setRejectReason('')
                          } else {
                            setRejectingId(msg.id)
                          }
                        }}
                        disabled={isActioning}
                        className="flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 disabled:opacity-50 transition-colors"
                      >
                        <XCircle className="h-4 w-4" />
                        Reject
                      </button>
                    </div>
                  </div>
                </div>

                {/* Reject reason inline form */}
                {isRejecting && (
                  <div className="px-4 pb-4 border-t border-gray-100 bg-red-50">
                    <div className="pt-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Rejection reason (optional)
                      </label>
                      <textarea
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder="Enter reason for rejection..."
                        maxLength={1000}
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm resize-none"
                      />
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-gray-400">{rejectReason.length}/1000</span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => { setRejectingId(null); setRejectReason('') }}
                            className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleReject(msg.id)}
                            disabled={isActioning}
                            className="px-3 py-1.5 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 disabled:opacity-50"
                          >
                            Confirm Reject
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Expanded view */}
                {isExpanded && (
                  <div className="border-t border-gray-200 p-4 bg-gray-50">
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">Full Message</h4>
                    <div className="bg-white p-3 rounded-md border border-gray-200 text-sm text-gray-700 whitespace-pre-wrap mb-3">
                      {msg.body}
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                      <div>
                        <span className="font-medium">Sender:</span> {msg.senderUsername || msg.senderEmail || 'Unknown'}
                        {msg.senderEmail && msg.senderUsername && (
                          <span className="text-gray-400 ml-1">({msg.senderEmail})</span>
                        )}
                      </div>
                      <div>
                        <span className="font-medium">Recipient:</span> {msg.recipientUsername || msg.recipientEmail || 'Unknown'}
                        {msg.recipientEmail && msg.recipientUsername && (
                          <span className="text-gray-400 ml-1">({msg.recipientEmail})</span>
                        )}
                      </div>
                      {msg.flaggedReason && (
                        <div className="col-span-2">
                          <span className="font-medium">Flag reason:</span> {msg.flaggedReason}
                        </div>
                      )}
                      {msg.contextType && (
                        <div>
                          <span className="font-medium">Context:</span>{' '}
                          <span className="capitalize">{msg.contextType}</span>
                          {msg.contextTitle && `: ${msg.contextTitle}`}
                        </div>
                      )}
                      <div>
                        <span className="font-medium">Sent:</span> {formatDate(msg.createdAt)}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {!loading && pagination.pages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <span className="text-sm text-gray-600">
            Page {pagination.page} of {pagination.pages} ({pagination.total} total)
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => fetchMessages(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="flex items-center gap-1 px-3 py-1.5 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </button>
            <button
              onClick={() => fetchMessages(pagination.page + 1)}
              disabled={pagination.page >= pagination.pages}
              className="flex items-center gap-1 px-3 py-1.5 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
