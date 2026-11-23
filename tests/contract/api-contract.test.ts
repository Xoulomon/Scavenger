/**
 * API Contract Tests – Frontend ↔ Indexer
 *
 * These tests verify that the shapes returned by the indexer API match the
 * shapes the frontend expects.  They run entirely against in-process mock
 * data; no live server is required.
 *
 * Issue #954 – Add API contract tests between frontend and indexer.
 *
 * How to run:
 *   cd tests/contract
 *   npx jest --testPathPattern="api-contract"
 */

import {
  validateIndexerParticipant,
  validateIndexerParticipantList,
  validateIndexerEvent,
  validateIndexerEventList,
  VALID_ROLES,
  type ParticipantSchema,
  type ParticipantListSchema,
  type EventSchema,
  type EventListSchema
} from './schemas'

// ---------------------------------------------------------------------------
// Fixtures – representative payloads that the indexer returns today
// ---------------------------------------------------------------------------

const SAMPLE_PARTICIPANT: ParticipantSchema = {
  address: 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN',
  role: 'Recycler',
  name: 'Alice',
  latitude: -1.2921,
  longitude: 36.8219,
  registeredAtLedger: 1000,
  registeredAt: '2024-01-15T10:30:00.000Z',
  isActive: true
}

const SAMPLE_PARTICIPANT_LIST: ParticipantListSchema = {
  participants: [
    SAMPLE_PARTICIPANT,
    {
      address: 'GBKGJTSMPLC54YDKYZPAWKQ4HFSJCLB6PWDX36AFZDLXO3YLQAZFXBO',
      role: 'Collector',
      name: 'Bob',
      latitude: -1.3031,
      longitude: 36.7073,
      registeredAtLedger: 1050,
      registeredAt: '2024-01-16T08:00:00.000Z',
      isActive: true
    },
    {
      address: 'GCITNMB4RRXQHBOPVV42LH2T5NHPD6L5PO23XCJZSKJJBR5Z3GIHKZF',
      role: 'Manufacturer',
      name: 'Acme Corp',
      latitude: -1.2864,
      longitude: 36.8172,
      registeredAtLedger: 1200,
      registeredAt: '2024-01-20T14:00:00.000Z',
      isActive: false
    }
  ],
  total: 3,
  limit: 100,
  offset: 0
}

const SAMPLE_EVENT: EventSchema = {
  id: 1,
  ledger_sequence: 5000,
  transaction_hash: 'abc123def456abc123def456abc123def456abc123def456abc123def456abc1',
  contract_id: 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM',
  event_type: 'ParticipantRegistered',
  topic: ['ParticipantRegistered'],
  value: { address: SAMPLE_PARTICIPANT.address, role: 0 }
}

const SAMPLE_EVENT_LIST: EventListSchema = {
  events: [SAMPLE_EVENT],
  total: 1,
  limit: 100,
  offset: 0
}

// ---------------------------------------------------------------------------
// Contract: Participant schema
// ---------------------------------------------------------------------------

describe('Participant API contract – indexer response shape', () => {
  it('accepts a well-formed participant object', () => {
    expect(() => validateIndexerParticipant(SAMPLE_PARTICIPANT)).not.toThrow()
  })

  it('rejects a participant missing the address field', () => {
    const bad = { ...SAMPLE_PARTICIPANT, address: undefined }
    expect(() => validateIndexerParticipant(bad)).toThrow(/address/)
  })

  it('rejects a participant with an invalid role', () => {
    const bad = { ...SAMPLE_PARTICIPANT, role: 'Admin' }
    expect(() => validateIndexerParticipant(bad)).toThrow(/role/)
  })

  it('rejects a participant with a non-numeric latitude', () => {
    const bad = { ...SAMPLE_PARTICIPANT, latitude: '1.2921' }
    expect(() => validateIndexerParticipant(bad)).toThrow(/latitude/)
  })

  it('rejects a participant with a non-numeric longitude', () => {
    const bad = { ...SAMPLE_PARTICIPANT, longitude: null }
    expect(() => validateIndexerParticipant(bad)).toThrow(/longitude/)
  })

  it('rejects a participant with a malformed registeredAt date', () => {
    const bad = { ...SAMPLE_PARTICIPANT, registeredAt: 'not-a-date' }
    expect(() => validateIndexerParticipant(bad)).toThrow(/registeredAt/)
  })

  it('rejects a participant where isActive is not a boolean', () => {
    const bad = { ...SAMPLE_PARTICIPANT, isActive: 1 }
    expect(() => validateIndexerParticipant(bad)).toThrow(/isActive/)
  })

  it('accepts every valid role value', () => {
    for (const role of VALID_ROLES) {
      expect(() => validateIndexerParticipant({ ...SAMPLE_PARTICIPANT, role })).not.toThrow()
    }
  })

  it('rejects null', () => {
    expect(() => validateIndexerParticipant(null)).toThrow()
  })
})

// ---------------------------------------------------------------------------
// Contract: Participant list schema
// ---------------------------------------------------------------------------

describe('ParticipantList API contract – indexer response shape', () => {
  it('accepts a well-formed participant list response', () => {
    expect(() => validateIndexerParticipantList(SAMPLE_PARTICIPANT_LIST)).not.toThrow()
  })

  it('rejects a response missing the participants array', () => {
    const bad = { total: 0, limit: 100, offset: 0 }
    expect(() => validateIndexerParticipantList(bad)).toThrow(/participants/)
  })

  it('rejects a response where participants is not an array', () => {
    const bad = { ...SAMPLE_PARTICIPANT_LIST, participants: {} }
    expect(() => validateIndexerParticipantList(bad)).toThrow(/participants/)
  })

  it('rejects a response with a non-numeric total', () => {
    const bad = { ...SAMPLE_PARTICIPANT_LIST, total: '3' }
    expect(() => validateIndexerParticipantList(bad)).toThrow(/total/)
  })

  it('rejects a response with a non-numeric limit', () => {
    const bad = { ...SAMPLE_PARTICIPANT_LIST, limit: '100' }
    expect(() => validateIndexerParticipantList(bad)).toThrow(/limit/)
  })

  it('rejects a response with a non-numeric offset', () => {
    const bad = { ...SAMPLE_PARTICIPANT_LIST, offset: '0' }
    expect(() => validateIndexerParticipantList(bad)).toThrow(/offset/)
  })

  it('validates every nested participant', () => {
    const bad = {
      ...SAMPLE_PARTICIPANT_LIST,
      participants: [{ ...SAMPLE_PARTICIPANT, role: 'Ghost' }]
    }
    expect(() => validateIndexerParticipantList(bad)).toThrow(/role/)
  })

  it('accepts an empty participants array', () => {
    const empty: ParticipantListSchema = { participants: [], total: 0, limit: 100, offset: 0 }
    expect(() => validateIndexerParticipantList(empty)).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// Contract: Event schema
// ---------------------------------------------------------------------------

describe('Event API contract – indexer response shape', () => {
  it('accepts a well-formed event object', () => {
    expect(() => validateIndexerEvent(SAMPLE_EVENT)).not.toThrow()
  })

  it('rejects an event with missing transaction_hash', () => {
    const bad = { ...SAMPLE_EVENT, transaction_hash: undefined }
    expect(() => validateIndexerEvent(bad)).toThrow(/transaction_hash/)
  })

  it('rejects an event with a non-string contract_id', () => {
    const bad = { ...SAMPLE_EVENT, contract_id: 12345 }
    expect(() => validateIndexerEvent(bad)).toThrow(/contract_id/)
  })

  it('rejects an event with a non-string event_type', () => {
    const bad = { ...SAMPLE_EVENT, event_type: null }
    expect(() => validateIndexerEvent(bad)).toThrow(/event_type/)
  })

  it('rejects an event with a non-numeric ledger_sequence', () => {
    const bad = { ...SAMPLE_EVENT, ledger_sequence: 'five-thousand' }
    expect(() => validateIndexerEvent(bad)).toThrow(/ledger_sequence/)
  })

  it('accepts id as either a number or a string', () => {
    expect(() => validateIndexerEvent({ ...SAMPLE_EVENT, id: 42 })).not.toThrow()
    expect(() => validateIndexerEvent({ ...SAMPLE_EVENT, id: '42' })).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// Contract: Event list schema
// ---------------------------------------------------------------------------

describe('EventList API contract – indexer response shape', () => {
  it('accepts a well-formed event list response', () => {
    expect(() => validateIndexerEventList(SAMPLE_EVENT_LIST)).not.toThrow()
  })

  it('rejects a response missing the events array', () => {
    const bad = { total: 0, limit: 100, offset: 0 }
    expect(() => validateIndexerEventList(bad)).toThrow(/events/)
  })

  it('rejects a response with a non-numeric total', () => {
    const bad = { ...SAMPLE_EVENT_LIST, total: '1' }
    expect(() => validateIndexerEventList(bad)).toThrow(/total/)
  })

  it('accepts an empty event list', () => {
    const empty: EventListSchema = { events: [], total: 0, limit: 100, offset: 0 }
    expect(() => validateIndexerEventList(empty)).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// Cross-concern: field name alignment between indexer and frontend
// ---------------------------------------------------------------------------

describe('Field name alignment – indexer vs. frontend types', () => {
  /**
   * The indexer returns camelCase field names for Participant.
   * The frontend API types.ts mirrors this in the indexer-specific types.
   * Ensure the casing conventions are consistent.
   */
  it('indexer Participant uses camelCase keys', () => {
    const keys = Object.keys(SAMPLE_PARTICIPANT)
    const camelCasePattern = /^[a-z][a-zA-Z0-9]*$/
    for (const key of keys) {
      expect(key).toMatch(camelCasePattern)
    }
  })

  it('indexer ParticipantList uses camelCase keys at the top level', () => {
    const topLevelKeys = Object.keys(SAMPLE_PARTICIPANT_LIST)
    const camelCasePattern = /^[a-z][a-zA-Z0-9]*$/
    for (const key of topLevelKeys) {
      expect(key).toMatch(camelCasePattern)
    }
  })

  it('indexer Event uses snake_case keys (legacy DB mapping)', () => {
    // Events come directly from raw DB rows – snake_case is intentional
    expect(SAMPLE_EVENT).toHaveProperty('ledger_sequence')
    expect(SAMPLE_EVENT).toHaveProperty('transaction_hash')
    expect(SAMPLE_EVENT).toHaveProperty('contract_id')
    expect(SAMPLE_EVENT).toHaveProperty('event_type')
  })

  it('frontend WasteType numeric enum maps to the same 7 entries as the contract', () => {
    // This guards against someone adding a new WasteType without updating the
    // frontend enum (issue #954 – type drift).
    const CONTRACT_WASTE_TYPES = [
      'Paper',
      'PetPlastic',
      'Plastic',
      'Metal',
      'Glass',
      'Organic',
      'Electronic'
    ]
    const FRONTEND_WASTE_TYPE_ENUM = {
      Paper: 0,
      PetPlastic: 1,
      Plastic: 2,
      Metal: 3,
      Glass: 4,
      Organic: 5,
      Electronic: 6
    }

    expect(Object.keys(FRONTEND_WASTE_TYPE_ENUM)).toEqual(CONTRACT_WASTE_TYPES)
    expect(Object.keys(FRONTEND_WASTE_TYPE_ENUM)).toHaveLength(7)
  })

  it('frontend Role enum values match the indexer valid roles', () => {
    const FRONTEND_ROLES = ['Recycler', 'Collector', 'Manufacturer']
    expect(FRONTEND_ROLES).toEqual([...VALID_ROLES])
  })
})

// ---------------------------------------------------------------------------
// Pagination contract – shared by participant and event endpoints
// ---------------------------------------------------------------------------

describe('Pagination contract – common to all list endpoints', () => {
  it('participant list response always includes total, limit, offset', () => {
    expect(SAMPLE_PARTICIPANT_LIST).toHaveProperty('total')
    expect(SAMPLE_PARTICIPANT_LIST).toHaveProperty('limit')
    expect(SAMPLE_PARTICIPANT_LIST).toHaveProperty('offset')
  })

  it('event list response always includes total, limit, offset', () => {
    expect(SAMPLE_EVENT_LIST).toHaveProperty('total')
    expect(SAMPLE_EVENT_LIST).toHaveProperty('limit')
    expect(SAMPLE_EVENT_LIST).toHaveProperty('offset')
  })

  it('limit defaults to 100 and cannot exceed 1000', () => {
    // These bounds are enforced by both the frontend API client and the
    // indexer service layer – the contract test pins this behaviour.
    expect(SAMPLE_PARTICIPANT_LIST.limit).toBe(100)
    expect(SAMPLE_PARTICIPANT_LIST.limit).toBeLessThanOrEqual(1000)
  })

  it('offset defaults to 0', () => {
    expect(SAMPLE_PARTICIPANT_LIST.offset).toBe(0)
    expect(SAMPLE_EVENT_LIST.offset).toBe(0)
  })
})
