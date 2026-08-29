import { useState, useMemo } from 'react'
import { Download, Filter, MapPin, Clock, User } from 'lucide-react'
import { useParticipantWastes } from '@/hooks/useParticipantWastes'
import { useTransferHistory } from '@/hooks/useTransferHistory'
import { useWallet } from '@/context/WalletContext'
import { formatDate, wasteTypeLabel } from '@/lib/helpers'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Badge } from '@/components/ui/Badge'
import { useAppTitle } from '@/hooks/useAppTitle'

export function WasteHistoryPage() {
  useAppTitle('Waste History')
  const { address } = useWallet()
  const { wastes, isLoading } = useParticipantWastes(address)
  const [selectedWasteId, setSelectedWasteId] = useState<number | undefined>()
  const [filterType, setFilterType] = useState<string>('all')
  const [dateRange, setDateRange] = useState({ start: '', end: '' })

  const { history: transferHistory } = useTransferHistory(selectedWasteId)

  const filteredWastes = useMemo(() => {
    if (!wastes) return []
    let filtered = wastes

    if (filterType !== 'all') {
      filtered = filtered.filter((w) => w.waste_type === filterType)
    }

    if (dateRange.start) {
      const startTime = new Date(dateRange.start).getTime() / 1000
      filtered = filtered.filter((w) => w.timestamp >= startTime)
    }

    if (dateRange.end) {
      const endTime = new Date(dateRange.end).getTime() / 1000
      filtered = filtered.filter((w) => w.timestamp <= endTime)
    }

    return filtered.sort((a, b) => b.timestamp - a.timestamp)
  }, [wastes, filterType, dateRange])

  const exportHistory = () => {
    const data = filteredWastes.map((w) => ({
      wasteId: w.id,
      type: wasteTypeLabel(w.waste_type),
      weight: w.weight.toString(),
      date: formatDate(w.timestamp),
      location: `${w.location.lat}, ${w.location.lon}`,
    }))

    const csv = [
      ['Waste ID', 'Type', 'Weight (kg)', 'Date', 'Location'],
      ...data.map((d) => [d.wasteId, d.type, d.weight, d.date, d.location]),
    ]
      .map((row) => row.join(','))
      .join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `waste-history-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Waste History</h1>
        <Button onClick={exportHistory} variant="outline" size="sm">
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>
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
              <label className="text-sm font-medium">Waste Type</label>
              <Select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                <option value="all">All Types</option>
                <option value="Plastic">Plastic</option>
                <option value="Paper">Paper</option>
                <option value="Metal">Metal</option>
                <option value="Glass">Glass</option>
                <option value="Organic">Organic</option>
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

      {/* Timeline */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="text-center py-8 text-gray-500">Loading waste history...</div>
        ) : filteredWastes.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No waste records found</div>
        ) : (
          filteredWastes.map((waste) => (
            <Card
              key={waste.id}
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => setSelectedWasteId(waste.id)}
            >
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge>{wasteTypeLabel(waste.waste_type)}</Badge>
                      <span className="text-sm text-gray-500">ID: {waste.id}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-gray-400" />
                        <span>{formatDate(waste.timestamp)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-gray-400" />
                        <span>
                          {waste.location.lat.toFixed(2)}, {waste.location.lon.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-semibold">{waste.weight.toString()} kg</div>
                  </div>
                </div>

                {/* Transfer History for selected waste */}
                {selectedWasteId === waste.id && transferHistory.length > 0 && (
                  <div className="mt-4 pt-4 border-t">
                    <h4 className="font-semibold mb-3">Transfer History</h4>
                    <div className="space-y-2">
                      {transferHistory.map((transfer, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-sm">
                          <User className="h-4 w-4 text-gray-400" />
                          <span className="text-gray-600">
                            {transfer.from.slice(0, 6)}...{transfer.from.slice(-4)} →{' '}
                            {transfer.to.slice(0, 6)}...{transfer.to.slice(-4)}
                          </span>
                          <span className="text-gray-400">{formatDate(transfer.timestamp)}</span>
                          {transfer.note && <span className="text-gray-500 italic">({transfer.note})</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
