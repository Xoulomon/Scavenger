import { useQuery } from '@tanstack/react-query'
import { ScavengerClient } from '@/api/client'
import { Waste, WasteType } from '@/api/types'
import { useWallet } from '@/context/WalletContext'
import { useContract } from '@/context/ContractContext'
import { networkConfig } from '@/lib/stellar'
import { cacheKeys } from '@/lib/cacheKeys'

export interface WasteFilters {
  wasteType?: WasteType
  isActive?: boolean
  isConfirmed?: boolean
}

export function useParticipantWastes(filters?: WasteFilters) {
  const { address } = useWallet()
  const { config } = useContract()

  const { data, isLoading, isError } = useQuery<Waste[]>({
    queryKey: cacheKeys.participantWastes(address, filters),
    queryFn: async () => {
      if (!address) return []

      const client = new ScavengerClient({
        rpcUrl: config.rpcUrl,
        networkPassphrase: networkConfig.networkPassphrase,
        contractId: config.contractId,
      })

      // Fetch the list of waste IDs owned by this participant (v2)
      const wasteIds = await client.getParticipantWastesV2(address)

      // Batch-fetch each waste record in parallel
      const results = await Promise.all(wasteIds.map((id) => client.getWasteV2(id)))

      // Drop nulls (deleted/missing records)
      let wastes = results.filter((w): w is Waste => w !== null)

      // Apply optional filters
      if (filters?.wasteType !== undefined) {
        wastes = wastes.filter((w) => w.waste_type === filters.wasteType)
      }
      if (filters?.isActive !== undefined) {
        wastes = wastes.filter((w) => w.is_active === filters.isActive)
      }
      if (filters?.isConfirmed !== undefined) {
        wastes = wastes.filter((w) => w.is_confirmed === filters.isConfirmed)
      }

      return wastes
    },
    enabled: !!address,
  })

  return {
    wastes: data ?? [],
    isLoading,
    isError,
  }
}
