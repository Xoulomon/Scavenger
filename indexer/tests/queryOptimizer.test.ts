import { describe, it, expect, beforeEach } from 'vitest'
import { recordQueryMetric, getSlowQueries, clearMetrics } from '../src/db/queryOptimizer'

describe('Query Optimizer', () => {
  beforeEach(() => {
    clearMetrics()
  })

  it('should record query metrics', () => {
    recordQueryMetric('SELECT * FROM participants', 50, 10)
    recordQueryMetric('SELECT * FROM wastes', 150, 5)

    const slowQueries = getSlowQueries(100)
    expect(slowQueries).toHaveLength(1)
    expect(slowQueries[0].duration).toBe(150)
  })

  it('should identify slow queries above threshold', () => {
    recordQueryMetric('SELECT * FROM participants', 50, 10)
    recordQueryMetric('SELECT * FROM wastes', 200, 5)
    recordQueryMetric('SELECT * FROM transfers', 300, 2)

    const slowQueries = getSlowQueries(100)
    expect(slowQueries).toHaveLength(2)
    expect(slowQueries.every((q) => q.duration > 100)).toBe(true)
  })

  it('should clear metrics', () => {
    recordQueryMetric('SELECT * FROM participants', 50, 10)
    clearMetrics()

    const slowQueries = getSlowQueries()
    expect(slowQueries).toHaveLength(0)
  })
})
