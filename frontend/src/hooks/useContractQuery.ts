/**
 * Consolidated contract-query module.
 *
 * This module is the single home for the TanStack Query wrappers that wire the
 * `ScavengerClient` into a consistent query/mutation pattern used across the app.
 * It merges the former `useContractQuery.ts` and `useContractQueries.ts` files
 * (see #1693) and documents the contract each hook exposes.
 *
 * Hooks provided:
 *  - `useContractQuery`      — generic read-only contract call (useQuery).
 *  - `useContractMutation`   — generic mutating contract call (useMutation).
 *  - `useContractQueryFn`    — parameter-based read-only query hook.
 *  - `useContractMutationFn` — parameter-based mutation hook.
 *
 * Backwards compatibility:
 *  - `useContractQuery` / `useContractMutation` keep their original signatures.
 *  - The parameter-based hooks previously exported from `useContractQueries.ts`
 *    are re-exported here; `useContractQueries.ts` now re-exports from this file
 *    so existing imports keep working (deprecated, prefer importing from here).
 *
 * All hooks obtain the client via `useApi()` so client construction is not
 * duplicated across call sites.
 */
import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
  type UseMutationOptions,
  type QueryKey
} from '@tanstack/react-query'
import { useApi } from './useApi'
import { ScavengerClient } from '@/api/client'
import { ContractError } from '@/api/types'
import { cacheKeys } from '@/lib/queryKeys'
import { queryCachePolicy } from '@/lib/queryClient'

// ── Query ─────────────────────────────────────────────────────────────────────

/**
 * A read-only contract call. Receives the shared `ScavengerClient` and returns
 * the resolved data.
 */
type ContractQueryFn<T> = (client: ScavengerClient) => Promise<T>

/**
 * `useContractQuery` — generic read-only contract call.
 *
 * Contract:
 *  - `queryKey` uniquely identifies the query in the TanStack cache.
 *  - `fn` is invoked with the client from `useApi()`.
 *  - `options` may override any `useQuery` option except `queryKey`/`queryFn`.
 *
 * @returns the standard `useQuery` result for `T`.
 */
export function useContractQuery<T>(
  queryKey: QueryKey,
  fn: ContractQueryFn<T>,
  options?: Omit<UseQueryOptions<T, ContractError>, 'queryKey' | 'queryFn'>
) {
  const api = useApi()
  return useQuery<T, ContractError>({
    ...queryCachePolicy,
    queryKey,
    queryFn: () => fn(api),
    ...options
  })
}

// ── Mutation ──────────────────────────────────────────────────────────────────

/**
 * A mutating contract call. Receives the shared `ScavengerClient` plus the
 * caller-supplied variables and returns the mutation result.
 */
type ContractMutationFn<TVariables, TData> = (
  client: ScavengerClient,
  variables: TVariables
) => Promise<TData>

/**
 * `useContractMutation` — generic mutating contract call.
 *
 * Contract:
 *  - `fn` is invoked with the client from `useApi()` and the mutation variables.
 *  - `invalidateKeys` (optional) lists query keys invalidated on success before
 *    the caller's `onSuccess` runs.
 *  - All other `useMutation` options are forwarded unchanged.
 *
 * @returns the standard `useMutation` result for `TData`.
 */
export function useContractMutation<TVariables, TData = void>(
  fn: ContractMutationFn<TVariables, TData>,
  options?: Omit<UseMutationOptions<TData, ContractError, TVariables>, 'mutationFn'> & {
    invalidateKeys?: QueryKey[]
  }
) {
  const api = useApi()
  const queryClient = useQueryClient()
  const { invalidateKeys, ...restOptions } = options ?? {}

  return useMutation<TData, ContractError, TVariables>({
    mutationFn: (variables) => fn(api, variables),
    onSuccess: async (data, variables, context) => {
      if (invalidateKeys) {
        await Promise.all(
          invalidateKeys.map((key) => queryClient.invalidateQueries({ queryKey: key }))
        )
      }
      // Always refresh the shared contract cache after a successful mutation
      // so read queries stay consistent with the latest on-chain state.
      await queryClient.invalidateQueries({ queryKey: cacheKeys.contracts.all })
      restOptions.onSuccess?.(data, variables, context)
    },
    ...restOptions
  })
}

// ── Parameter-based query hooks ───────────────────────────────────────────────

/**
 * Parameters accepted by the parameter-based query hooks. `queryKey` identifies
 * the cache entry; `fn` performs the read against the shared client.
 */
export interface ContractQueryParams<T> {
  queryKey: QueryKey
  fn: ContractQueryFn<T>
  options?: Omit<UseQueryOptions<T, ContractError>, 'queryKey' | 'queryFn'>
}

/**
 * `useContractQueryFn` — parameter-based read-only query hook.
 *
 * Contract: equivalent to `useContractQuery` but accepts a single params object,
 * which is convenient when forwarding query configuration from a parent.
 */
export function useContractQueryFn<T>(params: ContractQueryParams<T>) {
  return useContractQuery<T>(params.queryKey, params.fn, params.options)
}

/**
 * Parameters accepted by the parameter-based mutation hook.
 */
export interface ContractMutationParams<TVariables, TData> {
  fn: ContractMutationFn<TVariables, TData>
  options?: Omit<UseMutationOptions<TData, ContractError, TVariables>, 'mutationFn'> & {
    invalidateKeys?: QueryKey[]
  }
}

/**
 * `useContractMutationFn` — parameter-based mutation hook.
 *
 * Contract: equivalent to `useContractMutation` but accepts a single params
 * object for callers that forward mutation configuration.
 */
export function useContractMutationFn<TVariables, TData = void>(
  params: ContractMutationParams<TVariables, TData>
) {
  return useContractMutation<TVariables, TData>(params.fn, params.options)
}

// ── Deprecated aliases (backwards compatibility) ──────────────────────────────

/**
 * @deprecated Import `useContractQueryFn` from `@/hooks/useContractQuery` instead.
 */
export const useContractQueries = useContractQueryFn

/**
 * @deprecated Import `useContractMutationFn` from `@/hooks/useContractQuery` instead.
 */
export const useContractMutations = useContractMutationFn
