import { PoolClient } from 'pg'
import { RawContractEvent, WASTE_TYPE_MAP, ROLE_MAP } from '../types'

type EventValue = unknown
type EventArray = EventValue[]

function asArray(v: unknown): EventArray {
  return Array.isArray(v) ? v : [v]
}

function bigStr(v: unknown): string {
  return String(v ?? '0')
}

export async function handleWasteRegistered(
  client: PoolClient,
  event: RawContractEvent
): Promise<void> {
  // topic: [symbol, waste_id], value: [waste_type, weight, recycler, lat, lon]
  const [wasteId] = asArray(event.topic).slice(1)
  const [wasteTypeNum, weight, recycler, lat, lon] = asArray(event.value)
  const wasteType = WASTE_TYPE_MAP[Number(wasteTypeNum)] ?? 'Paper'

  await client.query(
    `INSERT INTO wastes (id, recycler_address, waste_type, weight, latitude, longitude, registered_at_ledger, registered_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (id) DO NOTHING`,
    [
      bigStr(wasteId),
      String(recycler),
      wasteType,
      bigStr(weight),
      bigStr(lat),
      bigStr(lon),
      event.ledgerSequence,
      event.ledgerCloseTime
    ]
  )
}

export async function handleParticipantRegistered(
  client: PoolClient,
  event: RawContractEvent
): Promise<void> {
  // topic: [symbol, address], value: [role, name, lat, lon]
  const [, address] = asArray(event.topic)
  const [roleNum, name, lat, lon] = asArray(event.value)
  const role = ROLE_MAP[Number(roleNum)] ?? 'Recycler'

  await client.query(
    `INSERT INTO participants (address, role, name, latitude, longitude, registered_at_ledger, registered_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (address) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name`,
    [
      String(address),
      role,
      String(name),
      bigStr(lat),
      bigStr(lon),
      event.ledgerSequence,
      event.ledgerCloseTime
    ]
  )
}

export async function handleWasteTransferred(
  client: PoolClient,
  event: RawContractEvent
): Promise<void> {
  // topic: [symbol, waste_id], value: [from, to]
  const [, wasteId] = asArray(event.topic)
  const [from, to] = asArray(event.value)

  await client.query(
    `INSERT INTO waste_transfers (waste_id, from_address, to_address, ledger_sequence, transferred_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [bigStr(wasteId), String(from), String(to), event.ledgerSequence, event.ledgerCloseTime]
  )
}

export async function handleWasteConfirmed(
  client: PoolClient,
  event: RawContractEvent
): Promise<void> {
  // topic: [symbol, waste_id], value: confirmer
  const [, wasteId] = asArray(event.topic)
  await client.query(`UPDATE wastes SET is_confirmed = true WHERE id = $1`, [bigStr(wasteId)])
}

export async function handleTokensRewarded(
  client: PoolClient,
  event: RawContractEvent
): Promise<void> {
  // topic: [symbol, recipient], value: [amount, waste_id]
  const [, recipient] = asArray(event.topic)
  const [amount, wasteId] = asArray(event.value)

  await client.query(
    `INSERT INTO token_rewards (recipient_address, amount, waste_id, ledger_sequence, rewarded_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      String(recipient),
      bigStr(amount),
      bigStr(wasteId),
      event.ledgerSequence,
      event.ledgerCloseTime
    ]
  )
}

export async function handleWasteDeactivated(
  client: PoolClient,
  event: RawContractEvent
): Promise<void> {
  const [, wasteId] = asArray(event.topic)
  await client.query(`UPDATE wastes SET is_active = false WHERE id = $1`, [bigStr(wasteId)])
}

export async function handleWasteGraded(
  client: PoolClient,
  event: RawContractEvent
): Promise<void> {
  // topic: [symbol, waste_id], value: [grade, grader]
  const [, wasteId] = asArray(event.topic)
  const [grade] = asArray(event.value)
  await client.query(`UPDATE wastes SET grade = $1 WHERE id = $2`, [String(grade), bigStr(wasteId)])
}

export async function handleProcessingStatusChanged(
  client: PoolClient,
  event: RawContractEvent
): Promise<void> {
  const [, wasteId] = asArray(event.topic)
  const [, status] = asArray(event.value)
  await client.query(`UPDATE wastes SET processing_status = $1 WHERE id = $2`, [
    Number(status),
    bigStr(wasteId)
  ])
}

export async function handleWasteContaminated(
  client: PoolClient,
  event: RawContractEvent
): Promise<void> {
  const [, wasteId] = asArray(event.topic)
  const [, level] = asArray(event.value)
  await client.query(`UPDATE wastes SET contamination_level = $1 WHERE id = $2`, [
    Number(level),
    bigStr(wasteId)
  ])
}

export async function handleAuctionCreated(
  client: PoolClient,
  event: RawContractEvent
): Promise<void> {
  // topic: [symbol, auction_id], value: [waste_id, creator, start_price, end_time]
  const [, auctionId] = asArray(event.topic)
  const [wasteId, creator, startPrice, endTime] = asArray(event.value)

  await client.query(
    `INSERT INTO auctions (id, waste_id, creator_address, start_price, end_time, created_at_ledger, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (id) DO NOTHING`,
    [
      bigStr(auctionId),
      bigStr(wasteId),
      String(creator),
      bigStr(startPrice),
      bigStr(endTime),
      event.ledgerSequence,
      event.ledgerCloseTime
    ]
  )
}

export async function handleAuctionEnded(
  client: PoolClient,
  event: RawContractEvent
): Promise<void> {
  // topic: [symbol, auction_id], value: [winner, final_price]
  const [, auctionId] = asArray(event.topic)
  const [winner, finalPrice] = asArray(event.value)

  await client.query(
    `UPDATE auctions SET is_ended = true, winner_address = $1, final_price = $2 WHERE id = $3`,
    [winner ? String(winner) : null, bigStr(finalPrice), bigStr(auctionId)]
  )
}

export async function handleCarbonCreditsEarned(
  client: PoolClient,
  event: RawContractEvent
): Promise<void> {
  // topic: [symbol, participant], value: [waste_type, weight, credits]
  const [, participant] = asArray(event.topic)
  const [wasteTypeNum, weight, credits] = asArray(event.value)
  const wasteType = WASTE_TYPE_MAP[Number(wasteTypeNum)] ?? 'Paper'

  await client.query(
    `INSERT INTO carbon_credits (participant_address, waste_type, weight, credits, ledger_sequence, earned_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      String(participant),
      wasteType,
      bigStr(weight),
      bigStr(credits),
      event.ledgerSequence,
      event.ledgerCloseTime
    ]
  )
}
