import { useMemo } from 'react'
import { Download, TrendingUp, BarChart3, PieChart as PieChartIcon } from 'lucide-react'
import { useParticipantWastes } from '@/hooks/useParticipantWastes'
import { useSupplyChainStats } from '@/hooks/useSupplyChainStats'
import { useWallet } from '@/context/WalletContext'
import { wasteTypeLabel } from '@/lib/helpers'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { StatCard } from '@/components/ui/StatCard'
import { Button } from '@/components/ui/Button'
import { useAppTitle } from '@/hooks/useAppTitle'

export function WasteStatisticsPage() {
  useAppTitle('Waste Statistics')
  const { address } = useWallet()
  const { wastes, isLoading: wastesLoading } = useParticipantWastes(address)
  const { stats: supplyChainStats, isLoading: _statsLoading } = useSupplyChainStats()

  const wasteStats = useMemo(() => {
    if (!wastes) return []

    const grouped = wastes.reduce(
      (acc, waste) => {
        const type = waste.waste_type
        if (!acc[type]) {
          acc[type] = { count: 0, weight: 0n }
        }
        acc[type].count += 1
        acc[type].weight += waste.weight
        return acc
      },
      {} as Record<string, { count: number; weight: bigint }>
    )

    const total = Object.values(grouped).reduce((sum, g) => sum + g.weight, 0n)

    return Object.entries(grouped).map(([type, data]) => ({
      type,
      count: data.count,
      weight: data.weight,
      percentage: total > 0n ? Number((data.weight * 100n) / total) : 0,
    }))
  }, [wastes])

  const totalWaste = useMemo(() => {
    return wasteStats.reduce((sum, stat) => sum + stat.weight, 0n)
  }, [wasteStats])

  const totalCount = useMemo(() => {
    return wasteStats.reduce((sum, stat) => sum + stat.count, 0)
  }, [wasteStats])

  const exportStats = () => {
    const data = [
      ['Waste Type', 'Count', 'Weight (kg)', 'Percentage'],
      ...wasteStats.map((s) => [wasteTypeLabel(s.type), s.count, s.weight.toString(), `${s.percentage.toFixed(2)}%`]),
    ]
      .map((row) => row.join(','))
      .join('\n')

    const blob = new Blob([data], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `waste-statistics-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Waste Statistics</h1>
        <Button onClick={exportStats} variant="outline" size="sm">
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard
          title="Total Waste"
          value={`${totalWaste.toString()} kg`}
          icon={<BarChart3 className="h-6 w-6" />}
          trend={wasteStats.length > 0 ? '+12%' : '0%'}
        />
        <StatCard
          title="Waste Items"
          value={totalCount.toString()}
          icon={<TrendingUp className="h-6 w-6" />}
          trend={wasteStats.length > 0 ? '+8%' : '0%'}
        />
        <StatCard
          title="Waste Types"
          value={wasteStats.length.toString()}
          icon={<PieChartIcon className="h-6 w-6" />}
        />
      </div>

      {/* Waste Type Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Waste Type Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          {wastesLoading ? (
            <div className="text-center py-8 text-gray-500">Loading statistics...</div>
          ) : wasteStats.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No waste data available</div>
          ) : (
            <div className="space-y-4">
              {wasteStats
                .sort((a, b) => Number(b.weight - a.weight))
                .map((stat) => (
                  <div key={stat.type}>
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h4 className="font-semibold">{wasteTypeLabel(stat.type)}</h4>
                        <p className="text-sm text-gray-500">
                          {stat.count} items • {stat.weight.toString()} kg
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">{stat.percentage.toFixed(1)}%</div>
                      </div>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full transition-all"
                        style={{ width: `${stat.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Global Statistics */}
      {supplyChainStats && (
        <Card>
          <CardHeader>
            <CardTitle>Global Supply Chain Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">Total Waste Processed</p>
                <p className="text-2xl font-bold">{supplyChainStats.total_waste.toString()} kg</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">Total Tokens Distributed</p>
                <p className="text-2xl font-bold">{supplyChainStats.total_tokens.toString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
