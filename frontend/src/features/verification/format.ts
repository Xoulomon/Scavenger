import type { Material } from '@/api/types'
import { formatDate,wasteTypeLabel } from '@/lib/helpers'

import type { VerificationRecord } from './types'

export function formatWeight(weight: number): string {
  return weight >= 1000 ? `${(weight / 1000).toFixed(2)} kg` : `${weight} g`
}

export function exportVerificationCsv(materials: Material[], history: VerificationRecord[]) {
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
