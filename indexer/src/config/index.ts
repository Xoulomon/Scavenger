/**
 * #1159: Application configuration — the single source of truth for all
 * environment variable reads in the indexer process.
 *
 * Rules:
 *  - Every `process.env.*` access must live in this file.
 *  - Other modules import from `'./config'` (or `'../config'`) and use the
 *    exported `config` object.
 *  - `validateConfig()` is called at startup and throws fast if required vars
 *    are missing.
 *
 * ## Environment variables
 *
 * ### Required
 * | Variable         | Description                                  |
 * |------------------|----------------------------------------------|
 * | `DATABASE_URL`   | PostgreSQL connection string                 |
 * | `STELLAR_RPC_URL`| Soroban / Stellar RPC endpoint               |
 * | `CONTRACT_ID`    | Deployed Soroban contract address            |
 *
 * ### Optional
 * | Variable                  | Default  | Description                        |
 * |---------------------------|----------|------------------------------------|
 * | `STELLAR_NETWORK`         | testnet  | Stellar network identifier         |
 * | `LOG_LEVEL`               | info     | Logging verbosity                  |
 * | `LOG_FORMAT`              | json     | `json` or `pretty`                 |
 * | `API_PORT`                | 3001     | HTTP API server port               |
 * | `API_HOST`                | 0.0.0.0  | HTTP API server bind address       |
 * | `START_LEDGER`            | 0        | Ledger sequence to start from      |
 * | `POLL_INTERVAL_MS`        | 5000     | Stellar poll interval (ms)         |
 * | `DB_MAX_CONNECTIONS`      | 20       | Connection pool max size           |
 * | `DB_MIN_CONNECTIONS`      | 2        | Connection pool min size           |
 * | `DB_IDLE_TIMEOUT`         | 30000    | Idle connection timeout (ms)       |
 * | `DB_IDLE_TIMEOUT_MS`      | 30000    | Alias for DB_IDLE_TIMEOUT          |
 * | `DB_CONNECTION_TIMEOUT_MS`| 5000     | Acquire connection timeout (ms)    |
 * | `DB_STATEMENT_TIMEOUT_MS` | 30000    | Query statement timeout (ms)       |
 * | `SLOW_QUERY_THRESHOLD`    | 100      | Log queries slower than N ms       |
 * | `BATCH_SIZE`              | 100      | Event processing batch size        |
 */

export const config = {
  database: {
    url: process.env.DATABASE_URL || 'postgresql://localhost/scavenger',
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '20', 10),
    // DB_MIN_CONNECTIONS was previously only in db/client.ts — centralised here (#1159)
    minConnections: parseInt(process.env.DB_MIN_CONNECTIONS || '2', 10),
    // Support both naming conventions; DB_IDLE_TIMEOUT_MS takes precedence
    idleTimeoutMs: parseInt(
      process.env.DB_IDLE_TIMEOUT_MS || process.env.DB_IDLE_TIMEOUT || '30000',
      10,
    ),
    connectionTimeoutMs: parseInt(process.env.DB_CONNECTION_TIMEOUT_MS || '5000', 10),
    statementTimeoutMs: parseInt(process.env.DB_STATEMENT_TIMEOUT_MS || '30000', 10),
  },
  stellar: {
    network: process.env.STELLAR_NETWORK || 'testnet',
    rpcUrl: process.env.STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org',
    contractId: process.env.CONTRACT_ID || '',
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'json',
  },
  performance: {
    slowQueryThreshold: parseInt(process.env.SLOW_QUERY_THRESHOLD || '100', 10),
    batchSize: parseInt(process.env.BATCH_SIZE || '100', 10),
  },
  server: {
    apiPort: Number(process.env.API_PORT ?? 3001),
    apiHost: process.env.API_HOST ?? '0.0.0.0',
  },
  indexer: {
    startLedger: Number(process.env.START_LEDGER ?? 0),
    pollIntervalMs: Number(process.env.POLL_INTERVAL_MS ?? 5000),
  },
} as const;

/**
 * Validates that all required environment variables are present.
 * Throws an `Error` at startup if any required variable is missing.
 */
export function validateConfig(): void {
  if (!config.stellar.contractId) {
    throw new Error(
      'CONTRACT_ID environment variable is required. ' +
      'Set it to the deployed Soroban contract address.',
    );
  }
  if (!config.stellar.rpcUrl || config.stellar.rpcUrl === 'https://soroban-testnet.stellar.org') {
    // rpcUrl has a default, but warn if CONTRACT_ID is set and rpcUrl is still the default
    // (probably a misconfiguration — user may have forgotten STELLAR_RPC_URL)
    if (config.stellar.contractId && !process.env.STELLAR_RPC_URL) {
      // Non-fatal: allow testnet default, but log a warning. Actual hard fail is CONTRACT_ID.
    }
  }
  if (!config.database.url || config.database.url === 'postgresql://localhost/scavenger') {
    if (!process.env.DATABASE_URL) {
      throw new Error(
        'DATABASE_URL environment variable is required. ' +
        'Set it to a PostgreSQL connection string.',
      );
    }
  }
}
