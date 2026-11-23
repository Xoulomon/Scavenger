/**
 * Tests for /health/liveness and /health/readiness endpoints (#798).
 *
 * The readiness check calls checkDatabaseHealth and checkRpcHealth from
 * healthService.  We mock the service so tests never touch real DB/RPC.
 */

import { createApiServer } from '../src/api/server'

// Mock the health service so tests are self-contained
jest.mock('../src/services/healthService', () => ({
  checkDatabaseHealth: jest.fn(),
  checkRpcHealth: jest.fn()
}))

import { checkDatabaseHealth, checkRpcHealth } from '../src/services/healthService'

const mockDbHealth = checkDatabaseHealth as jest.MockedFunction<typeof checkDatabaseHealth>
const mockRpcHealth = checkRpcHealth as jest.MockedFunction<typeof checkRpcHealth>

describe('Health depth levels (#798)', () => {
  let api: ReturnType<typeof createApiServer>
  let baseUrl: string

  beforeAll(async () => {
    api = createApiServer({ port: 0, host: '127.0.0.1' })
    await api.start()
    const address = api.server.address()
    const port = typeof address === 'object' && address ? address.port : 3001
    baseUrl = `http://127.0.0.1:${port}`
  })

  afterAll(async () => {
    await api.stop()
  })

  beforeEach(() => {
    jest.resetAllMocks()
  })

  // ── /health ──────────────────────────────────────────────────────────────

  it('GET /health returns 200 with status ok', async () => {
    const res = await fetch(`${baseUrl}/health`)
    expect(res.status).toBe(200)
    const body = (await res.json()) as Record<string, unknown>
    expect(body.status).toBe('ok')
    expect(typeof body.timestamp).toBe('string')
  })

  // ── /health/liveness ─────────────────────────────────────────────────────

  it('GET /health/liveness returns 200 while process is alive', async () => {
    const res = await fetch(`${baseUrl}/health/liveness`)
    expect(res.status).toBe(200)
    const body = (await res.json()) as Record<string, unknown>
    expect(body.status).toBe('alive')
    expect(typeof body.timestamp).toBe('string')
  })

  it('liveness does not check external dependencies', async () => {
    // Even if DB/RPC mocks would fail, liveness should still return 200
    mockDbHealth.mockRejectedValue(new Error('DB down'))
    mockRpcHealth.mockRejectedValue(new Error('RPC down'))

    const res = await fetch(`${baseUrl}/health/liveness`)
    expect(res.status).toBe(200)
    // mocks should NOT have been called
    expect(mockDbHealth).not.toHaveBeenCalled()
    expect(mockRpcHealth).not.toHaveBeenCalled()
  })

  // ── /health/readiness – all healthy ──────────────────────────────────────

  it('GET /health/readiness returns 200 when DB and RPC are healthy', async () => {
    mockDbHealth.mockResolvedValue({ healthy: true, latencyMs: 5 })
    mockRpcHealth.mockResolvedValue({ healthy: true, latencyMs: 10 })

    const res = await fetch(`${baseUrl}/health/readiness`)
    expect(res.status).toBe(200)

    const body = (await res.json()) as Record<string, unknown>
    expect(body.status).toBe('ready')
    expect(body).toHaveProperty('checks')

    const checks = body.checks as Record<string, unknown>
    expect(checks).toHaveProperty('database')
    expect(checks).toHaveProperty('rpc')

    const db = checks.database as Record<string, unknown>
    expect(db.healthy).toBe(true)
    expect(typeof db.latencyMs).toBe('number')
  })

  // ── /health/readiness – degraded scenarios ────────────────────────────────

  it('GET /health/readiness returns 503 when DB is unhealthy', async () => {
    mockDbHealth.mockResolvedValue({ healthy: false, latencyMs: 1, error: 'connection refused' })
    mockRpcHealth.mockResolvedValue({ healthy: true, latencyMs: 10 })

    const res = await fetch(`${baseUrl}/health/readiness`)
    expect(res.status).toBe(503)

    const body = (await res.json()) as Record<string, unknown>
    expect(body.status).toBe('degraded')

    const checks = body.checks as Record<string, unknown>
    const db = checks.database as Record<string, unknown>
    expect(db.healthy).toBe(false)
    expect(typeof db.error).toBe('string')
  })

  it('GET /health/readiness returns 503 when RPC is unhealthy', async () => {
    mockDbHealth.mockResolvedValue({ healthy: true, latencyMs: 5 })
    mockRpcHealth.mockResolvedValue({ healthy: false, latencyMs: 5001, error: 'timeout' })

    const res = await fetch(`${baseUrl}/health/readiness`)
    expect(res.status).toBe(503)

    const body = (await res.json()) as Record<string, unknown>
    expect(body.status).toBe('degraded')

    const checks = body.checks as Record<string, unknown>
    const rpc = checks.rpc as Record<string, unknown>
    expect(rpc.healthy).toBe(false)
  })

  it('GET /health/readiness returns 503 when both dependencies fail', async () => {
    mockDbHealth.mockResolvedValue({ healthy: false, error: 'DB timeout' })
    mockRpcHealth.mockResolvedValue({ healthy: false, error: 'RPC unreachable' })

    const res = await fetch(`${baseUrl}/health/readiness`)
    expect(res.status).toBe(503)

    const body = (await res.json()) as Record<string, unknown>
    expect(body.status).toBe('degraded')
  })

  it('readiness response always includes timestamp', async () => {
    mockDbHealth.mockResolvedValue({ healthy: true, latencyMs: 2 })
    mockRpcHealth.mockResolvedValue({ healthy: true, latencyMs: 3 })

    const res = await fetch(`${baseUrl}/health/readiness`)
    const body = (await res.json()) as Record<string, unknown>
    expect(typeof body.timestamp).toBe('string')
    // Validate it parses as an ISO date
    expect(Number.isNaN(Date.parse(body.timestamp as string))).toBe(false)
  })
})
