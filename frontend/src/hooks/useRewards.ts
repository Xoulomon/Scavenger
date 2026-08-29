import { useQuery } from '@tanstack/react-query'
import { ScavengerClient } from '@/api/client'
import { ParticipantStats, Role, Waste } from '@/api/types'
import { useWallet } from '@/context/WalletContext'
import { useContract } from '@/context/ContractContext'
import { useParticipant } from '@/hooks/useParticipant'
import { networkConfig } from '@/lib/stellar'

export interface RewardsData {
  stats: ParticipantStats | null
  wastes: Waste[]
  role: Role | null
  isLoading: boolean
  isError: boolean
}

export function useRewards(): RewardsData {
  const { address } = useWallet()
  const { config } = useContract()
  const { participant } = useParticipant()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['rewards', address],
    queryFn: async (): Promise<{ stats: ParticipantStats; wastes: Waste[] }> => {
      if (!address) throw new Error('No address.')
      const client = new ScavengerClient({
        rpcUrl: config.rpcUrl,
        networkPassphrase: networkConfig.networkPassphrase,
        contractId: config.contractId,
      })
      const [stats, wasteIds] = await Promise.all([
        client.getStats(address),
        client.getParticipantWastes(address),
      ])
      // Fetch last 20 wastes for the transaction history
      const recent = wasteIds.slice(-20).reverse()
      const results = await Promise.all(recent.map((id) => client.getWaste(id)))
      const wastes = results.filter((w): w is Waste => w !== null)
      return { stats, wastes }
    },
    enabled: !!address,
    staleTime: 30_000,
  })

  return {
    stats: data?.stats ?? null,
    wastes: data?.wastes ?? [],
    role: participant?.role ?? null,
    isLoading,
    isError,
  }
}
