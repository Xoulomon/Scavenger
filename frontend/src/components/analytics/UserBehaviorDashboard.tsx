import { useMemo } from 'react'
import { BarChart2, MousePointer, TrendingUp, Users } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { analytics } from '@/lib/analyticsService'

// ── Helpers ───────────────────────────────────────────────────────────────────

function StatBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border p-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-2xl font-bold">{value}</span>
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export function UserBehaviorDashboard() {
  const data = useMemo(() => {
    const events = analytics.getEvents()
    const session = analytics.getSession()

    const byCategory = events.reduce<Record<string, number>>((acc, e) => {
      acc[e.category] = (acc[e.category] ?? 0) + 1
      return acc
    }, {})

    const topActions = Object.entries(
      events.reduce<Record<string, number>>((acc, e) => {
        acc[e.action] = (acc[e.action] ?? 0) + 1
        return acc
      }, {})
    )
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)

    const daily = analytics.getDailycounts('page_view', 7)
    const funnel = analytics.getFunnelAnalysis(['page_view', 'waste_submit', 'rewards_claim'])

    return { events, session, byCategory, topActions, daily, funnel }
  }, [])

  const maxDaily = Math.max(...data.daily.map((d) => d.count), 1)

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatBox label="Total Events" value={data.events.length} />
        <StatBox label="Page Views" value={data.session.pageViews} />
        <StatBox label="Session Events" value={data.session.events} />
        <StatBox label="Unique Categories" value={Object.keys(data.byCategory).length} />
      </div>

      {/* Daily page views */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4" />
            Page Views — Last 7 Days
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.daily.map(({ date, count }) => (
            <div key={date} className="space-y-0.5">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">{date}</span>
                <span className="font-medium">{count}</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${(count / maxDaily) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Events by category */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart2 className="h-4 w-4" />
              Events by Category
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {Object.entries(data.byCategory).length === 0 ? (
              <p className="text-sm text-muted-foreground">No events recorded yet.</p>
            ) : (
              Object.entries(data.byCategory)
                .sort((a, b) => b[1] - a[1])
                .map(([cat, count]) => (
                  <div key={cat} className="flex items-center justify-between text-sm">
                    <span className="capitalize">{cat}</span>
                    <span className="font-medium">{count}</span>
                  </div>
                ))
            )}
          </CardContent>
        </Card>

        {/* Top actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MousePointer className="h-4 w-4" />
              Top Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.topActions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No actions recorded yet.</p>
            ) : (
              data.topActions.map(([action, count]) => (
                <div key={action} className="flex items-center justify-between text-sm">
                  <span className="font-mono text-xs">{action}</span>
                  <span className="font-medium">{count}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Funnel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" />
            Conversion Funnel
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.funnel.map((step) => (
            <div key={step.name} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-mono text-xs">{step.name}</span>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{step.count} sessions</span>
                  <span className="font-medium text-primary">{step.conversionRate}%</span>
                </div>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${step.conversionRate}%` }}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
