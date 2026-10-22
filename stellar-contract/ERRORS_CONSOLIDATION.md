# Stellar Contract Error Consolidation

This implementation record captures the consolidation tasks from issue #1505.
The referenced file was not present in the checked-out `main` branch, so its
original checklist could not be reviewed; the items below are taken from the
issue description and acceptance criteria.

## Status

- [x] Keep Soroban contract errors in the shared `src/errors.rs` `Error` enum.
- [x] Reserve one stable `u32` range per error domain:
  - Auth: `1000–1099`
  - Input: `2000–2099`
  - State: `3000–3099`
  - NotFound: `4000–4099`
  - Arithmetic: `5000–5099`
  - Config: `6000–6099`
- [x] Consolidate duplicate waste-type mismatch variants into
  `Error::WasteTypeMismatch`.
- [x] Remove duplicate validation helper definitions and route percentage
  validation through one shared helper.
- [x] Add a unit test that checks the actual enum discriminants for uniqueness
  and another that checks each discriminant against its domain range.
- [x] Publish the full numeric-code table in
  `../docs/ERROR_MESSAGE_GUIDE.md`.

The numeric assignments replace the former sequential `1–54` contract error
codes. Client applications that switch on those numeric values must update to
the table in the error guide. Retired codes must not be reused.

`KeyRotationError` and `CommitmentError` remain local subsystem helper enums;
neither is a Soroban `#[contracterror]` type exposed as the contract error
surface.

Validation helpers that continue to panic were not migrated to
`Result<_, Error>` here: doing so would require changing the return type and
client-visible behavior of unrelated contract entry points. This change only
consolidates duplicate validation helpers and the Soroban error code surface.
