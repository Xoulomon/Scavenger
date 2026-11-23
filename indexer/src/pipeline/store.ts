/**
 * Store stage — Issue #920
 *
 * Takes a TransformedEvent (normalized domain object from the transform stage)
 * and a live PostgreSQL PoolClient, then executes the appropriate
 * INSERT / UPDATE query.
 *
 * This is the only stage that has side effects (database I/O).
 */

import { PoolClient } from 'pg'
import { TransformedEvent } from './types'

// ---------------------------------------------------------------------------
// Per-event-kind store functions
// ---------------------------------------------------------------------------

async function storeWasteRegistered(
  client: PoolClient,
  e: Extract<TransformedEvent, { kind: 'WasteRegistered' }>
): Promise<void> {
  await client.query(
    `INSERT INTO wastes
       (id, recycler_address, waste_type, weight, latitude, longitude, registered_at_ledger, registered_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (id) DO NOTHING`,
    [
      e.wasteId,
      e.recycler,
      e.wasteType,
      e.weight,
      e.lat,
      e.lon,
      e.ledgerSequence,
      e.ledgerCloseTime
    ]
  )
}

async function storeParticipantRegistered(
  client: PoolClient,
  e: Extract<TransformedEvent, { kind: 'ParticipantRegistered' }>
): Promise<void> {
  await client.query(
    `INSERT INTO participants
       (address, role, name, latitude, longitude, registered_at_ledger, registered_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (address) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name`,
    [e.address, e.role, e.name, e.lat, e.lon, e.ledgerSequence, e.ledgerCloseTime]
  )
}

async function storeWasteTransferred(
  client: PoolClient,
  e: Extract<TransformedEvent, { kind: 'WasteTransferred' }>
): Promise<void> {
  await client.query(
    `INSERT INTO waste_transfers
       (waste_id, from_address, to_address, ledger_sequence, transferred_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [e.wasteId, e.from, e.to, e.ledgerSequence, e.ledgerCloseTime]
  )
}

async function storeWasteConfirmed(
  client: PoolClient,
  e: Extract<TransformedEvent, { kind: 'WasteConfirmed' }>
): Promise<void> {
  await client.query(`UPDATE wastes SET is_confirmed = true WHERE id = $1`, [e.wasteId])
}

async function storeTokensRewarded(
  client: PoolClient,
  e: Extract<TransformedEvent, { kind: 'TokensRewarded' }>
): Promise<void> {
  await client.query(
    `INSERT INTO token_rewards
       (recipient_address, amount, waste_id, ledger_sequence, rewarded_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [e.recipient, e.amount, e.wasteId, e.ledgerSequence, e.ledgerCloseTime]
  )
}

async function storeWasteDeactivated(
  client: PoolClient,
  e: Extract<TransformedEvent, { kind: 'WasteDeactivated' }>
): Promise<void> {
  await client.query(`UPDATE wastes SET is_active = false WHERE id = $1`, [e.wasteId])
}

async function storeWasteGraded(
  client: PoolClient,
  e: Extract<TransformedEvent, { kind: 'WasteGraded' }>
): Promise<void> {
  await client.query(`UPDATE wastes SET grade = $1 WHERE id = $2`, [e.grade, e.wasteId])
}

async function storeProcessingStatusChanged(
  client: PoolClient,
  e: Extract<TransformedEvent, { kind: 'ProcessingStatusChanged' }>
): Promise<void> {
  await client.query(`UPDATE wastes SET processing_status = $1 WHERE id = $2`, [
    e.status,
    e.wasteId
  ])
}

async function storeWasteContaminated(
  client: PoolClient,
  e: Extract<TransformedEvent, { kind: 'WasteContaminated' }>
): Promise<void> {
  await client.query(`UPDATE wastes SET contamination_level = $1 WHERE id = $2`, [
    e.level,
    e.wasteId
  ])
}

async function storeAuctionCreated(
  client: PoolClient,
  e: Extract<TransformedEvent, { kind: 'AuctionCreated' }>
): Promise<void> {
  await client.query(
    `INSERT INTO auctions
       (id, waste_id, creator_address, start_price, end_time, created_at_ledger, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (id) DO NOTHING`,
    [
      e.auctionId,
      e.wasteId,
      e.creator,
      e.startPrice,
      e.endTime,
      e.ledgerSequence,
      e.ledgerCloseTime
    ]
  )
}

async function storeAuctionEnded(
  client: PoolClient,
  e: Extract<TransformedEvent, { kind: 'AuctionEnded' }>
): Promise<void> {
  await client.query(
    `UPDATE auctions SET is_ended = true, winner_address = $1, final_price = $2 WHERE id = $3`,
    [e.winner, e.finalPrice, e.auctionId]
  )
}

async function storeCarbonCreditsEarned(
  client: PoolClient,
  e: Extract<TransformedEvent, { kind: 'CarbonCreditsEarned' }>
): Promise<void> {
  await client.query(
    `INSERT INTO carbon_credits
       (participant_address, waste_type, weight, credits, ledger_sequence, earned_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [e.participant, e.wasteType, e.weight, e.credits, e.ledgerSequence, e.ledgerCloseTime]
  )
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Persist a TransformedEvent to PostgreSQL.
 *
 * All TransformedEvent kinds are handled; TypeScript enforces exhaustiveness
 * at compile time via the exhaustive `never` check.
 */
export async function storeEvent(client: PoolClient, event: TransformedEvent): Promise<void> {
  switch (event.kind) {
    case 'WasteRegistered':
      return storeWasteRegistered(client, event)
    case 'ParticipantRegistered':
      return storeParticipantRegistered(client, event)
    case 'WasteTransferred':
      return storeWasteTransferred(client, event)
    case 'WasteConfirmed':
      return storeWasteConfirmed(client, event)
    case 'TokensRewarded':
      return storeTokensRewarded(client, event)
    case 'WasteDeactivated':
      return storeWasteDeactivated(client, event)
    case 'WasteGraded':
      return storeWasteGraded(client, event)
    case 'ProcessingStatusChanged':
      return storeProcessingStatusChanged(client, event)
    case 'WasteContaminated':
      return storeWasteContaminated(client, event)
    case 'AuctionCreated':
      return storeAuctionCreated(client, event)
    case 'AuctionEnded':
      return storeAuctionEnded(client, event)
    case 'CarbonCreditsEarned':
      return storeCarbonCreditsEarned(client, event)
    default: {
      // Exhaustiveness check — TypeScript will error here if a new kind is
      // added to TransformedEvent without a corresponding case above.
      const _exhaustive: never = event
      throw new Error(`storeEvent: unhandled kind ${(event as TransformedEvent).kind}`)
    }
  }
}
