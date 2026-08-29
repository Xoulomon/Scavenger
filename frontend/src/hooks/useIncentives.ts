import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Incentive, WasteType } from '@/api/types'
import { useContract } from '@/context/ContractContext'
import { networkConfig } from '@/lib/stellar'
import { useWallet } from '@/context/WalletContext'
import { useToast } from '@/hooks/useToast'
import { ScavengerClient } from '@/api/client'

const INCENTIVES_STALE_TIME = 30 * 1000 // 30 seconds

export function useIncentives(wasteType?: WasteType) {
  const { config } = useContract()
  const { address } = useWallet()
  const queryClient = useQueryClient()
  const toast = useToast()

  const { data, isLoading, isError } = useQuery<Incentive[]>({
    queryKey: ['incentives', wasteType ?? 'all'],
    queryFn: async () => {
      const client = new ScavengerClient({
        rpcUrl: config.rpcUrl,
        networkPassphrase: networkConfig.networkPassphrase,
        contractId: config.contractId,
      })
      if (wasteType !== undefined) return client.getIncentives(wasteType)
      return client.getActiveIncentives()
    },
    staleTime: INCENTIVES_STALE_TIME,
  })

  const getClient = () =>
    new ScavengerClient({
      rpcUrl: config.rpcUrl,
      networkPassphrase: networkConfig.networkPassphrase,
      contractId: config.contractId,
    })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['incentives'] })

  const createIncentive = useMutation({
    mutationFn: ({ wt, rewardPoints, budget }: { wt: WasteType; rewardPoints: bigint; budget: bigint }) => {
      if (!address) throw new Error('Wallet not connected.')
      return getClient().createIncentive(address, wt, rewardPoints, budget, address)
    },
    onSuccess: (incentive) => {
      invalidate()
      toast.success(`Incentive #${incentive.id} created successfully.`)
    },
    onError: (error) => toast.error(error),
  })

  const updateIncentive = useMutation({
    mutationFn: ({ id, rewardPoints, budget }: { id: bigint; rewardPoints: bigint; budget: bigint }) => {
      if (!address) throw new Error('Wallet not connected.')
      return getClient().updateIncentive(id, address, rewardPoints, budget, address)
    },
    onSuccess: (incentive) => {
      invalidate()
      toast.success(`Incentive #${incentive.id} updated successfully.`)
    },
    onError: (error) => toast.error(error),
  })

  const deactivateIncentive = useMutation({
    mutationFn: ({ id }: { id: bigint }) => {
      if (!address) throw new Error('Wallet not connected.')
      return getClient().deactivateIncentive(id, address, address)
    },
    onSuccess: () => {
      invalidate()
      toast.success('Incentive deactivated.')
    },
    onError: (error) => toast.error(error),
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
    deactivateIncentive: (id: number | bigint) => deactivateIncentive.mutateAsync({ id: BigInt(id) }),
  }
}
