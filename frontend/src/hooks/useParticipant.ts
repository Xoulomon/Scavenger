import { useQuery } from '@tanstack/react-query'
import { ScavengerClient } from '@/api/client'
import { Participant } from '@/api/types'
import { useWallet } from '@/context/WalletContext'
import { useContract } from '@/context/ContractContext'
import { networkConfig } from '@/lib/stellar'
import { cacheKeys } from '@/lib/cacheKeys'

export function useParticipant() {
  const { address } = useWallet()
  const { config } = useContract()

  const { data, isLoading, isError } = useQuery<Participant | null>({
    queryKey: cacheKeys.participant(address),
    queryFn: async () => {
      if (!address) return null
      const client = new ScavengerClient({
        rpcUrl: config.rpcUrl,
        networkPassphrase: networkConfig.networkPassphrase,
        contractId: config.contractId,
      })
      return client.getParticipant(address)
    },
    enabled: !!address,
    retry: false,
  })

  return {
    participant: data ?? null,
    isLoading,
    isError,
  }
}
