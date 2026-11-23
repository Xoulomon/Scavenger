import { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { AppShell } from '@/components/layout/AppShell'
import { PageSkeleton } from '@/components/ui/Skeletons'
// Unified error strategy: `RouteErrorBoundary` is a thin wrapper around the
// single app-level `ErrorBoundary` and reports through the shared toast/error
// reporter. The router only ever references this one boundary — there are no
// console.error-only fallbacks in the route configuration.
import { RouteErrorBoundary } from '@/components/RouteErrorBoundary'
import { ROUTES } from '@/lib/constants'

// Eagerly load tiny pages that are always needed at startup
import { LandingPage } from '@/pages/LandingPage'
import { LoginPage } from '@/pages/LoginPage'
import { NotFoundPage } from '@/pages/NotFoundPage'

// ─── Lazy-loaded protected pages ──────────────────────────────────────────────
// Each import() call becomes its own JS chunk — loaded only when the route is
// visited, keeping the initial bundle as small as possible.

const HomePage = lazy(() => import('@/pages/HomePage').then((m) => ({ default: m.HomePage })))
const RecyclerDashboard = lazy(() =>
  import('@/pages/RecyclerDashboard').then((m) => ({ default: m.RecyclerDashboard }))
)
const IncentivesMarketplacePage = lazy(() =>
  import('@/pages/IncentivesMarketplacePage').then((m) => ({
    default: m.IncentivesMarketplacePage
  }))
)
const IncentivesPage = lazy(() =>
  import('@/pages/IncentivesPage').then((m) => ({ default: m.IncentivesPage }))
)
const WasteListPage = lazy(() =>
  import('@/pages/WasteListPage').then((m) => ({ default: m.WasteListPage }))
)
const ManufacturerDashboardPage = lazy(() =>
  import('@/pages/ManufacturerDashboardPage').then((m) => ({
    default: m.ManufacturerDashboardPage
  }))
)
const CollectorDashboardPage = lazy(() =>
  import('@/pages/CollectorDashboardPage').then((m) => ({ default: m.CollectorDashboardPage }))
)
const SettingsPage = lazy(() =>
  import('@/pages/SettingsPage').then((m) => ({ default: m.SettingsPage }))
)
const RewardsPage = lazy(() =>
  import('@/pages/RewardsPage').then((m) => ({ default: m.RewardsPage }))
)
const SupplyChainTrackerPage = lazy(() =>
  import('@/pages/SupplyChainTrackerPage').then((m) => ({ default: m.SupplyChainTrackerPage }))
)
const CommunityPage = lazy(() =>
  import('@/pages/CommunityPage').then((m) => ({ default: m.CommunityPage }))
)
const AnalyticsPage = lazy(() =>
  import('@/pages/AnalyticsPage').then((m) => ({ default: m.AnalyticsPage }))
)
const WasteMapPage = lazy(() =>
  import('@/pages/WasteMapPage').then((m) => ({ default: m.WasteMapPage }))
)
const AdminDashboardPage = lazy(() =>
  import('@/pages/AdminDashboardPage').then((m) => ({ default: m.AdminDashboardPage }))
)
const VerificationPage = lazy(() =>
  import('@/pages/VerificationPage').then((m) => ({ default: m.VerificationPage }))
)
const RoutePlannerPage = lazy(() =>
  import('@/pages/RoutePlannerPage').then((m) => ({ default: m.RoutePlannerPage }))
)
const MessagingPage = lazy(() =>
  import('@/pages/MessagingPage').then((m) => ({ default: m.MessagingPage }))
)
const WasteComparisonPage = lazy(() =>
  import('@/pages/WasteComparisonPage').then((m) => ({ default: m.WasteComparisonPage }))
)
const PredictiveAnalyticsPage = lazy(() =>
  import('@/pages/PredictiveAnalyticsPage').then((m) => ({ default: m.PredictiveAnalyticsPage }))
)
const WasteMarketplacePage = lazy(() =>
  import('@/pages/WasteMarketplacePage').then((m) => ({ default: m.WasteMarketplacePage }))
)
const WasteCertificationPage = lazy(() =>
  import('@/pages/WasteCertificationPage').then((m) => ({ default: m.WasteCertificationPage }))
)
const RecyclingGuidePage = lazy(() =>
  import('@/pages/RecyclingGuidePage').then((m) => ({ default: m.RecyclingGuidePage }))
)
const PerformanceMonitoringPage = lazy(() =>
  import('@/pages/PerformanceMonitoringPage').then((m) => ({
    default: m.PerformanceMonitoringPage
  }))
)
const GamificationPage = lazy(() =>
  import('@/pages/GamificationPage').then((m) => ({ default: m.GamificationPage }))
)
const OfflinePage = lazy(() =>
  import('@/pages/OfflinePage').then((m) => ({ default: m.OfflinePage }))
)
const WasteHistoryPage = lazy(() =>
  import('@/pages/WasteHistoryPage').then((m) => ({ default: m.WasteHistoryPage }))
)
const ParticipantSearchPage = lazy(() =>
  import('@/pages/ParticipantSearchPage').then((m) => ({ default: m.ParticipantSearchPage }))
)
const WasteStatisticsPage = lazy(() =>
  import('@/pages/WasteStatisticsPage').then((m) => ({ default: m.WasteStatisticsPage }))
)
const RewardTrackingPage = lazy(() =>
  import('@/pages/RewardTrackingPage').then((m) => ({ default: m.RewardTrackingPage }))
)
const MaterialTransferPage = lazy(() =>
  import('@/pages/MaterialTransferPage').then((m) => ({ default: m.MaterialTransferPage }))
)
const WasteVerificationDashboardPage = lazy(() =>
  import('@/pages/WasteVerificationDashboardPage').then((m) => ({
    default: m.WasteVerificationDashboardPage
  }))
)
const ParticipantRegistrationPage = lazy(() =>
  import('@/pages/ParticipantRegistrationPage').then((m) => ({
    default: m.ParticipantRegistrationPage
  }))
)
const TestReportsPage = lazy(() =>
  import('@/pages/TestReportsPage').then((m) => ({ default: m.TestReportsPage }))
)
const ComplianceReportsPage = lazy(() =>
  import('@/pages/ComplianceReportsPage').then((m) => ({ default: m.ComplianceReportsPage }))
)
const NotificationCenterPage = lazy(() =>
  import('@/pages/NotificationCenterPage').then((m) => ({ default: m.NotificationCenterPage }))
)
const BatchUploadPage = lazy(() =>
  import('@/pages/BatchUploadPage').then((m) => ({ default: m.BatchUploadPage }))
)
const FeatureFlagsPage = lazy(() =>
  import('@/pages/FeatureFlagsPage').then((m) => ({ default: m.FeatureFlagsPage }))
)
const PlatformHealthDashboardPage = lazy(() =>
  import('@/pages/PlatformHealthDashboardPage').then((m) => ({
    default: m.PlatformHealthDashboardPage
  }))
)
const PerformanceSLAsPage = lazy(() =>
  import('@/pages/PerformanceSLAsPage').then((m) => ({ default: m.PerformanceSLAsPage }))
)
const GovernancePage = lazy(() =>
  import('@/pages/GovernancePage').then((m) => ({ default: m.GovernancePage }))
)
// Previously missing pages — now lazy-loaded
const ProfilePage = lazy(() =>
  import('@/pages/ProfilePage').then((m) => ({ default: m.ProfilePage }))
)
const CharityDonationsPage = lazy(() =>
  import('@/pages/CharityDonationsPage').then((m) => ({ default: m.CharityDonationsPage }))
)
const EnvironmentalImpactDashboardPage = lazy(() =>
  import('@/pages/EnvironmentalImpactDashboardPage').then((m) => ({
    default: m.EnvironmentalImpactDashboardPage
  }))
)
const ImpactCalculatorPage = lazy(() =>
  import('@/pages/ImpactCalculatorPage').then((m) => ({ default: m.ImpactCalculatorPage }))
)
const SearchResultsPage = lazy(() =>
  import('@/pages/SearchResultsPage').then((m) => ({ default: m.SearchResultsPage }))
)
const SubscriptionsPage = lazy(() =>
  import('@/pages/SubscriptionsPage').then((m) => ({ default: m.SubscriptionsPage }))
)
const QRCodePage = lazy(() => import('@/pages/QRCodePage').then((m) => ({ default: m.QRCodePage })))
const OfflineSettings = lazy(() =>
  import('@/pages/OfflineSettings').then((m) => ({ default: m.OfflineSettings }))
)

// ─── Suspense wrapper ─────────────────────────────────────────────────────────
// Wraps the route outlet in a Suspense boundary so every lazy page gets a
// consistent PageSkeleton loading fallback while its chunk is being fetched.

function PageFallback() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Outlet />
    </Suspense>
  )
}

// ─── Lazy route element helper ────────────────────────────────────────────────
// Wraps a single lazy page in its own Suspense boundary so that a slow chunk
// fetch only suspends that page (not the whole shell) and always shows the
// shared PageSkeleton fallback.

function LazyRoute({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PageSkeleton />}>{children}</Suspense>
}

// ─── Auth guard ───────────────────────────────────────────────────────────────

function ProtectedLayout() {
  const { isAuthenticated, isLoading } = useAuth()
  if (isLoading) return null
  return isAuthenticated ? (
    <AppShell>
      <PageFallback />
    </AppShell>
  ) : (
    <Navigate to={ROUTES.LOGIN} replace />
  )
}

// Each protected page gets its own `errorElement` so a crash on one route
// renders a fallback in place of just that page — the app shell and every
// other route stay unaffected, and navigating away recovers automatically.
// The `errorElement` is attached centrally below (see `withErrorBoundary`),
// so route entries stay plain `{ path, element }` objects. This keeps the
// exported `PROTECTED_ROUTES` shape backwards-compatible for any consumer
// that maps over it.
export const PROTECTED_ROUTES = [
  {
    path: ROUTES.DASHBOARD,
    element: (
      <LazyRoute>
        <HomePage />
      </LazyRoute>
    )
  },
  { path: ROUTES.SUBMIT, element: <div>Submit Waste</div> },
  {
    path: ROUTES.COLLECT,
    element: (
      <LazyRoute>
        <CollectorDashboardPage />
      </LazyRoute>
    )
  },
  {
    path: ROUTES.INCENTIVES,
    element: (
      <LazyRoute>
        <IncentivesMarketplacePage />
      </LazyRoute>
    )
  },
  {
    path: ROUTES.INCENTIVES_MANAGE,
    element: (
      <LazyRoute>
        <IncentivesPage />
      </LazyRoute>
    )
  },
  {
    path: ROUTES.TRANSFER,
    element: (
      <LazyRoute>
        <MaterialTransferPage />
      </LazyRoute>
    )
  },
  { path: ROUTES.HISTORY, element: <div>History</div> },
  {
    path: ROUTES.DASHBOARD_RECYCLER,
    element: (
      <LazyRoute>
        <RecyclerDashboard />
      </LazyRoute>
    )
  },
  {
    path: ROUTES.WASTES,
    element: (
      <LazyRoute>
        <WasteListPage />
      </LazyRoute>
    )
  },
  {
    path: ROUTES.MANUFACTURER,
    element: (
      <LazyRoute>
        <ManufacturerDashboardPage />
      </LazyRoute>
    )
  },
  {
    path: ROUTES.SETTINGS,
    element: (
      <LazyRoute>
        <SettingsPage />
      </LazyRoute>
    )
  },
  {
    path: ROUTES.SETTINGS_OFFLINE,
    element: (
      <LazyRoute>
        <OfflineSettings />
      </LazyRoute>
    )
  },
  {
    path: ROUTES.REWARDS,
    element: (
      <LazyRoute>
        <RewardsPage />
      </LazyRoute>
    )
  },
  {
    path: ROUTES.TRACKER,
    element: (
      <LazyRoute>
        <SupplyChainTrackerPage />
      </LazyRoute>
    )
  },
  {
    path: ROUTES.COMMUNITY,
    element: (
      <LazyRoute>
        <CommunityPage />
      </LazyRoute>
    )
  },
  {
    path: ROUTES.GOVERNANCE,
    element: (
      <LazyRoute>
        <GovernancePage />
      </LazyRoute>
    )
  },
  {
    path: ROUTES.ANALYTICS,
    element: (
      <LazyRoute>
        <AnalyticsPage />
      </LazyRoute>
    )
  },
  {
    path: ROUTES.MAP,
    element: (
      <LazyRoute>
        <WasteMapPage />
      </LazyRoute>
    )
  },
  {
    path: ROUTES.ADMIN,
    element: (
      <LazyRoute>
        <AdminDashboardPage />
      </LazyRoute>
    )
  },
  {
    path: ROUTES.VERIFY,
    element: (
      <LazyRoute>
        <VerificationPage />
      </LazyRoute>
    )
  },
  {
    path: ROUTES.ROUTE_PLANNER,
    element: (
      <LazyRoute>
        <RoutePlannerPage />
      </LazyRoute>
    )
  },
  {
    path: ROUTES.MESSAGES,
    element: (
      <LazyRoute>
        <MessagingPage />
      </LazyRoute>
    )
  },
  {
    path: ROUTES.COMPARE,
    element: (
      <LazyRoute>
        <WasteComparisonPage />
      </LazyRoute>
    )
  },
  {
    path: ROUTES.PREDICTIONS,
    element: (
      <LazyRoute>
        <PredictiveAnalyticsPage />
      </LazyRoute>
    )
  },
  {
    path: ROUTES.MARKETPLACE,
    element: (
      <LazyRoute>
        <WasteMarketplacePage />
      </LazyRoute>
    )
  },
  {
    path: ROUTES.CERTIFICATIONS,
    element: (
      <LazyRoute>
        <WasteCertificationPage />
      </LazyRoute>
    )
  },
  {
    path: ROUTES.RECYCLING_GUIDE,
    element: (
      <LazyRoute>
        <RecyclingGuidePage />
      </LazyRoute>
    )
  },
  {
    path: ROUTES.PERFORMANCE,
    element: (
      <LazyRoute>
        <PerformanceMonitoringPage />
      </LazyRoute>
    )
  },
  {
    path: ROUTES.ACHIEVEMENTS,
    element: (
      <LazyRoute>
        <GamificationPage />
      </LazyRoute>
    )
  },
  {
    path: ROUTES.OFFLINE,
    element: (
      <LazyRoute>
        <OfflinePage />
      </LazyRoute>
    )
  },
  {
    path: ROUTES.WASTE_HISTORY,
    element: (
      <LazyRoute>
        <WasteHistoryPage />
      </LazyRoute>
    )
  },
  {
    path: ROUTES.PARTICIPANT_SEARCH,
    element: (
      <LazyRoute>
        <ParticipantSearchPage />
      </LazyRoute>
    )
  },
  {
    path: ROUTES.WASTE_STATISTICS,
    element: (
      <LazyRoute>
        <WasteStatisticsPage />
      </LazyRoute>
    )
  },
  {
    path: ROUTES.REWARD_TRACKING,
    element: (
      <LazyRoute>
        <RewardTrackingPage />
      </LazyRoute>
    )
  },
  {
    path: ROUTES.VERIFICATION_DASHBOARD,
    element: (
      <LazyRoute>
        <WasteVerificationDashboardPage />
      </LazyRoute>
    )
  },
  {
    path: ROUTES.REGISTER,
    element: (
      <LazyRoute>
        <ParticipantRegistrationPage />
      </LazyRoute>
    )
  },
  {
    path: ROUTES.TEST_REPORTS,
    element: (
      <LazyRoute>
        <TestReportsPage />
      </LazyRoute>
    )
  },
  {
    path: ROUTES.COMPLIANCE_REPORTS,
    element: (
      <LazyRoute>
        <ComplianceReportsPage />
      </LazyRoute>
    )
  },
  {
    path: ROUTES.NOTIFICATIONS,
    element: (
      <LazyRoute>
        <NotificationCenterPage />
      </LazyRoute>
    )
  },
  {
    path: ROUTES.BATCH_UPLOAD,
    element: (
      <LazyRoute>
        <BatchUploadPage />
      </LazyRoute>
    )
  },
  {
    path: ROUTES.FEATURE_FLAGS,
    element: (
      <LazyRoute>
        <FeatureFlagsPage />
      </LazyRoute>
    )
  },
  {
    path: ROUTES.HEALTH,
    element: (
      <LazyRoute>
        <PlatformHealthDashboardPage />
      </LazyRoute>
    )
  },
  {
    path: ROUTES.SLAS,
    element: (
      <LazyRoute>
        <PerformanceSLAsPage />
      </LazyRoute>
    )
  },
  // Previously unrouted pages — wired up with lazy loading
  {
    path: ROUTES.PROFILE,
    element: (
      <LazyRoute>
        <ProfilePage />
      </LazyRoute>
    )
  },
  {
    path: ROUTES.DONATIONS,
    element: (
      <LazyRoute>
        <CharityDonationsPage />
      </LazyRoute>
    )
  },
  {
    path: ROUTES.ENVIRONMENTAL_IMPACT,
    element: (
      <LazyRoute>
        <EnvironmentalImpactDashboardPage />
      </LazyRoute>
    )
  },
  {
    path: ROUTES.IMPACT_CALCULATOR,
    element: (
      <LazyRoute>
        <ImpactCalculatorPage />
      </LazyRoute>
    )
  },
  {
    path: ROUTES.SEARCH,
    element: (
      <LazyRoute>
        <SearchResultsPage />
      </LazyRoute>
    )
  },
  {
    path: ROUTES.SUBSCRIPTIONS,
    element: (
      <LazyRoute>
        <SubscriptionsPage />
      </LazyRoute>
    )
  },
  {
    path: ROUTES.QR,
    element: (
      <LazyRoute>
        <QRCodePage />
      </LazyRoute>
    )
  }
]

// Single place where the unified error boundary is attached to a route.
// Every route (top-level and protected children) goes through this helper so
// the error strategy cannot drift between routes.
export function withErrorBoundary<T extends { element?: React.ReactNode }>(
  route: T
): T & { errorElement: React.ReactNode } {
  return { ...route, errorElement: <RouteErrorBoundary /> }
}

export const router = createBrowserRouter([
  withErrorBoundary({ path: ROUTES.ROOT, element: <Navigate to={ROUTES.LOGIN} replace /> }),
  withErrorBoundary({ path: ROUTES.LOGIN, element: <LoginPage /> }),
  withErrorBoundary({ path: ROUTES.ROOT, element: <LandingPage /> }),
  withErrorBoundary({
    element: <ProtectedLayout />,
    children: PROTECTED_ROUTES.map((route) => withErrorBoundary(route))
  }),
  withErrorBoundary({ path: ROUTES.NOT_FOUND, element: <NotFoundPage /> })
])
