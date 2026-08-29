import { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { AppShell } from '@/components/layout/AppShell'
import { PageSkeleton } from '@/components/ui/Skeletons'
import { RouteErrorBoundary } from '@/components/RouteErrorBoundary'

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
  import('@/pages/IncentivesMarketplacePage').then((m) => ({ default: m.IncentivesMarketplacePage }))
)
const IncentivesPage = lazy(() =>
  import('@/pages/IncentivesPage').then((m) => ({ default: m.IncentivesPage }))
)
const WasteListPage = lazy(() =>
  import('@/pages/WasteListPage').then((m) => ({ default: m.WasteListPage }))
)
const ManufacturerDashboardPage = lazy(() =>
  import('@/pages/ManufacturerDashboardPage').then((m) => ({
    default: m.ManufacturerDashboardPage,
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
    default: m.PerformanceMonitoringPage,
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
    default: m.WasteVerificationDashboardPage,
  }))
)
const ParticipantRegistrationPage = lazy(() =>
  import('@/pages/ParticipantRegistrationPage').then((m) => ({
    default: m.ParticipantRegistrationPage,
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
    default: m.PlatformHealthDashboardPage,
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
    default: m.EnvironmentalImpactDashboardPage,
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
const QRCodePage = lazy(() =>
  import('@/pages/QRCodePage').then((m) => ({ default: m.QRCodePage }))
)
const OfflineSettings = lazy(() =>
  import('@/pages/OfflineSettings').then((m) => ({ default: m.OfflineSettings }))
)

// ─── Suspense wrapper ─────────────────────────────────────────────────────────
// Wraps the route outlet in a Suspense boundary so every lazy page gets a
// consistent PageSkeleton loading fallback while its chunk is being fetched.

// eslint-disable-next-line react-refresh/only-export-components
function PageFallback() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Outlet />
    </Suspense>
  )
}

// ─── Auth guard ───────────────────────────────────────────────────────────────

// eslint-disable-next-line react-refresh/only-export-components
function ProtectedLayout() {
  const { isAuthenticated, isLoading } = useAuth()
  if (isLoading) return null
  return isAuthenticated ? (
    <AppShell>
      <PageFallback />
    </AppShell>
  ) : (
    <Navigate to="/login" replace />
  )
}

// Each protected page gets its own `errorElement` so a crash on one route
// renders a fallback in place of just that page — the app shell and every
// other route stay unaffected, and navigating away recovers automatically.
const PROTECTED_ROUTES = [
  { path: 'dashboard', element: <HomePage /> },
  { path: 'submit', element: <div>Submit Waste</div> },
  { path: 'collect', element: <CollectorDashboardPage /> },
  { path: 'incentives', element: <IncentivesMarketplacePage /> },
  { path: 'incentives/manage', element: <IncentivesPage /> },
  { path: 'transfer', element: <MaterialTransferPage /> },
  { path: 'history', element: <div>History</div> },
  { path: 'dashboard/recycler', element: <RecyclerDashboard /> },
  { path: 'wastes', element: <WasteListPage /> },
  { path: 'manufacturer', element: <ManufacturerDashboardPage /> },
  { path: 'settings', element: <SettingsPage /> },
  { path: 'settings/offline', element: <OfflineSettings /> },
  { path: 'rewards', element: <RewardsPage /> },
  { path: 'tracker', element: <SupplyChainTrackerPage /> },
  { path: 'community', element: <CommunityPage /> },
  { path: 'governance', element: <GovernancePage /> },
  { path: 'analytics', element: <AnalyticsPage /> },
  { path: 'map', element: <WasteMapPage /> },
  { path: 'admin', element: <AdminDashboardPage /> },
  { path: 'verify', element: <VerificationPage /> },
  { path: 'route-planner', element: <RoutePlannerPage /> },
  { path: 'messages', element: <MessagingPage /> },
  { path: 'compare', element: <WasteComparisonPage /> },
  { path: 'predictions', element: <PredictiveAnalyticsPage /> },
  { path: 'marketplace', element: <WasteMarketplacePage /> },
  { path: 'certifications', element: <WasteCertificationPage /> },
  { path: 'recycling-guide', element: <RecyclingGuidePage /> },
  { path: 'performance', element: <PerformanceMonitoringPage /> },
  { path: 'achievements', element: <GamificationPage /> },
  { path: 'offline', element: <OfflinePage /> },
  { path: 'waste-history', element: <WasteHistoryPage /> },
  { path: 'participant-search', element: <ParticipantSearchPage /> },
  { path: 'waste-statistics', element: <WasteStatisticsPage /> },
  { path: 'reward-tracking', element: <RewardTrackingPage /> },
  { path: 'verification-dashboard', element: <WasteVerificationDashboardPage /> },
  { path: 'register', element: <ParticipantRegistrationPage /> },
  { path: 'test-reports', element: <TestReportsPage /> },
  { path: 'compliance-reports', element: <ComplianceReportsPage /> },
  { path: 'notifications', element: <NotificationCenterPage /> },
  { path: 'batch-upload', element: <BatchUploadPage /> },
  { path: 'feature-flags', element: <FeatureFlagsPage /> },
  { path: 'health', element: <PlatformHealthDashboardPage /> },
  { path: 'slas', element: <PerformanceSLAsPage /> },
  // Previously unrouted pages — wired up with lazy loading
  { path: 'profile', element: <ProfilePage /> },
  { path: 'donations', element: <CharityDonationsPage /> },
  { path: 'environmental-impact', element: <EnvironmentalImpactDashboardPage /> },
  { path: 'impact-calculator', element: <ImpactCalculatorPage /> },
  { path: 'search', element: <SearchResultsPage /> },
  { path: 'subscriptions', element: <SubscriptionsPage /> },
  { path: 'qr', element: <QRCodePage /> },
]

export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/login" replace /> },
  { path: '/login', element: <LoginPage />, errorElement: <RouteErrorBoundary /> },
  { path: '/', element: <LandingPage />, errorElement: <RouteErrorBoundary /> },
  {
    element: <ProtectedLayout />,
    errorElement: <RouteErrorBoundary />,
    children: PROTECTED_ROUTES.map((route) => ({
      ...route,
      errorElement: <RouteErrorBoundary />,
    })),
  },
  { path: '*', element: <NotFoundPage />, errorElement: <RouteErrorBoundary /> },
])
