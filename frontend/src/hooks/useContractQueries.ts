/**
 * Generic contract query hooks for parameter-based queries.
 *
 * These hooks are used when you need to query data for a specific entity (by ID/address).
 * For hooks that use context (e.g., current wallet), see individual hook files instead.
 *
 * Example:
 *   - useParticipantStats(address) — query stats for a specific address
 *   - useParticipant() from useParticipant.ts — query current wallet's participant
 *
 * See Issue #1056 for the consolidation effort.
 */

import { WasteType } from '@/api/types'
import { useContractQuery } from '@/hooks/useContractQuery'
import { cacheKeys } from '@/lib/cacheKeys'
import { queryCachePolicy } from '@/lib/queryClient'

/**
 * Query participant data by address.
 *
 * Contract:
 * - Input: `address` — participant address; when undefined the query is disabled.
 * - Output: standard React Query result whose `data` is the participant record.
 * - Cache: keyed by `cacheKeys.participant(address)`, stale after 60s.
 *
 * For getting the current wallet's participant, use useParticipant() from useParticipant.ts instead.
 */
export function useParticipantById(address: string | undefined) {
  return useContractQuery({
    queryKey: cacheKeys.participant(address ?? ''),
    queryFn: (client) => client.getParticipant(address!),
    enabled: !!address,
    ...queryCachePolicy.participant
  })
}

/**
 * Deprecated: Use useParticipantById(address) or useParticipant() from useParticipant.ts instead.
 * Kept for backward compatibility; delegates to useParticipantById.
 */
export function useParticipant(address: string | undefined) {
  return useParticipantById(address)
}

export { useParticipantStats } from '@/hooks/useParticipantStats'

/**
 * Query waste data by ID.
 *
 * Contract:
 * - Input: `id` — waste id; when undefined the query is disabled.
 * - Output: standard React Query result whose `data` is the waste record.
 * - Cache: keyed by `cacheKeys.waste(id)`, stale after 30s.
 *
 * For getting the current participant's wastes, use useWastes() from useWastes.ts instead.
 */
export function useWaste(id: bigint | undefined) {
  return useContractQuery({
    queryKey: cacheKeys.waste(id?.toString() ?? ''),
    queryFn: (client) => client.getWaste(id!),
    enabled: id !== undefined,
    ...queryCachePolicy.waste
  })
}

export { useMetrics } from '@/hooks/useMetrics'
export { useActiveIncentives } from '@/hooks/useActiveIncentives'

/**
 * Query incentives by waste type.
 *
 * Contract:
 * - Input: `wasteType` — waste type filter; when undefined the query is disabled.
 * - Output: standard React Query result whose `data` is the incentives list.
 * - Cache: keyed by `cacheKeys.incentives(wasteType)`, stale after 5 minutes.
 *
 * For getting all incentives, use useActiveIncentives() instead.
 */
export function useIncentives(wasteType: WasteType | undefined) {
  return useContractQuery({
    queryKey: cacheKeys.incentives(wasteType),
    queryFn: (client) => client.getIncentives(wasteType!),
    enabled: wasteType !== undefined,
    ...queryCachePolicy.incentives
  })
}

export { useSupplyChainStats } from '@/hooks/useSupplyChainStats'
