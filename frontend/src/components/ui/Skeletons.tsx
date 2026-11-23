import { cn } from '@/lib/utils'

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-muted', className)} />
}

/** Matches the 3-column stat card grid on dashboards */
export function StatCardSkeleton() {
  return (
    <div className="rounded-lg border bg-card shadow-sm p-6 space-y-3">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-4 w-4 rounded-full" />
      </div>
      <Skeleton className="h-8 w-20" />
    </div>
  )
}

/** Matches a single waste row in the waste list table */
export function WasteCardSkeleton() {
  return (
    <tr>
      <td className="px-4 py-3">
        <Skeleton className="h-4 w-10" />
      </td>
      <td className="px-4 py-3">
        <Skeleton className="h-4 w-20" />
      </td>
      <td className="px-4 py-3">
        <Skeleton className="h-4 w-12" />
      </td>
      <td className="px-4 py-3">
        <Skeleton className="h-5 w-16 rounded-full" />
      </td>
      <td className="px-4 py-3">
        <Skeleton className="h-4 w-24" />
      </td>
      <td className="px-4 py-3 text-right">
        <Skeleton className="ml-auto h-7 w-20" />
      </td>
    </tr>
  )
}

/** Matches a single incentive row inside a card table */
export function IncentiveCardSkeleton() {
  return (
    <tr>
      <td className="py-2 pr-4">
        <Skeleton className="h-4 w-8" />
      </td>
      <td className="py-2 pr-4">
        <Skeleton className="h-4 w-24" />
      </td>
      <td className="py-2 pr-4">
        <Skeleton className="h-4 w-12" />
      </td>
      <td className="py-2 pr-4">
        <Skeleton className="h-5 w-16 rounded-full" />
      </td>
    </tr>
  )
}

/** Full-page loading skeleton used as Suspense fallback for lazy-loaded pages */
export function PageSkeleton() {
  return (
    <div className="space-y-6 p-6 animate-pulse">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-lg border bg-card p-6 space-y-3">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-8 w-20" />
          </div>
        ))}
      </div>
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    </div>
  )
}
