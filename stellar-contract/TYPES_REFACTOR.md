# Types Refactor: Per-Domain Grouping

## What was implemented

`stellar-contract/src/types.rs` had grown to ~3000 lines covering every
contract domain (waste, participants, incentives/rewards, transfers,
disputes, etc.) in a single flat file, making it hard to locate and review
domain-relevant types.

This change introduces `stellar-contract/src/types_domains/`, a new module
with one file per domain:

- `types_domains/waste.rs` — waste, transfer, and batch-related types
  (`Waste`, `WasteType`, `WasteTransfer`, `TransferRecord`,
  `TransferApproval`, `WasteBatch`, `WasteGrade`, etc.)
- `types_domains/participant.rs` — participant-related types
  (`ParticipantRole`, `ParticipantTier`, `ReputationBadge`,
  `QualityScore`, `LocationRecord`, `PermissionType`, etc.)
- `types_domains/rewards.rs` — incentive/reward-related types
  (`Incentive`, `IncentiveTier`, `Auction`, `CarbonListing`,
  `Challenge`, `LeaderboardEntry`, `Dispute`, etc.)

Each domain file `pub use`s the relevant types out of the existing
`crate::types` module rather than moving the definitions physically. This
preserves:

- The original type paths (`crate::types::Waste` etc. keep working) so no
  external or internal call sites need to change.
- The exact serialized layout, since the underlying struct/enum
  definitions and their `#[contracttype]`/derive attributes are untouched.

`types_domains` is declared as `pub mod types_domains;` in `lib.rs`
alongside the existing `mod types;`, so both the original flat surface and
the new grouped surface (`crate::types_domains::waste::Waste`, etc.) are
available.

## Follow-up (not done in this change)

A deeper refactor that physically moves each struct/enum's definition into
its domain file (leaving `types.rs` as a thin re-export shim in the other
direction) is a larger, higher-risk change and is recommended as a
follow-up PR once the current grouping has been reviewed. That follow-up
should:

1. Move definitions (not just re-exports) into `types/waste.rs`,
   `types/participant.rs`, `types/rewards.rs`.
2. Turn `types.rs` into `pub use types_domains::{waste::*, participant::*,
   rewards::*};` for backward compatibility.
3. Sweep internal imports across the crate to import from the new domain
   modules directly where it improves readability.

## Acceptance criteria status

- [x] No breaking changes to serialized type layout (definitions unmoved)
- [x] Existing type paths preserved via re-exports
- [ ] Full physical split of definitions (tracked as follow-up above)
