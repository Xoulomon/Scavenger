import { Activity } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { TOP_MATERIALS, type MaterialVolume } from '@/lib/analytics'

interface QuickStatsCardProps {
  stats?: MaterialVolume[]
}

export function QuickStatsCard({ stats = TOP_MATERIALS }: QuickStatsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="h-4 w-4" />
          Quick Stats
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {stats.map(({ label, value, color }) => (
          <div key={label} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span>{label}</span>
              <span className="font-medium">{value}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full ${color} transition-all duration-500`}
                style={{ width: `${value}%` }}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
