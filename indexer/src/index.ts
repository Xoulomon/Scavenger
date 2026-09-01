import 'dotenv/config';
// #1159: All env var access goes through the config module.
import { config, validateConfig } from './config';
import { runMigrations } from './db/migrate';
import { closePool } from './db/client';
import { runIndexer } from './indexer';
import { createApiServer } from './api/server';
import { startAlertChecker, createAlertHistoryTable } from './monitoring/alerts';
import { logger } from './utils/logger';

async function main() {
  // #1159: Fail fast on startup if required vars are missing.
  validateConfig();

  logger.info('Starting Scavngr indexer', {
    rpcUrl: config.stellar.rpcUrl,
    contractId: config.stellar.contractId,
  });

  await runMigrations();
  await createAlertHistoryTable();

  const api = createApiServer({ port: config.server.apiPort, host: config.server.apiHost });
  await api.start();

  startAlertChecker();

  /**
   * Graceful shutdown handler.
   * Stops the API server (drains SSE connections), closes the DB pool,
   * then exits cleanly.  The indexer's own SIGTERM handler (in indexer.ts)
   * clears its polling interval; we call closePool() here so the DB is
   * released regardless of which signal fires first.
   */
  async function shutdown(signal: string) {
    logger.info('Shutdown initiated', { signal });
    try {
      await api.stop();
      await closePool();
      logger.info('Graceful shutdown complete');
    } catch (err) {
      logger.error('Error during shutdown', { error: String(err) });
    } finally {
      process.exit(0);
    }
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));

  await runIndexer(
    {
      rpcUrl: config.stellar.rpcUrl,
      contractId: config.stellar.contractId,
      startLedger: config.indexer.startLedger,
    },
    config.indexer.pollIntervalMs,
    api.metrics,
    api.broadcastEvent
  );
}

main().catch(err => {
  logger.error('Fatal error', { error: String(err) });
  process.exit(1);
});
