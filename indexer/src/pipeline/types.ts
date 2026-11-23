/**
 * Pipeline type definitions.
 *
 * ParsedEvent  – raw field extraction from a RawContractEvent (pure parsing, no lookups)
 * TransformedEvent – after domain normalization (WASTE_TYPE_MAP, ROLE_MAP, address normalization)
 *
 * Both use discriminated unions keyed on `kind` so the compiler narrows correctly.
 */

import { WasteType, ParticipantRole } from '../types'

// ---------------------------------------------------------------------------
// Shared metadata carried through every stage
// ---------------------------------------------------------------------------

export interface EventMeta {
  ledgerSequence: number
  ledgerCloseTime: Date
  transactionHash: string
  contractId: string
}

// ---------------------------------------------------------------------------
// ParsedEvent – typed extraction, numbers still raw (before map lookups)
// ---------------------------------------------------------------------------

export type ParsedEvent =
  | ParsedWasteRegistered
  | ParsedParticipantRegistered
  | ParsedWasteTransferred
  | ParsedWasteConfirmed
  | ParsedTokensRewarded
  | ParsedWasteDeactivated
  | ParsedWasteGraded
  | ParsedProcessingStatusChanged
  | ParsedWasteContaminated
  | ParsedAuctionCreated
  | ParsedAuctionEnded
  | ParsedCarbonCreditsEarned

export interface ParsedWasteRegistered extends EventMeta {
  kind: 'WasteRegistered'
  wasteId: string
  wasteTypeNum: number
  weight: string
  recycler: string
  lat: string
  lon: string
}

export interface ParsedParticipantRegistered extends EventMeta {
  kind: 'ParticipantRegistered'
  address: string
  roleNum: number
  name: string
  lat: string
  lon: string
}

export interface ParsedWasteTransferred extends EventMeta {
  kind: 'WasteTransferred'
  wasteId: string
  from: string
  to: string
}

export interface ParsedWasteConfirmed extends EventMeta {
  kind: 'WasteConfirmed'
  wasteId: string
}

export interface ParsedTokensRewarded extends EventMeta {
  kind: 'TokensRewarded'
  recipient: string
  amount: string
  wasteId: string
}

export interface ParsedWasteDeactivated extends EventMeta {
  kind: 'WasteDeactivated'
  wasteId: string
}

export interface ParsedWasteGraded extends EventMeta {
  kind: 'WasteGraded'
  wasteId: string
  grade: string
}

export interface ParsedProcessingStatusChanged extends EventMeta {
  kind: 'ProcessingStatusChanged'
  wasteId: string
  status: number
}

export interface ParsedWasteContaminated extends EventMeta {
  kind: 'WasteContaminated'
  wasteId: string
  level: number
}

export interface ParsedAuctionCreated extends EventMeta {
  kind: 'AuctionCreated'
  auctionId: string
  wasteId: string
  creator: string
  startPrice: string
  endTime: string
}

export interface ParsedAuctionEnded extends EventMeta {
  kind: 'AuctionEnded'
  auctionId: string
  winner: string | null
  finalPrice: string
}

export interface ParsedCarbonCreditsEarned extends EventMeta {
  kind: 'CarbonCreditsEarned'
  participant: string
  wasteTypeNum: number
  weight: string
  credits: string
}

// ---------------------------------------------------------------------------
// TransformedEvent – after domain lookups and normalization
// ---------------------------------------------------------------------------

export type TransformedEvent =
  | TransformedWasteRegistered
  | TransformedParticipantRegistered
  | TransformedWasteTransferred
  | TransformedWasteConfirmed
  | TransformedTokensRewarded
  | TransformedWasteDeactivated
  | TransformedWasteGraded
  | TransformedProcessingStatusChanged
  | TransformedWasteContaminated
  | TransformedAuctionCreated
  | TransformedAuctionEnded
  | TransformedCarbonCreditsEarned

export interface TransformedWasteRegistered extends EventMeta {
  kind: 'WasteRegistered'
  wasteId: string
  wasteType: WasteType
  weight: string
  recycler: string
  lat: string
  lon: string
}

export interface TransformedParticipantRegistered extends EventMeta {
  kind: 'ParticipantRegistered'
  address: string
  role: ParticipantRole
  name: string
  lat: string
  lon: string
}

export interface TransformedWasteTransferred extends EventMeta {
  kind: 'WasteTransferred'
  wasteId: string
  from: string
  to: string
}

export interface TransformedWasteConfirmed extends EventMeta {
  kind: 'WasteConfirmed'
  wasteId: string
}

export interface TransformedTokensRewarded extends EventMeta {
  kind: 'TokensRewarded'
  recipient: string
  amount: string
  wasteId: string
}

export interface TransformedWasteDeactivated extends EventMeta {
  kind: 'WasteDeactivated'
  wasteId: string
}

export interface TransformedWasteGraded extends EventMeta {
  kind: 'WasteGraded'
  wasteId: string
  grade: string
}

export interface TransformedProcessingStatusChanged extends EventMeta {
  kind: 'ProcessingStatusChanged'
  wasteId: string
  status: number
}

export interface TransformedWasteContaminated extends EventMeta {
  kind: 'WasteContaminated'
  wasteId: string
  level: number
}

export interface TransformedAuctionCreated extends EventMeta {
  kind: 'AuctionCreated'
  auctionId: string
  wasteId: string
  creator: string
  startPrice: string
  endTime: string
}

export interface TransformedAuctionEnded extends EventMeta {
  kind: 'AuctionEnded'
  auctionId: string
  winner: string | null
  finalPrice: string
}

export interface TransformedCarbonCreditsEarned extends EventMeta {
  kind: 'CarbonCreditsEarned'
  participant: string
  wasteType: WasteType
  weight: string
  credits: string
}
