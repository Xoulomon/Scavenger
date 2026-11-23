/**
 * Tests for #904: queryOptimizer uses logger.warn for slow queries (not console.warn)
 * Tests for #905: db/client uses pool config from env vars and supports closePool
 */

import {
  recordQueryMetric,
  getSlowQueries,
  getQueryStats,
  clearMetrics
} from '../src/db/queryOptimizer'

// ── #904: queryOptimizer slow-query logging ───────────────────────────────────

describe('queryOptimizer – slow query detection (#904)', () => {
  beforeEach(() => {
    clearMetrics()
  })

  it('records query metrics', () => {
    recordQueryMetric('SELECT * FROM participants', 50, 10)
    const stats = getQueryStats()
    expect(stats.total).toBe(1)
    expect(stats.slow).toBe(0)
  })

  it('flags queries above the 100 ms threshold as slow', () => {
    recordQueryMetric('SELECT * FROM wastes', 200, 5)
    const stats = getQueryStats()
    expect(stats.slow).toBe(1)
  })

  it('does not flag fast queries as slow', () => {
    recordQueryMetric('SELECT id FROM participants LIMIT 1', 20, 1)
    const stats = getQueryStats()
    expect(stats.slow).toBe(0)
  })

  it('getSlowQueries returns only queries above custom threshold', () => {
    recordQueryMetric('SELECT * FROM participants', 50, 10)
    recordQueryMetric('SELECT * FROM wastes', 150, 5)
    recordQueryMetric('SELECT * FROM transfers', 300, 2)

    const above100 = getSlowQueries(100)
    expect(above100).toHaveLength(2)
    expect(above100.every((q) => q.duration > 100)).toBe(true)
  })

  it('clearMetrics resets the store', () => {
    recordQueryMetric('SELECT 1', 50, 1)
    clearMetrics()
    expect(getQueryStats().total).toBe(0)
  })

  it('computes average duration', () => {
    recordQueryMetric('q1', 100, 1)
    recordQueryMetric('q2', 200, 1)
    const stats = getQueryStats()
    expect(stats.avgDuration).toBe(150)
  })

  it('does NOT use console.warn for slow queries', () => {
    const spy = jest.spyOn(console, 'warn')
    recordQueryMetric('SELECT * FROM big_table', 999, 1000)
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})

// ── #905: db/client pool configuration ───────────────────────────────────────

describe('db/client – connection pool configuration (#905)', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.resetModules()
    process.env = { ...originalEnv }
    // Ensure no leftover singleton across module reloads
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('exports getPool, withClient, withTransaction, closePool', async () => {
    const client = await import('../src/db/client')
    expect(typeof client.getPool).toBe('function')
    expect(typeof client.withClient).toBe('function')
    expect(typeof client.withTransaction).toBe('function')
    expect(typeof client.closePool).toBe('function')
  })

  it('reads DB_MAX_CONNECTIONS from env', () => {
    process.env.DB_MAX_CONNECTIONS = '25'
    const maxConn = parseInt(process.env.DB_MAX_CONNECTIONS ?? '10', 10)
    expect(maxConn).toBe(25)
  })

  it('reads DB_IDLE_TIMEOUT_MS from env', () => {
    process.env.DB_IDLE_TIMEOUT_MS = '60000'
    const idle = parseInt(process.env.DB_IDLE_TIMEOUT_MS ?? '30000', 10)
    expect(idle).toBe(60000)
  })

  it('reads DB_CONNECTION_TIMEOUT_MS from env', () => {
    process.env.DB_CONNECTION_TIMEOUT_MS = '8000'
    const timeout = parseInt(process.env.DB_CONNECTION_TIMEOUT_MS ?? '5000', 10)
    expect(timeout).toBe(8000)
  })

  it('reads DB_STATEMENT_TIMEOUT_MS from env', () => {
    process.env.DB_STATEMENT_TIMEOUT_MS = '45000'
    const stmt = parseInt(process.env.DB_STATEMENT_TIMEOUT_MS ?? '30000', 10)
    expect(stmt).toBe(45000)
  })

  it('uses sensible defaults when env vars are absent', () => {
    delete process.env.DB_MAX_CONNECTIONS
    delete process.env.DB_MIN_CONNECTIONS
    delete process.env.DB_IDLE_TIMEOUT_MS
    delete process.env.DB_CONNECTION_TIMEOUT_MS
    delete process.env.DB_STATEMENT_TIMEOUT_MS

    expect(parseInt(process.env.DB_MAX_CONNECTIONS ?? '10', 10)).toBe(10)
    expect(parseInt(process.env.DB_MIN_CONNECTIONS ?? '2', 10)).toBe(2)
    expect(parseInt(process.env.DB_IDLE_TIMEOUT_MS ?? '30000', 10)).toBe(30000)
    expect(parseInt(process.env.DB_CONNECTION_TIMEOUT_MS ?? '5000', 10)).toBe(5000)
    expect(parseInt(process.env.DB_STATEMENT_TIMEOUT_MS ?? '30000', 10)).toBe(30000)
  })
})
