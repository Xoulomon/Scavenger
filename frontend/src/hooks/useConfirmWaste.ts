import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ScavengerClient } from '@/api/client'
import { useWallet } from '@/context/WalletContext'
import { useContract } from '@/context/ContractContext'
import { useToast } from '@/hooks/useToast'
import { networkConfig } from '@/lib/stellar'
import { invalidateKeys, invalidationPlan } from '@/lib/cacheInvalidation'

export function useConfirmWaste() {
  const { address } = useWallet()
  const { config } = useContract()
  const queryClient = useQueryClient()
  const toast = useToast()

  return useMutation({
    mutationFn: async (wasteId: bigint) => {
      if (!address) throw new Error('Wallet not connected.')
      const client = new ScavengerClient({
        rpcUrl: config.rpcUrl,
        networkPassphrase: networkConfig.networkPassphrase,
        contractId: config.contractId,
      })
      await client.confirmWasteDetails(wasteId, address, address)
      return wasteId
    },
    onSuccess: (wasteId) => {
      invalidateKeys(queryClient, invalidationPlan.confirmWaste(wasteId.toString()))
      toast.success(`Waste #${wasteId} confirmed successfully.`)
    },
    onError: (error) => {
      toast.error(error)
    },
  })
}
