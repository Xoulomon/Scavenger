import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
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

const WASTE_TYPE_LABEL_KEYS: Record<WasteType, string> = {
  [WasteType.Paper]: 'wasteTypes.paper',
  [WasteType.PetPlastic]: 'wasteTypes.petPlastic',
  [WasteType.Plastic]: 'wasteTypes.plastic',
  [WasteType.Metal]: 'wasteTypes.metal',
  [WasteType.Glass]: 'wasteTypes.glass',
  [WasteType.Organic]: 'wasteTypes.organic',
  [WasteType.Electronic]: 'wasteTypes.electronic'
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
  const { t } = useTranslation()
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
        action={t('manufacturerDashboard.distributeRewards')}
        params={[
          { label: t('manufacturerDashboard.wasteId'), value: `#${waste.id}` },
          {
            label: t('manufacturerDashboard.type'),
            value: t(WASTE_TYPE_LABEL_KEYS[waste.waste_type])
          },
          { label: t('manufacturerDashboard.incentive'), value: `#${selectedIncentiveId}` },
          {
            label: t('manufacturerDashboard.estTotal'),
            value: t('manufacturerDashboard.tokensEstimate', {
              amount: estimatedTotal.toLocaleString()
            })
          }
        ]}
        isPending={distribute.isPending}
        onConfirm={handleDistribute}
        onCancel={() => !distribute.isPending && setShowConfirm(false)}
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t('manufacturerDashboard.distributeRewardsTitle', { id: waste.id })}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
            <dt className="text-muted-foreground">{t('manufacturerDashboard.type')}</dt>
            <dd>{t(WASTE_TYPE_LABEL_KEYS[waste.waste_type])}</dd>
            <dt className="text-muted-foreground">{t('manufacturerDashboard.weight')}</dt>
            <dd>{t('manufacturerDashboard.weightKg', { weight: waste.weight })}</dd>
          </dl>

          {matchingIncentives.length === 0 ? (
            <p className="text-sm text-destructive">
              {t('manufacturerDashboard.noActiveIncentivesForType')}
            </p>
          ) : (
            <>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  {t('manufacturerDashboard.selectIncentive')}
                </label>
                <Select value={selectedIncentiveId} onValueChange={setSelectedIncentiveId}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('manufacturerDashboard.chooseIncentive')} />
                  </SelectTrigger>
                  <SelectContent>
                    {matchingIncentives.map((inc) => (
                      <SelectItem key={inc.id} value={String(inc.id)}>
                        {t('manufacturerDashboard.incentiveOption', {
                          id: inc.id,
                          points: inc.reward_points,
                          budget: inc.remaining_budget.toLocaleString()
                        })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedIncentive && (
                <div className="rounded-md border bg-muted/40 p-3 text-sm space-y-1">
                  <p className="font-medium">
                    {t('manufacturerDashboard.estimatedRewardBreakdown')}
                  </p>
                  <p className="text-muted-foreground">
                    {t('manufacturerDashboard.rewardCalculation', {
                      points: selectedIncentive.reward_points,
                      weight: waste.weight
                    })}{' '}
                    <span className="font-semibold text-foreground">
                      {t('manufacturerDashboard.tokensEstimate', {
                        amount: estimatedTotal.toLocaleString()
                      })}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t('manufacturerDashboard.actualSplitNote')}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={() => setShowConfirm(true)}
            disabled={
              distribute.isPending || !selectedIncentiveId || matchingIncentives.length === 0
            }
          >
            {t('manufacturerDashboard.distribute')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function ManufacturerDashboardPage() {
  const { t } = useTranslation()
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
        <h1 className="text-xl font-bold sm:text-2xl">{t('manufacturerDashboard.title')}</h1>
        <Button onClick={() => setCreateDialogOpen(true)} className="w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          {t('manufacturerDashboard.createIncentive')}
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
              <CardTitle className="text-base">
                {t('manufacturerDashboard.pendingWasteTitle')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {pendingWastes.length === 0 ? (
                <EmptyState
                  icon={PackageCheck}
                  title={t('manufacturerDashboard.noPendingWaste')}
                  description={t('manufacturerDashboard.noPendingWasteDescription')}
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
                          {t('manufacturerDashboard.wasteSummary', {
                            type: t(WASTE_TYPE_LABEL_KEYS[w.waste_type]),
                            weight: w.weight.toString()
                          })}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t('manufacturerDashboard.idLabel', { id: w.id })}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => setConfirmTarget(w)}>
                          {t('manufacturerDashboard.confirm')}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          title={t('manufacturerDashboard.distributeRewards')}
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
              <CardTitle className="text-base">
                {t('manufacturerDashboard.activeIncentives')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {incentives.length === 0 ? (
                <EmptyState
                  icon={Zap}
                  title={t('manufacturerDashboard.noActiveIncentives')}
                  description={t('manufacturerDashboard.noActiveIncentivesDescription')}
                  action={{
                    label: t('manufacturerDashboard.createIncentive'),
                    onClick: () => setCreateDialogOpen(true)
                  }}
                />
              ) : (
                <ul className="space-y-3">
                  {incentives.map((inc) => (
                    <li
                      key={inc.id}
                      className="flex items-center justify-between rounded-md border p-3"
                    >
                      <div className="space-y-0.5">
                        <p className="text-sm font-medium">
                          {t(WASTE_TYPE_LABEL_KEYS[inc.waste_type])}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t('manufacturerDashboard.pointsPerUnit', { points: inc.reward_points })}
                        </p>
                      </div>
                      <Badge variant="secondary">
                        {t('manufacturerDashboard.budgetLeft', {
                          amount: inc.remaining_budget.toLocaleString()
                        })}
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
              <CardTitle className="text-base">
                {t('manufacturerDashboard.rewardHistoryTitle')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {rewardHistory.length === 0 ? (
                <EmptyState
                  icon={History}
                  title={t('manufacturerDashboard.noRewardsDistributed')}
                  description={t('manufacturerDashboard.noRewardsDistributedDescription')}
                />
              ) : (
                <ul className="space-y-3">
                  {rewardHistory.map((r, i) => (
                    <li key={i} className="flex items-center justify-between rounded-md border p-3">
                      <div className="space-y-0.5">
                        {r.wasteId > 0 && (
                          <p className="text-sm font-medium">
                            {t('manufacturerDashboard.historyEntry', {
                              wasteId: r.wasteId,
                              incentiveId: r.incentiveId
                            })}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {new Date(r.distributedAt).toLocaleDateString()}
                        </p>
                      </div>
                      <Badge>
                        {t('manufacturerDashboard.tokensAmount', {
                          amount: r.amount.toLocaleString()
                        })}
                      </Badge>
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
            <DialogTitle>{t('manufacturerDashboard.createIncentive')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label htmlFor="manufacturer-waste-type" className="text-sm font-medium">
                {t('manufacturerDashboard.wasteType')}
              </label>
              <Select
                value={form.wasteType}
                onValueChange={(v) => setForm((f) => ({ ...f, wasteType: v }))}
              >
                <SelectTrigger id="manufacturer-waste-type" autoFocus>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(WASTE_TYPE_LABEL_KEYS).map(([val, labelKey]) => (
                    <SelectItem key={val} value={val}>
                      {t(labelKey)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="manufacturer-reward-points" className="text-sm font-medium">
                {t('manufacturerDashboard.rewardPointsLabel')}
              </label>
              <Input
                id="manufacturer-reward-points"
                type="number"
                min="1"
                placeholder={t('manufacturerDashboard.rewardPointsPlaceholder')}
                value={form.rewardPoints}
                onChange={(e) => setForm((f) => ({ ...f, rewardPoints: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="manufacturer-budget" className="text-sm font-medium">
                {t('manufacturerDashboard.budgetLabel')}
              </label>
              <Input
                id="manufacturer-budget"
                type="number"
                min="1"
                placeholder={t('manufacturerDashboard.budgetPlaceholder')}
                value={form.budget}
                onChange={(e) => setForm((f) => ({ ...f, budget: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={() => setShowCreateConfirm(true)}
              disabled={submitting || !form.rewardPoints || !form.budget}
            >
              {t('common.create')}
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
        action={t('manufacturerDashboard.confirmWaste')}
        params={
          confirmTarget
            ? [
                { label: t('manufacturerDashboard.wasteId'), value: `#${confirmTarget.id}` },
                {
                  label: t('manufacturerDashboard.type'),
                  value: t(WASTE_TYPE_LABEL_KEYS[confirmTarget.waste_type])
                },
                {
                  label: t('manufacturerDashboard.weight'),
                  value: t('manufacturerDashboard.weightKg', { weight: confirmTarget.weight })
                }
              ]
            : []
        }
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
        action={t('manufacturerDashboard.createIncentive')}
        params={[
          {
            label: t('manufacturerDashboard.wasteType'),
            value: t(WASTE_TYPE_LABEL_KEYS[Number(form.wasteType) as WasteType])
          },
          {
            label: t('manufacturerDashboard.rewardPerUnit'),
            value: t('manufacturerDashboard.pointsValue', { points: form.rewardPoints })
          },
          {
            label: t('manufacturerDashboard.totalBudget'),
            value: t('manufacturerDashboard.tokensValue', { amount: form.budget })
          }
        ]}
        isPending={submitting}
        onConfirm={handleCreate}
        onCancel={() => !submitting && setShowCreateConfirm(false)}
      />
    </div>
  )
}
