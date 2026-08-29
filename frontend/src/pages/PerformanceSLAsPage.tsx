import { useMemo, useState } from 'react'
import { Shield, AlertTriangle, CheckCircle2, XCircle, ChevronDown, ChevronUp, Info } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import {
  SLA_TARGETS,
  generateSampleMeasurements,
  computeSLAReport,
  getSLAStatusBadgeClass,
  getCategoryLabel,
  type SLATarget,
  type SLAReport,
  type SLAStatus,
  type SLACategory,
} from '@/lib/performanceSLAs'

// ─── Status icon ──────────────────────────────────────────────────────────────

function SLAStatusIcon({ status }: { status: SLAStatus }) {
  if (status === 'compliant') return <CheckCircle2 className="h-4 w-4 text-green-500" />
  if (status === 'at_risk') return <AlertTriangle className="h-4 w-4 text-yellow-500" />
  return <XCircle className="h-4 w-4 text-red-500" />
}

// ─── Mini sparkline (CSS-only) ────────────────────────────────────────────────

function ComplianceBar({ percent, target }: { percent: number; target: number }) {
  const width = Math.min(100, percent)
  const color = percent >= target ? 'bg-green-500' : percent >= target - 1 ? 'bg-yellow-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${width}%` }} />
      </div>
      <span className="text-xs font-medium w-14 text-right">{percent.toFixed(2)}%</span>
    </div>
  )
}

// ─── SLA row ──────────────────────────────────────────────────────────────────

function SLARow({ target, report }: { target: SLATarget; report: SLAReport }) {
  const [expanded, setExpanded] = useState(false)

  const thresholdLabel =
    target.maxValue !== undefined
      ? `≤ ${target.maxValue} ${target.unit}`
      : `≥ ${target.minValue} ${target.unit}`

  return (
    <div className="border rounded-lg p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <SLAStatusIcon status={report.status} />
          <span className="font-medium text-sm">{target.name}</span>
          <Badge className={`text-xs border ${getSLAStatusBadgeClass(report.status)}`}>
            {report.status.replace('_', ' ')}
          </Badge>
          <Badge className="text-xs bg-muted text-muted-foreground">
            {getCategoryLabel(target.category)}
          </Badge>
        </div>
        <button onClick={() => setExpanded((v) => !v)} className="shrink-0 text-muted-foreground">
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      <p className="text-xs text-muted-foreground">{target.description}</p>

      <ComplianceBar percent={report.compliancePercent} target={target.targetPercent} />

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>Target: {target.targetPercent}% compliance</span>
        <span>Threshold: {thresholdLabel}</span>
        <span>Period: {target.period}</span>
        {report.violations > 0 && (
          <span className="text-red-600 font-medium">{report.violations} violation{report.violations > 1 ? 's' : ''}</span>
        )}
        <span>Avg: {report.avgValue.toFixed(target.category === 'error_rate' ? 3 : 0)} {target.unit}</span>
        <span>P95: {report.p95Value.toFixed(target.category === 'error_rate' ? 3 : 0)} {target.unit}</span>
      </div>

      {expanded && (
        <div className="border-t pt-3 space-y-2 text-sm">
          <p className="font-medium text-xs uppercase tracking-wide text-muted-foreground">
            Violation Procedure
          </p>
          <p className="text-sm">{target.violationProcedure}</p>
        </div>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

const CATEGORIES: SLACategory[] = ['availability', 'latency', 'web_vitals', 'error_rate', 'throughput']

export function PerformanceSLAsPage() {
  const [activeCategory, setActiveCategory] = useState<SLACategory | 'all'>('all')

  const reports = useMemo(
    () =>
      Object.fromEntries(
        SLA_TARGETS.map((t) => {
          const measurements = generateSampleMeasurements(t)
          return [t.id, computeSLAReport(t, measurements)]
        })
      ),
    []
  )

  const filtered = SLA_TARGETS.filter(
    (t) => activeCategory === 'all' || t.category === activeCategory
  )

  const compliantCount = Object.values(reports).filter((r) => r.status === 'compliant').length
  const atRiskCount = Object.values(reports).filter((r) => r.status === 'at_risk').length
  const violatedCount = Object.values(reports).filter((r) => r.status === 'violated').length

  return (
    <main className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Shield className="h-6 w-6" />
          Performance SLAs
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Service level agreements, current compliance, and violation procedures.
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-2xl font-bold text-green-600">{compliantCount}</p>
            <p className="text-sm text-muted-foreground">Compliant</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-2xl font-bold text-yellow-600">{atRiskCount}</p>
            <p className="text-sm text-muted-foreground">At risk</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-2xl font-bold text-red-600">{violatedCount}</p>
            <p className="text-sm text-muted-foreground">Violated</p>
          </CardContent>
        </Card>
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setActiveCategory('all')}
          className={`px-3 py-1 rounded-full text-sm border transition-colors ${
            activeCategory === 'all'
              ? 'bg-foreground text-background border-foreground'
              : 'border-border text-muted-foreground hover:text-foreground'
          }`}
        >
          All ({SLA_TARGETS.length})
        </button>
        {CATEGORIES.map((cat) => {
          const count = SLA_TARGETS.filter((t) => t.category === cat).length
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                activeCategory === cat
                  ? 'bg-foreground text-background border-foreground'
                  : 'border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {getCategoryLabel(cat)} ({count})
            </button>
          )
        })}
      </div>

      {/* SLA list */}
      <div className="space-y-3">
        {filtered.map((target) => (
          <SLARow key={target.id} target={target} report={reports[target.id]} />
        ))}
      </div>

      {/* Info */}
      <div className="flex gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-sm text-blue-700 dark:text-blue-300">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <p>
          Measurements shown are simulated samples. In production, connect this page to your
          Prometheus / Grafana metrics pipeline. See{' '}
          <code className="font-mono text-xs">docs/PERFORMANCE_SLA_GUIDE.md</code> for configuration.
        </p>
      </div>
    </main>
  )
}
