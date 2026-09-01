import { useState, useEffect } from 'react'

export type UserRole = 'Recycler' | 'Collector' | 'Manufacturer' | 'Admin'

export interface OnboardingState {
  completed: boolean
  skipped: boolean
  currentStep: number
  role: UserRole | null
}

const ONBOARDING_STORAGE_KEY = 'scavenger-onboarding'

export function useOnboarding() {
  const [state, setState] = useState<OnboardingState>({
    completed: false,
    skipped: false,
    currentStep: 0,
    role: null,
  })

  // Load onboarding state from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(ONBOARDING_STORAGE_KEY)
    if (stored) {
      try {
        const parsedState = JSON.parse(stored)
        setState(parsedState)
      } catch (error) {
        console.warn('Failed to parse onboarding state from localStorage:', error)
      }
    }
  }, [])

  // Save state to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(state))
  }, [state])

  const startOnboarding = (role: UserRole) => {
    setState(prev => ({
      ...prev,
      role,
      completed: false,
      skipped: false,
      currentStep: 0,
    }))
  }

  const completeOnboarding = () => {
    setState(prev => ({
      ...prev,
      completed: true,
      currentStep: 0,
    }))
  }

  const skipOnboarding = () => {
    setState(prev => ({
      ...prev,
      skipped: true,
      currentStep: 0,
    }))
  }

  const updateStep = (step: number) => {
    setState(prev => ({
      ...prev,
      currentStep: step,
    }))
  }

  const resetOnboarding = () => {
    setState({
      completed: false,
      skipped: false,
      currentStep: 0,
      role: null,
    })
    localStorage.removeItem(ONBOARDING_STORAGE_KEY)
  }

  const shouldShowOnboarding = (userRole: UserRole | null): boolean => {
    if (!userRole) return false
    if (state.completed || state.skipped) return false
    if (state.role !== userRole) return true // Show if role changed
    return !state.completed && !state.skipped
  }

  return {
    state,
    startOnboarding,
    completeOnboarding,
    skipOnboarding,
    updateStep,
    resetOnboarding,
    shouldShowOnboarding,
  }
}
