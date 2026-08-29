import { logger } from '../utils/logger';
import { RawContractEvent } from '../types';
import { queryEventsForReplay } from '../queries/eventQueries';

export interface ReplayRequest {
  fromLedger: number;
  toLedger?: number;
  eventTypes?: string[];
}

export interface ReplayResult {
  replayId: string;
  eventCount: number;
  status: 'started';
}

export async function startReplay(request: ReplayRequest): Promise<ReplayResult> {
  const { processEvents } = await import('../indexer');

  const replayId = `replay_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const rows = await queryEventsForReplay({
    fromLedger: request.fromLedger,
    toLedger: request.toLedger,
    eventTypes: request.eventTypes,
  });

  processEvents(rows as unknown as RawContractEvent[]).catch(err => {
    logger.error('Replay processing failed', { replayId, error: String(err) });
  });

  logger.info('Replay started', {
    replayId,
    fromLedger: request.fromLedger,
    toLedger: request.toLedger,
    eventCount: rows.length,
    eventTypes: request.eventTypes,
  });

  return { replayId, eventCount: rows.length, status: 'started' };
}
