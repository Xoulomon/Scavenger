import { Pool, PoolClient, PoolConfig } from 'pg';
import { config } from '../config';
import { logger } from '../utils/logger';

let pool: Pool | null = null;

/**
 * Build pool configuration from the central config module (#1159).
 *
 * All database connection variables are read from `config.database.*` rather
 * than directly from `process.env`.  Add new variables to
 * `indexer/src/config/index.ts` rather than here.
 */
function buildPoolConfig(): PoolConfig {
  return {
    connectionString: config.database.url,
    max: config.database.maxConnections,
    min: config.database.minConnections,
    idleTimeoutMillis: config.database.idleTimeout,
    connectionTimeoutMillis: config.database.connectionTimeoutMs,
    statement_timeout: config.database.statementTimeoutMs,
  };
}

export function getPool(): Pool {
  if (!pool) {
    const poolConfig = buildPoolConfig();
    pool = new Pool(poolConfig);

    pool.on('error', (err) => {
      logger.error('Unexpected DB pool error', { error: String(err) });
    });

    pool.on('connect', () => {
      logger.debug('New DB client connected');
    });

    logger.info('DB connection pool created', {
      max: poolConfig.max,
      min: poolConfig.min,
      idleTimeoutMs: poolConfig.idleTimeoutMillis,
      connectionTimeoutMs: poolConfig.connectionTimeoutMillis,
      statementTimeoutMs: poolConfig.statement_timeout,
    });
  }
  return pool;
}

export async function withClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  return withClient(async (client) => {
    await client.query('BEGIN');
    try {
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
  });
}

export async function closePool(): Promise<void> {
  if (pool) {
    logger.info('Closing DB connection pool');
    await pool.end();
    pool = null;
  }
}
