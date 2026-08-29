/**
 * Event-parsing pipeline — Issue #920
 *
 * Chains parse → transform → store for a single RawContractEvent.
 *
 * ```
 * RawContractEvent
 *       │
 *    parseEvent()        – pure: extract typed fields, throw ParseError on bad input
 *       │
 *    ParsedEvent
 *       │
 *  transformEvent()      – pure: normalize domain values (enum maps, addresses)
 *       │
 *  TransformedEvent
 *       │
 *   storeEvent()         – effectful: INSERT / UPDATE via PoolClient
 * ```
 *
 * Each stage is independently testable and importable.
 */

import { PoolClient } from 'pg';
import { RawContractEvent } from '../types';
import { parseEvent } from './parse';
import { transformEvent } from './transform';
import { storeEvent } from './store';

export { parseEvent, ParseError } from './parse';
export { transformEvent } from './transform';
export { storeEvent } from './store';
export type { ParsedEvent, TransformedEvent, EventMeta } from './types';

/**
 * Run the full parse → transform → store pipeline for one raw event.
 *
 * @throws {ParseError}  when the event structure is malformed or the type is unknown.
 * @throws {Error}       when the database query fails.
 */
export async function runPipeline(
  client: PoolClient,
  event: RawContractEvent
): Promise<void> {
  const parsed = parseEvent(event);
  const transformed = transformEvent(parsed);
  await storeEvent(client, transformed);
}
