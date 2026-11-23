import { Incentive, WasteType } from '@/api/types'
import { useWallet } from '@/context/WalletContext'
import { useToast } from '@/hooks/useToast'
import { cacheKeys } from '@/lib/cacheKeys'
import { useContractQuery, useContractMutation } from '@/hooks/useContractQuery'

const INCENTIVES_STALE_TIME = 30 * 1000 // 30 seconds

/**
 * Hook contract: `useIncentives`
 *
 * Reads the list of incentives for a given waste type (or all active
 * incentives when `wasteType` is omitted) and exposes mutations to create,
 * update and deactivate incentives.
 *
 * Contract:
 * - Data: `incentives` is always an array (empty while loading / on error).
 * - Loading/error: `isLoading`, `isError` and `error` (string | null) mirror
 *   the underlying query state.
 * - Wallet: `address` is the connected wallet address (or null).
 * - Mutations: `createIncentive`, `updateIncentive` and `deactivateIncentive`
 *   return promises that reject when the wallet is not connected or the
 *   contract call fails. Successful mutations invalidate the incentives cache
 *   and surface a toast.
 *
 * Backwards compatibility: the returned shape is unchanged from the previous
 * implementation; callers do not need to be updated.
 */
export function useIncentives(wasteType?: WasteType) {
  const { address } = useWallet()
  const toast = useToast()

  const { data, isLoading, isError } = useContractQuery<Incentive[]>({
    queryKey: cacheKeys.incentives(wasteType),
    queryFn: (client) =>
      wasteType !== undefined ? client.getIncentives(wasteType) : client.getActiveIncentives(),
    staleTime: INCENTIVES_STALE_TIME
  })

  const invalidate = cacheKeys.incentivesRoot()

  const createIncentive = useContractMutation({
    mutationFn: (
      client,
      { wt, rewardPoints, budget }: { wt: WasteType; rewardPoints: bigint; budget: bigint }
    ) => {
      if (!address) throw new Error('Wallet not connected.')
      return client.createIncentive(address, wt, rewardPoints, budget, address)
    },
    invalidateQueryKey: invalidate,
    onSuccess: (incentive) => toast.success(`Incentive #${incentive.id} created successfully.`),
    onError: (error) => toast.error(error)
  })

  const updateIncentive = useContractMutation({
    mutationFn: (
      client,
      { id, rewardPoints, budget }: { id: bigint; rewardPoints: bigint; budget: bigint }
    ) => {
      if (!address) throw new Error('Wallet not connected.')
      return client.updateIncentive(id, address, rewardPoints, budget, address)
    },
    invalidateQueryKey: invalidate,
    onSuccess: (incentive) => toast.success(`Incentive #${incentive.id} updated successfully.`),
    onError: (error) => toast.error(error)
  })

  const deactivateIncentive = useContractMutation({
    mutationFn: (client, { id }: { id: bigint }) => {
      if (!address) throw new Error('Wallet not connected.')
      return client.deactivateIncentive(id, address, address)
    },
    invalidateQueryKey: invalidate,
    onSuccess: () => toast.success('Incentive deactivated.'),
    onError: (error) => toast.error(error)
  })

  return {
    incentives: data ?? [],
    isLoading,
    isError,
    error: isError ? 'Failed to load incentives' : null,
    address,
    createIncentive: (wt: WasteType, rewardPoints: bigint, budget: bigint) =>
      createIncentive.mutateAsync({ wt, rewardPoints, budget }),
    updateIncentive: (id: number | bigint, rewardPoints: bigint, budget: bigint) =>
      updateIncentive.mutateAsync({ id: BigInt(id), rewardPoints, budget }),
    deactivateIncentive: (id: number | bigint) =>
      deactivateIncentive.mutateAsync({ id: BigInt(id) })
  }
}
