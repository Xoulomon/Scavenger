# Validation Rules

This document is the single source of truth for every input constraint that
must be enforced identically across the backend (Rust/actix-web), the indexer
(TypeScript), the frontend (React), and the SDK.

Any change to a rule here **must** be accompanied by matching changes in every
service that enforces it and must update the shared fixture file
`packages/shared/src/validation-fixtures.ts`.

## Stellar Address

| Property | Value |
|----------|-------|
| Length | 56 characters |
| First character | `G` (uppercase) |
| Remaining 55 characters | Stellar base32 alphabet: `A–Z` and `2–7` |
| Regex (canonical) | `^G[A-Z2-7]{55}$` |
| Relevant RFC | [Stellar StrKey encoding](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0023.md) |

**Accept examples:**
- `GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN` (56 chars, all base32)
- `GBSZ2TDIPF35RKRN7JDFBXJBF63EETXLYNUFU7P7KWZFRLPZORVBGQ3` (valid testnet address)

**Reject examples (with reason):**
- `GABC` — too short (4 chars)
- `A` + `A×55` — does not start with `G`
- `G` + `0×55` — contains `0` which is not in base32 alphabet [A-Z2-7]
- `G` + `1×55` — contains `1` which is not in base32 alphabet [A-Z2-7]
- `G` + `a×55` — lowercase letters are not valid
- `G` + `8×55` — `8` and `9` are not in base32 alphabet

**Implementation locations:**

| Service | File | Function/Rule |
|---------|------|---------------|
| Backend (Rust) | `backend/src/validation/mod.rs` | `validate_stellar_address()` |
| Indexer (TS) | *(uses shared package)* | `isValidStellarAddress()` from `@scavngr/shared` |
| Frontend (TS) | `frontend/src/lib/validation/stellarAddress.ts` | `stellarAddressSchema`, `isValidStellarAddress()` |
| SDK (TS) | `packages/scavenger-sdk/src/network.ts` | `isValidStellarAddress()` |
| Shared (TS) | `packages/shared/src/validation.ts` | `isValidStellarAddress()` |

## Geographic Coordinates

| Property | Min | Max |
|----------|-----|-----|
| Latitude | -90.0 | 90.0 |
| Longitude | -180.0 | 180.0 |

Coordinates outside these ranges must be rejected. Both endpoints are inclusive.

## Waste Weight

| Property | Min | Max |
|----------|-----|-----|
| Weight (grams) | 1 | 1,000,000,000 |

Zero weight and weights exceeding one billion grams must be rejected.

## Participant Name

| Property | Constraint |
|----------|------------|
| Length | 1–100 characters (after trimming whitespace) |
| Allowed characters | Letters (Unicode), digits, spaces (` `), hyphens (`-`) |
| Empty / whitespace-only | Rejected |

## Pagination

| Parameter | Min | Max |
|-----------|-----|-----|
| `page` | 1 | — |
| `limit` | 1 | 100 |

## Export Format

Allowed values: `csv`, `json`, `pdf` (case-insensitive).
