import { useCallback, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useWallet } from '@/context/WalletContext'
import { Material } from '@/api/types'
import { useToast } from '@/hooks/useToast'
import { cacheKeys } from '@/lib/queryClient'
import { queryCachePolicy } from '@/lib/queryCachePolicy'
import { useScavengerClient } from '@/hooks/useScavengerClient'

/**
 * Contract for `useWasteList`:
 *
 * - Reads the connected wallet address from `WalletContext` and the contract
 *   client from the consolidated `useScavengerClient` hook.
 * - Loads the participant's waste materials plus the contract admin address
 *   via a React Query cache entry (which owns loading/error state and reload
 *   semantics).
 * - Exposes mutation helpers (`confirmWaste`, `transferWaste`, and the
 *   `batch*` variants) that perform optimistic updates where applicable and
 *   reload the list afterwards.
 * - The returned object shape is stable for backwards compatibility:
 *   `{ wastes, isLoading, error, isAdmin, reload, confirmWaste, transferWaste,
 *      batchConfirmWastes, batchVerifyWastes, batchTransferWastes,
 *      batchDeactivateWastes }`.
 */
export function useWasteList() {
  const { address } = useWallet()
  const toast = useToast()
  const queryClient = useQueryClient()
  const getClient = useScavengerClient()

  const wastesQuery = useQuery({
    queryKey: cacheKeys.wasteList(address ?? ''),
    queryFn: async () => {
      if (!address) return { adminAddress: null, wastes: [] as Material[] }
      const client = getClient()
      const [admin, ids] = await Promise.all([
        client.getAdmin().catch(() => null),
        client.getParticipantWastes(address as string)
      ])
      const materials = await Promise.all(ids.map((id) => client.getMaterial(id)))
      return {
        adminAddress: admin,
        wastes: materials.filter((m): m is Material => m !== null)
      }
    },
    enabled: Boolean(address),
    ...queryCachePolicy
  })

  const wastes = wastesQuery.data?.wastes ?? []
  const adminAddress = wastesQuery.data?.adminAddress ?? null
  const isLoading = wastesQuery.isLoading
  const error = wastesQuery.error
    ? wastesQuery.error instanceof Error
      ? wastesQuery.error.message
      : 'Failed to load wastes'
    : null

  const load = useCallback(async () => {
    if (!address) return
    await queryClient.invalidateQueries({ queryKey: cacheKeys.wasteList(address) })
  }, [address, queryClient])

  const confirmWaste = useCallback(
    async (wasteId: number | bigint) => {
      if (!address) return
      const queryKey = cacheKeys.wasteList(address)
      // Optimistic update
      queryClient.setQueryData<{ adminAddress: string | null; wastes: Material[] }>(
        queryKey,
        (prev) =>
          prev
            ? {
                ...prev,
                wastes: prev.wastes.map((w) =>
                  BigInt(w.id) === BigInt(wasteId) ? { ...w, is_confirmed: true } : w
                )
              }
            : prev
      )
      try {
        await getClient().confirmWasteDetails(BigInt(wasteId), address, address)
        toast.success(`Waste #${wasteId} confirmed successfully.`)
        await queryClient.invalidateQueries({ queryKey })
      } catch (err) {
        // Revert optimistic update on failure
        await queryClient.invalidateQueries({ queryKey })
        toast.error(err)
      }
    },
    [address, getClient, queryClient, toast]
  )

  const transferWaste = useCallback(
    async (wasteId: number | bigint, to: string) => {
      if (!address) return
      await getClient().transferWaste(BigInt(wasteId), address, to, 0n, 0n, '', address)
      await load()
    },
    [address, getClient, load]
  )

  const batchConfirmWastes = useCallback(
    async (
      wasteIds: Array<number | bigint>,
      onProgress?: (completed: number, total: number) => void
    ) => {
      if (!address)
        return { succeeded: 0, failed: wasteIds.length, errors: ['No wallet connected'] }
      const client = getClient()
      const total = wasteIds.length
      let completed = 0
      let succeeded = 0
      const errors: string[] = []

      queryClient.setQueryData<{ adminAddress: string | null; wastes: Material[] }>(
        cacheKeys.wasteList(address),
        (prev) =>
          prev
            ? {
                ...prev,
                wastes: prev.wastes.map((w) =>
                  wasteIds.some((id) => BigInt(w.id) === BigInt(id))
                    ? { ...w, is_confirmed: true }
                    : w
                )
              }
            : prev
      )

      for (const wasteId of wasteIds) {
        try {
          await client.confirmWasteDetails(BigInt(wasteId), address, address)
          succeeded += 1
        } catch (err) {
          errors.push(err instanceof Error ? err.message : String(err))
        } finally {
          completed += 1
          onProgress?.(completed, total)
        }
      }

      await load()
      if (errors.length === 0) {
        toast.success(`Confirmed ${succeeded} waste item${succeeded !== 1 ? 's' : ''}.`)
      } else {
        toast.error(`Confirmed ${succeeded} of ${total} items. ${errors.length} failed.`)
      }

      return { succeeded, failed: total - succeeded, errors }
    },
    [address, getClient, load, queryClient, toast]
  )

  const batchVerifyWastes = useCallback(
    async (
      wasteIds: Array<number | bigint>,
      onProgress?: (completed: number, total: number) => void
    ) => {
      if (!address)
        return { succeeded: 0, failed: wasteIds.length, errors: ['No wallet connected'] }
      const client = getClient()
      const total = wasteIds.length
      let completed = 0
      let succeeded = 0
      const errors: string[] = []

      for (const wasteId of wasteIds) {
        try {
          await client.verifyMaterial(BigInt(wasteId), address, address)
          succeeded += 1
        } catch (err) {
          errors.push(err instanceof Error ? err.message : String(err))
        } finally {
          completed += 1
          onProgress?.(completed, total)
        }
      }

      await load()
      if (errors.length === 0) {
        toast.success(`Verified ${succeeded} waste item${succeeded !== 1 ? 's' : ''}.`)
      } else {
        toast.error(`Verified ${succeeded} of ${total} items. ${errors.length} failed.`)
      }

      return { succeeded, failed: total - succeeded, errors }
    },
    [address, getClient, load, queryClient, toast]
  )

  const batchTransferWastes = useCallback(
    async (
      wasteIds: Array<number | bigint>,
      to: string,
      onProgress?: (completed: number, total: number) => void
    ) => {
      if (!address)
        return { succeeded: 0, failed: wasteIds.length, errors: ['No wallet connected'] }
      const client = getClient()
      const total = wasteIds.length
      let completed = 0
      let succeeded = 0
      const errors: string[] = []
      const normalizedTo = to.trim()

      for (const wasteId of wasteIds) {
        try {
          await client.transferWaste(BigInt(wasteId), address, normalizedTo, 0n, 0n, '', address)
          succeeded += 1
        } catch (err) {
          errors.push(err instanceof Error ? err.message : String(err))
        } finally {
          completed += 1
          onProgress?.(completed, total)
        }
      }

      await load()
      if (errors.length === 0) {
        toast.success(`Transferred ${succeeded} waste item${succeeded !== 1 ? 's' : ''}.`)
      } else {
        toast.error(`Transferred ${succeeded} of ${total} items. ${errors.length} failed.`)
      }

      return { succeeded, failed: total - succeeded, errors }
    },
    [address, getClient, load, queryClient, toast]
  )

  const batchDeactivateWastes = useCallback(
    async (
      wasteIds: Array<number | bigint>,
      onProgress?: (completed: number, total: number) => void
    ) => {
      if (!address)
        return { succeeded: 0, failed: wasteIds.length, errors: ['No wallet connected'] }
      if (!adminAddress || address !== adminAddress) {
        return { succeeded: 0, failed: wasteIds.length, errors: ['Current wallet is not admin'] }
      }
      const client = getClient()
      const total = wasteIds.length
      let completed = 0
      let succeeded = 0
      const errors: string[] = []

      for (const wasteId of wasteIds) {
        try {
          await client.deactivateWaste(adminAddress, BigInt(wasteId), address)
          succeeded += 1
        } catch (err) {
          errors.push(err instanceof Error ? err.message : String(err))
        } finally {
          completed += 1
          onProgress?.(completed, total)
        }
      }

      await load()
      if (errors.length === 0) {
        toast.success(`Deactivated ${succeeded} waste item${succeeded !== 1 ? 's' : ''}.`)
      } else {
        toast.error(`Deactivated ${succeeded} of ${total} items. ${errors.length} failed.`)
      }

      return { succeeded, failed: total - succeeded, errors }
    },
    [address, adminAddress, getClient, load, queryClient, toast]
  )

  const isAdmin = useMemo(
    () => Boolean(address && adminAddress && String(address) === String(adminAddress)),
    [address, adminAddress]
  )

  const confirmedWastes = useMemo(() => wastes.filter((w) => w.is_confirmed), [wastes])

  const unconfirmedWastes = useMemo(() => wastes.filter((w) => !w.is_confirmed), [wastes])

  return useMemo(
    () => ({
      wastes,
      confirmedWastes,
      unconfirmedWastes,
      isLoading,
      error,
      isAdmin,
      reload: load,
      confirmWaste,
      transferWaste,
      batchConfirmWastes,
      batchVerifyWastes,
      batchTransferWastes,
      batchDeactivateWastes
    }),
    [
      wastes,
      confirmedWastes,
      unconfirmedWastes,
      isLoading,
      error,
      isAdmin,
      load,
      confirmWaste,
      transferWaste,
      batchConfirmWastes,
      batchVerifyWastes,
      batchTransferWastes,
      batchDeactivateWastes
    ]
  )
}
