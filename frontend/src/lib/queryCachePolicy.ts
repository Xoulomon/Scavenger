/**
 * Single source of truth for React Query cache timing.
 *
 * `queryCachePolicy` is the app-wide default applied in main.tsx. A resource
 * that needs different timing should pass its own `staleTime` / `gcTime` in
 * the hook's useQuery options, and say why in a comment there.
 */

const MINUTE = 60 * 1000

export const DEFAULT_STALE_TIME = 5 * MINUTE
export const DEFAULT_GC_TIME = 24 * 60 * MINUTE

export const queryCachePolicy = {
  staleTime: DEFAULT_STALE_TIME,
  gcTime: DEFAULT_GC_TIME,
  refetchOnWindowFocus: false,
  retry: 1,
} as const
