/**
 * @fileoverview Database row / persistence-layer types for the indexer.
 *
 * These types model the shape of rows returned by PostgreSQL queries —
 * they intentionally differ from the domain types in @scavngr/types:
 *
 *   - Numeric values (lat/lon, weight, amounts) are returned as `string`
 *     by the `pg` driver's default numeric type handling.
 *   - Timestamps are `Date` objects hydrated by `pg`, not UNIX epoch numbers.
 *   - Field names follow the DB column/alias naming convention (e.g.
 *     `recyclerAddress`, `fromAddress`) rather than the domain convention.
 *   - Enum values are stored / returned as their string label
 *     ('Recycler' | 'Collector' | 'Manufacturer'), not numeric ordinals.
 *
 * For shared domain types (WasteType enum, ParticipantRole enum, Incentive
 * interface, etc.) import from @scavngr/types instead:
 *
 *   import { WasteType, ParticipantRole } from '@scavngr/types'
 *
 * See issue #1309 for the type-consolidation context.
 */

export interface Participant {
  address: string;
  role: 'Recycler' | 'Collector' | 'Manufacturer';
  name: string;
  latitude: string;
  longitude: string;
  registeredAt: Date;
}

export interface Waste {
  id: string;
  recyclerAddress: string;
  wasteType: string;
  weight: string;
  isConfirmed: boolean;
  isActive: boolean;
  registeredAt: Date;
}

export interface WasteTransfer {
  wasteId: string;
  fromAddress: string;
  toAddress: string;
  transferredAt: Date;
}

export interface TokenReward {
  recipientAddress: string;
  amount: string;
  wasteId: string;
  rewardedAt: Date;
}

export interface QueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'ASC' | 'DESC';
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}
