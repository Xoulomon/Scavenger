import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo,useState } from 'react'

import { ScavengerClient } from '@/api/client'
import type { Material, WasteTransfer,WasteType } from '@/api/types'
import { useContract } from '@/context/ContractContext'
import { useWallet } from '@/context/WalletContext'
import { exportVerificationCsv } from '@/features/verification/format'
import { addRecord, getSessionHistory } from '@/features/verification/sessionHistory'
import type {
  SortDirection,
  SortField,
  StatusFilter,
  VerificationFormData,
  VerificationRecord,
} from '@/features/verification/types'
import { networkConfig } from '@/lib/stellar'

export function useAllMaterials() {
  const { config } = useContract()
  const { address } = useWallet()

  return useQuery<Material[]>({
    queryKey: ['dashboard-materials', address],
    queryFn: async () => {
      if (!address) return []
      const client = new ScavengerClient({
        rpcUrl: config.rpcUrl,
        networkPassphrase: networkConfig.networkPassphrase,
        contractId: config.contractId,
      })
      const ids = await client.getParticipantWastes(address)
      const results = await Promise.all(
        ids.slice(-50).map((id) => client.getMaterial(BigInt(id as unknown as number)))
      )
      return results.filter((m): m is Material => m !== null)
    },
    enabled: !!address,
    staleTime: 30_000,
  })
}

export function useVerifyMaterial() {
  const { config } = useContract()
  const { address } = useWallet()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ materialId }: { materialId: bigint }) => {
      if (!address) throw new Error('No wallet connected.')
      const client = new ScavengerClient({
        rpcUrl: config.rpcUrl,
        networkPassphrase: networkConfig.networkPassphrase,
        contractId: config.contractId,
      })
      return client.verifyMaterial(materialId, address, address)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dashboard-materials'] })
    },
  })
}

export function useMaterialTransfers(materialId: number | null) {
  const { config } = useContract()

  return useQuery<WasteTransfer[]>({
    queryKey: ['material-transfers', materialId],
    queryFn: async () => {
      if (materialId === null) return []
      const client = new ScavengerClient({
        rpcUrl: config.rpcUrl,
        networkPassphrase: networkConfig.networkPassphrase,
        contractId: config.contractId,
      })
      return client.getWasteTransferHistory(BigInt(materialId))
    },
    enabled: materialId !== null,
    staleTime: 60_000,
  })
}

/**
 * Data fetching, filter/sort/selection state and verification handlers for the
 * verification dashboard. The page component is a pure composition root over this.
 */
export function useVerificationDashboard() {
  const { address } = useWallet()
  const { data: allMaterials = [], isLoading } = useAllMaterials()
  const verify = useVerifyMaterial()

  // Filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [wasteTypeFilter, setWasteTypeFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [sortField, setSortField] = useState<SortField>('date')
  const [sortDir, setSortDir] = useState<SortDirection>('desc')

  // Selection state
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [checkedIds, setCheckedIds] = useState<Set<number>>(new Set())

  // Apply filters
  const filteredMaterials = useMemo(() => {
    let result = [...allMaterials]

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (m) =>
          String(m.id).includes(q) ||
          m.submitter.toLowerCase().includes(q) ||
          m.current_owner.toLowerCase().includes(q)
      )
    }

    // Status filter
    if (statusFilter === 'pending') result = result.filter((m) => !m.verified)
    if (statusFilter === 'verified') result = result.filter((m) => m.verified)

    // Waste type filter
    if (wasteTypeFilter !== 'all') {
      const wt = Number(wasteTypeFilter) as WasteType
      result = result.filter((m) => m.waste_type === wt)
    }

    // Date range
    if (dateFrom) {
      const from = Math.floor(new Date(dateFrom).getTime() / 1000)
      result = result.filter((m) => m.submitted_at >= from)
    }
    if (dateTo) {
      const to = Math.floor(new Date(dateTo + 'T23:59:59').getTime() / 1000)
      result = result.filter((m) => m.submitted_at <= to)
    }

    // Sort
    result.sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case 'id':
          cmp = a.id - b.id
          break
        case 'date':
          cmp = a.submitted_at - b.submitted_at
          break
        case 'weight':
          cmp = a.weight - b.weight
          break
        case 'type':
          cmp = a.waste_type - b.waste_type
          break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })

    return result
  }, [allMaterials, searchQuery, statusFilter, wasteTypeFilter, dateFrom, dateTo, sortField, sortDir])

  const selectedMaterial = filteredMaterials.find((m) => m.id === selectedId) ?? null
  const hasActiveFilters = !!(
    searchQuery ||
    statusFilter !== 'all' ||
    wasteTypeFilter !== 'all' ||
    dateFrom ||
    dateTo
  )

  // Handlers
  const handleVerify = useCallback(
    async (materialId: number, decision: 'approved' | 'rejected', form: VerificationFormData) => {
      if (decision === 'approved') {
        await verify.mutateAsync({ materialId: BigInt(materialId) })
      }
      const record: VerificationRecord = {
        materialId,
        decision,
        notes: form.notes,
        contaminated: form.contaminated,
        grade: form.grade,
        verifiedAt: Math.floor(Date.now() / 1000),
        verifier: address ?? '',
      }
      addRecord(record)
    },
    [verify, address]
  )

  const handleBulkAction = useCallback(
    async (ids: number[], decision: 'approved' | 'rejected', form: VerificationFormData) => {
      for (const id of ids) {
        await handleVerify(id, decision, form)
      }
      setCheckedIds(new Set())
    },
    [handleVerify]
  )

  const handleCheckItem = useCallback((id: number, checked: boolean) => {
    setCheckedIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }, [])

  const handleSelectAll = useCallback(() => {
    if (checkedIds.size === filteredMaterials.length) {
      setCheckedIds(new Set())
    } else {
      setCheckedIds(new Set(filteredMaterials.map((m) => m.id)))
    }
  }, [checkedIds.size, filteredMaterials])

  const handleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
      } else {
        setSortField(field)
        setSortDir('desc')
      }
    },
    [sortField]
  )

  const handleExport = useCallback(() => {
    exportVerificationCsv(filteredMaterials, getSessionHistory())
  }, [filteredMaterials])

  const clearFilters = useCallback(() => {
    setSearchQuery('')
    setStatusFilter('all')
    setWasteTypeFilter('all')
    setDateFrom('')
    setDateTo('')
  }, [])

  return {
    address,
    allMaterials,
    isLoading,
    verify,
    // filter state
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    wasteTypeFilter,
    setWasteTypeFilter,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    showFilters,
    toggleFilters: () => setShowFilters((s) => !s),
    hasActiveFilters,
    clearFilters,
    // sort state
    sortField,
    sortDir,
    handleSort,
    // selection state
    selectedId,
    setSelectedId,
    selectedMaterial,
    checkedIds,
    setCheckedIds,
    handleCheckItem,
    handleSelectAll,
    // derived + actions
    filteredMaterials,
    handleVerify,
    handleBulkAction,
    handleExport,
  }
}
