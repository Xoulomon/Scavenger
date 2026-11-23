import { BarChart3, TrendingUp, Package, Users, Download } from 'lucide-react'
import { UserBehaviorDashboard } from '@/components/analytics/UserBehaviorDashboard'
import { StatCard } from '@/components/ui/StatCard'
import { Button } from '@/components/ui/Button'
import { useStats } from '@/hooks/useStats'
import { useAppTitle } from '@/hooks/useAppTitle'
import { useAnalyticsExport } from '@/hooks/useAnalyticsExport'
import { DateRangeSelector } from '@/components/analytics/DateRangeSelector'
import { LeaderboardCard } from '@/components/analytics/LeaderboardCard'
import { CarbonImpactCard } from '@/components/analytics/CarbonImpactCard'
import { WasteTypeChart } from '@/components/analytics/WasteTypeChart'
import { MonthlyTrendsChart } from '@/components/analytics/MonthlyTrendsChart'
import { RecyclingRateChart } from '@/components/analytics/RecyclingRateChart'
import { TopMaterialsChart } from '@/components/analytics/TopMaterialsChart'
import { ParticipantContributionChart } from '@/components/analytics/ParticipantContributionChart'
import { QuickStatsCard } from '@/components/analytics/QuickStatsCard'
import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { formatPercentage, formatDuration } from '@/lib/format'
import { StatTrend } from '@/lib/constants'

export function AnalyticsPage() {
  const { t } = useTranslation()
  useAppTitle(t('analytics.title'))
  const { totalWastes, isLoading } = useStats()
  const { exportToCSV, exportToPDF } = useAnalyticsExport()
  const [dateRange, setDateRange] = useState<{ start: Date | null; end: Date | null }>({
    start: null,
    end: null
  })

  // Memoize callback handlers to prevent unnecessary re-renders of child components
  const handleDateRangeChange = useCallback(
    (newRange: { start: Date | null; end: Date | null }) => {
      setDateRange(newRange)
    },
    []
  )

  const handleExportCSV = useCallback(() => {
    exportToCSV()
  }, [exportToCSV])

  const handleExportPDF = useCallback(() => {
    exportToPDF()
  }, [exportToPDF])

  return (
    <div className="space-y-4 xs:space-y-6">
      <div className="flex flex-col gap-3 tablet:flex-row tablet:items-start tablet:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold xs:text-3xl">{t('analytics.dashboard')}</h1>
          <p className="mt-1 text-muted-foreground">{t('analytics.subtitle')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <DateRangeSelector value={dateRange} onChange={handleDateRangeChange} />
          <Button onClick={handleExportCSV} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            CSV
          </Button>
          <Button onClick={handleExportPDF} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            PDF
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 xs:grid-cols-2 tablet:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<Package className="h-4 w-4" />}
          label={t('analytics.kpi.totalWasteProcessed')}
          value={Number(totalWastes)}
          trend={StatTrend.Up}
          trendLabel={t('analytics.kpi.totalWasteTrend')}
          isLoading={isLoading}
          variant="primary"
        />
        <StatCard
          icon={<Users className="h-4 w-4" />}
          label={t('analytics.kpi.activeParticipants')}
          value={0}
          trend={StatTrend.Up}
          trendLabel={t('analytics.kpi.activeParticipantsTrend')}
          isLoading={isLoading}
          variant="success"
        />
        <StatCard
          icon={<TrendingUp className="h-4 w-4" />}
          label={t('analytics.kpi.recyclingRate')}
          value={formatPercentage(87)}
          trend={StatTrend.Up}
          trendLabel={t('analytics.kpi.recyclingRateTrend')}
          isLoading={isLoading}
          variant="default"
        />
        <StatCard
          icon={<BarChart3 className="h-4 w-4" />}
          label={t('analytics.kpi.avgProcessingTime')}
          value={formatDuration(2.4, 'days')}
          trend={StatTrend.Down}
          trendLabel={t('analytics.kpi.avgProcessingTimeTrend')}
          isLoading={isLoading}
          variant="warning"
        />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 gap-4 xs:gap-6 tablet:grid-cols-2">
        <WasteTypeChart />
        <MonthlyTrendsChart />
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 gap-4 xs:gap-6 tablet:grid-cols-3">
        <div className="tablet:col-span-2">
          <RecyclingRateChart />
        </div>
        <QuickStatsCard />
      </div>

      {/* Top materials + participant contributions */}
      <div className="grid grid-cols-1 gap-4 xs:gap-6 tablet:grid-cols-2">
        <TopMaterialsChart />
        <ParticipantContributionChart />
      </div>

      {/* Leaderboard + Carbon */}
      <div className="grid grid-cols-1 gap-4 xs:gap-6 tablet:grid-cols-2">
        <LeaderboardCard />
        <CarbonImpactCard />
      </div>

      {/* User Behavior Analytics */}
      <div>
        <h2 className="mb-4 text-lg font-semibold xs:text-xl">{t('analytics.userBehavior')}</h2>
        <UserBehaviorDashboard />
      </div>
    </div>
  )
}
