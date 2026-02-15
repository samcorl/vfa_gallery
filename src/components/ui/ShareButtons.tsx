import { Copy, Share2, Facebook, Mail } from 'lucide-react'
import { useToast } from '../../contexts/ToastContext'

interface ShareButtonsProps {
  url: string
  title: string
  imageUrl?: string
}

export default function ShareButtons({ url, title, imageUrl }: ShareButtonsProps) {
  const toast = useToast()

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Link copied to clipboard')
    } catch {
      toast.error('Failed to copy link')
    }
  }

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title, url })
      } catch {
        // User cancelled
      }
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={handleCopyLink}
        className="flex items-center gap-1 px-3 py-1.5 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300 transition"
      >
        <Copy className="w-3 h-3" />
        Copy link
      </button>
      <a
        href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="px-3 py-1.5 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300 transition"
      >
        X
      </a>
      <a
        href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1 px-3 py-1.5 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300 transition"
      >
        <Facebook className="w-3 h-3" />
      </a>
      {imageUrl && (
        <a
          href={`https://pinterest.com/pin/create/button/?url=${encodeURIComponent(url)}&description=${encodeURIComponent(title)}&media=${encodeURIComponent(imageUrl)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-1.5 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300 transition"
        >
          Pin
        </a>
      )}
      <a
        href={`mailto:?subject=${encodeURIComponent(`Check out: ${title}`)}&body=${encodeURIComponent(`${title}\n\nView it here: ${url}`)}`}
        className="flex items-center gap-1 px-3 py-1.5 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300 transition"
      >
        <Mail className="w-3 h-3" />
      </a>
      {typeof navigator !== 'undefined' && 'share' in navigator && (
        <button
          onClick={handleNativeShare}
          className="flex items-center gap-1 px-3 py-1.5 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300 transition"
        >
          <Share2 className="w-3 h-3" />
          Share
        </button>
      )}
    </div>
  )
}
