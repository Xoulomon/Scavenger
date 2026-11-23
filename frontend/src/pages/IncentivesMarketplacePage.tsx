import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { FixedSizeList, type ListChildComponentProps } from 'react-window'
import { LayoutGrid, List, SlidersHorizontal, X, Zap, GitCompare } from 'lucide-react'
import { useIncentives } from '@/hooks/useIncentives'
import { useIncentivesClaim } from '@/hooks/useIncentivesClaim'
import { useAuth } from '@/context/AuthContext'
import { Incentive, WasteType } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { IncentiveCard } from '@/components/ui/IncentiveCard'
import { IncentiveDetailModal } from '@/components/ui/IncentiveDetailModal'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/Select'
import { cn } from '@/lib/utils'
import { wasteTypeLabel } from '@/lib/helpers'
import {
  sortIncentives,
  filterIncentives,
  readViewMode,
  writeViewMode,
  toggleCompareId,
  type ViewMode,
  type SortField,
  type SortDir,
  type IncentiveFilters
} from '@/lib/incentivesUtils'

// Re-export pure functions and types for consumers / tests
export { sortIncentives, filterIncentives, readViewMode, writeViewMode, toggleCompareId }
export type { ViewMode, SortField, SortDir, IncentiveFilters }

// ─── localStorage helpers for claimed incentives ──────────────────────────────

const CLAIMS_KEY_PREFIX = 'scavngr_claimed_incentives_'

function getClaimedIds(address: string | null | undefined): Set<number> {
  if (!address) return new Set()
  try {
    const raw = localStorage.getItem(`${CLAIMS_KEY_PREFIX}${address}`)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return new Set(parsed as number[])
  } catch {
    /* ignore */
  }
  return new Set()
}

function addClaimedId(address: string | null | undefined, id: number): void {
  if (!address) return
  try {
    const existing = getClaimedIds(address)
    existing.add(id)
    localStorage.setItem(`${CLAIMS_KEY_PREFIX}${address}`, JSON.stringify([...existing]))
  } catch {
    /* ignore */
  }
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ALL_WASTE_TYPES = Object.values(WasteType).filter(
  (v): v is WasteType => typeof v === 'number'
)

const GRID_COLS_DESKTOP = 3
const GRID_COLS_TABLET = 2
const GRID_COLS_MOBILE = 1
const CARD_HEIGHT_LIST = 80
const CARD_HEIGHT_GRID = 260
const OVERSCAN = 3

// Breakpoints (px) — keep in sync with Tailwind config / styles tokens
const BP_XS = 360
const BP_TABLET = 768
const BP_DESKTOP = 1024

function gridColsForWidth(width: number): number {
  if (width < BP_XS) return GRID_COLS_MOBILE
  if (width < BP_TABLET) return GRID_COLS_MOBILE
  if (width < BP_DESKTOP) return GRID_COLS_TABLET
  return GRID_COLS_DESKTOP
}

// ─── Skeleton card ────────────────────────────────────────────────────────────

function IncentiveSkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={cn('rounded-lg border bg-card shadow-sm p-4 space-y-3 animate-pulse', className)}
    >
      <div className="flex items-center justify-between">
        <div className="h-4 w-24 rounded bg-muted" />
        <div className="h-5 w-14 rounded-full bg-muted" />
      </div>
      <div className="space-y-2">
        <div className="h-3 w-full rounded bg-muted" />
        <div className="h-3 w-3/4 rounded bg-muted" />
        <div className="h-2 w-full rounded-full bg-muted" />
        <div className="h-3 w-1/2 rounded bg-muted" />
      </div>
    </div>
  )
}

// ─── Virtualized list row ─────────────────────────────────────────────────────

interface RowData {
  items: Incentive[][]
  viewMode: ViewMode
  containerWidth: number
  colCount: number
  compareIds: Set<number>
  onToggleCompare: (id: number) => void
  onCardClick: (inc: Incentive) => void
}

function VirtualRow({ index, style, data }: ListChildComponentProps<RowData>) {
  const { t } = useTranslation()
  const row = data.items[index]
  if (!row) return null

  if (data.viewMode === 'list') {
    const inc = row[0]
    return (
      <div style={style} className="px-1 py-1">
        <div
          className="flex items-center gap-4 rounded-lg border bg-card px-4 py-3 text-sm shadow-sm cursor-pointer hover:bg-accent/50 transition-colors"
          onClick={() => data.onCardClick(inc)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && data.onCardClick(inc)}
        >
          <input
            type="checkbox"
            aria-label={t('incentives.compareAriaLabel', { id: inc.id })}
            checked={data.compareIds.has(inc.id)}
            onChange={(e) => {
              e.stopPropagation()
              data.onToggleCompare(inc.id)
            }}
            onClick={(e) => e.stopPropagation()}
            className="h-4 w-4 shrink-0 cursor-pointer"
          />
          <span className="w-8 font-mono text-muted-foreground">#{inc.id}</span>
          <Badge variant={inc.active ? 'default' : 'secondary'} className="shrink-0">
            {wasteTypeLabel(inc.waste_type)}
          </Badge>
          <span className="flex-1 truncate font-mono text-xs text-muted-foreground">
            {inc.rewarder}
          </span>
          <span className="shrink-0 font-medium">
            {t('incentives.points', { value: Number(inc.reward_points).toLocaleString() })}
          </span>
          <span className="shrink-0 text-muted-foreground">
            {t('incentives.remainingLeft', {
              value: Number(inc.remaining_budget).toLocaleString()
            })}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div style={style} className="flex gap-4 px-1 py-1">
      {row.map((inc) => (
        <div key={inc.id} className="flex-1 min-w-0 relative">
          <label
            className="absolute top-2 left-2 z-10 flex items-center gap-1 cursor-pointer"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              type="checkbox"
              aria-label={t('incentives.compareAriaLabel', { id: inc.id })}
              checked={data.compareIds.has(inc.id)}
              onChange={() => data.onToggleCompare(inc.id)}
              className="h-4 w-4 cursor-pointer"
            />
          </label>
          <div
            className="cursor-pointer"
            onClick={() => data.onCardClick(inc)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && data.onCardClick(inc)}
          >
            <IncentiveCard incentive={inc} />
          </div>
        </div>
      ))}
      {Array.from({ length: data.colCount - row.length }).map((_, i) => (
        <div key={`empty-${i}`} className="flex-1 min-w-0" />
      ))}
    </div>
  )
}

// ─── Comparison panel ─────────────────────────────────────────────────────────

interface ComparisonPanelProps {
  incentives: Incentive[]
  selectedIds: Set<number>
  onClear: () => void
}

function ComparisonPanel({ incentives, selectedIds, onClear }: ComparisonPanelProps) {
  const { t } = useTranslation()
  const selected = incentives.filter((inc) => selectedIds.has(inc.id))
  if (selected.length < 2) return null

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background shadow-lg"
      role="region"
      aria-label={t('incentives.comparisonPanelAriaLabel')}
    >
      <div className="mx-auto max-w-5xl px-3 py-3 xs:px-4">
        <div className="mb-3 flex flex-col gap-2 xs:flex-row xs:items-center xs:justify-between">
          <div className="flex items-center gap-2">
            <GitCompare className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">
              {t('incentives.comparingCount', { count: selected.length })}
            </span>
          </div>
          <Button variant="ghost" size="sm" onClick={onClear}>
            <X className="mr-1 h-3.5 w-3.5" />
            {t('incentives.clearComparison')}
          </Button>
        </div>
        <div
          className="grid grid-cols-1 gap-3 xs:grid-cols-2 tablet:grid-cols-3"
          style={{ gridTemplateColumns: `repeat(${Math.min(selected.length, 3)}, minmax(0, 1fr))` }}
        >
          {selected.map((inc) => (
            <div key={inc.id} className="min-w-0 rounded-lg border bg-card p-3 text-xs space-y-1.5">
              <p className="truncate text-sm font-semibold">
                #{inc.id} — {wasteTypeLabel(inc.waste_type)}
              </p>
              <CompareRow
                label={t('incentives.compare.reward')}
                value={t('incentives.points', {
                  value: Number(inc.reward_points).toLocaleString()
                })}
              />
              <CompareRow
                label={t('incentives.compare.budget')}
                value={`${Number(inc.total_budget).toLocaleString()}`}
              />
              <CompareRow
                label={t('incentives.compare.remaining')}
                value={`${Number(inc.remaining_budget).toLocaleString()}`}
              />
              <CompareRow
                label={t('incentives.compare.status')}
                value={inc.active ? t('incentives.status.active') : t('incentives.status.inactive')}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function CompareRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function IncentivesMarketplacePage() {
  const { t } = useTranslation()
  const { incentives, isLoading, error } = useIncentives()
  const { claimIncentive, isClaiming } = useIncentivesClaim()
  const { user } = useAuth()

  const [viewMode, setViewMode] = useState<ViewMode>(readViewMode)
  const handleViewMode = useCallback((mode: ViewMode) => {
    setViewMode(mode)
    writeViewMode(mode)
  }, [])

  const [sortField, setSortField] = useState<SortField>('reward_points')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const [filters, setFilters] = useState<IncentiveFilters>({ wasteTypes: [], rewarder: '' })
  const [showFilters, setShowFilters] = useState(false)

  const toggleWasteType = useCallback((wt: WasteType) => {
    setFilters((f) => ({
      ...f,
      wasteTypes: f.wasteTypes.includes(wt)
        ? f.wasteTypes.filter((t) => t !== wt)
        : [...f.wasteTypes, wt]
    }))
  }, [])

  const clearFilters = useCallback(() => setFilters({ wasteTypes: [], rewarder: '' }), [])

  const activeFilterCount = filters.wasteTypes.length + (filters.rewarder.trim() !== '' ? 1 : 0)

  const [selectedIncentive, setSelectedIncentive] = useState<Incentive | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  const handleCardClick = useCallback((inc: Incentive) => {
    setSelectedIncentive(inc)
    setModalOpen(true)
  }, [])

  const [claimedIds, setClaimedIds] = useState<Set<number>>(() => getClaimedIds(user?.address))

  const handleClaim = useCallback(
    async (incentiveId: number) => {
      await claimIncentive(incentiveId)
      addClaimedId(user?.address, incentiveId)
      setClaimedIds((prev) => new Set([...prev, incentiveId]))
    },
    [claimIncentive, user?.address]
  )

  const [compareIds, setCompareIds] = useState<Set<number>>(new Set())

  const handleToggleCompare = useCallback((id: number) => {
    setCompareIds((prev) => toggleCompareId(prev, id))
  }, [])

  const handleClearComparison = useCallback(() => setCompareIds(new Set()), [])

  const processed = useMemo(() => {
    const filtered = filterIncentives(incentives, filters)
    return sortIncentives(filtered, sortField, sortDir)
  }, [incentives, filters, sortField, sortDir])

  const myClaims = useMemo(
    () => incentives.filter((inc) => claimedIds.has(inc.id)),
    [incentives, claimedIds]
  )

  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(800)
  const [containerHeight, setContainerHeight] = useState(600)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = (width: number) => {
      setContainerWidth(width)
      setContainerHeight(Math.max(400, window.innerHeight - 280))
    }
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) update(entry.contentRect.width)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const colCount = viewMode === 'grid' ? gridColsForWidth(containerWidth) : 1
  const rows = useMemo<Incentive[][]>(() => {
    const result: Incentive[][] = []
    for (let i = 0; i < processed.length; i += colCount) {
      result.push(processed.slice(i, i + colCount))
    }
    return result
  }, [processed, colCount])

  const rowHeight = viewMode === 'list' ? CARD_HEIGHT_LIST : CARD_HEIGHT_GRID

  const rowData: RowData = useMemo(
    () => ({
      items: rows,
      viewMode,
      containerWidth,
      colCount,
      compareIds,
      onToggleCompare: handleToggleCompare,
      onCardClick: handleCardClick
    }),
    [rows, viewMode, containerWidth, colCount, compareIds, handleToggleCompare, handleCardClick]
  )

  const hasComparison = compareIds.size >= 2

  return (
    <div className={cn('space-y-4 px-3 py-6 xs:px-4 sm:px-0 sm:py-0', hasComparison && 'pb-48')}>
      <div className="flex flex-col gap-3 tablet:flex-row tablet:items-center tablet:justify-between">
        <h1 className="text-lg font-bold xs:text-xl sm:text-2xl">{t('incentives.title')}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={`${sortField}:${sortDir}`}
            onValueChange={(v) => {
              const [f, d] = v.split(':') as [SortField, SortDir]
              setSortField(f)
              setSortDir(d)
            }}
          >
            <SelectTrigger className="w-full xs:w-52">
              <SelectValue placeholder={t('incentives.sort.placeholder')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="reward_points:desc">{t('incentives.sort.rewardDesc')}</SelectItem>
              <SelectItem value="reward_points:asc">{t('incentives.sort.rewardAsc')}</SelectItem>
              <SelectItem value="remaining_budget:desc">
                {t('incentives.sort.budgetDesc')}
              </SelectItem>
              <SelectItem value="remaining_budget:asc">{t('incentives.sort.budgetAsc')}</SelectItem>
              <SelectItem value="waste_type:asc">{t('incentives.sort.wasteType')}</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters((s) => !s)}
            aria-expanded={showFilters}
            aria-controls="incentives-filter-panel"
          >
            <SlidersHorizontal className="mr-1.5 h-4 w-4" />
            {t('incentives.filters')}
            {activeFilterCount > 0 && (
              <Badge className="ml-1.5 h-5 w-5 rounded-full p-0 text-xs flex items-center justify-center">
                {activeFilterCount}
              </Badge>
            )}
          </Button>

          <div
            className="flex rounded-md border"
            role="group"
            aria-label={t('incentives.viewModeAriaLabel')}
          >
            <button
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-l-md transition-colors',
                viewMode === 'grid'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-background text-muted-foreground hover:bg-accent'
              )}
              onClick={() => handleViewMode('grid')}
              aria-label={t('incentives.gridView')}
              aria-pressed={viewMode === 'grid'}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-r-md transition-colors',
                viewMode === 'list'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-background text-muted-foreground hover:bg-accent'
              )}
              onClick={() => handleViewMode('list')}
              aria-label={t('incentives.listView')}
              aria-pressed={viewMode === 'list'}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {showFilters && (
        <div
          id="incentives-filter-panel"
          className="rounded-lg border bg-card p-3 xs:p-4 space-y-4"
          role="region"
          aria-label={t('incentives.filtersPanelAriaLabel')}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{t('incentives.filters')}</span>
            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="mr-1 h-3.5 w-3.5" />
                {t('incentives.clearAll')}
              </Button>
            )}
          </div>
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {t('incentives.wasteType')}
            </p>
            <div className="flex flex-wrap gap-2">
              {ALL_WASTE_TYPES.map((wt) => {
                const active = filters.wasteTypes.includes(wt)
                return (
                  <button
                    key={wt}
                    onClick={() => toggleWasteType(wt)}
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                      active
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-input bg-background text-foreground hover:bg-accent'
                    )}
                    aria-pressed={active}
                  >
                    {wasteTypeLabel(wt)}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="space-y-1.5">
            <label
              htmlFor="rewarder-filter"
              className="text-xs font-medium text-muted-foreground uppercase tracking-wide"
            >
              {t('incentives.rewarderAddress')}
            </label>
            <Input
              id="rewarder-filter"
              placeholder={t('incentives.rewarderPlaceholder')}
              value={filters.rewarder}
              onChange={(e) => setFilters((f) => ({ ...f, rewarder: e.target.value }))}
              className="h-9 text-sm"
            />
          </div>
        </div>
      )}

      {error && (
        <p
          role="alert"
          aria-live="assertive"
          className="rounded-md border border-destructive bg-destructive/10 px-4 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      )}

      {isLoading && (
        <div className="grid grid-cols-1 gap-4 tablet:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <IncentiveSkeletonCard key={i} />
          ))}
        </div>
      )}

      {!isLoading && myClaims.length > 0 && (
        <section aria-label={t('incentives.myClaimsAriaLabel')}>
          <h2 className="mb-3 text-base font-semibold">{t('incentives.myClaims')}</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {myClaims.map((inc) => (
              <div
                key={inc.id}
                className="cursor-pointer"
                onClick={() => handleCardClick(inc)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && handleCardClick(inc)}
              >
                <IncentiveCard incentive={inc} />
              </div>
            ))}
          </div>
        </section>
      )}

      {!isLoading && processed.length === 0 && !error && (
        <EmptyState
          icon={Zap}
          title={t('incentives.empty.title')}
          description={
            activeFilterCount > 0
              ? t('incentives.empty.filteredDescription')
              : t('incentives.empty.defaultDescription')
          }
          action={
            activeFilterCount > 0
              ? { label: t('incentives.empty.clearFilters'), onClick: clearFilters }
              : undefined
          }
        />
      )}

      {!isLoading && processed.length > 0 && (
        <div ref={containerRef} className="w-full min-w-0">
          <FixedSizeList
            height={containerHeight}
            width={containerWidth || '100%'}
            itemCount={rows.length}
            itemSize={rowHeight}
            itemData={rowData}
            overscanCount={OVERSCAN}
          >
            {VirtualRow}
          </FixedSizeList>
        </div>
      )}

      <IncentiveDetailModal
        incentive={selectedIncentive}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onClaim={handleClaim}
        isClaiming={isClaiming}
      />

      <ComparisonPanel
        incentives={incentives}
        selectedIds={compareIds}
        onClear={handleClearComparison}
      />
    </div>
  )
}
