/**
 * Event dispatcher — Issue #920
 *
 * Routes a RawContractEvent through the parse → transform → store pipeline.
 * Unknown event types are silently skipped (the raw event is still stored
 * by indexer.ts before this function is called).
 */

import { PoolClient } from 'pg'
import { RawContractEvent } from '../types'
import { runPipeline, ParseError } from '../pipeline'
import { logger } from '../utils/logger'

export async function dispatchEvent(client: PoolClient, event: RawContractEvent): Promise<void> {
  try {
    await runPipeline(client, event)
  } catch (err) {
    if (err instanceof ParseError) {
      // Unknown or malformed event type — log and skip, don't crash the indexer
      logger.warn('Skipping unrecognised or malformed event', {
        eventType: event.eventType,
        ledger: event.ledgerSequence,
        reason: err.message
      })
      return
    }
    // Re-throw all other errors (DB failures, etc.)
    throw err
  }
}
