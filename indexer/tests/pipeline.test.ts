/**
 * Pipeline unit tests — Issue #920
 *
 * Tests each pipeline stage independently:
 *   - parse stage: valid → ParsedEvent, invalid → ParseError
 *   - transform stage: enum lookups, address normalization
 *   - store stage: correct SQL called via mock PoolClient
 */

import { parseEvent, ParseError } from '../src/pipeline/parse'
import { transformEvent } from '../src/pipeline/transform'
import { storeEvent } from '../src/pipeline/store'
import { RawContractEvent } from '../src/types'
import { ParsedEvent } from '../src/pipeline/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEvent(
  overrides: Partial<RawContractEvent> & { eventType: string; topic: string[]; value: unknown }
): RawContractEvent {
  return {
    ledgerSequence: 1000,
    ledgerCloseTime: new Date('2024-01-01T00:00:00Z'),
    transactionHash: '0xabc',
    contractId: 'CONTRACT',
    ...overrides
  }
}

function makeMockClient() {
  const queries: Array<{ text: string; values: unknown[] }> = []
  const client = {
    query: jest.fn().mockImplementation((text: string, values: unknown[]) => {
      queries.push({ text, values })
      return Promise.resolve({ rows: [] })
    }),
    _queries: queries
  }
  return client
}

// ---------------------------------------------------------------------------
// Parse stage
// ---------------------------------------------------------------------------

describe('parse stage', () => {
  describe('WasteRegistered (recycled)', () => {
    it('parses a well-formed event', () => {
      const event = makeEvent({
        eventType: 'recycled',
        topic: ['recycled', '42'],
        value: [1, '500', 'ADDR_RECYCLER', '12000000', '34000000']
      })
      const parsed = parseEvent(event)
      expect(parsed.kind).toBe('WasteRegistered')
      if (parsed.kind === 'WasteRegistered') {
        expect(parsed.wasteId).toBe('42')
        expect(parsed.wasteTypeNum).toBe(1)
        expect(parsed.weight).toBe('500')
        expect(parsed.recycler).toBe('ADDR_RECYCLER')
        expect(parsed.ledgerSequence).toBe(1000)
      }
    })

    it('throws ParseError when waste_id is missing', () => {
      const event = makeEvent({
        eventType: 'recycled',
        topic: ['recycled'], // missing waste_id at index 1
        value: [1, '500', 'ADDR', '0', '0']
      })
      expect(() => parseEvent(event)).toThrow(ParseError)
    })
  })

  describe('ParticipantRegistered (reg)', () => {
    it('parses a well-formed event', () => {
      const event = makeEvent({
        eventType: 'reg',
        topic: ['reg', 'GADDR123'],
        value: [0, 'Alice', '48000000', '2000000']
      })
      const parsed = parseEvent(event)
      expect(parsed.kind).toBe('ParticipantRegistered')
      if (parsed.kind === 'ParticipantRegistered') {
        expect(parsed.address).toBe('GADDR123')
        expect(parsed.roleNum).toBe(0)
        expect(parsed.name).toBe('Alice')
      }
    })
  })

  describe('WasteTransferred (transfer)', () => {
    it('parses from and to', () => {
      const event = makeEvent({
        eventType: 'transfer',
        topic: ['transfer', '99'],
        value: ['FROM_ADDR', 'TO_ADDR']
      })
      const parsed = parseEvent(event)
      expect(parsed.kind).toBe('WasteTransferred')
      if (parsed.kind === 'WasteTransferred') {
        expect(parsed.wasteId).toBe('99')
        expect(parsed.from).toBe('FROM_ADDR')
        expect(parsed.to).toBe('TO_ADDR')
      }
    })
  })

  describe('TokensRewarded (rewarded)', () => {
    it('parses amount and waste_id', () => {
      const event = makeEvent({
        eventType: 'rewarded',
        topic: ['rewarded', 'RECIPIENT_ADDR'],
        value: ['1000', '42']
      })
      const parsed = parseEvent(event)
      expect(parsed.kind).toBe('TokensRewarded')
      if (parsed.kind === 'TokensRewarded') {
        expect(parsed.recipient).toBe('RECIPIENT_ADDR')
        expect(parsed.amount).toBe('1000')
        expect(parsed.wasteId).toBe('42')
      }
    })
  })

  describe('AuctionCreated (auc_cre)', () => {
    it('parses all auction fields', () => {
      const event = makeEvent({
        eventType: 'auc_cre',
        topic: ['auc_cre', '7'],
        value: ['99', 'CREATOR_ADDR', '500', '1700000000']
      })
      const parsed = parseEvent(event)
      expect(parsed.kind).toBe('AuctionCreated')
      if (parsed.kind === 'AuctionCreated') {
        expect(parsed.auctionId).toBe('7')
        expect(parsed.wasteId).toBe('99')
        expect(parsed.startPrice).toBe('500')
      }
    })
  })

  describe('AuctionEnded (auc_end)', () => {
    it('handles null winner', () => {
      const event = makeEvent({
        eventType: 'auc_end',
        topic: ['auc_end', '7'],
        value: [null, '500']
      })
      const parsed = parseEvent(event)
      expect(parsed.kind).toBe('AuctionEnded')
      if (parsed.kind === 'AuctionEnded') {
        expect(parsed.winner).toBeNull()
      }
    })
  })

  describe('unknown event type', () => {
    it('throws ParseError', () => {
      const event = makeEvent({
        eventType: 'unknown_xyz',
        topic: ['unknown_xyz'],
        value: []
      })
      expect(() => parseEvent(event)).toThrow(ParseError)
      expect(() => parseEvent(event)).toThrow(/unknown event type/)
    })
  })
})

// ---------------------------------------------------------------------------
// Transform stage
// ---------------------------------------------------------------------------

describe('transform stage', () => {
  it('maps wasteTypeNum to WasteType string', () => {
    const parsed: ParsedEvent = {
      kind: 'WasteRegistered',
      ledgerSequence: 1,
      ledgerCloseTime: new Date(),
      transactionHash: 'tx',
      contractId: 'c',
      wasteId: '1',
      wasteTypeNum: 2, // Plastic
      weight: '100',
      recycler: 'ADDR',
      lat: '0',
      lon: '0'
    }
    const transformed = transformEvent(parsed)
    if (transformed.kind === 'WasteRegistered') {
      expect(transformed.wasteType).toBe('Plastic')
    }
  })

  it('falls back to Paper for unknown wasteTypeNum', () => {
    const parsed: ParsedEvent = {
      kind: 'WasteRegistered',
      ledgerSequence: 1,
      ledgerCloseTime: new Date(),
      transactionHash: 'tx',
      contractId: 'c',
      wasteId: '1',
      wasteTypeNum: 999,
      weight: '100',
      recycler: 'ADDR',
      lat: '0',
      lon: '0'
    }
    const transformed = transformEvent(parsed)
    if (transformed.kind === 'WasteRegistered') {
      expect(transformed.wasteType).toBe('Paper')
    }
  })

  it('maps roleNum to ParticipantRole', () => {
    const parsed: ParsedEvent = {
      kind: 'ParticipantRegistered',
      ledgerSequence: 1,
      ledgerCloseTime: new Date(),
      transactionHash: 'tx',
      contractId: 'c',
      address: 'GADDR',
      roleNum: 1, // Collector
      name: 'Bob',
      lat: '0',
      lon: '0'
    }
    const transformed = transformEvent(parsed)
    if (transformed.kind === 'ParticipantRegistered') {
      expect(transformed.role).toBe('Collector')
    }
  })

  it('normalizes addresses by trimming whitespace', () => {
    const parsed: ParsedEvent = {
      kind: 'WasteTransferred',
      ledgerSequence: 1,
      ledgerCloseTime: new Date(),
      transactionHash: 'tx',
      contractId: 'c',
      wasteId: '1',
      from: '  FROM_ADDR  ',
      to: '  TO_ADDR  '
    }
    const transformed = transformEvent(parsed)
    if (transformed.kind === 'WasteTransferred') {
      expect(transformed.from).toBe('FROM_ADDR')
      expect(transformed.to).toBe('TO_ADDR')
    }
  })

  it('passes WasteConfirmed through unchanged', () => {
    const parsed: ParsedEvent = {
      kind: 'WasteConfirmed',
      ledgerSequence: 5,
      ledgerCloseTime: new Date(),
      transactionHash: 'tx',
      contractId: 'c',
      wasteId: '42'
    }
    const transformed = transformEvent(parsed)
    expect(transformed.kind).toBe('WasteConfirmed')
    if (transformed.kind === 'WasteConfirmed') {
      expect(transformed.wasteId).toBe('42')
    }
  })
})

// ---------------------------------------------------------------------------
// Store stage
// ---------------------------------------------------------------------------

describe('store stage', () => {
  it('inserts a waste record for WasteRegistered', async () => {
    const client = makeMockClient()
    await storeEvent(client as any, {
      kind: 'WasteRegistered',
      ledgerSequence: 1,
      ledgerCloseTime: new Date(),
      transactionHash: 'tx',
      contractId: 'c',
      wasteId: '1',
      wasteType: 'Metal',
      weight: '200',
      recycler: 'GADDR',
      lat: '10',
      lon: '20'
    })
    expect(client.query).toHaveBeenCalledTimes(1)
    const q = client._queries[0]
    expect(q.text).toMatch(/INSERT INTO wastes/)
    expect(q.values).toContain('1')
    expect(q.values).toContain('Metal')
  })

  it('updates confirmed flag for WasteConfirmed', async () => {
    const client = makeMockClient()
    await storeEvent(client as any, {
      kind: 'WasteConfirmed',
      ledgerSequence: 2,
      ledgerCloseTime: new Date(),
      transactionHash: 'tx',
      contractId: 'c',
      wasteId: '99'
    })
    expect(client.query).toHaveBeenCalledTimes(1)
    const q = client._queries[0]
    expect(q.text).toMatch(/UPDATE wastes SET is_confirmed = true/)
    expect(q.values).toContain('99')
  })

  it('inserts transfer record for WasteTransferred', async () => {
    const client = makeMockClient()
    await storeEvent(client as any, {
      kind: 'WasteTransferred',
      ledgerSequence: 3,
      ledgerCloseTime: new Date(),
      transactionHash: 'tx',
      contractId: 'c',
      wasteId: '5',
      from: 'ADDR_A',
      to: 'ADDR_B'
    })
    expect(client.query).toHaveBeenCalledTimes(1)
    const q = client._queries[0]
    expect(q.text).toMatch(/INSERT INTO waste_transfers/)
    expect(q.values).toContain('ADDR_A')
    expect(q.values).toContain('ADDR_B')
  })

  it('updates deactivation flag for WasteDeactivated', async () => {
    const client = makeMockClient()
    await storeEvent(client as any, {
      kind: 'WasteDeactivated',
      ledgerSequence: 4,
      ledgerCloseTime: new Date(),
      transactionHash: 'tx',
      contractId: 'c',
      wasteId: '77'
    })
    const q = client._queries[0]
    expect(q.text).toMatch(/UPDATE wastes SET is_active = false/)
    expect(q.values).toContain('77')
  })

  it('inserts carbon credits for CarbonCreditsEarned', async () => {
    const client = makeMockClient()
    await storeEvent(client as any, {
      kind: 'CarbonCreditsEarned',
      ledgerSequence: 5,
      ledgerCloseTime: new Date(),
      transactionHash: 'tx',
      contractId: 'c',
      participant: 'GPART',
      wasteType: 'Glass',
      weight: '300',
      credits: '15'
    })
    const q = client._queries[0]
    expect(q.text).toMatch(/INSERT INTO carbon_credits/)
    expect(q.values).toContain('Glass')
    expect(q.values).toContain('15')
  })
})
