import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Pencil, Trash2, Loader2, Zap } from 'lucide-react'
import { useIncentives } from '@/hooks/useIncentives'
import { Incentive, WasteType, Role } from '@/api/types'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { IncentiveCardSkeleton } from '@/components/ui/Skeletons'
import { AddressDisplay } from '@/components/ui/AddressDisplay'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/Select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/Dialog'

const WASTE_LABEL_KEYS: Record<WasteType, string> = {
  [WasteType.Paper]: 'incentives.wasteTypes.paper',
  [WasteType.PetPlastic]: 'incentives.wasteTypes.petPlastic',
  [WasteType.Plastic]: 'incentives.wasteTypes.plastic',
  [WasteType.Metal]: 'incentives.wasteTypes.metal',
  [WasteType.Glass]: 'incentives.wasteTypes.glass',
  [WasteType.Organic]: 'incentives.wasteTypes.organic',
  [WasteType.Electronic]: 'incentives.wasteTypes.electronic'
}

const ALL_WASTE_TYPES = Object.values(WasteType).filter(
  (v): v is WasteType => typeof v === 'number'
)

type FormState = { wasteType: string; rewardPoints: string; budget: string }
const EMPTY_FORM: FormState = { wasteType: String(WasteType.Paper), rewardPoints: '', budget: '' }

export function IncentivesPage() {
  const { t } = useTranslation()
  const {
    incentives,
    isLoading,
    error,
    address,
    createIncentive,
    updateIncentive,
    deactivateIncentive
  } = useIncentives()
  const { user } = useAuth()
  const isManufacturer = user?.role === Role.Manufacturer

  const [typeFilter, setTypeFilter] = useState<string>('all')

  // Create / Edit dialog
  const [editTarget, setEditTarget] = useState<Incentive | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)

  const openCreate = useCallback(() => {
    setForm(EMPTY_FORM)
    setEditTarget(null)
    setCreateOpen(true)
  }, [])

  const openEdit = useCallback((inc: Incentive) => {
    setForm({
      wasteType: String(inc.waste_type),
      rewardPoints: String(inc.reward_points),
      budget: String(inc.remaining_budget)
    })
    setEditTarget(inc)
    setCreateOpen(true)
  }, [])

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      if (editTarget) {
        await updateIncentive(editTarget.id, BigInt(form.rewardPoints), BigInt(form.budget))
      } else {
        await createIncentive(
          Number(form.wasteType) as WasteType,
          BigInt(form.rewardPoints),
          BigInt(form.budget)
        )
      }
      setCreateOpen(false)
    } finally {
      setSubmitting(false)
    }
  }

  const filtered =
    typeFilter === 'all'
      ? incentives
      : incentives.filter((i) => i.waste_type === Number(typeFilter))

  // Group by waste type
  const grouped = ALL_WASTE_TYPES.reduce<Record<WasteType, Incentive[]>>(
    (acc, wt) => ({ ...acc, [wt]: filtered.filter((i) => i.waste_type === wt) }),
    {} as Record<WasteType, Incentive[]>
  )

  return (
    <div className="space-y-6 overflow-x-hidden px-3 py-6 xs:px-4 tablet:px-0 tablet:py-0">
      <div className="flex flex-col gap-3 tablet:flex-row tablet:flex-wrap tablet:items-center tablet:justify-between">
        <h1 className="text-lg font-bold xs:text-xl tablet:text-2xl">{t('incentives.title')}</h1>
        <div className="flex w-full flex-col gap-3 xs:flex-row xs:items-center tablet:w-auto">
          <label htmlFor="incentive-type-filter" className="sr-only">
            {t('incentives.filterLabel')}
          </label>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger id="incentive-type-filter" className="w-full xs:w-36">
              <SelectValue placeholder={t('incentives.allTypes')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('incentives.allTypes')}</SelectItem>
              {ALL_WASTE_TYPES.map((wt) => (
                <SelectItem key={wt} value={String(wt)}>
                  {t(WASTE_LABEL_KEYS[wt])}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isManufacturer && (
            <Button onClick={openCreate} className="w-full xs:w-auto">
              <Plus className="mr-2 h-4 w-4" />
              {t('incentives.createIncentive')}
            </Button>
          )}
        </div>
      </div>

      {error && (
        <p
          role="alert"
          aria-live="assertive"
          className="rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive xs:px-4"
        >
          {error}
        </p>
      )}

      {isLoading ? (
        <div className="space-y-6">
          {Array.from({ length: 2 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-3">
                <div className="h-4 w-24 animate-pulse rounded bg-muted" />
              </CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <tbody className="divide-y">
                    {Array.from({ length: 3 }).map((_, j) => (
                      <IncentiveCardSkeleton key={j} />
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {filtered.length === 0 ? (
            <EmptyState
              icon={Zap}
              title={t('incentives.empty.title')}
              description={
                typeFilter !== 'all'
                  ? t('incentives.empty.filteredDescription')
                  : t('incentives.empty.description')
              }
              action={
                isManufacturer
                  ? { label: t('incentives.createIncentive'), onClick: openCreate }
                  : undefined
              }
            />
          ) : (
            <>
              {ALL_WASTE_TYPES.map((wt) => {
                const group = grouped[wt]
                if (group.length === 0) return null
                return (
                  <Card key={wt}>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">{t(WASTE_LABEL_KEYS[wt])}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="text-left text-muted-foreground">
                            <tr>
                              <th className="pb-2 pr-2 font-medium xs:pr-4">
                                {t('incentives.table.id')}
                              </th>
                              <th className="pb-2 pr-2 font-medium xs:pr-4">
                                {t('incentives.table.rewarder')}
                              </th>
                              <th className="pb-2 pr-2 font-medium xs:pr-4">
                                {t('incentives.table.pointsPerUnit')}
                              </th>
                              <th className="pb-2 pr-2 font-medium xs:pr-4">
                                {t('incentives.table.budgetRemaining')}
                              </th>
                              {isManufacturer && (
                                <th className="pb-2 font-medium text-right">
                                  {t('incentives.table.actions')}
                                </th>
                              )}
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {group.map((inc) => {
                              const isOwner = inc.rewarder === address
                              return (
                                <tr key={inc.id} className="hover:bg-muted/30 transition-colors">
                                  <td className="py-2 pr-2 font-mono xs:pr-4">#{inc.id}</td>
                                  <td className="py-2 pr-2 font-mono text-xs text-muted-foreground xs:pr-4">
                                    <AddressDisplay address={inc.rewarder} showExplorer />
                                  </td>
                                  <td className="py-2 pr-2 xs:pr-4">{inc.reward_points}</td>
                                  <td className="py-2 pr-2 xs:pr-4">
                                    <Badge variant="secondary">
                                      {inc.remaining_budget.toLocaleString()}
                                    </Badge>
                                  </td>
                                  {isManufacturer && (
                                    <td className="py-2 text-right">
                                      {isOwner && (
                                        <div className="flex justify-end gap-1">
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            aria-label={t('incentives.actions.editAria', {
                                              id: inc.id
                                            })}
                                            title={t('incentives.actions.edit')}
                                            onClick={() => openEdit(inc)}
                                          >
                                            <Pencil className="h-4 w-4" />
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            aria-label={t('incentives.actions.deactivateAria', {
                                              id: inc.id
                                            })}
                                            title={t('incentives.actions.deactivate')}
                                            className="text-destructive hover:text-destructive"
                                            onClick={() => deactivateIncentive(inc.id)}
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </Button>
                                        </div>
                                      )}
                                    </td>
                                  )}
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </>
          )}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={createOpen} onOpenChange={(o) => !o && setCreateOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editTarget ? t('incentives.dialog.editTitle') : t('incentives.dialog.createTitle')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 xs:space-y-4">
            {!editTarget && (
              <div className="space-y-1.5">
                <label htmlFor="incentive-waste-type" className="text-sm font-medium">
                  {t('incentives.dialog.wasteType')}
                </label>
                <Select
                  value={form.wasteType}
                  onValueChange={(v) => setForm((f) => ({ ...f, wasteType: v }))}
                >
                  <SelectTrigger id="incentive-waste-type" autoFocus>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ALL_WASTE_TYPES.map((wt) => (
                      <SelectItem key={wt} value={String(wt)}>
                        {t(WASTE_LABEL_KEYS[wt])}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <label htmlFor="incentive-reward-points" className="text-sm font-medium">
                {t('incentives.dialog.rewardPoints')}
              </label>
              <Input
                id="incentive-reward-points"
                type="number"
                min="1"
                placeholder={t('incentives.dialog.rewardPointsPlaceholder')}
                value={form.rewardPoints}
                onChange={(e) => setForm((f) => ({ ...f, rewardPoints: e.target.value }))}
                autoFocus={!!editTarget}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="incentive-budget" className="text-sm font-medium">
                {editTarget
                  ? t('incentives.dialog.budgetToAdd')
                  : t('incentives.dialog.totalBudget')}{' '}
                {t('incentives.dialog.budgetUnit')}
              </label>
              <Input
                id="incentive-budget"
                type="number"
                min="1"
                placeholder={t('incentives.dialog.budgetPlaceholder')}
                value={form.budget}
                onChange={(e) => setForm((f) => ({ ...f, budget: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter className="flex-col gap-2 xs:flex-row">
            <Button
              variant="outline"
              onClick={() => setCreateOpen(false)}
              className="w-full xs:w-auto"
            >
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting || !form.rewardPoints || !form.budget}
              className="w-full xs:w-auto"
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editTarget ? t('common.save') : t('common.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
