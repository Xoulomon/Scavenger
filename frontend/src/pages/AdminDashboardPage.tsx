import { ShieldAlert, AlertTriangle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/context/AuthContext'
import { useAppTitle } from '@/hooks/useAppTitle'
import { useAdminTabs } from '@/hooks/useAdminTabs'
import { ROLES } from '@/lib/constants'
import { Button } from '@/components/ui/Button'
import {
  OverviewTab,
  UsersTab,
  DisputesTab,
  WastesTab,
  IncentivesTab,
  SystemHealthTab,
  ConfigTab,
  AuditLogTab
} from '@/components/admin'

export function AdminDashboardPage() {
  const { t } = useTranslation()
  useAppTitle(t('admin.dashboard.title'))
  const { user } = useAuth()
  const isAdmin = user?.role === ROLES.ADMIN
  const { activeTab, setActiveTab, visibleTabs } = useAdminTabs({ isAdmin })

  return (
    <div className="space-y-6 px-3 py-6 xs:px-4 sm:space-y-8 sm:py-8">
      <div className="flex items-center gap-3">
        <ShieldAlert className="h-6 w-6 shrink-0 text-destructive" />
        <div className="min-w-0">
          <h1 className="text-xl font-bold sm:text-2xl">{t('admin.dashboard.title')}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{t('admin.dashboard.subtitle')}</p>
        </div>
      </div>

      {!isAdmin && (
        <div className="flex items-start gap-2 rounded-md border border-warning bg-warning/10 px-3 py-2 text-sm text-warning-foreground xs:px-4 sm:items-center">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 sm:mt-0" />
          <span className="min-w-0">{t('admin.dashboard.restrictedNotice')}</span>
        </div>
      )}

      {/* Tab bar */}
      <div
        role="tablist"
        aria-label={t('admin.dashboard.tabListLabel')}
        className="flex flex-wrap gap-1 rounded-lg border bg-muted p-1 xs:flex-nowrap xs:overflow-x-auto tablet:flex-wrap tablet:overflow-visible"
      >
        {visibleTabs.map((tab) => (
          <Button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            variant={activeTab === tab.id ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab(tab.id)}
            className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring xs:px-3 ${
              activeTab === tab.id
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.icon}
            {tab.label}
          </Button>
        ))}
      </div>

      {/* Tab panels */}
      <div role="tabpanel">
        {activeTab === 'overview' && <OverviewTab />}
        {activeTab === 'users' && <UsersTab />}
        {activeTab === 'disputes' && <DisputesTab />}
        {activeTab === 'wastes' && <WastesTab />}
        {activeTab === 'incentives' && <IncentivesTab />}
        {activeTab === 'health' && <SystemHealthTab />}
        {activeTab === 'config' && isAdmin && <ConfigTab />}
        {activeTab === 'audit' && <AuditLogTab />}
      </div>
    </div>
  )
}
