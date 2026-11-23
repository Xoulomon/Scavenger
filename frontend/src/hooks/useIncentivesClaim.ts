import { Incentive } from '@/api/types'
import { useContractMutation } from '@/hooks/useContractMutation'
import { useTransactionStatus } from '@/hooks/useTransactionStatus'
import { cacheKeys } from '@/lib/cacheKeys'

/**
 * Hook contract: `useIncentivesClaim`
 *
 * Inputs: none.
 *
 * Returns:
 * - `claimIncentive(incentiveId: number): Promise<void>` — triggers the claim
 *   mutation for the given incentive. Rejects if the mutation fails.
 * - `isClaiming: boolean` — `true` while a claim mutation is in flight.
 *
 * Behaviour:
 * - Optimistically decrements `remaining_budget` (floored at 0) for the
 *   matching incentive in the `cacheKeys.incentives()` query cache.
 * - On error, rolls back to the previous cache snapshot and shows an error
 *   toast ("Failed to claim incentive. Please try again.").
 * - On settle, invalidates `cacheKeys.incentivesRoot()` to resync with the
 *   server.
 *
 * Backwards compatibility: the return shape (`claimIncentive`, `isClaiming`)
 * is unchanged from the previous standalone implementation.
 *
 * Built on the shared `useContractMutation` hook, which provides the
 * optimistic-update/rollback/invalidate lifecycle.
 */
export function useIncentivesClaim() {
  const { status, start, succeed, fail, reset } = useTransactionStatus()

  const mutation = useContractMutation<void, number, Incentive[]>({
    mutationFn: async (_incentiveId: number) => {
      // The actual on-chain claim is handled by distributeRewards in the contract.
      // Here we simulate the claim action — in a real integration this would call
      // ScavengerClient.distributeRewards or a dedicated claim endpoint.
      // For now we resolve immediately; the optimistic update handles the UI.
      return Promise.resolve()
    },
    queryKey: cacheKeys.incentives(),
    invalidateKey: cacheKeys.incentivesRoot(),
    errorMessage: 'Failed to claim incentive. Please try again.',
    onMutate: () => {
      // Enter the shared pending lifecycle state
      start()
    },
    onError: () => {
      fail('Failed to claim incentive. Please try again.')
    },
    onSuccess: () => {
      succeed()
    },
    optimisticUpdate: (old, incentiveId) => {
      if (!old) return old
      return old.map((inc) =>
        inc.id === incentiveId
          ? { ...inc, remaining_budget: Math.max(0, inc.remaining_budget - 1) }
          : inc
      )
    }
  })

  return {
    claimIncentive: (incentiveId: number) => mutation.mutateAsync(incentiveId),
    isClaiming: mutation.isPending,
    // Shared transaction lifecycle state (pending/success/failed)
    status,
    resetStatus: reset
  }
}
