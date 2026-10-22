/**
 * Pipeline stage tests (parse, transform, store) — Issue #1532
 *
 * Table-driven tests for all 12 Soroban event types using recorded fixtures
 * from tests/fixtures/soroban-events.json.
 *
 * Structure:
 *   1. Parse tests  — valid payload, malformed payload, unknown type
 *   2. Transform tests — exact row shape assertions
 *   3. Store tests  — correct SQL text + parameter binding via a mock PoolClient
 */

import { parseEvent, ParseError } from '../src/pipeline/parse';
import { transformEvent } from '../src/pipeline/transform';
import { storeEvent } from '../src/pipeline/store';
import { RawContractEvent } from '../src/types';
import { ParsedEvent, TransformedEvent } from '../src/pipeline/types';

// ─── Load fixtures ────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-var-requires
const RAW_FIXTURES: Array<Record<string, unknown>> = require('./fixtures/soroban-events.json');

function loadFixture(eventType: string): RawContractEvent {
  const raw = RAW_FIXTURES.find(f => f.eventType === eventType);
  if (!raw) throw new Error(`No fixture for eventType "${eventType}"`);
  return {
    ledgerSequence: raw.ledgerSequence as number,
    ledgerCloseTime: new Date(raw.ledgerCloseTime as string),
    transactionHash: raw.transactionHash as string,
    contractId: raw.contractId as string,
    eventType: raw.eventType as string,
    topic: raw.topic as string[],
    value: raw.value,
  };
}

// ─── Mock PoolClient ──────────────────────────────────────────────────────────

function makeMockClient() {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const client = {
    query: jest.fn(async (sql: string, params: unknown[]) => {
      calls.push({ sql: sql.replace(/\s+/g, ' ').trim(), params });
      return { rows: [] };
    }),
    _calls: calls,
  };
  return client;
}

// ─── Shared meta for fixture events ──────────────────────────────────────────

const META_LEDGER = 1001; // first fixture ledger

// =============================================================================
// 1. Parse stage
// =============================================================================

describe('parse stage — all 12 event types (fixtures)', () => {
  const cases: Array<{ eventType: string; expectedKind: string }> = [
    { eventType: 'recycled',  expectedKind: 'WasteRegistered' },
    { eventType: 'reg',       expectedKind: 'ParticipantRegistered' },
    { eventType: 'transfer',  expectedKind: 'WasteTransferred' },
    { eventType: 'confirmed', expectedKind: 'WasteConfirmed' },
    { eventType: 'rewarded',  expectedKind: 'TokensRewarded' },
    { eventType: 'deactive',  expectedKind: 'WasteDeactivated' },
    { eventType: 'graded',    expectedKind: 'WasteGraded' },
    { eventType: 'proc_upd',  expectedKind: 'ProcessingStatusChanged' },
    { eventType: 'contam',    expectedKind: 'WasteContaminated' },
    { eventType: 'auc_cre',   expectedKind: 'AuctionCreated' },
    { eventType: 'auc_end',   expectedKind: 'AuctionEnded' },
    { eventType: 'carbon',    expectedKind: 'CarbonCreditsEarned' },
  ];

  test.each(cases)('$eventType → kind=$expectedKind', ({ eventType, expectedKind }) => {
    const event = loadFixture(eventType);
    const parsed = parseEvent(event);
    expect(parsed.kind).toBe(expectedKind);
    // Meta fields are always propagated
    expect(parsed.ledgerSequence).toBe(event.ledgerSequence);
    expect(parsed.transactionHash).toBe(event.transactionHash);
  });

  // ── per-type field assertions ─────────────────────────────────────────────

  it('WasteRegistered: extracts wasteId, wasteTypeNum, weight, recycler, lat, lon', () => {
    const parsed = parseEvent(loadFixture('recycled'));
    expect(parsed.kind).toBe('WasteRegistered');
    if (parsed.kind === 'WasteRegistered') {
      expect(parsed.wasteId).toBe('waste_001');
      expect(parsed.wasteTypeNum).toBe(1);
      expect(parsed.weight).toBe('500');
      expect(parsed.recycler).toBe('GADDR_RECYCLER_001');
      expect(parsed.lat).toBe('12000000');
      expect(parsed.lon).toBe('34000000');
    }
  });

  it('ParticipantRegistered: extracts address, roleNum, name, lat, lon', () => {
    const parsed = parseEvent(loadFixture('reg'));
    expect(parsed.kind).toBe('ParticipantRegistered');
    if (parsed.kind === 'ParticipantRegistered') {
      expect(parsed.address).toBe('GADDR_PARTICIPANT_001');
      expect(parsed.roleNum).toBe(1);
      expect(parsed.name).toBe('Alice Recycler');
    }
  });

  it('WasteTransferred: extracts wasteId, from, to', () => {
    const parsed = parseEvent(loadFixture('transfer'));
    expect(parsed.kind).toBe('WasteTransferred');
    if (parsed.kind === 'WasteTransferred') {
      expect(parsed.wasteId).toBe('waste_001');
      expect(parsed.from).toBe('GADDR_FROM_001');
      expect(parsed.to).toBe('GADDR_TO_001');
    }
  });

  it('TokensRewarded: extracts recipient, amount, wasteId', () => {
    const parsed = parseEvent(loadFixture('rewarded'));
    expect(parsed.kind).toBe('TokensRewarded');
    if (parsed.kind === 'TokensRewarded') {
      expect(parsed.recipient).toBe('GADDR_RECIPIENT_001');
      expect(parsed.amount).toBe('10000');
      expect(parsed.wasteId).toBe('waste_001');
    }
  });

  it('WasteGraded: extracts wasteId, grade', () => {
    const parsed = parseEvent(loadFixture('graded'));
    expect(parsed.kind).toBe('WasteGraded');
    if (parsed.kind === 'WasteGraded') {
      expect(parsed.grade).toBe('A+');
    }
  });

  it('ProcessingStatusChanged: extracts wasteId, status', () => {
    const parsed = parseEvent(loadFixture('proc_upd'));
    expect(parsed.kind).toBe('ProcessingStatusChanged');
    if (parsed.kind === 'ProcessingStatusChanged') {
      expect(parsed.status).toBe(2);
    }
  });

  it('WasteContaminated: extracts wasteId, level', () => {
    const parsed = parseEvent(loadFixture('contam'));
    expect(parsed.kind).toBe('WasteContaminated');
    if (parsed.kind === 'WasteContaminated') {
      expect(parsed.level).toBe(3);
    }
  });

  it('AuctionCreated: extracts auctionId, wasteId, creator, startPrice, endTime', () => {
    const parsed = parseEvent(loadFixture('auc_cre'));
    expect(parsed.kind).toBe('AuctionCreated');
    if (parsed.kind === 'AuctionCreated') {
      expect(parsed.auctionId).toBe('auction_001');
      expect(parsed.creator).toBe('GADDR_CREATOR');
      expect(parsed.startPrice).toBe('5000');
    }
  });

  it('AuctionEnded: extracts auctionId, winner, finalPrice', () => {
    const parsed = parseEvent(loadFixture('auc_end'));
    expect(parsed.kind).toBe('AuctionEnded');
    if (parsed.kind === 'AuctionEnded') {
      expect(parsed.winner).toBe('GADDR_WINNER');
      expect(parsed.finalPrice).toBe('6500');
    }
  });

  it('AuctionEnded: winner is null when value[0] is null', () => {
    const event: RawContractEvent = {
      ledgerSequence: 1000,
      ledgerCloseTime: new Date(),
      transactionHash: '0x0',
      contractId: 'C',
      eventType: 'auc_end',
      topic: ['auc_end', 'auction_x'],
      value: [null, '100'],
    };
    const parsed = parseEvent(event);
    expect(parsed.kind).toBe('AuctionEnded');
    if (parsed.kind === 'AuctionEnded') {
      expect(parsed.winner).toBeNull();
    }
  });

  it('CarbonCreditsEarned: extracts participant, wasteTypeNum, weight, credits', () => {
    const parsed = parseEvent(loadFixture('carbon'));
    expect(parsed.kind).toBe('CarbonCreditsEarned');
    if (parsed.kind === 'CarbonCreditsEarned') {
      expect(parsed.participant).toBe('GADDR_PARTICIPANT_001');
      expect(parsed.wasteTypeNum).toBe(3);
      expect(parsed.weight).toBe('250');
      expect(parsed.credits).toBe('125');
    }
  });
});

// =============================================================================
// 2. Parse stage — malformed and unknown events
// =============================================================================

describe('parse stage — malformed events', () => {
  function makeEvent(
    overrides: Partial<RawContractEvent> & { eventType: string; topic: string[]; value: unknown }
  ): RawContractEvent {
    return {
      ledgerSequence: 1000,
      ledgerCloseTime: new Date('2024-01-01T00:00:00Z'),
      transactionHash: '0xtest',
      contractId: 'C',
      ...overrides,
    };
  }

  it('throws ParseError for unknown event type', () => {
    const event = makeEvent({ eventType: 'unknown_xyz', topic: ['unknown_xyz'], value: [] });
    expect(() => parseEvent(event)).toThrow(ParseError);
    expect(() => parseEvent(event)).toThrow(/unknown event type/);
  });

  it('throws ParseError when WasteRegistered missing waste_id in topic', () => {
    const event = makeEvent({ eventType: 'recycled', topic: ['recycled'], value: [0, '100', 'A', '0', '0'] });
    expect(() => parseEvent(event)).toThrow(ParseError);
  });

  it('throws ParseError when WasteRegistered missing lon in value', () => {
    const event = makeEvent({ eventType: 'recycled', topic: ['recycled', 'w1'], value: [0, '100', 'A', '0'] });
    expect(() => parseEvent(event)).toThrow(ParseError);
  });

  it('throws ParseError when ParticipantRegistered missing address in topic', () => {
    const event = makeEvent({ eventType: 'reg', topic: ['reg'], value: [0, 'Alice', '0', '0'] });
    expect(() => parseEvent(event)).toThrow(ParseError);
  });

  it('throws ParseError when ParticipantRegistered missing lon in value', () => {
    const event = makeEvent({ eventType: 'reg', topic: ['reg', 'ADDR'], value: [0, 'Alice', '0'] });
    expect(() => parseEvent(event)).toThrow(ParseError);
  });

  it('throws ParseError when WasteTransferred missing to in value', () => {
    const event = makeEvent({ eventType: 'transfer', topic: ['transfer', 'w1'], value: ['FROM'] });
    expect(() => parseEvent(event)).toThrow(ParseError);
  });

  it('throws ParseError when TokensRewarded missing waste_id in value', () => {
    const event = makeEvent({ eventType: 'rewarded', topic: ['rewarded', 'ADDR'], value: ['100'] });
    expect(() => parseEvent(event)).toThrow(ParseError);
  });

  it('throws ParseError when AuctionCreated missing end_time in value', () => {
    const event = makeEvent({ eventType: 'auc_cre', topic: ['auc_cre', 'a1'], value: ['w1', 'CREATOR', '500'] });
    expect(() => parseEvent(event)).toThrow(ParseError);
  });

  it('throws ParseError when AuctionEnded missing final_price in value', () => {
    const event = makeEvent({ eventType: 'auc_end', topic: ['auc_end', 'a1'], value: ['WINNER'] });
    expect(() => parseEvent(event)).toThrow(ParseError);
  });

  it('throws ParseError when WasteGraded missing grade in value', () => {
    const event = makeEvent({ eventType: 'graded', topic: ['graded', 'w1'], value: [] });
    expect(() => parseEvent(event)).toThrow(ParseError);
  });

  it('throws ParseError when ProcessingStatusChanged missing status in value', () => {
    const event = makeEvent({ eventType: 'proc_upd', topic: ['proc_upd', 'w1'], value: ['CALLER'] });
    expect(() => parseEvent(event)).toThrow(ParseError);
  });

  it('throws ParseError when WasteContaminated missing level in value', () => {
    const event = makeEvent({ eventType: 'contam', topic: ['contam', 'w1'], value: ['VERIFIER'] });
    expect(() => parseEvent(event)).toThrow(ParseError);
  });

  it('throws ParseError when CarbonCreditsEarned missing credits in value', () => {
    const event = makeEvent({ eventType: 'carbon', topic: ['carbon', 'ADDR'], value: [0, '100'] });
    expect(() => parseEvent(event)).toThrow(ParseError);
  });

  it('does not crash the caller — ParseError is catchable', () => {
    const event = makeEvent({ eventType: 'recycled', topic: ['recycled'], value: [] });
    let caught: unknown;
    try {
      parseEvent(event);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(ParseError);
    // pipeline can inspect it without dying
    expect((caught as ParseError).eventType).toBe('recycled');
  });
});

// =============================================================================
// 3. Transform stage — exact row shape assertions
// =============================================================================

describe('transform stage — exact row shape', () => {
  function parseAndTransform(eventType: string): TransformedEvent {
    return transformEvent(parseEvent(loadFixture(eventType)));
  }

  it('WasteRegistered: wasteType mapped from wasteTypeNum=1 → PetPlastic', () => {
    const t = parseAndTransform('recycled');
    expect(t.kind).toBe('WasteRegistered');
    if (t.kind === 'WasteRegistered') {
      expect(t.wasteType).toBe('PetPlastic');
      expect(t.recycler).toBe('GADDR_RECYCLER_001');
    }
  });

  it('ParticipantRegistered: role mapped from roleNum=1 → Collector, name trimmed', () => {
    const t = parseAndTransform('reg');
    expect(t.kind).toBe('ParticipantRegistered');
    if (t.kind === 'ParticipantRegistered') {
      expect(t.role).toBe('Collector');
      expect(t.name).toBe('Alice Recycler');
    }
  });

  it('WasteTransferred: addresses preserved', () => {
    const t = parseAndTransform('transfer');
    expect(t.kind).toBe('WasteTransferred');
    if (t.kind === 'WasteTransferred') {
      expect(t.from).toBe('GADDR_FROM_001');
      expect(t.to).toBe('GADDR_TO_001');
    }
  });

  it('WasteConfirmed: only wasteId and meta', () => {
    const t = parseAndTransform('confirmed');
    expect(t.kind).toBe('WasteConfirmed');
    if (t.kind === 'WasteConfirmed') {
      expect(t.wasteId).toBe('waste_001');
    }
  });

  it('TokensRewarded: recipient normalized, amount/wasteId preserved as strings', () => {
    const t = parseAndTransform('rewarded');
    expect(t.kind).toBe('TokensRewarded');
    if (t.kind === 'TokensRewarded') {
      expect(t.recipient).toBe('GADDR_RECIPIENT_001');
      expect(t.amount).toBe('10000');
    }
  });

  it('WasteGraded: grade preserved', () => {
    const t = parseAndTransform('graded');
    expect(t.kind).toBe('WasteGraded');
    if (t.kind === 'WasteGraded') {
      expect(t.grade).toBe('A+');
    }
  });

  it('ProcessingStatusChanged: status preserved', () => {
    const t = parseAndTransform('proc_upd');
    expect(t.kind).toBe('ProcessingStatusChanged');
    if (t.kind === 'ProcessingStatusChanged') {
      expect(t.status).toBe(2);
    }
  });

  it('WasteContaminated: level preserved', () => {
    const t = parseAndTransform('contam');
    expect(t.kind).toBe('WasteContaminated');
    if (t.kind === 'WasteContaminated') {
      expect(t.level).toBe(3);
    }
  });

  it('AuctionCreated: creator normalized', () => {
    const t = parseAndTransform('auc_cre');
    expect(t.kind).toBe('AuctionCreated');
    if (t.kind === 'AuctionCreated') {
      expect(t.creator).toBe('GADDR_CREATOR');
      expect(t.startPrice).toBe('5000');
    }
  });

  it('AuctionEnded: winner normalized when present', () => {
    const t = parseAndTransform('auc_end');
    expect(t.kind).toBe('AuctionEnded');
    if (t.kind === 'AuctionEnded') {
      expect(t.winner).toBe('GADDR_WINNER');
      expect(t.finalPrice).toBe('6500');
    }
  });

  it('AuctionEnded: winner remains null when absent', () => {
    const parsed: ParsedEvent = {
      kind: 'AuctionEnded',
      ledgerSequence: 1000,
      ledgerCloseTime: new Date(),
      transactionHash: '0x0',
      contractId: 'C',
      auctionId: 'a1',
      winner: null,
      finalPrice: '0',
    };
    const t = transformEvent(parsed);
    expect(t.kind).toBe('AuctionEnded');
    if (t.kind === 'AuctionEnded') {
      expect(t.winner).toBeNull();
    }
  });

  it('CarbonCreditsEarned: wasteType mapped from wasteTypeNum=3 → Metal', () => {
    const t = parseAndTransform('carbon');
    expect(t.kind).toBe('CarbonCreditsEarned');
    if (t.kind === 'CarbonCreditsEarned') {
      expect(t.wasteType).toBe('Metal');
      expect(t.credits).toBe('125');
    }
  });

  it('WasteRegistered: unknown wasteTypeNum falls back to DEFAULT_WASTE_TYPE (Paper)', () => {
    const parsed: ParsedEvent = {
      kind: 'WasteRegistered',
      ledgerSequence: 1000,
      ledgerCloseTime: new Date(),
      transactionHash: '0x0',
      contractId: 'C',
      wasteId: 'w1',
      wasteTypeNum: 999, // unmapped
      weight: '1',
      recycler: 'ADDR',
      lat: '0',
      lon: '0',
    };
    const t = transformEvent(parsed);
    if (t.kind === 'WasteRegistered') {
      expect(t.wasteType).toBe('Paper'); // DEFAULT_WASTE_TYPE
    }
  });

  it('ParticipantRegistered: unknown roleNum falls back to DEFAULT_PARTICIPANT_ROLE (Recycler)', () => {
    const parsed: ParsedEvent = {
      kind: 'ParticipantRegistered',
      ledgerSequence: 1000,
      ledgerCloseTime: new Date(),
      transactionHash: '0x0',
      contractId: 'C',
      address: 'ADDR',
      roleNum: 999,
      name: 'Bob',
      lat: '0',
      lon: '0',
    };
    const t = transformEvent(parsed);
    if (t.kind === 'ParticipantRegistered') {
      expect(t.role).toBe('Recycler');
    }
  });

  it('addresses are trimmed of leading/trailing whitespace', () => {
    const parsed: ParsedEvent = {
      kind: 'WasteRegistered',
      ledgerSequence: 1000,
      ledgerCloseTime: new Date(),
      transactionHash: '0x0',
      contractId: 'C',
      wasteId: 'w1',
      wasteTypeNum: 0,
      weight: '1',
      recycler: '  GADDR_TRIMMED  ',
      lat: '0',
      lon: '0',
    };
    const t = transformEvent(parsed);
    if (t.kind === 'WasteRegistered') {
      expect(t.recycler).toBe('GADDR_TRIMMED');
    }
  });
});

// =============================================================================
// 4. Store stage — SQL text and parameter binding (mock PoolClient)
// =============================================================================

describe('store stage — SQL correctness', () => {
  it('WasteRegistered: INSERT INTO wastes with ON CONFLICT DO NOTHING', async () => {
    const client = makeMockClient();
    const t = transformEvent(parseEvent(loadFixture('recycled')));
    await storeEvent(client as unknown as import('pg').PoolClient, t);
    expect(client._calls).toHaveLength(1);
    expect(client._calls[0].sql).toContain('INSERT INTO wastes');
    expect(client._calls[0].sql).toContain('ON CONFLICT (id) DO NOTHING');
    const params = client._calls[0].params;
    expect(params[0]).toBe('waste_001');  // id
    expect(params[2]).toBe('PetPlastic'); // waste_type
  });

  it('ParticipantRegistered: INSERT INTO participants with ON CONFLICT DO UPDATE', async () => {
    const client = makeMockClient();
    const t = transformEvent(parseEvent(loadFixture('reg')));
    await storeEvent(client as unknown as import('pg').PoolClient, t);
    expect(client._calls[0].sql).toContain('INSERT INTO participants');
    expect(client._calls[0].sql).toContain('ON CONFLICT');
    const params = client._calls[0].params;
    expect(params[0]).toBe('GADDR_PARTICIPANT_001'); // address
    expect(params[1]).toBe('Collector');             // role
  });

  it('WasteTransferred: INSERT INTO waste_transfers', async () => {
    const client = makeMockClient();
    const t = transformEvent(parseEvent(loadFixture('transfer')));
    await storeEvent(client as unknown as import('pg').PoolClient, t);
    expect(client._calls[0].sql).toContain('INSERT INTO waste_transfers');
    const params = client._calls[0].params;
    expect(params[0]).toBe('waste_001');
    expect(params[1]).toBe('GADDR_FROM_001');
    expect(params[2]).toBe('GADDR_TO_001');
  });

  it('WasteConfirmed: UPDATE wastes SET is_confirmed = true', async () => {
    const client = makeMockClient();
    const t = transformEvent(parseEvent(loadFixture('confirmed')));
    await storeEvent(client as unknown as import('pg').PoolClient, t);
    expect(client._calls[0].sql).toContain('UPDATE wastes SET is_confirmed = true');
    expect(client._calls[0].params[0]).toBe('waste_001');
  });

  it('TokensRewarded: INSERT INTO token_rewards', async () => {
    const client = makeMockClient();
    const t = transformEvent(parseEvent(loadFixture('rewarded')));
    await storeEvent(client as unknown as import('pg').PoolClient, t);
    expect(client._calls[0].sql).toContain('INSERT INTO token_rewards');
    const params = client._calls[0].params;
    expect(params[0]).toBe('GADDR_RECIPIENT_001');
    expect(params[1]).toBe('10000');
  });

  it('WasteDeactivated: UPDATE wastes SET is_active = false', async () => {
    const client = makeMockClient();
    const t = transformEvent(parseEvent(loadFixture('deactive')));
    await storeEvent(client as unknown as import('pg').PoolClient, t);
    expect(client._calls[0].sql).toContain('UPDATE wastes SET is_active = false');
    expect(client._calls[0].params[0]).toBe('waste_001');
  });

  it('WasteGraded: UPDATE wastes SET grade', async () => {
    const client = makeMockClient();
    const t = transformEvent(parseEvent(loadFixture('graded')));
    await storeEvent(client as unknown as import('pg').PoolClient, t);
    expect(client._calls[0].sql).toContain('UPDATE wastes SET grade');
    const params = client._calls[0].params;
    expect(params[0]).toBe('A+');
    expect(params[1]).toBe('waste_001');
  });

  it('ProcessingStatusChanged: UPDATE wastes SET processing_status', async () => {
    const client = makeMockClient();
    const t = transformEvent(parseEvent(loadFixture('proc_upd')));
    await storeEvent(client as unknown as import('pg').PoolClient, t);
    expect(client._calls[0].sql).toContain('UPDATE wastes SET processing_status');
    expect(client._calls[0].params[0]).toBe(2);
  });

  it('WasteContaminated: UPDATE wastes SET contamination_level', async () => {
    const client = makeMockClient();
    const t = transformEvent(parseEvent(loadFixture('contam')));
    await storeEvent(client as unknown as import('pg').PoolClient, t);
    expect(client._calls[0].sql).toContain('UPDATE wastes SET contamination_level');
    expect(client._calls[0].params[0]).toBe(3);
    expect(client._calls[0].params[1]).toBe('waste_002');
  });

  it('AuctionCreated: INSERT INTO auctions with ON CONFLICT DO NOTHING', async () => {
    const client = makeMockClient();
    const t = transformEvent(parseEvent(loadFixture('auc_cre')));
    await storeEvent(client as unknown as import('pg').PoolClient, t);
    expect(client._calls[0].sql).toContain('INSERT INTO auctions');
    expect(client._calls[0].sql).toContain('ON CONFLICT (id) DO NOTHING');
    const params = client._calls[0].params;
    expect(params[0]).toBe('auction_001');
    expect(params[2]).toBe('GADDR_CREATOR');
  });

  it('AuctionEnded: UPDATE auctions SET is_ended = true', async () => {
    const client = makeMockClient();
    const t = transformEvent(parseEvent(loadFixture('auc_end')));
    await storeEvent(client as unknown as import('pg').PoolClient, t);
    expect(client._calls[0].sql).toContain('UPDATE auctions SET is_ended = true');
    const params = client._calls[0].params;
    expect(params[0]).toBe('GADDR_WINNER');
    expect(params[1]).toBe('6500');
    expect(params[2]).toBe('auction_001');
  });

  it('CarbonCreditsEarned: INSERT INTO carbon_credits', async () => {
    const client = makeMockClient();
    const t = transformEvent(parseEvent(loadFixture('carbon')));
    await storeEvent(client as unknown as import('pg').PoolClient, t);
    expect(client._calls[0].sql).toContain('INSERT INTO carbon_credits');
    const params = client._calls[0].params;
    expect(params[0]).toBe('GADDR_PARTICIPANT_001');
    expect(params[1]).toBe('Metal');
    expect(params[4]).toBe('125');
  });

  it('each storeEvent call issues exactly one query', async () => {
    const allTypes = [
      'recycled','reg','transfer','confirmed','rewarded',
      'deactive','graded','proc_upd','contam','auc_cre','auc_end','carbon',
    ];
    for (const eventType of allTypes) {
      const client = makeMockClient();
      const t = transformEvent(parseEvent(loadFixture(eventType)));
      await storeEvent(client as unknown as import('pg').PoolClient, t);
      expect(client._calls).toHaveLength(1);
    }
  });
});
