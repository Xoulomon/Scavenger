import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Recycle, Truck, Factory } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { useStats } from '@/hooks/useStats'
import { useAppTitle } from '@/hooks/useAppTitle'

const STEPS = [
  {
    icon: Recycle,
    titleKey: 'landing.steps.recycle.title',
    descriptionKey: 'landing.steps.recycle.description'
  },
  {
    icon: Truck,
    titleKey: 'landing.steps.collect.title',
    descriptionKey: 'landing.steps.collect.description'
  },
  {
    icon: Factory,
    titleKey: 'landing.steps.manufacture.title',
    descriptionKey: 'landing.steps.manufacture.description'
  }
]

const FOOTER_LINKS = [
  { labelKey: 'landing.footer.github', href: 'https://github.com' },
  { labelKey: 'landing.footer.twitter', href: 'https://twitter.com' }
]

export function LandingPage() {
  const { t } = useTranslation()
  useAppTitle(t('landing.appTitle'))
  const { totalWastes, totalWeight, totalTokens, isLoading } = useStats()

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Nav */}
      <header className="flex h-14 items-center justify-between gap-2 border-b px-4 xs:px-6">
        <div className="flex min-w-0 items-center gap-2 font-bold">
          <Recycle className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
          <span className="truncate">{t('landing.brand')}</span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ThemeToggle />
          <Button asChild size="sm">
            <Link to="/dashboard">{t('landing.launchApp')}</Link>
          </Button>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-4 py-16 text-center xs:px-6 xs:py-24">
          <h1 className="text-3xl font-extrabold leading-tight tracking-tight xs:text-4xl tablet:text-5xl">
            {t('landing.hero.title')}
          </h1>
          <p className="max-w-xl text-base text-muted-foreground xs:text-lg">
            {t('landing.hero.description')}
          </p>
          <div className="flex w-full flex-col justify-center gap-3 xs:w-auto xs:flex-row xs:flex-wrap">
            <Button asChild size="lg">
              <Link to="/dashboard">{t('landing.hero.getStarted')}</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <a href="https://github.com" target="_blank" rel="noreferrer">
                {t('landing.hero.viewOnGitHub')}
              </a>
            </Button>
          </div>
        </section>

        {/* How it works */}
        <section className="border-t bg-muted/40 px-4 py-16 xs:px-6 xs:py-20">
          <div className="mx-auto max-w-4xl">
            <h2 className="mb-12 text-center text-2xl font-bold">
              {t('landing.howItWorks.title')}
            </h2>
            <div className="grid gap-8 xs:grid-cols-1 tablet:grid-cols-3">
              {STEPS.map((step, i) => (
                <div key={step.titleKey} className="flex flex-col items-center gap-3 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                    <step.icon className="h-7 w-7 text-primary" aria-hidden="true" />
                  </div>
                  <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    {t('landing.howItWorks.step', { number: i + 1 })}
                  </span>
                  <h3 className="text-lg font-semibold">{t(step.titleKey)}</h3>
                  <p className="text-sm text-muted-foreground">{t(step.descriptionKey)}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Live stats */}
        <section className="px-4 py-16 xs:px-6 xs:py-20">
          <div className="mx-auto max-w-3xl">
            <h2 className="mb-10 text-center text-2xl font-bold">{t('landing.stats.title')}</h2>
            <div className="grid gap-6 xs:grid-cols-1 tablet:grid-cols-3">
              {[
                {
                  labelKey: 'landing.stats.wasteItems',
                  value: isLoading ? '—' : totalWastes.toString()
                },
                {
                  labelKey: 'landing.stats.totalWeight',
                  value: isLoading ? '—' : totalWeight.toString()
                },
                {
                  labelKey: 'landing.stats.tokensDistributed',
                  value: isLoading ? '—' : totalTokens.toString()
                }
              ].map((stat) => (
                <div
                  key={stat.labelKey}
                  className="rounded-lg border border-border bg-card p-6 text-center shadow-sm"
                >
                  <p className="text-2xl font-extrabold text-primary xs:text-3xl">{stat.value}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{t(stat.labelKey)}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t px-4 py-8 xs:px-6">
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-4 tablet:flex-row tablet:justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Recycle className="h-4 w-4 text-primary" aria-hidden="true" />
            {t('landing.brand')}
          </div>
          <div className="flex flex-wrap justify-center gap-4">
            {FOOTER_LINKS.map(({ labelKey, href }) => (
              <a
                key={labelKey}
                href={href}
                target="_blank"
                rel="noreferrer"
                className="flex min-h-11 items-center gap-1.5 px-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {t(labelKey)}
              </a>
            ))}
          </div>
          <p className="text-center text-xs text-muted-foreground">
            {t('landing.footer.copyright', { year: new Date().getFullYear() })}
          </p>
        </div>
      </footer>
    </div>
  )
}
