import { useMemo } from 'react'
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
      contractId: config.contractId
    })
}

export function useAdminMetrics() {
  const makeClient = useAdminClient()
  return useQuery<GlobalMetrics>({
    queryKey: cacheKeys.adminMetrics(),
    queryFn: async () => makeClient().getMetrics(),
    staleTime: 30_000
  })
}

export function useAdminIncentives() {
  const makeClient = useAdminClient()
  return useQuery<Incentive[]>({
    queryKey: cacheKeys.adminIncentives(),
    queryFn: async () => makeClient().getActiveIncentives(),
    staleTime: 30_000
  })
}

export function useAdminWasteLookup(wasteId: bigint | null) {
  const makeClient = useAdminClient()
  return useQuery({
    queryKey: cacheKeys.adminWaste(wasteId?.toString()),
    queryFn: async () => makeClient().getWaste(wasteId!),
    enabled: wasteId !== null
  })
}

/**
 * Memoized derived selectors for the admin dashboard.
 *
 * These selectors compute derived values from the raw query results and
 * memoize them so that consumers receive stable references across renders
 * as long as the underlying data has not changed. This avoids unnecessary
 * re-renders of memoized child components and keeps downstream `useMemo`
 * dependencies stable.
 */
export function useAdminDashboardSelectors() {
  const metricsQuery = useAdminMetrics()
  const incentivesQuery = useAdminIncentives()

  const metrics = metricsQuery.data
  const incentives = incentivesQuery.data

  const totalIncentives = useMemo(() => (incentives ? incentives.length : 0), [incentives])

  const activeIncentiveIds = useMemo(
    () => (incentives ? incentives.map((incentive) => incentive.id) : []),
    [incentives]
  )

  const totalWasteProcessed = useMemo(() => metrics?.totalWasteProcessed ?? 0, [metrics])

  const totalTokensEarned = useMemo(() => metrics?.totalTokensEarned ?? 0, [metrics])

  const isLoading = metricsQuery.isLoading || incentivesQuery.isLoading
  const isError = metricsQuery.isError || incentivesQuery.isError

  return useMemo(
    () => ({
      metrics,
      incentives,
      totalIncentives,
      activeIncentiveIds,
      totalWasteProcessed,
      totalTokensEarned,
      isLoading,
      isError
    }),
    [
      metrics,
      incentives,
      totalIncentives,
      activeIncentiveIds,
      totalWasteProcessed,
      totalTokensEarned,
      isLoading,
      isError
    ]
  )
}
