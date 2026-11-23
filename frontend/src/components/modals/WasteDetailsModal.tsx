import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/Dialog'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { AddressDisplay } from '@/components/ui/AddressDisplay'
import { TransferTimeline } from '@/components/ui/TransferTimeline'
import { Waste, Role } from '@/api/types'
import { wasteTypeLabel, formatDate } from '@/lib/helpers'
import { useTransferHistory } from '@/hooks/useTransferHistory'
import { useParticipant } from '@/hooks/useParticipant'
import { useWallet } from '@/context/WalletContext'
import { cn } from '@/lib/utils'
import { CheckCircle2, Clock, XCircle, ArrowRightLeft, BadgeCheck } from 'lucide-react'

// ── Status helpers ────────────────────────────────────────────────────────────

type WasteStatus = 'confirmed' | 'pending' | 'inactive'

function resolveStatus(waste: Waste): WasteStatus {
  if (!waste.is_active) return 'inactive'
  if (waste.is_confirmed) return 'confirmed'
  return 'pending'
}

const STATUS_CONFIG: Record<
  WasteStatus,
  { label: string; icon: React.ReactNode; className: string }
> = {
  confirmed: {
    label: 'Confirmed',
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    className:
      'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800'
  },
  pending: {
    label: 'Pending',
    icon: <Clock className="h-3.5 w-3.5" />,
    className:
      'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800'
  },
  inactive: {
    label: 'Inactive',
    icon: <XCircle className="h-3.5 w-3.5" />,
    className: 'bg-muted text-muted-foreground border-border'
  }
}

// ── Field row ─────────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{children}</span>
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export interface WasteDetailsModalProps {
  waste: Waste | null
  open: boolean
  onClose: () => void
  onTransfer?: (waste: Waste) => void
  onConfirm?: (waste: Waste) => void
}

export function WasteDetailsModal({
  waste,
  open,
  onClose,
  onTransfer,
  onConfirm
}: WasteDetailsModalProps) {
  const { address } = useWallet()
  const { participant } = useParticipant()
  const { history, isLoading: historyLoading } = useTransferHistory(
    open && waste ? waste.waste_id : undefined
  )

  if (!waste) return null

  const status = resolveStatus(waste)
  const statusCfg = STATUS_CONFIG[status]
  const weightNum = Number(waste.weight)
  const weightStr = weightNum >= 1000 ? `${(weightNum / 1000).toFixed(2)} kg` : `${weightNum} g`

  const isOwner = address === waste.current_owner
  const role = participant?.role
  const canTransfer =
    isOwner && waste.is_active && (role === Role.Collector || role === Role.Recycler)
  const canConfirm = isOwner && waste.is_active && !waste.is_confirmed && role === Role.Collector

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Waste #{waste.waste_id.toString()}
            <Badge
              className={cn(
                'inline-flex items-center gap-1 border text-xs font-medium',
                statusCfg.className
              )}
            >
              {statusCfg.icon}
              {statusCfg.label}
            </Badge>
          </DialogTitle>
          <DialogDescription>Full details and transfer history</DialogDescription>
        </DialogHeader>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto space-y-5 pr-1">
          {/* Fields */}
          <section>
            <div className="divide-y divide-border rounded-md border px-4">
              <Field label="Type">{wasteTypeLabel(waste.waste_type)}</Field>
              <Field label="Weight">{weightStr}</Field>
              <Field label="Registered">{formatDate(waste.recycled_timestamp)}</Field>
              <Field label="Current owner">
                <AddressDisplay address={waste.current_owner} showExplorer />
              </Field>
              {waste.is_confirmed && waste.confirmer && (
                <Field label="Confirmed by">
                  <AddressDisplay address={waste.confirmer} showExplorer />
                </Field>
              )}
              <Field label="Location">
                {Number(waste.latitude) / 1_000_000}°, {Number(waste.longitude) / 1_000_000}°
              </Field>
            </div>
          </section>

          {/* Transfer history */}
          <section>
            <p className="mb-3 text-sm font-semibold">Transfer history</p>
            <TransferTimeline
              history={history}
              currentOwner={waste.current_owner}
              isLoading={historyLoading}
            />
          </section>
        </div>

        {/* Action buttons — only shown when relevant */}
        {(canTransfer || canConfirm) && (
          <div className="flex gap-2 border-t pt-4">
            {canTransfer && (
              <Button variant="outline" className="flex-1" onClick={() => onTransfer?.(waste)}>
                <ArrowRightLeft className="mr-1.5 h-4 w-4" />
                Transfer
              </Button>
            )}
            {canConfirm && (
              <Button className="flex-1" onClick={() => onConfirm?.(waste)}>
                <BadgeCheck className="mr-1.5 h-4 w-4" />
                Confirm
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
