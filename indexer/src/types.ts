// Re-export shared types for backward compatibility
export * from '@scavngr/types'

// Indexer-specific types and extensions
export interface IndexerConfig {
  contractId: string
  rpcUrl: string
  databaseUrl: string
  redisUrl?: string
  pollIntervalMs: number
  batchSize: number
  startLedger?: number
}

export interface IndexerState {
  lastProcessedLedger: number
  isRunning: boolean
  errorCount: number
  processedEvents: number
  startTime: number
}

export interface DatabaseConnection {
  query<T = unknown>(text: string, params?: unknown[]): Promise<{ rows: T[] }>
  transaction<T>(callback: (client: DatabaseConnection) => Promise<T>): Promise<T>
}

export interface CacheConnection {
  get(key: string): Promise<string | null>
  set(key: string, value: string, ttlSeconds?: number): Promise<void>
  del(key: string): Promise<void>
}
