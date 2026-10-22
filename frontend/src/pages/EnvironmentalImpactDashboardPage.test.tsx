import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EnvironmentalImpactDashboardPage } from './EnvironmentalImpactDashboardPage'

vi.mock('@/hooks/useAppTitle', () => ({ useAppTitle: vi.fn() }))

vi.mock('@/hooks/useImpactCalculator', () => ({
  useImpactCalculator: vi.fn(() => ({
    impact: { co2Kg: 0, energyKwh: 0, waterLitres: 0, treesEquivalent: 0 },
    equivalents: {
      carKm: 0,
      smartphoneCharges: 0,
      showerMinutes: 0,
      lightbulbHours: 0,
    },
    shareText: '',
    isLoading: false,
    isError: false,
  })),
}))

describe('EnvironmentalImpactDashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the Environmental Impact Dashboard heading', () => {
    render(<EnvironmentalImpactDashboardPage />)
    expect(
      screen.getByText('Environmental Impact Dashboard')
    ).toBeInTheDocument()
  })

  it('renders the empty state when there is no impact data', () => {
    render(<EnvironmentalImpactDashboardPage />)
    expect(screen.getByText('No impact data yet')).toBeInTheDocument()
  })
})
