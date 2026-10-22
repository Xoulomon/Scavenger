import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, ListChecks, XCircle } from 'lucide-react'
import { useState } from 'react'

import type { Material } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'

import type { VerificationFormData } from '../types'
import { GradeSelector } from './GradeSelector'

export function BulkVerificationPanel({
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
