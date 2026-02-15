import type { UserProfileResponse } from '../../types/user'

interface ProfileStatsProps {
  user: UserProfileResponse
}

export function ProfileStats({ user }: ProfileStatsProps) {
  const stats = [
    { label: 'Galleries', value: user.limits.galleries },
    { label: 'Collections', value: user.limits.collections },
    { label: 'Artworks', value: user.limits.artworks },
    { label: 'Daily Uploads', value: user.limits.dailyUploads },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <div key={stat.label} className="bg-gray-50 rounded-lg p-4 text-center">
          <div className="text-2xl md:text-3xl font-bold text-gray-900">{stat.value}</div>
          <div className="text-sm text-gray-600 mt-1">{stat.label}</div>
        </div>
      ))}
    </div>
  )
}
