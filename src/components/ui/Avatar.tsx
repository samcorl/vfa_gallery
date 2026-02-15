interface AvatarProps {
  src: string | null
  name: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const sizeMap = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-14 h-14 text-lg',
  xl: 'w-24 h-24 text-3xl',
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export default function Avatar({ src, name, size = 'md', className = '' }: AvatarProps) {
  const sizeClass = sizeMap[size]

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={`${sizeClass} rounded-full bg-gray-200 object-cover ${className}`}
      />
    )
  }

  return (
    <div
      className={`${sizeClass} rounded-full bg-gray-200 flex items-center justify-center ${className}`}
    >
      <span className="font-bold text-gray-500">{getInitials(name)}</span>
    </div>
  )
}
