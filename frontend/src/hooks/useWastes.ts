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
}

export function useWastes(filters?: WasteFilters) {
  const { address } = useWallet()
  const { config } = useContract()

  const { data, isLoading, isError } = useQuery<Waste[]>({
    queryKey: cacheKeys.wastes(address, filters),
    queryFn: async () => {
      if (!address) return []
      const client = new ScavengerClient({
        rpcUrl: config.rpcUrl,
        networkPassphrase: networkConfig.networkPassphrase,
        contractId: config.contractId,
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
  })

  return { wastes: data ?? [], isLoading, isError }
}
