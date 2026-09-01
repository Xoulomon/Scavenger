import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { renderHook, act } from '@testing-library/react'
import { useOnboarding } from '@/hooks/useOnboarding'
import { getOnboardingSteps } from '@/lib/onboardingSteps'
import { OnboardingTutorial } from '@/components/OnboardingTutorial'

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
})

describe('Onboarding Functionality', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorageMock.getItem.mockReturnValue(null)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('useOnboarding', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => useOnboarding())

      expect(result.current.state).toEqual({
        completed: false,
        skipped: false,
        currentStep: 0,
        role: null,
      })
    })

    it('should load state from localStorage on mount', () => {
      const storedState = {
        completed: true,
        skipped: false,
        currentStep: 5,
        role: 'Recycler' as const,
      }
      localStorageMock.getItem.mockReturnValue(JSON.stringify(storedState))

      const { result } = renderHook(() => useOnboarding())

      expect(result.current.state).toEqual(storedState)
    })

    it('should start onboarding with role', () => {
      const { result } = renderHook(() => useOnboarding())

      act(() => {
        result.current.startOnboarding('Collector')
      })

      expect(result.current.state).toEqual({
        completed: false,
        skipped: false,
        currentStep: 0,
        role: 'Collector',
      })
      expect(localStorageMock.setItem).toHaveBeenCalled()
    })

    it('should complete onboarding', () => {
      const { result } = renderHook(() => useOnboarding())

      act(() => {
        result.current.startOnboarding('Recycler')
        result.current.completeOnboarding()
      })

      expect(result.current.state.completed).toBe(true)
      expect(result.current.state.currentStep).toBe(0)
    })

    it('should skip onboarding', () => {
      const { result } = renderHook(() => useOnboarding())

      act(() => {
        result.current.skipOnboarding()
      })

      expect(result.current.state.skipped).toBe(true)
    })

    it('should update current step', () => {
      const { result } = renderHook(() => useOnboarding())

      act(() => {
        result.current.updateStep(3)
      })

      expect(result.current.state.currentStep).toBe(3)
    })

    it('should reset onboarding', () => {
      const { result } = renderHook(() => useOnboarding())

      act(() => {
        result.current.startOnboarding('Manufacturer')
        result.current.resetOnboarding()
      })

      expect(result.current.state).toEqual({
        completed: false,
        skipped: false,
        currentStep: 0,
        role: null,
      })
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('scavenger-onboarding')
    })

    it('should determine when to show onboarding', () => {
      const { result } = renderHook(() => useOnboarding())

      // Should show for new user
      expect(result.current.shouldShowOnboarding('Recycler')).toBe(true)

      act(() => {
        result.current.startOnboarding('Recycler')
        result.current.completeOnboarding()
      })

      // Should not show after completion
      expect(result.current.shouldShowOnboarding('Recycler')).toBe(false)

      // Should show if role changes
      expect(result.current.shouldShowOnboarding('Collector')).toBe(true)
    })
  })

  describe('getOnboardingSteps', () => {
    it('should return steps for Recycler role', () => {
      const steps = getOnboardingSteps('Recycler')

      expect(steps.length).toBeGreaterThan(5)
      expect(steps[0].content).toContain('Welcome to Scavenger')
      expect(steps.some(step => step.target === '[data-onboarding="submit-waste"]')).toBe(true)
    })

    it('should return steps for Collector role', () => {
      const steps = getOnboardingSteps('Collector')

      expect(steps.length).toBeGreaterThan(5)
      expect(steps.some(step => step.target === '[data-onboarding="collect"]')).toBe(true)
      expect(steps.some(step => step.target === '[data-onboarding="verify"]')).toBe(true)
    })

    it('should return steps for Manufacturer role', () => {
      const steps = getOnboardingSteps('Manufacturer')

      expect(steps.length).toBeGreaterThan(5)
      expect(steps.some(step => step.target === '[data-onboarding="manufacturer-dashboard"]')).toBe(true)
      expect(steps.some(step => step.target === '[data-onboarding="analytics"]')).toBe(true)
    })

    it('should return steps for Admin role', () => {
      const steps = getOnboardingSteps('Admin')

      expect(steps.length).toBeGreaterThan(5)
      expect(steps.some(step => step.target === '[data-onboarding="admin-dashboard"]')).toBe(true)
    })

    it('should include common steps for all roles', () => {
      const recyclerSteps = getOnboardingSteps('Recycler')
      const collectorSteps = getOnboardingSteps('Collector')

      expect(recyclerSteps.some(step => step.target === '[data-onboarding="sidebar"]')).toBe(true)
      expect(collectorSteps.some(step => step.target === '[data-onboarding="search"]')).toBe(true)
    })
  })

  describe('OnboardingTutorial', () => {
    it('should show welcome dialog when visible and not completed', () => {
      render(
        <OnboardingTutorial
          userRole="Recycler"
          isVisible={true}
          onComplete={() => {}}
        />
      )

      expect(screen.getByText('Welcome to Scavenger!')).toBeInTheDocument()
      expect(screen.getByText('Start Tour')).toBeInTheDocument()
      expect(screen.getByText('Skip Tutorial')).toBeInTheDocument()
    })

    it('should not show dialog when not visible', () => {
      render(
        <OnboardingTutorial
          userRole="Recycler"
          isVisible={false}
          onComplete={() => {}}
        />
      )

      expect(screen.queryByText('Welcome to Scavenger!')).not.toBeInTheDocument()
    })

    it('should handle "Don\'t show again" checkbox', () => {
      render(
        <OnboardingTutorial
          userRole="Recycler"
          isVisible={true}
          onComplete={() => {}}
        />
      )

      const checkbox = screen.getByLabelText("Don't show this again")
      expect(checkbox).not.toBeChecked()

      fireEvent.click(checkbox)
      expect(checkbox).toBeChecked()
    })

    it('should call onComplete when skipping tutorial', () => {
      const onComplete = vi.fn()

      render(
        <OnboardingTutorial
          userRole="Recycler"
          isVisible={true}
          onComplete={onComplete}
        />
      )

      const skipButton = screen.getByText('Skip Tutorial')
      fireEvent.click(skipButton)

      expect(onComplete).toHaveBeenCalled()
    })

    it('should start tutorial when clicking Start Tour', () => {
      render(
        <OnboardingTutorial
          userRole="Recycler"
          isVisible={true}
          onComplete={() => {}}
        />
      )

      const startButton = screen.getByText('Start Tour')
      fireEvent.click(startButton)

      // Dialog should close
      expect(screen.queryByText('Welcome to Scavenger!')).not.toBeInTheDocument()
    })
  })

  describe('Integration Tests', () => {
    it('should handle complete onboarding flow', async () => {
      const onComplete = vi.fn()

      // Mock onboarding hook to return initial state
      vi.mock('@/hooks/useOnboarding', () => ({
        useOnboarding: () => ({
          state: {
            completed: false,
            skipped: false,
            currentStep: 0,
            role: null,
          },
          startOnboarding: vi.fn(),
          completeOnboarding: vi.fn(),
          skipOnboarding: vi.fn(),
          updateStep: vi.fn(),
        }),
      }))

      render(
        <OnboardingTutorial
          userRole="Recycler"
          isVisible={true}
          onComplete={onComplete}
        />
      )

      // Start tutorial
      const startButton = screen.getByText('Start Tour')
      fireEvent.click(startButton)

      // Tutorial should be running (we can't easily test Joyride steps in unit tests)
      // but the dialog should be closed
      await waitFor(() => {
        expect(screen.queryByText('Welcome to Scavenger!')).not.toBeInTheDocument()
      })
    })

    it('should persist onboarding state to localStorage', () => {
      const { result } = renderHook(() => useOnboarding())

      act(() => {
        result.current.startOnboarding('Collector')
      })

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'scavenger-onboarding',
        JSON.stringify({
          completed: false,
          skipped: false,
          currentStep: 0,
          role: 'Collector',
        })
      )
    })
  })
})
