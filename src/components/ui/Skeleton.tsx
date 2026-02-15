import type { CSSProperties } from 'react'

interface SkeletonProps {
  className?: string
  width?: string | number
  height?: string | number
  rounded?: boolean
  circle?: boolean
  style?: CSSProperties
}

export function Skeleton({ className = '', width, height, rounded = true, circle = false, style }: SkeletonProps) {
  return (
    <div
      className={`animate-shimmer bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%] ${
        circle ? 'rounded-full' : rounded ? 'rounded-lg' : ''
      } ${className}`}
      style={{ width, height, ...style }}
      aria-hidden="true"
    />
  )
}

export function SkeletonText({ lines = 3, className = '' }: { lines?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          height="0.875rem"
          className={i === lines - 1 ? 'w-3/4' : 'w-full'}
        />
      ))}
    </div>
  )
}

export function SkeletonAvatar({ size = 40, className = '' }: { size?: number; className?: string }) {
  return <Skeleton width={size} height={size} circle className={className} />
}

export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`overflow-hidden rounded-lg ${className}`} aria-hidden="true">
      <Skeleton className="w-full aspect-square" />
      <div className="p-3 space-y-2">
        <Skeleton height="1rem" className="w-3/4" />
        <Skeleton height="0.75rem" className="w-1/2" />
      </div>
    </div>
  )
}

export function SkeletonGrid({ count = 12, className = '' }: { count?: number; className?: string }) {
  return (
    <div className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 ${className}`} aria-busy="true" role="status">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
      <span className="sr-only">Loading content...</span>
    </div>
  )
}
