import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'
import { useState } from 'react'

import type { Material } from '@/api/types'
import { Button } from '@/components/ui/Button'

import type { VerificationFormData } from '../types'
import { GradeSelector } from './GradeSelector'

export function VerificationForm({
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
