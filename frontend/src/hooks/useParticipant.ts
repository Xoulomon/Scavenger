import '@tanstack/react-query'
import { Participant } from '@/api/types'
import { useWallet } from '@/context/WalletContext'
import { useContract } from '@/context/ContractContext'
import { cacheKeys } from '@/lib/cacheKeys'
import { queryCachePolicy } from '@/lib/queryClient'
import { useContractQuery } from './useContractQuery'

/**
 * useParticipant
 *
 * Hook contract:
 * - Reads the connected wallet address from `useWallet` and the active
 *   contract configuration from `useContract`.
 * - Fetches the current `Participant` record for the connected address via
 *   the consolidated `useContractQuery` hook (which owns `ScavengerClient`
 *   construction and network wiring).
 * - The query is disabled when no wallet address is connected and does not
 *   retry on failure.
 *
 * Returns (stable, backwards-compatible shape):
 * - `participant`: `Participant | null` — the participant record, or `null`
 *   when disconnected / not yet loaded / not found.
 * - `isLoading`: `boolean` — true while the query is in flight.
 * - `isError`: `boolean` — true if the query failed.
 */
export function useParticipant() {
  const { address } = useWallet()
  const { config } = useContract()

  const { data, isLoading, isError } = useContractQuery<Participant | null>({
    queryKey: cacheKeys.participant(address),
    queryFn: (client) => {
      if (!address) return Promise.resolve(null)
      return client.getParticipant(address)
    },
    enabled: !!address,
    ...queryCachePolicy,
    retry: false,
    config
  })

  return {
    participant: data ?? null,
    isLoading,
    isError
  }
}
