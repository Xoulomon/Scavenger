import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ScavengerClient } from '@/api/client'
import { Waste, WasteType } from '@/api/types'
import { useWallet } from '@/context/WalletContext'
import { useContract } from '@/context/ContractContext'
import { networkConfig } from '@/lib/stellar'
import { cacheKeys } from '@/lib/cacheKeys'
import { queryCachePolicy } from '@/lib/queryClient'

/**
 * Filters applied to the participant's waste list.
 *
 * This type is shared across waste-related hooks (see `./types`). It is
 * re-exported here for backwards compatibility with existing imports.
 */
export interface WasteFilters {
  wasteType?: WasteType
  isActive?: boolean
}

/**
 * Contract for the `useWastes` hook.
 *
 * @property wastes - The filtered list of wastes owned by the connected
 *   participant. Empty when no wallet is connected or no data is available.
 * @property isLoading - `true` while the underlying query is fetching.
 * @property isError - `true` if the underlying query failed.
 */
export interface UseWastesResult {
  wastes: Waste[]
  isLoading: boolean
  isError: boolean
}

/**
 * Fetches the wastes belonging to the currently connected participant and
 * applies optional client-side filters.
 *
 * The hook is disabled when no wallet address is available; in that case it
 * resolves to an empty list without issuing a network request.
 *
 * @param filters - Optional `WasteFilters` used to narrow the result set.
 * @returns A `UseWastesResult` with the wastes and query status flags.
 */
export function useWastes(filters?: WasteFilters): UseWastesResult {
  const { address } = useWallet()
  const { config } = useContract()

  const { data, isLoading, isError } = useQuery<Waste[]>({
    queryKey: cacheKeys.wastes(address, filters),
    queryFn: async () => {
      if (!address) return []
      const client = new ScavengerClient({
        rpcUrl: config.rpcUrl,
        networkPassphrase: networkConfig.networkPassphrase,
        contractId: config.contractId
      })
      const ids = await client.getParticipantWastes(address)
      const results = await Promise.all(ids.map((id) => client.getWaste(id)))
      let wastes = results.filter((w): w is Waste => w !== null)

      if (filters?.wasteType !== undefined) {
        wastes = wastes.filter((w) => w.waste_type === filters.wasteType)
      }
      if (filters?.isActive !== undefined) {
        wastes = wastes.filter((w) => w.is_active === filters.isActive)
      }

      return wastes
    },
    enabled: !!address,
    ...queryCachePolicy.wastes
  })

  const wastes = useMemo<Waste[]>(() => data ?? [], [data])

  return { wastes, isLoading, isError }
}
