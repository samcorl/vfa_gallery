import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import Avatar from '../components/ui/Avatar'
import { ArrowLeft, Send, X, AlertCircle } from 'lucide-react'

interface ArtistResult {
  id: string
  username: string
  displayName: string | null
  avatarUrl: string | null
  artworkCount: number
}

export default function MessageComposePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user, isAuthenticated, isLoading: authLoading } = useAuth()

  const [recipientId, setRecipientId] = useState<string | null>(
    searchParams.get('recipientId')
  )
  const [recipientInfo, setRecipientInfo] = useState<ArtistResult | null>(null)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<ArtistResult[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [searchDebounce, setSearchDebounce] = useState<NodeJS.Timeout | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const contextType = searchParams.get('contextType')
  const contextId = searchParams.get('contextId')
  const contextTitle = searchParams.get('contextTitle')

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/auth/login')
    }
  }, [authLoading, isAuthenticated, navigate])

  useEffect(() => {
    if (recipientId) {
      const fetchRecipient = async () => {
        try {
          const response = await fetch(`/api/users/${recipientId}`, {
            credentials: 'include',
          })
          if (response.ok) {
            const data = await response.json()
            setRecipientInfo(data.user || data)
          }
        } catch (err) {
          console.error('Failed to fetch recipient:', err)
        }
      }
      fetchRecipient()
    }
  }, [recipientId])

  const handleSearchChange = (query: string) => {
    setSearchQuery(query)
    setShowDropdown(true)

    if (searchDebounce) clearTimeout(searchDebounce)

    if (query.length < 2) {
      setSearchResults([])
      return
    }

    const timeout = setTimeout(async () => {
      try {
        const response = await fetch(`/api/search/artists?q=${encodeURIComponent(query)}`, {
          credentials: 'include',
        })
        if (response.ok) {
          const data = await response.json()
          setSearchResults(data.artists || [])
        }
      } catch (err) {
        console.error('Search failed:', err)
      }
    }, 300)

    setSearchDebounce(timeout)
  }

  const handleSelectRecipient = (artist: ArtistResult) => {
    setRecipientId(artist.id)
    setRecipientInfo(artist)
    setSearchQuery('')
    setSearchResults([])
    setShowDropdown(false)
  }

  const handleClearRecipient = () => {
    setRecipientId(null)
    setRecipientInfo(null)
    setSearchQuery('')
    setSearchResults([])
  }

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSend = async () => {
    if (!recipientId || !body.trim()) {
      setError('Recipient and message body are required')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/messages', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipientId,
          subject: subject.trim() || undefined,
          body: body.trim(),
          contextType: contextType || undefined,
          contextId: contextId || undefined,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to send message')
      }

      setSuccessMessage('Message sent!')
      setTimeout(() => {
        navigate('/profile/messages')
      }, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message')
    } finally {
      setLoading(false)
    }
  }

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin border-4 border-gray-200 border-t-gray-800 rounded-full w-8 h-8" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => navigate('/profile/messages')}
          className="p-2 hover:bg-gray-100 rounded transition"
        >
          <ArrowLeft className="w-5 h-5 text-gray-900" />
        </button>
        <h1 className="text-3xl font-bold text-gray-900">New Message</h1>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <p className="text-red-600">{error}</p>
          </div>
        )}

        {successMessage && (
          <div className="p-4 bg-green-50 border border-green-200 rounded">
            <p className="text-green-600">{successMessage}</p>
          </div>
        )}

        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            To
          </label>
          {recipientInfo ? (
            <div className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded">
              <Avatar
                src={recipientInfo.avatarUrl}
                name={recipientInfo.displayName || recipientInfo.username}
                size="sm"
              />
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {recipientInfo.displayName || recipientInfo.username}
                </p>
                <p className="text-xs text-gray-500">@{recipientInfo.username}</p>
              </div>
              <button
                onClick={handleClearRecipient}
                className="ml-auto p-1 hover:bg-gray-200 rounded transition"
              >
                <X className="w-4 h-4 text-gray-600" />
              </button>
            </div>
          ) : (
            <div className="relative" ref={dropdownRef}>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                onFocus={() => setShowDropdown(true)}
                placeholder="Search for an artist..."
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gray-800 focus:border-transparent"
              />
              {showDropdown && searchResults.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded shadow-lg">
                  {searchResults.map((artist) => (
                    <button
                      key={artist.id}
                      onClick={() => handleSelectRecipient(artist)}
                      className="w-full px-3 py-2 flex items-center gap-3 hover:bg-gray-50 border-b last:border-0 transition"
                    >
                      <Avatar
                        src={artist.avatarUrl}
                        name={artist.displayName || artist.username}
                        size="sm"
                      />
                      <div className="text-left min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900">
                          {artist.displayName || artist.username}
                        </p>
                        <p className="text-xs text-gray-500">@{artist.username}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-semibold text-gray-900">Subject (optional)</label>
            <span className="text-xs text-gray-500">
              {subject.length}/200
            </span>
          </div>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value.slice(0, 200))}
            placeholder="What is this about?"
            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gray-800 focus:border-transparent"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-semibold text-gray-900">Message</label>
            <span className="text-xs text-gray-500">
              {body.length}/10000
            </span>
          </div>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, 10000))}
            placeholder="Write your message here..."
            rows={8}
            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gray-800 focus:border-transparent resize-none"
          />
        </div>

        {contextType && contextTitle && (
          <div className="p-3 bg-gray-100 border border-gray-300 rounded">
            <p className="text-xs font-semibold text-gray-700 uppercase">
              Context: {contextType}
            </p>
            <p className="text-sm text-gray-900 mt-1">{contextTitle}</p>
          </div>
        )}

        <div className="flex gap-3 pt-4">
          <button
            onClick={handleSend}
            disabled={loading || !recipientId || !body.trim()}
            className="flex items-center gap-2 px-6 py-2 bg-gray-800 text-white rounded hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            <Send className="w-4 h-4" />
            {loading ? 'Sending...' : 'Send'}
          </button>
          <button
            onClick={() => navigate('/profile/messages')}
            className="px-6 py-2 bg-gray-200 text-gray-900 rounded hover:bg-gray-300 transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
