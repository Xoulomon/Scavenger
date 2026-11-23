import { useMemo, useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { Participant, Waste } from '@/api/types'
import type { SearchFilters, SearchResult } from '@/lib/searchStorage'
import { cacheKeys } from '@/lib/cacheKeys'
import { queryCachePolicy } from '@/lib/queryClient'

// Simple debounce hook — delays the value by `delay` ms
export function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debounced
}

/**
 * Client-side search over TanStack Query cached data.
 * Reads participants and wastes from the query cache — no new network requests.
 *
 * Uses the centralized `cacheKeys` prefixes and `queryCachePolicy` defaults so
 * that cache reads stay consistent with the rest of the app's fetching
 * conventions (caching, retries, invalidation).
 */
export function useSearch(query: string, filters?: Partial<SearchFilters>): SearchResult[] {
  const queryClient = useQueryClient()

  // Stabilize the filters dependency so a new object literal with identical
  // contents does not invalidate the memoized search results.
  const status = filters?.status
  const wasteTypesKey = filters?.wasteTypes?.join('\u0000') ?? ''

  return useMemo(() => {
    const trimmed = query.trim().toLowerCase()
    if (!trimmed) return []

    const results: SearchResult[] = []

    // --- Search participants ---
    // Prefix match via cacheKeys.participant() so all participant query
    // variants (per-address, lists) are included regardless of staleTime.
    const participantQueries = queryClient.getQueriesData<Participant | null>({
      queryKey: cacheKeys.participant(),
      // Only consider entries that are still within the cache policy's
      // stale window; stale entries are excluded from search results.
      predicate: (q) =>
        q.state.dataUpdatedAt === 0 ||
        Date.now() - q.state.dataUpdatedAt <= queryCachePolicy.staleTime
    })

    for (const [, participant] of participantQueries) {
      if (!participant) continue

      const nameMatch = participant.name.toLowerCase().includes(trimmed)
      const addressMatch = participant.address.toLowerCase().includes(trimmed)

      if (nameMatch || addressMatch) {
        results.push({
          type: 'participant',
          id: participant.address,
          label: participant.name,
          sublabel: participant.address,
          data: participant
        })
      }
    }

    // --- Search wastes ---
    // Wastes are cached under ['wastes', address, filters] and ['participant-wastes', address, filters]
    const wasteQueryKeys = [
      ...queryClient.getQueriesData<Waste[]>({
        queryKey: cacheKeys.wastes(),
        predicate: (q) =>
          q.state.dataUpdatedAt === 0 ||
          Date.now() - q.state.dataUpdatedAt <= queryCachePolicy.staleTime
      }),
      ...queryClient.getQueriesData<Waste[]>({
        queryKey: cacheKeys.participantWastes(),
        predicate: (q) =>
          q.state.dataUpdatedAt === 0 ||
          Date.now() - q.state.dataUpdatedAt <= queryCachePolicy.staleTime
      })
    ]

    const seenWasteIds = new Set<string>()

    for (const [, wastes] of wasteQueryKeys) {
      if (!Array.isArray(wastes)) continue

      for (const waste of wastes) {
        const wasteIdStr = waste.waste_id.toString()
        if (seenWasteIds.has(wasteIdStr)) continue

        const idMatch = wasteIdStr.includes(trimmed)
        const ownerMatch = waste.current_owner.toLowerCase().includes(trimmed)

        // Apply status filter if provided
        if (filters?.status && filters.status !== 'all') {
          if (filters.status === 'active' && !waste.is_active) continue
          if (filters.status === 'confirmed' && !waste.is_confirmed) continue
          if (filters.status === 'inactive' && waste.is_active) continue
        }

        // Apply wasteType filter if provided
        if (filters?.wasteTypes && filters.wasteTypes.length > 0) {
          if (!filters.wasteTypes.includes(waste.waste_type)) continue
        }

        if (idMatch || ownerMatch) {
          seenWasteIds.add(wasteIdStr)
          results.push({
            type: 'waste',
            id: wasteIdStr,
            label: `Waste #${wasteIdStr}`,
            sublabel: waste.current_owner,
            data: waste
          })
        }
      }
    }

    return results
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, status, wasteTypesKey, queryClient])
}
