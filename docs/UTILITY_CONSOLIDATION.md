# Utility Consolidation — Issue #1150

## Summary

Inventoried `src/utils/` (repo root) against `packages/shared/src/` and resolved the ambiguity
about which location is canonical.

---

## Inventory

### `src/utils/` (repo root)

| File | Exports | Import count (non-test) | Status |
|------|---------|-------------------------|--------|
| `errors.ts` | `AppError`, `ErrorCode`, `ErrorResponse`, `formatErrorMessage`, `formatErrorResponse`, `errorHandler`, `validateErrorMessage`, `createValidationError`, `createNotFoundError`, `createAuthError`, `createPermissionError`, `createDatabaseError`, `createRateLimitError` | 0 (test-only) | **Moved** → `packages/shared/src/errors.ts` |

`src/utils/errors.ts` now contains only a `@deprecated` re-export shim pointing at the canonical location.
This directory can be deleted entirely once no files import from it.

### `packages/shared/src/`

| File | Exports | Consumers |
|------|---------|-----------|
| `logger.ts` | `StructuredLogger`, `LogLevel` | `indexer/src/utils/logger.ts` (thin wrapper) |
| `format.ts` | `formatDate`, `formatDateTime`, `formatTokenAmount`, `formatAddress` | Available for all TS workspaces |
| `validation.ts` | `isValidEthereumAddress`, `isValidStellarAddress`, `isValidWasteType`, `clampNumber`, `parsePositiveInt` | Available for all TS workspaces |
| `config.ts` | `AppConfig`, `loadConfig`, `validateContractConfig` | Frontend-oriented (uses `import.meta.env`) |
| `errors.ts` (**new**) | All error utilities from old `src/utils/errors.ts` | `__tests__/utils/errors.test.ts` |
| `index.ts` | Re-exports all of the above | Single entrypoint for `@scavngr/shared` |

---

## Changes Made

1. **Created** `packages/shared/src/errors.ts` — canonical location for all error utilities.
2. **Updated** `packages/shared/src/index.ts` — added exports for all `errors.ts` symbols.
3. **Replaced** `src/utils/errors.ts` with a `@deprecated` re-export shim (backwards compatibility).
4. **Updated** `__tests__/utils/errors.test.ts` — imports now point to `packages/shared/src/errors`.

---

## Distinction: `packages/shared` vs `src/utils`

| Location | Purpose |
|----------|---------|
| `packages/shared/src/` | **Canonical shared utilities** for any JS/TS workspace (frontend, indexer, mobile, tests). Import via `@scavngr/shared` or direct path during development. |
| `src/utils/` | **Deprecated / to be deleted.** Contains only the re-export shim for `errors.ts`. Should be removed in the next cleanup PR once zero files import from it. |

No utility logic should ever be added to `src/utils/` going forward — place it in `packages/shared/src/` instead.

---

## No Actual Duplicates Found

After a full cross-workspace scan (`grep -rn`), there are **no identical or near-identical utility
functions** duplicated between the two locations. The inventory confirms:

- `src/utils/errors.ts` — error handling (unique, not duplicated in shared)
- `packages/shared/src/logger.ts` — structured logging (no duplicate elsewhere)
- `packages/shared/src/format.ts` — token/address/date formatting (no duplicate elsewhere)
- `packages/shared/src/validation.ts` — address and type validators (no duplicate elsewhere)
- `packages/shared/src/config.ts` — contract config loader (no duplicate elsewhere)

The confusion arose because `src/utils/` was a stray root-level directory; it belonged in `packages/shared/` and has now been moved.
