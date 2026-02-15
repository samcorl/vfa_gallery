export function ArtworkSkeleton() {
  return (
    <div className="w-full aspect-square bg-gray-100 animate-pulse rounded-lg">
      <div className="w-full h-full flex items-center justify-center">
        <svg className="w-10 h-10 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
          <path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" />
        </svg>
      </div>
    </div>
  )
}
