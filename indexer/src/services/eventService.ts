import { queryEvents, EventFilter, EventQueryResult } from '../queries/eventQueries'

export interface EventQueryParams {
  eventType?: string | null
  fromLedger?: string | null
  toLedger?: string | null
  limit?: string | null
  offset?: string | null
  contractId?: string | null
  txHash?: string | null
}

export async function getEvents(params: EventQueryParams): Promise<EventQueryResult> {
  const filter: EventFilter = {
    eventType: params.eventType ?? undefined,
    fromLedger: params.fromLedger ? Number(params.fromLedger) : undefined,
    toLedger: params.toLedger ? Number(params.toLedger) : undefined,
    contractId: params.contractId ?? undefined,
    transactionHash: params.txHash ?? undefined,
    limit: Math.min(Number(params.limit) || 100, 1000),
    offset: Number(params.offset) || 0
  }

  return queryEvents(filter)
}
