import { ArrowRight } from 'lucide-react'

import { useWasteTransferHistory } from '@/hooks/useMaterialTransfer'
import { formatAddress,formatDate } from '@/lib/helpers'

export function WasteChainHistory({ wasteId }: { wasteId: bigint }) {
  const { data: history = [], isLoading } = useWasteTransferHistory(wasteId)

  if (isLoading) {
    return <div className="h-16 animate-pulse rounded-lg bg-muted" />
  }

  if (history.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">No on-chain transfer history for this waste.</p>
    )
  }

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium">On-chain Transfer History</h4>
      <div className="relative space-y-0 pl-4">
        {/* Timeline line */}
        <div className="absolute bottom-2 left-[7px] top-2 w-0.5 bg-border" />
        {history.map((transfer, idx) => (
          <div key={idx} className="relative flex items-start gap-3 pb-4">
            <div className="absolute left-[-12px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-primary" />
            <div className="flex-1 text-xs">
              <div className="flex items-center gap-1">
                <span className="font-mono">{formatAddress(transfer.from)}</span>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                <span className="font-mono">{formatAddress(transfer.to)}</span>
              </div>
              <p className="text-muted-foreground">{formatDate(transfer.transferred_at)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
