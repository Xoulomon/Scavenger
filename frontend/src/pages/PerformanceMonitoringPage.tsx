import { useState, useEffect, useCallback } from 'react'
import { Activity, Gauge, Timer, Layers, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'
import { StatCard } from '@/components/ui/StatCard'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { usePerformanceMonitoring } from '@/hooks/usePerformanceMonitoring'
import {
  initWebVitals,
  validatePerformanceBudgets,
  type WebVital,
  type PerformanceMetrics
} from '@/lib/webVitals'

const METRIC_CONFIG: Record<string, { label: string; unit: string; description: string }> = {
  LCP: {
    label: 'Largest Contentful Paint',
    unit: 'ms',
    description: 'Time until the largest content element renders'
  },
  FCP: {
    label: 'First Contentful Paint',
    unit: 'ms',
    description: 'Time until first content appears on screen'
  },
  INP: {
    label: 'Interaction to Next Paint',
    unit: 'ms',
    description: 'Responsiveness to user interactions'
  },
  CLS: {
    label: 'Cumulative Layout Shift',
    unit: '',
    description: 'Visual stability — unexpected layout shifts'
  },
  TTFB: {
    label: 'Time to First Byte',
    unit: 'ms',
    description: 'Server response time to first byte'
  }
}

const RATING_STYLES: Record<string, string> = {
  good: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400',
  'needs-improvement':
    'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400',
  poor: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400'
}

function RatingIcon({ rating }: { rating?: string }) {
  if (rating === 'good') return <CheckCircle2 className="h-4 w-4 text-green-500" />
  if (rating === 'needs-improvement') return <AlertTriangle className="h-4 w-4 text-yellow-500" />
  return <XCircle className="h-4 w-4 text-red-500" />
}

function MetricCard({ name, metric }: { name: string; metric?: WebVital }) {
  const config = METRIC_CONFIG[name]
  if (!metric || !config) return null

  const displayValue =
    name === 'CLS' ? metric.value.toFixed(3) : `${metric.value.toFixed(0)}${config.unit}`

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {config.label}
          </CardTitle>
          {metric.rating && <RatingIcon rating={metric.rating} />}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-2xl font-bold">{displayValue}</p>
        {metric.rating && (
          <Badge className={`border text-xs font-medium ${RATING_STYLES[metric.rating] ?? ''}`}>
            {metric.rating.replace('-', ' ')}
          </Badge>
        )}
        <p className="text-xs text-muted-foreground">{config.description}</p>
      </CardContent>
    </Card>
  )
}

export function PerformanceMonitoringPage() {
  usePerformanceMonitoring()

  const [metrics, setMetrics] = useState<PerformanceMetrics>({})
  const [alerts, setAlerts] = useState<string[]>([])
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())

  const handleMetric = useCallback((metric: WebVital) => {
    setMetrics((prev) => ({ ...prev, [metric.name.toLowerCase()]: metric }))
    setLastUpdated(new Date())
  }, [])

  useEffect(() => {
    const cleanup = initWebVitals(handleMetric)
    return cleanup
  }, [handleMetric])

  useEffect(() => {
    const result = validatePerformanceBudgets(metrics)
    setAlerts(result.violations)
  }, [metrics])

  const goodCount = Object.values(metrics).filter((m) => m?.rating === 'good').length
  const needsImprovementCount = Object.values(metrics).filter(
    (m) => m?.rating === 'needs-improvement'
  ).length
  const poorCount = Object.values(metrics).filter((m) => m?.rating === 'poor').length
  const totalMetrics = goodCount + needsImprovementCount + poorCount
  const overallScore = totalMetrics > 0 ? Math.round((goodCount / totalMetrics) * 100) : null

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Performance Monitoring</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Real-time Core Web Vitals and performance metrics · Last updated{' '}
          {lastUpdated.toLocaleTimeString()}
        </p>
      </div>

      {/* Summary stat cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          icon={<Gauge className="h-4 w-4" />}
          label="Overall Score"
          value={overallScore !== null ? `${overallScore}%` : '—'}
          variant={
            overallScore !== null && overallScore >= 80
              ? 'success'
              : overallScore !== null && overallScore >= 50
                ? 'warning'
                : 'default'
          }
        />
        <StatCard
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="Good Metrics"
          value={goodCount}
          variant="success"
        />
        <StatCard
          icon={<AlertTriangle className="h-4 w-4" />}
          label="Needs Improvement"
          value={needsImprovementCount}
          variant="warning"
        />
        <StatCard
          icon={<XCircle className="h-4 w-4" />}
          label="Poor Metrics"
          value={poorCount}
          variant={poorCount > 0 ? 'destructive' : 'default'}
        />
      </div>

      {/* Performance budget alerts */}
      {alerts.length > 0 && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4" />
              Performance Budget Violations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1">
              {alerts.map((alert) => (
                <li key={alert} className="text-sm text-destructive">
                  {alert}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Core Web Vitals */}
      <div>
        <h2 className="mb-3 text-lg font-semibold">Core Web Vitals</h2>
        {totalMetrics === 0 ? (
          <Card>
            <CardContent className="flex items-center gap-3 py-8 text-muted-foreground">
              <Activity className="h-5 w-5 animate-pulse" />
              <span className="text-sm">
                Collecting metrics — interact with the page to generate data…
              </span>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(['LCP', 'FCP', 'INP', 'CLS', 'TTFB'] as const).map((name) => {
              const key = name.toLowerCase() as 'lcp' | 'fcp' | 'inp' | 'cls' | 'ttfb'
              return <MetricCard key={name} name={name} metric={metrics[key]} />
            })}
          </div>
        )}
      </div>

      {/* Navigation & resource timing */}
      <div>
        <h2 className="mb-3 text-lg font-semibold">Navigation Timing</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <StatCard
            icon={<Timer className="h-4 w-4" />}
            label="Total Load Time"
            value={metrics.navigationTime ? `${metrics.navigationTime.toFixed(0)} ms` : '—'}
            variant="primary"
          />
          <StatCard
            icon={<Layers className="h-4 w-4" />}
            label="Resource Fetch Time"
            value={metrics.resourceTime ? `${metrics.resourceTime.toFixed(0)} ms` : '—'}
            variant="primary"
          />
        </div>
      </div>

      {/* Performance thresholds reference */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Performance Thresholds</CardTitle>
          <CardDescription>Targets based on Google Core Web Vitals recommendations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 font-medium">Metric</th>
                  <th className="pb-2 font-medium">Good</th>
                  <th className="pb-2 font-medium">Needs Improvement</th>
                  <th className="pb-2 font-medium">Poor</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                <tr>
                  <td className="py-2 font-medium">LCP</td>
                  <td className="py-2 text-green-600">≤ 2,500 ms</td>
                  <td className="py-2 text-yellow-600">≤ 4,000 ms</td>
                  <td className="py-2 text-destructive">&gt; 4,000 ms</td>
                </tr>
                <tr>
                  <td className="py-2 font-medium">FCP</td>
                  <td className="py-2 text-green-600">≤ 1,800 ms</td>
                  <td className="py-2 text-yellow-600">≤ 3,000 ms</td>
                  <td className="py-2 text-destructive">&gt; 3,000 ms</td>
                </tr>
                <tr>
                  <td className="py-2 font-medium">INP</td>
                  <td className="py-2 text-green-600">≤ 200 ms</td>
                  <td className="py-2 text-yellow-600">≤ 500 ms</td>
                  <td className="py-2 text-destructive">&gt; 500 ms</td>
                </tr>
                <tr>
                  <td className="py-2 font-medium">CLS</td>
                  <td className="py-2 text-green-600">≤ 0.1</td>
                  <td className="py-2 text-yellow-600">≤ 0.25</td>
                  <td className="py-2 text-destructive">&gt; 0.25</td>
                </tr>
                <tr>
                  <td className="py-2 font-medium">TTFB</td>
                  <td className="py-2 text-green-600">≤ 600 ms</td>
                  <td className="py-2 text-yellow-600">≤ 1,800 ms</td>
                  <td className="py-2 text-destructive">&gt; 1,800 ms</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
