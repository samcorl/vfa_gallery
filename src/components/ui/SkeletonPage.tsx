import { Skeleton, SkeletonGrid, SkeletonText, SkeletonAvatar } from './Skeleton'

/** Grid page skeleton (Browse, Search, Artworks) */
export function GridPageSkeleton() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <Skeleton height="2rem" className="w-48 mb-6" />
      <SkeletonGrid count={12} />
    </div>
  )
}

/** Detail page skeleton (Artwork, Gallery, Collection) */
export function DetailPageSkeleton() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <Skeleton className="w-full aspect-[4/3] mb-6" />
      <Skeleton height="2rem" className="w-2/3 mb-4" />
      <SkeletonText lines={4} />
    </div>
  )
}

/** Profile page skeleton */
export function ProfilePageSkeleton() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center gap-4 mb-8">
        <SkeletonAvatar size={80} />
        <div className="flex-1 space-y-2">
          <Skeleton height="1.5rem" className="w-48" />
          <Skeleton height="1rem" className="w-32" />
        </div>
      </div>
      <SkeletonGrid count={6} />
    </div>
  )
}

/** Form page skeleton (Upload, Edit) */
export function FormPageSkeleton() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <Skeleton height="2rem" className="w-48 mb-6" />
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-1">
            <Skeleton height="0.875rem" className="w-24" />
            <Skeleton height="2.5rem" className="w-full" />
          </div>
        ))}
        <Skeleton height="2.5rem" className="w-32 mt-4" />
      </div>
    </div>
  )
}

/** Admin page skeleton */
export function AdminPageSkeleton() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <Skeleton height="2rem" className="w-48 mb-6" />
      <div className="space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} height="3rem" className="w-full" />
        ))}
      </div>
    </div>
  )
}
