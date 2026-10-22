# Error Consolidation Audit

## Audit scope

Searched `stellar-contract/src/*.rs` for locally-defined error enums that
duplicate `errors.rs`:

```
grep -n "pub enum.*Error" stellar-contract/src/*.rs
```

Findings:

- `waste.rs`, `incentive.rs`, `participant.rs`, and `lib.rs` already return
  `Result<_, Error>` using the shared `crate::errors::Error` enum. No
  duplicate contract-level error enum was found in these files.
- `key_rotation.rs` defines `KeyRotationError` (6 variants) and `zkp.rs`
  defines `CommitmentError` (6 variants). Both are subsystem-local helper
  enums, not `#[contracterror]` types surfaced directly to external
  callers, which the existing authoring rules in `errors.rs` (rule #3)
  explicitly allow to remain local.

## Change made

To move toward a single source of truth without risking a breaking change
to either subsystem's existing call sites, `errors.rs` gained twelve new,
purely additive variants (codes 55-66) that mirror `KeyRotationError` and
`CommitmentError` one-for-one:

- `KeyRotationNoActiveKey`, `KeyRotationVersionNotFound`,
  `KeyRotationUnauthorized`, `KeyRotationCannotPurgeActive`,
  `KeyRotationZeroKeyHash`, `KeyRotationAlreadyExists`
- `CommitmentNotFound`, `CommitmentHashMismatch`,
  `CommitmentAlreadyVerified`, `CommitmentCancelled`, `CommitmentExpired`,
  `CommitmentNotPending`

Existing numeric codes (1-54) were **not** renumbered, so this is
non-breaking for anything matching on or serializing `Error`. The
`category()` and `code()` match arms were updated to cover the new
variants so the crate continues to compile with an exhaustive match.

## Follow-up (not done in this change)

`key_rotation.rs` and `zkp.rs` still return their own local error types
from their public functions. Migrating `authorize()` in `key_rotation.rs`
and the commitment-verification functions in `zkp.rs` to return
`crate::errors::Error` instead of `KeyRotationError`/`CommitmentError` is
a larger change (it changes the public function signatures of those
modules) and is recommended as a follow-up PR so it can be reviewed and
tested independently.

## Acceptance criteria status

- [x] Audited contract modules for duplicate error enums
- [x] Additive shared variants added to `errors.rs` (single source of
      truth for new consolidation work)
- [ ] Full migration of `key_rotation.rs` / `zkp.rs` call sites (follow-up)
