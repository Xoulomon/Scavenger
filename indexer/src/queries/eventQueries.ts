import { getPool } from '../db/client';
import { recordQueryMetric } from '../db/queryOptimizer';
import { QUERY_LIMITS } from '../constants';

export interface EventFilter {
  eventType?: string;
  fromLedger?: number;
  toLedger?: number;
  contractId?: string;
  transactionHash?: string;
  limit?: number;
  offset?: number;
}

export interface EventQueryResult {
  events: Record<string, unknown>[];
  total: number;
  limit: number;
  offset: number;
}

export async function queryEvents(filter: EventFilter): Promise<EventQueryResult> {
  const pool = getPool();
  const limit = Math.min(filter.limit ?? QUERY_LIMITS.MAX, QUERY_LIMITS.MAX);
  const offset = filter.offset ?? 0;

  let sql = 'SELECT * FROM raw_events WHERE 1=1';
  const params: unknown[] = [];
  let paramIdx = 1;

  if (filter.eventType) {
    sql += ` AND event_type = $${paramIdx++}`;
    params.push(filter.eventType);
  }
  if (filter.fromLedger !== undefined) {
    sql += ` AND ledger_sequence >= $${paramIdx++}`;
    params.push(filter.fromLedger);
  }
  if (filter.toLedger !== undefined) {
    sql += ` AND ledger_sequence <= $${paramIdx++}`;
    params.push(filter.toLedger);
  }
  if (filter.contractId) {
    sql += ` AND contract_id = $${paramIdx++}`;
    params.push(filter.contractId);
  }
  if (filter.transactionHash) {
    sql += ` AND transaction_hash = $${paramIdx++}`;
    params.push(filter.transactionHash);
  }

  const countSql = sql.replace('SELECT *', 'SELECT COUNT(*)::int as total');
  let t = Date.now();
  const countResult = await pool.query(countSql, params);
  recordQueryMetric(countSql, Date.now() - t, 1);
  const total = countResult.rows[0]?.total ?? 0;

  sql += ` ORDER BY ledger_sequence DESC, id DESC LIMIT $${paramIdx++} OFFSET $${paramIdx++}`;
  params.push(limit, offset);

  t = Date.now();
  const { rows } = await pool.query(sql, params);
  recordQueryMetric(sql, Date.now() - t, rows.length);

  return { events: rows, total, limit, offset };
}

export interface ReplayFilter {
  fromLedger: number;
  toLedger?: number;
  eventTypes?: string[];
}

export async function queryEventsForReplay(filter: ReplayFilter): Promise<Record<string, unknown>[]> {
  const pool = getPool();
  let sql = 'SELECT * FROM raw_events WHERE ledger_sequence >= $1';
  const params: unknown[] = [filter.fromLedger];
  let paramIdx = 2;

  if (filter.toLedger !== undefined) {
    sql += ` AND ledger_sequence <= $${paramIdx++}`;
    params.push(filter.toLedger);
  }
  if (filter.eventTypes && filter.eventTypes.length > 0) {
    sql += ` AND event_type = ANY($${paramIdx++})`;
    params.push(filter.eventTypes);
  }
  sql += ' ORDER BY ledger_sequence ASC, id ASC';

  const t = Date.now();
  const { rows } = await pool.query(sql, params);
  recordQueryMetric(sql, Date.now() - t, rows.length);

  return rows;
}

export async function queryEventTypes(): Promise<string[]> {
  const pool = getPool();
  const querySql = 'SELECT DISTINCT event_type FROM raw_events ORDER BY event_type';
  const t = Date.now();
  const { rows } = await pool.query(querySql);
  recordQueryMetric(querySql, Date.now() - t, rows.length);
  return rows.map(r => r.event_type);
}

export async function queryEventsByDateRange(
  startDate: Date,
  endDate: Date,
  eventType?: string
): Promise<{ date: string; count: number }[]> {
  const pool = getPool();
  const params: unknown[] = [startDate, endDate];
  let typeFilter = '';
  if (eventType) {
    typeFilter = ' AND event_type = $3';
    params.push(eventType);
  }

  const querySql = `SELECT DATE(created_at) as date, COUNT(*)::int as count
     FROM raw_events
     WHERE created_at >= $1 AND created_at <= $2${typeFilter}
     GROUP BY DATE(created_at)
     ORDER BY date`;

  const t = Date.now();
  const { rows } = await pool.query(querySql, params);
  recordQueryMetric(querySql, Date.now() - t, rows.length);

  return rows.map(r => ({ date: r.date.toISOString().slice(0, 10), count: r.count }));
}
