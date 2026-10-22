import { CheckCircle2, Package } from 'lucide-react'

import type { Waste } from '@/api/types'
import { Badge } from '@/components/ui/Badge'
import { wasteTypeLabel } from '@/lib/helpers'

import { formatWasteWeight } from '../format'

export function SelectWasteStep({
  wastes,
  isLoading,
  selectedId,
  onSelect,
}: {
  wastes: Waste[]
  isLoading: boolean
  selectedId: bigint | null
  onSelect: (waste: Waste) => void
}) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    )
  }

  if (wastes.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-muted-foreground">
        <Package className="h-10 w-10 opacity-30" />
        <p className="text-sm">No active waste materials found.</p>
        <p className="text-xs">Submit materials first before transferring.</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        Select the waste material you want to transfer.
      </p>
      <div className="divide-y divide-border rounded-lg border">
        {wastes.map((waste) => {
          const isSelected = selectedId !== null && waste.waste_id === selectedId
          return (
            <button
              key={waste.waste_id.toString()}
              type="button"
              onClick={() => onSelect(waste)}
              aria-pressed={isSelected}
              aria-label={`Select waste #${waste.waste_id} - ${wasteTypeLabel(waste.waste_type)}`}
              className={`flex w-full items-center justify-between px-4 py-3 text-left text-sm transition-colors hover:bg-accent/50 ${
                isSelected ? 'bg-primary/5 ring-1 ring-inset ring-primary' : ''
              }`}
            >
              <div className="space-y-1">
                <p className="font-medium">
                  Waste #{waste.waste_id.toString()}
                </p>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="secondary">{wasteTypeLabel(waste.waste_type)}</Badge>
                  <span>{formatWasteWeight(waste.weight)}</span>
                  {waste.is_confirmed && (
                    <Badge className="bg-emerald-100 text-emerald-700">Confirmed</Badge>
                  )}
                </div>
              </div>
              <div
                className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                  isSelected
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-muted-foreground/30'
                }`}
              >
                {isSelected && <CheckCircle2 className="h-3 w-3" />}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
