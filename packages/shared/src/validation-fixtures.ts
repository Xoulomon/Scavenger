/**
 * Shared validation fixture set for cross-service parity testing.
 *
 * Every entry here is consumed by:
 *   - backend/tests/validation_parity_test.rs  (Rust)
 *   - indexer/tests/validation-parity.test.ts  (TypeScript)
 *
 * When adding or changing a rule in docs/VALIDATION_RULES.md, add the
 * corresponding fixtures here and update both test files.
 */

export interface AddressFixture {
  address: string;
  valid: boolean;
  reason: string;
}

/** Stellar address fixtures – canonical rule: /^G[A-Z2-7]{55}$/ */
export const STELLAR_ADDRESS_FIXTURES: AddressFixture[] = [
  // ── Valid ─────────────────────────────────────────────────────────────────
  {
    address: 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN',
    valid: true,
    reason: 'canonical 56-char base32 address',
  },
  {
    address: 'GBSZ2TDIPF35RKRN7JDFBXJBF63EETXLYNUFU7P7KWZFRLPZORVBGQ3',
    valid: true,
    reason: 'another valid address with digits 2 and 3',
  },
  {
    address: 'G' + 'A'.repeat(55),
    valid: true,
    reason: 'G followed by 55 A chars (all in [A-Z2-7])',
  },
  {
    address: 'G' + '2'.repeat(55),
    valid: true,
    reason: 'G followed by 55 twos (base32 digit 2)',
  },
  {
    address: 'G' + '7'.repeat(55),
    valid: true,
    reason: 'G followed by 55 sevens (base32 digit 7)',
  },
  // ── Invalid – length ──────────────────────────────────────────────────────
  {
    address: 'GABC',
    valid: false,
    reason: 'too short (4 chars)',
  },
  {
    address: '',
    valid: false,
    reason: 'empty string',
  },
  {
    address: 'G' + 'A'.repeat(54),
    valid: false,
    reason: 'only 55 chars total (one too short)',
  },
  {
    address: 'G' + 'A'.repeat(56),
    valid: false,
    reason: '57 chars total (one too long)',
  },
  // ── Invalid – first char ──────────────────────────────────────────────────
  {
    address: 'A' + 'A'.repeat(55),
    valid: false,
    reason: 'does not start with G',
  },
  {
    address: 'g' + 'A'.repeat(55),
    valid: false,
    reason: 'starts with lowercase g',
  },
  // ── Invalid – charset ────────────────────────────────────────────────────
  {
    address: 'G' + '0'.repeat(55),
    valid: false,
    reason: 'contains 0 (not in base32 [A-Z2-7])',
  },
  {
    address: 'G' + '1'.repeat(55),
    valid: false,
    reason: 'contains 1 (not in base32 [A-Z2-7])',
  },
  {
    address: 'G' + '8'.repeat(55),
    valid: false,
    reason: 'contains 8 (not in base32 [A-Z2-7])',
  },
  {
    address: 'G' + '9'.repeat(55),
    valid: false,
    reason: 'contains 9 (not in base32 [A-Z2-7])',
  },
  {
    address: 'G' + 'a'.repeat(55),
    valid: false,
    reason: 'contains lowercase a',
  },
  {
    address: 'G' + 'z'.repeat(55),
    valid: false,
    reason: 'contains lowercase z',
  },
  {
    address: 'G' + 'A'.repeat(54) + '!',
    valid: false,
    reason: 'contains special character !',
  },
];

export interface WeightFixture {
  weight: number;
  valid: boolean;
  reason: string;
}

/** Waste weight fixtures – rule: min=1, max=1_000_000_000 grams */
export const WASTE_WEIGHT_FIXTURES: WeightFixture[] = [
  { weight: 1, valid: true, reason: 'minimum valid weight' },
  { weight: 500, valid: true, reason: 'typical weight' },
  { weight: 1_000_000_000, valid: true, reason: 'maximum valid weight' },
  { weight: 0, valid: false, reason: 'zero is not allowed' },
  { weight: 1_000_000_001, valid: false, reason: 'exceeds maximum' },
];

export interface CoordinateFixture {
  lat: number;
  lon: number;
  valid: boolean;
  reason: string;
}

/** Coordinate fixtures – lat: [-90, 90], lon: [-180, 180] */
export const COORDINATE_FIXTURES: CoordinateFixture[] = [
  { lat: 0, lon: 0, valid: true, reason: 'origin' },
  { lat: 90, lon: 180, valid: true, reason: 'max boundary' },
  { lat: -90, lon: -180, valid: true, reason: 'min boundary' },
  { lat: 51.5074, lon: -0.1278, valid: true, reason: 'London coordinates' },
  { lat: 91, lon: 0, valid: false, reason: 'latitude above 90' },
  { lat: -91, lon: 0, valid: false, reason: 'latitude below -90' },
  { lat: 0, lon: 181, valid: false, reason: 'longitude above 180' },
  { lat: 0, lon: -181, valid: false, reason: 'longitude below -180' },
  { lat: 91, lon: 181, valid: false, reason: 'both out of range' },
];
