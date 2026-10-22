import { useQueryClient } from '@tanstack/react-query'
import { ScavengerClient } from '@/api/client'
import { useWallet } from '@/context/WalletContext'
import { useContract } from '@/context/ContractContext'
import { networkConfig } from '@/lib/stellar'
import { StrKey } from '@stellar/stellar-sdk'
import { useOfflineMutation } from '@/hooks/useOfflineMutation'
import { invalidateKeys, invalidationPlan } from '@/lib/cacheInvalidation'

export interface TransferWasteParams {
  wasteId: bigint
  to: string
}

export function useTransferWaste() {
  const { address } = useWallet()
  const { config } = useContract()
  const queryClient = useQueryClient()

  return useOfflineMutation({
    mutationFn: async ({ wasteId, to }: TransferWasteParams) => {
      if (!address) throw new Error('Wallet not connected.')
      if (!StrKey.isValidEd25519PublicKey(to)) throw new Error('Invalid recipient address.')
      if (to === address) throw new Error('Cannot transfer waste to yourself.')

      const client = new ScavengerClient({
        rpcUrl: config.rpcUrl,
        networkPassphrase: networkConfig.networkPassphrase,
        contractId: config.contractId,
      })

      await client.transferWaste(wasteId, address, to, 0n, 0n, '', address)
      return to
    },
    onSuccess: (_to, { wasteId }) => {
      invalidateKeys(queryClient, invalidationPlan.transferWaste(wasteId.toString()))
    },
    mutationKey: ['transfer-waste'],
  })
}
