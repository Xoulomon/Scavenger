import { useState } from 'react'
import { CheckCircle, Loader2 } from 'lucide-react'
import { Incentive } from '@/api/types'
import { Role } from '@/api/types'
import { useAuth } from '@/context/AuthContext'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { wasteTypeLabel, formatDate } from '@/lib/helpers'

interface IncentiveDetailModalProps {
  incentive: Incentive | null
  open: boolean
  onClose: () => void
  onClaim: (incentiveId: number) => Promise<void>
  isClaiming?: boolean
}

export function IncentiveDetailModal({
  incentive,
  open,
  onClose,
  onClaim,
  isClaiming = false,
}: IncentiveDetailModalProps) {
  const { user } = useAuth()
  const [confirmStep, setConfirmStep] = useState(false)

  const canClaim =
    user?.role === Role.Recycler || user?.role === Role.Collector

  function handleClose() {
    setConfirmStep(false)
    onClose()
  }

  async function handleConfirmClaim() {
    if (!incentive) return
    await onClaim(incentive.id)
    setConfirmStep(false)
    onClose()
  }

  if (!incentive) return null

  const budgetPercent =
    incentive.total_budget > 0
      ? Math.round((incentive.remaining_budget / incentive.total_budget) * 100)
      : 0

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Incentive #{incentive.id}
            <Badge variant={incentive.active ? 'default' : 'secondary'}>
              {incentive.active ? 'Active' : 'Inactive'}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Full details for this incentive offer
          </DialogDescription>
        </DialogHeader>

        {!confirmStep ? (
          <>
            <div className="space-y-3 text-sm">
              <Row label="Waste Type" value={wasteTypeLabel(incentive.waste_type)} />
              <Row label="Rewarder" value={
                <span className="font-mono text-xs break-all">{incentive.rewarder}</span>
              } />
              <Row label="Reward Points" value={`${Number(incentive.reward_points).toLocaleString()} pts`} />
              <Row label="Total Budget" value={`${Number(incentive.total_budget).toLocaleString()}`} />
              <Row label="Remaining Budget" value={`${Number(incentive.remaining_budget).toLocaleString()}`} />
              <Row label="Created" value={formatDate(incentive.created_at)} />

              {/* Budget bar */}
              <div className="space-y-1 pt-1">
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${budgetPercent}%` }}
                    role="progressbar"
                    aria-valuenow={budgetPercent}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="Budget remaining"
                  />
                </div>
                <p className="text-right text-xs text-muted-foreground">{budgetPercent}% remaining</p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Close
              </Button>
              {canClaim && incentive.active && (
                <Button onClick={() => setConfirmStep(true)}>
                  Claim
                </Button>
              )}
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <CheckCircle className="h-10 w-10 text-primary" />
              <p className="font-medium">Confirm Claim</p>
              <p className="text-sm text-muted-foreground">
                Are you sure you want to claim incentive #{incentive.id} for{' '}
                <strong>{wasteTypeLabel(incentive.waste_type)}</strong>?
                You will earn{' '}
                <strong>{Number(incentive.reward_points).toLocaleString()} pts</strong>.
              </p>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmStep(false)} disabled={isClaiming}>
                Back
              </Button>
              <Button onClick={handleConfirmClaim} disabled={isClaiming}>
                {isClaiming ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Claiming…
                  </>
                ) : (
                  'Confirm Claim'
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  )
}
