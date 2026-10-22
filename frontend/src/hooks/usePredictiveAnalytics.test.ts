import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import {
  linearRegression,
  usePredictiveAnalytics,
  DataPoint,
} from '@/hooks/usePredictiveAnalytics'
import { Waste, WasteType } from '@/api/types'

// ── linearRegression tests ────────────────────────────────────────────────────

describe('linearRegression', () => {
  it('returns slope 0 and y-value for single point', () => {
    const result = linearRegression([{ x: 0, y: 5 }])
    expect(result.slope).toBe(0)
    expect(result.intercept).toBe(5)
  })

  it('fits a perfect line y = 2x + 1', () => {
    const points: DataPoint[] = [
      { x: 0, y: 1 },
      { x: 1, y: 3 },
      { x: 2, y: 5 },
      { x: 3, y: 7 },
    ]
    const { slope, intercept, r2 } = linearRegression(points)
    expect(slope).toBeCloseTo(2, 2)
    expect(intercept).toBeCloseTo(1, 2)
    expect(r2).toBeCloseTo(1, 2)
  })

  it('returns r2 = 0 for flat line (no variance)', () => {
    const points: DataPoint[] = [
      { x: 0, y: 3 },
      { x: 1, y: 3 },
      { x: 2, y: 3 },
    ]
    const { r2 } = linearRegression(points)
    expect(r2).toBe(1) // perfect fit for flat line
  })

  it('returns negative slope for decreasing data', () => {
    const points: DataPoint[] = [
      { x: 0, y: 10 },
      { x: 1, y: 8 },
      { x: 2, y: 6 },
    ]
    expect(linearRegression(points).slope).toBeLessThan(0)
  })

  it('r2 is between 0 and 1 for noisy data', () => {
    const points: DataPoint[] = [
      { x: 0, y: 1 },
      { x: 1, y: 5 },
      { x: 2, y: 2 },
      { x: 3, y: 8 },
    ]
    const { r2 } = linearRegression(points)
    expect(r2).toBeGreaterThanOrEqual(0)
    expect(r2).toBeLessThanOrEqual(1)
  })
})

// ── usePredictiveAnalytics hook tests ─────────────────────────────────────────

function makeWaste(overrides: Partial<Waste> = {}): Waste {
  return {
    waste_id: 1n,
    waste_type: WasteType.Paper,
    weight: 1000n,
    current_owner: 'ADDR',
    latitude: 0n,
    longitude: 0n,
    recycled_timestamp: 1700000000,
    is_active: true,
    is_confirmed: false,
    confirmer: '',
    ...overrides,
  }
}

describe('usePredictiveAnalytics', () => {
  it('returns predictions for all 5 waste types', () => {
    const { result } = renderHook(() => usePredictiveAnalytics([]))
    expect(result.current.predictions).toHaveLength(5)
  })

  it('returns empty historicalPoints for types with no data', () => {
    const { result } = renderHook(() => usePredictiveAnalytics([]))
    result.current.predictions.forEach((p) => {
      expect(p.historicalPoints).toHaveLength(0)
    })
  })

  it('groups wastes into weekly buckets', () => {
    const wastes = [
      makeWaste({ waste_id: 1n, recycled_timestamp: 1700000000 }),
      makeWaste({ waste_id: 2n, recycled_timestamp: 1700000000 + 7 * 24 * 3600 }),
    ]
    const { result } = renderHook(() => usePredictiveAnalytics(wastes))
    const paperPred = result.current.predictions.find((p) => p.wasteType === WasteType.Paper)!
    expect(paperPred.historicalPoints.length).toBeGreaterThanOrEqual(2)
  })

  it('produces 4 forecast points', () => {
    const wastes = [makeWaste(), makeWaste({ waste_id: 2n, recycled_timestamp: 1700000000 + 7 * 24 * 3600 })]
    const { result } = renderHook(() => usePredictiveAnalytics(wastes))
    const paperPred = result.current.predictions.find((p) => p.wasteType === WasteType.Paper)!
    expect(paperPred.forecastPoints).toHaveLength(4)
  })

  it('confidence interval has same length as forecast', () => {
    const wastes = [makeWaste(), makeWaste({ waste_id: 2n, recycled_timestamp: 1700000000 + 7 * 24 * 3600 })]
    const { result } = renderHook(() => usePredictiveAnalytics(wastes))
    const paperPred = result.current.predictions.find((p) => p.wasteType === WasteType.Paper)!
    expect(paperPred.confidenceInterval).toHaveLength(4)
  })

  it('trend is flat when slope is near zero', () => {
    // Same weight every week → flat
    const wastes = Array.from({ length: 4 }, (_, i) =>
      makeWaste({ waste_id: BigInt(i), recycled_timestamp: 1700000000 + i * 7 * 24 * 3600 })
    )
    const { result } = renderHook(() => usePredictiveAnalytics(wastes))
    const paperPred = result.current.predictions.find((p) => p.wasteType === WasteType.Paper)!
    expect(paperPred.trend).toBe('flat')
  })

  it('optimalTimes only includes types with data', () => {
    const { result } = renderHook(() => usePredictiveAnalytics([makeWaste()]))
    result.current.optimalTimes.forEach((ot) => {
      const pred = result.current.predictions.find((p) => p.wasteType === ot.wasteType)!
      expect(pred.historicalPoints.length).toBeGreaterThan(0)
    })
  })
})
