# DTO Contract Alignment — Backend ↔ packages/types

> Relates to: [#1096 — Introduce a shared DTO layer between backend and packages/types]

## Overview

The Scavngr backend (Rust/serde) and the frontend/indexer (TypeScript) share a
type contract through `packages/types/src/index.ts`.  Because the two sides are
maintained independently there is a risk of *silent contract drift*:

- A Rust field is renamed without updating the TypeScript interface.
- A numeric enum is serialised differently (`0` vs `"recycler"` vs `"Recycler"`).
- A new optional field is added on one side but not the other.

This document defines the **alignment table** (current state), the
**drift-prevention process** (what to do on every change), and the
**test locations** (where automated checks live).

---

## Key Resource Alignment Table

| Resource | Rust struct (backend) | TypeScript interface (packages/types) | Status |
|---|---|---|---|
| Participant role | `ParticipantRole` (u32 via serde) | `ParticipantRole` enum (numeric) | ✅ Aligned |
| Waste status | `WasteStatus` (Soroban XDR) | `WasteStatus` string enum | ✅ Aligned |
| `VerificationStatus` | `verification::VerificationStatus` (`#[serde(rename_all = "lowercase")]`) | `"pending" \| "approved" \| "rejected" \| "under_review"` | ✅ Aligned |
| `ArchiveStatus` | `archival::ArchiveStatus` (`#[serde(rename_all = "lowercase")]`) | `"pending" \| "in_progress" \| "completed" \| "failed" \| "restored"` | ✅ Aligned |
| `StorageTier` | `archival::StorageTier` (`#[serde(rename_all = "snake_case")]`) | `"hot" \| "warm" \| "cold" \| "glacier"` | ✅ Aligned |
| `RetentionPolicy` | `archival::RetentionPolicy` | `RetentionPolicy` (TS interface) | ✅ Aligned |
| `ArchiveRecord` | `archival::ArchiveRecord` | `ArchiveRecord` (TS interface) | ✅ Aligned |
| `ParticipantVerification` | `verification::ParticipantVerification` | `ParticipantVerificationResponse` (TS interface) | ✅ Aligned |
| API response envelope | `api::ApiBuilder` (`data`, `error`, `meta`) | `ApiResponse<T>` in packages/types | ✅ Aligned |

---

## Automated Contract Tests

### Rust (backend)
`backend/tests/dto_contract_tests.rs` — runs with:

```bash
cargo test --test dto_contract_tests
```

These tests:
1. Serialise each Rust struct to JSON.
2. Assert that every required field key is present with the expected name.
3. Assert that enum variants serialise to the correct string literals.

### TypeScript (indexer ↔ frontend)
`tests/contract/api-contract.test.ts` — runs with:

```bash
cd tests/contract && npx jest --testPathPattern="api-contract"
```

These tests validate the shapes returned by the indexer against the frontend's
expected shapes.

---

## Drift-Prevention Process

Every PR that modifies **any** of the following must go through this checklist
before merging:

- `backend/src/services/*.rs` — any `pub struct` or `pub enum` that is
  serialised to a response body.
- `packages/types/src/index.ts` — any exported interface or enum.
- `backend/src/api/*.rs` — any serde `Deserialize` request struct or
  `Serialize` response struct.

### Checklist (add to PR description)

```markdown
## DTO Contract Checklist (#1096)

- [ ] Searched `backend/src` for serde structs / enums affected by this change
- [ ] Compared field names and serialisation against `packages/types/src/index.ts`
- [ ] Updated `docs/DTO_CONTRACT_ALIGNMENT.md` alignment table if any shape changed
- [ ] Updated / added a `backend/tests/dto_contract_tests.rs` snapshot test for
      every new or changed public struct
- [ ] Updated `tests/contract/schemas.ts` if any indexer-facing shape changed
- [ ] `cargo test --test dto_contract_tests` passes locally
- [ ] `cd tests/contract && npx jest` passes locally
```

### Manual comparison steps

1. For each modified Rust struct, run:

   ```bash
   cargo test --test dto_contract_tests 2>&1 | grep -E "FAILED|ok"
   ```

2. Open `packages/types/src/index.ts` and locate the matching interface.

3. For each field in the Rust struct, confirm:
   - The field name (after serde renames) matches the TypeScript key.
   - Numeric types (`u32`, `u64`, `i64`) are safe to round-trip through
     JSON (beware values > `Number.MAX_SAFE_INTEGER` — use `string` in TS).
   - Optional fields (`Option<T>`) are typed as `T | undefined` or `T?` in TS.
   - Enum variants use the same string literals on both sides.

4. If any discrepancy is found, update **both** sides and add a new contract test.

---

## Known Mismatches / Tracked Issues

| Field | Rust type | TS type | Notes |
|---|---|---|---|
| `total_earned` in `ParticipantStats` | `u128` (serialised as string by Soroban) | `bigint` | Frontend handles via `BigInt()` constructor — no immediate change needed but monitor |
| `waste_id` in transfer events | `u64` | `string \| bigint` | Intentionally widened on TS side for Soroban compatibility |

---

## Adding a New Shared Resource

1. Define the Rust struct in `backend/src/services/` or `backend/src/api/`.
2. Annotate with `#[derive(Serialize, Deserialize)]` and appropriate
   `#[serde(rename_all = "...")]` if field names differ from Rust conventions.
3. Add the TypeScript interface to `packages/types/src/index.ts`.
4. Add a contract test in `backend/tests/dto_contract_tests.rs`.
5. Update the alignment table in this document.
6. Open a PR with the DTO contract checklist completed.
