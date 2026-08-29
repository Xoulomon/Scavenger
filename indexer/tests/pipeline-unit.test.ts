/**
 * Comprehensive pipeline unit tests — Issue #1119
 *
 * Tests all three pipeline stages independently with exhaustive coverage:
 *   1. parse stage  — all 12 event types, valid payloads + every missing-field error path
 *   2. transform    — enum lookups, fallbacks, address normalization, null handling
 *   3. store stage  — correct SQL + correct parameter values for every event kind
 *   4. runPipeline  — end-to-end chain integration
 *
 * Each describe block is self-contained; helpers are defined once at the top.
 */

import { parseEvent, ParseError } from '../src/pipeline/parse';
import { transformEvent } from '../src/pipeline/transform';
import { storeEvent } from '../src/pipeline/store';
import { runPipeline } from '../src/pipeline/index';
import { RawContractEvent } from '../src/types';
import { ParsedEvent, TransformedEvent, EventMeta } from '../src/pipeline/types';
import { WASTE_TYPE_MAP, ROLE_MAP } from '../src/types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Build a minimal valid RawContractEvent, merging any overrides on top of
 * the shared defaults (ledger 1000, 2024-01-01, tx 0xabc, contract CONTRACT).
 */
function makeEvent(
  overrides: Partial<RawContractEvent> & { eventType: string; topic: string[]; value: unknown }
): RawContractEvent {
  return {
    ledgerSequence: 1000,
    ledgerCloseTime: new Date('2024-01-01T00:00:00Z'),
    transactionHash: '0xabc',
    contractId: 'CONTRACT',
    ...overrides,
  };
}

/** The standard EventMeta every parsed event should carry from makeEvent(). */
const EXPECTED_META: EventMeta = {
  ledgerSequence: 1000,
  ledgerCloseTime: new Date('2024-01-01T00:00:00Z'),
  transactionHash: '0xabc',
  contractId: 'CONTRACT',
};

/**
 * Create a lightweight mock PoolClient that captures every query call so we
 * can assert on SQL text and parameter values.
 */
function makeMockClient() {
  const queries: Array<{ text: string; values: unknown[] }> = [];
  const client = {
    query: jest.fn().mockImplementation((text: string, values: unknown[]) => {
      queries.push({ text, values });
      return Promise.resolve({ rows: [] });
    }),
    _queries: queries,
  };
  return client;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. PARSE STAGE
// ─────────────────────────────────────────────────────────────────────────────

describe('parse stage', () => {
  // ── EventMeta propagation ──────────────────────────────────────────────────

  describe('EventMeta propagation', () => {
    it('carries ledgerSequence, ledgerCloseTime, transactionHash, contractId into every parsed event', () => {
      const event = makeEvent({
        eventType: 'confirmed',
        topic: ['confirmed', 'WASTE-META'],
        value: [],
      });
      const parsed = parseEvent(event);
      expect(parsed.ledgerSequence).toBe(EXPECTED_META.ledgerSequence);
      expect(parsed.ledgerCloseTime).toEqual(EXPECTED_META.ledgerCloseTime);
      expect(parsed.transactionHash).toBe(EXPECTED_META.transactionHash);
      expect(parsed.contractId).toBe(EXPECTED_META.contractId);
    });

    it('reflects custom ledger metadata in the parsed result', () => {
      const closeTime = new Date('2025-06-15T12:00:00Z');
      const event = makeEvent({
        eventType: 'confirmed',
        topic: ['confirmed', 'W1'],
        value: [],
        ledgerSequence: 9999,
        ledgerCloseTime: closeTime,
        transactionHash: '0xDEADBEEF',
        contractId: 'MY_CONTRACT',
      });
      const parsed = parseEvent(event);
      expect(parsed.ledgerSequence).toBe(9999);
      expect(parsed.ledgerCloseTime).toBe(closeTime);
      expect(parsed.transactionHash).toBe('0xDEADBEEF');
      expect(parsed.contractId).toBe('MY_CONTRACT');
    });
  });

  // ── recycled → WasteRegistered ─────────────────────────────────────────────

  describe('recycled → WasteRegistered', () => {
    it('parses a fully-formed event', () => {
      const event = makeEvent({
        eventType: 'recycled',
        topic: ['recycled', 'WASTE-42'],
        value: [1, '500', 'ADDR_RECYCLER', '12000000', '34000000'],
      });
      const parsed = parseEvent(event);
      expect(parsed.kind).toBe('WasteRegistered');
      if (parsed.kind === 'WasteRegistered') {
        expect(parsed.wasteId).toBe('WASTE-42');
        expect(parsed.wasteTypeNum).toBe(1);
        expect(parsed.weight).toBe('500');
        expect(parsed.recycler).toBe('ADDR_RECYCLER');
        expect(parsed.lat).toBe('12000000');
        expect(parsed.lon).toBe('34000000');
      }
    });

    it('throws ParseError when topic[1] (waste_id) is missing', () => {
      const event = makeEvent({
        eventType: 'recycled',
        topic: ['recycled'], // waste_id absent
        value: [1, '500', 'ADDR', '0', '0'],
      });
      expect(() => parseEvent(event)).toThrow(ParseError);
      expect(() => parseEvent(event)).toThrow(/waste_id/);
    });

    it('throws ParseError when topic[1] (waste_id) is an empty string', () => {
      const event = makeEvent({
        eventType: 'recycled',
        topic: ['recycled', ''], // empty string treated as missing
        value: [1, '500', 'ADDR', '0', '0'],
      });
      expect(() => parseEvent(event)).toThrow(ParseError);
    });

    it('throws ParseError when value array is too short (missing lon at index 4)', () => {
      const event = makeEvent({
        eventType: 'recycled',
        topic: ['recycled', 'W1'],
        value: [1, '500', 'ADDR', '0'], // only 4 elements – lon (index 4) missing
      });
      expect(() => parseEvent(event)).toThrow(ParseError);
      expect(() => parseEvent(event)).toThrow(/lon/);
    });

    it('throws ParseError when value has only 2 elements (missing recycler)', () => {
      const event = makeEvent({
        eventType: 'recycled',
        topic: ['recycled', 'W1'],
        value: [1, '500'], // recycler (index 2) missing
      });
      expect(() => parseEvent(event)).toThrow(ParseError);
    });

    it('uses 0 as wasteTypeNum fallback when value[0] is null', () => {
      const event = makeEvent({
        eventType: 'recycled',
        topic: ['recycled', 'W1'],
        value: [null, '100', 'ADDR', '0', '0'],
      });
      const parsed = parseEvent(event);
      if (parsed.kind === 'WasteRegistered') {
        expect(parsed.wasteTypeNum).toBe(0);
      }
    });

    it('stringifies numeric recycler address', () => {
      const event = makeEvent({
        eventType: 'recycled',
        topic: ['recycled', 'W1'],
        value: [0, '100', 12345, '0', '0'],
      });
      const parsed = parseEvent(event);
      if (parsed.kind === 'WasteRegistered') {
        expect(parsed.recycler).toBe('12345');
      }
    });
  });

  // ── reg → ParticipantRegistered ────────────────────────────────────────────

  describe('reg → ParticipantRegistered', () => {
    it('parses a fully-formed event', () => {
      const event = makeEvent({
        eventType: 'reg',
        topic: ['reg', 'GADDR123'],
        value: [0, 'Alice', '48000000', '2000000'],
      });
      const parsed = parseEvent(event);
      expect(parsed.kind).toBe('ParticipantRegistered');
      if (parsed.kind === 'ParticipantRegistered') {
        expect(parsed.address).toBe('GADDR123');
        expect(parsed.roleNum).toBe(0);
        expect(parsed.name).toBe('Alice');
        expect(parsed.lat).toBe('48000000');
        expect(parsed.lon).toBe('2000000');
      }
    });

    it('throws ParseError when topic[1] (address) is missing', () => {
      const event = makeEvent({
        eventType: 'reg',
        topic: ['reg'], // address absent
        value: [0, 'Alice', '0', '0'],
      });
      expect(() => parseEvent(event)).toThrow(ParseError);
      expect(() => parseEvent(event)).toThrow(/address/);
    });

    it('throws ParseError when topic[1] (address) is empty string', () => {
      const event = makeEvent({
        eventType: 'reg',
        topic: ['reg', ''],
        value: [0, 'Alice', '0', '0'],
      });
      expect(() => parseEvent(event)).toThrow(ParseError);
    });

    it('throws ParseError when value array is too short (lon missing at index 3)', () => {
      const event = makeEvent({
        eventType: 'reg',
        topic: ['reg', 'GADDR'],
        value: [0, 'Alice', '0'], // only 3 elements – lon missing
      });
      expect(() => parseEvent(event)).toThrow(ParseError);
      expect(() => parseEvent(event)).toThrow(/lon/);
    });

    it('throws ParseError when name (value index 1) is missing', () => {
      const event = makeEvent({
        eventType: 'reg',
        topic: ['reg', 'GADDR'],
        value: [0], // only role present
      });
      expect(() => parseEvent(event)).toThrow(ParseError);
    });
  });

  // ── transfer → WasteTransferred ────────────────────────────────────────────

  describe('transfer → WasteTransferred', () => {
    it('parses from and to addresses', () => {
      const event = makeEvent({
        eventType: 'transfer',
        topic: ['transfer', 'WASTE-99'],
        value: ['FROM_ADDR', 'TO_ADDR'],
      });
      const parsed = parseEvent(event);
      expect(parsed.kind).toBe('WasteTransferred');
      if (parsed.kind === 'WasteTransferred') {
        expect(parsed.wasteId).toBe('WASTE-99');
        expect(parsed.from).toBe('FROM_ADDR');
        expect(parsed.to).toBe('TO_ADDR');
      }
    });

    it('throws ParseError when waste_id is missing from topic', () => {
      const event = makeEvent({
        eventType: 'transfer',
        topic: ['transfer'],
        value: ['FROM', 'TO'],
      });
      expect(() => parseEvent(event)).toThrow(ParseError);
      expect(() => parseEvent(event)).toThrow(/waste_id/);
    });

    it('throws ParseError when value has only one element (to missing)', () => {
      const event = makeEvent({
        eventType: 'transfer',
        topic: ['transfer', 'W1'],
        value: ['FROM_ONLY'], // to (index 1) missing
      });
      expect(() => parseEvent(event)).toThrow(ParseError);
      expect(() => parseEvent(event)).toThrow(/to/);
    });

    it('throws ParseError when value array is empty (from and to both missing)', () => {
      const event = makeEvent({
        eventType: 'transfer',
        topic: ['transfer', 'W1'],
        value: [],
      });
      expect(() => parseEvent(event)).toThrow(ParseError);
    });
  });

  // ── confirmed → WasteConfirmed ─────────────────────────────────────────────

  describe('confirmed → WasteConfirmed', () => {
    it('parses a well-formed event', () => {
      const event = makeEvent({
        eventType: 'confirmed',
        topic: ['confirmed', 'WASTE-55'],
        value: ['CONFIRMER_ADDR'],
      });
      const parsed = parseEvent(event);
      expect(parsed.kind).toBe('WasteConfirmed');
      if (parsed.kind === 'WasteConfirmed') {
        expect(parsed.wasteId).toBe('WASTE-55');
      }
    });

    it('parses even when value is empty (confirmer not needed)', () => {
      const event = makeEvent({
        eventType: 'confirmed',
        topic: ['confirmed', 'WASTE-55'],
        value: [],
      });
      const parsed = parseEvent(event);
      expect(parsed.kind).toBe('WasteConfirmed');
    });

    it('throws ParseError when waste_id is missing from topic', () => {
      const event = makeEvent({
        eventType: 'confirmed',
        topic: ['confirmed'],
        value: [],
      });
      expect(() => parseEvent(event)).toThrow(ParseError);
      expect(() => parseEvent(event)).toThrow(/waste_id/);
    });

    it('throws ParseError when waste_id topic entry is empty string', () => {
      const event = makeEvent({
        eventType: 'confirmed',
        topic: ['confirmed', ''],
        value: [],
      });
      expect(() => parseEvent(event)).toThrow(ParseError);
    });
  });

  // ── rewarded → TokensRewarded ─────────────────────────────────────────────

  describe('rewarded → TokensRewarded', () => {
    it('parses amount and waste_id from value', () => {
      const event = makeEvent({
        eventType: 'rewarded',
        topic: ['rewarded', 'RECIPIENT_ADDR'],
        value: ['1000', 'WASTE-42'],
      });
      const parsed = parseEvent(event);
      expect(parsed.kind).toBe('TokensRewarded');
      if (parsed.kind === 'TokensRewarded') {
        expect(parsed.recipient).toBe('RECIPIENT_ADDR');
        expect(parsed.amount).toBe('1000');
        expect(parsed.wasteId).toBe('WASTE-42');
      }
    });

    it('throws ParseError when recipient is missing from topic', () => {
      const event = makeEvent({
        eventType: 'rewarded',
        topic: ['rewarded'],
        value: ['1000', 'W1'],
      });
      expect(() => parseEvent(event)).toThrow(ParseError);
      expect(() => parseEvent(event)).toThrow(/recipient/);
    });

    it('throws ParseError when waste_id (value index 1) is missing', () => {
      const event = makeEvent({
        eventType: 'rewarded',
        topic: ['rewarded', 'RECIPIENT'],
        value: ['1000'], // waste_id (index 1) absent
      });
      expect(() => parseEvent(event)).toThrow(ParseError);
      expect(() => parseEvent(event)).toThrow(/waste_id/);
    });

    it('uses "0" as amount fallback when value[0] is null', () => {
      const event = makeEvent({
        eventType: 'rewarded',
        topic: ['rewarded', 'RECIPIENT'],
        value: [null, 'W1'],
      });
      const parsed = parseEvent(event);
      if (parsed.kind === 'TokensRewarded') {
        expect(parsed.amount).toBe('0');
      }
    });
  });

  // ── deactive → WasteDeactivated ────────────────────────────────────────────

  describe('deactive → WasteDeactivated', () => {
    it('parses a well-formed event', () => {
      const event = makeEvent({
        eventType: 'deactive',
        topic: ['deactive', 'WASTE-77'],
        value: [],
      });
      const parsed = parseEvent(event);
      expect(parsed.kind).toBe('WasteDeactivated');
      if (parsed.kind === 'WasteDeactivated') {
        expect(parsed.wasteId).toBe('WASTE-77');
      }
    });

    it('throws ParseError when waste_id is missing from topic', () => {
      const event = makeEvent({
        eventType: 'deactive',
        topic: ['deactive'],
        value: [],
      });
      expect(() => parseEvent(event)).toThrow(ParseError);
      expect(() => parseEvent(event)).toThrow(/waste_id/);
    });

    it('throws ParseError when waste_id topic entry is empty string', () => {
      const event = makeEvent({
        eventType: 'deactive',
        topic: ['deactive', ''],
        value: [],
      });
      expect(() => parseEvent(event)).toThrow(ParseError);
    });
  });

  // ── graded → WasteGraded ──────────────────────────────────────────────────

  describe('graded → WasteGraded', () => {
    it('parses waste_id and grade', () => {
      const event = makeEvent({
        eventType: 'graded',
        topic: ['graded', 'WASTE-11'],
        value: ['A+', 'GRADER_ADDR'],
      });
      const parsed = parseEvent(event);
      expect(parsed.kind).toBe('WasteGraded');
      if (parsed.kind === 'WasteGraded') {
        expect(parsed.wasteId).toBe('WASTE-11');
        expect(parsed.grade).toBe('A+');
      }
    });

    it('throws ParseError when waste_id is missing from topic', () => {
      const event = makeEvent({
        eventType: 'graded',
        topic: ['graded'],
        value: ['B'],
      });
      expect(() => parseEvent(event)).toThrow(ParseError);
      expect(() => parseEvent(event)).toThrow(/waste_id/);
    });

    it('throws ParseError when grade (value index 0) is missing', () => {
      const event = makeEvent({
        eventType: 'graded',
        topic: ['graded', 'W1'],
        value: [], // grade absent
      });
      expect(() => parseEvent(event)).toThrow(ParseError);
      expect(() => parseEvent(event)).toThrow(/grade/);
    });
  });

  // ── proc_upd → ProcessingStatusChanged ────────────────────────────────────

  describe('proc_upd → ProcessingStatusChanged', () => {
    it('parses waste_id and status', () => {
      const event = makeEvent({
        eventType: 'proc_upd',
        topic: ['proc_upd', 'WASTE-33'],
        value: ['CALLER_ADDR', 2],
      });
      const parsed = parseEvent(event);
      expect(parsed.kind).toBe('ProcessingStatusChanged');
      if (parsed.kind === 'ProcessingStatusChanged') {
        expect(parsed.wasteId).toBe('WASTE-33');
        expect(parsed.status).toBe(2);
      }
    });

    it('throws ParseError when waste_id is missing from topic', () => {
      const event = makeEvent({
        eventType: 'proc_upd',
        topic: ['proc_upd'],
        value: ['CALLER', 1],
      });
      expect(() => parseEvent(event)).toThrow(ParseError);
      expect(() => parseEvent(event)).toThrow(/waste_id/);
    });

    it('throws ParseError when status (value index 1) is missing', () => {
      const event = makeEvent({
        eventType: 'proc_upd',
        topic: ['proc_upd', 'W1'],
        value: ['CALLER_ONLY'], // status (index 1) absent
      });
      expect(() => parseEvent(event)).toThrow(ParseError);
      expect(() => parseEvent(event)).toThrow(/status/);
    });

    it('throws ParseError when value is empty', () => {
      const event = makeEvent({
        eventType: 'proc_upd',
        topic: ['proc_upd', 'W1'],
        value: [],
      });
      expect(() => parseEvent(event)).toThrow(ParseError);
    });
  });

  // ── contam → WasteContaminated ────────────────────────────────────────────

  describe('contam → WasteContaminated', () => {
    it('parses waste_id and contamination level', () => {
      const event = makeEvent({
        eventType: 'contam',
        topic: ['contam', 'WASTE-88'],
        value: ['VERIFIER_ADDR', 3],
      });
      const parsed = parseEvent(event);
      expect(parsed.kind).toBe('WasteContaminated');
      if (parsed.kind === 'WasteContaminated') {
        expect(parsed.wasteId).toBe('WASTE-88');
        expect(parsed.level).toBe(3);
      }
    });

    it('throws ParseError when waste_id is missing from topic', () => {
      const event = makeEvent({
        eventType: 'contam',
        topic: ['contam'],
        value: ['VERIFIER', 1],
      });
      expect(() => parseEvent(event)).toThrow(ParseError);
      expect(() => parseEvent(event)).toThrow(/waste_id/);
    });

    it('throws ParseError when level (value index 1) is missing', () => {
      const event = makeEvent({
        eventType: 'contam',
        topic: ['contam', 'W1'],
        value: ['VERIFIER_ONLY'], // level (index 1) absent
      });
      expect(() => parseEvent(event)).toThrow(ParseError);
      expect(() => parseEvent(event)).toThrow(/level/);
    });

    it('throws ParseError when value is empty', () => {
      const event = makeEvent({
        eventType: 'contam',
        topic: ['contam', 'W1'],
        value: [],
      });
      expect(() => parseEvent(event)).toThrow(ParseError);
    });
  });

  // ── auc_cre → AuctionCreated ──────────────────────────────────────────────

  describe('auc_cre → AuctionCreated', () => {
    it('parses all auction fields', () => {
      const event = makeEvent({
        eventType: 'auc_cre',
        topic: ['auc_cre', 'AUC-7'],
        value: ['WASTE-99', 'CREATOR_ADDR', '500', '1700000000'],
      });
      const parsed = parseEvent(event);
      expect(parsed.kind).toBe('AuctionCreated');
      if (parsed.kind === 'AuctionCreated') {
        expect(parsed.auctionId).toBe('AUC-7');
        expect(parsed.wasteId).toBe('WASTE-99');
        expect(parsed.creator).toBe('CREATOR_ADDR');
        expect(parsed.startPrice).toBe('500');
        expect(parsed.endTime).toBe('1700000000');
      }
    });

    it('throws ParseError when auction_id is missing from topic', () => {
      const event = makeEvent({
        eventType: 'auc_cre',
        topic: ['auc_cre'],
        value: ['W1', 'CREATOR', '100', '9999'],
      });
      expect(() => parseEvent(event)).toThrow(ParseError);
      expect(() => parseEvent(event)).toThrow(/auction_id/);
    });

    it('throws ParseError when end_time (value index 3) is missing', () => {
      const event = makeEvent({
        eventType: 'auc_cre',
        topic: ['auc_cre', 'A1'],
        value: ['W1', 'CREATOR', '100'], // end_time (index 3) absent
      });
      expect(() => parseEvent(event)).toThrow(ParseError);
      expect(() => parseEvent(event)).toThrow(/end_time/);
    });

    it('throws ParseError when creator (value index 1) is missing', () => {
      const event = makeEvent({
        eventType: 'auc_cre',
        topic: ['auc_cre', 'A1'],
        value: ['W1'], // only wasteId
      });
      expect(() => parseEvent(event)).toThrow(ParseError);
    });

    it('uses "0" for wasteId when value[0] is null', () => {
      const event = makeEvent({
        eventType: 'auc_cre',
        topic: ['auc_cre', 'A1'],
        value: [null, 'CREATOR', '100', '9999'],
      });
      const parsed = parseEvent(event);
      if (parsed.kind === 'AuctionCreated') {
        expect(parsed.wasteId).toBe('0');
      }
    });
  });

  // ── auc_end → AuctionEnded ────────────────────────────────────────────────

  describe('auc_end → AuctionEnded', () => {
    it('parses with a non-null winner', () => {
      const event = makeEvent({
        eventType: 'auc_end',
        topic: ['auc_end', 'AUC-7'],
        value: ['WINNER_ADDR', '750'],
      });
      const parsed = parseEvent(event);
      expect(parsed.kind).toBe('AuctionEnded');
      if (parsed.kind === 'AuctionEnded') {
        expect(parsed.auctionId).toBe('AUC-7');
        expect(parsed.winner).toBe('WINNER_ADDR');
        expect(parsed.finalPrice).toBe('750');
      }
    });

    it('parses with a null winner (no bids)', () => {
      const event = makeEvent({
        eventType: 'auc_end',
        topic: ['auc_end', 'AUC-7'],
        value: [null, '0'],
      });
      const parsed = parseEvent(event);
      expect(parsed.kind).toBe('AuctionEnded');
      if (parsed.kind === 'AuctionEnded') {
        expect(parsed.winner).toBeNull();
      }
    });

    it('parses with an undefined winner as null', () => {
      const event = makeEvent({
        eventType: 'auc_end',
        topic: ['auc_end', 'AUC-7'],
        value: [undefined, '0'],
      });
      const parsed = parseEvent(event);
      if (parsed.kind === 'AuctionEnded') {
        expect(parsed.winner).toBeNull();
      }
    });

    it('throws ParseError when auction_id is missing from topic', () => {
      const event = makeEvent({
        eventType: 'auc_end',
        topic: ['auc_end'],
        value: ['WINNER', '500'],
      });
      expect(() => parseEvent(event)).toThrow(ParseError);
      expect(() => parseEvent(event)).toThrow(/auction_id/);
    });

    it('throws ParseError when final_price (value index 1) is missing', () => {
      const event = makeEvent({
        eventType: 'auc_end',
        topic: ['auc_end', 'A1'],
        value: ['WINNER'], // final_price (index 1) absent
      });
      expect(() => parseEvent(event)).toThrow(ParseError);
      expect(() => parseEvent(event)).toThrow(/final_price/);
    });
  });

  // ── carbon → CarbonCreditsEarned ──────────────────────────────────────────

  describe('carbon → CarbonCreditsEarned', () => {
    it('parses participant, wasteTypeNum, weight, credits', () => {
      const event = makeEvent({
        eventType: 'carbon',
        topic: ['carbon', 'PART_ADDR'],
        value: [2, '300', '15'],
      });
      const parsed = parseEvent(event);
      expect(parsed.kind).toBe('CarbonCreditsEarned');
      if (parsed.kind === 'CarbonCreditsEarned') {
        expect(parsed.participant).toBe('PART_ADDR');
        expect(parsed.wasteTypeNum).toBe(2);
        expect(parsed.weight).toBe('300');
        expect(parsed.credits).toBe('15');
      }
    });

    it('throws ParseError when participant is missing from topic', () => {
      const event = makeEvent({
        eventType: 'carbon',
        topic: ['carbon'],
        value: [0, '100', '5'],
      });
      expect(() => parseEvent(event)).toThrow(ParseError);
      expect(() => parseEvent(event)).toThrow(/participant/);
    });

    it('throws ParseError when credits (value index 2) is missing', () => {
      const event = makeEvent({
        eventType: 'carbon',
        topic: ['carbon', 'PART'],
        value: [0, '100'], // credits (index 2) absent
      });
      expect(() => parseEvent(event)).toThrow(ParseError);
      expect(() => parseEvent(event)).toThrow(/credits/);
    });

    it('uses 0 as wasteTypeNum fallback when value[0] is null', () => {
      const event = makeEvent({
        eventType: 'carbon',
        topic: ['carbon', 'PART'],
        value: [null, '100', '5'],
      });
      const parsed = parseEvent(event);
      if (parsed.kind === 'CarbonCreditsEarned') {
        expect(parsed.wasteTypeNum).toBe(0);
      }
    });
  });

  // ── Unknown and edge-case event types ─────────────────────────────────────

  describe('unknown / malformed event type', () => {
    it('throws ParseError for a completely unknown event type', () => {
      const event = makeEvent({
        eventType: 'unknown_xyz',
        topic: ['unknown_xyz'],
        value: [],
      });
      expect(() => parseEvent(event)).toThrow(ParseError);
      expect(() => parseEvent(event)).toThrow(/unknown event type/);
    });

    it('throws ParseError for empty string event type', () => {
      const event = makeEvent({
        eventType: '',
        topic: [''],
        value: [],
      });
      expect(() => parseEvent(event)).toThrow(ParseError);
    });

    it('sets ParseError.name to "ParseError"', () => {
      try {
        parseEvent(makeEvent({ eventType: 'bad', topic: [], value: [] }));
      } catch (err) {
        expect((err as ParseError).name).toBe('ParseError');
      }
    });

    it('sets ParseError.eventType to the unknown type string', () => {
      let caught: ParseError | null = null;
      try {
        parseEvent(makeEvent({ eventType: 'oops', topic: [], value: [] }));
      } catch (err) {
        caught = err as ParseError;
      }
      expect(caught).not.toBeNull();
      expect(caught!.eventType).toBe('oops');
    });

    it('ParseError.eventType reflects the field name on missing-field errors', () => {
      let caught: ParseError | null = null;
      try {
        parseEvent(
          makeEvent({ eventType: 'recycled', topic: ['recycled'], value: [0, '1', 'A', '0', '0'] })
        );
      } catch (err) {
        caught = err as ParseError;
      }
      expect(caught).not.toBeNull();
      expect(caught!.eventType).toBe('recycled');
    });

    it('throws ParseError for a near-miss event type (e.g. "Recycled" with capital R)', () => {
      const event = makeEvent({
        eventType: 'Recycled',
        topic: ['Recycled', 'W1'],
        value: [0, '100', 'ADDR', '0', '0'],
      });
      expect(() => parseEvent(event)).toThrow(ParseError);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. TRANSFORM STAGE
// ─────────────────────────────────────────────────────────────────────────────

describe('transform stage', () => {
  // Helper to build a minimal ParsedEvent with shared metadata
  const META: EventMeta = {
    ledgerSequence: 1000,
    ledgerCloseTime: new Date('2024-01-01T00:00:00Z'),
    transactionHash: '0xabc',
    contractId: 'CONTRACT',
  };

  // ── WasteRegistered ────────────────────────────────────────────────────────

  describe('WasteRegistered — wasteTypeNum mapping', () => {
    const cases: Array<[number, string]> = Object.entries(WASTE_TYPE_MAP).map(
      ([k, v]) => [Number(k), v]
    );

    it.each(cases)('maps wasteTypeNum %i → %s', (num, expected) => {
      const parsed: ParsedEvent = {
        ...META,
        kind: 'WasteRegistered',
        wasteId: '1',
        wasteTypeNum: num,
        weight: '100',
        recycler: 'ADDR',
        lat: '0',
        lon: '0',
      };
      const result = transformEvent(parsed);
      expect(result.kind).toBe('WasteRegistered');
      if (result.kind === 'WasteRegistered') {
        expect(result.wasteType).toBe(expected);
      }
    });

    it('falls back to "Paper" for unknown wasteTypeNum (999)', () => {
      const parsed: ParsedEvent = {
        ...META,
        kind: 'WasteRegistered',
        wasteId: '1',
        wasteTypeNum: 999,
        weight: '100',
        recycler: 'ADDR',
        lat: '0',
        lon: '0',
      };
      const result = transformEvent(parsed);
      if (result.kind === 'WasteRegistered') {
        expect(result.wasteType).toBe('Paper');
      }
    });

    it('trims whitespace from recycler address', () => {
      const parsed: ParsedEvent = {
        ...META,
        kind: 'WasteRegistered',
        wasteId: '1',
        wasteTypeNum: 0,
        weight: '100',
        recycler: '  GADDR  ',
        lat: '0',
        lon: '0',
      };
      const result = transformEvent(parsed);
      if (result.kind === 'WasteRegistered') {
        expect(result.recycler).toBe('GADDR');
      }
    });

    it('preserves metadata fields through transform', () => {
      const parsed: ParsedEvent = {
        ...META,
        kind: 'WasteRegistered',
        wasteId: 'W1',
        wasteTypeNum: 0,
        weight: '50',
        recycler: 'R',
        lat: '1',
        lon: '2',
      };
      const result = transformEvent(parsed);
      expect(result.ledgerSequence).toBe(META.ledgerSequence);
      expect(result.ledgerCloseTime).toBe(META.ledgerCloseTime);
      expect(result.transactionHash).toBe(META.transactionHash);
      expect(result.contractId).toBe(META.contractId);
    });
  });

  // ── ParticipantRegistered ─────────────────────────────────────────────────

  describe('ParticipantRegistered — roleNum mapping', () => {
    const roleCases: Array<[number, string]> = Object.entries(ROLE_MAP).map(
      ([k, v]) => [Number(k), v]
    );

    it.each(roleCases)('maps roleNum %i → %s', (num, expected) => {
      const parsed: ParsedEvent = {
        ...META,
        kind: 'ParticipantRegistered',
        address: 'GADDR',
        roleNum: num,
        name: 'Alice',
        lat: '0',
        lon: '0',
      };
      const result = transformEvent(parsed);
      expect(result.kind).toBe('ParticipantRegistered');
      if (result.kind === 'ParticipantRegistered') {
        expect(result.role).toBe(expected);
      }
    });

    it('falls back to "Recycler" for unknown roleNum (999)', () => {
      const parsed: ParsedEvent = {
        ...META,
        kind: 'ParticipantRegistered',
        address: 'GADDR',
        roleNum: 999,
        name: 'Alice',
        lat: '0',
        lon: '0',
      };
      const result = transformEvent(parsed);
      if (result.kind === 'ParticipantRegistered') {
        expect(result.role).toBe('Recycler');
      }
    });

    it('normalizes address by trimming whitespace', () => {
      const parsed: ParsedEvent = {
        ...META,
        kind: 'ParticipantRegistered',
        address: '  GADDR123  ',
        roleNum: 0,
        name: 'Bob',
        lat: '0',
        lon: '0',
      };
      const result = transformEvent(parsed);
      if (result.kind === 'ParticipantRegistered') {
        expect(result.address).toBe('GADDR123');
      }
    });

    it('trims name whitespace', () => {
      const parsed: ParsedEvent = {
        ...META,
        kind: 'ParticipantRegistered',
        address: 'GADDR',
        roleNum: 0,
        name: '  Alice  ',
        lat: '0',
        lon: '0',
      };
      const result = transformEvent(parsed);
      if (result.kind === 'ParticipantRegistered') {
        expect(result.name).toBe('Alice');
      }
    });
  });

  // ── WasteTransferred ──────────────────────────────────────────────────────

  describe('WasteTransferred — address normalization', () => {
    it('trims leading and trailing spaces from from and to', () => {
      const parsed: ParsedEvent = {
        ...META,
        kind: 'WasteTransferred',
        wasteId: 'W1',
        from: '  FROM_ADDR  ',
        to: '  TO_ADDR  ',
      };
      const result = transformEvent(parsed);
      if (result.kind === 'WasteTransferred') {
        expect(result.from).toBe('FROM_ADDR');
        expect(result.to).toBe('TO_ADDR');
      }
    });

    it('leaves already-normalized addresses unchanged', () => {
      const parsed: ParsedEvent = {
        ...META,
        kind: 'WasteTransferred',
        wasteId: 'W1',
        from: 'FROM',
        to: 'TO',
      };
      const result = transformEvent(parsed);
      if (result.kind === 'WasteTransferred') {
        expect(result.from).toBe('FROM');
        expect(result.to).toBe('TO');
      }
    });

    it('passes metadata fields through unchanged', () => {
      const parsed: ParsedEvent = {
        ...META,
        kind: 'WasteTransferred',
        wasteId: 'W2',
        from: 'F',
        to: 'T',
      };
      const result = transformEvent(parsed);
      expect(result.ledgerSequence).toBe(META.ledgerSequence);
    });
  });

  // ── WasteConfirmed — passthrough ──────────────────────────────────────────

  describe('WasteConfirmed — passthrough', () => {
    it('passes event through unchanged (kind + wasteId)', () => {
      const parsed: ParsedEvent = {
        ...META,
        kind: 'WasteConfirmed',
        wasteId: 'W-CONFIRM',
      };
      const result = transformEvent(parsed);
      expect(result.kind).toBe('WasteConfirmed');
      if (result.kind === 'WasteConfirmed') {
        expect(result.wasteId).toBe('W-CONFIRM');
      }
    });
  });

  // ── TokensRewarded ────────────────────────────────────────────────────────

  describe('TokensRewarded — recipient normalization', () => {
    it('trims whitespace from recipient', () => {
      const parsed: ParsedEvent = {
        ...META,
        kind: 'TokensRewarded',
        recipient: '  RECIP_ADDR  ',
        amount: '500',
        wasteId: 'W1',
      };
      const result = transformEvent(parsed);
      if (result.kind === 'TokensRewarded') {
        expect(result.recipient).toBe('RECIP_ADDR');
      }
    });

    it('preserves amount and wasteId', () => {
      const parsed: ParsedEvent = {
        ...META,
        kind: 'TokensRewarded',
        recipient: 'RECIP',
        amount: '1234',
        wasteId: 'W99',
      };
      const result = transformEvent(parsed);
      if (result.kind === 'TokensRewarded') {
        expect(result.amount).toBe('1234');
        expect(result.wasteId).toBe('W99');
      }
    });
  });

  // ── WasteDeactivated — passthrough ────────────────────────────────────────

  describe('WasteDeactivated — passthrough', () => {
    it('passes event through with wasteId intact', () => {
      const parsed: ParsedEvent = {
        ...META,
        kind: 'WasteDeactivated',
        wasteId: 'W-DEACT',
      };
      const result = transformEvent(parsed);
      expect(result.kind).toBe('WasteDeactivated');
      if (result.kind === 'WasteDeactivated') {
        expect(result.wasteId).toBe('W-DEACT');
      }
    });
  });

  // ── WasteGraded — passthrough ─────────────────────────────────────────────

  describe('WasteGraded — passthrough', () => {
    it('passes event through with grade intact', () => {
      const parsed: ParsedEvent = {
        ...META,
        kind: 'WasteGraded',
        wasteId: 'W-GRADE',
        grade: 'A',
      };
      const result = transformEvent(parsed);
      expect(result.kind).toBe('WasteGraded');
      if (result.kind === 'WasteGraded') {
        expect(result.wasteId).toBe('W-GRADE');
        expect(result.grade).toBe('A');
      }
    });
  });

  // ── ProcessingStatusChanged — passthrough ─────────────────────────────────

  describe('ProcessingStatusChanged — passthrough', () => {
    it('passes event through with status intact', () => {
      const parsed: ParsedEvent = {
        ...META,
        kind: 'ProcessingStatusChanged',
        wasteId: 'W-STATUS',
        status: 3,
      };
      const result = transformEvent(parsed);
      expect(result.kind).toBe('ProcessingStatusChanged');
      if (result.kind === 'ProcessingStatusChanged') {
        expect(result.status).toBe(3);
      }
    });
  });

  // ── WasteContaminated — passthrough ──────────────────────────────────────

  describe('WasteContaminated — passthrough', () => {
    it('passes event through with contamination level intact', () => {
      const parsed: ParsedEvent = {
        ...META,
        kind: 'WasteContaminated',
        wasteId: 'W-CONTAM',
        level: 5,
      };
      const result = transformEvent(parsed);
      expect(result.kind).toBe('WasteContaminated');
      if (result.kind === 'WasteContaminated') {
        expect(result.level).toBe(5);
      }
    });
  });

  // ── AuctionCreated ────────────────────────────────────────────────────────

  describe('AuctionCreated — creator normalization', () => {
    it('trims whitespace from creator address', () => {
      const parsed: ParsedEvent = {
        ...META,
        kind: 'AuctionCreated',
        auctionId: 'A1',
        wasteId: 'W1',
        creator: '  CREATOR_ADDR  ',
        startPrice: '100',
        endTime: '9999',
      };
      const result = transformEvent(parsed);
      if (result.kind === 'AuctionCreated') {
        expect(result.creator).toBe('CREATOR_ADDR');
      }
    });

    it('preserves all other auction fields', () => {
      const parsed: ParsedEvent = {
        ...META,
        kind: 'AuctionCreated',
        auctionId: 'AUC-99',
        wasteId: 'WASTE-42',
        creator: 'C',
        startPrice: '200',
        endTime: '12345',
      };
      const result = transformEvent(parsed);
      if (result.kind === 'AuctionCreated') {
        expect(result.auctionId).toBe('AUC-99');
        expect(result.wasteId).toBe('WASTE-42');
        expect(result.startPrice).toBe('200');
        expect(result.endTime).toBe('12345');
      }
    });
  });

  // ── AuctionEnded ──────────────────────────────────────────────────────────

  describe('AuctionEnded — winner normalization and null handling', () => {
    it('trims whitespace from non-null winner', () => {
      const parsed: ParsedEvent = {
        ...META,
        kind: 'AuctionEnded',
        auctionId: 'A1',
        winner: '  WINNER_ADDR  ',
        finalPrice: '750',
      };
      const result = transformEvent(parsed);
      if (result.kind === 'AuctionEnded') {
        expect(result.winner).toBe('WINNER_ADDR');
      }
    });

    it('keeps null winner as null', () => {
      const parsed: ParsedEvent = {
        ...META,
        kind: 'AuctionEnded',
        auctionId: 'A1',
        winner: null,
        finalPrice: '0',
      };
      const result = transformEvent(parsed);
      if (result.kind === 'AuctionEnded') {
        expect(result.winner).toBeNull();
      }
    });

    it('preserves finalPrice', () => {
      const parsed: ParsedEvent = {
        ...META,
        kind: 'AuctionEnded',
        auctionId: 'A1',
        winner: 'W',
        finalPrice: '9999',
      };
      const result = transformEvent(parsed);
      if (result.kind === 'AuctionEnded') {
        expect(result.finalPrice).toBe('9999');
      }
    });
  });

  // ── CarbonCreditsEarned ───────────────────────────────────────────────────

  describe('CarbonCreditsEarned — wasteType mapping + participant normalization', () => {
    it('maps wasteTypeNum to WasteType string', () => {
      const parsed: ParsedEvent = {
        ...META,
        kind: 'CarbonCreditsEarned',
        participant: 'PART',
        wasteTypeNum: 3, // Metal in actual WASTE_TYPE_MAP
        weight: '100',
        credits: '10',
      };
      const result = transformEvent(parsed);
      if (result.kind === 'CarbonCreditsEarned') {
        expect(result.wasteType).toBe(WASTE_TYPE_MAP[3]);
      }
    });

    it('falls back to "Paper" for unknown wasteTypeNum', () => {
      const parsed: ParsedEvent = {
        ...META,
        kind: 'CarbonCreditsEarned',
        participant: 'PART',
        wasteTypeNum: 9999,
        weight: '100',
        credits: '10',
      };
      const result = transformEvent(parsed);
      if (result.kind === 'CarbonCreditsEarned') {
        expect(result.wasteType).toBe('Paper');
      }
    });

    it('trims whitespace from participant address', () => {
      const parsed: ParsedEvent = {
        ...META,
        kind: 'CarbonCreditsEarned',
        participant: '  PART_ADDR  ',
        wasteTypeNum: 0,
        weight: '50',
        credits: '5',
      };
      const result = transformEvent(parsed);
      if (result.kind === 'CarbonCreditsEarned') {
        expect(result.participant).toBe('PART_ADDR');
      }
    });

    it('preserves weight and credits through transform', () => {
      const parsed: ParsedEvent = {
        ...META,
        kind: 'CarbonCreditsEarned',
        participant: 'P',
        wasteTypeNum: 0,
        weight: '777',
        credits: '42',
      };
      const result = transformEvent(parsed);
      if (result.kind === 'CarbonCreditsEarned') {
        expect(result.weight).toBe('777');
        expect(result.credits).toBe('42');
      }
    });
  });

  // ── Metadata preserved across all kinds ───────────────────────────────────

  describe('metadata preserved across all transform kinds', () => {
    const kinds: Array<ParsedEvent> = [
      { ...META, kind: 'WasteDeactivated', wasteId: 'W1' },
      { ...META, kind: 'WasteGraded', wasteId: 'W1', grade: 'B' },
      { ...META, kind: 'ProcessingStatusChanged', wasteId: 'W1', status: 1 },
      { ...META, kind: 'WasteContaminated', wasteId: 'W1', level: 2 },
    ];

    it.each(kinds)('kind $kind preserves ledgerSequence', (parsed) => {
      const result = transformEvent(parsed);
      expect(result.ledgerSequence).toBe(META.ledgerSequence);
      expect(result.transactionHash).toBe(META.transactionHash);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. STORE STAGE
// ─────────────────────────────────────────────────────────────────────────────

describe('store stage', () => {
  const META: EventMeta = {
    ledgerSequence: 2000,
    ledgerCloseTime: new Date('2024-06-01T00:00:00Z'),
    transactionHash: '0xSTORE',
    contractId: 'STORE_CONTRACT',
  };

  // ── WasteRegistered ────────────────────────────────────────────────────────

  it('WasteRegistered: INSERT INTO wastes with waste_id, recycler, waste_type, weight', async () => {
    const client = makeMockClient();
    const event: TransformedEvent = {
      ...META,
      kind: 'WasteRegistered',
      wasteId: 'W-STORE-1',
      wasteType: 'Metal' as any,
      weight: '200',
      recycler: 'GADDR_RECYCLER',
      lat: '10',
      lon: '20',
    };
    await storeEvent(client as any, event);
    expect(client.query).toHaveBeenCalledTimes(1);
    const q = client._queries[0];
    expect(q.text).toMatch(/INSERT INTO wastes/i);
    expect(q.values).toContain('W-STORE-1');
    expect(q.values).toContain('GADDR_RECYCLER');
    expect(q.values).toContain('Metal');
    expect(q.values).toContain('200');
    expect(q.values).toContain('10');
    expect(q.values).toContain('20');
  });

  // ── ParticipantRegistered ─────────────────────────────────────────────────

  it('ParticipantRegistered: INSERT INTO participants with address, role, name', async () => {
    const client = makeMockClient();
    const event: TransformedEvent = {
      ...META,
      kind: 'ParticipantRegistered',
      address: 'GADDR_PARTICIPANT',
      role: 'Collector' as any,
      name: 'Alice',
      lat: '48',
      lon: '2',
    };
    await storeEvent(client as any, event);
    expect(client.query).toHaveBeenCalledTimes(1);
    const q = client._queries[0];
    expect(q.text).toMatch(/INSERT INTO participants/i);
    expect(q.values).toContain('GADDR_PARTICIPANT');
    expect(q.values).toContain('Collector');
    expect(q.values).toContain('Alice');
  });

  // ── WasteTransferred ──────────────────────────────────────────────────────

  it('WasteTransferred: INSERT INTO waste_transfers with from, to, waste_id', async () => {
    const client = makeMockClient();
    const event: TransformedEvent = {
      ...META,
      kind: 'WasteTransferred',
      wasteId: 'W-XFER',
      from: 'ADDR_FROM',
      to: 'ADDR_TO',
    };
    await storeEvent(client as any, event);
    expect(client.query).toHaveBeenCalledTimes(1);
    const q = client._queries[0];
    expect(q.text).toMatch(/INSERT INTO waste_transfers/i);
    expect(q.values).toContain('W-XFER');
    expect(q.values).toContain('ADDR_FROM');
    expect(q.values).toContain('ADDR_TO');
  });

  // ── WasteConfirmed ────────────────────────────────────────────────────────

  it('WasteConfirmed: UPDATE wastes SET is_confirmed = true WHERE id', async () => {
    const client = makeMockClient();
    const event: TransformedEvent = {
      ...META,
      kind: 'WasteConfirmed',
      wasteId: 'W-CONFIRM',
    };
    await storeEvent(client as any, event);
    expect(client.query).toHaveBeenCalledTimes(1);
    const q = client._queries[0];
    expect(q.text).toMatch(/UPDATE wastes/i);
    expect(q.text).toMatch(/is_confirmed/i);
    expect(q.values).toContain('W-CONFIRM');
  });

  // ── TokensRewarded ────────────────────────────────────────────────────────

  it('TokensRewarded: INSERT INTO token_rewards with recipient, amount, waste_id', async () => {
    const client = makeMockClient();
    const event: TransformedEvent = {
      ...META,
      kind: 'TokensRewarded',
      recipient: 'RECIP_ADDR',
      amount: '5000',
      wasteId: 'W-REWARD',
    };
    await storeEvent(client as any, event);
    expect(client.query).toHaveBeenCalledTimes(1);
    const q = client._queries[0];
    expect(q.text).toMatch(/INSERT INTO token_rewards/i);
    expect(q.values).toContain('RECIP_ADDR');
    expect(q.values).toContain('5000');
    expect(q.values).toContain('W-REWARD');
  });

  // ── WasteDeactivated ──────────────────────────────────────────────────────

  it('WasteDeactivated: UPDATE wastes SET is_active = false WHERE id', async () => {
    const client = makeMockClient();
    const event: TransformedEvent = {
      ...META,
      kind: 'WasteDeactivated',
      wasteId: 'W-DEACT',
    };
    await storeEvent(client as any, event);
    expect(client.query).toHaveBeenCalledTimes(1);
    const q = client._queries[0];
    expect(q.text).toMatch(/UPDATE wastes/i);
    expect(q.text).toMatch(/is_active/i);
    expect(q.values).toContain('W-DEACT');
  });

  // ── WasteGraded ───────────────────────────────────────────────────────────

  it('WasteGraded: UPDATE wastes SET grade WHERE id', async () => {
    const client = makeMockClient();
    const event: TransformedEvent = {
      ...META,
      kind: 'WasteGraded',
      wasteId: 'W-GRADED',
      grade: 'A+',
    };
    await storeEvent(client as any, event);
    expect(client.query).toHaveBeenCalledTimes(1);
    const q = client._queries[0];
    expect(q.text).toMatch(/UPDATE wastes/i);
    expect(q.text).toMatch(/grade/i);
    expect(q.values).toContain('A+');
    expect(q.values).toContain('W-GRADED');
  });

  // ── ProcessingStatusChanged ───────────────────────────────────────────────

  it('ProcessingStatusChanged: UPDATE wastes SET processing_status WHERE id', async () => {
    const client = makeMockClient();
    const event: TransformedEvent = {
      ...META,
      kind: 'ProcessingStatusChanged',
      wasteId: 'W-STATUS',
      status: 3,
    };
    await storeEvent(client as any, event);
    expect(client.query).toHaveBeenCalledTimes(1);
    const q = client._queries[0];
    expect(q.text).toMatch(/UPDATE wastes/i);
    expect(q.text).toMatch(/processing_status/i);
    expect(q.values).toContain(3);
    expect(q.values).toContain('W-STATUS');
  });

  // ── WasteContaminated ─────────────────────────────────────────────────────

  it('WasteContaminated: UPDATE wastes SET contamination_level WHERE id', async () => {
    const client = makeMockClient();
    const event: TransformedEvent = {
      ...META,
      kind: 'WasteContaminated',
      wasteId: 'W-CONTAM',
      level: 7,
    };
    await storeEvent(client as any, event);
    expect(client.query).toHaveBeenCalledTimes(1);
    const q = client._queries[0];
    expect(q.text).toMatch(/UPDATE wastes/i);
    expect(q.text).toMatch(/contamination_level/i);
    expect(q.values).toContain(7);
    expect(q.values).toContain('W-CONTAM');
  });

  // ── AuctionCreated ────────────────────────────────────────────────────────

  it('AuctionCreated: INSERT INTO auctions with auction_id, waste_id, creator', async () => {
    const client = makeMockClient();
    const event: TransformedEvent = {
      ...META,
      kind: 'AuctionCreated',
      auctionId: 'AUC-CREATE',
      wasteId: 'W-AUC',
      creator: 'CREATOR_ADDR',
      startPrice: '100',
      endTime: '99999',
    };
    await storeEvent(client as any, event);
    expect(client.query).toHaveBeenCalledTimes(1);
    const q = client._queries[0];
    expect(q.text).toMatch(/INSERT INTO auctions/i);
    expect(q.values).toContain('AUC-CREATE');
    expect(q.values).toContain('W-AUC');
    expect(q.values).toContain('CREATOR_ADDR');
    expect(q.values).toContain('100');
    expect(q.values).toContain('99999');
  });

  // ── AuctionEnded ──────────────────────────────────────────────────────────

  it('AuctionEnded: UPDATE auctions SET is_ended WHERE id (with winner)', async () => {
    const client = makeMockClient();
    const event: TransformedEvent = {
      ...META,
      kind: 'AuctionEnded',
      auctionId: 'AUC-END',
      winner: 'WINNER_ADDR',
      finalPrice: '850',
    };
    await storeEvent(client as any, event);
    expect(client.query).toHaveBeenCalledTimes(1);
    const q = client._queries[0];
    expect(q.text).toMatch(/UPDATE auctions/i);
    expect(q.text).toMatch(/is_ended/i);
    expect(q.values).toContain('AUC-END');
    expect(q.values).toContain('WINNER_ADDR');
    expect(q.values).toContain('850');
  });

  it('AuctionEnded: UPDATE auctions SET is_ended WHERE id (null winner)', async () => {
    const client = makeMockClient();
    const event: TransformedEvent = {
      ...META,
      kind: 'AuctionEnded',
      auctionId: 'AUC-NO-WIN',
      winner: null,
      finalPrice: '0',
    };
    await storeEvent(client as any, event);
    const q = client._queries[0];
    expect(q.text).toMatch(/UPDATE auctions/i);
    expect(q.values).toContain(null);
    expect(q.values).toContain('AUC-NO-WIN');
  });

  // ── CarbonCreditsEarned ───────────────────────────────────────────────────

  it('CarbonCreditsEarned: INSERT INTO carbon_credits with participant, waste_type, credits', async () => {
    const client = makeMockClient();
    const event: TransformedEvent = {
      ...META,
      kind: 'CarbonCreditsEarned',
      participant: 'PART_ADDR',
      wasteType: 'Glass' as any,
      weight: '300',
      credits: '15',
    };
    await storeEvent(client as any, event);
    expect(client.query).toHaveBeenCalledTimes(1);
    const q = client._queries[0];
    expect(q.text).toMatch(/INSERT INTO carbon_credits/i);
    expect(q.values).toContain('PART_ADDR');
    expect(q.values).toContain('Glass');
    expect(q.values).toContain('15');
    expect(q.values).toContain('300');
  });

  // ── Common: only one query fired per event ─────────────────────────────────

  it('each store operation executes exactly one query', async () => {
    const kinds: Array<TransformedEvent> = [
      { ...META, kind: 'WasteConfirmed', wasteId: 'W1' },
      { ...META, kind: 'WasteDeactivated', wasteId: 'W1' },
      { ...META, kind: 'WasteGraded', wasteId: 'W1', grade: 'C' },
      { ...META, kind: 'ProcessingStatusChanged', wasteId: 'W1', status: 0 },
      { ...META, kind: 'WasteContaminated', wasteId: 'W1', level: 1 },
      { ...META, kind: 'TokensRewarded', recipient: 'R', amount: '0', wasteId: 'W1' },
      { ...META, kind: 'AuctionEnded', auctionId: 'A1', winner: null, finalPrice: '0' },
    ];

    for (const event of kinds) {
      const client = makeMockClient();
      await storeEvent(client as any, event);
      expect(client.query).toHaveBeenCalledTimes(1);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. PIPELINE INTEGRATION (runPipeline)
// ─────────────────────────────────────────────────────────────────────────────

describe('runPipeline integration', () => {
  it('successfully chains parse → transform → store for a valid WasteRegistered event', async () => {
    const client = makeMockClient();
    const event = makeEvent({
      eventType: 'recycled',
      topic: ['recycled', 'PIPE-WASTE-1'],
      value: [1, '750', 'RECYCLER_ADDR', '10', '20'],
    });
    await runPipeline(client as any, event);
    expect(client.query).toHaveBeenCalledTimes(1);
    const q = client._queries[0];
    expect(q.text).toMatch(/INSERT INTO wastes/i);
    expect(q.values).toContain('PIPE-WASTE-1');
    expect(q.values).toContain('RECYCLER_ADDR');
  });

  it('successfully chains parse → transform → store for a valid ParticipantRegistered event', async () => {
    const client = makeMockClient();
    const event = makeEvent({
      eventType: 'reg',
      topic: ['reg', 'PIPELINE_PARTICIPANT'],
      value: [2, 'Charlie', '0', '0'],
    });
    await runPipeline(client as any, event);
    expect(client.query).toHaveBeenCalledTimes(1);
    const q = client._queries[0];
    expect(q.text).toMatch(/INSERT INTO participants/i);
    expect(q.values).toContain('PIPELINE_PARTICIPANT');
  });

  it('successfully chains parse → transform → store for a valid AuctionCreated event', async () => {
    const client = makeMockClient();
    const event = makeEvent({
      eventType: 'auc_cre',
      topic: ['auc_cre', 'PIPE-AUC-1'],
      value: ['PIPE-WASTE-2', 'CREATOR', '200', '88888'],
    });
    await runPipeline(client as any, event);
    expect(client.query).toHaveBeenCalledTimes(1);
    const q = client._queries[0];
    expect(q.text).toMatch(/INSERT INTO auctions/i);
    expect(q.values).toContain('PIPE-AUC-1');
  });

  it('propagates ParseError when the event type is unknown', async () => {
    const client = makeMockClient();
    const event = makeEvent({
      eventType: 'not_a_real_event',
      topic: ['not_a_real_event'],
      value: [],
    });
    await expect(runPipeline(client as any, event)).rejects.toThrow(ParseError);
    expect(client.query).not.toHaveBeenCalled();
  });

  it('propagates ParseError when a required topic field is missing', async () => {
    const client = makeMockClient();
    const event = makeEvent({
      eventType: 'recycled',
      topic: ['recycled'], // missing waste_id
      value: [0, '100', 'ADDR', '0', '0'],
    });
    await expect(runPipeline(client as any, event)).rejects.toThrow(ParseError);
    expect(client.query).not.toHaveBeenCalled();
  });

  it('propagates ParseError when a required value field is missing', async () => {
    const client = makeMockClient();
    const event = makeEvent({
      eventType: 'recycled',
      topic: ['recycled', 'W1'],
      value: [0, '100'], // missing recycler and lon
    });
    await expect(runPipeline(client as any, event)).rejects.toThrow(ParseError);
    expect(client.query).not.toHaveBeenCalled();
  });

  it('applies wasteType mapping before storing (wasteTypeNum 3 → Metal/correct mapped value)', async () => {
    const client = makeMockClient();
    const event = makeEvent({
      eventType: 'recycled',
      topic: ['recycled', 'W-TYPE-3'],
      value: [3, '100', 'RADDR', '0', '0'],
    });
    await runPipeline(client as any, event);
    const q = client._queries[0];
    // The transformed wasteType (whatever WASTE_TYPE_MAP[3] resolves to) should be in values
    expect(q.values).toContain(WASTE_TYPE_MAP[3]);
  });

  it('normalizes address whitespace before storing', async () => {
    const client = makeMockClient();
    const event = makeEvent({
      eventType: 'recycled',
      topic: ['recycled', 'W-NORM'],
      value: [0, '100', '  PADDED_RECYCLER  ', '0', '0'],
    });
    await runPipeline(client as any, event);
    const q = client._queries[0];
    expect(q.values).toContain('PADDED_RECYCLER');
    expect(q.values).not.toContain('  PADDED_RECYCLER  ');
  });

  it('handles AuctionEnded with null winner end-to-end', async () => {
    const client = makeMockClient();
    const event = makeEvent({
      eventType: 'auc_end',
      topic: ['auc_end', 'AUC-NULL-WIN'],
      value: [null, '0'],
    });
    await runPipeline(client as any, event);
    const q = client._queries[0];
    expect(q.text).toMatch(/UPDATE auctions/i);
    expect(q.values).toContain(null);
  });

  it('storeEvent receives correctly transformed data (WasteRegistered wasteTypeNum 0 → Paper)', async () => {
    const client = makeMockClient();
    const event = makeEvent({
      eventType: 'recycled',
      topic: ['recycled', 'W-PAPER'],
      value: [0, '50', 'R', '1', '2'],
    });
    await runPipeline(client as any, event);
    const q = client._queries[0];
    // wasteTypeNum 0 should map to 'Paper' (WASTE_TYPE_MAP[0])
    expect(q.values).toContain(WASTE_TYPE_MAP[0]);
  });

  it('storeEvent is NOT called when parse throws', async () => {
    const client = makeMockClient();
    try {
      await runPipeline(
        client as any,
        makeEvent({ eventType: 'broken', topic: [], value: [] })
      );
    } catch {
      // expected
    }
    expect(client.query).not.toHaveBeenCalled();
  });
});
