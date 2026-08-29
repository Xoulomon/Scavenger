/**
 * Parse stage.
 *
 * Takes a RawContractEvent produced by the Stellar streamer, validates that the
 * topic/value structure is well-formed, extracts typed fields, and returns a
 * ParsedEvent discriminated union.
 *
 * This function is pure – no side effects, no database access, no map lookups.
 * An unknown or malformed event throws a ParseError.
 */

import { RawContractEvent } from '../types';
import { ParsedEvent, EventMeta } from './types';

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

export class ParseError extends Error {
  constructor(
    public readonly eventType: string,
    message: string
  ) {
    super(`[parse/${eventType}] ${message}`);
    this.name = 'ParseError';
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [v];
}

function bigStr(v: unknown): string {
  if (v === null || v === undefined) {return '0';}
  return String(v);
}

function requireTopicIndex(topic: string[], idx: number, field: string, eventType: string): string {
  const val = topic[idx];
  if (val === undefined || val === '') {
    throw new ParseError(eventType, `missing topic[${idx}] (${field})`);
  }
  return val;
}

function requireValueIndex(value: unknown[], idx: number, field: string, eventType: string): unknown {
  if (idx >= value.length) {
    throw new ParseError(eventType, `missing value[${idx}] (${field})`);
  }
  return value[idx];
}

function meta(event: RawContractEvent): EventMeta {
  return {
    ledgerSequence: event.ledgerSequence,
    ledgerCloseTime: event.ledgerCloseTime,
    transactionHash: event.transactionHash,
    contractId: event.contractId,
  };
}

// ---------------------------------------------------------------------------
// Per-event-type parsers
// ---------------------------------------------------------------------------

function parseWasteRegistered(event: RawContractEvent): ParsedEvent {
  // topic: [symbol, waste_id]
  // value: [waste_type, weight, recycler, lat, lon]
  const topic = event.topic;
  const value = asArray(event.value);

  const wasteId = requireTopicIndex(topic, 1, 'waste_id', event.eventType);
  requireValueIndex(value, 4, 'lon', event.eventType);

  return {
    ...meta(event),
    kind: 'WasteRegistered',
    wasteId,
    wasteTypeNum: Number(value[0] ?? 0),
    weight: bigStr(value[1]),
    recycler: String(requireValueIndex(value, 2, 'recycler', event.eventType)),
    lat: bigStr(value[3]),
    lon: bigStr(value[4]),
  };
}

function parseParticipantRegistered(event: RawContractEvent): ParsedEvent {
  // topic: [symbol, address]
  // value: [role, name, lat, lon]
  const topic = event.topic;
  const value = asArray(event.value);

  const address = requireTopicIndex(topic, 1, 'address', event.eventType);
  requireValueIndex(value, 3, 'lon', event.eventType);

  return {
    ...meta(event),
    kind: 'ParticipantRegistered',
    address,
    roleNum: Number(value[0] ?? 0),
    name: String(requireValueIndex(value, 1, 'name', event.eventType)),
    lat: bigStr(value[2]),
    lon: bigStr(value[3]),
  };
}

function parseWasteTransferred(event: RawContractEvent): ParsedEvent {
  // topic: [symbol, waste_id]
  // value: [from, to]
  const topic = event.topic;
  const value = asArray(event.value);

  const wasteId = requireTopicIndex(topic, 1, 'waste_id', event.eventType);
  requireValueIndex(value, 1, 'to', event.eventType);

  return {
    ...meta(event),
    kind: 'WasteTransferred',
    wasteId,
    from: String(requireValueIndex(value, 0, 'from', event.eventType)),
    to: String(requireValueIndex(value, 1, 'to', event.eventType)),
  };
}

function parseWasteConfirmed(event: RawContractEvent): ParsedEvent {
  // topic: [symbol, waste_id], value: confirmer (unused after parsing)
  const topic = event.topic;
  const wasteId = requireTopicIndex(topic, 1, 'waste_id', event.eventType);

  return {
    ...meta(event),
    kind: 'WasteConfirmed',
    wasteId,
  };
}

function parseTokensRewarded(event: RawContractEvent): ParsedEvent {
  // topic: [symbol, recipient]
  // value: [amount, waste_id]
  const topic = event.topic;
  const value = asArray(event.value);

  const recipient = requireTopicIndex(topic, 1, 'recipient', event.eventType);
  requireValueIndex(value, 1, 'waste_id', event.eventType);

  return {
    ...meta(event),
    kind: 'TokensRewarded',
    recipient,
    amount: bigStr(value[0]),
    wasteId: bigStr(value[1]),
  };
}

function parseWasteDeactivated(event: RawContractEvent): ParsedEvent {
  const topic = event.topic;
  const wasteId = requireTopicIndex(topic, 1, 'waste_id', event.eventType);

  return {
    ...meta(event),
    kind: 'WasteDeactivated',
    wasteId,
  };
}

function parseWasteGraded(event: RawContractEvent): ParsedEvent {
  // topic: [symbol, waste_id]
  // value: [grade, grader]
  const topic = event.topic;
  const value = asArray(event.value);

  const wasteId = requireTopicIndex(topic, 1, 'waste_id', event.eventType);
  requireValueIndex(value, 0, 'grade', event.eventType);

  return {
    ...meta(event),
    kind: 'WasteGraded',
    wasteId,
    grade: String(value[0]),
  };
}

function parseProcessingStatusChanged(event: RawContractEvent): ParsedEvent {
  // topic: [symbol, waste_id]
  // value: [caller, status, ...]
  const topic = event.topic;
  const value = asArray(event.value);

  const wasteId = requireTopicIndex(topic, 1, 'waste_id', event.eventType);
  requireValueIndex(value, 1, 'status', event.eventType);

  return {
    ...meta(event),
    kind: 'ProcessingStatusChanged',
    wasteId,
    status: Number(value[1]),
  };
}

function parseWasteContaminated(event: RawContractEvent): ParsedEvent {
  // topic: [symbol, waste_id]
  // value: [verifier, level]
  const topic = event.topic;
  const value = asArray(event.value);

  const wasteId = requireTopicIndex(topic, 1, 'waste_id', event.eventType);
  requireValueIndex(value, 1, 'level', event.eventType);

  return {
    ...meta(event),
    kind: 'WasteContaminated',
    wasteId,
    level: Number(value[1]),
  };
}

function parseAuctionCreated(event: RawContractEvent): ParsedEvent {
  // topic: [symbol, auction_id]
  // value: [waste_id, creator, start_price, end_time]
  const topic = event.topic;
  const value = asArray(event.value);

  const auctionId = requireTopicIndex(topic, 1, 'auction_id', event.eventType);
  requireValueIndex(value, 3, 'end_time', event.eventType);

  return {
    ...meta(event),
    kind: 'AuctionCreated',
    auctionId,
    wasteId: bigStr(value[0]),
    creator: String(requireValueIndex(value, 1, 'creator', event.eventType)),
    startPrice: bigStr(value[2]),
    endTime: bigStr(value[3]),
  };
}

function parseAuctionEnded(event: RawContractEvent): ParsedEvent {
  // topic: [symbol, auction_id]
  // value: [winner, final_price]
  const topic = event.topic;
  const value = asArray(event.value);

  const auctionId = requireTopicIndex(topic, 1, 'auction_id', event.eventType);
  requireValueIndex(value, 1, 'final_price', event.eventType);

  const winnerRaw = value[0];
  return {
    ...meta(event),
    kind: 'AuctionEnded',
    auctionId,
    winner: winnerRaw !== null && winnerRaw !== undefined ? String(winnerRaw) : null,
    finalPrice: bigStr(value[1]),
  };
}

function parseCarbonCreditsEarned(event: RawContractEvent): ParsedEvent {
  // topic: [symbol, participant]
  // value: [waste_type, weight, credits]
  const topic = event.topic;
  const value = asArray(event.value);

  const participant = requireTopicIndex(topic, 1, 'participant', event.eventType);
  requireValueIndex(value, 2, 'credits', event.eventType);

  return {
    ...meta(event),
    kind: 'CarbonCreditsEarned',
    participant,
    wasteTypeNum: Number(value[0] ?? 0),
    weight: bigStr(value[1]),
    credits: bigStr(value[2]),
  };
}

// ---------------------------------------------------------------------------
// Dispatch table
// ---------------------------------------------------------------------------

type ParserFn = (event: RawContractEvent) => ParsedEvent;

const PARSERS: Record<string, ParserFn> = {
  recycled: parseWasteRegistered,
  reg: parseParticipantRegistered,
  transfer: parseWasteTransferred,
  confirmed: parseWasteConfirmed,
  rewarded: parseTokensRewarded,
  deactive: parseWasteDeactivated,
  graded: parseWasteGraded,
  proc_upd: parseProcessingStatusChanged,
  contam: parseWasteContaminated,
  auc_cre: parseAuctionCreated,
  auc_end: parseAuctionEnded,
  carbon: parseCarbonCreditsEarned,
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse a raw Stellar contract event into a typed ParsedEvent.
 *
 * @throws {ParseError} when the event type is unknown or the payload is malformed.
 */
export function parseEvent(event: RawContractEvent): ParsedEvent {
  const parser = PARSERS[event.eventType];
  if (!parser) {
    throw new ParseError(event.eventType, `unknown event type "${event.eventType}"`);
  }
  return parser(event);
}
