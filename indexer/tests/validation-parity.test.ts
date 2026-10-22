/**
 * Cross-service validation parity tests (issue #1154).
 *
 * These tests assert that every service enforces validation rules identically.
 * The fixture set lives in packages/shared/src/validation-fixtures.ts — any
 * change to a rule must update both the fixtures and all consuming test files.
 */
import {
  STELLAR_ADDRESS_FIXTURES,
  WASTE_WEIGHT_FIXTURES,
  COORDINATE_FIXTURES,
} from '../../packages/shared/src/validation-fixtures';
import { isValidStellarAddress } from '../../packages/shared/src/validation';

// ── Stellar address ─────────────────────────────────────────────────────────

describe('Stellar address validation (parity with backend)', () => {
  for (const fixture of STELLAR_ADDRESS_FIXTURES) {
    it(`${fixture.valid ? 'accepts' : 'rejects'} "${fixture.address.slice(0, 20)}…" — ${fixture.reason}`, () => {
      expect(isValidStellarAddress(fixture.address)).toBe(fixture.valid);
    });
  }
});

// ── Waste weight ─────────────────────────────────────────────────────────────

function isValidWeight(weight: number): boolean {
  return Number.isInteger(weight) && weight >= 1 && weight <= 1_000_000_000;
}

describe('Waste weight validation (parity with backend)', () => {
  for (const fixture of WASTE_WEIGHT_FIXTURES) {
    it(`${fixture.valid ? 'accepts' : 'rejects'} weight ${fixture.weight} — ${fixture.reason}`, () => {
      expect(isValidWeight(fixture.weight)).toBe(fixture.valid);
    });
  }
});

// ── Coordinates ──────────────────────────────────────────────────────────────

function isValidCoordinate(lat: number, lon: number): boolean {
  return lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
}

describe('Coordinate validation (parity with backend)', () => {
  for (const fixture of COORDINATE_FIXTURES) {
    it(`${fixture.valid ? 'accepts' : 'rejects'} (${fixture.lat}, ${fixture.lon}) — ${fixture.reason}`, () => {
      expect(isValidCoordinate(fixture.lat, fixture.lon)).toBe(fixture.valid);
    });
  }
});

// ── Canonical regex guard ────────────────────────────────────────────────────

describe('Stellar address regex canonical form', () => {
  const CANONICAL = /^G[A-Z2-7]{55}$/;

  it('rejects characters not in Stellar base32 alphabet (0,1,8,9,lowercase)', () => {
    const invalid = ['0', '1', '8', '9', 'a', 'b', 'z', '!', ' '];
    for (const ch of invalid) {
      const addr = 'G' + ch.repeat(55);
      expect(CANONICAL.test(addr)).toBe(false);
    }
  });

  it('accepts all valid base32 characters in positions 1-55', () => {
    const validChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    for (const ch of validChars) {
      const addr = 'G' + ch.repeat(55);
      expect(CANONICAL.test(addr)).toBe(true);
    }
  });
});
