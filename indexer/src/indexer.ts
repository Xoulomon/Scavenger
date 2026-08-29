import { PoolClient } from 'pg';
import { RawContractEvent } from './types';
import { fetchEvents, getLatestLedger, StreamerConfig } from './stellar/streamer';
import { dispatchEvent } from './handlers/dispatcher';
import {
  getSyncStatus,
  updateSyncStatus,
  setSyncing,
  detectAndHandleReorg,
  storeRawEvent,
  withTransaction,
} from './sync/syncStatus';
import { logger } from './utils/logger';

const BATCH_SIZE = 200;

export async function processEvents(
  events: RawContractEvent[],
  metrics?: { eventsProcessed: number; eventsFailed: number; eventsByType: Record<string, number>; reorgsDetected?: number },
  broadcastEvent?: (event: Record<string, unknown>) => void
): Promise<void> {
  if (events.length === 0) {return;}

  await withTransaction(async (client: PoolClient) => {
    const ledgerGroups = new Map<number, RawContractEvent[]>();
    for (const e of events) {
      const group = ledgerGroups.get(e.ledgerSequence) ?? [];
      group.push(e);
      ledgerGroups.set(e.ledgerSequence, group);
    }

    for (const [ledger, ledgerEvents] of ledgerGroups) {
      const incomingHashes = new Set(ledgerEvents.map(e => e.transactionHash));
      const reorged = await detectAndHandleReorg(client, ledger, incomingHashes);
      if (reorged) {
        logger.warn('Reorg detected', { ledger });
        if (metrics) {metrics.reorgsDetected = (metrics.reorgsDetected ?? 0) + 1;}
      }

      for (const event of ledgerEvents) {
        try {
          await storeRawEvent(client, event);
          await dispatchEvent(client, event);
          if (metrics) {
            metrics.eventsProcessed++;
            metrics.eventsByType[event.eventType] = (metrics.eventsByType[event.eventType] ?? 0) + 1;
          }
          if (broadcastEvent) {
            broadcastEvent({
              type: 'event_processed',
              eventType: event.eventType,
              ledger: event.ledgerSequence,
              transactionHash: event.transactionHash,
            });
          }
        } catch (err) {
          logger.error('Event processing failed', {
            eventType: event.eventType,
            ledger: event.ledgerSequence,
            error: String(err),
          });
          if (metrics) {metrics.eventsFailed++;}
        }
      }

      const lastEvent = ledgerEvents[ledgerEvents.length - 1];
      await updateSyncStatus(client, ledger, lastEvent.ledgerCloseTime);
    }
  });
}

export async function runIndexer(
  config: StreamerConfig,
  pollIntervalMs = 5000,
  metrics?: { eventsProcessed: number; eventsFailed: number; eventsByType: Record<string, number>; reorgsDetected?: number },
  broadcastEvent?: (event: Record<string, unknown>) => void
): Promise<void> {
  await setSyncing(true);
  logger.info('Indexer started', { pollIntervalMs });

  const run = async () => {
    try {
      const { lastLedger } = await getSyncStatus();
      const latestLedger = await getLatestLedger(config.rpcUrl);

      if (lastLedger >= latestLedger) {return;}

      const fromLedger = lastLedger === 0 ? config.startLedger : lastLedger + 1;
      const toLedger = Math.min(fromLedger + BATCH_SIZE - 1, latestLedger);

      logger.info('Fetching ledgers', { fromLedger, toLedger });
      const events = await fetchEvents(config, fromLedger, toLedger);
      await processEvents(events, metrics, broadcastEvent);

      if (events.length === 0) {
        await withTransaction(async (client: PoolClient) => {
          await updateSyncStatus(client, toLedger, new Date());
        });
      }

      if (broadcastEvent && events.length > 0) {
        broadcastEvent({
          type: 'batch_processed',
          fromLedger,
          toLedger,
          eventCount: events.length,
        });
      }
    } catch (err) {
      logger.error('Indexer run error', { error: String(err) });
    }
  };

  await run();
  const interval = setInterval(run, pollIntervalMs);

  process.on('SIGTERM', async () => {
    clearInterval(interval);
    await setSyncing(false);
    logger.info('Indexer stopped');
    process.exit(0);
  });
}
