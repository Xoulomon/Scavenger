/**
 * Factory functions for creating typed Stellar RPC responses
 */

import {
  StellarRpcGetEventsResponse,
  StellarRpcGetLedgerResponse,
  StellarRpcSimulateTransactionResponse,
  StellarEvent,
  RpcResponseFactoryOptions,
} from './types';

const DEFAULT_CONTRACT_ID = 'CBCDEFG2IWHSIXUHKKQ44HJVS7B4DKHJMKPQ7K5HJMSKP7B4DKHJMKPQ7K5';
const DEFAULT_TIMESTAMP = new Date('2024-01-15T12:00:00Z').toISOString();
const DEFAULT_LEDGER = 50000;

/**
 * Create a mock Stellar event
 */
export function createStellarEvent(
  overrides?: Partial<StellarEvent>
): StellarEvent {
  return {
    type: 'contract',
    ledger: DEFAULT_LEDGER,
    ledgerCloseTime: new Date(DEFAULT_TIMESTAMP).getTime() / 1000,
    contractId: DEFAULT_CONTRACT_ID,
    id: `${DEFAULT_LEDGER}-0`,
    pagingToken: `${DEFAULT_LEDGER}-0`,
    inSuccessfulTransaction: true,
    topic: ['waste_registered', '42'],
    value: [0, '1000', DEFAULT_CONTRACT_ID, '0', '0'],
    ...overrides,
  };
}

/**
 * Create a mock getEvents RPC response
 */
export function createGetEventsResponse(
  options?: RpcResponseFactoryOptions
): StellarRpcGetEventsResponse {
  const {
    ledger = DEFAULT_LEDGER,
    timestamp = DEFAULT_TIMESTAMP,
    contractId = DEFAULT_CONTRACT_ID,
    eventCount = 1,
  } = options || {};

  const baseTime = new Date(timestamp as string).getTime() / 1000;
  const events: StellarEvent[] = [];

  for (let i = 0; i < eventCount; i++) {
    events.push(
      createStellarEvent({
        ledger,
        ledgerCloseTime: Math.floor(baseTime) + i,
        contractId,
        id: `${ledger}-${i}`,
        pagingToken: `${ledger}-${i}`,
      })
    );
  }

  return {
    ledger,
    events,
    latestLedger: ledger,
    latestLedgerCloseTime: Math.floor(baseTime),
  };
}

/**
 * Create a mock getLedger RPC response
 */
export function createGetLedgerResponse(
  options?: RpcResponseFactoryOptions
): StellarRpcGetLedgerResponse {
  const {
    ledger = DEFAULT_LEDGER,
    timestamp = DEFAULT_TIMESTAMP,
  } = options || {};

  return {
    id: `ledger-${ledger}`,
    pagingToken: `${ledger}-0`,
    hash: `hash_${ledger}_${'a'.repeat(56)}`,
    prevHash: `hash_${ledger - 1}_${'b'.repeat(56)}`,
    sequence: ledger,
    successfulTransactionCount: 10,
    failedTransactionCount: 2,
    operationCount: 45,
    closedAt: typeof timestamp === 'number'
      ? new Date(timestamp).toISOString()
      : (timestamp as string),
    totalCoins: '50000000000',
    feePool: '50000',
    baseFeeInStroops: 100,
    baseReserveInStroops: 5000000,
    maxTxSetSize: 1000,
  };
}

/**
 * Create a mock simulateTransaction RPC response
 */
export function createSimulateTransactionResponse(
  options?: RpcResponseFactoryOptions & {
    cpuInsn?: string;
    memByte?: string;
  }
): StellarRpcSimulateTransactionResponse {
  const {
    ledger = DEFAULT_LEDGER,
    cpuInsn = '1000',
    memByte = '2000',
  } = options || {};

  return {
    latestLedger: ledger,
    transactionData: 'AAAAAgAAAABmzHbCQB32BRY4P8f/C5xSKQQlxZ8HQzqo6FYMsKA8',
    minResourceFee: '2804',
    events: [
      createStellarEvent({
        ledger,
        type: 'contract',
      }),
    ],
    results: [
      {
        auth: [],
        xdr: 'AAAAEgAAAA==',
      },
    ],
    cost: {
      cpuInsn,
      memByte,
    },
    footprint: {
      readOnly: [],
      readWrite: [],
    },
  };
}

/**
 * Recorded fixture: Waste registration event
 */
export function createWasteRegisteredEvent(
  options?: Partial<StellarEvent>
): StellarEvent {
  return createStellarEvent({
    topic: ['waste_registered', '42'],
    value: [0, '1000', 'CA6....', '40000000', '-74000000'],
    ...options,
  });
}

/**
 * Recorded fixture: Participant registration event
 */
export function createParticipantRegisteredEvent(
  options?: Partial<StellarEvent>
): StellarEvent {
  return createStellarEvent({
    topic: ['participant_registered', 'recycler'],
    value: [0, 'GAAAA....', 'Test User', '0', '0'],
    ...options,
  });
}

/**
 * Recorded fixture: Waste transfer event
 */
export function createWasteTransferredEvent(
  options?: Partial<StellarEvent>
): StellarEvent {
  return createStellarEvent({
    topic: ['waste_transferred', '42'],
    value: [0, 'GFROM....', 'GTO....', '1000'],
    ...options,
  });
}

/**
 * Recorded fixture: Tokens rewarded event
 */
export function createTokensRewardedEvent(
  options?: Partial<StellarEvent>
): StellarEvent {
  return createStellarEvent({
    topic: ['tokens_rewarded', '42'],
    value: [0, 'GUSER....', '500'],
    ...options,
  });
}

/**
 * Recorded fixture: Events batch response
 */
export function createEventsBatchResponse(
  eventTypes: Array<
    | 'waste_registered'
    | 'participant_registered'
    | 'waste_transferred'
    | 'tokens_rewarded'
  > = [],
  options?: RpcResponseFactoryOptions
): StellarRpcGetEventsResponse {
  const events = eventTypes.map((type) => {
    switch (type) {
      case 'waste_registered':
        return createWasteRegisteredEvent();
      case 'participant_registered':
        return createParticipantRegisteredEvent();
      case 'waste_transferred':
        return createWasteTransferredEvent();
      case 'tokens_rewarded':
        return createTokensRewardedEvent();
      default:
        return createStellarEvent();
    }
  });

  return {
    ledger: options?.ledger ?? DEFAULT_LEDGER,
    events,
    latestLedger: options?.ledger ?? DEFAULT_LEDGER,
    latestLedgerCloseTime: Math.floor(
      new Date(options?.timestamp ?? DEFAULT_TIMESTAMP).getTime() / 1000
    ),
  };
}
