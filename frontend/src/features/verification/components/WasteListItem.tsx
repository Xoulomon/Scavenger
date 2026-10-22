import { CheckCircle2, Clock } from 'lucide-react'

import type { Material } from '@/api/types'
import { Badge } from '@/components/ui/Badge'
import { formatAddress,formatDate, wasteTypeLabel } from '@/lib/helpers'
import { cn } from '@/lib/utils'

export function WasteListItem({
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
