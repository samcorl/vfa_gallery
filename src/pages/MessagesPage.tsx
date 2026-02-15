import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import Avatar from '../components/ui/Avatar'
import Pagination from '../components/ui/Pagination'
import { Mail, Plus, AlertCircle } from 'lucide-react'

interface Message {
  id: string
  senderId: string
  recipientId: string
  subject: string
  body: string
  status: string
  readAt: string | null
  createdAt: string
  sender: {
    id: string
    username: string
    displayName: string | null
    avatarUrl: string | null
  }
  recipient: {
    id: string
    username: string
    displayName: string | null
    avatarUrl: string | null
  }
}

interface MessageResponse {
  data: Message[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
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

export default function MessagesPage() {
  const navigate = useNavigate()
  const { user, isAuthenticated, isLoading: authLoading } = useAuth()
  const [activeTab, setActiveTab] = useState<'inbox' | 'sent'>('inbox')
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/auth/login')
    }
  }, [authLoading, isAuthenticated, navigate])

  useEffect(() => {
    if (!user) return

    const fetchMessages = async () => {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch(
          `/api/messages?folder=${activeTab}&page=${page}&pageSize=20`,
          {
            credentials: 'include',
          }
        )

        if (!response.ok) {
          throw new Error('Failed to fetch messages')
        }

        const data: MessageResponse = await response.json()
        setMessages(data.data)
        setTotalPages(data.pagination.totalPages)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch messages')
      } finally {
        setLoading(false)
      }
    }

    fetchMessages()
  }, [activeTab, page, user])

  const handlePageChange = (newPage: number) => {
    setPage(newPage)
  }

  const handleMessageClick = (messageId: string) => {
    navigate(`/profile/messages/${messageId}`)
  }

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin border-4 border-gray-200 border-t-gray-800 rounded-full w-8 h-8" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Messages</h1>
        <button
          onClick={() => navigate('/profile/messages/compose')}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded hover:bg-gray-900 transition"
        >
          <Plus className="w-4 h-4" />
          New Message
        </button>
      </div>

      <div className="border-b border-gray-200 mb-6">
        <div className="flex gap-8">
          <button
            onClick={() => {
              setActiveTab('inbox')
              setPage(1)
            }}
            className={`pb-3 text-sm font-medium transition ${
              activeTab === 'inbox'
                ? 'border-b-2 border-gray-800 font-semibold text-gray-900'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Inbox
          </button>
          <button
            onClick={() => {
              setActiveTab('sent')
              setPage(1)
            }}
            className={`pb-3 text-sm font-medium transition ${
              activeTab === 'sent'
                ? 'border-b-2 border-gray-800 font-semibold text-gray-900'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Sent
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-red-600">{error}</p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="text-red-600 hover:text-red-700 underline text-sm"
          >
            Retry
          </button>
        </div>
      )}

      {loading && !messages.length && (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin border-4 border-gray-200 border-t-gray-800 rounded-full w-8 h-8" />
        </div>
      )}

      {!loading && messages.length === 0 && (
        <div className="text-center py-16">
          <Mail className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 mb-2">No messages yet</h2>
          <p className="text-gray-600 mb-6">
            {activeTab === 'inbox'
              ? "You don't have any messages. When someone sends you a message, it will appear here."
              : 'You have not sent any messages yet.'}
          </p>
          <button
            onClick={() => navigate('/profile/messages/compose')}
            className="px-4 py-2 bg-gray-800 text-white rounded hover:bg-gray-900 transition"
          >
            Send a Message
          </button>
        </div>
      )}

      {messages.length > 0 && (
        <div className="space-y-2">
          {messages.map((msg) => {
            const otherUser = activeTab === 'inbox' ? msg.sender : msg.recipient
            const isUnread = activeTab === 'inbox' && msg.readAt === null

            return (
              <div
                key={msg.id}
                onClick={() => handleMessageClick(msg.id)}
                className="p-4 border border-gray-200 rounded hover:bg-gray-50 cursor-pointer transition flex items-center gap-4"
              >
                <Avatar
                  src={otherUser.avatarUrl}
                  name={otherUser.displayName || otherUser.username}
                  size="md"
                />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {isUnread && (
                      <div className="w-2 h-2 rounded-full bg-gray-800 flex-shrink-0" />
                    )}
                    <span
                      className={`text-sm ${
                        isUnread ? 'font-semibold text-gray-900' : 'text-gray-700'
                      }`}
                    >
                      {otherUser.displayName || otherUser.username}
                    </span>
                    <span className="text-xs text-gray-500">@{otherUser.username}</span>
                  </div>

                  <p
                    className={`text-sm mb-1 truncate ${
                      isUnread ? 'font-semibold text-gray-900' : 'text-gray-700'
                    }`}
                  >
                    {msg.subject || msg.body}
                  </p>

                  <p className="text-xs text-gray-500">{timeAgo(msg.createdAt)}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {messages.length > 0 && (
        <Pagination page={page} totalPages={totalPages} onPageChange={handlePageChange} />
      )}
    </div>
  )
}
