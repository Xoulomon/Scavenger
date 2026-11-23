import { useState, useEffect, useCallback } from 'react'
import { ScavengerClient } from '@/api/client'
import { useContract } from '@/context/ContractContext'
import { useWallet } from '@/context/WalletContext'
import { Material, ParticipantStats, WasteType } from '@/api/types'
import { NETWORK_CONFIGS } from '@/lib/stellar'

export interface CollectorDashboardData {
  tokenBalance: bigint
  pendingTransfers: Material[]
  collectedWastes: Material[]
  stats: ParticipantStats | null
  statsByWasteType: Record<WasteType, number>
  isLoading: boolean
  error: string | null
  refetch: () => void
}

export function useCollectorDashboard(): CollectorDashboardData {
  const { config } = useContract()
  const { address } = useWallet()

  const [tokenBalance, setTokenBalance] = useState<bigint>(0n)
  const [pendingTransfers, setPendingTransfers] = useState<Material[]>([])
  const [collectedWastes, setCollectedWastes] = useState<Material[]>([])
  const [stats, setStats] = useState<ParticipantStats | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!address) return
    setIsLoading(true)
    setError(null)
    try {
      const client = new ScavengerClient({
        contractId: config.contractId,
        rpcUrl: config.rpcUrl,
        networkPassphrase: NETWORK_CONFIGS[config.network].networkPassphrase
      })

      const [participantStats, metrics] = await Promise.all([
        client.getStats(address),
        client.getMetrics()
      ])

      setStats(participantStats)
      setTokenBalance(metrics.total_tokens_earned ?? 0n)

      // Fetch all materials owned by this collector
      const wasteIds: number[] = []
      for (let i = 1; i <= participantStats.materials_submitted; i++) wasteIds.push(i)

      const materials = (
        await Promise.all(wasteIds.map((id) => client.getMaterial(BigInt(id))))
      ).filter((m): m is Material => m !== null && m.current_owner === address && m.is_active)

      // Pending = transferred to this collector but not yet confirmed
      setPendingTransfers(materials.filter((m) => !m.is_confirmed))
      setCollectedWastes(materials.filter((m) => m.is_confirmed))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load dashboard data')
    } finally {
      setIsLoading(false)
    }
  }, [address, config])

  useEffect(() => {
    fetch()
  }, [fetch])

  const statsByWasteType = collectedWastes.reduce<Record<WasteType, number>>(
    (acc, m) => {
      acc[m.waste_type] = (acc[m.waste_type] ?? 0) + 1
      return acc
    },
    {} as Record<WasteType, number>
  )

  return {
    tokenBalance,
    pendingTransfers,
    collectedWastes,
    stats,
    statsByWasteType,
    isLoading,
    error,
    refetch: fetch
  }
}
