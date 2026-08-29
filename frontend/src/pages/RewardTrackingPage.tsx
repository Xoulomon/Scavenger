import { useState, useMemo } from 'react'
import { TrendingUp, Award, Calendar, Download, Filter, Zap, Target } from 'lucide-react'
import { useRewards } from '@/hooks/useRewards'
import { useWallet } from '@/context/WalletContext'
import { formatDate, wasteTypeLabel } from '@/lib/helpers'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { StatCard } from '@/components/ui/StatCard'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { useAppTitle } from '@/hooks/useAppTitle'

export function RewardTrackingPage() {
  useAppTitle('Reward Tracking')
  const { address: _address } = useWallet()
  const { stats, wastes, isLoading } = useRewards()
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [dateRange, setDateRange] = useState({ start: '', end: '' })

  const rewardEntries = useMemo(() => {
    if (!wastes) return []

    return wastes.map((waste) => ({
      wasteId: waste.id,
      wasteType: waste.waste_type,
      weight: waste.weight,
      rewardPoints: waste.weight * 10n, // Example: 10 points per kg
      timestamp: waste.timestamp,
      status: waste.confirmed ? 'verified' : 'pending',
    }))
  }, [wastes])

  const filteredEntries = useMemo(() => {
    let filtered = rewardEntries

    if (filterStatus !== 'all') {
      filtered = filtered.filter((e) => e.status === filterStatus)
    }

    if (dateRange.start) {
      const startTime = new Date(dateRange.start).getTime() / 1000
      filtered = filtered.filter((e) => e.timestamp >= startTime)
    }

    if (dateRange.end) {
      const endTime = new Date(dateRange.end).getTime() / 1000
      filtered = filtered.filter((e) => e.timestamp <= endTime)
    }

    return filtered.sort((a, b) => b.timestamp - a.timestamp)
  }, [rewardEntries, filterStatus, dateRange])

  const totalRewards = useMemo(() => {
    return filteredEntries.reduce((sum, entry) => sum + entry.rewardPoints, 0n)
  }, [filteredEntries])

  const verifiedRewards = useMemo(() => {
    return filteredEntries
      .filter((e) => e.status === 'verified')
      .reduce((sum, entry) => sum + entry.rewardPoints, 0n)
  }, [filteredEntries])

  const pendingRewards = useMemo(() => {
    return filteredEntries
      .filter((e) => e.status === 'pending')
      .reduce((sum, entry) => sum + entry.rewardPoints, 0n)
  }, [filteredEntries])

  const exportRewards = () => {
    const data = [
      ['Waste ID', 'Type', 'Weight (kg)', 'Reward Points', 'Date', 'Status'],
      ...filteredEntries.map((e) => [
        e.wasteId,
        wasteTypeLabel(e.wasteType),
        e.weight.toString(),
        e.rewardPoints.toString(),
        formatDate(e.timestamp),
        e.status,
      ]),
    ]
      .map((row) => row.join(','))
      .join('\n')

    const blob = new Blob([data], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `reward-tracking-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'verified':
        return 'bg-green-100 text-green-800'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'claimed':
        return 'bg-blue-100 text-blue-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Reward Tracking</h1>
        <Button onClick={exportRewards} variant="outline" size="sm">
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard
          title="Total Rewards"
          value={totalRewards.toString()}
          icon={<Award className="h-6 w-6" />}
          trend={stats ? `+${(stats.total_verified_waste / 10n).toString()}` : '0'}
        />
        <StatCard
          title="Verified Rewards"
          value={verifiedRewards.toString()}
          icon={<Zap className="h-6 w-6" />}
        />
        <StatCard
          title="Pending Rewards"
          value={pendingRewards.toString()}
          icon={<Target className="h-6 w-6" />}
        />
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className="text-sm font-medium">Status</label>
              <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="verified">Verified</option>
                <option value="claimed">Claimed</option>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Start Date</label>
              <Input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium">End Date</label>
              <Input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reward History */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Reward History</h2>
        {isLoading ? (
          <div className="text-center py-8 text-gray-500">Loading reward history...</div>
        ) : filteredEntries.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No rewards found</div>
        ) : (
          <div className="space-y-3">
            {filteredEntries.map((entry) => (
              <Card key={entry.wasteId} className="hover:shadow-md transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Badge className={getStatusColor(entry.status)}>
                          {entry.status.charAt(0).toUpperCase() + entry.status.slice(1)}
                        </Badge>
                        <span className="text-sm font-medium">{wasteTypeLabel(entry.wasteType)}</span>
                        <span className="text-sm text-gray-500">ID: {entry.wasteId}</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {formatDate(entry.timestamp)}
                        </div>
                        <div>{entry.weight.toString()} kg</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-2 justify-end">
                        <TrendingUp className="h-5 w-5 text-green-600" />
                        <span className="text-2xl font-bold text-green-600">{entry.rewardPoints.toString()}</span>
                      </div>
                      <p className="text-sm text-gray-500">points</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Reward Tiers Info */}
      <Card>
        <CardHeader>
          <CardTitle>Reward Calculation</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <p className="text-gray-600">Rewards are calculated based on waste weight and verification status:</p>
            <ul className="space-y-2 ml-4">
              <li>• Base reward: 10 points per kg</li>
              <li>• Verified waste: Full reward points</li>
              <li>• Pending waste: Held until verification</li>
              <li>• Bonus: +5% for waste types with high demand</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
