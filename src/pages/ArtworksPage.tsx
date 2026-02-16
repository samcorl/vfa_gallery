import { useState, useEffect, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { ArtworkGrid } from '../components/artwork'
import type { Artwork, PaginatedArtworks } from '../types/artwork'

export default function ArtworksPage() {
  const navigate = useNavigate()
  const { } = useAuth()
  const toast = useToast()

  const [artworks, setArtworks] = useState<Artwork[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [total, setTotal] = useState(0)
  const [category, setCategory] = useState('')
  const [status, setStatus] = useState('active')

  const fetchArtworks = useCallback(async (pageNum: number) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(pageNum),
        limit: '20',
        status,
      })
      if (category) params.set('category', category)

      const res = await fetch(`/api/artworks?${params}`, {
        credentials: 'include',
      })

      if (!res.ok) throw new Error('Failed to load artworks')

      const data: PaginatedArtworks = await res.json()
      setArtworks(data.data)
      setTotalPages(data.pagination.totalPages)
      setTotal(data.pagination.total)
      setPage(data.pagination.page)
    } catch (err) {
      toast.error('Failed to load artworks')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [status, category, toast])

  useEffect(() => {
    fetchArtworks(1)
  }, [fetchArtworks])

  const handleSelectArtwork = (artwork: Artwork) => {
    navigate(`/profile/artworks/${artwork.id}/edit`)
  }

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      fetchArtworks(newPage)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Artworks</h1>
          <p className="text-gray-500 mt-1">{total} artwork{total !== 1 ? 's' : ''}</p>
        </div>
        <Link
          to="/artworks/upload"
          className="inline-flex items-center px-5 py-2.5 bg-gray-900 text-white rounded-lg font-semibold hover:bg-gray-800 text-sm"
        >
          + Upload Artwork
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-8">
        {/* Status filter */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {['active', 'draft'].map((s) => (
            <button
              key={s}
              onClick={() => { setStatus(s); setPage(1) }}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                status === s
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        {/* Category filter */}
        <select
          value={category}
          onChange={(e) => { setCategory(e.target.value); setPage(1) }}
          className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-700 bg-white focus:outline-none focus:border-gray-900"
        >
          <option value="">All Categories</option>
          <option value="painting">Painting</option>
          <option value="sculpture">Sculpture</option>
          <option value="photography">Photography</option>
          <option value="digital">Digital</option>
          <option value="drawing">Drawing</option>
          <option value="printmaking">Printmaking</option>
          <option value="mixed-media">Mixed Media</option>
          <option value="other">Other</option>
        </select>
      </div>

      {/* Grid */}
      <ArtworkGrid
        artworks={artworks}
        onSelect={handleSelectArtwork}
        showStatus={status !== 'active'}
        loading={loading}
        emptyMessage={
          category || status !== 'active'
            ? 'No artworks match your filters'
            : "You haven't uploaded any artworks yet"
        }
      />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-10">
          <button
            onClick={() => handlePageChange(page - 1)}
            disabled={page <= 1}
            className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Previous
          </button>

          {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
            const p = Math.max(1, Math.min(page - 2, totalPages - 4)) + i
            if (p > totalPages) return null
            return (
              <button
                key={p}
                onClick={() => handlePageChange(p)}
                className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors ${
                  p === page
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                {p}
              </button>
            )
          })}

          <button
            onClick={() => handlePageChange(page + 1)}
            disabled={page >= totalPages}
            className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
