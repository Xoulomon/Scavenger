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

export interface DonateToCharityVariables {
  amount: bigint
  balance: bigint
}

export interface UseDonateToCharityResult {
  donate: (variables: DonateToCharityVariables) => void
  donateAsync: (variables: DonateToCharityVariables) => Promise<bigint>
  status: TransactionStatusController['status']
  isPending: boolean
  isSuccess: boolean
  isError: boolean
  error: Error | null
  reset: () => void
}

/**
 * Donate to charity with a shared pending/success/failed lifecycle.
 *
 * Backwards-compatibility: the returned object still exposes the underlying
 * mutation fields (`mutate`, `mutateAsync`, `isPending`, `isSuccess`, `isError`,
 * `error`, `reset`) so existing callers keep working. New callers should prefer
 * `donate`/`donateAsync` and the shared `status` controller.
 */
export function useDonateToCharity(): UseDonateToCharityResult &
  ReturnType<typeof useMutation<bigint, Error, DonateToCharityVariables>> {
  const { address } = useWallet()
  const { config } = useContract()
  const queryClient = useQueryClient()
  const toast = useToast()

  const transaction = useTransactionStatus()

  const mutation = useMutation<bigint, Error, DonateToCharityVariables>({
    mutationFn: async ({ amount, balance }: DonateToCharityVariables) => {
      if (!address) throw new Error('Wallet not connected.')
      if (amount <= 0n) throw new Error('Donation amount must be greater than zero.')
      if (amount > balance) throw new Error('Insufficient balance for this donation.')
      const client = new ScavengerClient({
        rpcUrl: config.rpcUrl,
        networkPassphrase: networkConfig.networkPassphrase,
        contractId: config.contractId
      })
      await client.donateToCharity(address, amount, address)
      return amount
    },
    onMutate: () => {
      transaction.markPending()
    },
    onSuccess: (amount) => {
      invalidateKeys(queryClient, invalidationPlan.donateToCharity())
      transaction.markSuccess()
      toast.success(`Successfully donated ${amount.toLocaleString()} tokens to charity.`)
    },
    onError: (error) => {
      transaction.markFailed(error)
      toast.error(error)
    }
  })

  return {
    ...mutation,
    donate: mutation.mutate,
    donateAsync: mutation.mutateAsync,
    status: transaction.status,
    isPending: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    error: mutation.error,
    reset: () => {
      transaction.reset()
      mutation.reset()
    }
  }
}
