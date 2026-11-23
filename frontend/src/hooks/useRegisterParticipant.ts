import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ScavengerClient } from '@/lib/contract'
import { Role, Participant } from '@/api/types'
import { useContract } from '@/context/ContractContext'
import { networkConfig } from '@/lib/stellar'
import { useToast } from '@/hooks/useToast'
import { roleLabel } from '@/lib/helpers'
import { cacheKeys } from '@/lib/cacheKeys'
import { useTransactionStatus, type TransactionLifecycle } from '@/hooks/useTransactionStatus'

export interface RegisterParticipantParams {
  address: string
  role: Role
  name: string
  /** Latitude in microdegrees (default 0) */
  lat?: number
  /** Longitude in microdegrees (default 0) */
  lon?: number
}

export interface UseRegisterParticipantResult {
  /** The underlying mutation (backwards-compatible surface). */
  mutation: ReturnType<typeof useMutation<Participant, Error, RegisterParticipantParams>>
  /** Shared pending/success/failed lifecycle state. */
  lifecycle: TransactionLifecycle
  /** Convenience flags derived from the lifecycle. */
  isPending: boolean
  isSuccess: boolean
  isError: boolean
  /** Reset the lifecycle back to idle. */
  reset: () => void
}

export function useRegisterParticipant(): UseRegisterParticipantResult {
  const { config } = useContract()
  const queryClient = useQueryClient()
  const toast = useToast()
  const lifecycle = useTransactionStatus()

  const mutation = useMutation<Participant, Error, RegisterParticipantParams>({
    mutationFn: ({ address, role, name, lat = 0, lon = 0 }) => {
      const client = new ScavengerClient({
        rpcUrl: config.rpcUrl,
        networkPassphrase: networkConfig.networkPassphrase,
        contractId: config.contractId
      })
      return client.registerParticipant(address, role, name, lat, lon, address)
    },
    onMutate: () => {
      lifecycle.setPending()
    },
    onSuccess: (participant, { address }) => {
      queryClient.invalidateQueries({ queryKey: cacheKeys.participant(address) })
      lifecycle.setSuccess()
      toast.success(
        `Registered as ${roleLabel(participant.role)}. Welcome, ${String(participant.name)}!`
      )
    },
    onError: (error) => {
      lifecycle.setFailed(error)
      toast.error(error)
    }
  })

  return {
    mutation,
    lifecycle,
    isPending: lifecycle.status === 'pending',
    isSuccess: lifecycle.status === 'success',
    isError: lifecycle.status === 'failed',
    reset: lifecycle.reset
  }
}
