import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ScavengerClient } from '@/lib/contract'
import { Role, Participant } from '@/api/types'
import { useContract } from '@/context/ContractContext'
import { networkConfig } from '@/lib/stellar'
import { useToast } from '@/hooks/useToast'
import { roleLabel } from '@/lib/helpers'
import { cacheKeys } from '@/lib/cacheKeys'

export interface RegisterParticipantParams {
  address: string
  role: Role
  name: string
  /** Latitude in microdegrees (default 0) */
  lat?: number
  /** Longitude in microdegrees (default 0) */
  lon?: number
}

export function useRegisterParticipant() {
  const { config } = useContract()
  const queryClient = useQueryClient()
  const toast = useToast()

  return useMutation<Participant, Error, RegisterParticipantParams>({
    mutationFn: ({ address, role, name, lat = 0, lon = 0 }) => {
      const client = new ScavengerClient({
        rpcUrl: config.rpcUrl,
        networkPassphrase: networkConfig.networkPassphrase,
        contractId: config.contractId,
      })
      return client.registerParticipant(address, role, name, lat, lon, address)
    },
    onSuccess: (participant, { address }) => {
      queryClient.invalidateQueries({ queryKey: cacheKeys.participant(address) })
      toast.success(
        `Registered as ${roleLabel(participant.role)}. Welcome, ${String(participant.name)}!`
      )
    },
    onError: (error) => {
      toast.error(error)
    },
  })
}
