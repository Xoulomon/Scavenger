import { useState } from 'react'
import { FileText, Clock, History, ClipboardList } from 'lucide-react'
import { useAppTitle } from '@/hooks/useAppTitle'
import { useTranslation } from '@/i18n'
import { ReportBuilderTab } from './ComplianceReportsPage/ReportBuilderTab'
import { HistoryTab } from './ComplianceReportsPage/HistoryTab'
import { SchedulingTab } from './ComplianceReportsPage/SchedulingTab'

type Tab = 'builder' | 'history' | 'scheduling'

// ── Page ────────────────────────────────────────────────────────────────────

export function ComplianceReportsPage() {
  const { t } = useTranslation()
  useAppTitle(t('complianceReports.pageTitle'))
  const [activeTab, setActiveTab] = useState<Tab>('builder')

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    {
      id: 'builder',
      label: t('complianceReports.tabs.builder'),
      icon: <ClipboardList className="h-4 w-4" />
    },
    {
      id: 'history',
      label: t('complianceReports.tabs.history'),
      icon: <History className="h-4 w-4" />
    },
    {
      id: 'scheduling',
      label: t('complianceReports.tabs.scheduling'),
      icon: <Clock className="h-4 w-4" />
    }
  ]

  return (
    <div className="space-y-6 px-3 py-6 xs:px-4 sm:space-y-8 sm:py-8">
      <div className="flex items-center gap-3">
        <FileText className="h-6 w-6 shrink-0 text-primary" />
        <div className="min-w-0">
          <h1 className="text-xl font-bold sm:text-2xl">{t('complianceReports.pageTitle')}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {t('complianceReports.pageDescription')}
          </p>
        </div>
      </div>

      <div
        role="tablist"
        aria-label={t('complianceReports.tabsAriaLabel')}
        className="flex flex-wrap gap-1 rounded-lg border bg-muted p-1"
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring xs:flex-none xs:justify-start xs:px-3 ${
              activeTab === tab.id
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.icon}
            <span className="truncate">{tab.label}</span>
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {activeTab === 'builder' && <ReportBuilderTab />}
        {activeTab === 'history' && <HistoryTab />}
        {activeTab === 'scheduling' && <SchedulingTab />}
      </div>
    </div>
  )
}
