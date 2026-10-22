import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ScavengerClient } from '@/api/client'
import { useWallet } from '@/context/WalletContext'
import { useContract } from '@/context/ContractContext'
import { useToast } from '@/hooks/useToast'
import { networkConfig } from '@/lib/stellar'
import { invalidateKeys, invalidationPlan } from '@/lib/cacheInvalidation'

export function useDonateToCharity() {
  const { address } = useWallet()
  const { config } = useContract()
  const queryClient = useQueryClient()
  const toast = useToast()

  return useMutation({
    mutationFn: async ({ amount, balance }: { amount: bigint; balance: bigint }) => {
      if (!address) throw new Error('Wallet not connected.')
      if (amount <= 0n) throw new Error('Donation amount must be greater than zero.')
      if (amount > balance) throw new Error('Insufficient balance for this donation.')
      const client = new ScavengerClient({
        rpcUrl: config.rpcUrl,
        networkPassphrase: networkConfig.networkPassphrase,
        contractId: config.contractId,
      })
      await client.donateToCharity(address, amount, address)
      return amount
    },
    onSuccess: (amount) => {
      invalidateKeys(queryClient, invalidationPlan.donateToCharity())
      toast.success(`Successfully donated ${amount.toLocaleString()} tokens to charity.`)
    },
    onError: (error) => {
      toast.error(error)
    },
  })
}
