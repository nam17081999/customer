import { cn } from '@/lib/utils'

function Skeleton({ className, ...props }) {
  return (
    <div
      className={cn('animate-pulse rounded-lg bg-gray-200 dark:bg-gray-800', className)}
      style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.02)' }}
      {...props}
    />
  )
}

function SkeletonLine({ width = '100%', className, ...props }) {
  return (
    <Skeleton
      className={cn('h-4', className)}
      style={{ width }}
      {...props}
    />
  )
}

function SkeletonCard({ className, ...props }) {
  return (
    <div
      className={cn('flex flex-col bg-[color:var(--surface)] border border-[color:var(--border)] rounded p-4 animate-pulse pointer-events-none', className)}
      {...props}
    >
      <div className="flex justify-between items-start gap-2 mb-2.5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 min-w-0 overflow-hidden">
            <div className="w-5 h-5 rounded bg-[color:var(--surface2)] shrink-0" />
            <SkeletonLine width="66%" />
          </div>
          <div className="flex gap-1.5 items-center mt-1.5 flex-wrap">
            <div className="h-5 w-14 rounded bg-[color:var(--surface2)]" />
            <div className="h-5 w-20 rounded bg-[color:var(--surface2)]" />
            <div className="h-5 w-16 rounded bg-[color:var(--surface2)]" />
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-2 mb-3 flex-1">
        <div className="flex items-center gap-1.5">
          <div className="w-3.5 h-3.5 rounded bg-[color:var(--surface2)] shrink-0" />
          <SkeletonLine width="100%" />
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3.5 h-3.5 rounded bg-[color:var(--surface2)] shrink-0" />
          <SkeletonLine width="33%" />
        </div>
      </div>
      <div className="flex gap-1.5 mt-auto pt-3 border-t border-[color:var(--border)]">
        <div className="h-8 w-16 rounded-md bg-[color:var(--surface2)]" />
        <div className="h-8 w-16 rounded-md bg-[color:var(--surface2)]" />
        <div className="h-8 w-16 rounded-md bg-[color:var(--surface2)]" />
      </div>
    </div>
  )
}

function SkeletonGrid({ count = 12, isMobile }) {
  const itemCount = isMobile ? Math.min(count, 6) : count
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(340px,1fr))] gap-3 max-md:grid-cols-1">
      {Array.from({ length: itemCount }, (_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  )
}

export { Skeleton, SkeletonLine, SkeletonCard, SkeletonGrid }
