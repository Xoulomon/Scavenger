/**
 * Types for Stellar RPC mock responses
 */

export interface StellarRpcGetEventsResponse {
  ledger: number;
  events: StellarEvent[];
  latestLedger: number;
  latestLedgerCloseTime: number;
}

export interface StellarEvent {
  type: string;
  ledger: number;
  ledgerCloseTime: number;
  contractId: string;
  id: string;
  pagingToken: string;
  inSuccessfulTransaction: boolean;
  topic: string[];
  value: unknown[];
}

export interface StellarRpcGetLedgerResponse {
  id: string;
  pagingToken: string;
  hash: string;
  prevHash: string;
  sequence: number;
  successfulTransactionCount: number;
  failedTransactionCount: number;
  operationCount: number;
  closedAt: string;
  totalCoins: string;
  feePool: string;
  baseFeeInStroops: number;
  baseReserveInStroops: number;
  maxTxSetSize: number;
}

export interface StellarRpcSimulateTransactionResponse {
  latestLedger: number;
  transactionData: string;
  minResourceFee: string;
  events: StellarEvent[];
  results?: Array<{
    auth: string[];
    xdr: string;
  }>;
  cost?: {
    cpuInsn: string;
    memByte: string;
  };
  footprint?: {
    readOnly: string[];
    readWrite: string[];
  };
  error?: string;
}

export interface RpcResponseFactoryOptions {
  ledger?: number;
  timestamp?: string | number;
  contractId?: string;
  eventCount?: number;
}
