import { getPool } from '../db/client'
import { recordQueryMetric } from '../db/queryOptimizer'

export async function queryRecentAlerts(limit: number): Promise<Record<string, unknown>[]> {
  const pool = getPool()
  const sql = 'SELECT * FROM alert_history ORDER BY created_at DESC LIMIT $1'
  const t = Date.now()
  const { rows } = await pool.query(sql, [limit])
  recordQueryMetric(sql, Date.now() - t, rows.length)
  return rows
}
