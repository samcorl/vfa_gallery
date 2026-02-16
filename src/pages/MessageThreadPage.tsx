import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import Avatar from '../components/ui/Avatar'
import { ArrowLeft, Trash2, Send, AlertCircle } from 'lucide-react'

interface User {
  id: string
  username: string
  displayName: string | null
  avatarUrl: string | null
}

interface MessageContext {
  type: string
  id: string
  title: string
  slug: string
}

interface Message {
  id: string
  senderId: string
  recipientId: string
  subject: string
  body: string
  status: string
  readAt: string | null
  createdAt: string
  sender: User
  recipient: User
  context: MessageContext | null
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}

function getContextUrl(context: MessageContext): string {
  const { type, slug } = context
  const typeToPath: Record<string, string> = {
    artwork: '/artwork',
    gallery: '/gallery',
    collection: '/collection',
    artist: '/artist',
  }
  const basePath = typeToPath[type.toLowerCase()] || `/${type.toLowerCase()}`
  return `${basePath}/${slug}`
}

export default function MessageThreadPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const { user, isAuthenticated, isLoading: authLoading } = useAuth()

  const [message, setMessage] = useState<Message | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)

  const [replyBody, setReplyBody] = useState('')
  const [replySending, setReplySending] = useState(false)
  const [replyError, setReplyError] = useState<string | null>(null)
  const [replySuccess, setReplySuccess] = useState(false)

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/auth/login')
    }
  }, [authLoading, isAuthenticated, navigate])

  useEffect(() => {
    if (!user || !id) return

    const fetchMessage = async () => {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch(`/api/messages/${id}`, {
          credentials: 'include',
        })

        if (response.status === 404) {
          setNotFound(true)
          setLoading(false)
          return
        }

        if (!response.ok) {
          throw new Error('Failed to fetch message')
        }

        const data = await response.json()
        setMessage(data)

        // Mark as read if user is recipient and not already read
        if (user.id === data.recipientId && !data.readAt) {
          fetch(`/api/messages/${id}/read`, {
            method: 'PATCH',
            credentials: 'include',
          }).catch(() => {})
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch message')
      } finally {
        setLoading(false)
      }
    }

    fetchMessage()
  }, [id, user])

  const handleDelete = async () => {
    if (!id) return

    setDeleting(true)
    try {
      const response = await fetch(`/api/messages/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to delete message')
      }

      navigate('/profile/messages')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete message')
      setShowDeleteConfirm(false)
      setDeleting(false)
    }
  }

  const handleSendReply = async () => {
    if (!replyBody.trim() || !message) return

    setReplySending(true)
    setReplyError(null)

    try {
      const otherUserId = user?.id === message.senderId ? message.recipientId : message.senderId

      const response = await fetch('/api/messages', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipientId: otherUserId,
          body: replyBody.trim(),
          subject: message.subject ? `Re: ${message.subject}` : undefined,
          contextType: message.context?.type,
          contextId: message.context?.id,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to send reply')
      }

      const newMessage = await response.json()
      setReplyBody('')
      setReplySuccess(true)
      setTimeout(() => setReplySuccess(false), 2000)

      // Navigate to the new message
      setTimeout(() => {
        navigate(`/profile/messages/${newMessage.id}`)
      }, 1000)
    } catch (err) {
      setReplyError(err instanceof Error ? err.message : 'Failed to send reply')
    } finally {
      setReplySending(false)
    }
  }

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin border-4 border-gray-200 border-t-gray-800 rounded-full w-8 h-8" />
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <button
          onClick={() => navigate('/profile/messages')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to messages
        </button>
        <div className="text-center py-16">
          <p className="text-lg text-gray-600 mb-4">Message not found</p>
          <button
            onClick={() => navigate('/profile/messages')}
            className="px-4 py-2 bg-gray-800 text-white rounded hover:bg-gray-900 transition"
          >
            Return to Messages
          </button>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin border-4 border-gray-200 border-t-gray-800 rounded-full w-8 h-8" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <button
          onClick={() => navigate('/profile/messages')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to messages
        </button>
        <div className="p-4 bg-red-50 border border-red-200 rounded flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    )
  }

  if (!message) {
    return null
  }

  const otherUser = user?.id === message.senderId ? message.recipient : message.sender

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <button
          onClick={() => navigate('/profile/messages')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to messages
        </button>
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="flex items-center gap-2 px-3 py-2 text-gray-500 hover:text-red-600 transition"
        >
          <Trash2 className="w-4 h-4" />
          <span className="text-sm">Delete</span>
        </button>
      </div>

      <h1 className="text-2xl font-bold text-gray-900 mb-8">
        {otherUser?.displayName || otherUser?.username}
      </h1>

      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-8">
        {message.subject && (
          <div className="pb-4 mb-4 border-b border-gray-300">
            <h2 className="text-lg font-semibold text-gray-900">{message.subject}</h2>
          </div>
        )}

        <div className="flex items-center gap-4 mb-6">
          <Avatar
            src={otherUser?.avatarUrl || null}
            name={otherUser?.displayName || otherUser?.username || 'User'}
            size="md"
          />
          <div>
            <p className="font-semibold text-gray-900">
              {otherUser?.displayName || otherUser?.username}
            </p>
            <p className="text-sm text-gray-500">@{otherUser?.username}</p>
            <p className="text-xs text-gray-500 mt-1">{timeAgo(message.createdAt)}</p>
          </div>
        </div>

        <div className="prose prose-sm max-w-none text-gray-700">
          <p className="whitespace-pre-wrap">{message.body}</p>
        </div>
      </div>

      {message.context && (
        <div className="bg-gray-100 border border-gray-300 rounded-lg p-4 mb-8">
          <p className="text-xs font-semibold text-gray-700 uppercase mb-2">
            {message.context.type}
          </p>
          <button
            onClick={() => navigate(getContextUrl(message.context!))}
            className="text-sm font-medium text-gray-900 hover:text-gray-700 transition"
          >
            {message.context.title}
          </button>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-8">
          <p className="text-red-900 font-semibold mb-4">Delete this message?</p>
          <div className="flex gap-3">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 transition"
            >
              {deleting ? 'Deleting...' : 'Confirm Delete'}
            </button>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              disabled={deleting}
              className="px-4 py-2 bg-gray-300 text-gray-900 rounded hover:bg-gray-400 disabled:opacity-50 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="mt-12 pt-8 border-t border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">Reply</h3>

        {replyError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
            <p className="text-sm text-red-600">{replyError}</p>
          </div>
        )}

        {replySuccess && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded">
            <p className="text-sm text-green-600">Reply sent!</p>
          </div>
        )}

        <textarea
          value={replyBody}
          onChange={(e) => setReplyBody(e.target.value.slice(0, 10000))}
          placeholder="Write your reply..."
          rows={4}
          maxLength={10000}
          className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gray-800 focus:border-transparent resize-none mb-4"
        />

        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">
            {replyBody.length}/10000
          </span>
          <button
            onClick={handleSendReply}
            disabled={replySending || !replyBody.trim()}
            className="flex items-center gap-2 px-6 py-2 bg-gray-800 text-white rounded hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            <Send className="w-4 h-4" />
            {replySending ? 'Sending...' : 'Send Reply'}
          </button>
        </div>
      </div>
    </div>
  )
}
