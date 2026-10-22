import { ArrowRight, History, Package } from 'lucide-react'
import { useState } from 'react'

import { Badge } from '@/components/ui/Badge'
import { Card, CardContent } from '@/components/ui/Card'
import { useWallet } from '@/context/WalletContext'
import { formatAddress,formatDate } from '@/lib/helpers'

import { STATUS_CONFIG } from '../constants'
import { getTransferHistory } from '../transferHistory'
import { StatusTimeline } from './StatusTimeline'

export function TransferHistoryTab() {
  const { address } = useWallet()
  const [localHistory] = useState(getTransferHistory())

  if (localHistory.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-muted-foreground">
        <History className="h-10 w-10 opacity-30" />
        <p className="text-sm">No transfers recorded this session.</p>
        <p className="text-xs">Completed transfers will appear here.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {localHistory.map((record, i) => (
        <Card key={i}>
          <CardContent className="p-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Waste #{record.wasteId}</span>
                </div>
                <Badge
                  variant="secondary"
                  className={`${STATUS_CONFIG[record.status].bgColor} ${STATUS_CONFIG[record.status].color}`}
                >
                  {STATUS_CONFIG[record.status].label}
                </Badge>
              </div>

              <div className="flex items-center gap-3 text-xs">
                <div className="flex-1">
                  <span className="text-muted-foreground">From</span>
                  <p className="font-mono">
                    {record.from === address ? 'You' : formatAddress(record.from)}
                  </p>
                </div>
                <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                <div className="flex-1">
                  <span className="text-muted-foreground">To</span>
                  <p className="font-mono">
                    {record.to === address ? 'You' : formatAddress(record.to)}
                  </p>
                </div>
              </div>

              {record.notes && (
                <p className="text-xs text-muted-foreground">{record.notes}</p>
              )}

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{formatDate(record.transferredAt)}</span>
              </div>

              <StatusTimeline status={record.status} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
