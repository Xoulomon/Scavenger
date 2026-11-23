import { useState, useEffect } from 'react'
import { GitCompare, X, History, Trash2 } from 'lucide-react'
import { useAppTitle } from '@/hooks/useAppTitle'
import { useWastes } from '@/hooks/useWastes'
import { Waste } from '@/api/types'
import { WasteComparison } from '@/components/ui/WasteComparison'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { wasteTypeLabel } from '@/lib/helpers'
import {
  getComparisonHistory,
  saveComparison,
  deleteComparison,
  type ComparisonSnapshot
} from '@/lib/comparisonHistory'

const MAX_COMPARE = 4

export function WasteComparisonPage() {
  useAppTitle('Waste Comparison')
  const { wastes, isLoading } = useWastes()
  const [selected, setSelected] = useState<Waste[]>([])
  const [history, setHistory] = useState<ComparisonSnapshot[]>(() => getComparisonHistory())

  // Save to history whenever a valid comparison is active
  useEffect(() => {
    if (selected.length >= 2) {
      saveComparison(selected)
      setHistory(getComparisonHistory())
    }
  }, [selected])

  const toggle = (waste: Waste) => {
    setSelected((prev) => {
      const exists = prev.find((w) => w.waste_id === waste.waste_id)
      if (exists) return prev.filter((w) => w.waste_id !== waste.waste_id)
      if (prev.length >= MAX_COMPARE) return prev
      return [...prev, waste]
    })
  }

  const restoreSnapshot = (snapshot: ComparisonSnapshot) => {
    const restored = snapshot.wasteIds
      .map((id) => wastes.find((w) => String(w.waste_id) === id))
      .filter((w): w is Waste => w !== undefined)
    if (restored.length >= 2) setSelected(restored)
  }

  const removeFromHistory = (id: string) => {
    deleteComparison(id)
    setHistory(getComparisonHistory())
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex items-center gap-2">
        <GitCompare className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Waste Comparison</h1>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Selection panel */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Select Wastes{' '}
                <span className="text-muted-foreground font-normal text-xs">
                  ({selected.length}/{MAX_COMPARE})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {isLoading && (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-10 animate-pulse rounded bg-muted" />
                  ))}
                </div>
              )}
              {!isLoading && wastes.length === 0 && (
                <EmptyState
                  icon={GitCompare}
                  title="No wastes"
                  description="No waste items found"
                />
              )}
              {wastes.map((w) => {
                const isSelected = selected.some((s) => s.waste_id === w.waste_id)
                const disabled = !isSelected && selected.length >= MAX_COMPARE
                return (
                  <button
                    key={String(w.waste_id)}
                    disabled={disabled}
                    onClick={() => toggle(w)}
                    className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-sm transition-colors ${
                      isSelected
                        ? 'border-primary bg-primary/10'
                        : disabled
                          ? 'cursor-not-allowed opacity-40'
                          : 'hover:bg-muted/50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{wasteTypeLabel(w.waste_type)}</Badge>
                      <span className="text-muted-foreground">#{String(w.waste_id)}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {(Number(w.weight) / 1000).toFixed(2)} kg
                    </span>
                  </button>
                )
              })}
            </CardContent>
          </Card>

          {/* History panel */}
          {history.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <History className="h-4 w-4" />
                  History
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {history.map((snapshot) => (
                  <div
                    key={snapshot.id}
                    className="flex items-center justify-between rounded-md border px-3 py-2 text-sm hover:bg-muted/50"
                  >
                    <button
                      className="flex-1 text-left truncate"
                      onClick={() => restoreSnapshot(snapshot)}
                      title={`Restore: ${snapshot.label}`}
                    >
                      {snapshot.label}
                    </button>
                    <button
                      aria-label={`Delete ${snapshot.label}`}
                      onClick={() => removeFromHistory(snapshot.id)}
                      className="ml-2 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Comparison table */}
        <div className="lg:col-span-2">
          {selected.length < 2 ? (
            <div className="flex h-48 items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
              Select at least 2 waste items to compare
            </div>
          ) : (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Comparison</CardTitle>
                  <Button size="sm" variant="ghost" onClick={() => setSelected([])}>
                    <X className="mr-1 h-3 w-3" /> Clear
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <WasteComparison wastes={selected} />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
