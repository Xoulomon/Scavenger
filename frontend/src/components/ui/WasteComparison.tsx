import { Waste } from '@/api/types'
import { wasteTypeLabel, formatDate } from '@/lib/helpers'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Download } from 'lucide-react'

export interface WasteComparisonProps {
  wastes: Waste[]
}

interface Row {
  label: string
  values: (string | number)[]
  highlight?: boolean
}

function numericValues(values: (string | number)[]): number[] {
  return values.map((v) => (typeof v === 'number' ? v : parseFloat(String(v)) || 0))
}

function cellClass(value: string | number, values: (string | number)[], highlight?: boolean): string {
  if (!highlight) return ''
  const nums = numericValues(values)
  const max = Math.max(...nums)
  const min = Math.min(...nums)
  const n = typeof value === 'number' ? value : parseFloat(String(value)) || 0
  if (n === max && max !== min) return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
  if (n === min && max !== min) return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
  return ''
}

function buildRows(wastes: Waste[]): Row[] {
  return [
    {
      label: 'Waste Type',
      values: wastes.map((w) => wasteTypeLabel(w.waste_type)),
    },
    {
      label: 'Weight (kg)',
      values: wastes.map((w) => Math.round((Number(w.weight) / 1000) * 100) / 100),
      highlight: true,
    },
    {
      label: 'Status',
      values: wastes.map((w) => (!w.is_active ? 'Inactive' : w.is_confirmed ? 'Confirmed' : 'Pending')),
    },
    {
      label: 'Date',
      values: wastes.map((w) => formatDate(w.recycled_timestamp)),
    },
    {
      label: 'Waste ID',
      values: wastes.map((w) => `#${String(w.waste_id)}`),
    },
  ]
}

function exportCsv(wastes: Waste[], rows: Row[]) {
  const headers = ['Field', ...wastes.map((w) => `Waste #${String(w.waste_id)}`)]
  const lines = [
    headers.join(','),
    ...rows.map((r) => [r.label, ...r.values.map((v) => `"${v}"`)].join(',')),
  ]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'waste-comparison.csv'
  a.click()
  URL.revokeObjectURL(url)
}

export function WasteComparison({ wastes }: WasteComparisonProps) {
  if (wastes.length === 0) return null
  const rows = buildRows(wastes)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Comparing {wastes.length} waste item{wastes.length !== 1 ? 's' : ''}</p>
        <Button size="sm" variant="outline" onClick={() => exportCsv(wastes, rows)}>
          <Download className="mr-2 h-3 w-3" /> Export CSV
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">Field</th>
              {wastes.map((w) => (
                <th key={String(w.waste_id)} className="px-4 py-2 text-left font-medium">
                  <div className="flex items-center gap-1.5">
                    <Badge variant="secondary">{wasteTypeLabel(w.waste_type)}</Badge>
                    <span className="text-xs text-muted-foreground">#{String(w.waste_id)}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-b last:border-0 hover:bg-muted/30">
                <td className="px-4 py-2 font-medium text-muted-foreground">{row.label}</td>
                {row.values.map((val, i) => (
                  <td
                    key={i}
                    className={`px-4 py-2 ${cellClass(val, row.values, row.highlight)}`}
                  >
                    {String(val)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// Re-export helpers for tests
export { buildRows, cellClass, numericValues }
