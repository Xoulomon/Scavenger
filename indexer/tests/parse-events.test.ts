/**
 * Event-parsing unit tests — issue #1755
 *
 * Happy-path coverage for `parseEvent` across all 12 contract event types,
 * plus the negative paths: unknown event types and malformed payloads that
 * must throw `ParseError` with a precise message.
 *
 * Fixtures are built with `makeEvent` (deterministic ledger/tx metadata) and
 * are fully in-memory — no RPC, no DB.
 */

import { parseEvent, ParseError } from '../src/pipeline/parse';
import { CONTRACT_EVENT_TYPES } from '../src/constants';

type RawContractEvent = Parameters<typeof parseEvent>[0];

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

describe('parseEvent — happy paths (issue #1755)', () => {
  it('parses WasteRegistered', () => {
    const ev = parseEvent(
      makeEvent({
        eventType: CONTRACT_EVENT_TYPES.WASTE_REGISTERED,
        topic: ['recycled', 'w1'],
        value: ['Plastic', '10.5', 'alice', '1.0', '2.0'],
      })
    );
    expect(ev.kind).toBe('WasteRegistered');
    expect(ev.transactionHash).toBe('0xabc');
    expect(ev.ledgerSequence).toBe(1000);
    expect((ev as any).wasteId).toBe('w1');
    expect((ev as any).weight).toBe('10.5');
    expect((ev as any).recycler).toBe('alice');
  });

  it('parses ParticipantRegistered', () => {
    const ev = parseEvent(
      makeEvent({
        eventType: CONTRACT_EVENT_TYPES.PARTICIPANT_REGISTERED,
        topic: ['reg', 'GC7Q...'],
        value: [1, 'Alice', '1.0', '2.0'],
      })
    );
    expect(ev.kind).toBe('ParticipantRegistered');
    expect((ev as any).address).toBe('GC7Q...');
    expect((ev as any).roleNum).toBe(1);
    expect((ev as any).name).toBe('Alice');
  });

  it('parses WasteTransferred', () => {
    const ev = parseEvent(
      makeEvent({
        eventType: CONTRACT_EVENT_TYPES.WASTE_TRANSFERRED,
        topic: ['transfer', 'w1'],
        value: ['alice', 'bob'],
      })
    );
    expect(ev.kind).toBe('WasteTransferred');
    expect((ev as any).from).toBe('alice');
    expect((ev as any).to).toBe('bob');
  });

  it('parses WasteConfirmed', () => {
    const ev = parseEvent(
      makeEvent({
        eventType: CONTRACT_EVENT_TYPES.WASTE_CONFIRMED,
        topic: ['confirmed', 'w1'],
        value: ['alice'],
      })
    );
    expect(ev.kind).toBe('WasteConfirmed');
    expect((ev as any).wasteId).toBe('w1');
  });

  it('parses TokensRewarded', () => {
    const ev = parseEvent(
      makeEvent({
        eventType: CONTRACT_EVENT_TYPES.TOKENS_REWARDED,
        topic: ['rewarded', 'bob'],
        value: ['100', 'w1'],
      })
    );
    expect(ev.kind).toBe('TokensRewarded');
    expect((ev as any).recipient).toBe('bob');
    expect((ev as any).amount).toBe('100');
    expect((ev as any).wasteId).toBe('w1');
  });

  it('parses WasteDeactivated', () => {
    const ev = parseEvent(
      makeEvent({
        eventType: CONTRACT_EVENT_TYPES.WASTE_DEACTIVATED,
        topic: ['deactive', 'w1'],
        value: ['alice'],
      })
    );
    expect(ev.kind).toBe('WasteDeactivated');
  });

  it('parses WasteGraded', () => {
    const ev = parseEvent(
      makeEvent({
        eventType: CONTRACT_EVENT_TYPES.WASTE_GRADED,
        topic: ['graded', 'w1'],
        value: ['A', 'alice'],
      })
    );
    expect(ev.kind).toBe('WasteGraded');
    expect((ev as any).grade).toBe('A');
  });

  it('parses ProcessingStatusChanged', () => {
    const ev = parseEvent(
      makeEvent({
        eventType: CONTRACT_EVENT_TYPES.PROCESSING_STATUS_CHANGED,
        topic: ['proc_upd', 'w1'],
        value: ['alice', '2'],
      })
    );
    expect(ev.kind).toBe('ProcessingStatusChanged');
    expect((ev as any).status).toBe(2);
  });

  it('parses WasteContaminated', () => {
    const ev = parseEvent(
      makeEvent({
        eventType: CONTRACT_EVENT_TYPES.WASTE_CONTAMINATED,
        topic: ['contam', 'w1'],
        value: ['alice', '3'],
      })
    );
    expect(ev.kind).toBe('WasteContaminated');
    expect((ev as any).level).toBe(3);
  });

  it('parses AuctionCreated', () => {
    const ev = parseEvent(
      makeEvent({
        eventType: CONTRACT_EVENT_TYPES.AUCTION_CREATED,
        topic: ['auc_cre', 'a1'],
        value: ['w1', 'alice', '100', '12345'],
      })
    );
    expect(ev.kind).toBe('AuctionCreated');
    expect((ev as any).auctionId).toBe('a1');
    expect((ev as any).wasteId).toBe('w1');
    expect((ev as any).endTime).toBe('12345');
  });

  it('parses AuctionEnded', () => {
    const ev = parseEvent(
      makeEvent({
        eventType: CONTRACT_EVENT_TYPES.AUCTION_ENDED,
        topic: ['auc_end', 'a1'],
        value: ['bob', '200'],
      })
    );
    expect(ev.kind).toBe('AuctionEnded');
    expect((ev as any).winner).toBe('bob');
    expect((ev as any).finalPrice).toBe('200');
  });

  it('parses CarbonCreditsEarned', () => {
    const ev = parseEvent(
      makeEvent({
        eventType: CONTRACT_EVENT_TYPES.CARBON_CREDITS_EARNED,
        topic: ['carbon', 'bob'],
        value: ['Plastic', '10.5', '100'],
      })
    );
    expect(ev.kind).toBe('CarbonCreditsEarned');
    expect((ev as any).participant).toBe('bob');
    expect((ev as any).credits).toBe('100');
  });
});

describe('parseEvent — negative paths (issue #1755)', () => {
  it('throws ParseError on unknown event type', () => {
    expect(() =>
      parseEvent(makeEvent({ eventType: 'nonexistent', topic: ['x'], value: [] }))
    ).toThrow(ParseError);
    expect(() =>
      parseEvent(makeEvent({ eventType: 'nonexistent', topic: ['x'], value: [] }))
    ).toThrow('unknown event type "nonexistent"');
  });

  it('throws ParseError when topic[1] is missing', () => {
    expect(() =>
      parseEvent(
        makeEvent({ eventType: CONTRACT_EVENT_TYPES.WASTE_TRANSFERRED, topic: ['transfer'], value: ['a', 'b'] })
      )
    ).toThrow('missing topic[1] (waste_id)');
  });

  it('throws ParseError when topic[1] is empty', () => {
    expect(() =>
      parseEvent(
        makeEvent({ eventType: CONTRACT_EVENT_TYPES.WASTE_CONFIRMED, topic: ['confirmed', ''], value: [] })
      )
    ).toThrow('missing topic[1] (waste_id)');
  });

  it('throws ParseError when a required value index is missing', () => {
    expect(() =>
      parseEvent(
        makeEvent({ eventType: CONTRACT_EVENT_TYPES.WASTE_TRANSFERRED, topic: ['transfer', 'w1'], value: ['alice'] })
      )
    ).toThrow('missing value[1] (to)');
  });

  it('throws ParseError with the event type in the message', () => {
    try {
      parseEvent(makeEvent({ eventType: CONTRACT_EVENT_TYPES.TOKENS_REWARDED, topic: ['rewarded', 'bob'], value: [] }));
      fail('expected ParseError');
    } catch (err) {
      expect(err).toBeInstanceOf(ParseError);
      expect((err as ParseError).eventType).toBe('rewarded');
    }
  });
});
