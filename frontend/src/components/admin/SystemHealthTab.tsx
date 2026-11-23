import { Activity, Cpu, Database, Wifi } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'

const HEALTH_METRICS = [
  { label: 'RPC Node', icon: <Wifi className="h-4 w-4" />, status: 'healthy', latency: '42ms' },
  { label: 'Contract', icon: <Cpu className="h-4 w-4" />, status: 'healthy', latency: '—' },
  {
    label: 'Firebase DB',
    icon: <Database className="h-4 w-4" />,
    status: 'healthy',
    latency: '18ms'
  },
  { label: 'Indexer', icon: <Activity className="h-4 w-4" />, status: 'degraded', latency: '320ms' }
]

export function SystemHealthTab() {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {HEALTH_METRICS.map(({ label, icon, status, latency }) => (
          <Card key={label}>
            <CardContent className="flex items-center justify-between pt-4 pb-4">
              <div className="flex items-center gap-3">
                <span className="text-muted-foreground">{icon}</span>
                <div>
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground">Latency: {latency}</p>
                </div>
              </div>
              <span
                className={`flex h-2.5 w-2.5 rounded-full ${
                  status === 'healthy' ? 'bg-green-500' : 'bg-yellow-500'
                }`}
              />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Uptime (last 7 days)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-0.5">
            {Array.from({ length: 28 }).map((_, i) => (
              <div
                key={i}
                className={`h-6 flex-1 rounded-sm ${i === 19 ? 'bg-yellow-400' : 'bg-green-500'}`}
                title={i === 19 ? 'Degraded' : 'Healthy'}
              />
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">99.6% uptime</p>
        </CardContent>
      </Card>
    </div>
  )
}
