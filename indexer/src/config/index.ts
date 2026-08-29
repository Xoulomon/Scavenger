/**
 * Application configuration
 */

export const config = {
  database: {
    url: process.env.DATABASE_URL || 'postgresql://localhost/scavenger',
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '20', 10),
    idleTimeout: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10),
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
} as const;

export function validateConfig(): void {
  if (!config.stellar.contractId) {
    throw new Error('CONTRACT_ID environment variable is required.');
  }
}
