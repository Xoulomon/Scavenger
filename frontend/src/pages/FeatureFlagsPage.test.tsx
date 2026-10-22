import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FeatureFlagsPage } from './FeatureFlagsPage'

vi.mock('@/hooks/useFeatureFlags', () => ({
  useFeatureFlags: vi.fn(() => ({
    flags: {},
    values: {},
    overrides: [],
    override: vi.fn(),
    clearOverride: vi.fn(),
    clearAll: vi.fn(),
  })),
}))

vi.mock('@/lib/featureFlags', () => ({
  getFlagAnalytics: vi.fn(() => []),
}))

describe('FeatureFlagsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the Feature Flags heading', () => {
    render(<FeatureFlagsPage />)
    expect(screen.getByText('Feature Flags')).toBeInTheDocument()
  })

  it('renders the All Flags section', () => {
    render(<FeatureFlagsPage />)
    expect(screen.getByText('All Flags')).toBeInTheDocument()
  })

  it('renders the Recent Flag Events section', () => {
    render(<FeatureFlagsPage />)
    expect(screen.getByText('Recent Flag Events')).toBeInTheDocument()
  })
})
