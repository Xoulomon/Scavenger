import { memo, useMemo } from 'react'
import { BarChart3 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'

const MONTHLY_DATA = [
  { month: 'Jan', plastic: 45, metal: 30, glass: 25 },
  { month: 'Feb', plastic: 52, metal: 35, glass: 28 },
  { month: 'Mar', plastic: 61, metal: 42, glass: 33 },
  { month: 'Apr', plastic: 58, metal: 38, glass: 31 },
  { month: 'May', plastic: 67, metal: 45, glass: 36 },
  { month: 'Jun', plastic: 73, metal: 51, glass: 42 },
]

const CHART_HEIGHT = 120

function MonthlyTrendsChartComponent() {
  // Memoize max value calculation
  const maxVal = useMemo(
    () => Math.max(...MONTHLY_DATA.flatMap((d) => [d.plastic, d.metal, d.glass])),
    []
  )
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <BarChart3 className="h-4 w-4" />
          Monthly Trends
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-2 h-[120px]" role="img" aria-label="Monthly waste trends bar chart">
          {MONTHLY_DATA.map((d) => (
            <div key={d.month} className="flex flex-1 flex-col items-center gap-0.5">
              <div className="flex w-full items-end gap-0.5" style={{ height: CHART_HEIGHT }}>
                {[
                  { val: d.plastic, color: 'bg-blue-500' },
                  { val: d.metal, color: 'bg-green-500' },
                  { val: d.glass, color: 'bg-purple-500' },
                ].map(({ val, color }, i) => (
                  <div
                    key={i}
                    className={`flex-1 rounded-t ${color} transition-all duration-500`}
                    style={{ height: `${(val / maxVal) * CHART_HEIGHT}px` }}
                    title={`${val}`}
                  />
                ))}
              </div>
              <span className="text-[10px] text-muted-foreground">{d.month}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex gap-4 text-xs">
          {[
            { color: 'bg-blue-500', label: 'Plastic' },
            { color: 'bg-green-500', label: 'Metal' },
            { color: 'bg-purple-500', label: 'Glass' },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className={`h-3 w-3 rounded ${color}`} />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// Memoize component to prevent re-renders when parent re-renders with same props
export const MonthlyTrendsChart = memo(MonthlyTrendsChartComponent)
