import { getPool } from '../db/client';
import { recordQueryMetric } from '../db/queryOptimizer';
import { QUERY_LIMITS } from '../constants';

export type ParticipantRole = 'Recycler' | 'Collector' | 'Manufacturer';

export interface Participant {
  address: string;
  role: ParticipantRole;
  name: string;
  latitude: number;
  longitude: number;
  registeredAtLedger: number;
  registeredAt: string;
  isActive: boolean;
}

export interface ParticipantFilter {
  role?: ParticipantRole;
  isActive?: boolean;
  limit?: number;
  offset?: number;
}

export interface ParticipantQueryResult {
  participants: Participant[];
  total: number;
  limit: number;
  offset: number;
}

function mapRow(row: Record<string, unknown>): Participant {
  return {
    address: row.address as string,
    role: row.role as ParticipantRole,
    name: row.name as string,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    registeredAtLedger: Number(row.registered_at_ledger),
    registeredAt: (row.registered_at as Date).toISOString(),
    isActive: Boolean(row.is_active),
  };
}

export async function queryParticipantByAddress(
  address: string
): Promise<Participant | null> {
  const pool = getPool();
  const sql = 'SELECT * FROM participants WHERE address = $1';
  const t = Date.now();
  const { rows } = await pool.query(sql, [address]);
  recordQueryMetric(sql, Date.now() - t, rows.length);
  return rows.length > 0 ? mapRow(rows[0]) : null;
}

export async function queryParticipants(
  filter: ParticipantFilter
): Promise<ParticipantQueryResult> {
  const pool = getPool();
  const limit = Math.min(filter.limit ?? QUERY_LIMITS.MAX, QUERY_LIMITS.MAX);
  const offset = filter.offset ?? 0;

  let sql = 'SELECT * FROM participants WHERE 1=1';
  const params: unknown[] = [];
  let idx = 1;

  if (filter.role !== undefined) {
    sql += ` AND role = $${idx++}`;
    params.push(filter.role);
  }
  if (filter.isActive !== undefined) {
    sql += ` AND is_active = $${idx++}`;
    params.push(filter.isActive);
  }

  const countSql = sql.replace('SELECT *', 'SELECT COUNT(*)::int as total');
  let t = Date.now();
  const countResult = await pool.query(countSql, params);
  recordQueryMetric(countSql, Date.now() - t, 1);
  const total: number = countResult.rows[0]?.total ?? 0;

  sql += ` ORDER BY registered_at DESC LIMIT $${idx++} OFFSET $${idx++}`;
  params.push(limit, offset);

  t = Date.now();
  const { rows } = await pool.query(sql, params);
  recordQueryMetric(sql, Date.now() - t, rows.length);

  return { participants: rows.map(mapRow), total, limit, offset };
}

export interface UpsertParticipantInput {
  address: string;
  role: ParticipantRole;
  name: string;
  latitude: number;
  longitude: number;
  registeredAtLedger: number;
  registeredAt: Date;
}

export async function upsertParticipant(input: UpsertParticipantInput): Promise<Participant> {
  const pool = getPool();
  const sql = `
    INSERT INTO participants
      (address, role, name, latitude, longitude, registered_at_ledger, registered_at, is_active)
    VALUES ($1, $2, $3, $4, $5, $6, $7, true)
    ON CONFLICT (address) DO UPDATE SET
      role                 = EXCLUDED.role,
      name                 = EXCLUDED.name,
      latitude             = EXCLUDED.latitude,
      longitude            = EXCLUDED.longitude,
      registered_at_ledger = EXCLUDED.registered_at_ledger,
      registered_at        = EXCLUDED.registered_at,
      is_active            = true
    RETURNING *
  `;
  const params = [
    input.address,
    input.role,
    input.name,
    input.latitude,
    input.longitude,
    input.registeredAtLedger,
    input.registeredAt,
  ];
  const t = Date.now();
  const { rows } = await pool.query(sql, params);
  recordQueryMetric(sql, Date.now() - t, 1);
  return mapRow(rows[0]);
}

export async function deactivateParticipant(address: string): Promise<boolean> {
  const pool = getPool();
  const sql = 'UPDATE participants SET is_active = false WHERE address = $1 RETURNING address';
  const t = Date.now();
  const { rows } = await pool.query(sql, [address]);
  recordQueryMetric(sql, Date.now() - t, rows.length);
  return rows.length > 0;
}
