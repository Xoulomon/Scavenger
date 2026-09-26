import { describe, it, expect } from 'vitest';
import {
  ParticipantRole,
  WasteType,
  WasteStatus,
  type Participant,
  type Waste,
  type ApiResponse,
} from './index';

// ---------------------------------------------------------------------------
// Issue #1309 — these tests validate the canonical type definitions from
// @scavngr/types, re-exported through this module.
//
// WasteType is a numeric enum (matching the Stellar contract's on-chain
// representation):  Paper=0, PetPlastic=1, Plastic=2, Metal=3, Glass=4,
// Organic=5, Electronic=6.
//
// WasteStatus is a string enum matching the off-chain API status strings.
// ---------------------------------------------------------------------------

describe('Type Definitions', () => {
  it('should define ParticipantRole enum correctly', () => {
    expect(ParticipantRole.Recycler).toBe(0);
    expect(ParticipantRole.Collector).toBe(1);
    expect(ParticipantRole.Manufacturer).toBe(2);
  });

  it('should define WasteType enum correctly (numeric, mirrors on-chain contract)', () => {
    // Canonical numeric values — must match the Soroban contract's WasteType
    // enum and @scavngr/types. Strings like 'plastic' are NOT valid values.
    expect(WasteType.Paper).toBe(0);
    expect(WasteType.PetPlastic).toBe(1);
    expect(WasteType.Plastic).toBe(2);
    expect(WasteType.Metal).toBe(3);
    expect(WasteType.Glass).toBe(4);
    expect(WasteType.Organic).toBe(5);
    expect(WasteType.Electronic).toBe(6);
  });

  it('should define WasteStatus enum correctly', () => {
    expect(WasteStatus.Submitted).toBe('submitted');
    expect(WasteStatus.Verified).toBe('verified');
    expect(WasteStatus.Transferred).toBe('transferred');
    expect(WasteStatus.Deactivated).toBe('deactivated');
  });

  it('should allow creating valid Participant objects', () => {
    const participant: Participant = {
      address: '0x123',
      role: ParticipantRole.Recycler,
      name: 'John',
      latitude: 40.7128,
      longitude: -74.006,
      registeredAt: Date.now(),
    };
    expect(participant.role).toBe(ParticipantRole.Recycler);
  });

  it('should allow creating valid Waste objects', () => {
    const waste: Waste = {
      id: '1',
      type: WasteType.Plastic,
      weight: 100,
      owner: '0x123',
      latitude: 40.7128,
      longitude: -74.006,
      status: WasteStatus.Submitted,
      createdAt: Date.now(),
      isActive: true,
      isConfirmed: false,
    };
    // WasteType.Plastic is 2 (numeric), not the string 'plastic'
    expect(waste.type).toBe(2);
    expect(waste.type).toBe(WasteType.Plastic);
  });

  it('should allow creating valid ApiResponse objects', () => {
    const response: ApiResponse<string> = {
      data: 'success',
      status: 200,
      message: 'Operation successful',
    };
    expect(response.status).toBe(200);
  });
});
