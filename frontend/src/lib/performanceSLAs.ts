/**
 * Performance SLA Definitions and Monitoring
 * Defines targets, tracks compliance, and generates reports.
 */

export type SLAStatus = 'compliant' | 'at_risk' | 'violated'
export type SLACategory = 'availability' | 'latency' | 'throughput' | 'error_rate' | 'web_vitals'

export interface SLATarget {
  id: string
  name: string
  description: string
  category: SLACategory
  metric: string
  /** Threshold that must NOT be exceeded (for latency/error targets) */
  maxValue?: number
  /** Threshold that must be MET or exceeded (for availability/throughput) */
  minValue?: number
  unit: string
  /**
   * Compliance level in %. E.g. 99.9 means the SLA must hold 99.9% of the time.
   * For non-time-series targets (one-shot measurements) this is used as a
   * pass/fail threshold multiplier.
   */
  targetPercent: number
  period: 'hourly' | 'daily' | 'weekly' | 'monthly'
  violationProcedure: string
}

export interface SLAMeasurement {
  targetId: string
  value: number
  timestamp: number
  compliant: boolean
}

export interface SLAReport {
  targetId: string
  period: string
  measurements: SLAMeasurement[]
  compliancePercent: number
  status: SLAStatus
  avgValue: number
  p95Value: number
  violations: number
}

// ─── SLA catalogue ────────────────────────────────────────────────────────────

export const SLA_TARGETS: SLATarget[] = [
  // Availability
  {
    id: 'availability-api',
    name: 'API Availability',
    description: 'Backend REST API must be available and responding to health checks',
    category: 'availability',
    metric: 'api_uptime_percent',
    minValue: 99.9,
    unit: '%',
    targetPercent: 99.9,
    period: 'monthly',
    violationProcedure:
      'Page on-call engineer. Escalate to engineering lead if unresolved in 15 min.'
  },
  {
    id: 'availability-rpc',
    name: 'Stellar RPC Availability',
    description: 'Soroban RPC endpoint must be reachable for contract interactions',
    category: 'availability',
    metric: 'rpc_uptime_percent',
    minValue: 99.5,
    unit: '%',
    targetPercent: 99.5,
    period: 'monthly',
    violationProcedure: 'Switch to failover RPC endpoint. Notify blockchain team.'
  },
  {
    id: 'availability-indexer',
    name: 'Indexer Availability',
    description: 'Event indexer must process and serve on-chain events',
    category: 'availability',
    metric: 'indexer_uptime_percent',
    minValue: 99.0,
    unit: '%',
    targetPercent: 99.0,
    period: 'monthly',
    violationProcedure: 'Restart indexer pod. Check Stellar network connectivity.'
  },

  // Latency
  {
    id: 'latency-api-p95',
    name: 'API P95 Latency',
    description: '95th percentile response time for all API endpoints',
    category: 'latency',
    metric: 'api_response_time_p95_ms',
    maxValue: 500,
    unit: 'ms',
    targetPercent: 99,
    period: 'daily',
    violationProcedure: 'Investigate slow query logs. Scale API replicas if CPU > 80%.'
  },
  {
    id: 'latency-api-p99',
    name: 'API P99 Latency',
    description: '99th percentile response time for all API endpoints',
    category: 'latency',
    metric: 'api_response_time_p99_ms',
    maxValue: 2000,
    unit: 'ms',
    targetPercent: 99,
    period: 'daily',
    violationProcedure: 'Identify outlier endpoints. Add query result caching.'
  },
  {
    id: 'latency-contract-submit',
    name: 'Contract Submission Latency',
    description: 'Time to submit and confirm a waste transaction on Stellar',
    category: 'latency',
    metric: 'contract_submission_p95_ms',
    maxValue: 10_000,
    unit: 'ms',
    targetPercent: 95,
    period: 'daily',
    violationProcedure: 'Check Stellar network congestion. Adjust fee bump strategy.'
  },
  {
    id: 'latency-lcp',
    name: 'Largest Contentful Paint',
    description: 'LCP web vital must be ≤ 2.5 s on mobile (Good rating)',
    category: 'web_vitals',
    metric: 'lcp_ms',
    maxValue: 2500,
    unit: 'ms',
    targetPercent: 75,
    period: 'weekly',
    violationProcedure: 'Audit critical render path. Optimise images and fonts.'
  },
  {
    id: 'latency-inp',
    name: 'Interaction to Next Paint',
    description: 'INP must be ≤ 200 ms (Good rating)',
    category: 'web_vitals',
    metric: 'inp_ms',
    maxValue: 200,
    unit: 'ms',
    targetPercent: 75,
    period: 'weekly',
    violationProcedure: 'Profile JavaScript execution. Reduce long tasks.'
  },

  // Error rate
  {
    id: 'error-rate-api',
    name: 'API Error Rate',
    description: 'HTTP 5xx errors as percentage of total requests',
    category: 'error_rate',
    metric: 'api_error_rate_percent',
    maxValue: 0.1,
    unit: '%',
    targetPercent: 99.9,
    period: 'daily',
    violationProcedure: 'Check error logs. Roll back last deployment if error rate spiked.'
  },
  {
    id: 'error-rate-contract',
    name: 'Contract Transaction Error Rate',
    description: 'Failed smart contract invocations as percentage of total',
    category: 'error_rate',
    metric: 'contract_error_rate_percent',
    maxValue: 1.0,
    unit: '%',
    targetPercent: 99,
    period: 'daily',
    violationProcedure: 'Review contract error types. Check for validation changes.'
  },

  // Throughput
  {
    id: 'throughput-waste-submissions',
    name: 'Waste Submission Throughput',
    description: 'Minimum waste submissions processable per minute',
    category: 'throughput',
    metric: 'waste_submissions_per_min',
    minValue: 10,
    unit: 'req/min',
    targetPercent: 99,
    period: 'daily',
    violationProcedure: 'Scale backend horizontally. Check database connection pool.'
  }
]

// ─── Sample/mock measurement data ─────────────────────────────────────────────

export function generateSampleMeasurements(target: SLATarget, count = 30): SLAMeasurement[] {
  const measurements: SLAMeasurement[] = []
  const now = Date.now()
  const intervalMs = {
    hourly: 3_600_000,
    daily: 86_400_000,
    weekly: 604_800_000,
    monthly: 2_592_000_000
  }[target.period]

  for (let i = count - 1; i >= 0; i--) {
    const timestamp = now - i * (intervalMs / count)
    let value: number

    if (target.minValue !== undefined) {
      // availability / throughput — mostly above target with occasional dips
      const base = target.minValue
      value =
        base + (Math.random() > 0.05 ? Math.random() * (100 - base) * 0.01 : -(Math.random() * 0.5))
    } else if (target.maxValue !== undefined) {
      // latency / error — mostly below target with occasional spikes
      const base = target.maxValue * 0.4
      value =
        base +
        (Math.random() > 0.05 ? Math.random() * base : target.maxValue * (1.1 + Math.random()))
    } else {
      value = 0
    }

    const compliant =
      target.minValue !== undefined
        ? value >= target.minValue
        : value <= (target.maxValue ?? Infinity)

    measurements.push({ targetId: target.id, value: Math.max(0, value), timestamp, compliant })
  }

  return measurements
}

// ─── SLA report computation ───────────────────────────────────────────────────

export function computeSLAReport(target: SLATarget, measurements: SLAMeasurement[]): SLAReport {
  if (measurements.length === 0) {
    return {
      targetId: target.id,
      period: target.period,
      measurements: [],
      compliancePercent: 100,
      status: 'compliant',
      avgValue: 0,
      p95Value: 0,
      violations: 0
    }
  }

  const violations = measurements.filter((m) => !m.compliant).length
  const compliancePercent = ((measurements.length - violations) / measurements.length) * 100
  const values = measurements.map((m) => m.value).sort((a, b) => a - b)
  const avgValue = values.reduce((s, v) => s + v, 0) / values.length
  const p95Value = values[Math.floor(values.length * 0.95)] ?? 0

  let status: SLAStatus = 'compliant'
  if (compliancePercent < target.targetPercent) {
    status = 'violated'
  } else if (compliancePercent < target.targetPercent + 0.5) {
    status = 'at_risk'
  }

  return {
    targetId: target.id,
    period: target.period,
    measurements,
    compliancePercent,
    status,
    avgValue,
    p95Value,
    violations
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function getSLAStatusColor(status: SLAStatus): string {
  return { compliant: 'text-green-600', at_risk: 'text-yellow-600', violated: 'text-red-600' }[
    status
  ]
}

export function getSLAStatusBadgeClass(status: SLAStatus): string {
  return {
    compliant: 'bg-green-100 text-green-700 border-green-200',
    at_risk: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    violated: 'bg-red-100 text-red-700 border-red-200'
  }[status]
}

export function getCategoryLabel(category: SLACategory): string {
  return {
    availability: 'Availability',
    latency: 'Latency',
    throughput: 'Throughput',
    error_rate: 'Error Rate',
    web_vitals: 'Web Vitals'
  }[category]
}
