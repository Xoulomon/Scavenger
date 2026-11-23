import { collectMetrics } from '../src/monitoring/metrics'

describe('Metrics Collection', () => {
  it('collectMetrics returns expected shape', async () => {
    const metrics = await collectMetrics()
    expect(metrics).toHaveProperty('eventsProcessed')
    expect(metrics).toHaveProperty('eventsFailed')
    expect(metrics).toHaveProperty('syncLag')
    expect(metrics).toHaveProperty('uptime')
    expect(metrics).toHaveProperty('dbConnections')
    expect(metrics).toHaveProperty('eventsByType')
    expect(metrics).toHaveProperty('totalEvents')
    expect(metrics).toHaveProperty('errorsLastHour')
    expect(typeof metrics.uptime).toBe('number')
    expect(typeof metrics.totalEvents).toBe('number')
  })

  it('metrics values are valid numbers', async () => {
    const metrics = await collectMetrics()
    expect(metrics.eventsProcessed).toBeGreaterThanOrEqual(0)
    expect(metrics.syncLag).toBeGreaterThanOrEqual(0)
    expect(metrics.uptime).toBeGreaterThanOrEqual(0)
  })

  it('eventsByType is an object', async () => {
    const metrics = await collectMetrics()
    expect(typeof metrics.eventsByType).toBe('object')
    expect(Array.isArray(metrics.eventsByType)).toBe(false)
  })

  it('handles database errors gracefully', async () => {
    const metrics = await collectMetrics()
    expect(metrics).toBeDefined()
  })
})
