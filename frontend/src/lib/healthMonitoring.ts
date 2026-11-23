/**
 * Platform Health Monitoring
 * Tracks service status, incidents, and health history.
 */

export type ServiceStatus =
  'operational' | 'degraded' | 'partial_outage' | 'major_outage' | 'maintenance'

export interface ServiceHealth {
  id: string
  name: string
  description: string
  status: ServiceStatus
  uptimePercent: number
  lastChecked: number
  responseTimeMs?: number
  group: string
}

export interface Incident {
  id: string
  title: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  status: 'investigating' | 'identified' | 'monitoring' | 'resolved'
  affectedServices: string[]
  createdAt: number
  updatedAt: number
  resolvedAt?: number
  message: string
}

export interface HealthHistory {
  serviceId: string
  timestamp: number
  status: ServiceStatus
  responseTimeMs?: number
}

export interface PlatformHealth {
  overallStatus: ServiceStatus
  services: ServiceHealth[]
  activeIncidents: Incident[]
  lastUpdated: number
}

// ─── Status helpers ───────────────────────────────────────────────────────────

export function getStatusLabel(status: ServiceStatus): string {
  const labels: Record<ServiceStatus, string> = {
    operational: 'Operational',
    degraded: 'Degraded Performance',
    partial_outage: 'Partial Outage',
    major_outage: 'Major Outage',
    maintenance: 'Under Maintenance'
  }
  return labels[status]
}

export function getStatusColor(status: ServiceStatus): string {
  const colors: Record<ServiceStatus, string> = {
    operational: 'text-green-600',
    degraded: 'text-yellow-600',
    partial_outage: 'text-orange-600',
    major_outage: 'text-red-600',
    maintenance: 'text-blue-600'
  }
  return colors[status]
}

export function getStatusBg(status: ServiceStatus): string {
  const colors: Record<ServiceStatus, string> = {
    operational: 'bg-green-500',
    degraded: 'bg-yellow-500',
    partial_outage: 'bg-orange-500',
    major_outage: 'bg-red-500',
    maintenance: 'bg-blue-500'
  }
  return colors[status]
}

/** Compute overall platform status from individual service statuses. */
export function computeOverallStatus(services: ServiceHealth[]): ServiceStatus {
  if (services.some((s) => s.status === 'major_outage')) return 'major_outage'
  if (services.some((s) => s.status === 'partial_outage')) return 'partial_outage'
  if (services.some((s) => s.status === 'degraded')) return 'degraded'
  if (services.some((s) => s.status === 'maintenance')) return 'maintenance'
  return 'operational'
}

// ─── Mock service definitions ─────────────────────────────────────────────────
// In production these would come from a /health API endpoint.

export const DEFAULT_SERVICES: ServiceHealth[] = [
  {
    id: 'stellar-rpc',
    name: 'Stellar RPC',
    description: 'Soroban RPC endpoint for contract calls',
    status: 'operational',
    uptimePercent: 99.97,
    lastChecked: Date.now(),
    responseTimeMs: 145,
    group: 'Blockchain'
  },
  {
    id: 'smart-contract',
    name: 'Smart Contract',
    description: 'Scavngr Soroban contract on Stellar',
    status: 'operational',
    uptimePercent: 99.99,
    lastChecked: Date.now(),
    responseTimeMs: 210,
    group: 'Blockchain'
  },
  {
    id: 'backend-api',
    name: 'Backend API',
    description: 'Rust/Axum REST API server',
    status: 'operational',
    uptimePercent: 99.95,
    lastChecked: Date.now(),
    responseTimeMs: 58,
    group: 'Infrastructure'
  },
  {
    id: 'indexer',
    name: 'Event Indexer',
    description: 'TypeScript event indexer and query service',
    status: 'operational',
    uptimePercent: 99.9,
    lastChecked: Date.now(),
    responseTimeMs: 32,
    group: 'Infrastructure'
  },
  {
    id: 'database',
    name: 'Database',
    description: 'PostgreSQL primary database',
    status: 'operational',
    uptimePercent: 99.99,
    lastChecked: Date.now(),
    responseTimeMs: 12,
    group: 'Infrastructure'
  },
  {
    id: 'cache',
    name: 'Cache (Redis)',
    description: 'Redis caching layer',
    status: 'operational',
    uptimePercent: 99.95,
    lastChecked: Date.now(),
    responseTimeMs: 2,
    group: 'Infrastructure'
  },
  {
    id: 'frontend-cdn',
    name: 'Frontend CDN',
    description: 'Static asset delivery network',
    status: 'operational',
    uptimePercent: 100,
    lastChecked: Date.now(),
    responseTimeMs: 18,
    group: 'Frontend'
  },
  {
    id: 'firebase-auth',
    name: 'Authentication',
    description: 'Firebase Authentication service',
    status: 'operational',
    uptimePercent: 99.98,
    lastChecked: Date.now(),
    responseTimeMs: 95,
    group: 'Frontend'
  }
]

export const SAMPLE_INCIDENTS: Incident[] = [
  {
    id: 'inc-001',
    title: 'Elevated RPC response times',
    severity: 'medium',
    status: 'resolved',
    affectedServices: ['stellar-rpc'],
    createdAt: Date.now() - 86_400_000 * 3,
    updatedAt: Date.now() - 86_400_000 * 3 + 7_200_000,
    resolvedAt: Date.now() - 86_400_000 * 3 + 7_200_000,
    message:
      'Stellar testnet experienced elevated latency. Issue resolved after Stellar network maintenance.'
  },
  {
    id: 'inc-002',
    title: 'Database connection pool exhaustion',
    severity: 'high',
    status: 'resolved',
    affectedServices: ['database', 'backend-api'],
    createdAt: Date.now() - 86_400_000 * 7,
    updatedAt: Date.now() - 86_400_000 * 7 + 1_800_000,
    resolvedAt: Date.now() - 86_400_000 * 7 + 1_800_000,
    message:
      'Connection pool was exhausted under peak load. Pool size increased and query optimisations applied.'
  }
]

// ─── History helpers ──────────────────────────────────────────────────────────

const HISTORY_KEY = 'scavngr_health_history'

export function recordHealthSnapshot(services: ServiceHealth[]): void {
  try {
    const history: HealthHistory[] = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]')
    const now = Date.now()
    services.forEach((s) => {
      history.push({
        serviceId: s.id,
        timestamp: now,
        status: s.status,
        responseTimeMs: s.responseTimeMs
      })
    })
    // Keep only last 24 h worth of snapshots per service (288 @ 5 min intervals)
    const cutoff = now - 86_400_000
    localStorage.setItem(
      HISTORY_KEY,
      JSON.stringify(history.filter((h) => h.timestamp > cutoff).slice(-5000))
    )
  } catch {
    /* non-critical */
  }
}

export function getHealthHistory(serviceId: string): HealthHistory[] {
  try {
    const all: HealthHistory[] = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]')
    return all.filter((h) => h.serviceId === serviceId).slice(-48)
  } catch {
    return []
  }
}

export function getUptimeWindows(
  services: ServiceHealth[]
): { label: string; up: number; total: number }[] {
  return [
    {
      label: '24h',
      up: services.filter((s) => s.status === 'operational').length,
      total: services.length
    },
    {
      label: '7d',
      up: services.filter((s) => s.uptimePercent >= 99).length,
      total: services.length
    },
    {
      label: '30d',
      up: services.filter((s) => s.uptimePercent >= 99.5).length,
      total: services.length
    }
  ]
}
