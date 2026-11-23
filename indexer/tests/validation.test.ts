/**
 * Tests for the runtime input validation layer (#796).
 */

import {
  RequestValidationError,
  validateOptionalInt,
  validateOptionalEnum,
  validateRequiredString,
  validateReplayBody,
  validateEventQueryParams
} from '../src/validation'

describe('RequestValidationError', () => {
  it('contains the supplied detail messages', () => {
    const err = new RequestValidationError([{ field: 'foo', message: 'bar' }])
    expect(err.details).toHaveLength(1)
    expect(err.details[0]).toEqual({ field: 'foo', message: 'bar' })
  })

  it('toResponse includes error string and details array', () => {
    const err = new RequestValidationError([{ field: 'x', message: 'required' }])
    const resp = err.toResponse()
    expect(typeof resp.error).toBe('string')
    expect(Array.isArray(resp.details)).toBe(true)
  })
})

describe('validateOptionalInt', () => {
  it('returns undefined for null / undefined / empty string', () => {
    expect(validateOptionalInt(null, 'n')).toBeUndefined()
    expect(validateOptionalInt(undefined, 'n')).toBeUndefined()
    expect(validateOptionalInt('', 'n')).toBeUndefined()
  })

  it('returns parsed integer for valid string', () => {
    expect(validateOptionalInt('42', 'n')).toBe(42)
  })

  it('throws for non-integer string', () => {
    expect(() => validateOptionalInt('abc', 'n')).toThrow(RequestValidationError)
    expect(() => validateOptionalInt('1.5', 'n')).toThrow(RequestValidationError)
  })

  it('throws when value is below min', () => {
    expect(() => validateOptionalInt('0', 'n', { min: 1 })).toThrow(RequestValidationError)
  })

  it('throws when value is above max', () => {
    expect(() => validateOptionalInt('201', 'n', { max: 200 })).toThrow(RequestValidationError)
  })

  it('accepts boundary values', () => {
    expect(validateOptionalInt('1', 'n', { min: 1, max: 200 })).toBe(1)
    expect(validateOptionalInt('200', 'n', { min: 1, max: 200 })).toBe(200)
  })
})

describe('validateOptionalEnum', () => {
  const ROLES = ['Recycler', 'Collector', 'Manufacturer'] as const

  it('returns undefined for null/undefined/empty', () => {
    expect(validateOptionalEnum(null, 'role', ROLES)).toBeUndefined()
    expect(validateOptionalEnum(undefined, 'role', ROLES)).toBeUndefined()
    expect(validateOptionalEnum('', 'role', ROLES)).toBeUndefined()
  })

  it('returns the value when it is in the allowed list', () => {
    expect(validateOptionalEnum('Recycler', 'role', ROLES)).toBe('Recycler')
  })

  it('throws RequestValidationError for an invalid value', () => {
    expect(() => validateOptionalEnum('Alien', 'role', ROLES)).toThrow(RequestValidationError)
  })
})

describe('validateRequiredString', () => {
  it('returns trimmed string for non-empty input', () => {
    expect(validateRequiredString('  hello  ', 'field')).toBe('hello')
  })

  it('throws for null, undefined, or blank string', () => {
    expect(() => validateRequiredString(null, 'f')).toThrow(RequestValidationError)
    expect(() => validateRequiredString(undefined, 'f')).toThrow(RequestValidationError)
    expect(() => validateRequiredString('  ', 'f')).toThrow(RequestValidationError)
  })

  it('throws when value exceeds maxLength', () => {
    expect(() => validateRequiredString('abcdef', 'f', { maxLength: 3 })).toThrow(
      RequestValidationError
    )
  })
})

describe('validateReplayBody', () => {
  it('accepts minimal valid body', () => {
    const result = validateReplayBody({ fromLedger: 100 })
    expect(result.fromLedger).toBe(100)
    expect(result.toLedger).toBeUndefined()
    expect(result.eventTypes).toBeUndefined()
  })

  it('accepts full valid body', () => {
    const result = validateReplayBody({
      fromLedger: 100,
      toLedger: 200,
      eventTypes: ['event-a', 'event-b']
    })
    expect(result.fromLedger).toBe(100)
    expect(result.toLedger).toBe(200)
    expect(result.eventTypes).toEqual(['event-a', 'event-b'])
  })

  it('throws when fromLedger is missing', () => {
    expect(() => validateReplayBody({})).toThrow(RequestValidationError)
  })

  it('throws when fromLedger is negative', () => {
    expect(() => validateReplayBody({ fromLedger: -1 })).toThrow(RequestValidationError)
  })

  it('throws when fromLedger is not an integer', () => {
    expect(() => validateReplayBody({ fromLedger: 1.5 })).toThrow(RequestValidationError)
  })

  it('throws when toLedger < fromLedger', () => {
    expect(() => validateReplayBody({ fromLedger: 200, toLedger: 100 })).toThrow(
      RequestValidationError
    )
  })

  it('throws when eventTypes is not an array', () => {
    expect(() => validateReplayBody({ fromLedger: 1, eventTypes: 'bad' })).toThrow(
      RequestValidationError
    )
  })

  it('throws when eventTypes contains non-strings', () => {
    expect(() => validateReplayBody({ fromLedger: 1, eventTypes: [42] })).toThrow(
      RequestValidationError
    )
  })
})

describe('validateEventQueryParams', () => {
  function makeUrl(query: Record<string, string>): URL {
    const params = new URLSearchParams(query).toString()
    return new URL(`http://localhost/events?${params}`)
  }

  it('returns empty params for no query string', () => {
    const result = validateEventQueryParams(new URL('http://localhost/events'))
    expect(result.fromLedger).toBeUndefined()
    expect(result.toLedger).toBeUndefined()
    expect(result.limit).toBeUndefined()
  })

  it('parses valid from / to / limit / offset', () => {
    const result = validateEventQueryParams(
      makeUrl({ from: '10', to: '20', limit: '50', offset: '5' })
    )
    expect(result.fromLedger).toBe(10)
    expect(result.toLedger).toBe(20)
    expect(result.limit).toBe(50)
    expect(result.offset).toBe(5)
  })

  it('throws for non-integer from', () => {
    expect(() => validateEventQueryParams(makeUrl({ from: 'abc' }))).toThrow(RequestValidationError)
  })

  it('throws when to < from', () => {
    expect(() => validateEventQueryParams(makeUrl({ from: '100', to: '50' }))).toThrow(
      RequestValidationError
    )
  })

  it('throws when limit is out of range', () => {
    expect(() => validateEventQueryParams(makeUrl({ limit: '0' }))).toThrow(RequestValidationError)
    expect(() => validateEventQueryParams(makeUrl({ limit: '1001' }))).toThrow(
      RequestValidationError
    )
  })

  it('throws when offset is negative', () => {
    expect(() => validateEventQueryParams(makeUrl({ offset: '-1' }))).toThrow(
      RequestValidationError
    )
  })

  it('passes through eventType, contractId, txHash as-is', () => {
    const result = validateEventQueryParams(
      makeUrl({ type: 'WasteRegistered', contractId: 'CABC', txHash: 'abc123' })
    )
    expect(result.eventType).toBe('WasteRegistered')
    expect(result.contractId).toBe('CABC')
    expect(result.txHash).toBe('abc123')
  })
})

describe('Validation: 400 error shape in API routes', () => {
  // Integration smoke-test: the replay endpoint should return a consistent
  // 400 shape with 'error' and 'details' when validation fails.
  it('replay route returns 400 with details array on bad body', async () => {
    // We test this via the server to confirm the controller wires up correctly
    const { createApiServer } = require('../src/api/server')
    const api = createApiServer({ port: 0, host: '127.0.0.1' })
    await api.start()
    const address = api.server.address()
    const port = typeof address === 'object' && address ? address.port : 3001

    try {
      const res = await fetch(`http://127.0.0.1:${port}/replay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toLedger: 100 }) // missing fromLedger
      })
      expect(res.status).toBe(400)
      const body = (await res.json()) as Record<string, unknown>
      expect(Array.isArray(body.details)).toBe(true)
      expect(typeof body.error).toBe('string')
    } finally {
      await api.stop()
    }
  })

  it('events route returns 400 with details for invalid query params', async () => {
    const { createApiServer } = require('../src/api/server')
    const api = createApiServer({ port: 0, host: '127.0.0.1' })
    await api.start()
    const address = api.server.address()
    const port = typeof address === 'object' && address ? address.port : 3001

    try {
      const res = await fetch(`http://127.0.0.1:${port}/events?limit=notanumber`)
      expect(res.status).toBe(400)
      const body = (await res.json()) as Record<string, unknown>
      expect(Array.isArray(body.details)).toBe(true)
    } finally {
      await api.stop()
    }
  })
})
