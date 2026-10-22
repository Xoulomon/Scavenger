import { useMemo, useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { Participant, Waste } from '@/api/types'
import type { SearchFilters, SearchResult } from '@/lib/searchStorage'
import { cacheKeys } from '@/lib/cacheKeys'

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
 */
export function useSearch(query: string, filters?: Partial<SearchFilters>): SearchResult[] {
  const queryClient = useQueryClient()

  return useMemo(() => {
    const trimmed = query.trim().toLowerCase()
    if (!trimmed) return []

    const results: SearchResult[] = []

    // --- Search participants ---
    const participantQueries = queryClient
      .getQueriesData<Participant | null>({ queryKey: cacheKeys.participant() })

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
          data: participant,
        })
      }
    }

    // --- Search wastes ---
    // Wastes are cached under ['wastes', address, filters] and ['participant-wastes', address, filters]
    const wasteQueryKeys = [
      ...queryClient.getQueriesData<Waste[]>({ queryKey: cacheKeys.wastes() }),
      ...queryClient.getQueriesData<Waste[]>({ queryKey: cacheKeys.participantWastes() }),
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
            data: waste,
          })
        }
      }
    }

    return results
  }, [query, filters, queryClient])
}
