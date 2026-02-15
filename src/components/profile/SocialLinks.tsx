import type { UserSocial } from '../../types/user'
import { getSocialDisplayName } from '../../lib/socials'
import {
  Twitter,
  Instagram,
  Facebook,
  Linkedin,
  Github,
  Youtube,
  Globe,
} from 'lucide-react'

interface SocialLinksProps {
  socials: UserSocial[]
}

const SOCIAL_ICONS: Record<string, typeof Twitter> = {
  twitter: Twitter,
  instagram: Instagram,
  facebook: Facebook,
  linkedin: Linkedin,
  github: Github,
  youtube: Youtube,
  website: Globe,
  tiktok: Globe, // Fallback - lucide doesn't have TikTok
}

export function SocialLinks({ socials }: SocialLinksProps) {
  if (socials.length === 0) {
    return null
  }

  return (
    <div className="flex flex-wrap gap-3">
      {socials.map((social) => {
        const Icon = SOCIAL_ICONS[social.platform] || Globe
        const displayName = getSocialDisplayName(social.platform)

        return (
          <a
            key={`${social.platform}-${social.url}`}
            href={social.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            title={displayName}
          >
            <Icon className="w-4 h-4" />
            <span className="text-sm font-medium text-gray-700">{displayName}</span>
          </a>
        )
      })}
    </div>
  )
}
