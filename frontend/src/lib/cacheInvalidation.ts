/**
 * Which cache entries each mutation invalidates on success.
 *
 * Mutations call `invalidateKeys(queryClient, invalidationPlan.<name>(...))`
 * instead of listing keys inline, so a change to a key in cacheKeys.ts
 * reaches every invalidation site.
 *
 * Conventions:
 * - Every mutation that writes on-chain state has an entry here.
 * - Plans list the *narrowest* set of keys affected; broad list keys
 *   (e.g. `participantWastes()`) are used only when the mutation can
 *   affect an unknown participant's list.
 * - Keys are always sourced from `cacheKeys` so prefix matching stays
 *   consistent with the query definitions.
 */
import type { QueryClient } from '@tanstack/react-query'
import { cacheKeys } from './cacheKeys'

export const invalidationPlan = {
  // Waste lifecycle
  transferWaste: (wasteId: string) => [
    cacheKeys.participantWastes(),
    cacheKeys.transferHistory(wasteId),
    cacheKeys.waste(wasteId)
  ],
  confirmWaste: (wasteId: string) => [
    cacheKeys.participantWastes(),
    cacheKeys.waste(wasteId),
    cacheKeys.transferHistory(wasteId)
  ],
  recycleWaste: (recycler: string) => [
    cacheKeys.participantWastes(recycler),
    cacheKeys.participantWastes(),
    cacheKeys.supplyChainStats()
  ],

  // Rewards & incentives
  distributeRewards: () => [
    cacheKeys.rewards(),
    cacheKeys.participantStats(),
    cacheKeys.supplyChainStats()
  ],
  donateToCharity: () => [cacheKeys.rewards(), cacheKeys.participantStats()],
  claimIncentive: () => [
    cacheKeys.incentivesRoot(),
    cacheKeys.rewards(),
    cacheKeys.participantStats()
  ],

  // Participants
  registerParticipant: (address: string) => [
    cacheKeys.participant(address),
    cacheKeys.participantStats()
  ],
  updateParticipantRole: (address: string) => [
    cacheKeys.participant(address),
    cacheKeys.participantStats()
  ],

  // Admin / global state
  updateContractConfig: () => [
    cacheKeys.supplyChainStats(),
    cacheKeys.participantStats(),
    cacheKeys.rewards(),
    cacheKeys.incentivesRoot()
  ]
} as const

export type InvalidationPlanName = keyof typeof invalidationPlan

/**
 * Invalidate every key in a plan. Returns once all invalidations settle.
 */
export function invalidateKeys(
  queryClient: QueryClient,
  keys: readonly (readonly unknown[])[]
): Promise<void[]> {
  return Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })))
}

/**
 * Convenience helper: look up a plan by name, build its keys with `args`,
 * and invalidate them. Keeps mutation call sites free of key plumbing.
 */
export function invalidatePlan<K extends InvalidationPlanName>(
  queryClient: QueryClient,
  name: K,
  ...args: Parameters<(typeof invalidationPlan)[K]>
): Promise<void[]> {
  const plan = invalidationPlan[name] as (...a: typeof args) => readonly (readonly unknown[])[]
  return invalidateKeys(queryClient, plan(...args))
}
