import { useQueryClient } from '@tanstack/react-query'
import { ScavengerClient } from '@/api/client'
import { useWallet } from '@/context/WalletContext'
import { useContract } from '@/context/ContractContext'
import { networkConfig } from '@/lib/stellar'
import { StrKey } from '@stellar/stellar-sdk'
import { useOfflineMutation } from '@/hooks/useOfflineMutation'
import { invalidateKeys, invalidationPlan } from '@/lib/cacheInvalidation'
import {
  useTransactionStatus,
  type TransactionStatus,
  type TransactionLifecycle
} from '@/hooks/useTransactionStatus'

export interface TransferWasteParams {
  wasteId: bigint
  to: string
}

export interface UseTransferWasteResult {
  /** Trigger the transfer mutation. */
  transferWaste: (params: TransferWasteParams) => void
  /** Async variant of the transfer mutation. */
  transferWasteAsync: (params: TransferWasteParams) => Promise<string>
  /** Whether the mutation is currently in flight. */
  isPending: boolean
  /** Whether the mutation completed successfully. */
  isSuccess: boolean
  /** Whether the mutation failed. */
  isError: boolean
  /** The error thrown by the mutation, if any. */
  error: Error | null
  /** The recipient address returned on success. */
  data: string | undefined
  /** Shared pending/success/failed lifecycle state. */
  status: TransactionStatus
  /** Full lifecycle descriptor from the shared transaction-status module. */
  lifecycle: TransactionLifecycle
  /** Reset the mutation and lifecycle state. */
  reset: () => void
}

export function useTransferWaste(): UseTransferWasteResult {
  const { address } = useWallet()
  const { config } = useContract()
  const queryClient = useQueryClient()

  const mutation = useOfflineMutation({
    mutationFn: async ({ wasteId, to }: TransferWasteParams) => {
      if (!address) throw new Error('Wallet not connected.')
      if (!StrKey.isValidEd25519PublicKey(to)) throw new Error('Invalid recipient address.')
      if (to === address) throw new Error('Cannot transfer waste to yourself.')

      const client = new ScavengerClient({
        rpcUrl: config.rpcUrl,
        networkPassphrase: networkConfig.networkPassphrase,
        contractId: config.contractId
      })

      await client.transferWaste(wasteId, address, to, 0n, 0n, '', address)
      return to
    },
    onSuccess: (_to, { wasteId }) => {
      invalidateKeys(queryClient, invalidationPlan.transferWaste(wasteId.toString()))
    },
    mutationKey: ['transfer-waste']
  })

  const {
    status,
    lifecycle,
    reset: resetStatus
  } = useTransactionStatus({
    isPending: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    error: mutation.error ?? null
  })

  const reset = () => {
    mutation.reset()
    resetStatus()
  }

  return {
    transferWaste: mutation.mutate,
    transferWasteAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    error: mutation.error ?? null,
    data: mutation.data,
    status,
    lifecycle,
    reset
  }
}
