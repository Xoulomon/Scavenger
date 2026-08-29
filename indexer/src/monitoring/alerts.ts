import { getPool } from '../db/client';
import { collectMetrics } from './metrics';
import { logger } from '../utils/logger';

export interface AlertRule {
  name: string;
  description: string;
  severity: 'info' | 'warning' | 'critical';
  evaluate: () => Promise<boolean>;
}

const DEFAULT_RULES: AlertRule[] = [
  {
    name: 'sync_lag_high',
    description: 'Indexer sync lag exceeds 5 minutes',
    severity: 'warning',
    evaluate: async () => {
      const metrics = await collectMetrics();
      return metrics.syncLag > 300;
    },
  },
  {
    name: 'no_events_processed',
    description: 'No events processed in the last 10 minutes',
    severity: 'critical',
    evaluate: async () => {
      const pool = getPool();
      const { rows } = await pool.query(
        `SELECT COUNT(*)::int as cnt FROM raw_events
         WHERE created_at > NOW() - INTERVAL '10 minutes'`
      );
      return (rows[0]?.cnt ?? 0) === 0;
    },
  },
  {
    name: 'db_connections_high',
    description: 'Database connection count exceeds 20',
    severity: 'warning',
    evaluate: async () => {
      const metrics = await collectMetrics();
      return metrics.dbConnections > 20;
    },
  },
  {
    name: 'reorg_detected',
    description: 'Blockchain reorganization detected',
    severity: 'critical',
    evaluate: async () => {
      const pool = getPool();
      const { rows } = await pool.query(
        `SELECT COUNT(*)::int as cnt FROM alert_history
         WHERE alert_name = 'reorg_detected'
         AND created_at > NOW() - INTERVAL '5 minutes'`
      );
      return (rows[0]?.cnt ?? 0) > 0;
    },
  },
  {
    name: 'events_processing_error',
    description: 'Errors in event processing detected',
    severity: 'warning',
    evaluate: async () => {
      const metrics = await collectMetrics();
      return metrics.errorsLastHour > 0;
    },
  },
];

let checkInterval: ReturnType<typeof setInterval> | null = null;

export async function createAlertHistoryTable(): Promise<void> {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS alert_history (
      id BIGSERIAL PRIMARY KEY,
      alert_name TEXT NOT NULL,
      severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
      message TEXT NOT NULL,
      metadata JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

export async function fireAlert(
  name: string,
  severity: string,
  message: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  const pool = getPool();
  await pool.query(
    `INSERT INTO alert_history (alert_name, severity, message, metadata)
     VALUES ($1, $2, $3, $4)`,
    [name, severity, message, metadata ? JSON.stringify(metadata) : null]
  );
  logger.warn('Alert fired', { alert: name, severity, message });
}

export async function evaluateRules(rules: AlertRule[] = DEFAULT_RULES): Promise<void> {
  for (const rule of rules) {
    try {
      const shouldFire = await rule.evaluate();
      if (shouldFire) {
        await fireAlert(rule.name, rule.severity, rule.description);
      }
    } catch (err) {
      logger.error('Alert rule evaluation failed', { rule: rule.name, error: String(err) });
    }
  }
}

export function startAlertChecker(intervalMs = 60000): void {
  if (checkInterval) {return;}
  checkInterval = setInterval(() => {
    evaluateRules().catch(err => {
      logger.error('Alert check cycle failed', { error: String(err) });
    });
  }, intervalMs);
  logger.info('Alert checker started', { intervalMs });
}

export function stopAlertChecker(): void {
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
  }
}
