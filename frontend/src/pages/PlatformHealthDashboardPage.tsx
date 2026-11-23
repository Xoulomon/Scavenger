import { useState, useEffect } from 'react'
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Wrench,
  RefreshCw,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { useAsync } from '@/hooks/useAsync'
import {
  DEFAULT_SERVICES,
  SAMPLE_INCIDENTS,
  computeOverallStatus,
  getStatusLabel,
  getStatusColor,
  getStatusBg,
  recordHealthSnapshot,
  type ServiceHealth,
  type ServiceStatus,
  type Incident
} from '@/lib/healthMonitoring'

// ─── Status icon ──────────────────────────────────────────────────────────────

function StatusIcon({
  status,
  className = 'h-5 w-5'
}: {
  status: ServiceStatus
  className?: string
}) {
  if (status === 'operational') return <CheckCircle2 className={`${className} text-green-500`} />
  if (status === 'maintenance') return <Wrench className={`${className} text-blue-500`} />
  if (status === 'degraded') return <AlertTriangle className={`${className} text-yellow-500`} />
  return <XCircle className={`${className} text-red-500`} />
}

// ─── Overall banner ───────────────────────────────────────────────────────────

function OverallBanner({ status }: { status: ServiceStatus }) {
  const bg: Record<ServiceStatus, string> = {
    operational: 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800',
    degraded: 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800',
    partial_outage: 'bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-800',
    major_outage: 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800',
    maintenance: 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800'
  }

  return (
    <div className={`border rounded-lg p-4 flex items-center gap-3 ${bg[status]}`}>
      <StatusIcon status={status} className="h-6 w-6 shrink-0" />
      <div>
        <p className={`font-semibold ${getStatusColor(status)}`}>{getStatusLabel(status)}</p>
        <p className="text-sm text-muted-foreground">
          {status === 'operational'
            ? 'All systems are operating normally.'
            : 'Some services are experiencing issues. Our team is investigating.'}
        </p>
      </div>
    </div>
  )
}

// ─── Service row ──────────────────────────────────────────────────────────────

function ServiceRow({ service }: { service: ServiceHealth }) {
  return (
    <div className="flex items-center justify-between py-3 border-b last:border-0">
      <div className="flex items-center gap-3">
        <StatusIcon status={service.status} />
        <div>
          <p className="font-medium text-sm">{service.name}</p>
          <p className="text-xs text-muted-foreground">{service.description}</p>
        </div>
      </div>
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        {service.responseTimeMs !== undefined && (
          <span className="hidden sm:block">{service.responseTimeMs} ms</span>
        )}
        <span className="hidden sm:block">{service.uptimePercent.toFixed(2)}% uptime</span>
        <span className={`font-medium ${getStatusColor(service.status)}`}>
          {getStatusLabel(service.status)}
        </span>
      </div>
    </div>
  )
}

// ─── Incident card ────────────────────────────────────────────────────────────

const SEVERITY_STYLES: Record<string, string> = {
  low: 'bg-blue-100 text-blue-700 border-blue-200',
  medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  high: 'bg-orange-100 text-orange-700 border-orange-200',
  critical: 'bg-red-100 text-red-700 border-red-200'
}

const INCIDENT_STATUS_STYLES: Record<string, string> = {
  investigating: 'bg-red-100 text-red-700',
  identified: 'bg-orange-100 text-orange-700',
  monitoring: 'bg-yellow-100 text-yellow-700',
  resolved: 'bg-green-100 text-green-700'
}

function IncidentCard({ incident }: { incident: Incident }) {
  const [expanded, setExpanded] = useState(false)
  const duration = incident.resolvedAt
    ? Math.round((incident.resolvedAt - incident.createdAt) / 60_000)
    : null

  return (
    <div className="border rounded-lg p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm">{incident.title}</span>
          <Badge className={`text-xs border ${SEVERITY_STYLES[incident.severity] ?? ''}`}>
            {incident.severity}
          </Badge>
          <Badge className={`text-xs ${INCIDENT_STATUS_STYLES[incident.status] ?? ''}`}>
            {incident.status}
          </Badge>
        </div>
        <button onClick={() => setExpanded((v) => !v)} className="shrink-0 text-muted-foreground">
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {new Date(incident.createdAt).toLocaleDateString()}
        </span>
        {duration !== null && <span>Resolved in {duration} min</span>}
        <span>Affected: {incident.affectedServices.join(', ')}</span>
      </div>
      {expanded && (
        <p className="text-sm text-muted-foreground border-t pt-2">{incident.message}</p>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function PlatformHealthDashboardPage() {
  const [services, setServices] = useState<ServiceHealth[]>(DEFAULT_SERVICES)
  const [lastRefreshed, setLastRefreshed] = useState(new Date())

  const overallStatus = computeOverallStatus(services)

  // Group services
  const groups = [...new Set(services.map((s) => s.group))]

  const { run: refresh, isLoading: isRefreshing } = useAsync(async () => {
    await new Promise((r) => setTimeout(r, 600)) // simulate network call
    setServices((prev) => {
      const refreshed = prev.map((s) => ({
        ...s,
        lastChecked: Date.now(),
        responseTimeMs: s.responseTimeMs
          ? Math.max(1, s.responseTimeMs + Math.round((Math.random() - 0.5) * 20))
          : undefined
      }))
      recordHealthSnapshot(refreshed)
      return refreshed
    })
    setLastRefreshed(new Date())
  })

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const id = setInterval(refresh, 60_000)
    return () => clearInterval(id)
  }, [refresh])

  const operationalCount = services.filter((s) => s.status === 'operational').length
  const avgUptime = services.reduce((sum, s) => sum + s.uptimePercent, 0) / services.length
  const avgResponseMs =
    services
      .filter((s) => s.responseTimeMs != null)
      .reduce((sum, s) => sum + (s.responseTimeMs ?? 0), 0) /
    services.filter((s) => s.responseTimeMs != null).length

  return (
    <main className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="h-6 w-6" />
            Platform Health
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Real-time status of all Scavngr services
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={isRefreshing}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'Checking…' : `Updated ${lastRefreshed.toLocaleTimeString()}`}
        </button>
      </div>

      <OverallBanner status={overallStatus} />

      {/* Summary metrics */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-2xl font-bold text-green-600">
              {operationalCount}/{services.length}
            </p>
            <p className="text-sm text-muted-foreground">Services operational</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-2xl font-bold">{avgUptime.toFixed(2)}%</p>
            <p className="text-sm text-muted-foreground">Avg uptime</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-2xl font-bold">{avgResponseMs.toFixed(0)} ms</p>
            <p className="text-sm text-muted-foreground">Avg response time</p>
          </CardContent>
        </Card>
      </div>

      {/* Services by group */}
      {groups.map((group) => (
        <Card key={group}>
          <CardHeader>
            <CardTitle className="text-base">{group}</CardTitle>
          </CardHeader>
          <CardContent className="divide-y p-0 px-6">
            {services
              .filter((s) => s.group === group)
              .map((s) => (
                <ServiceRow key={s.id} service={s} />
              ))}
          </CardContent>
        </Card>
      ))}

      {/* Incidents */}
      <Card>
        <CardHeader>
          <CardTitle>Incident History</CardTitle>
          <CardDescription>Recent platform incidents and resolutions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {SAMPLE_INCIDENTS.map((inc) => (
            <IncidentCard key={inc.id} incident={inc} />
          ))}
        </CardContent>
      </Card>

      {/* Status dot legend */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        {(
          [
            'operational',
            'degraded',
            'partial_outage',
            'major_outage',
            'maintenance'
          ] as ServiceStatus[]
        ).map((s) => (
          <span key={s} className="flex items-center gap-1.5">
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${getStatusBg(s)}`} />
            {getStatusLabel(s)}
          </span>
        ))}
      </div>
    </main>
  )
}
