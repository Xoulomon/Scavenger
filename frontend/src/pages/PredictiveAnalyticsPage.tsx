import { useState } from 'react'
import { TrendingUp, TrendingDown, Minus, Download } from 'lucide-react'
import { useAppTitle } from '@/hooks/useAppTitle'
import { useWastes } from '@/hooks/useWastes'
import { usePredictiveAnalytics, Prediction } from '@/hooks/usePredictiveAnalytics'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { wasteTypeLabel } from '@/lib/helpers'

function TrendIcon({ trend }: { trend: Prediction['trend'] }) {
  if (trend === 'up') return <TrendingUp className="h-4 w-4 text-green-500" />
  if (trend === 'down') return <TrendingDown className="h-4 w-4 text-red-500" />
  return <Minus className="h-4 w-4 text-muted-foreground" />
}

function MiniChart({
  points,
  forecast
}: {
  points: { x: number; y: number }[]
  forecast: { x: number; y: number }[]
}) {
  const all = [...points, ...forecast]
  if (all.length === 0) return null
  const maxY = Math.max(...all.map((p) => p.y), 1)
  const W = 200
  const H = 60
  const pad = 4

  const toSvg = (p: { x: number; y: number }, total: number) => ({
    sx: pad + (p.x / (total - 1 || 1)) * (W - 2 * pad),
    sy: H - pad - (p.y / maxY) * (H - 2 * pad)
  })

  const total = all.length
  const histPath = points
    .map((p, i) => {
      const { sx, sy } = toSvg({ x: i, y: p.y }, total)
      return `${i === 0 ? 'M' : 'L'}${sx.toFixed(1)},${sy.toFixed(1)}`
    })
    .join(' ')

  const forecastPath = forecast
    .map((p, i) => {
      const { sx, sy } = toSvg({ x: points.length + i, y: p.y }, total)
      return `${i === 0 ? 'M' : 'L'}${sx.toFixed(1)},${sy.toFixed(1)}`
    })
    .join(' ')

  return (
    <svg width={W} height={H} className="overflow-visible">
      {histPath && (
        <path
          d={histPath}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="text-primary"
        />
      )}
      {forecastPath && (
        <path
          d={forecastPath}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeDasharray="4 2"
          className="text-orange-400"
        />
      )}
    </svg>
  )
}

function exportPredictions(predictions: Prediction[]) {
  const lines = ['Waste Type,Trend,Slope,R²,Forecast W1,Forecast W2,Forecast W3,Forecast W4']
  for (const p of predictions) {
    if (p.historicalPoints.length === 0) continue
    const forecasts = p.forecastPoints.map((f) => f.y).join(',')
    lines.push(
      `${wasteTypeLabel(p.wasteType)},${p.trend},${p.regression.slope},${p.regression.r2},${forecasts}`
    )
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'predictions.csv'
  a.click()
  URL.revokeObjectURL(url)
}

export function PredictiveAnalyticsPage() {
  useAppTitle('Predictive Analytics')
  const { wastes, isLoading } = useWastes()
  const { predictions, optimalTimes } = usePredictiveAnalytics(wastes)
  const [activeType, setActiveType] = useState<number | null>(null)

  const activePrediction =
    activeType !== null ? predictions.find((p) => p.wasteType === activeType) : null
  const hasData = predictions.some((p) => p.historicalPoints.length > 0)

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Predictive Analytics</h1>
        </div>
        {hasData && (
          <Button size="sm" variant="outline" onClick={() => exportPredictions(predictions)}>
            <Download className="mr-2 h-3 w-3" /> Export
          </Button>
        )}
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      )}

      {!isLoading && !hasData && (
        <EmptyState
          icon={TrendingUp}
          title="No data yet"
          description="Submit waste items to see predictions"
        />
      )}

      {!isLoading && hasData && (
        <>
          {/* Trend cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {predictions.map((p) => (
              <Card
                key={p.wasteType}
                className={`cursor-pointer transition-shadow hover:shadow-md ${activeType === p.wasteType ? 'ring-2 ring-primary' : ''}`}
                onClick={() => setActiveType(activeType === p.wasteType ? null : p.wasteType)}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between text-sm">
                    <span>{wasteTypeLabel(p.wasteType)}</span>
                    <TrendIcon trend={p.trend} />
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {p.historicalPoints.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No data</p>
                  ) : (
                    <>
                      <MiniChart points={p.historicalPoints} forecast={p.forecastPoints} />
                      <div className="flex gap-2 text-xs text-muted-foreground">
                        <span>R²: {p.regression.r2}</span>
                        <span>·</span>
                        <span
                          className={
                            p.trend === 'up'
                              ? 'text-green-600'
                              : p.trend === 'down'
                                ? 'text-red-600'
                                : ''
                          }
                        >
                          {p.trend === 'up'
                            ? '↑ Growing'
                            : p.trend === 'down'
                              ? '↓ Declining'
                              : '→ Stable'}
                        </span>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Detail panel */}
          {activePrediction && activePrediction.historicalPoints.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {wasteTypeLabel(activePrediction.wasteType)} — Forecast Detail
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-4 text-sm">
                  <div className="rounded-md bg-muted px-3 py-2">
                    <p className="text-xs text-muted-foreground">Slope</p>
                    <p className="font-bold">{activePrediction.regression.slope} kg/week</p>
                  </div>
                  <div className="rounded-md bg-muted px-3 py-2">
                    <p className="text-xs text-muted-foreground">R² (fit quality)</p>
                    <p className="font-bold">{activePrediction.regression.r2}</p>
                  </div>
                  <div className="rounded-md bg-muted px-3 py-2">
                    <p className="text-xs text-muted-foreground">Historical weeks</p>
                    <p className="font-bold">{activePrediction.historicalPoints.length}</p>
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-sm font-medium">
                    4-Week Forecast with 95% Confidence Interval
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="px-3 py-1.5 text-left text-muted-foreground">Period</th>
                          <th className="px-3 py-1.5 text-left text-muted-foreground">
                            Predicted (kg)
                          </th>
                          <th className="px-3 py-1.5 text-left text-muted-foreground">Lower</th>
                          <th className="px-3 py-1.5 text-left text-muted-foreground">Upper</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activePrediction.forecastPoints.map((fp, i) => (
                          <tr key={fp.x} className="border-b last:border-0">
                            <td className="px-3 py-1.5">Week +{i + 1}</td>
                            <td className="px-3 py-1.5 font-medium">{fp.y}</td>
                            <td className="px-3 py-1.5 text-muted-foreground">
                              {activePrediction.confidenceInterval[i]?.lower}
                            </td>
                            <td className="px-3 py-1.5 text-muted-foreground">
                              {activePrediction.confidenceInterval[i]?.upper}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Optimal collection times */}
          {optimalTimes.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Suggested Collection Times</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {optimalTimes.map((ot) => (
                  <div key={ot.wasteType} className="rounded-md border p-3 text-sm">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{wasteTypeLabel(ot.wasteType)}</Badge>
                      <span className="font-medium">{ot.suggestedPeriod}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{ot.reason}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
