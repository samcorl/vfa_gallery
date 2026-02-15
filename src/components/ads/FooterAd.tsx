import { useEffect, useState } from 'react'
import AdSlot from './AdSlot'

interface FooterAdProps {
  className?: string
}

export default function FooterAd({ className = '' }: FooterAdProps) {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  return (
    <div className={`py-8 ${className}`}>
      <div className="text-center mb-3">
        <p className="text-xs text-gray-400 font-semibold tracking-wide uppercase">
          Advertisement
        </p>
      </div>
      <div className="flex justify-center">
        <AdSlot
          size={isMobile ? 'banner' : 'leaderboard'}
          id={`footer-ad-${isMobile ? 'banner' : 'leaderboard'}`}
        />
      </div>
    </div>
  )
}
