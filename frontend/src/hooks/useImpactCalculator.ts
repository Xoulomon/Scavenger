import { useMemo } from 'react'
import { useParticipantWastes } from '@/hooks/useParticipantWastes'
import {
  calculateImpact,
  calculateEquivalents,
  buildShareText,
  ImpactResult,
  Equivalents
} from '@/lib/impactCalculator'

export interface ImpactCalculatorData {
  impact: ImpactResult
  equivalents: Equivalents
  shareText: string
  isLoading: boolean
  isError: boolean
}

export function useImpactCalculator(): ImpactCalculatorData {
  const { wastes, isLoading, isError } = useParticipantWastes({ isActive: true })

  const impact = useMemo(() => calculateImpact(wastes), [wastes])
  const equivalents = useMemo(() => calculateEquivalents(impact), [impact])
  const shareText = useMemo(() => buildShareText(impact, equivalents), [impact, equivalents])

  return { impact, equivalents, shareText, isLoading, isError }
}
