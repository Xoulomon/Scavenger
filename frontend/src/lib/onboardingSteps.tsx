import { Step } from 'react-joyride'
import { UserRole } from '@/hooks/useOnboarding'

export const getOnboardingSteps = (role: UserRole): Step[] => {
  const baseSteps: Step[] = [
    {
      target: 'body',
      content: (
        <div className="text-center">
          <h2 className="text-xl font-bold mb-2">Welcome to Scavenger! 🎉</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Let's take a quick tour to help you get started with waste tracking and recycling.
          </p>
          <div className="text-xs text-muted-foreground">
            You can skip this tutorial anytime and restart it from Settings.
          </div>
        </div>
      ),
      placement: 'center',
      disableBeacon: true,
    },
    {
      target: '[data-onboarding="sidebar"]',
      content: (
        <div>
          <h3 className="font-semibold mb-2">Navigation Sidebar</h3>
          <p className="text-sm text-muted-foreground">
            This sidebar contains all the main features of the app. Each role has different available options.
          </p>
        </div>
      ),
      placement: 'right',
    },
    {
      target: '[data-onboarding="search"]',
      content: (
        <div>
          <h3 className="font-semibold mb-2">Search & Filter</h3>
          <p className="text-sm text-muted-foreground">
            Use the search bar to quickly find wastes, participants, or any data in the system.
          </p>
        </div>
      ),
      placement: 'bottom',
    },
  ]

  const roleSpecificSteps: Record<UserRole, Step[]> = {
    Recycler: [
      {
        target: '[data-onboarding="submit-waste"]',
        content: (
          <div>
            <h3 className="font-semibold mb-2">Submit Waste</h3>
            <p className="text-sm text-muted-foreground">
              As a recycler, you can submit waste materials here. Include photos, descriptions, and quantities.
            </p>
          </div>
        ),
        placement: 'right',
      },
      {
        target: '[data-onboarding="my-wastes"]',
        content: (
          <div>
            <h3 className="font-semibold mb-2">My Wastes</h3>
            <p className="text-sm text-muted-foreground">
              Track all your submitted wastes, their status, and transfer history.
            </p>
          </div>
        ),
        placement: 'right',
      },
      {
        target: '[data-onboarding="incentives"]',
        content: (
          <div>
            <h3 className="font-semibold mb-2">Incentives Marketplace</h3>
            <p className="text-sm text-muted-foreground">
              Browse and claim incentives offered by manufacturers for recycling specific materials.
            </p>
          </div>
        ),
        placement: 'right',
      },
    ],
    Collector: [
      {
        target: '[data-onboarding="collect"]',
        content: (
          <div>
            <h3 className="font-semibold mb-2">Collection Dashboard</h3>
            <p className="text-sm text-muted-foreground">
              As a collector, manage your collection routes and pick up wastes from recyclers.
            </p>
          </div>
        ),
        placement: 'right',
      },
      {
        target: '[data-onboarding="verify"]',
        content: (
          <div>
            <h3 className="font-semibold mb-2">Verification</h3>
            <p className="text-sm text-muted-foreground">
              Verify waste submissions and ensure quality standards are met before processing.
            </p>
          </div>
        ),
        placement: 'right',
      },
      {
        target: '[data-onboarding="waste-map"]',
        content: (
          <div>
            <h3 className="font-semibold mb-2">Waste Map</h3>
            <p className="text-sm text-muted-foreground">
              View waste locations on the map to optimize your collection routes.
            </p>
          </div>
        ),
        placement: 'right',
      },
    ],
    Manufacturer: [
      {
        target: '[data-onboarding="manufacturer-dashboard"]',
        content: (
          <div>
            <h3 className="font-semibold mb-2">Manufacturer Dashboard</h3>
            <p className="text-sm text-muted-foreground">
              Monitor your supply chain, track material usage, and manage incentives.
            </p>
          </div>
        ),
        placement: 'right',
      },
      {
        target: '[data-onboarding="incentives"]',
        content: (
          <div>
            <h3 className="font-semibold mb-2">Create Incentives</h3>
            <p className="text-sm text-muted-foreground">
              Offer incentives to recyclers for collecting specific materials you need.
            </p>
          </div>
        ),
        placement: 'right',
      },
      {
        target: '[data-onboarding="analytics"]',
        content: (
          <div>
            <h3 className="font-semibold mb-2">Analytics</h3>
            <p className="text-sm text-muted-foreground">
              View detailed analytics about material usage, recycling rates, and supply chain performance.
            </p>
          </div>
        ),
        placement: 'right',
      },
    ],
    Admin: [
      {
        target: '[data-onboarding="admin-dashboard"]',
        content: (
          <div>
            <h3 className="font-semibold mb-2">Admin Dashboard</h3>
            <p className="text-sm text-muted-foreground">
              Oversee the entire platform, manage users, and monitor system performance.
            </p>
          </div>
        ),
        placement: 'right',
      },
      {
        target: '[data-onboarding="analytics"]',
        content: (
          <div>
            <h3 className="font-semibold mb-2">System Analytics</h3>
            <p className="text-sm text-muted-foreground">
              Monitor platform-wide statistics, user activity, and environmental impact.
            </p>
          </div>
        ),
        placement: 'right',
      },
      {
        target: '[data-onboarding="waste-map"]',
        content: (
          <div>
            <h3 className="font-semibold mb-2">Global Waste Map</h3>
            <p className="text-sm text-muted-foreground">
              View all waste activities across the platform on an interactive map.
            </p>
          </div>
        ),
        placement: 'right',
      },
    ],
  }

  const finalStep: Step = {
    target: 'body',
    content: (
      <div className="text-center">
        <h2 className="text-xl font-bold mb-2">You're all set! 🚀</h2>
        <p className="text-sm text-muted-foreground mb-4">
          You've completed the onboarding tutorial. Start exploring the platform and making an impact!
        </p>
        <div className="text-xs text-muted-foreground">
          You can always restart this tutorial from Settings if needed.
        </div>
      </div>
    ),
    placement: 'center',
  }

  return [...baseSteps, ...roleSpecificSteps[role], finalStep]
}

export const getOnboardingStyles = () => ({
  options: {
    primaryColor: '#000000',
    textColor: '#333333',
    backgroundColor: '#ffffff',
    overlayColor: 'rgba(0, 0, 0, 0.5)',
    spotlightShadow: '0 0 15px rgba(0, 0, 0, 0.5)',
    beaconSize: 36,
    zIndex: 100,
  },
  tooltip: {
    borderRadius: 8,
    fontSize: 14,
  },
  tooltipContainer: {
    textAlign: 'left' as const,
  },
  buttonNext: {
    backgroundColor: '#000000',
    fontSize: 14,
    borderRadius: 6,
    padding: '8px 16px',
  },
  buttonBack: {
    color: '#666666',
    fontSize: 14,
    marginLeft: 'auto',
    marginRight: 8,
  },
  buttonSkip: {
    color: '#666666',
    fontSize: 14,
  },
  buttonClose: {
    height: 14,
    width: 14,
  },
})