/**
 * Transform stage — Issue #920
 *
 * Takes a ParsedEvent (raw numeric/string fields extracted by the parse stage)
 * and applies domain normalization:
 *   - WASTE_TYPE_MAP: numeric → WasteType string
 *   - ROLE_MAP:       numeric → ParticipantRole string
 *   - Address normalization: trim whitespace, lowercase
 *
 * This function is pure — no side effects, no I/O, no database access.
 */

import { WASTE_TYPE_MAP, ROLE_MAP } from '../types';
import { DEFAULT_PARTICIPANT_ROLE, DEFAULT_WASTE_TYPE } from '../constants';
import { ParsedEvent, TransformedEvent } from './types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeAddress(addr: string): string {
  return addr.trim();
}

// ---------------------------------------------------------------------------
// Transform dispatch
// ---------------------------------------------------------------------------

/**
 * Transform a ParsedEvent into a TransformedEvent ready for the store stage.
 *
 * All ParsedEvent kinds must be handled — TypeScript will enforce exhaustiveness.
 */
export function transformEvent(parsed: ParsedEvent): TransformedEvent {
  switch (parsed.kind) {
    case 'WasteRegistered':
      return {
        ...parsed,
        wasteType: WASTE_TYPE_MAP[parsed.wasteTypeNum] ?? DEFAULT_WASTE_TYPE,
        recycler: normalizeAddress(parsed.recycler),
      };

    case 'ParticipantRegistered':
      return {
        ...parsed,
        role: ROLE_MAP[parsed.roleNum] ?? DEFAULT_PARTICIPANT_ROLE,
        address: normalizeAddress(parsed.address),
        name: parsed.name.trim(),
      };

    case 'WasteTransferred':
      return {
        ...parsed,
        from: normalizeAddress(parsed.from),
        to: normalizeAddress(parsed.to),
      };

    case 'WasteConfirmed':
      return { ...parsed };

    case 'TokensRewarded':
      return {
        ...parsed,
        recipient: normalizeAddress(parsed.recipient),
      };

    case 'WasteDeactivated':
      return { ...parsed };

    case 'WasteGraded':
      return { ...parsed };

    case 'ProcessingStatusChanged':
      return { ...parsed };

    case 'WasteContaminated':
      return { ...parsed };

    case 'AuctionCreated':
      return {
        ...parsed,
        creator: normalizeAddress(parsed.creator),
      };

    case 'AuctionEnded':
      return {
        ...parsed,
        winner: parsed.winner !== null ? normalizeAddress(parsed.winner) : null,
      };

    case 'CarbonCreditsEarned':
      return {
        ...parsed,
        wasteType: WASTE_TYPE_MAP[parsed.wasteTypeNum] ?? DEFAULT_WASTE_TYPE,
        participant: normalizeAddress(parsed.participant),
      };
  }
}
