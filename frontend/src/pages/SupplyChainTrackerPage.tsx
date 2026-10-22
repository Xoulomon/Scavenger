import { useState, useRef, useMemo } from 'react'
import { Search, CheckCircle2, Clock, XCircle, Package } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { ScavengerClient } from '@/api/client'
import { Waste } from '@/api/types'
import { useContract } from '@/context/ContractContext'
import { networkConfig } from '@/lib/stellar'
import { wasteTypeLabel, formatDate } from '@/lib/helpers'
import { useTransferHistory } from '@/hooks/useTransferHistory'
import { useAppTitle } from '@/hooks/useAppTitle'
import { WasteJourneyTimeline } from '@/components/ui/WasteJourneyTimeline'
import { AddressDisplay } from '@/components/ui/AddressDisplay'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { cn } from '@/lib/utils'
import { cacheKeys } from '@/lib/cacheKeys'

// ── Status helpers ────────────────────────────────────────────────────────────

type WasteStatus = 'confirmed' | 'pending' | 'inactive'

function resolveStatus(waste: Waste): WasteStatus {
  if (!waste.is_active) return 'inactive'
  if (waste.is_confirmed) return 'confirmed'
  return 'pending'
}

const STATUS_CONFIG: Record<
  WasteStatus,
  { label: string; icon: React.ReactNode; className: string }
> = {
  confirmed: {
    label: 'Confirmed',
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    className:
      'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800'
  },
  pending: {
    label: 'Pending',
    icon: <Clock className="h-3.5 w-3.5" />,
    className:
      'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800'
  },
  inactive: {
    label: 'Inactive',
    icon: <XCircle className="h-3.5 w-3.5" />,
    className: 'bg-muted text-muted-foreground border-border'
  }
}

// ── Waste details hook ────────────────────────────────────────────────────────

function useWasteById(wasteId: bigint | null) {
  const { config } = useContract()
  return useQuery<Waste | null>({
    queryKey: cacheKeys.waste(wasteId?.toString()),
    queryFn: async () => {
      const client = new ScavengerClient({
        rpcUrl: config.rpcUrl,
        networkPassphrase: networkConfig.networkPassphrase,
        contractId: config.contractId
      })
      return client.getWaste(wasteId!)
    },
    enabled: wasteId !== null,
    staleTime: 30_000,
    retry: false
  })
}

// ── Field row ─────────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{children}</span>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export function SupplyChainTrackerPage() {
  useAppTitle('Supply Chain Tracker')

  const [inputValue, setInputValue] = useState('')
  const [searchedId, setSearchedId] = useState<bigint | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const { data: waste, isLoading: wasteLoading, isError: wasteError } = useWasteById(searchedId)
  const { history, isLoading: historyLoading } = useTransferHistory(
    searchedId !== null ? searchedId : undefined
  )

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = inputValue.trim()
    if (!trimmed) return
    const parsed = BigInt(trimmed)
    setSearchedId(parsed)
  }

  function handleClear() {
    setInputValue('')
    setSearchedId(null)
    inputRef.current?.focus()
  }

  const isSearching = wasteLoading || historyLoading
  const notFound = searchedId !== null && !wasteLoading && (wasteError || waste === null)

  const participantAddresses = useMemo(() => {
    const unique = new Set<string>()
    if (waste?.current_owner) unique.add(waste.current_owner)
    if (waste?.confirmer) unique.add(waste.confirmer)
    history?.forEach((transfer) => {
      unique.add(transfer.from)
      unique.add(transfer.to)
    })
    return Array.from(unique)
  }, [history, waste])

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-6 sm:space-y-8 sm:py-8">
      <div>
        <h1 className="text-xl font-bold sm:text-2xl">Supply Chain Tracker</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter a waste ID to trace its full journey through the supply chain.
        </p>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <label htmlFor="supply-chain-waste-id" className="sr-only">
            Waste ID
          </label>
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="supply-chain-waste-id"
            ref={inputRef}
            type="number"
            min="1"
            step="1"
            placeholder="Enter waste ID…"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="pl-9"
            aria-label="Waste ID"
          />
        </div>
        <Button type="submit" disabled={!inputValue.trim() || isSearching}>
          {isSearching ? 'Searching…' : 'Track'}
        </Button>
        {searchedId !== null && (
          <Button type="button" variant="outline" onClick={handleClear}>
            Clear
          </Button>
        )}
      </form>

      {/* Not found */}
      {notFound && (
        <div
          role="status"
          aria-live="polite"
          className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-12 text-muted-foreground"
        >
          <Package className="h-10 w-10 opacity-40" />
          <p className="text-sm">No waste found with ID #{searchedId?.toString()}.</p>
        </div>
      )}

      {/* Results */}
      {waste && (
        <div className="space-y-6">
          {/* Details card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
              <CardTitle className="text-base">Waste #{waste.waste_id.toString()}</CardTitle>
              {(() => {
                const status = resolveStatus(waste)
                const cfg = STATUS_CONFIG[status]
                return (
                  <Badge
                    className={cn(
                      'inline-flex items-center gap-1 border text-xs font-medium',
                      cfg.className
                    )}
                  >
                    {cfg.icon}
                    {cfg.label}
                  </Badge>
                )
              })()}
            </CardHeader>
            <CardContent className="divide-y divide-border px-6 pb-4">
              <Field label="Type">{wasteTypeLabel(waste.waste_type)}</Field>
              <Field label="Weight">
                {Number(waste.weight) >= 1000
                  ? `${(Number(waste.weight) / 1000).toFixed(2)} kg`
                  : `${Number(waste.weight)} g`}
              </Field>
              <Field label="Registered">{formatDate(waste.recycled_timestamp)}</Field>
              <Field label="Current owner">
                <AddressDisplay address={waste.current_owner} showExplorer />
              </Field>
              {waste.is_confirmed && waste.confirmer && (
                <Field label="Confirmed by">
                  <AddressDisplay address={waste.confirmer} showExplorer />
                </Field>
              )}
              <Field label="Location">
                {(Number(waste.latitude) / 1_000_000).toFixed(6)}°,{' '}
                {(Number(waste.longitude) / 1_000_000).toFixed(6)}°
              </Field>
            </CardContent>
          </Card>

          {/* Transfer timeline */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Supply Chain Journey</CardTitle>
            </CardHeader>
            <CardContent>
              <WasteJourneyTimeline waste={waste} transfers={history ?? []} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Participant Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                This journey includes {participantAddresses.length} unique participant address
                {participantAddresses.length === 1 ? '' : 'es'}.
              </p>
              <div className="grid gap-3 pt-4 sm:grid-cols-2">
                {participantAddresses.map((address) => (
                  <div key={address} className="rounded-lg border bg-card p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Participant
                    </p>
                    <AddressDisplay address={address} showExplorer />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Empty state before any search */}
      {searchedId === null && (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-muted-foreground">
          <Search className="h-10 w-10 opacity-30" />
          <p className="text-sm">Enter a waste ID above to start tracking.</p>
        </div>
      )}
    </div>
  )
}
