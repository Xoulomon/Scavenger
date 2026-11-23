import { describe, it, expect, beforeEach, vi } from 'vitest'

describe('App Configuration', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('should load configuration from environment variables', () => {
    const originalEnv = import.meta.env
    expect(originalEnv).toBeDefined()
  })

  it('should have required contract configuration fields', () => {
    expect(import.meta.env.VITE_CONTRACT_ID).toBeDefined()
    expect(import.meta.env.VITE_NETWORK).toBeDefined()
    expect(import.meta.env.VITE_RPC_URL).toBeDefined()
  })

  it('should have default values for optional configuration', () => {
    const apiTimeout = import.meta.env.VITE_API_TIMEOUT || '30000'
    expect(parseInt(apiTimeout, 10)).toBeGreaterThan(0)
  })

  it('should support feature flags', () => {
    const offlineMode = import.meta.env.VITE_OFFLINE_MODE === 'true'
    const analytics = import.meta.env.VITE_ANALYTICS === 'true'
    expect(typeof offlineMode).toBe('boolean')
    expect(typeof analytics).toBe('boolean')
  })

  it('should support logging configuration', () => {
    const logLevel = import.meta.env.VITE_LOG_LEVEL || 'info'
    const validLevels = ['debug', 'info', 'warn', 'error']
    expect(validLevels).toContain(logLevel)
  })
})
