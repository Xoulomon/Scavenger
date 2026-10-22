import { useQuery } from '@tanstack/react-query'
import { ScavengerClient } from '@/api/client'
import { ParticipantStats, Waste } from '@/api/types'
import { useWallet } from '@/context/WalletContext'
import { useContract } from '@/context/ContractContext'
import { networkConfig } from '@/lib/stellar'
import { cacheKeys } from '@/lib/cacheKeys'

export function useProfileStats() {
  const { address } = useWallet()
  const { config } = useContract()

  const { data: stats, isLoading: isLoadingStats, isError: isStatsError } = useQuery<ParticipantStats | null>({
    queryKey: cacheKeys.participantStats(address),
    queryFn: async () => {
      if (!address) return null
      const client = new ScavengerClient({
        rpcUrl: config.rpcUrl,
        networkPassphrase: networkConfig.networkPassphrase,
        contractId: config.contractId,
      })
      return client.getStats(address)
    },
    enabled: !!address,
    retry: false,
  })

  const { data: wastes, isLoading: isLoadingWastes, isError: isWastesError } = useQuery<Waste[]>({
    queryKey: cacheKeys.participantWastes(address),
    queryFn: async () => {
      if (!address) return []
      const client = new ScavengerClient({
        rpcUrl: config.rpcUrl,
        networkPassphrase: networkConfig.networkPassphrase,
        contractId: config.contractId,
      })
      const wasteIds = await client.getParticipantWastes(address)
      const results = await Promise.all(wasteIds.map((id) => client.getWaste(id)))
      return results.filter((w): w is Waste => w !== null)
    },
    enabled: !!address,
    retry: false,
  })

  return {
    stats: stats ?? null,
    wastes: wastes ?? [],
    isLoadingStats,
    isLoadingWastes,
    isStatsError,
    isWastesError,
  }
}
