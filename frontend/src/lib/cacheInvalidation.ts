/**
 * Which cache entries each mutation invalidates on success.
 *
 * Mutations call `invalidateKeys(queryClient, invalidationPlan.<name>(...))`
 * instead of listing keys inline, so a change to a key in cacheKeys.ts
 * reaches every invalidation site.
 */
import type { QueryClient } from '@tanstack/react-query'
import { cacheKeys } from './cacheKeys'

export const invalidationPlan = {
  transferWaste: (wasteId: string) => [
    cacheKeys.participantWastes(),
    cacheKeys.transferHistory(wasteId),
  ],
  confirmWaste: (wasteId: string) => [
    cacheKeys.participantWastes(),
    cacheKeys.waste(wasteId),
  ],
  distributeRewards: () => [
    cacheKeys.rewards(),
    cacheKeys.participantStats(),
    cacheKeys.supplyChainStats(),
  ],
  donateToCharity: () => [cacheKeys.rewards()],
  registerParticipant: (address: string) => [cacheKeys.participant(address)],
  recycleWaste: (recycler: string) => [cacheKeys.participantWastes(recycler)],
  claimIncentive: () => [cacheKeys.incentivesRoot()],
} as const

export function invalidateKeys(
  queryClient: QueryClient,
  keys: readonly (readonly unknown[])[]
): Promise<void[]> {
  return Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })))
}
