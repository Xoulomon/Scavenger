import { useQuery } from '@tanstack/react-query'
import { ScavengerClient } from '@/api/client'
import { useContract } from '@/context/ContractContext'
import { networkConfig } from '@/lib/stellar'
import type { GlobalMetrics, Incentive } from '@/api/types'
import { cacheKeys } from '@/lib/cacheKeys'

function useAdminClient() {
  const { config } = useContract()
  return () =>
    new ScavengerClient({
      rpcUrl: config.rpcUrl,
      networkPassphrase: networkConfig.networkPassphrase,
      contractId: config.contractId,
    })
}

export function useAdminMetrics() {
  const makeClient = useAdminClient()
  return useQuery<GlobalMetrics>({
    queryKey: cacheKeys.adminMetrics(),
    queryFn: async () => makeClient().getMetrics(),
    staleTime: 30_000,
  })
}

export function useAdminIncentives() {
  const makeClient = useAdminClient()
  return useQuery<Incentive[]>({
    queryKey: cacheKeys.adminIncentives(),
    queryFn: async () => makeClient().getActiveIncentives(),
    staleTime: 30_000,
  })
}

export function useAdminWasteLookup(wasteId: bigint | null) {
  const makeClient = useAdminClient()
  return useQuery({
    queryKey: cacheKeys.adminWaste(wasteId?.toString()),
    queryFn: async () => makeClient().getWaste(wasteId!),
    enabled: wasteId !== null,
  })
}
