import { useMemo } from 'react'
import { Waste, WasteType } from '@/api/types'

export interface DataPoint {
  x: number // time index (0-based)
  y: number // value
}

export interface RegressionResult {
  slope: number
  intercept: number
  r2: number
}

export interface Prediction {
  wasteType: WasteType
  historicalPoints: DataPoint[]
  regression: RegressionResult
  forecastPoints: DataPoint[] // next N periods
  trend: 'up' | 'down' | 'flat'
  confidenceInterval: { lower: number; upper: number }[]
}

export interface OptimalCollectionTime {
  wasteType: WasteType
  suggestedPeriod: string
  reason: string
}

/** Simple OLS linear regression: y = slope * x + intercept */
export function linearRegression(points: DataPoint[]): RegressionResult {
  const n = points.length
  if (n < 2) return { slope: 0, intercept: points[0]?.y ?? 0, r2: 0 }

  const sumX = points.reduce((s, p) => s + p.x, 0)
  const sumY = points.reduce((s, p) => s + p.y, 0)
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0)
  const sumX2 = points.reduce((s, p) => s + p.x * p.x, 0)

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
  const intercept = (sumY - slope * sumX) / n

  const yMean = sumY / n
  const ssTot = points.reduce((s, p) => s + (p.y - yMean) ** 2, 0)
  const ssRes = points.reduce((s, p) => s + (p.y - (slope * p.x + intercept)) ** 2, 0)
  const r2 = ssTot === 0 ? 1 : Math.max(0, 1 - ssRes / ssTot)

  return {
    slope: Math.round(slope * 1000) / 1000,
    intercept: Math.round(intercept * 1000) / 1000,
    r2: Math.round(r2 * 1000) / 1000
  }
}

/** Group wastes by waste type and week, returning volume (kg) per period */
function groupByWeek(wastes: Waste[], type: WasteType): DataPoint[] {
  const filtered = wastes.filter((w) => w.waste_type === type)
  if (filtered.length === 0) return []

  const minTs = Math.min(...filtered.map((w) => w.recycled_timestamp))
  const weekMs = 7 * 24 * 3600

  const buckets = new Map<number, number>()
  for (const w of filtered) {
    const week = Math.floor((w.recycled_timestamp - minTs) / weekMs)
    buckets.set(week, (buckets.get(week) ?? 0) + Number(w.weight) / 1000)
  }

  const maxWeek = Math.max(...buckets.keys())
  return Array.from({ length: maxWeek + 1 }, (_, i) => ({
    x: i,
    y: Math.round((buckets.get(i) ?? 0) * 100) / 100
  }))
}

function computeStdDev(points: DataPoint[], reg: RegressionResult): number {
  if (points.length < 2) return 0
  const residuals = points.map((p) => p.y - (reg.slope * p.x + reg.intercept))
  const mean = residuals.reduce((s, r) => s + r, 0) / residuals.length
  const variance = residuals.reduce((s, r) => s + (r - mean) ** 2, 0) / residuals.length
  return Math.sqrt(variance)
}

const WASTE_TYPES = [
  WasteType.Paper,
  WasteType.PetPlastic,
  WasteType.Plastic,
  WasteType.Metal,
  WasteType.Glass
]
const FORECAST_PERIODS = 4

export function usePredictiveAnalytics(wastes: Waste[]) {
  const predictions = useMemo<Prediction[]>(() => {
    return WASTE_TYPES.map((type) => {
      const historicalPoints = groupByWeek(wastes, type)
      const reg = linearRegression(historicalPoints)
      const stdDev = computeStdDev(historicalPoints, reg)
      const lastX =
        historicalPoints.length > 0 ? historicalPoints[historicalPoints.length - 1].x : 0

      const forecastPoints: DataPoint[] = Array.from({ length: FORECAST_PERIODS }, (_, i) => ({
        x: lastX + i + 1,
        y: Math.max(0, Math.round((reg.slope * (lastX + i + 1) + reg.intercept) * 100) / 100)
      }))

      const confidenceInterval = forecastPoints.map((p) => ({
        lower: Math.max(0, Math.round((p.y - 1.96 * stdDev) * 100) / 100),
        upper: Math.round((p.y + 1.96 * stdDev) * 100) / 100
      }))

      const trend: Prediction['trend'] =
        Math.abs(reg.slope) < 0.01 ? 'flat' : reg.slope > 0 ? 'up' : 'down'

      return {
        wasteType: type,
        historicalPoints,
        regression: reg,
        forecastPoints,
        trend,
        confidenceInterval
      }
    })
  }, [wastes])

  const optimalTimes = useMemo<OptimalCollectionTime[]>(() => {
    return predictions
      .filter((p) => p.historicalPoints.length > 0)
      .map((p) => {
        const bestForecast = p.forecastPoints.reduce(
          (best, cur) => (cur.y > best.y ? cur : best),
          p.forecastPoints[0]
        )
        const period = `Week +${bestForecast?.x - (p.historicalPoints.length > 0 ? p.historicalPoints[p.historicalPoints.length - 1].x : 0)}`
        return {
          wasteType: p.wasteType,
          suggestedPeriod: period,
          reason:
            p.trend === 'up'
              ? 'Volume is increasing'
              : p.trend === 'down'
                ? 'Collect before volume drops further'
                : 'Stable volume'
        }
      })
  }, [predictions])

  return { predictions, optimalTimes }
}
