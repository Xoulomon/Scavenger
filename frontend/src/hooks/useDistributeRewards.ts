import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ScavengerClient } from '@/api/client'
import { useWallet } from '@/context/WalletContext'
import { useContract } from '@/context/ContractContext'
import { useToast } from '@/hooks/useToast'
import { networkConfig } from '@/lib/stellar'
import { invalidateKeys, invalidationPlan } from '@/lib/cacheInvalidation'
import {
  useTransactionStatus,
  type TransactionStatusController
} from '@/hooks/useTransactionStatus'

export interface DistributeRewardsParams {
  wasteId: bigint
  incentiveId: bigint
}

export interface DistributeRewardsResult {
  total: bigint
  wasteId: bigint
  incentiveId: bigint
}

export interface UseDistributeRewardsResult {
  mutate: (params: DistributeRewardsParams) => void
  mutateAsync: (params: DistributeRewardsParams) => Promise<DistributeRewardsResult>
  reset: () => void
  isPending: boolean
  isSuccess: boolean
  isError: boolean
  error: Error | null
  data: DistributeRewardsResult | undefined
  status: TransactionStatusController['status']
  statusComponent: TransactionStatusController['StatusComponent']
}

export function useDistributeRewards(): UseDistributeRewardsResult {
  const { address } = useWallet()
  const { config } = useContract()
  const queryClient = useQueryClient()
  const toast = useToast()
  const transactionStatus = useTransactionStatus()

  const mutation = useMutation<DistributeRewardsResult, Error, DistributeRewardsParams>({
    mutationFn: async ({ wasteId, incentiveId }: DistributeRewardsParams) => {
      if (!address) throw new Error('Wallet not connected.')
      transactionStatus.begin()
      const client = new ScavengerClient({
        rpcUrl: config.rpcUrl,
        networkPassphrase: networkConfig.networkPassphrase,
        contractId: config.contractId
      })
      const total = await client.distributeRewards(wasteId, incentiveId, address, address)
      return { total, wasteId, incentiveId }
    },
    onSuccess: ({ total, wasteId }) => {
      invalidateKeys(queryClient, invalidationPlan.distributeRewards())
      transactionStatus.succeed()
      toast.success(
        `Rewards distributed for waste #${wasteId}: ${total.toLocaleString()} tokens total.`
      )
    },
    onError: (error) => {
      transactionStatus.fail(error)
      toast.error(error)
    }
  })

  return {
    mutate: mutation.mutate,
    mutateAsync: mutation.mutateAsync,
    reset: () => {
      mutation.reset()
      transactionStatus.reset()
    },
    isPending: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    error: mutation.error,
    data: mutation.data,
    status: transactionStatus.status,
    statusComponent: transactionStatus.StatusComponent
  }
}
