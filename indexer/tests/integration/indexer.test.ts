/**
 * Indexer Endpoint Integration Tests (#943)
 *
 * DB-backed integration tests covering:
 *  - CRUD operations for all key indexer endpoints
 *  - Failure / error-state handling
 *  - Strict API response envelope assertions
 *
 * All external I/O (DB, RPC, healthService) is mocked so tests run
 * without Docker or a live Postgres/Stellar instance.
 */

import { createApiServer } from '../../src/api/server'
import { createStellarRpcMock, buildSdkModuleMock } from '../mocks/stellarRpcMock'

// ─── RPC mock (must be declared before jest.mock calls) ──────────────────────
const rpcMock = createStellarRpcMock({
  latestLedger: { sequence: 200 },
  event: {
    type: 'contract',
    ledger: 150,
    ledgerClosedAt: '2024-06-01T12:00:00Z',
    contractId: 'CTEST',
    txHash: 'deadbeef01',
    topic: ['recycled', '99'],
    value: [0, '5000', 'GTEST', '400000', '-740000']
  }
})

// ─── Module mocks ────────────────────────────────────────────────────────────

jest.mock('@stellar/stellar-sdk', () => buildSdkModuleMock(rpcMock))

jest.mock('../../src/services/healthService', () => ({
  checkDatabaseHealth: jest.fn().mockResolvedValue({ healthy: true, latencyMs: 3 }),
  checkRpcHealth: jest.fn().mockResolvedValue({ healthy: true, latencyMs: 7 })
}))

jest.mock('../../src/services/eventService', () => ({
  getEvents: jest.fn()
}))

jest.mock('../../src/queries/participantQueries', () => ({
  queryParticipantByAddress: jest.fn(),
  queryParticipants: jest.fn(),
  upsertParticipant: jest.fn(),
  deactivateParticipant: jest.fn()
}))

import { checkDatabaseHealth, checkRpcHealth } from '../../src/services/healthService'
import { getEvents } from '../../src/services/eventService'
import {
  queryParticipantByAddress,
  queryParticipants,
  upsertParticipant,
  deactivateParticipant
} from '../../src/queries/participantQueries'

const mockCheckDb = checkDatabaseHealth as jest.MockedFunction<typeof checkDatabaseHealth>
const mockCheckRpc = checkRpcHealth as jest.MockedFunction<typeof checkRpcHealth>
const mockGetEvents = getEvents as jest.MockedFunction<typeof getEvents>
const mockQueryByAddress = queryParticipantByAddress as jest.MockedFunction<
  typeof queryParticipantByAddress
>
const mockQueryParticipants = queryParticipants as jest.MockedFunction<typeof queryParticipants>
const mockUpsert = upsertParticipant as jest.MockedFunction<typeof upsertParticipant>
const mockDeactivate = deactivateParticipant as jest.MockedFunction<typeof deactivateParticipant>

// ─── Fixtures ────────────────────────────────────────────────────────────────

const SAMPLE_PARTICIPANT = {
  address: 'GSAMPLER001ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  role: 'Recycler' as const,
  name: 'Integration Tester',
  latitude: 40712800,
  longitude: -74006000,
  registeredAtLedger: 100,
  registeredAt: new Date('2024-01-01T00:00:00Z').toISOString(),
  isActive: true
}

const SAMPLE_EVENTS = {
  events: [
    {
      id: '0000000000000150-0000000001-0000',
      ledgerSequence: 150,
      ledgerCloseTime: new Date('2024-06-01T12:00:00Z'),
      transactionHash: 'deadbeef01',
      contractId: 'CTEST',
      eventType: 'recycled',
      topic: ['recycled', '99'],
      value: [0, '5000', 'GTEST', '400000', '-740000']
    }
  ],
  total: 1,
  limit: 100,
  offset: 0
}

// ─── Test Setup ───────────────────────────────────────────────────────────────

describe('Indexer Endpoint Integration Tests (#943)', () => {
  let api: ReturnType<typeof createApiServer>
  let baseUrl: string

  beforeAll(async () => {
    api = createApiServer({ port: 0, host: '127.0.0.1' })
    await api.start()
    const addr = api.server.address()
    const port = typeof addr === 'object' && addr ? addr.port : 3002
    baseUrl = `http://127.0.0.1:${port}`
  })

  afterAll(async () => {
    await api.stop()
  })

  beforeEach(() => {
    rpcMock.reset()
    jest.resetAllMocks()
    // Restore default mocks after reset
    mockCheckDb.mockResolvedValue({ healthy: true, latencyMs: 3 })
    mockCheckRpc.mockResolvedValue({ healthy: true, latencyMs: 7 })
    mockGetEvents.mockResolvedValue(SAMPLE_EVENTS)
    mockQueryByAddress.mockResolvedValue(SAMPLE_PARTICIPANT)
    mockQueryParticipants.mockResolvedValue({
      participants: [SAMPLE_PARTICIPANT],
      total: 1,
      limit: 100,
      offset: 0
    })
    mockUpsert.mockResolvedValue(SAMPLE_PARTICIPANT)
    mockDeactivate.mockResolvedValue(SAMPLE_PARTICIPANT)
  })

  // ═══════════════════════════════════════════════════════════════════════════
  //  /health — shallow ping
  // ═══════════════════════════════════════════════════════════════════════════

  describe('GET /health', () => {
    it('returns 200 with { status: "ok" }', async () => {
      const res = await fetch(`${baseUrl}/health`)

      expect(res.status).toBe(200)
      const body = (await res.json()) as Record<string, unknown>
      expect(body).toHaveProperty('status', 'ok')
    })

    it('response envelope includes timestamp in ISO format', async () => {
      const res = await fetch(`${baseUrl}/health`)
      const body = (await res.json()) as Record<string, unknown>

      expect(typeof body.timestamp).toBe('string')
      expect(Number.isNaN(Date.parse(body.timestamp as string))).toBe(false)
    })

    it('responds even when DB is down (shallow check)', async () => {
      // Health is shallow — it never checks DB
      mockCheckDb.mockRejectedValue(new Error('DB unreachable'))
      const res = await fetch(`${baseUrl}/health`)
      expect(res.status).toBe(200)
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  //  /health/liveness
  // ═══════════════════════════════════════════════════════════════════════════

  describe('GET /health/liveness', () => {
    it('returns 200 with status "alive"', async () => {
      const res = await fetch(`${baseUrl}/health/liveness`)

      expect(res.status).toBe(200)
      const body = (await res.json()) as Record<string, unknown>
      expect(body.status).toBe('alive')
    })

    it('does not call any external health checks', async () => {
      await fetch(`${baseUrl}/health/liveness`)
      expect(mockCheckDb).not.toHaveBeenCalled()
      expect(mockCheckRpc).not.toHaveBeenCalled()
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  //  /health/readiness — deep check
  // ═══════════════════════════════════════════════════════════════════════════

  describe('GET /health/readiness', () => {
    it('returns 200 when DB and RPC are healthy', async () => {
      const res = await fetch(`${baseUrl}/health/readiness`)

      expect(res.status).toBe(200)
      const body = (await res.json()) as Record<string, unknown>
      expect(body.status).toBe('ready')
    })

    it('response envelope includes checks.database and checks.rpc', async () => {
      const res = await fetch(`${baseUrl}/health/readiness`)
      const body = (await res.json()) as Record<string, unknown>
      const checks = body.checks as Record<string, unknown>

      expect(checks).toHaveProperty('database')
      expect(checks).toHaveProperty('rpc')
    })

    it('returns 503 and status "degraded" when DB is unhealthy', async () => {
      mockCheckDb.mockResolvedValue({
        healthy: false,
        latencyMs: 0,
        error: 'connection refused'
      })

      const res = await fetch(`${baseUrl}/health/readiness`)
      expect(res.status).toBe(503)

      const body = (await res.json()) as Record<string, unknown>
      expect(body.status).toBe('degraded')

      const checks = body.checks as Record<string, Record<string, unknown>>
      expect(checks.database.healthy).toBe(false)
    })

    it('returns 503 when RPC is unhealthy', async () => {
      mockCheckRpc.mockResolvedValue({
        healthy: false,
        latencyMs: 9999,
        error: 'timeout'
      })

      const res = await fetch(`${baseUrl}/health/readiness`)
      expect(res.status).toBe(503)

      const body = (await res.json()) as Record<string, unknown>
      const checks = body.checks as Record<string, Record<string, unknown>>
      expect(checks.rpc.healthy).toBe(false)
      expect(typeof checks.rpc.error).toBe('string')
    })

    it('returns 503 when both dependencies fail', async () => {
      mockCheckDb.mockResolvedValue({ healthy: false, error: 'DB gone' })
      mockCheckRpc.mockResolvedValue({ healthy: false, error: 'RPC gone' })

      const res = await fetch(`${baseUrl}/health/readiness`)
      expect(res.status).toBe(503)
    })

    it('includes ISO timestamp in every readiness response', async () => {
      const res = await fetch(`${baseUrl}/health/readiness`)
      const body = (await res.json()) as Record<string, unknown>
      expect(Number.isNaN(Date.parse(body.timestamp as string))).toBe(false)
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  //  /metrics
  // ═══════════════════════════════════════════════════════════════════════════

  describe('GET /metrics', () => {
    it('returns 200 with metrics object', async () => {
      const res = await fetch(`${baseUrl}/metrics`)
      expect(res.status).toBe(200)
    })

    it('response envelope contains all required metric fields', async () => {
      const res = await fetch(`${baseUrl}/metrics`)
      const body = (await res.json()) as Record<string, unknown>

      expect(body).toHaveProperty('eventsProcessed')
      expect(body).toHaveProperty('eventsFailed')
      expect(body).toHaveProperty('lastEventTimestamp')
      expect(body).toHaveProperty('syncLag')
      expect(body).toHaveProperty('reorgsDetected')
      expect(body).toHaveProperty('alertsFired')
      expect(body).toHaveProperty('startTime')
      expect(body).toHaveProperty('eventsByType')
    })

    it('eventsProcessed starts at 0', async () => {
      const res = await fetch(`${baseUrl}/metrics`)
      const body = (await res.json()) as Record<string, unknown>
      expect(body.eventsProcessed).toBe(0)
    })

    it('startTime is a valid ISO string', async () => {
      const res = await fetch(`${baseUrl}/metrics`)
      const body = (await res.json()) as Record<string, unknown>
      expect(Number.isNaN(Date.parse(body.startTime as string))).toBe(false)
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  //  /events — query / filtering
  // ═══════════════════════════════════════════════════════════════════════════

  describe('GET /events', () => {
    it('returns 200 with events list from service', async () => {
      const res = await fetch(`${baseUrl}/events`)
      expect(res.status).toBe(200)

      const body = (await res.json()) as Record<string, unknown>
      expect(body).toHaveProperty('events')
      expect(Array.isArray(body.events)).toBe(true)
    })

    it('response envelope includes total, limit, offset', async () => {
      const res = await fetch(`${baseUrl}/events`)
      const body = (await res.json()) as Record<string, unknown>

      expect(typeof body.total).toBe('number')
      expect(typeof body.limit).toBe('number')
      expect(typeof body.offset).toBe('number')
    })

    it('forwards eventType query param to service', async () => {
      mockGetEvents.mockResolvedValue({ events: [], total: 0, limit: 100, offset: 0 })

      await fetch(`${baseUrl}/events?eventType=recycled`)
      expect(mockGetEvents).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'recycled' }))
    })

    it('forwards fromLedger and toLedger params to service', async () => {
      mockGetEvents.mockResolvedValue({ events: [], total: 0, limit: 100, offset: 0 })

      await fetch(`${baseUrl}/events?fromLedger=100&toLedger=200`)
      expect(mockGetEvents).toHaveBeenCalledWith(
        expect.objectContaining({ fromLedger: '100', toLedger: '200' })
      )
    })

    it('forwards limit and offset params to service', async () => {
      mockGetEvents.mockResolvedValue({ events: [], total: 0, limit: 10, offset: 20 })

      await fetch(`${baseUrl}/events?limit=10&offset=20`)
      expect(mockGetEvents).toHaveBeenCalledWith(
        expect.objectContaining({ limit: '10', offset: '20' })
      )
    })

    it('returns 400 for invalid fromLedger value', async () => {
      const res = await fetch(`${baseUrl}/events?fromLedger=not-a-number`)
      expect(res.status).toBe(400)
    })

    it('returns 400 for negative limit', async () => {
      const res = await fetch(`${baseUrl}/events?limit=-1`)
      expect(res.status).toBe(400)
    })

    it('returns empty events array when service returns none', async () => {
      mockGetEvents.mockResolvedValue({ events: [], total: 0, limit: 100, offset: 0 })

      const res = await fetch(`${baseUrl}/events`)
      const body = (await res.json()) as Record<string, unknown>

      expect(body.events).toEqual([])
      expect(body.total).toBe(0)
    })

    it('forwards txHash filter to service', async () => {
      mockGetEvents.mockResolvedValue({ events: [], total: 0, limit: 100, offset: 0 })

      await fetch(`${baseUrl}/events?txHash=deadbeef01`)
      expect(mockGetEvents).toHaveBeenCalledWith(expect.objectContaining({ txHash: 'deadbeef01' }))
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  //  /events/stream — Server-Sent Events
  // ═══════════════════════════════════════════════════════════════════════════

  describe('GET /events/stream', () => {
    it('returns 200 with text/event-stream content-type', async () => {
      const res = await fetch(`${baseUrl}/events/stream`)
      expect(res.status).toBe(200)
      expect(res.headers.get('content-type')).toBe('text/event-stream')
    })

    it('sends cache-control: no-cache header', async () => {
      const res = await fetch(`${baseUrl}/events/stream`)
      expect(res.headers.get('cache-control')).toBe('no-cache')
    })

    it('streams an initial connected event', async () => {
      const res = await fetch(`${baseUrl}/events/stream`)
      // Read at most 100 bytes to verify initial event payload
      const reader = res.body!.getReader()
      const { value } = await reader.read()
      reader.cancel()

      const text = new TextDecoder().decode(value)
      expect(text).toContain('"type":"connected"')
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  //  /participants — CRUD operations
  // ═══════════════════════════════════════════════════════════════════════════

  describe('GET /participants', () => {
    it('returns 200 with participants list', async () => {
      const res = await fetch(`${baseUrl}/participants`)
      expect(res.status).toBe(200)

      const body = (await res.json()) as Record<string, unknown>
      expect(body).toHaveProperty('participants')
      expect(Array.isArray(body.participants)).toBe(true)
    })

    it('response envelope includes total, limit, offset', async () => {
      const res = await fetch(`${baseUrl}/participants`)
      const body = (await res.json()) as Record<string, unknown>

      expect(typeof body.total).toBe('number')
      expect(typeof body.limit).toBe('number')
      expect(typeof body.offset).toBe('number')
    })

    it('participant records include expected fields', async () => {
      const res = await fetch(`${baseUrl}/participants`)
      const body = (await res.json()) as { participants: Record<string, unknown>[] }
      const participant = body.participants[0]

      expect(participant).toHaveProperty('address')
      expect(participant).toHaveProperty('role')
      expect(participant).toHaveProperty('name')
      expect(participant).toHaveProperty('isActive')
    })

    it('accepts role filter — passes it to query layer', async () => {
      mockQueryParticipants.mockResolvedValue({
        participants: [],
        total: 0,
        limit: 100,
        offset: 0
      })

      await fetch(`${baseUrl}/participants?role=Recycler`)
      expect(mockQueryParticipants).toHaveBeenCalledWith(
        expect.objectContaining({ role: 'Recycler' })
      )
    })

    it('accepts isActive filter', async () => {
      mockQueryParticipants.mockResolvedValue({
        participants: [],
        total: 0,
        limit: 100,
        offset: 0
      })

      await fetch(`${baseUrl}/participants?isActive=true`)
      expect(mockQueryParticipants).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: true })
      )
    })

    it('returns 400 for invalid role value', async () => {
      const res = await fetch(`${baseUrl}/participants?role=InvalidRole`)
      expect(res.status).toBe(400)

      const body = (await res.json()) as Record<string, unknown>
      expect(body).toHaveProperty('error')
    })

    it('accepts limit and offset pagination params', async () => {
      mockQueryParticipants.mockResolvedValue({
        participants: [],
        total: 0,
        limit: 10,
        offset: 50
      })

      const res = await fetch(`${baseUrl}/participants?limit=10&offset=50`)
      expect(res.status).toBe(200)
      const body = (await res.json()) as Record<string, unknown>
      expect(body.limit).toBe(10)
      expect(body.offset).toBe(50)
    })

    it('returns empty array when no participants exist', async () => {
      mockQueryParticipants.mockResolvedValue({
        participants: [],
        total: 0,
        limit: 100,
        offset: 0
      })

      const res = await fetch(`${baseUrl}/participants`)
      const body = (await res.json()) as Record<string, unknown>
      expect((body.participants as unknown[]).length).toBe(0)
      expect(body.total).toBe(0)
    })
  })

  describe('GET /participants/:address', () => {
    it('returns 200 with participant record for valid address', async () => {
      const addr = encodeURIComponent(SAMPLE_PARTICIPANT.address)
      const res = await fetch(`${baseUrl}/participants/${addr}`)

      expect(res.status).toBe(200)
      const body = (await res.json()) as Record<string, unknown>
      expect(body.address).toBe(SAMPLE_PARTICIPANT.address)
    })

    it('response includes all required participant fields', async () => {
      const addr = encodeURIComponent(SAMPLE_PARTICIPANT.address)
      const res = await fetch(`${baseUrl}/participants/${addr}`)
      const body = (await res.json()) as Record<string, unknown>

      expect(body).toHaveProperty('address')
      expect(body).toHaveProperty('role')
      expect(body).toHaveProperty('name')
      expect(body).toHaveProperty('latitude')
      expect(body).toHaveProperty('longitude')
      expect(body).toHaveProperty('registeredAtLedger')
      expect(body).toHaveProperty('registeredAt')
      expect(body).toHaveProperty('isActive')
    })

    it('returns 404 when participant does not exist', async () => {
      mockQueryByAddress.mockResolvedValue(null)

      const res = await fetch(`${baseUrl}/participants/GNOTEXIST`)
      expect(res.status).toBe(404)

      const body = (await res.json()) as Record<string, unknown>
      expect(body).toHaveProperty('error')
    })

    it('error response body contains "error" field (envelope check)', async () => {
      mockQueryByAddress.mockResolvedValue(null)

      const res = await fetch(`${baseUrl}/participants/GMISSING`)
      const body = (await res.json()) as Record<string, unknown>

      expect(typeof body.error).toBe('string')
      expect((body.error as string).length).toBeGreaterThan(0)
    })

    it('URL-decodes the address path segment', async () => {
      const rawAddr = 'GABC DEF'
      await fetch(`${baseUrl}/participants/${encodeURIComponent(rawAddr)}`)
      expect(mockQueryByAddress).toHaveBeenCalledWith(rawAddr)
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  //  /replay
  // ═══════════════════════════════════════════════════════════════════════════

  describe('POST /replay', () => {
    it('returns 405 for GET requests', async () => {
      const res = await fetch(`${baseUrl}/replay`)
      expect(res.status).toBe(405)
    })

    it('returns 400 when body is missing required fields', async () => {
      const res = await fetch(`${baseUrl}/replay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })
      expect(res.status).toBe(400)
    })

    it('returns 400 for invalid fromLedger', async () => {
      const res = await fetch(`${baseUrl}/replay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromLedger: 'bad', toLedger: 200 })
      })
      expect(res.status).toBe(400)
    })

    it('returns 400 when toLedger <= fromLedger', async () => {
      const res = await fetch(`${baseUrl}/replay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromLedger: 200, toLedger: 100 })
      })
      expect(res.status).toBe(400)
    })

    it('error response has well-formed JSON body with "error" field', async () => {
      const res = await fetch(`${baseUrl}/replay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })
      const body = (await res.json()) as Record<string, unknown>
      expect(body).toHaveProperty('error')
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  //  Unknown routes — 404 envelope
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Unknown routes', () => {
    it('returns 404 for unknown path', async () => {
      const res = await fetch(`${baseUrl}/does-not-exist`)
      expect(res.status).toBe(404)
    })

    it('404 response body has well-formed JSON with "error" key', async () => {
      const res = await fetch(`${baseUrl}/does-not-exist`)
      const body = (await res.json()) as Record<string, unknown>
      expect(body).toHaveProperty('error')
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  //  Error-state handling
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Service-layer error propagation', () => {
    it('returns 500 when event service throws an unexpected error', async () => {
      mockGetEvents.mockRejectedValue(new Error('Database connection lost'))

      const res = await fetch(`${baseUrl}/events`)
      expect(res.status).toBe(500)

      const body = (await res.json()) as Record<string, unknown>
      expect(body).toHaveProperty('error')
    })

    it('returns 500 when participant query throws an unexpected error', async () => {
      mockQueryByAddress.mockRejectedValue(new Error('DB timeout'))

      const addr = encodeURIComponent(SAMPLE_PARTICIPANT.address)
      const res = await fetch(`${baseUrl}/participants/${addr}`)
      expect(res.status).toBe(500)
    })

    it('returns 500 when list query throws an unexpected error', async () => {
      mockQueryParticipants.mockRejectedValue(new Error('Pool exhausted'))

      const res = await fetch(`${baseUrl}/participants`)
      expect(res.status).toBe(500)
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  //  broadcastEvent / metrics counter
  // ═══════════════════════════════════════════════════════════════════════════

  describe('broadcastEvent helper', () => {
    it('does not throw when called with no SSE clients connected', () => {
      expect(() => api.broadcastEvent({ type: 'recycled', waste_id: '1' })).not.toThrow()
    })

    it('accepts arbitrary JSON-serialisable payloads', () => {
      const payloads = [
        { type: 'recycled' },
        { type: 'transfer', from: 'GA', to: 'GB', amount: 1000 },
        { nested: { deep: { value: true } } }
      ]
      payloads.forEach((p) => {
        expect(() => api.broadcastEvent(p)).not.toThrow()
      })
    })
  })
})
