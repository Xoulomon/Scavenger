import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ScavengerClient } from '@/api/client'
import { useWallet } from '@/context/WalletContext'
import { useContract } from '@/context/ContractContext'
import { useToast } from '@/hooks/useToast'
import { networkConfig } from '@/lib/stellar'
import { invalidateKeys, invalidationPlan } from '@/lib/cacheInvalidation'

export interface DistributeRewardsParams {
  wasteId: bigint
  incentiveId: bigint
}

export function useDistributeRewards() {
  const { address } = useWallet()
  const { config } = useContract()
  const queryClient = useQueryClient()
  const toast = useToast()

  return useMutation({
    mutationFn: async ({ wasteId, incentiveId }: DistributeRewardsParams) => {
      if (!address) throw new Error('Wallet not connected.')
      const client = new ScavengerClient({
        rpcUrl: config.rpcUrl,
        networkPassphrase: networkConfig.networkPassphrase,
        contractId: config.contractId,
      })
      const total = await client.distributeRewards(wasteId, incentiveId, address, address)
      return { total, wasteId, incentiveId }
    },
    onSuccess: ({ total, wasteId }) => {
      invalidateKeys(queryClient, invalidationPlan.distributeRewards())
      toast.success(`Rewards distributed for waste #${wasteId}: ${total.toLocaleString()} tokens total.`)
    },
    onError: (error) => {
      toast.error(error)
    },
  })
}
