import type { PropsWithChildren } from 'react'
import { NavLink } from 'react-router-dom'
import {
  Home,
  Package,
  PlusCircle,
  Truck,
  Factory,
  Gift,
  ArrowRightLeft,
  History,
  Wallet,
  LogOut,
  Recycle,
  Map,
  ShieldAlert,
  ShieldCheck,
  User,
  ShoppingBag,
  Award,
  BookOpen,
  CalendarDays,
  Heart,
  TrendingUp,
  Trophy,
  WifiOff,
  Bell,
  Upload,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useWallet } from '@/context/WalletContext'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/Button'
import { NotificationBell } from '@/components/ui/NotificationBell'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { SearchBar } from '@/components/ui/SearchBar'
import { OfflineIndicator } from '@/components/OfflineIndicator'
import { OnboardingTutorial, useOnboardingTutorial } from '@/components/OnboardingTutorial'
import { UserRole } from '@/hooks/useOnboarding'

const NAV_LINKS = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    roles: ['Recycler', 'Collector', 'Manufacturer'],
    icon: Home
  },
  {
    label: 'My Wastes',
    href: '/wastes',
    roles: ['Recycler', 'Collector', 'Manufacturer'],
    icon: Package
  },
  { label: 'Submit Waste', href: '/submit', roles: ['Recycler'], icon: PlusCircle },
  { label: 'Collect', href: '/collect', roles: ['Collector'], icon: Truck },
  { label: 'My Dashboard', href: '/manufacturer', roles: ['Manufacturer'], icon: Factory },
  {
    label: 'Incentives',
    href: '/incentives',
    roles: ['Recycler', 'Collector', 'Manufacturer'],
    icon: Gift
  },
  { label: 'Transfer', href: '/transfer', roles: ['Recycler', 'Collector'], icon: ArrowRightLeft },
  {
    label: 'History',
    href: '/history',
    roles: ['Recycler', 'Collector', 'Manufacturer'],
    icon: History
  },
  {
    label: 'Waste Map',
    href: '/map',
    roles: ['Recycler', 'Collector', 'Manufacturer'],
    icon: Map
  },
  {
    label: 'Verify',
    href: '/verify',
    roles: ['Collector'],
    icon: ShieldCheck
  },
  {
    label: 'Admin',
    href: '/admin',
    roles: ['Admin'],
    icon: ShieldAlert
  },
  {
    label: 'Marketplace',
    href: '/marketplace',
    roles: ['Recycler', 'Collector', 'Manufacturer'],
    icon: ShoppingBag
  },
  {
    label: 'Certifications',
    href: '/certifications',
    roles: ['Recycler', 'Collector', 'Manufacturer'],
    icon: Award
  },
  {
    label: 'Recycling Guide',
    href: '/recycling-guide',
    roles: ['Recycler', 'Collector', 'Manufacturer'],
    icon: BookOpen
  },
  {
    label: 'Subscriptions',
    href: '/subscriptions',
    roles: ['Recycler', 'Collector', 'Manufacturer'],
    icon: CalendarDays
  },
  {
    label: 'Donations',
    href: '/donations',
    roles: ['Recycler', 'Collector', 'Manufacturer'],
    icon: Heart
  },
  {
    label: 'Predictions',
    href: '/predictions',
    roles: ['Recycler', 'Collector', 'Manufacturer'],
    icon: TrendingUp
  },
  {
    label: 'Achievements',
    href: '/achievements',
    roles: ['Recycler', 'Collector', 'Manufacturer'],
    icon: Trophy
  },
  {
    label: 'Notifications',
    href: '/notifications',
    roles: ['Recycler', 'Collector', 'Manufacturer'],
    icon: Bell
  },
  {
    label: 'Batch Upload',
    href: '/batch-upload',
    roles: ['Recycler', 'Collector'],
    icon: Upload
  },
  {
    label: 'Offline',
    href: '/offline',
    roles: ['Recycler', 'Collector', 'Manufacturer'],
    icon: WifiOff
  }
]

function truncate(addr: string) {
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`
}

function getOnboardingDataAttribute(href: string): string | undefined {
  const attributeMap: Record<string, string> = {
    '/dashboard': 'dashboard',
    '/submit': 'submit-waste',
    '/collect': 'collect',
    '/manufacturer': 'manufacturer-dashboard',
    '/incentives': 'incentives',
    '/transfer': 'transfer',
    '/wastes': 'my-wastes',
    '/map': 'waste-map',
    '/verify': 'verify',
    '/analytics': 'analytics',
    '/admin': 'admin-dashboard',
    '/marketplace': 'marketplace',
    '/certifications': 'certifications',
    '/recycling-guide': 'recycling-guide',
    '/subscriptions': 'subscriptions',
    '/donations': 'donations',
    '/predictions': 'predictions',
    '/achievements': 'achievements',
    '/notifications': 'notifications',
    '/batch-upload': 'batch-upload',
    '/offline': 'offline',
  }
  return attributeMap[href]
}

export function AppShell({ children }: PropsWithChildren) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { address, isConnected, connect, isLoading } = useWallet()
  const { address, isConnected, connect, disconnect, isLoading } = useWallet()
  const { user, logout } = useAuth()
  const { isVisible, hideTutorial } = useOnboardingTutorial((user?.role as UserRole | undefined) ?? null)

  const role = user?.role ?? ''
  const links = NAV_LINKS.filter((l) => !role || l.roles.includes(role))

  const Sidebar = (
    <nav className="flex flex-col gap-1 p-4" data-onboarding="sidebar" aria-label="Main navigation">
      <div className="mb-4 flex items-center gap-2 px-2">
        <Recycle className="h-6 w-6 text-primary" aria-hidden="true" />
        <span className="text-lg font-bold">Scavngr</span>
      </div>
      {links.map((link) => {
        const Icon = link.icon
        return (
          <NavLink
            key={link.href}
            to={link.href}
            data-onboarding={getOnboardingDataAttribute(link.href)}
            className={({ isActive }) =>
              cn(
                'flex min-h-11 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground',
                isActive ? 'bg-accent text-accent-foreground' : 'text-foreground'
              )
            }
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            {link.label}
          </NavLink>
        )
      })}
      {user && (
        <button
          onClick={() => {
            logout()
          }}
          aria-label="Sign out"
          className="mt-auto flex min-h-11 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-destructive transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          Sign out
        </button>
      )}
    </nav>
  )

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Skip to main content link for keyboard users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:ring-2 focus:ring-ring"
      >
        Skip to main content
      </a>

      {/* Desktop sidebar */}
      <aside className="hidden w-56 shrink-0 border-r md:flex md:flex-col">{Sidebar}</aside>

      <div className="flex flex-1 flex-col">
        {/* Header */}
        <header className="flex h-14 items-center justify-between border-b px-4">
          <span className="text-sm font-medium md:hidden">Scavngr</span>

          <div className="mx-4 hidden flex-1 md:flex" data-onboarding="search">
            <SearchBar />
          </div>

          <div className="ml-auto flex items-center gap-3">
            <NotificationBell />
            <ThemeToggle className="shrink-0" />

            {isConnected && address ? (
              <div className="flex items-center gap-2">
                <span className="hidden items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium sm:flex">
                  <Wallet className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                  <span aria-label={`Connected wallet: ${address}`}>{truncate(address)}</span>
                </span>
                <Button variant="ghost" size="sm" onClick={logout}>
                <Button variant="ghost" size="sm" onClick={disconnect} aria-label="Disconnect wallet">
                  Disconnect
                </Button>
              </div>
            ) : (
              <Button size="sm" onClick={connect} disabled={isLoading} aria-label="Connect wallet">
                {isLoading ? 'Connecting…' : 'Connect Wallet'}
              </Button>
            )}
          </div>
        </header>

        <OfflineIndicator />
        <main id="main-content" className={cn('flex-1 overflow-x-hidden p-4 pb-20 sm:p-6 sm:pb-6')}>{children}</main>
      </div>

      {/* Mobile bottom navigation */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden"
        aria-label="Mobile navigation"
      >
        <div className="flex min-h-16 items-center justify-around gap-1 px-2 py-1">
          {links.filter((l) => l.href !== '/profile').slice(0, 4).map((link) => {
            const Icon = link.icon
            return (
              <NavLink
                key={link.href}
                to={link.href}
                className={({ isActive }) =>
                  cn(
                    'flex min-h-12 min-w-[3.5rem] flex-1 flex-col items-center justify-center rounded-md px-2 py-1 text-[10px] font-medium transition-colors',
                    isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'
                  )
                }
              >
                <Icon className="mb-0.5 h-5 w-5" aria-hidden="true" />
                <span className="truncate">{link.label}</span>
              </NavLink>
            )
          })}
          <NavLink
            to="/profile"
            className={({ isActive }) =>
              cn(
                'flex min-h-12 min-w-[3.5rem] flex-1 flex-col items-center justify-center rounded-md px-2 py-1 text-[10px] font-medium transition-colors',
                isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'
              )
            }
          >
            <User className="mb-0.5 h-5 w-5" aria-hidden="true" />
            <span className="truncate">Profile</span>
          </NavLink>
        </div>
      </nav>

      {/* Onboarding Tutorial */}
      <OnboardingTutorial
        userRole={(user?.role as UserRole | undefined) ?? null}
        isVisible={isVisible}
        onComplete={hideTutorial}
      />
    </div>
  )
}
