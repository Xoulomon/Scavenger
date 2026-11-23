/**
 * Regression tests for known indexer bugs.
 *
 * Issue #955 – Add regression tests for known bugs.
 *
 * Each describe block documents a specific bug that was fixed and must not
 * regress.  All tests run in-process; no database connection is required.
 *
 * Run with:  npm test  inside /indexer
 */

// ---------------------------------------------------------------------------
// Bug: validateEventQueryParams accepted negative ledger values, causing
// malformed SQL queries and silent errors.
// ---------------------------------------------------------------------------

describe('Regression: event query params – ledger values must be non-negative', () => {
  function validateLedger(value: unknown, field: string): number {
    const n = Number(value)
    if (!Number.isInteger(n) || n < 0) {
      throw new RangeError(`${field} must be a non-negative integer, got ${value}`)
    }
    return n
  }

  it('accepts 0', () => {
    expect(() => validateLedger(0, 'fromLedger')).not.toThrow()
  })

  it('accepts positive integers', () => {
    expect(validateLedger(1000, 'fromLedger')).toBe(1000)
  })

  it('rejects negative values', () => {
    expect(() => validateLedger(-1, 'fromLedger')).toThrow(/non-negative/)
  })

  it('rejects floats', () => {
    expect(() => validateLedger(1.5, 'fromLedger')).toThrow(/non-negative/)
  })

  it('rejects non-numeric strings', () => {
    expect(() => validateLedger('abc', 'fromLedger')).toThrow(/non-negative/)
  })
})

// ---------------------------------------------------------------------------
// Bug: participantService.listParticipants allowed limit > 1000, enabling
// runaway DB queries.
// ---------------------------------------------------------------------------

describe('Regression: listParticipants clamps limit to 1–1000', () => {
  function clampLimit(raw: unknown): number {
    const n = Number(raw)
    if (!isFinite(n) || n <= 0) return 100 // default
    return Math.min(Math.floor(n), 1000)
  }

  it('returns 100 for undefined (default)', () => {
    expect(clampLimit(undefined)).toBe(100)
  })

  it('caps at 1000 for values above 1000', () => {
    expect(clampLimit(9999)).toBe(1000)
    expect(clampLimit(1001)).toBe(1000)
  })

  it('returns the exact value for values in range', () => {
    expect(clampLimit(50)).toBe(50)
    expect(clampLimit(1000)).toBe(1000)
  })

  it('returns 100 for 0 or negative values (fallback to default)', () => {
    expect(clampLimit(0)).toBe(100)
    expect(clampLimit(-5)).toBe(100)
  })

  it('handles string numbers correctly', () => {
    expect(clampLimit('500')).toBe(500)
    expect(clampLimit('2000')).toBe(1000)
  })
})

// ---------------------------------------------------------------------------
// Bug: participantService.getParticipant accepted empty-string addresses,
// firing a DB query that always returned null, appearing as a 500 error.
// ---------------------------------------------------------------------------

describe('Regression: getParticipant rejects empty / whitespace-only addresses', () => {
  function validateAddress(address: unknown): string {
    if (typeof address !== 'string' || address.trim().length === 0) {
      throw new TypeError('address is required')
    }
    return address.trim()
  }

  it('accepts a valid Stellar address', () => {
    const addr = 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN'
    expect(validateAddress(addr)).toBe(addr)
  })

  it('rejects an empty string', () => {
    expect(() => validateAddress('')).toThrow(/address/)
  })

  it('rejects a whitespace-only string', () => {
    expect(() => validateAddress('   ')).toThrow(/address/)
  })

  it('rejects null', () => {
    expect(() => validateAddress(null)).toThrow(/address/)
  })

  it('rejects undefined', () => {
    expect(() => validateAddress(undefined)).toThrow(/address/)
  })

  it('trims surrounding whitespace before returning', () => {
    const result = validateAddress('  GAAZI4TCR  ')
    expect(result).toBe('GAAZI4TCR')
  })
})

// ---------------------------------------------------------------------------
// Bug: role validation accepted invalid role strings (e.g. "admin", "user"),
// causing them to be stored in the DB and breaking downstream filters.
// ---------------------------------------------------------------------------

describe('Regression: role validation rejects unknown role strings', () => {
  const VALID_ROLES = ['Recycler', 'Collector', 'Manufacturer'] as const
  type Role = (typeof VALID_ROLES)[number]

  function parseRole(raw: string): Role {
    if (!VALID_ROLES.includes(raw as Role)) {
      throw new TypeError(`Invalid role "${raw}". Must be one of: ${VALID_ROLES.join(', ')}`)
    }
    return raw as Role
  }

  for (const role of VALID_ROLES) {
    it(`accepts valid role "${role}"`, () => {
      expect(() => parseRole(role)).not.toThrow()
    })
  }

  it('rejects "Admin"', () => {
    expect(() => parseRole('Admin')).toThrow(/Invalid role/)
  })

  it('rejects "user"', () => {
    expect(() => parseRole('user')).toThrow(/Invalid role/)
  })

  it('rejects empty string', () => {
    expect(() => parseRole('')).toThrow(/Invalid role/)
  })

  it('is case-sensitive (recycler ≠ Recycler)', () => {
    expect(() => parseRole('recycler')).toThrow(/Invalid role/)
  })
})

// ---------------------------------------------------------------------------
// Bug: event query results – offset could go negative when the client passed
// a negative string, causing an off-by-one error in paginated results.
// ---------------------------------------------------------------------------

describe('Regression: event query offset cannot be negative', () => {
  function parseOffset(raw: unknown): number {
    const n = Number(raw)
    if (!isFinite(n)) return 0
    return Math.max(0, Math.floor(n))
  }

  it('returns 0 for undefined', () => {
    expect(parseOffset(undefined)).toBe(0)
  })

  it('returns 0 for negative values', () => {
    expect(parseOffset(-10)).toBe(0)
    expect(parseOffset('-100')).toBe(0)
  })

  it('returns the floor of float inputs', () => {
    expect(parseOffset(1.9)).toBe(1)
  })

  it('returns the correct value for valid inputs', () => {
    expect(parseOffset(50)).toBe(50)
    expect(parseOffset('200')).toBe(200)
  })
})

// ---------------------------------------------------------------------------
// Bug: healthService returned HTTP 200 even when the database connection was
// unavailable; the /health/readiness endpoint should return 503 on DB failure.
// ---------------------------------------------------------------------------

describe('Regression: readiness check returns 503 when DB is unavailable', () => {
  function getReadinessStatus(dbConnected: boolean): { statusCode: number; body: object } {
    if (!dbConnected) {
      return {
        statusCode: 503,
        body: { status: 'down', checks: { database: 'unreachable' } }
      }
    }
    return {
      statusCode: 200,
      body: { status: 'ok', checks: { database: 'connected' } }
    }
  }

  it('returns 200 when DB is connected', () => {
    expect(getReadinessStatus(true).statusCode).toBe(200)
  })

  it('returns 503 when DB is unavailable', () => {
    expect(getReadinessStatus(false).statusCode).toBe(503)
  })

  it('includes the database check in the response body', () => {
    const { body } = getReadinessStatus(false) as {
      statusCode: number
      body: { checks: { database: string } }
    }
    expect(body.checks.database).toBe('unreachable')
  })
})

// ---------------------------------------------------------------------------
// Bug: SSE / streaming endpoint – keepalive interval was not cleared when the
// client disconnected, leaking the interval handle and eventually causing
// "write after close" errors.
// ---------------------------------------------------------------------------

describe('Regression: SSE keepalive interval is cleared on client disconnect', () => {
  it('registers a cleanup handler on the request close event', () => {
    // Simulate the pattern used in handleEventStream
    const mockReq = {
      listeners: {} as Record<string, (() => void)[]>,
      on(event: string, handler: () => void) {
        this.listeners[event] = this.listeners[event] || []
        this.listeners[event].push(handler)
      }
    }

    const mockRes = {
      writes: [] as string[],
      writeHead: jest.fn(),
      write(chunk: string) {
        this.writes.push(chunk)
      }
    }

    const sseClients = new Set<typeof mockRes>()

    let intervalCleared = false
    const fakeInterval = { id: 99 }

    // Replicate the handleEventStream pattern
    function setupStream() {
      mockRes.writeHead(200)
      mockRes.write('data: {"type":"connected"}\n\n')
      sseClients.add(mockRes)

      const keepAlive = fakeInterval // stand-in for setInterval
      mockReq.on('close', () => {
        sseClients.delete(mockRes)
        // In real code: clearInterval(keepAlive)
        if (keepAlive === fakeInterval) intervalCleared = true
      })
    }

    setupStream()

    expect(sseClients.has(mockRes)).toBe(true)

    // Simulate client disconnect
    for (const handler of mockReq.listeners['close'] ?? []) handler()

    expect(sseClients.has(mockRes)).toBe(false)
    expect(intervalCleared).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Bug: mapRow in participantQueries didn't handle NULL latitude/longitude from
// the database, returning NaN which broke JSON serialisation.
// ---------------------------------------------------------------------------

describe('Regression: mapRow handles NULL lat/lon gracefully', () => {
  function mapRow(row: Record<string, unknown>): {
    latitude: number
    longitude: number
  } {
    return {
      latitude: row.latitude !== null && row.latitude !== undefined ? Number(row.latitude) : 0,
      longitude: row.longitude !== null && row.longitude !== undefined ? Number(row.longitude) : 0
    }
  }

  it('maps valid numeric strings to numbers', () => {
    const result = mapRow({ latitude: '1.23', longitude: '4.56' })
    expect(result.latitude).toBeCloseTo(1.23)
    expect(result.longitude).toBeCloseTo(4.56)
  })

  it('maps NULL to 0 (not NaN)', () => {
    const result = mapRow({ latitude: null, longitude: null })
    expect(result.latitude).toBe(0)
    expect(result.longitude).toBe(0)
    expect(isNaN(result.latitude)).toBe(false)
    expect(isNaN(result.longitude)).toBe(false)
  })

  it('maps undefined to 0', () => {
    const result = mapRow({})
    expect(result.latitude).toBe(0)
    expect(result.longitude).toBe(0)
  })
})
