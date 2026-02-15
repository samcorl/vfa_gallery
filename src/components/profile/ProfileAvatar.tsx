import type { UserProfileResponse } from '../../types/user'

interface ProfileAvatarProps {
  user: UserProfileResponse
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

export function ProfileAvatar({ user, size = 'md' }: ProfileAvatarProps) {
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-12 h-12 text-sm',
    lg: 'w-24 h-24 text-2xl',
    xl: 'w-32 h-32 text-4xl',
  }

  const sizeClass = sizeClasses[size]

  if (user.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        alt={user.displayName || user.username}
        className={`${sizeClass} rounded-full object-cover flex-shrink-0`}
      />
    )
  }

  // Fallback: initials in circle
  const initials = (user.displayName || user.username)
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <div
      className={`${sizeClass} rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-semibold flex-shrink-0`}
    >
      {initials || 'U'}
    </div>
  )
}
