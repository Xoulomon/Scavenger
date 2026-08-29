import { memo, useMemo } from 'react'
import { PieChart } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'

const WASTE_DATA = [
  { label: 'Plastic', value: 35, color: '#3b82f6' },
  { label: 'Metal', value: 25, color: '#22c55e' },
  { label: 'Glass', value: 20, color: '#a855f7' },
  { label: 'Paper', value: 12, color: '#f97316' },
  { label: 'E-Waste', value: 8, color: '#ef4444' },
]

function WasteTypeChartComponent() {
  // Memoize data transformation to prevent recalculation on every render
  const { total, slices } = useMemo(() => {
    const total = WASTE_DATA.reduce((sum, d) => sum + d.value, 0)
    const radius = 60
    const cx = 80
    const cy = 80
    const circumference = 2 * Math.PI * radius

    let cumulative = 0
    const slices = WASTE_DATA.map((d) => {
      const offset = circumference * (1 - cumulative / total)
      const dash = (d.value / total) * circumference
      cumulative += d.value
      return { ...d, offset, dash }
    })

    return { total, slices }
  }, [])

  const radius = 60
  const cx = 80
  const cy = 80
  const circumference = 2 * Math.PI * radius
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <PieChart className="h-4 w-4" />
          Waste Type Distribution
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-6">
          <svg width="160" height="160" viewBox="0 0 160 160" aria-label="Waste type donut chart">
            {slices.map((s) => (
              <circle
                key={s.label}
                cx={cx}
                cy={cy}
                r={radius}
                fill="none"
                stroke={s.color}
                strokeWidth="28"
                strokeDasharray={`${s.dash} ${circumference - s.dash}`}
                strokeDashoffset={s.offset}
                transform={`rotate(-90 ${cx} ${cy})`}
              />
            ))}
            <text x={cx} y={cy - 6} textAnchor="middle" className="fill-foreground text-sm font-bold" fontSize="14">
              {total}
            </text>
            <text x={cx} y={cy + 12} textAnchor="middle" className="fill-muted-foreground" fontSize="10">
              total
            </text>
          </svg>
          <div className="flex-1 space-y-2">
            {WASTE_DATA.map((d) => (
              <div key={d.label} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: d.color }} />
                  <span>{d.label}</span>
                </div>
                <span className="font-medium">{d.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Memoize component to prevent re-renders when parent re-renders with same props
export const WasteTypeChart = memo(WasteTypeChartComponent)
