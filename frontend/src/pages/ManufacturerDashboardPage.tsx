import { useState, useCallback } from 'react'
import { Plus, PackageCheck, Zap, History, Gift } from 'lucide-react'
import { useManufacturerDashboard } from '@/hooks/useManufacturerDashboard'
import { useDistributeRewards } from '@/hooks/useDistributeRewards'
import { WasteType, Incentive, Material } from '@/api/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { EmptyState } from '@/components/ui/EmptyState'
import { TransactionConfirmDialog } from '@/components/ui/TransactionConfirmDialog'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/Dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/Select'

const WASTE_TYPE_LABELS: Record<WasteType, string> = {
  [WasteType.Paper]: 'Paper',
  [WasteType.PetPlastic]: 'PET Plastic',
  [WasteType.Plastic]: 'Plastic',
  [WasteType.Metal]: 'Metal',
  [WasteType.Glass]: 'Glass',
  [WasteType.Organic]: 'Organic',
  [WasteType.Electronic]: 'Electronic',
}

// ── Distribute Rewards Dialog ─────────────────────────────────────────────────

function DistributeRewardsDialog({
  waste,
  incentives,
  onClose
}: {
  waste: Material
  incentives: Incentive[]
  onClose: () => void
}) {
  const matchingIncentives = incentives.filter((i) => i.waste_type === waste.waste_type)
  const [selectedIncentiveId, setSelectedIncentiveId] = useState(
    matchingIncentives[0]?.id ? String(matchingIncentives[0].id) : ''
  )
  const [showConfirm, setShowConfirm] = useState(false)
  const distribute = useDistributeRewards()

  const selectedIncentive = matchingIncentives.find((i) => String(i.id) === selectedIncentiveId)
  const estimatedTotal = selectedIncentive
    ? BigInt(selectedIncentive.reward_points) * BigInt(waste.weight)
    : 0n

  const handleDistribute = async () => {
    if (!selectedIncentiveId) return
    await distribute.mutateAsync({
      wasteId: BigInt(waste.id),
      incentiveId: BigInt(selectedIncentiveId)
    })
    setShowConfirm(false)
    onClose()
  }

  return (
    <>
      <TransactionConfirmDialog
        open={showConfirm}
        action="Distribute Rewards"
        params={[
          { label: 'Waste ID', value: `#${waste.id}` },
          { label: 'Type', value: WASTE_TYPE_LABELS[waste.waste_type] },
          { label: 'Incentive', value: `#${selectedIncentiveId}` },
          { label: 'Est. total', value: `~${estimatedTotal.toLocaleString()} tokens` },
        ]}
        isPending={distribute.isPending}
        onConfirm={handleDistribute}
        onCancel={() => !distribute.isPending && setShowConfirm(false)}
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Distribute Rewards — Waste #{waste.id}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
            <dt className="text-muted-foreground">Type</dt>
            <dd>{WASTE_TYPE_LABELS[waste.waste_type]}</dd>
            <dt className="text-muted-foreground">Weight</dt>
            <dd>{waste.weight} kg</dd>
          </dl>

          {matchingIncentives.length === 0 ? (
            <p className="text-sm text-destructive">No active incentives for this waste type.</p>
          ) : (
            <>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Select Incentive</label>
                <Select value={selectedIncentiveId} onValueChange={setSelectedIncentiveId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose incentive" />
                  </SelectTrigger>
                  <SelectContent>
                    {matchingIncentives.map((inc) => (
                      <SelectItem key={inc.id} value={String(inc.id)}>
                        #{inc.id} — {inc.reward_points} pts/unit (budget:{' '}
                        {inc.remaining_budget.toLocaleString()})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedIncentive && (
                <div className="rounded-md border bg-muted/40 p-3 text-sm space-y-1">
                  <p className="font-medium">Estimated Reward Breakdown</p>
                  <p className="text-muted-foreground">
                    {selectedIncentive.reward_points} pts × {waste.weight} kg ={' '}
                    <span className="font-semibold text-foreground">
                      ~{estimatedTotal.toLocaleString()} tokens
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Actual split is determined by on-chain percentages (collector + owner shares).
                  </p>
                </div>
              )}
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => setShowConfirm(true)}
            disabled={distribute.isPending || !selectedIncentiveId || matchingIncentives.length === 0}
          >
            Distribute
          </Button>
        </DialogFooter>
      </DialogContent>
    </>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function ManufacturerDashboardPage() {
  const {
    pendingWastes,
    incentives,
    rewardHistory,
    isLoading,
    error,
    createIncentive,
    confirmWaste
  } = useManufacturerDashboard()

  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [distributeTarget, setDistributeTarget] = useState<Material | null>(null)
  const [confirmTarget, setConfirmTarget] = useState<Material | null>(null)
  const [form, setForm] = useState({
    wasteType: String(WasteType.Paper),
    rewardPoints: '',
    budget: ''
  })
  const [submitting, setSubmitting] = useState(false)
  const [showCreateConfirm, setShowCreateConfirm] = useState(false)

  const handleCreate = useCallback(async () => {
    setSubmitting(true)
    try {
      await createIncentive(
        Number(form.wasteType) as WasteType,
        BigInt(form.rewardPoints),
        BigInt(form.budget)
      )
      setShowCreateConfirm(false)
      setCreateDialogOpen(false)
      setForm({ wasteType: String(WasteType.Paper), rewardPoints: '', budget: '' })
    } finally {
      setSubmitting(false)
    }
  }, [createIncentive, form])

  return (
    <div className="space-y-6 overflow-x-hidden px-4 py-6 sm:px-0 sm:py-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-bold sm:text-2xl">Manufacturer Dashboard</h1>
        <Button onClick={() => setCreateDialogOpen(true)} className="w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          Create Incentive
        </Button>
      </div>

      {error && (
        <p
          role="alert"
          aria-live="assertive"
          className="rounded-md border border-destructive bg-destructive/10 px-4 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      )}

      {isLoading ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <div className="h-4 w-28 animate-pulse rounded bg-muted" />
                </CardHeader>
                <CardContent>
                  <div className="h-8 w-20 animate-pulse rounded bg-muted" />
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <Card key={i}>
                <CardHeader className="pb-3">
                  <div className="h-5 w-48 animate-pulse rounded bg-muted" />
                </CardHeader>
                <CardContent className="space-y-3">
                  {Array.from({ length: 3 }).map((_, j) => (
                    <div key={j} className="h-16 w-full animate-pulse rounded-md bg-muted" />
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Pending Waste Confirmations */}
          <Card>
            <CardHeader className="flex flex-row items-center gap-2 pb-3">
              <PackageCheck className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Received Waste — Pending Confirmation</CardTitle>
            </CardHeader>
            <CardContent>
              {pendingWastes.length === 0 ? (
                <EmptyState
                  icon={PackageCheck}
                  title="No pending waste"
                  description="Waste waiting for confirmation will appear here"
                />
              ) : (
                <ul className="space-y-3">
                  {pendingWastes.map((w) => (
                    <li
                      key={w.id}
                      className="flex items-center justify-between rounded-md border p-3"
                    >
                      <div className="space-y-0.5">
                        <p className="text-sm font-medium">
                          {WASTE_TYPE_LABELS[w.waste_type]} — {w.weight.toString()} kg
                        </p>
                        <p className="text-xs text-muted-foreground">ID #{w.id}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => setConfirmTarget(w)}>
                          Confirm
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          title="Distribute rewards"
                          onClick={() => setDistributeTarget(w)}
                        >
                          <Gift className="h-4 w-4" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Active Incentives */}
          <Card>
            <CardHeader className="flex flex-row items-center gap-2 pb-3">
              <Zap className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Active Incentives</CardTitle>
            </CardHeader>
            <CardContent>
              {incentives.length === 0 ? (
                <EmptyState
                  icon={Zap}
                  title="No active incentives"
                  description="Incentives will appear here once created"
                  action={{ label: 'Create Incentive', onClick: () => setCreateDialogOpen(true) }}
                />
              ) : (
                <ul className="space-y-3">
                  {incentives.map((inc) => (
                    <li
                      key={inc.id}
                      className="flex items-center justify-between rounded-md border p-3"
                    >
                      <div className="space-y-0.5">
                        <p className="text-sm font-medium">{WASTE_TYPE_LABELS[inc.waste_type]}</p>
                        <p className="text-xs text-muted-foreground">
                          {inc.reward_points} pts/unit
                        </p>
                      </div>
                      <Badge variant="secondary">
                        {inc.remaining_budget.toLocaleString()} left
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Reward Distribution History */}
          <Card className="md:col-span-2">
            <CardHeader className="flex flex-row items-center gap-2 pb-3">
              <History className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Reward Distribution History</CardTitle>
            </CardHeader>
            <CardContent>
              {rewardHistory.length === 0 ? (
                <EmptyState
                  icon={History}
                  title="No rewards distributed"
                  description="Rewards will appear here as they are distributed"
                />
              ) : (
                <ul className="space-y-3">
                  {rewardHistory.map((r, i) => (
                    <li key={i} className="flex items-center justify-between rounded-md border p-3">
                      <div className="space-y-0.5">
                        {r.wasteId > 0 && (
                          <p className="text-sm font-medium">
                            Waste #{r.wasteId} · Incentive #{r.incentiveId}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {new Date(r.distributedAt).toLocaleDateString()}
                        </p>
                      </div>
                      <Badge>{r.amount.toLocaleString()} tokens</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Create Incentive Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Incentive</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label htmlFor="manufacturer-waste-type" className="text-sm font-medium">
                Waste Type
              </label>
              <Select
                value={form.wasteType}
                onValueChange={(v) => setForm((f) => ({ ...f, wasteType: v }))}
              >
                <SelectTrigger id="manufacturer-waste-type" autoFocus>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(WASTE_TYPE_LABELS).map(([val, label]) => (
                    <SelectItem key={val} value={val}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="manufacturer-reward-points" className="text-sm font-medium">
                Reward Points (per unit)
              </label>
              <Input
                id="manufacturer-reward-points"
                type="number"
                min="1"
                placeholder="e.g. 100"
                value={form.rewardPoints}
                onChange={(e) => setForm((f) => ({ ...f, rewardPoints: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="manufacturer-budget" className="text-sm font-medium">
                Total Budget (tokens)
              </label>
              <Input
                id="manufacturer-budget"
                type="number"
                min="1"
                placeholder="e.g. 10000"
                value={form.budget}
                onChange={(e) => setForm((f) => ({ ...f, budget: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => setShowCreateConfirm(true)}
              disabled={submitting || !form.rewardPoints || !form.budget}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Distribute Rewards Dialog */}
      <Dialog open={!!distributeTarget} onOpenChange={(o) => !o && setDistributeTarget(null)}>
        {distributeTarget && (
          <DistributeRewardsDialog
            waste={distributeTarget}
            incentives={incentives}
            onClose={() => setDistributeTarget(null)}
          />
        )}
      </Dialog>

      {/* Confirm Waste — transaction confirm */}
      <TransactionConfirmDialog
        open={!!confirmTarget}
        action="Confirm Waste"
        params={confirmTarget ? [
          { label: 'Waste ID', value: `#${confirmTarget.id}` },
          { label: 'Type', value: WASTE_TYPE_LABELS[confirmTarget.waste_type] },
          { label: 'Weight', value: `${confirmTarget.weight} kg` },
        ] : []}
        isPending={false}
        onConfirm={() => {
          if (confirmTarget) {
            confirmWaste(confirmTarget.id)
            setConfirmTarget(null)
          }
        }}
        onCancel={() => setConfirmTarget(null)}
      />

      {/* Create Incentive — transaction confirm */}
      <TransactionConfirmDialog
        open={showCreateConfirm}
        action="Create Incentive"
        params={[
          { label: 'Waste type', value: WASTE_TYPE_LABELS[Number(form.wasteType) as WasteType] },
          { label: 'Reward per unit', value: `${form.rewardPoints} pts` },
          { label: 'Total budget', value: `${form.budget} tokens` },
        ]}
        isPending={submitting}
        onConfirm={handleCreate}
        onCancel={() => !submitting && setShowCreateConfirm(false)}
      />
    </div>
  )
}
