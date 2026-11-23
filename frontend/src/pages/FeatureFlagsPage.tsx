import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Flag, RotateCcw, ChevronDown, ChevronUp, BarChart2, Info } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { useFeatureFlags } from '@/hooks/useFeatureFlags'
import { getFlagAnalytics, type FeatureFlag } from '@/lib/featureFlags'

function FlagRow({
  flag,
  value,
  hasOverride,
  onToggle,
  onClear
}: {
  flag: FeatureFlag
  value: unknown
  hasOverride: boolean
  onToggle: (v: boolean) => void
  onClear: () => void
}) {
  const { t } = useTranslation()
  const isOn = Boolean(value)

  return (
    <div className="flex items-start justify-between gap-4 py-4 border-b last:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-sm font-medium">{flag.key}</span>
          {hasOverride && (
            <Badge className="text-xs bg-warning/10 text-warning border border-warning/30">
              {t('featureFlags.overridden')}
            </Badge>
          )}
          {flag.rolloutPercentage !== undefined && (
            <Badge className="text-xs bg-info/10 text-info border border-info/30">
              {t('featureFlags.rolloutPercentage', { percentage: flag.rolloutPercentage })}
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-0.5">{flag.description}</p>
        {flag.environments && !flag.environments.includes('all') && (
          <p className="text-xs text-muted-foreground mt-0.5">
            {t('featureFlags.environments', { environments: flag.environments.join(', ') })}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {hasOverride && (
          <button
            onClick={onClear}
            className="text-xs text-muted-foreground hover:text-foreground underline"
            title={t('featureFlags.clearOverride')}
          >
            {t('featureFlags.reset')}
          </button>
        )}
        <button
          role="switch"
          aria-checked={isOn}
          onClick={() => onToggle(!isOn)}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring ${
            isOn ? 'bg-success' : 'bg-muted'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
              isOn ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>
    </div>
  )
}

export function FeatureFlagsPage() {
  const { t } = useTranslation()
  const { flags, values, overrides, override, clearOverride, clearAll } = useFeatureFlags()
  const [showAnalytics, setShowAnalytics] = useState(false)
  const analytics = getFlagAnalytics().slice(-20).reverse()

  const enabledCount = Object.values(values).filter(Boolean).length
  const overrideCount = overrides.length

  return (
    <main className="p-3 xs:p-4 tablet:p-6 space-y-6 max-w-3xl mx-auto">
      <div className="flex flex-col gap-3 xs:flex-row xs:items-start xs:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl xs:text-2xl font-bold flex items-center gap-2">
            <Flag className="h-5 w-5 xs:h-6 xs:w-6 shrink-0" />
            {t('featureFlags.title')}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">{t('featureFlags.subtitle')}</p>
        </div>
        {overrideCount > 0 && (
          <button
            onClick={clearAll}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground self-start xs:self-auto shrink-0"
          >
            <RotateCcw className="h-4 w-4" />
            {t('featureFlags.resetAll')}
          </button>
        )}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 xs:grid-cols-3 gap-3 xs:gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-2xl font-bold">{Object.keys(flags).length}</p>
            <p className="text-sm text-muted-foreground">{t('featureFlags.totalFlags')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-2xl font-bold text-success">{enabledCount}</p>
            <p className="text-sm text-muted-foreground">{t('featureFlags.enabled')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-2xl font-bold text-warning">{overrideCount}</p>
            <p className="text-sm text-muted-foreground">{t('featureFlags.overriddenCount')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Flag list */}
      <Card>
        <CardHeader>
          <CardTitle>{t('featureFlags.allFlags')}</CardTitle>
          <CardDescription>{t('featureFlags.allFlagsDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="divide-y p-0 px-3 xs:px-4 tablet:px-6">
          {Object.values(flags).map((flag) => (
            <FlagRow
              key={flag.key}
              flag={flag}
              value={values[flag.key]}
              hasOverride={overrides.some((o) => o.key === flag.key)}
              onToggle={(v) => override(flag.key, v)}
              onClear={() => clearOverride(flag.key)}
            />
          ))}
        </CardContent>
      </Card>

      {/* Analytics */}
      <Card>
        <CardHeader>
          <button
            className="flex items-center justify-between w-full text-left"
            onClick={() => setShowAnalytics((v) => !v)}
          >
            <CardTitle className="flex items-center gap-2">
              <BarChart2 className="h-4 w-4" />
              {t('featureFlags.recentEvents')}
            </CardTitle>
            {showAnalytics ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
        </CardHeader>
        {showAnalytics && (
          <CardContent>
            {analytics.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('featureFlags.noEvents')}</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {analytics.map((e, i) => (
                  <li key={i} className="flex items-center gap-2 text-muted-foreground">
                    <span className="font-mono">{e.flagKey}</span>
                    <span>→</span>
                    <Badge
                      className={`text-xs ${e.value ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}
                    >
                      {String(e.value)}
                    </Badge>
                    <span className="ml-auto text-xs">
                      {new Date(e.timestamp).toLocaleTimeString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        )}
      </Card>

      {/* Info callout */}
      <div className="flex gap-2 p-3 rounded-lg bg-info/10 text-sm text-info">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <p>
          {t('featureFlags.infoCallout')}{' '}
          <code className="font-mono text-xs">frontend/src/lib/featureFlags.ts</code>{' '}
          {t('featureFlags.infoCalloutSuffix')}
        </p>
      </div>
    </main>
  )
}
