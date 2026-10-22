import { BarChart3,CheckCircle2, Clock, XCircle } from 'lucide-react'
import { useMemo } from 'react'

import type { Material } from '@/api/types'
import { StatCard } from '@/components/ui/StatCard'

import { getSessionHistory } from '../sessionHistory'

export function DashboardStats({
  materials,
  isLoading,
}: {
  materials: Material[]
  isLoading: boolean
}) {
  const stats = useMemo(() => {
    const now = Math.floor(Date.now() / 1000)
    const todayStart = now - (now % 86400)
    const pending = materials.filter((m) => !m.verified)
    const verifiedToday = materials.filter(
      (m) => m.verified && m.submitted_at >= todayStart
    )
    const history = getSessionHistory()
    const rejected = history.filter((r) => r.decision === 'rejected')
    const rejectionRate =
      history.length > 0 ? Math.round((rejected.length / history.length) * 100) : 0

    // Average processing time: difference between submitted_at and verifiedAt for session records
    const processedTimes = history
      .filter((r) => r.decision === 'approved')
      .map((r) => {
        const mat = materials.find((m) => m.id === r.materialId)
        return mat ? r.verifiedAt - mat.submitted_at : 0
      })
      .filter((t) => t > 0)
    const avgTime =
      processedTimes.length > 0
        ? Math.round(processedTimes.reduce((a, b) => a + b, 0) / processedTimes.length)
        : 0

    return { pending: pending.length, verifiedToday: verifiedToday.length, rejectionRate, avgTime }
  }, [materials])

  function formatDuration(seconds: number): string {
    if (seconds === 0) return '--'
    if (seconds < 60) return `${seconds}s`
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`
    return `${(seconds / 3600).toFixed(1)}h`
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        icon={<Clock className="h-4 w-4" />}
        label="Pending"
        value={stats.pending}
        isLoading={isLoading}
        variant="warning"
      />
      <StatCard
        icon={<CheckCircle2 className="h-4 w-4" />}
        label="Verified Today"
        value={stats.verifiedToday}
        isLoading={isLoading}
        variant="success"
      />
      <StatCard
        icon={<XCircle className="h-4 w-4" />}
        label="Rejection Rate"
        value={`${stats.rejectionRate}%`}
        isLoading={isLoading}
        variant="destructive"
      />
      <StatCard
        icon={<BarChart3 className="h-4 w-4" />}
        label="Avg. Processing"
        value={formatDuration(stats.avgTime)}
        isLoading={isLoading}
        variant="primary"
      />
    </div>
  )
}
