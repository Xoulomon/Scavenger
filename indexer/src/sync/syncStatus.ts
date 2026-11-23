import { PoolClient } from 'pg'
import { withTransaction, getPool } from '../db/client'

export async function getSyncStatus(): Promise<{ lastLedger: number; isSyncing: boolean }> {
  const { rows } = await getPool().query('SELECT last_ledger, is_syncing FROM sync_status LIMIT 1')
  return { lastLedger: Number(rows[0]?.last_ledger ?? 0), isSyncing: rows[0]?.is_syncing ?? false }
}

export async function updateSyncStatus(
  client: PoolClient,
  ledger: number,
  closeTime: Date
): Promise<void> {
  await client.query(
    `UPDATE sync_status SET last_ledger = $1, last_ledger_close_time = $2, updated_at = NOW()`,
    [ledger, closeTime]
  )
}

export async function setSyncing(isSyncing: boolean): Promise<void> {
  await getPool().query('UPDATE sync_status SET is_syncing = $1', [isSyncing])
}

/**
 * Detect reorg: check if any stored raw_events at a given ledger have a different
 * transaction hash than what we're about to store. If so, roll back that ledger.
 */
export async function detectAndHandleReorg(
  client: PoolClient,
  ledger: number,
  incomingTxHashes: Set<string>
): Promise<boolean> {
  const { rows } = await client.query(
    `SELECT DISTINCT transaction_hash FROM raw_events WHERE ledger_sequence = $1`,
    [ledger]
  )

  const storedHashes = new Set(rows.map((r: { transaction_hash: string }) => r.transaction_hash))
  const hasReorg = [...storedHashes].some((h) => !incomingTxHashes.has(h))

  if (hasReorg) {
    await rollbackFromLedger(client, ledger)
    return true
  }
  return false
}

/**
 * Roll back all indexed data from a given ledger onwards.
 * This removes raw events and reverses state changes by re-applying from scratch.
 * For simplicity, we delete affected rows and let the re-index rebuild them.
 */
export async function rollbackFromLedger(client: PoolClient, fromLedger: number): Promise<void> {
  console.warn(`[reorg] Rolling back from ledger ${fromLedger}`)

  // Remove raw events
  await client.query(`DELETE FROM raw_events WHERE ledger_sequence >= $1`, [fromLedger])

  // Reverse state changes: remove wastes registered at or after this ledger
  await client.query(`DELETE FROM wastes WHERE registered_at_ledger >= $1`, [fromLedger])
  await client.query(`DELETE FROM participants WHERE registered_at_ledger >= $1`, [fromLedger])
  await client.query(`DELETE FROM waste_transfers WHERE ledger_sequence >= $1`, [fromLedger])
  await client.query(`DELETE FROM token_rewards WHERE ledger_sequence >= $1`, [fromLedger])
  await client.query(`DELETE FROM carbon_credits WHERE ledger_sequence >= $1`, [fromLedger])
  await client.query(`DELETE FROM auctions WHERE created_at_ledger >= $1`, [fromLedger])

  // Reset sync cursor
  await client.query(`UPDATE sync_status SET last_ledger = $1`, [fromLedger - 1])
}

export async function storeRawEvent(
  client: PoolClient,
  event: {
    ledgerSequence: number
    ledgerCloseTime: Date
    transactionHash: string
    contractId: string
    eventType: string
    topic: string[]
    value: unknown
  }
): Promise<void> {
  await client.query(
    `INSERT INTO raw_events
       (ledger_sequence, ledger_close_time, transaction_hash, contract_id, event_type, topic, value)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT DO NOTHING`,
    [
      event.ledgerSequence,
      event.ledgerCloseTime,
      event.transactionHash,
      event.contractId,
      event.eventType,
      event.topic,
      JSON.stringify(event.value)
    ]
  )
}

export { withTransaction }
