/**
 * Single source of truth for React Query cache timing.
 *
 * `queryCachePolicy` is the app-wide default applied in main.tsx. A resource
 * that needs different timing should pass its own `staleTime` / `gcTime` in
 * the hook's useQuery options, and say why in a comment there.
 */

import { QueryClient } from '@tanstack/react-query'

const MINUTE = 60 * 1000

export const DEFAULT_STALE_TIME = 5 * MINUTE
export const DEFAULT_GC_TIME = 24 * 60 * MINUTE

/**
 * Default retry policy. A single retry smooths over transient network blips
 * without hammering a failing endpoint. Callers that need different behaviour
 * can override `retry` in their own useQuery options.
 */
export const DEFAULT_RETRY = 1

export const queryCachePolicy = {
  staleTime: DEFAULT_STALE_TIME,
  gcTime: DEFAULT_GC_TIME,
  refetchOnWindowFocus: false,
  retry: DEFAULT_RETRY
} as const

/**
 * Creates a QueryClient pre-configured with the app-wide cache policy.
 *
 * Use this factory (rather than `new QueryClient()` directly) so every client
 * — including those created in tests — shares the same defaults. Tests can
 * pass overrides to exercise retry/caching behaviour without mutating the
 * shared policy.
 */
export function createQueryClient(
  overrides: Partial<ConstructorParameters<typeof QueryClient>[0]> = {}
): QueryClient {
  return new QueryClient({
    ...overrides,
    defaultOptions: {
      ...overrides.defaultOptions,
      queries: {
        ...queryCachePolicy,
        ...overrides.defaultOptions?.queries
      }
    }
  })
}
