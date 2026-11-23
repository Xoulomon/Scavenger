import '@tanstack/react-query'
import { useContractQuery } from '@/hooks/useContractQuery'
import { cacheKeys } from '@/lib/cacheKeys'

/**
 * Hook contract: useParticipantStats
 *
 * Fetches aggregated participant statistics for a given Stellar address.
 *
 * @param address - The participant's Stellar address. When `undefined` (or
 *   empty), the query is disabled and no request is made.
 *
 * @returns A TanStack Query result whose `data` is the participant stats
 *   object returned by `ScavengerClient.getStats`. The query is keyed by
 *   `cacheKeys.participantStats(address)` and uses a 60s `staleTime`.
 *
 * Backwards compatibility: the signature `(address: string | undefined)` is
 * preserved. Internally this delegates to the consolidated
 * `useContractQuery` hook (which owns client construction via
 * `ContractContext`) instead of a local `useClient` helper.
 */
export function useParticipantStats(address: string | undefined) {
  return useContractQuery({
    queryKey: cacheKeys.participantStats(address ?? ''),
    queryFn: (client) => client.getStats(address!),
    enabled: !!address,
    staleTime: 60_000
  })
}
