import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ScavengerClient } from '@/api/client'
import { WasteType } from '@/api/types'
import { useContract } from '@/context/ContractContext'
import { networkConfig } from '@/lib/stellar'
import { useToast } from '@/hooks/useToast'
import { invalidateKeys, invalidationPlan } from '@/lib/cacheInvalidation'

export interface RecycleWasteParams {
  recycler: string
  wasteType: WasteType
  /** Weight in grams */
  weightGrams: bigint
  /** Latitude in microdegrees (e.g. 40_714_000 for 40.714°) */
  latitude: bigint
  /** Longitude in microdegrees */
  longitude: bigint
}

export function useRecycleWaste() {
  const { config } = useContract()
  const queryClient = useQueryClient()
  const toast = useToast()

  return useMutation<bigint, Error, RecycleWasteParams>({
    mutationFn: async ({ recycler, wasteType, weightGrams, latitude, longitude }) => {
      const client = new ScavengerClient({
        rpcUrl: config.rpcUrl,
        networkPassphrase: networkConfig.networkPassphrase,
        contractId: config.contractId,
      })
      return client.recycleWaste(recycler, wasteType, weightGrams, latitude, longitude, recycler)
    },
    onSuccess: (wasteId, { recycler }) => {
      toast.success(`Waste registered successfully. ID: #${wasteId}`)
      // Invalidate participant wastes so the list refreshes
      invalidateKeys(queryClient, invalidationPlan.recycleWaste(recycler))
    },
    onError: (error) => {
      toast.error(error)
    },
  })
}
