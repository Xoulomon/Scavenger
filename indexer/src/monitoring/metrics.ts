import { getPool } from '../db/client';
import { logger } from '../utils/logger';

export interface IndexerMetrics {
  eventsProcessed: number;
  eventsFailed: number;
  lastEventTimestamp: string | null;
  syncLag: number;
  reorgsDetected: number;
  alertsFired: number;
  uptime: number;
  dbConnections: number;
  eventsByType: Record<string, number>;
  totalEvents: number;
  averageProcessingTimeMs: number;
  errorsLastHour: number;
}

const metricsStartTime = Date.now();

export async function collectMetrics(): Promise<IndexerMetrics> {
  const pool = getPool();

  try {
    const [syncResult, eventsByTypeResult, totalResult, errorsResult, retTimeResult] = await Promise.all([
      pool.query('SELECT last_ledger, is_syncing, updated_at FROM sync_status LIMIT 1'),
      pool.query('SELECT event_type, COUNT(*)::int as cnt FROM raw_events GROUP BY event_type'),
      pool.query('SELECT COUNT(*)::int as total FROM raw_events'),
      pool.query(
        `SELECT COUNT(*)::int as cnt FROM raw_events
         WHERE created_at > NOW() - INTERVAL '1 hour'`
      ),
      pool.query('SELECT NOW() - updated_at as lag FROM sync_status LIMIT 1'),
    ]);

    const sync = syncResult.rows[0] || { last_ledger: 0, is_syncing: false, updated_at: null };
    const eventsByType: Record<string, number> = {};
    for (const row of eventsByTypeResult.rows) {
      eventsByType[row.event_type] = row.cnt;
    }

    return {
      eventsProcessed: totalResult.rows[0]?.total ?? 0,
      eventsFailed: 0,
      lastEventTimestamp: sync.updated_at?.toISOString() ?? null,
      syncLag: retTimeResult.rows[0]?.lag ? parseInterval(retTimeResult.rows[0].lag) : 0,
      reorgsDetected: 0,
      alertsFired: 0,
      uptime: Math.floor((Date.now() - metricsStartTime) / 1000),
      dbConnections: pool.totalCount,
      eventsByType,
      totalEvents: totalResult.rows[0]?.total ?? 0,
      averageProcessingTimeMs: 0,
      errorsLastHour: errorsResult.rows[0]?.cnt ?? 0,
    };
  } catch (err) {
    logger.error('Failed to collect metrics', { error: String(err) });
    return {
      eventsProcessed: 0,
      eventsFailed: 0,
      lastEventTimestamp: null,
      syncLag: 0,
      reorgsDetected: 0,
      alertsFired: 0,
      uptime: Math.floor((Date.now() - metricsStartTime) / 1000),
      dbConnections: 0,
      eventsByType: {},
      totalEvents: 0,
      averageProcessingTimeMs: 0,
      errorsLastHour: 0,
    };
  }
}

function parseInterval(interval: unknown): number {
  if (typeof interval === 'object' && interval !== null) {
    const obj = interval as Record<string, number>;
    const seconds = obj.seconds ?? 0;
    const minutes = obj.minutes ?? 0;
    const hours = obj.hours ?? 0;
    const days = obj.days ?? 0;
    return seconds + minutes * 60 + hours * 3600 + days * 86400;
  }
  if (typeof interval === 'number') {return interval;}
  if (typeof interval === 'string') {
    const match = interval.match(/(\d+):(\d+):(\d+)/);
    if (match) {
      return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
    }
  }
  return 0;
}
