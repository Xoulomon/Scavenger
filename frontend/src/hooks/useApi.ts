/**
 * useApi — returns a ready-to-use ScavengerClient built from the current
 * ContractContext config and Stellar network settings.
 *
 * Contract:
 *   Inputs:  none (reads `config` from `ContractContext`).
 *   Outputs: a memoized `ScavengerClient` instance.
 *   Semantics:
 *     - The client is re-created only when `config.rpcUrl`,
 *       `config.contractId`, or `networkConfig.networkPassphrase` change;
 *       otherwise the same instance is returned.
 *     - `networkPassphrase` is taken from `networkConfig` (Stellar network
 *       settings) and is part of the memoization key, ensuring the client is
 *       rebuilt if network settings change.
 *
 * The client is memoized on the relevant config values so it stays stable
 * across renders. A stable client instance is important for TanStack Query:
 * it keeps `queryFn` references consistent and avoids unnecessary refetches.
 *
 * Standardized query pattern (TanStack Query conventions):
 *   const api = useApi()
 *   const { data } = useQuery({
 *     queryKey: queryKeys.participant(addr),
 *     queryFn: () => api.getParticipant(addr),
 *     // Caching, retries, and staleTime defaults are configured globally
 *     // in the QueryClient (see lib/queryClient.ts). Override per-query only
 *     // when necessary.
 *   })
 *
 * Invalidation convention:
 *   const queryClient = useQueryClient()
 *   // After a mutation, invalidate the affected keys:
 *   queryClient.invalidateQueries({ queryKey: queryKeys.participant(addr) })
 *
 * Backwards compatibility:
 *   `useApi` is the canonical hook. `useContractQuery` / `useContractQueries`
 *   are deprecated aliases that delegate to the consolidated generic
 *   implementations in `useResource` / `useAsync` (see those modules).
 *
 * Usage:
 *   const api = useApi()
 *   const { data } = useQuery({ queryKey: ['participant', addr], queryFn: () => api.getParticipant(addr) })
 *
 * For REST calls, use the centralized typed client from '@/services/apiClient'
 * (see `useApiClient` below) instead of ad-hoc fetch calls.
 *
 * Backwards-compatibility: the public signature `useApi(): ScavengerClient`
 * is unchanged. The returned client is the same instance consumed by the
 * shared transaction-status module (see `@/hooks/useTransactionStatus`), so
 * existing callers require no changes.
 *   The hook signature is unchanged — existing callers continue to work.
 *   Only the memoization dependencies were tightened to include the network
 *   passphrase, ensuring the client is rebuilt if network settings change.
 */
import { useMemo } from 'react'
import { ScavengerClient } from '@/api/client'
import { useContract } from '@/context/ContractContext'
import { networkConfig } from '@/lib/stellar'
import { ApiClient, createApiClient } from '@/services/apiClient'

export function useApi(): ScavengerClient {
  const { config } = useContract()
  const { rpcUrl, contractId } = config
  const { networkPassphrase } = networkConfig

  return useMemo(
    () =>
      new ScavengerClient({
        rpcUrl,
        networkPassphrase,
        contractId
      }),
    [rpcUrl, contractId, networkPassphrase]
  )
}

/**
 * useApiClient — returns the centralized typed REST client.
 *
 * All REST calls should be routed through this client so that error mapping
 * and response typing are consistent across the app.
 *
 * Usage:
 *   const client = useApiClient()
 *   const { data } = useQuery({ queryKey: ['participants'], queryFn: () => client.getParticipants() })
 */
export function useApiClient(): ApiClient {
  const { config } = useContract()
  return useMemo(
    () =>
      createApiClient({
        baseUrl: config.rpcUrl,
        networkPassphrase: networkConfig.networkPassphrase,
        contractId: config.contractId
      }),
    [config.rpcUrl, config.contractId]
  )
}

/**
 * @deprecated Use `useApi` instead. Retained as a backwards-compatible alias
 * for callers that imported the old name. Delegates directly to `useApi`.
 */
export const useContractQuery = useApi

/**
 * @deprecated Use `useApi` instead. Retained as a backwards-compatible alias
 * for callers that imported the old plural name. Delegates directly to
 * `useApi`; both names resolve to the same memoized client.
 */
export const useContractQueries = useApi

export default useApi
