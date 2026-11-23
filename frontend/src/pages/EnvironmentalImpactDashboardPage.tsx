import { useState } from 'react'
import {
  Leaf,
  Zap,
  Droplets,
  Trees,
  Car,
  Smartphone,
  ShowerHead,
  Lightbulb,
  Share2,
  Check,
  Trophy,
  Target,
  TrendingUp
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useImpactCalculator } from '@/hooks/useImpactCalculator'
import { useAppTitle } from '@/hooks/useAppTitle'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { StatCard } from '@/components/ui/StatCard'
import { EmptyState } from '@/components/ui/EmptyState'
import { StatCardSkeleton } from '@/components/ui/Skeletons'

// ── Milestone definitions ────────────────────────────────────────────────────

interface Milestone {
  id: string
  labelKey: string
  icon: string
  threshold: number
  unitKey: string
  getValue: (co2: number, energy: number, water: number) => number
}

const MILESTONES: Milestone[] = [
  {
    id: 'co2_10',
    labelKey: 'impact.milestones.co2_10',
    icon: '🌿',
    threshold: 10,
    unitKey: 'impact.units.kgCo2',
    getValue: (co2) => co2
  },
  {
    id: 'co2_100',
    labelKey: 'impact.milestones.co2_100',
    icon: '🌳',
    threshold: 100,
    unitKey: 'impact.units.kgCo2',
    getValue: (co2) => co2
  },
  {
    id: 'energy_50',
    labelKey: 'impact.milestones.energy_50',
    icon: '⚡',
    threshold: 50,
    unitKey: 'impact.units.kwh',
    getValue: (_, energy) => energy
  },
  {
    id: 'water_500',
    labelKey: 'impact.milestones.water_500',
    icon: '💧',
    threshold: 500,
    unitKey: 'impact.units.litres',
    getValue: (_, __, water) => water
  },
  {
    id: 'co2_1000',
    labelKey: 'impact.milestones.co2_1000',
    icon: '🏆',
    threshold: 1000,
    unitKey: 'impact.units.kgCo2',
    getValue: (co2) => co2
  }
]

// ── Sub-components ────────────────────────────────────────────────────────────

function ImpactMetric({
  icon,
  label,
  value,
  unit,
  colorClass
}: {
  icon: React.ReactNode
  label: string
  value: number
  unit: string
  colorClass: string
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-2 py-6 text-center">
        <div className={`rounded-full p-3 ${colorClass}`}>{icon}</div>
        <p className="text-2xl font-bold xs:text-3xl">{value.toLocaleString()}</p>
        <p className="text-sm font-medium">{unit}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  )
}

function EquivalentRow({
  icon,
  value,
  label
}: {
  icon: React.ReactNode
  value: number
  label: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-md border px-3 py-3 xs:px-4">
      <div className="shrink-0 text-muted-foreground">{icon}</div>
      <div className="min-w-0">
        <span className="font-semibold">{value.toLocaleString()}</span>{' '}
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
    </div>
  )
}

function MilestoneBadge({ milestone, current }: { milestone: Milestone; current: number }) {
  const { t } = useTranslation()
  const earned = current >= milestone.threshold
  const pct = Math.min(100, Math.round((current / milestone.threshold) * 100))
  return (
    <div
      className={`flex flex-col items-center gap-2 rounded-lg border p-3 text-center transition-opacity xs:p-4 ${earned ? '' : 'opacity-50'}`}
    >
      <span className="text-2xl xs:text-3xl">{milestone.icon}</span>
      <p className="text-xs font-medium leading-tight">{t(milestone.labelKey)}</p>
      {earned ? (
        <Badge variant="success" className="text-xs">
          {t('impact.earned')}
        </Badge>
      ) : (
        <div className="w-full">
          <div className="mb-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-[10px] text-muted-foreground">{pct}%</p>
        </div>
      )}
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export function EnvironmentalImpactDashboardPage() {
  const { t } = useTranslation()
  useAppTitle(t('impact.title'))
  const { impact, equivalents, shareText, isLoading, isError } = useImpactCalculator()
  const [copied, setCopied] = useState(false)

  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({ text: shareText }).catch(() => null)
    } else {
      await navigator.clipboard.writeText(shareText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 xs:grid-cols-2 tablet:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <EmptyState
        title={t('impact.error.title')}
        description={t('impact.error.description')}
        icon={<Leaf className="h-8 w-8" />}
      />
    )
  }

  const hasData = impact.co2Kg > 0 || impact.energyKwh > 0 || impact.waterLitres > 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 tablet:flex-row tablet:items-center tablet:justify-between">
        <div className="min-w-0">
          <h1 className="text-lg font-bold xs:text-xl tablet:text-2xl">{t('impact.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('impact.subtitle')}</p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={handleShare}
          disabled={!hasData}
          className="w-full tablet:w-auto"
        >
          {copied ? (
            <>
              <Check className="mr-1 h-4 w-4 text-success" />
              {t('impact.copied')}
            </>
          ) : (
            <>
              <Share2 className="mr-1 h-4 w-4" />
              {t('impact.shareImpact')}
            </>
          )}
        </Button>
      </div>

      {!hasData ? (
        <EmptyState
          title={t('impact.empty.title')}
          description={t('impact.empty.description')}
          icon={<Leaf className="h-8 w-8 text-muted-foreground" />}
        />
      ) : (
        <>
          {/* Impact score summary */}
          <div className="grid grid-cols-1 gap-4 xs:grid-cols-2 tablet:grid-cols-4">
            <StatCard
              label={t('impact.stats.co2Saved')}
              value={`${impact.co2Kg} kg`}
              icon={<Leaf className="h-5 w-5 text-success" />}
            />
            <StatCard
              label={t('impact.stats.energySaved')}
              value={`${impact.energyKwh} kWh`}
              icon={<Zap className="h-5 w-5 text-warning" />}
            />
            <StatCard
              label={t('impact.stats.waterSaved')}
              value={`${impact.waterLitres} L`}
              icon={<Droplets className="h-5 w-5 text-info" />}
            />
            <StatCard
              label={t('impact.stats.treesEquivalent')}
              value={`${impact.treesEquivalent}`}
              icon={<Trees className="h-5 w-5 text-success" />}
            />
          </div>

          {/* Detailed metrics */}
          <div className="grid grid-cols-1 gap-4 xs:grid-cols-2 tablet:grid-cols-4">
            <ImpactMetric
              icon={<Leaf className="h-6 w-6 text-success" />}
              label={t('impact.metrics.carbonSaved')}
              value={impact.co2Kg}
              unit={t('impact.units.kgCo2')}
              colorClass="bg-success/10"
            />
            <ImpactMetric
              icon={<Zap className="h-6 w-6 text-warning" />}
              label={t('impact.metrics.energySaved')}
              value={impact.energyKwh}
              unit={t('impact.units.kwh')}
              colorClass="bg-warning/10"
            />
            <ImpactMetric
              icon={<Droplets className="h-6 w-6 text-info" />}
              label={t('impact.metrics.waterSaved')}
              value={impact.waterLitres}
              unit={t('impact.units.litres')}
              colorClass="bg-info/10"
            />
            <ImpactMetric
              icon={<Trees className="h-6 w-6 text-success" />}
              label={t('impact.metrics.treesEquivalent')}
              value={impact.treesEquivalent}
              unit={t('impact.units.treeYears')}
              colorClass="bg-success/10"
            />
          </div>

          {/* Everyday equivalents */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="h-4 w-4" />
                {t('impact.equivalents.title')}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 tablet:grid-cols-2">
              <EquivalentRow
                icon={<Car className="h-4 w-4" />}
                value={equivalents.carKm}
                label={t('impact.equivalents.carKm')}
              />
              <EquivalentRow
                icon={<Smartphone className="h-4 w-4" />}
                value={equivalents.smartphoneCharges}
                label={t('impact.equivalents.smartphoneCharges')}
              />
              <EquivalentRow
                icon={<ShowerHead className="h-4 w-4" />}
                value={equivalents.showerMinutes}
                label={t('impact.equivalents.showerMinutes')}
              />
              <EquivalentRow
                icon={<Lightbulb className="h-4 w-4" />}
                value={equivalents.lightbulbHours}
                label={t('impact.equivalents.lightbulbHours')}
              />
            </CardContent>
          </Card>

          {/* Milestone badges */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Trophy className="h-4 w-4" />
                {t('impact.milestones.title')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 xs:grid-cols-3 tablet:grid-cols-5">
                {MILESTONES.map((m) => (
                  <MilestoneBadge
                    key={m.id}
                    milestone={m}
                    current={m.getValue(impact.co2Kg, impact.energyKwh, impact.waterLitres)}
                  />
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Impact goals */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Target className="h-4 w-4" />
                {t('impact.nextGoal.title')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {MILESTONES.filter(
                (m) => m.getValue(impact.co2Kg, impact.energyKwh, impact.waterLitres) < m.threshold
              )
                .slice(0, 1)
                .map((m) => {
                  const current = m.getValue(impact.co2Kg, impact.energyKwh, impact.waterLitres)
                  const pct = Math.min(100, Math.round((current / m.threshold) * 100))
                  return (
                    <div key={m.id} className="space-y-2">
                      <div className="flex flex-col gap-1 text-sm xs:flex-row xs:items-center xs:justify-between">
                        <span className="font-medium">{t(m.labelKey)}</span>
                        <span className="text-muted-foreground">
                          {current.toLocaleString()} / {m.threshold.toLocaleString()} {t(m.unitKey)}
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {t('impact.nextGoal.percentComplete', { pct })}
                      </p>
                    </div>
                  )
                })}
              {MILESTONES.every(
                (m) => m.getValue(impact.co2Kg, impact.energyKwh, impact.waterLitres) >= m.threshold
              ) && (
                <p className="text-sm text-success font-medium">
                  {t('impact.nextGoal.allAchieved')}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Social sharing */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('impact.share.title')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="break-words rounded-md bg-muted px-3 py-3 text-sm leading-relaxed xs:px-4">
                {shareText}
              </p>
              <Button onClick={handleShare} className="w-full tablet:w-auto">
                {copied ? (
                  <>
                    <Check className="mr-1 h-4 w-4" />
                    {t('impact.share.copiedToClipboard')}
                  </>
                ) : (
                  <>
                    <Share2 className="mr-1 h-4 w-4" />
                    {t('impact.share.shareOnSocial')}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
