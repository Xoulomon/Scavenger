/**
 * Optimized database queries (issue #761)
 *
 * Addresses:
 * - N+1 queries: batch-load transfers/rewards alongside their parent records
 * - Missing indexes: see migration 003_query_indexes.sql
 * - Query result caching: cache-aside pattern via CacheManager
 * - Query monitoring: wraps pool.query with timing + slow-query warnings
 */

import { getPool } from '../db/client';
import { recordQueryMetric } from '../db/queryOptimizer';
import { CACHE, EVENT_PAGINATION } from '../constants';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ParticipantRow {
  address: string;
  role: string;
  name: string;
  latitude: bigint;
  longitude: bigint;
  registered_at: Date;
  is_active: boolean;
}

export interface WasteWithTransfers {
  id: bigint;
  recycler_address: string;
  waste_type: string;
  weight: string;
  is_confirmed: boolean;
  is_active: boolean;
  registered_at: Date;
  transfers: TransferRow[];
}

export interface TransferRow {
  id: bigint;
  waste_id: bigint;
  from_address: string;
  to_address: string;
  transferred_at: Date;
}

// ── Timed query helper ────────────────────────────────────────────────────────

async function timedQuery<T>(
  sql: string,
  params: unknown[],
): Promise<T[]> {
  const pool = getPool();
  const start = Date.now();
  const result = await pool.query(sql, params);
  recordQueryMetric(sql, Date.now() - start, result.rows.length);
  return result.rows as T[];
}

// ── N+1 fix: load wastes + their transfers in 2 queries ───────────────────────

/**
 * Returns all wastes for `recyclerAddress` with their transfer history
 * pre-loaded in a single additional query (instead of N separate lookups).
 */
export async function getWastesWithTransfers(
  recyclerAddress: string,
): Promise<WasteWithTransfers[]> {
  const wastes = await timedQuery<WasteWithTransfers>(
    `SELECT id, recycler_address, waste_type, weight::text,
            is_confirmed, is_active, registered_at
     FROM wastes
     WHERE recycler_address = $1 AND is_active = true
     ORDER BY registered_at DESC`,
    [recyclerAddress],
  );

  if (wastes.length === 0) {return [];}

  const wasteIds = wastes.map(w => w.id);
  const transfers = await timedQuery<TransferRow>(
    `SELECT id, waste_id, from_address, to_address, transferred_at
     FROM waste_transfers
     WHERE waste_id = ANY($1::bigint[])
     ORDER BY transferred_at ASC`,
    [wasteIds],
  );

  // Group transfers by waste_id (no per-waste round-trip)
  const byWaste = new Map<bigint, TransferRow[]>();
  for (const t of transfers) {
    const arr = byWaste.get(t.waste_id) ?? [];
    arr.push(t);
    byWaste.set(t.waste_id, arr);
  }

  return wastes.map(w => ({ ...w, transfers: byWaste.get(w.id) ?? [] }));
}

// ── N+1 fix: batch participant lookup ─────────────────────────────────────────

/**
 * Loads multiple participants by address in a single query.
 * Use instead of looping over `getParticipant(addr)`.
 */
export async function getParticipantsBatch(
  addresses: string[],
): Promise<Map<string, ParticipantRow>> {
  if (addresses.length === 0) {return new Map();}

  const rows = await timedQuery<ParticipantRow>(
    `SELECT address, role, name, latitude, longitude, registered_at, is_active
     FROM participants
     WHERE address = ANY($1::text[])`,
    [addresses],
  );

  const map = new Map<string, ParticipantRow>();
  for (const row of rows) {map.set(row.address, row);}
  return map;
}

// ── Optimized supply-chain stats (single aggregation query) ───────────────────

export interface SupplyChainStats {
  total_wastes: number;
  active_wastes: number;
  total_transfers: number;
  total_participants: number;
  total_tokens: string;
}

export async function getSupplyChainStats(): Promise<SupplyChainStats> {
  const rows = await timedQuery<SupplyChainStats>(
    `SELECT
       (SELECT COUNT(*)::int FROM wastes)                  AS total_wastes,
       (SELECT COUNT(*)::int FROM wastes WHERE is_active)  AS active_wastes,
       (SELECT COUNT(*)::int FROM waste_transfers)         AS total_transfers,
       (SELECT COUNT(*)::int FROM participants)            AS total_participants,
       (SELECT COALESCE(SUM(amount),0)::text
          FROM token_rewards)                              AS total_tokens`,
    [],
  );
  return rows[0];
}

// ── Paginated event query (uses covering index) ───────────────────────────────

export interface EventSummary {
  id: bigint;
  ledger_sequence: number;
  event_type: string;
  contract_id: string;
  created_at: Date;
}

/**
 * Paginated event listing.  Relies on `idx_raw_events_ledger_type` covering
 * index (created in migration 003) to avoid seq-scans on large tables.
 */
export async function getRecentEvents(
  limit = EVENT_PAGINATION.DEFAULT_RECENT_EVENTS_LIMIT,
  offset = 0,
  eventType?: string,
): Promise<EventSummary[]> {
  const params: unknown[] = [Math.min(limit, EVENT_PAGINATION.MAX_RECENT_EVENTS_LIMIT), offset];
  const typeClause = eventType ? ` AND event_type = $3` : '';
  if (eventType) {params.push(eventType);}

  return timedQuery<EventSummary>(
    `SELECT id, ledger_sequence, event_type, contract_id, created_at
     FROM raw_events
     WHERE 1=1${typeClause}
     ORDER BY ledger_sequence DESC, id DESC
     LIMIT $1 OFFSET $2`,
    params,
  );
}

// ── Cached global metrics ─────────────────────────────────────────────────────

/** In-process TTL cache for metrics (avoids Redis dependency in hot path). */
const metricsCache: { value: SupplyChainStats | null; expiresAt: number } = {
  value: null,
  expiresAt: 0,
};
export async function getCachedSupplyChainStats(): Promise<SupplyChainStats> {
  if (metricsCache.value && Date.now() < metricsCache.expiresAt) {
    return metricsCache.value;
  }
  const fresh = await getSupplyChainStats();
  metricsCache.value = fresh;
  metricsCache.expiresAt = Date.now() + CACHE.METRICS_TTL_MS;
  return fresh;
}

export function invalidateMetricsCache(): void {
  metricsCache.value = null;
  metricsCache.expiresAt = 0;
}
