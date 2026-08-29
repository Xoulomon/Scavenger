import { Users, Package, Gift } from 'lucide-react'
import { StatCard } from '@/components/ui/StatCard'
import { useAdminMetrics } from '@/hooks/useAdminDashboard'

interface OverviewTabProps {
  registeredUsersCount?: number
}

export function OverviewTab({ registeredUsersCount = 0 }: OverviewTabProps) {
  const { data: metrics, isLoading } = useAdminMetrics()

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          icon={<Package className="h-4 w-4" />}
          label="Total Wastes"
          value={isLoading ? '—' : String(metrics?.total_wastes_count ?? 0)}
          isLoading={isLoading}
        />
        <StatCard
          icon={<Gift className="h-4 w-4" />}
          label="Total Tokens Earned"
          value={isLoading ? '—' : String(metrics?.total_tokens_earned ?? 0n)}
          variant="primary"
          isLoading={isLoading}
        />
        <StatCard
          icon={<Users className="h-4 w-4" />}
          label="Registered Users"
          value={registeredUsersCount}
          variant="success"
          isLoading={false}
        />
      </div>
    </div>
  )
}

