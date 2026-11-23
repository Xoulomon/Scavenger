import { describe, it, expect, beforeEach } from 'vitest'
import { bundleMonitor } from './bundleMonitor'

describe('Bundle Monitor', () => {
  beforeEach(() => {
    bundleMonitor.clearMetrics()
  })

  it('should record bundle metrics', () => {
    const chunks = { 'main.js': 50000, 'vendor.js': 100000 }
    bundleMonitor.recordMetrics(150000, chunks)
    expect(bundleMonitor.getMetrics().length).toBe(1)
  })

  it('should track largest chunks', () => {
    const chunks = {
      'main.js': 50000,
      'vendor.js': 100000,
      'ui.js': 75000
    }
    bundleMonitor.recordMetrics(225000, chunks)
    const latest = bundleMonitor.getLatestMetrics()
    expect(latest?.largestChunks[0].name).toBe('vendor.js')
    expect(latest?.largestChunks[0].size).toBe(100000)
  })

  it('should check bundle size threshold', () => {
    bundleMonitor.recordMetrics(500000, {})
    expect(bundleMonitor.checkThreshold(400000)).toBe(true)
    expect(bundleMonitor.checkThreshold(600000)).toBe(false)
  })

  it('should clear metrics', () => {
    bundleMonitor.recordMetrics(150000, {})
    expect(bundleMonitor.getMetrics().length).toBe(1)
    bundleMonitor.clearMetrics()
    expect(bundleMonitor.getMetrics().length).toBe(0)
  })

  it('should return null when no metrics recorded', () => {
    expect(bundleMonitor.getLatestMetrics()).toBeNull()
  })
})
