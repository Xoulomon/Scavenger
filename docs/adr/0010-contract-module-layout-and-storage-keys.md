# ADR 0010: Contract Module Layout and Storage Keys

## Status

Accepted

## Context

The Scavenger contract (`contracts/scavenger/stellar-contract`) has grown from a small single-purpose contract into a multi-feature system covering waste registration, participant management, incentives, verification, auditing, analytics, and upgrade/versioning concerns. As the feature set expanded, two structural questions repeatedly came up during review:

1. **How should the Rust source be organized into modules?** A single large `lib.rs` versus a set of focused modules.
2. **How should storage keys be laid out?** A flat set of keys versus namespaced keys, and which Soroban key types (instance `Symbol` vs persistent tuple keys) to use for which data.

Both decisions have long-lived consequences. Module boundaries are internal and can be refactored freely, but storage keys are part of the contract's on-chain state: once data is written under a key, that key's shape and storage tier are effectively frozen for any deployed instance. This ADR records the rationale for the current layout so future contributors understand the constraints and the alternatives that were rejected.

This ADR focuses on **module layout**. The detailed rationale for the storage key _encoding_ (Symbol vs tuple, length limits, tiering) is recorded in **ADR 0004 (Storage Key Layout)**; this document references it and does not duplicate it.

## Decision

### Module layout

`stellar-contract/src/lib.rs` acts as the crate root and public entry point. It declares and re-exports a set of focused modules, each owning a single concern:

| Module                | Responsibility                                                          |
| --------------------- | ----------------------------------------------------------------------- |
| `analytics`           | Aggregate metrics and reporting queries over contract data              |
| `audit_log`           | Append-only record of privileged/administrative actions                 |
| `errors`              | Contract error enum and error-code conventions                          |
| `events`              | Event emission helpers and event schema                                 |
| `storage_optimizer`   | Helpers for packing/compacting stored data and reducing read/write cost |
| `storage_utils`       | Low-level storage read/write helpers shared across modules              |
| `types`               | Core domain types (waste, participant, incentive records, etc.)         |
| `types_domains`       | Domain-specific type extensions and validation-adjacent types           |
| `upgrade`             | Contract upgrade / migration entry points                               |
| `validation`          | Input and state validation rules                                        |
| `verification`        | Verification workflow (who may verify what, and when)                   |
| `versioning`          | Contract version constants and compatibility checks                     |
| `incentive`           | Incentive calculation and distribution logic                            |
| `participant`         | Participant registration and lifecycle logic                            |
| `waste`               | Waste registration and lifecycle logic                                  |
| `participant_storage` | Persistence layer specific to participant records                       |

The guiding principles are:

- **One concern per module.** Each module has a single reason to change. Cross-cutting helpers (`storage_utils`, `storage_optimizer`) are isolated so they can be optimized without touching domain logic.
- **Domain logic separated from persistence.** `waste`/`participant`/`incentive` hold business rules; `participant_storage` (and the shared storage helpers) hold persistence details. This keeps domain modules testable without a full storage harness.
- **`lib.rs` is a thin façade.** It wires modules together and exposes the public contract interface; it does not contain business logic. This keeps the public surface easy to audit.
- **Types are centralized.** `types` and `types_domains` are the single source of truth for data shapes, so storage and logic modules agree on representations.

### Storage key namespaces

Storage keys live in `stellar-contract/src/storage_keys.rs`. The layout follows these rules (see ADR 0004 for the encoding details):

- **Instance storage uses short `Symbol` keys (≤ 9 characters).** Instance storage holds small, frequently accessed configuration and counters. `Symbol` keys are compact and cheap, but Soroban limits `Symbol` length, so instance keys are kept short (e.g. config flags, global counters).
- **Persistent storage uses string-tuple keys** of the form `("waste", id)`, `("participant", id)`, etc. Tuple keys give a natural namespace prefix plus an identifier, keep related records contiguous in key ordering, and avoid the `Symbol` length limit for the namespace portion.
- **Counter keys** are dedicated keys (e.g. next-id counters) kept separate from record keys so increments are isolated writes and do not collide with record namespaces.
- **Module-specific keys** are prefixed by the owning domain (`"waste"`, `"participant"`, `"incentive"`, `"audit"`, ...) so that a module's data can be reasoned about, migrated, or garbage-collected as a unit.

The namespace prefix is the contract between a module and its stored data. A module owns its prefix; no two modules write under the same prefix.

## Alternatives Considered

### Single monolithic module vs. split modules

- **Monolithic `lib.rs`.** Simpler to navigate for very small contracts and avoids module boilerplate. Rejected because the contract now spans many concerns; a single file makes review, ownership, and testing harder, and encourages accidental coupling between domain logic and persistence.
- **Split modules (chosen).** Adds some indirection and requires discipline around visibility (`pub(crate)` vs `pub`), but yields clear ownership, isolated tests, and the ability to optimize storage helpers independently. The cost is acceptable given the contract's size.

### Flat keys vs. namespaced keys

- **Flat keys** (e.g. a single `Symbol` per record, or an unstructured tuple). Simple, but risks collisions as features are added, makes it hard to enumerate or migrate a domain's data, and does not scale past a handful of key kinds. Rejected.
- **Namespaced keys (chosen).** The `("namespace", id)` tuple form makes ownership explicit, prevents collisions, and supports prefix-based reasoning. Slightly more verbose at call sites, mitigated by centralizing key construction in `storage_keys.rs`.

### Per-domain storage vs. shared storage

- **Shared storage layer for everything.** Fewer helpers, but couples unrelated domains and makes it easy for one module to read/write another's data, undermining the module boundaries. Rejected for domain records.
- **Per-domain storage with shared low-level helpers (chosen).** Domain modules own their persistence (e.g. `participant_storage`), while `storage_utils`/`storage_optimizer` provide generic primitives. This preserves encapsulation without duplicating low-level code.

### `Symbol` keys vs. tuple keys

- **`Symbol` keys everywhere.** Compact and cheap, but `Symbol` length is limited, so keys cannot carry both a namespace and an identifier, and long namespaces are impossible. Rejected for record keys.
- **Tuple keys everywhere.** Uniform and expressive, but overkill for small instance-level configuration and counters, where short `Symbol` keys are cheaper and clearer. Rejected for instance config.
- **Hybrid (chosen):** short `Symbol` keys for instance storage (≤ 9 chars), string-tuple keys for persistent records. This matches each key type to the data's access pattern and size, at the cost of two conventions that contributors must learn (documented here and in ADR 0004).

## Consequences

**Positive**

- Clear module ownership makes the codebase easier to review, test, and extend; new features slot into an existing module or add a new one with an obvious home.
- Namespaced keys prevent collisions and make domain-scoped migrations and audits tractable.
- Separating domain logic from persistence improves testability and keeps storage optimizations localized.
- Centralizing key construction in `storage_keys.rs` gives a single place to audit key shapes.

**Negative / costs**

- More modules means more files and some boilerplate; contributors must respect visibility boundaries.
- Two key conventions (Symbol vs tuple) require documentation and review attention.
- The namespace prefix is an implicit contract; adding a module that reuses an existing prefix would silently collide, so prefix ownership must be enforced in review.

**Neutral**

- Module boundaries are internal and may be refactored without affecting callers, provided the public interface and storage keys are preserved.

## Backwards-compatibility impact

- **Storage keys are part of on-chain state.** Renaming a key, changing its namespace prefix, changing a `Symbol` key's spelling, or moving data between instance and persistent storage is a **breaking migration**. Existing deployed instances store data under the current keys; any such change requires an explicit migration path (see `upgrade`) and must be treated as a breaking change in release notes. The encoding rules themselves are governed by ADR 0004.
- **Module boundaries are internal.** Splitting, merging, or renaming modules, and moving code between them, does **not** affect callers as long as the public contract interface and the storage key layout are unchanged. Such refactors are non-breaking and do not require migration.
- **Adding new keys** under a new, unused namespace prefix is additive and non-breaking. **Reusing an existing prefix** for a different purpose is effectively a breaking change and must be avoided.

## References

- ADR 0004 — Storage Key Layout (encoding, length limits, and tiering rationale).
- `contracts/scavenger/stellar-contract/src/lib.rs` — module declarations and public interface.
- `contracts/scavenger/stellar-contract/src/storage_keys.rs` — storage key definitions and namespaces.
- Issue #1662 — request to record this rationale.
