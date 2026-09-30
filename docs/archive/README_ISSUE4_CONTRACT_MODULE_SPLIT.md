# Issue 4: Split `stellar-contract/src/lib.rs` into domain modules

## Context

`stellar-contract/src/lib.rs` is ~8,300 lines combining the contract entry
point, business logic for every domain (participants, waste, transfers,
incentives, admin/multisig), and internal helpers. This is a multi-day
effort (issue estimate: 3+ days); this change makes a first, safe,
verifiable cut at the boundary and documents the plan for the rest rather
than attempting the full split in one pass (which would risk silently
changing the public ABI across thousands of lines with no build/test pass
available in this change).

Notably, prior work (issues #759, #925, #1097, #1100) already created
domain module files under `stellar-contract/src/` — `admin.rs`,
`participant.rs`, `waste.rs`, `incentive.rs`, `transfer_mgmt.rs`,
`waste_mgmt.rs`, `incentive_mgmt.rs`, `participant_mgmt.rs`, etc. — but per
those modules' own doc comments, most are **unwired**: `lib.rs` keeps its
own inline, independently-maintained implementation of the same logic
rather than calling into the extracted module. `admin.rs` was the
exception: it already re-exported `AdminAction` / `AdminProposal` /
`RewardConfig` from `crate::*`, i.e. from types still physically defined in
`lib.rs`.

## What changed in this pass

- Moved the actual definitions of `AdminAction`, `AdminProposal`, and
  `RewardConfig` out of `lib.rs` and into `admin.rs` (the module already
  scoped to admin/multisig/reward-config concerns per its own doc comment).
- `lib.rs` now does `pub use crate::admin::{AdminAction, AdminProposal, RewardConfig};`
  instead of defining these types inline — the public path
  `crate::{AdminAction, AdminProposal, RewardConfig}` is preserved, so
  nothing that imports these types (including `admin.rs`'s own prior
  re-export direction) needs to change. No contract ABI change: these are
  plain `#[contracttype]` data types, not entry-point functions, and their
  shape (`#[derive(Clone, Debug, Eq, PartialEq)]`, field layout) is
  unchanged — only the file they're physically defined in moved.
- `lib.rs` shrank by ~33 lines as a direct result.

## Full module-boundary plan (follow-up work)

The logical boundaries identified for the remaining split, in the order
they should be tackled (lowest-risk first):

1. **Types-only extraction** (this pass's pattern, repeated): pull
   remaining plain data types out of `lib.rs` into their matching domain
   module (`Participant`, `ParticipantInfo` → `participant.rs`;
   waste-related response/record types → `waste.rs`; incentive/reward
   types → `incentive.rs`), each followed by a `pub use` re-export from
   `lib.rs`. Zero behavior change, verifiable by diffing type definitions.
2. **Wire the existing unwired modules**: for each of `participant.rs`,
   `waste.rs`, `incentive.rs`, and friends, do a function-by-function diff
   against the equivalent inline logic still in `lib.rs`'s
   `impl ScavengerContract` block, reconcile any behavioral drift found
   (each module's doc comment already flags where the two differ), and
   then replace the inline implementation with a call into the module.
   This is the highest-risk step and should be one PR per domain so a
   regression is bisectable.
3. **Thin `lib.rs`**: once every domain's logic lives in and is called
   from its module, `lib.rs` should contain only: the `#[contract] struct
   ScavengerContract;` declaration, the `#[contractimpl] impl
   ScavengerContract` block with thin `pub fn` wrappers that delegate to
   the domain modules (needed because Soroban contract entry points must
   be inherent methods on the contract type, not free functions), storage
   key constants, and top-level `mod`/`pub use` declarations.

## Verification

Not run in this change per task instructions (no build/test pass). The
extracted types were moved verbatim (copy-paste, no logic rewritten), and
the re-export preserves every existing import path, so this step carries
low risk relative to the function-wiring work described in the plan above,
which is why it was chosen as the first cut.
