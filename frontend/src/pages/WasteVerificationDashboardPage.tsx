import { useState, useCallback, useMemo } from 'react'
import {
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Search,
  Download,
  Filter,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  PackageCheck,
  Truck,
  BarChart3,
  ListChecks,
  Eye,
  SlidersHorizontal,
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ScavengerClient } from '@/api/client'
import { useContract } from '@/context/ContractContext'
import { useWallet } from '@/context/WalletContext'
import { networkConfig } from '@/lib/stellar'
import { wasteTypeLabel, formatDate, formatAddress } from '@/lib/helpers'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { StatCard } from '@/components/ui/StatCard'
import { useAppTitle } from '@/hooks/useAppTitle'
import { cn } from '@/lib/utils'
import type { Material, WasteType, WasteTransfer } from '@/api/types'
import { WasteType as WasteTypeEnum } from '@/api/types'

// ── Types ─────────────────────────────────────────────────────────────────────

type QualityGrade = 'A' | 'B' | 'C' | 'D' | 'F'
type StatusFilter = 'all' | 'pending' | 'verified'
type SortField = 'id' | 'date' | 'weight' | 'type'
type SortDirection = 'asc' | 'desc'

interface VerificationFormData {
  grade: QualityGrade
  contaminated: boolean
  notes: string
}

interface VerificationRecord {
  materialId: number
  decision: 'approved' | 'rejected'
  notes: string
  contaminated: boolean
  grade: QualityGrade
  verifiedAt: number
  verifier: string
}

interface TimelineEvent {
  id: string
  type: 'submitted' | 'transfer' | 'verified' | 'confirmed' | 'deactivated'
  timestamp: number
  label: string
  detail?: string
  actor?: string
}

// ── Session-scoped verification history ───────────────────────────────────────

const _sessionHistory: VerificationRecord[] = []

function addRecord(record: VerificationRecord) {
  _sessionHistory.unshift(record)
  if (_sessionHistory.length > 200) _sessionHistory.pop()
}

function getSessionHistory(): VerificationRecord[] {
  return [..._sessionHistory]
}

// ── Mock image data (images are not stored on-chain) ──────────────────────────

function getMockImages(materialId: number): { before: string; after: string } {
  const hue = (materialId * 67) % 360
  return {
    before: `https://placehold.co/400x300/${hslToHex(hue, 40, 70)}/${hslToHex(hue, 40, 30)}?text=Before+%23${materialId}`,
    after: `https://placehold.co/400x300/${hslToHex((hue + 120) % 360, 40, 70)}/${hslToHex((hue + 120) % 360, 40, 30)}?text=After+%23${materialId}`,
  }
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100
  l /= 100
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
    return Math.round(255 * color).toString(16).padStart(2, '0')
  }
  return `${f(0)}${f(8)}${f(4)}`
}

// ── Constants ─────────────────────────────────────────────────────────────────

const GRADES: QualityGrade[] = ['A', 'B', 'C', 'D', 'F']
const GRADE_COLORS: Record<QualityGrade, string> = {
  A: 'bg-emerald-500 text-white',
  B: 'bg-green-500 text-white',
  C: 'bg-yellow-500 text-white',
  D: 'bg-orange-500 text-white',
  F: 'bg-destructive text-destructive-foreground',
}

const WASTE_TYPE_OPTIONS: { value: string; label: string; type: WasteType }[] = [
  { value: '0', label: 'Paper', type: WasteTypeEnum.Paper },
  { value: '1', label: 'PET Plastic', type: WasteTypeEnum.PetPlastic },
  { value: '2', label: 'Plastic', type: WasteTypeEnum.Plastic },
  { value: '3', label: 'Metal', type: WasteTypeEnum.Metal },
  { value: '4', label: 'Glass', type: WasteTypeEnum.Glass },
]

// ── Hooks ─────────────────────────────────────────────────────────────────────

function useAllMaterials() {
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

function useVerifyMaterial() {
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

function useMaterialTransfers(materialId: number | null) {
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

// ── Sub-components ────────────────────────────────────────────────────────────

function DashboardStats({
  materials,
  isLoading,
}: {
  materials: Material[]
  isLoading: boolean
}) {
  const stats = useMemo(() => {
    const now = Math.floor(Date.now() / 1000)
    const todayStart = now - (now % 86400)
    const pending = materials.filter((m) => !m.verified)
    const verifiedToday = materials.filter(
      (m) => m.verified && m.submitted_at >= todayStart
    )
    const history = getSessionHistory()
    const rejected = history.filter((r) => r.decision === 'rejected')
    const rejectionRate =
      history.length > 0 ? Math.round((rejected.length / history.length) * 100) : 0

    // Average processing time: difference between submitted_at and verifiedAt for session records
    const processedTimes = history
      .filter((r) => r.decision === 'approved')
      .map((r) => {
        const mat = materials.find((m) => m.id === r.materialId)
        return mat ? r.verifiedAt - mat.submitted_at : 0
      })
      .filter((t) => t > 0)
    const avgTime =
      processedTimes.length > 0
        ? Math.round(processedTimes.reduce((a, b) => a + b, 0) / processedTimes.length)
        : 0

    return { pending: pending.length, verifiedToday: verifiedToday.length, rejectionRate, avgTime }
  }, [materials])

  function formatDuration(seconds: number): string {
    if (seconds === 0) return '--'
    if (seconds < 60) return `${seconds}s`
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`
    return `${(seconds / 3600).toFixed(1)}h`
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        icon={<Clock className="h-4 w-4" />}
        label="Pending"
        value={stats.pending}
        isLoading={isLoading}
        variant="warning"
      />
      <StatCard
        icon={<CheckCircle2 className="h-4 w-4" />}
        label="Verified Today"
        value={stats.verifiedToday}
        isLoading={isLoading}
        variant="success"
      />
      <StatCard
        icon={<XCircle className="h-4 w-4" />}
        label="Rejection Rate"
        value={`${stats.rejectionRate}%`}
        isLoading={isLoading}
        variant="destructive"
      />
      <StatCard
        icon={<BarChart3 className="h-4 w-4" />}
        label="Avg. Processing"
        value={formatDuration(stats.avgTime)}
        isLoading={isLoading}
        variant="primary"
      />
    </div>
  )
}

// ── Filters bar ──────────────────────────────────────────────────────────────

function FilterBar({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusChange,
  wasteTypeFilter,
  onWasteTypeChange,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  showFilters,
  onToggleFilters,
}: {
  searchQuery: string
  onSearchChange: (q: string) => void
  statusFilter: StatusFilter
  onStatusChange: (s: StatusFilter) => void
  wasteTypeFilter: string
  onWasteTypeChange: (t: string) => void
  dateFrom: string
  dateTo: string
  onDateFromChange: (d: string) => void
  onDateToChange: (d: string) => void
  showFilters: boolean
  onToggleFilters: () => void
}) {
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by ID or submitter..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
            aria-label="Search waste items"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onToggleFilters}
          aria-expanded={showFilters}
          aria-label="Toggle filters"
          className="gap-1.5"
        >
          <SlidersHorizontal className="h-4 w-4" />
          <span className="hidden sm:inline">Filters</span>
        </Button>
      </div>

      {showFilters && (
        <div className="grid gap-3 rounded-lg border bg-muted/30 p-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => onStatusChange(e.target.value as StatusFilter)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Filter by status"
            >
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="verified">Verified</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Waste Type</label>
            <select
              value={wasteTypeFilter}
              onChange={(e) => onWasteTypeChange(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Filter by waste type"
            >
              <option value="all">All Types</option>
              {WASTE_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">From Date</label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => onDateFromChange(e.target.value)}
              className="h-9"
              aria-label="Filter from date"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">To Date</label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => onDateToChange(e.target.value)}
              className="h-9"
              aria-label="Filter to date"
            />
          </div>
        </div>
      )}
    </div>
  )
}

// ── Waste list item ──────────────────────────────────────────────────────────

function WasteListItem({
  material,
  isSelected,
  isChecked,
  onSelect,
  onCheck,
}: {
  material: Material
  isSelected: boolean
  isChecked: boolean
  onSelect: () => void
  onCheck: (checked: boolean) => void
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-selected={isSelected}
      aria-label={`Material ${material.id}, ${wasteTypeLabel(material.waste_type)}, ${material.verified ? 'verified' : 'pending'}`}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect()
        }
      }}
      className={cn(
        'flex items-center gap-3 rounded-lg border p-3 transition-colors cursor-pointer',
        isSelected
          ? 'border-primary bg-primary/5 ring-1 ring-primary'
          : 'border-border hover:bg-muted/50'
      )}
    >
      <input
        type="checkbox"
        checked={isChecked}
        onChange={(e) => {
          e.stopPropagation()
          onCheck(e.target.checked)
        }}
        onClick={(e) => e.stopPropagation()}
        className="h-4 w-4 shrink-0 rounded border"
        aria-label={`Select material ${material.id} for bulk action`}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">#{material.id}</span>
          <Badge variant="secondary" className="text-[10px]">
            {wasteTypeLabel(material.waste_type)}
          </Badge>
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-mono">{formatAddress(material.submitter)}</span>
          <span>{formatDate(material.submitted_at)}</span>
        </div>
      </div>
      <div className="shrink-0">
        {material.verified ? (
          <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Verified
          </Badge>
        ) : (
          <Badge variant="secondary">
            <Clock className="mr-1 h-3 w-3" />
            Pending
          </Badge>
        )}
      </div>
    </div>
  )
}

// ── Image comparison ─────────────────────────────────────────────────────────

function ImageComparison({ materialId }: { materialId: number }) {
  const [sliderPos, setSliderPos] = useState(50)
  const [mode, setMode] = useState<'slider' | 'side-by-side'>('side-by-side')
  const images = getMockImages(materialId)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Image Comparison</span>
        <div className="flex gap-1">
          <Button
            variant={mode === 'side-by-side' ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => setMode('side-by-side')}
            aria-pressed={mode === 'side-by-side'}
            aria-label="Side by side view"
          >
            <Eye className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant={mode === 'slider' ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => setMode('slider')}
            aria-pressed={mode === 'slider'}
            aria-label="Slider comparison view"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {mode === 'side-by-side' ? (
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Before</span>
            <div className="overflow-hidden rounded-lg border bg-muted">
              <img
                src={images.before}
                alt={`Before image for material ${materialId}`}
                className="h-32 w-full object-cover"
                loading="lazy"
              />
            </div>
          </div>
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">After</span>
            <div className="overflow-hidden rounded-lg border bg-muted">
              <img
                src={images.after}
                alt={`After image for material ${materialId}`}
                className="h-32 w-full object-cover"
                loading="lazy"
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="relative h-40 overflow-hidden rounded-lg border bg-muted" aria-label="Image comparison slider">
          <img
            src={images.after}
            alt={`After image for material ${materialId}`}
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
          />
          <div
            className="absolute inset-0 overflow-hidden"
            style={{ width: `${sliderPos}%` }}
          >
            <img
              src={images.before}
              alt={`Before image for material ${materialId}`}
              className="h-full w-full object-cover"
              style={{ width: `${(100 / sliderPos) * 100}%`, maxWidth: 'none' }}
              loading="lazy"
            />
          </div>
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-white shadow-md"
            style={{ left: `${sliderPos}%` }}
          />
          <input
            type="range"
            min={0}
            max={100}
            value={sliderPos}
            onChange={(e) => setSliderPos(Number(e.target.value))}
            className="absolute inset-0 h-full w-full cursor-col-resize opacity-0"
            aria-label="Drag to compare before and after images"
          />
          <div className="absolute bottom-2 left-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
            Before
          </div>
          <div className="absolute bottom-2 right-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
            After
          </div>
        </div>
      )}
    </div>
  )
}

// ── Quality grade selector ───────────────────────────────────────────────────

function GradeSelector({
  value,
  onChange,
}: {
  value: QualityGrade
  onChange: (g: QualityGrade) => void
}) {
  return (
    <div className="flex items-center gap-1" role="group" aria-label="Quality grade">
      {GRADES.map((g) => (
        <button
          key={g}
          onClick={() => onChange(g)}
          aria-pressed={value === g}
          aria-label={`Grade ${g}`}
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            GRADE_COLORS[g],
            value === g
              ? 'opacity-100 ring-2 ring-offset-1 ring-ring'
              : 'opacity-40 hover:opacity-70'
          )}
        >
          {g}
        </button>
      ))}
    </div>
  )
}

// ── Verification form ────────────────────────────────────────────────────────

function VerificationForm({
  material,
  onComplete,
  isPending,
}: {
  material: Material
  onComplete: (materialId: number, decision: 'approved' | 'rejected', form: VerificationFormData) => void
  isPending: boolean
}) {
  const [form, setForm] = useState<VerificationFormData>({
    grade: 'B',
    contaminated: false,
    notes: '',
  })

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Quality Grade</label>
        <GradeSelector
          value={form.grade}
          onChange={(grade) => setForm((f) => ({ ...f, grade }))}
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          id={`contaminated-${material.id}`}
          type="checkbox"
          checked={form.contaminated}
          onChange={(e) => setForm((f) => ({ ...f, contaminated: e.target.checked }))}
          className="h-4 w-4 rounded border"
          aria-label="Mark as contaminated"
        />
        <label htmlFor={`contaminated-${material.id}`} className="flex items-center gap-1.5 text-sm">
          <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />
          Mark as contaminated
        </label>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium">Verification Notes</label>
        <textarea
          className="w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          rows={3}
          placeholder="Optional notes about material quality..."
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          aria-label="Verification notes"
        />
      </div>

      <div className="flex gap-2">
        <Button
          className="flex-1 gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
          onClick={() => onComplete(material.id, 'approved', form)}
          disabled={isPending || material.verified}
          aria-label="Approve material"
        >
          <CheckCircle2 className="h-4 w-4" />
          Approve
        </Button>
        <Button
          variant="destructive"
          className="flex-1 gap-2"
          onClick={() => onComplete(material.id, 'rejected', form)}
          disabled={isPending || material.verified}
          aria-label="Reject material"
        >
          <XCircle className="h-4 w-4" />
          Reject
        </Button>
      </div>
    </div>
  )
}

// ── Waste history timeline ───────────────────────────────────────────────────

const EVENT_ICON: Record<TimelineEvent['type'], React.ReactNode> = {
  submitted: <PackageCheck className="h-3.5 w-3.5" />,
  transfer: <Truck className="h-3.5 w-3.5" />,
  verified: <ShieldCheck className="h-3.5 w-3.5" />,
  confirmed: <CheckCircle2 className="h-3.5 w-3.5" />,
  deactivated: <XCircle className="h-3.5 w-3.5" />,
}

const EVENT_COLOR: Record<TimelineEvent['type'], string> = {
  submitted: 'border-primary bg-primary text-primary-foreground',
  transfer: 'border-blue-500 bg-blue-500 text-white',
  verified: 'border-green-500 bg-green-500 text-white',
  confirmed: 'border-emerald-500 bg-emerald-500 text-white',
  deactivated: 'border-destructive bg-destructive text-destructive-foreground',
}

function WasteTimeline({
  material,
  transfers,
  isLoading,
}: {
  material: Material
  transfers: WasteTransfer[]
  isLoading: boolean
}) {
  const events = useMemo(() => {
    const evts: TimelineEvent[] = [
      {
        id: 'submitted',
        type: 'submitted',
        timestamp: material.submitted_at,
        label: 'Material Submitted',
        detail: `${wasteTypeLabel(material.waste_type)}, ${formatWeight(material.weight)}`,
        actor: material.submitter,
      },
    ]

    for (const t of transfers) {
      evts.push({
        id: `transfer-${t.transferred_at}`,
        type: 'transfer',
        timestamp: t.transferred_at,
        label: 'Transferred',
        detail: `${formatAddress(t.from)} to ${formatAddress(t.to)}`,
        actor: t.from,
      })
    }

    if (material.verified) {
      evts.push({
        id: 'verified',
        type: 'verified',
        timestamp: material.submitted_at,
        label: 'Verified',
        detail: 'Material quality verified',
      })
    }

    if (material.is_confirmed && material.confirmer) {
      evts.push({
        id: 'confirmed',
        type: 'confirmed',
        timestamp: material.submitted_at,
        label: 'Confirmed',
        detail: `Confirmed by ${formatAddress(material.confirmer)}`,
        actor: material.confirmer,
      })
    }

    if (!material.is_active) {
      evts.push({
        id: 'deactivated',
        type: 'deactivated',
        timestamp: material.submitted_at,
        label: 'Deactivated',
      })
    }

    return evts.sort((a, b) => a.timestamp - b.timestamp)
  }, [material, transfers])

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3">
            <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
            <div className="flex-1 space-y-1">
              <div className="h-4 w-24 animate-pulse rounded bg-muted" />
              <div className="h-3 w-40 animate-pulse rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-0" role="list" aria-label="Waste history timeline">
      {events.map((event, idx) => (
        <div key={event.id} role="listitem" className="flex gap-3">
          <div className="flex flex-col items-center">
            <div
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2',
                EVENT_COLOR[event.type]
              )}
            >
              {EVENT_ICON[event.type]}
            </div>
            {idx < events.length - 1 && (
              <div className="h-8 w-px bg-border" />
            )}
          </div>
          <div className="pb-4">
            <p className="text-sm font-semibold">{event.label}</p>
            <p className="text-xs text-muted-foreground">{formatDate(event.timestamp)}</p>
            {event.detail && (
              <p className="mt-0.5 text-xs text-muted-foreground">{event.detail}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Detail panel ─────────────────────────────────────────────────────────────

function DetailPanel({
  material,
  onVerify,
  isVerifying,
}: {
  material: Material
  onVerify: (materialId: number, decision: 'approved' | 'rejected', form: VerificationFormData) => void
  isVerifying: boolean
}) {
  const [activeTab, setActiveTab] = useState<'details' | 'timeline'>('details')
  const { data: transfers = [], isLoading: transfersLoading } = useMaterialTransfers(material.id)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Material #{material.id}</h2>
        {material.verified ? (
          <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Verified
          </Badge>
        ) : (
          <Badge variant="secondary">
            <Clock className="mr-1 h-3 w-3" />
            Pending
          </Badge>
        )}
      </div>

      {/* Tab buttons */}
      <div className="flex gap-1 rounded-lg border bg-muted/50 p-1" role="tablist" aria-label="Detail sections">
        <button
          role="tab"
          aria-selected={activeTab === 'details'}
          onClick={() => setActiveTab('details')}
          className={cn(
            'flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            activeTab === 'details'
              ? 'bg-background shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          Details
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'timeline'}
          onClick={() => setActiveTab('timeline')}
          className={cn(
            'flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            activeTab === 'timeline'
              ? 'bg-background shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          Timeline
        </button>
      </div>

      {activeTab === 'details' ? (
        <div className="space-y-4">
          {/* Material details grid */}
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <span className="text-muted-foreground">Type</span>
              <p className="font-medium">{wasteTypeLabel(material.waste_type)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Weight</span>
              <p className="font-medium">{formatWeight(material.weight)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Submitter</span>
              <p className="font-mono text-xs">{formatAddress(material.submitter)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Current Owner</span>
              <p className="font-mono text-xs">{formatAddress(material.current_owner)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Submitted</span>
              <p className="font-medium">{formatDate(material.submitted_at)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Status</span>
              <p className="font-medium">
                {!material.is_active
                  ? 'Inactive'
                  : material.is_confirmed
                    ? 'Confirmed'
                    : material.verified
                      ? 'Verified'
                      : 'Pending'}
              </p>
            </div>
            {material.confirmer && material.confirmer !== 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' && (
              <div className="sm:col-span-2">
                <span className="text-muted-foreground">Confirmer</span>
                <p className="font-mono text-xs">{formatAddress(material.confirmer)}</p>
              </div>
            )}
          </div>

          {/* Image comparison */}
          <ImageComparison materialId={material.id} />

          {/* Verification form */}
          {!material.verified && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Verification</CardTitle>
              </CardHeader>
              <CardContent>
                <VerificationForm
                  material={material}
                  onComplete={onVerify}
                  isPending={isVerifying}
                />
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        <WasteTimeline
          material={material}
          transfers={transfers}
          isLoading={transfersLoading}
        />
      )}
    </div>
  )
}

// ── Bulk verification panel ──────────────────────────────────────────────────

function BulkVerificationPanel({
  selectedIds,
  materials,
  onBulkAction,
  onClearSelection,
  isPending,
}: {
  selectedIds: Set<number>
  materials: Material[]
  onBulkAction: (ids: number[], decision: 'approved' | 'rejected', form: VerificationFormData) => void
  onClearSelection: () => void
  isPending: boolean
}) {
  const [form, setForm] = useState<VerificationFormData>({
    grade: 'B',
    contaminated: false,
    notes: '',
  })
  const [expanded, setExpanded] = useState(false)

  const selectedMaterials = materials.filter((m) => selectedIds.has(m.id))
  const pendingSelected = selectedMaterials.filter((m) => !m.verified)

  if (selectedIds.size === 0) return null

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">
              {selectedIds.size} selected ({pendingSelected.length} pending)
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setExpanded((e) => !e)}
              aria-expanded={expanded}
              aria-label="Expand bulk actions"
            >
              {expanded ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onClearSelection}
              aria-label="Clear selection"
            >
              Clear
            </Button>
          </div>
        </div>

        {expanded && (
          <div className="mt-3 space-y-3 border-t pt-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Shared Grade</label>
              <GradeSelector
                value={form.grade}
                onChange={(grade) => setForm((f) => ({ ...f, grade }))}
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                id="bulk-contaminated"
                type="checkbox"
                checked={form.contaminated}
                onChange={(e) => setForm((f) => ({ ...f, contaminated: e.target.checked }))}
                className="h-4 w-4 rounded border"
                aria-label="Mark all as contaminated"
              />
              <label htmlFor="bulk-contaminated" className="flex items-center gap-1.5 text-sm">
                <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />
                Mark all as contaminated
              </label>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Shared Notes</label>
              <textarea
                className="w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                rows={2}
                placeholder="Notes for all selected items..."
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                aria-label="Shared verification notes"
              />
            </div>

            <div className="flex gap-2">
              <Button
                className="flex-1 gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => onBulkAction(pendingSelected.map((m) => m.id), 'approved', form)}
                disabled={isPending || pendingSelected.length === 0}
                aria-label="Bulk approve selected materials"
              >
                <CheckCircle2 className="h-4 w-4" />
                Approve All ({pendingSelected.length})
              </Button>
              <Button
                variant="destructive"
                className="flex-1 gap-2"
                onClick={() => onBulkAction(pendingSelected.map((m) => m.id), 'rejected', form)}
                disabled={isPending || pendingSelected.length === 0}
                aria-label="Bulk reject selected materials"
              >
                <XCircle className="h-4 w-4" />
                Reject All ({pendingSelected.length})
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatWeight(weight: number): string {
  return weight >= 1000 ? `${(weight / 1000).toFixed(2)} kg` : `${weight} g`
}

function exportVerificationCsv(materials: Material[], history: VerificationRecord[]) {
  const headers = [
    'Material ID',
    'Waste Type',
    'Weight (g)',
    'Submitter',
    'Submitted At',
    'Verified',
    'Decision',
    'Grade',
    'Contaminated',
    'Notes',
    'Verified At',
  ]

  const rows = materials.map((m) => {
    const record = history.find((r) => r.materialId === m.id)
    return [
      m.id,
      wasteTypeLabel(m.waste_type),
      m.weight,
      m.submitter,
      formatDate(m.submitted_at),
      m.verified ? 'Yes' : 'No',
      record?.decision ?? '',
      record?.grade ?? '',
      record?.contaminated ? 'Yes' : 'No',
      `"${(record?.notes ?? '').replace(/"/g, '""')}"`,
      record ? formatDate(record.verifiedAt) : '',
    ]
  })

  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `verification-export-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

// ── Page ─────────────────────────────────────────────────────────────────────

export function WasteVerificationDashboardPage() {
  useAppTitle('Verification Dashboard')
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

  // Not connected state
  if (!address) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        Connect your wallet to access the verification dashboard.
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:py-8">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">Verification Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Review, verify, and manage waste material submissions.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 self-start"
          onClick={handleExport}
          disabled={filteredMaterials.length === 0}
          aria-label="Export results as CSV"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Stats */}
      <DashboardStats materials={allMaterials} isLoading={isLoading} />

      {/* Filters */}
      <FilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        wasteTypeFilter={wasteTypeFilter}
        onWasteTypeChange={setWasteTypeFilter}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
        showFilters={showFilters}
        onToggleFilters={() => setShowFilters((s) => !s)}
      />

      {/* Bulk actions */}
      <BulkVerificationPanel
        selectedIds={checkedIds}
        materials={allMaterials}
        onBulkAction={handleBulkAction}
        onClearSelection={() => setCheckedIds(new Set())}
        isPending={verify.isPending}
      />

      {/* Main content: list + detail */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        {/* Left: waste list */}
        <div className="space-y-3">
          {/* List header / sort controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={
                  filteredMaterials.length > 0 && checkedIds.size === filteredMaterials.length
                }
                onChange={handleSelectAll}
                className="h-4 w-4 rounded border"
                aria-label="Select all items"
              />
              <span className="text-sm text-muted-foreground">
                {isLoading
                  ? 'Loading...'
                  : `${filteredMaterials.length} item${filteredMaterials.length !== 1 ? 's' : ''}`}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground">Sort:</span>
              {([
                { field: 'date' as SortField, label: 'Date' },
                { field: 'id' as SortField, label: 'ID' },
                { field: 'weight' as SortField, label: 'Weight' },
              ]).map(({ field, label }) => (
                <Button
                  key={field}
                  variant={sortField === field ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => handleSort(field)}
                  aria-label={`Sort by ${label}`}
                  className="h-7 px-2 text-xs"
                >
                  {label}
                  {sortField === field && (
                    sortDir === 'asc' ? (
                      <ChevronUp className="ml-0.5 h-3 w-3" />
                    ) : (
                      <ChevronDown className="ml-0.5 h-3 w-3" />
                    )
                  )}
                </Button>
              ))}
            </div>
          </div>

          {/* List */}
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-[72px] animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          ) : filteredMaterials.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-12 text-muted-foreground">
              <Filter className="h-8 w-8 opacity-30" />
              <p className="text-sm">No materials match your filters.</p>
              {(searchQuery || statusFilter !== 'all' || wasteTypeFilter !== 'all' || dateFrom || dateTo) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchQuery('')
                    setStatusFilter('all')
                    setWasteTypeFilter('all')
                    setDateFrom('')
                    setDateTo('')
                  }}
                  aria-label="Clear all filters"
                >
                  Clear filters
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2 max-h-[calc(100vh-24rem)] overflow-y-auto pr-1" role="listbox" aria-label="Waste materials list">
              {filteredMaterials.map((material) => (
                <WasteListItem
                  key={material.id}
                  material={material}
                  isSelected={selectedId === material.id}
                  isChecked={checkedIds.has(material.id)}
                  onSelect={() => setSelectedId(material.id)}
                  onCheck={(checked) => handleCheckItem(material.id, checked)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right: detail panel */}
        <div className="lg:sticky lg:top-6 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto">
          {selectedMaterial ? (
            <Card>
              <CardContent className="p-4 sm:p-6">
                <DetailPanel
                  material={selectedMaterial}
                  onVerify={handleVerify}
                  isVerifying={verify.isPending}
                />
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-muted-foreground">
              <ShieldCheck className="h-10 w-10 opacity-30" />
              <p className="text-sm">Select a material to view details and verify.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
