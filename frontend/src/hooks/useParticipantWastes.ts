import { useMemo } from 'react'
import '@tanstack/react-query'
import '@/api/client'
import { Waste } from '@/api/types'
import { useWallet } from '@/context/WalletContext'
import { cacheKeys } from '@/lib/cacheKeys'
import { queryCachePolicy } from '@/lib/queryClient'
import { useContractQuery } from './useContractQuery'
import { WasteFilters, applyWasteFilters } from './wasteFilters'

// Re-exported for backwards compatibility; the canonical definition now lives
// in `./wasteFilters` and is shared across waste-related hooks.
export type { WasteFilters }

/**
 * Hook contract: `useParticipantWastes`
 *
 * - Input: optional `WasteFilters` ({ wasteType?, isActive?, isConfirmed? }).
 * - Data source: participant waste IDs via `getParticipantWastesV2`, then each
 *   waste record via `getWasteV2` (fetched in parallel, nulls dropped).
 * - Query is disabled while no wallet address is connected.
 * - Returns `{ wastes, isLoading, isError }`; `wastes` is always an array
 *   (empty when disconnected, loading, errored, or no matches).
 * - Filters are applied client-side after fetching.
 */
export function useParticipantWastes(filters?: WasteFilters) {
  const { address } = useWallet()

  const { data, isLoading, isError } = useContractQuery<Waste[]>({
    queryKey: cacheKeys.participantWastes(address, filters),
    enabled: !!address,
    queryFn: async (client) => {
      if (!address) return []

      // Fetch the list of waste IDs owned by this participant (v2)
      const wasteIds = await client.getParticipantWastesV2(address)

      // Batch-fetch each waste record in parallel
      const results = await Promise.all(wasteIds.map((id) => client.getWasteV2(id)))

      // Drop nulls (deleted/missing records) and apply optional filters
      const wastes = results.filter((w): w is Waste => w !== null)
      return applyWasteFilters(wastes, filters)
    },
    ...queryCachePolicy
  })

  // Memoize the selector so consumers receive a stable array reference when
  // the underlying query data has not changed.
  const wastes = useMemo(() => data ?? [], [data])

  return {
    wastes,
    isLoading,
    isError
  }
}
