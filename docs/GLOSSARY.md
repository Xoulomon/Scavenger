# Scavngr Glossary and Terminology Guide

## Overview

This glossary defines **all** technical and domain-specific terms used in the Scavngr project.
Terms are organised alphabetically with cross-references to related documentation and source code.

> **How to read this document**
> Entries marked with ⛓ are blockchain/Soroban-specific.
> Entries marked with ♻ are waste-management domain terms.
> Entries marked with 💰 relate to the incentive/reward system.
> Entries marked with 👤 describe participant roles and responsibilities.

---

## A

**Admin** 👤
The contract administrator with elevated privileges. Admins may initialise the contract, manage
system settings, set reward percentages, configure expiry TTLs, manage incentives, run cleanup
jobs, and perform emergency operations. The admin address list is stored on-chain and can be
extended by calling `add_admin`. See: [Participant Quick Reference](./PARTICIPANT_QUICK_REFERENCE.md#admin-operations)

**Acceptance Criteria**
Specific, testable conditions that must be satisfied for a feature or task to be considered
complete. Used in issue tracking and pull-request reviews.

**Auction** ⛓
A time-limited bidding mechanism for waste items. Collectors and manufacturers can place bids
on listed waste; the auction ends at a configured `end_time`. Bids must exceed the current bid
by at least 5 %. See: `Auction` struct in `stellar-contract/src/types.rs`.

---

## B

**Batch Operations**
Processing multiple items (waste, materials, transfers) in a single contract invocation to reduce
transaction fees and ledger storage overhead. See: `batch_transfer_waste` in the contract.

**Beginner** 👤
The lowest `CertificationLevel` (0–10 wastes processed). Earns a 1.0× reward multiplier.
See: [Certification Levels](#certification-level).

**Blockchain** ⛓
The Stellar network's distributed ledger on which the Scavngr smart contract is deployed.
Each transaction is recorded immutably and visible to all participants.

**Budget** 💰
The maximum number of reward tokens allocated to an incentive. Once `remaining_budget` reaches
zero the incentive auto-deactivates. See: [Incentive Terminology](#incentive).

---

## C

**Carbon Credits** ♻ 💰
Computed metric (in grams of CO₂ equivalent) awarded per gram of waste recycled.
Formula: `credits = weight_grams × carbon_credit_rate_milli / 1000`.
Rates by type (gCO₂e/g): Paper 1.8, Plastic/PetPlastic 2.5, Metal 3.2, Glass 0.8, Organic 0.5,
Electronic 4.0.
See: `calculate_carbon_credits` in `types.rs`.

**Certification Level** 👤
A four-tier achievement badge assigned to participants based on their lifetime waste submission
count. Affects reward multipliers:

| Level        | Waste Count | Multiplier |
|--------------|-------------|------------|
| Beginner     | 0–10        | 1.0×       |
| Intermediate | 11–50       | 1.1×       |
| Advanced     | 51–200      | 1.25×      |
| Expert       | 201+        | 1.5×       |

**Charity Contract** ⛓
A Stellar account or smart contract designated by the admin to receive platform donations.
Participants can donate earned tokens to the charity address. See: `set_charity_contract`.

**Challenge** 💰
A time-limited recycling target (weight + waste type) created by an admin, with a bonus reward
for participants who reach the `target_weight` within the `start_time`–`end_time` window.
See: `Challenge` / `ChallengeProgress` types.

**Cleanup Job** ⛓
The `cleanup_expired_wastes` admin function that iterates all active waste items, deactivates
expired ones, and emits a `WasteExpired` event per item. Should be called periodically
(e.g. via off-chain scheduler). See: [Expiration System](./WASTE_STORAGE_IMPLEMENTATION.md).

**Collector** 👤
A participant role that collects waste from Recyclers and transports it to Manufacturers.
Collectors may:
- Transfer waste they own
- Confirm waste submitted by Recyclers
- Grade waste quality (A–D)
- Create collection routes

Valid transfer routes: Recycler → Collector, Collector → Manufacturer.
See: [Participant Roles](./PARTICIPANT_QUICK_REFERENCE.md#roles)

**Confirmation** ♻
The on-chain verification step in which a second participant (not the waste owner) certifies
that a waste item's details are correct. Confirmed waste is eligible for incentive reward claims.
See: `confirm_waste_details`.

**Contract** ⛓
The Scavngr Soroban smart contract, written in Rust and deployed as a WASM binary on the
Stellar blockchain. Entry point: `stellar-contract/src/lib.rs`.

**Contamination** ♻
The presence of non-recyclable or hazardous material mixed with otherwise recyclable waste.
Tracked via `is_contaminated`, `contamination_level` (0–100), and `contamination_reason` on
the `Waste` struct.

---

## D

**Deactivation** ♻
Permanently marking a waste item as inactive (`is_active = false`), preventing further
transfers, confirmations, or grading. Triggered manually by the owner/admin or automatically
by `cleanup_expired_wastes`.

**Deregistration** 👤
Removing a participant from the platform via `deregister_participant`. Deregistered participants
cannot submit or transfer waste.

**Document Hash** ⛓
An IPFS CID (content identifier) for a supporting document (e.g. certificate of recycling).
Up to 5 document hashes may be attached to a single waste item.

---

## E

**E2E Testing**
End-to-End testing that validates complete user workflows from the frontend through the Stellar
blockchain. See: [E2E Testing Suite](./E2E_TESTING.md)

**Electronic Waste** ♻
Waste type `Electronic` (discriminant 6). Includes computers, mobile phones, batteries, and
other consumer electronics. Earns the highest carbon credit rate (4.0 gCO₂e/g) and requires
a minimum quality grade of **B** due to safety and data-destruction requirements.

**Event** ⛓
A Soroban contract event emitted to the ledger log when an important state change occurs.
Key events include:
`WasteRegistered`, `WasteTransferred`, `WasteExpired`, `WasteGraded`,
`IncentiveCreated`, `ParticipantRegistered`, `ChallengeCompleted`.

**Expiration** ♻
The mechanism by which waste items become invalid after a configurable time-to-live (TTL).
Each waste type has an independent TTL set via `set_waste_ttl`; newly registered waste items
store their deadline in `expires_at`. Expired waste cannot be transferred.
See: [Waste Expiration System](./WASTE_STORAGE_IMPLEMENTATION.md).

**Expert** 👤
The highest `CertificationLevel` (201+ wastes processed). Earns a 1.5× reward multiplier.

**expires_at** ⛓ ♻
A Unix timestamp field on the `Waste` struct indicating when the item expires. A value of `0`
means no expiry. Computed as `ledger_timestamp + waste_type_ttl` at the time of registration.

---

## F

**Fixture**
Pre-configured test data used in automated tests to ensure consistent, reproducible conditions.

---

## G

**Gas** ⛓
The computational and storage cost of executing operations on the Stellar blockchain.
Measured in **stroops** (1 XLM = 10,000,000 stroops).

**Glass** ♻
Waste type `Glass` (discriminant 4). Includes bottles, jars, and glass containers. Infinitely
recyclable. Carbon credit rate: 0.8 gCO₂e/g. Minimum acceptable grade: **C**.

**Global Metrics** ⛓
On-chain counters tracking system-wide totals: `total_wastes_count`, `total_tokens_earned`,
and `total_carbon_credits`. Updated on every waste submission and reward claim.

**Grade** ♻ 💰
A quality classification (A, B, C, D) assigned to a waste item by a Collector or Manufacturer.
The grade influences the reward multiplier applied to the base incentive:

| Grade | Multiplier | Meaning          |
|-------|------------|------------------|
| A     | 1.5×       | Excellent quality |
| B     | 1.2×       | Good quality      |
| C     | 1.0×       | Average quality   |
| D     | 0.7×       | Poor quality      |

Default grade for newly submitted waste: **C**.
See: `WasteGrade` enum and `set_waste_grade` in the contract.

**Grade History** ⛓
An immutable audit log of all grading events for a waste item, stored as `Vec<GradeRecord>`.
Retrievable via `get_grade_history(waste_id)`. Each record contains: `waste_id`, `grade`,
`grader` address, and `graded_at` timestamp.

**Grading Rules** ♻
Per-waste-type minimum quality thresholds that define the lowest acceptable grade for recycling:

| Waste Type  | Min Grade | Reason |
|-------------|-----------|--------|
| Electronic  | B         | Safety, WEEE compliance |
| Metal       | C         | Contamination tolerance |
| Glass       | C         | Contaminant-free required |
| PetPlastic  | C         | Food-contact reuse standard |
| Paper       | D         | Broad recyclability |
| Plastic     | D         | General plastic stream |
| Organic     | D         | Composting accepts poor condition |

See: `WasteType::min_acceptable_grade()` in `types.rs`.

---

## H

**Handoff** ♻
The transfer of a waste item from one participant to another in the supply chain, moving
ownership on-chain and updating the transfer history.

---

## I

**Image Hash** ⛓
An IPFS CID (starting with `"Qm"` or `"bafy"`) for the primary photo of a waste item.
Stored in the `image_hash` field of the `Waste` struct.

**Incentive** 💰
A reward programme created by a Manufacturer to encourage specific types of waste collection.
Key fields:

| Field            | Description |
|------------------|-------------|
| `id`             | Unique identifier |
| `rewarder`       | Manufacturer's address |
| `waste_type`     | Target waste type |
| `reward_points`  | Tokens per kilogram (flat rate) |
| `total_budget`   | Tokens allocated on creation |
| `remaining_budget` | Tokens still available |
| `active`         | Whether the incentive is live |
| `starts_at`      | Optional activation timestamp |
| `ends_at`        | Optional expiry timestamp |
| `tiers`          | Optional `Vec<IncentiveTier>` |

See: [Incentive Quick Reference](./INCENTIVE_QUICK_REFERENCE.md)

**Incentive Tier** 💰
A weight-banded reward rate within an incentive. Each tier specifies:
- `min_weight_kg` — lower bound (inclusive)
- `max_weight_kg` — upper bound (exclusive); 0 = unbounded
- `reward_points` — tokens per kg in this band

Tiers override the flat `reward_points` when set.

**Intermediate** 👤
The second `CertificationLevel` (11–50 wastes processed). Earns a 1.1× reward multiplier.

---

## L

**Latitude / Longitude** ⛓
Geographic coordinates stored as scaled integers (× 10⁶) to avoid floating-point arithmetic.
Valid ranges: latitude −90,000,000 to +90,000,000; longitude −180,000,000 to +180,000,000.

**Leaderboard** 💰
A ranked list of participants by total recycling score, surfaced via `get_leaderboard`.
Each `LeaderboardEntry` contains `participant`, `score`, and `rank`.

**Ledger** ⛓
A "block" on the Stellar blockchain. Each ledger is assigned a sequence number and a Unix
timestamp (`ledger().timestamp()`), which the contract uses for TTL expiry and event ordering.

---

## M

**Manufacturer** 👤
A participant role that sources recycled materials and creates incentives. Manufacturers may:
- Create, update, and deactivate incentives
- Receive transferred waste from Collectors or Recyclers
- Grade incoming waste quality
- Claim waste via the auction system

Valid transfer routes: Recycler → Manufacturer, Collector → Manufacturer.
See: [Participant Roles](./PARTICIPANT_QUICK_REFERENCE.md#roles)

**Material** ♻
A recyclable submission tracked via the `Material` struct (v1 storage). Superseded by the
`Waste` struct (v2 storage), but retained for backward compatibility. Fields: `id`, `waste_type`,
`weight`, `submitter`, `submitted_at`, `verified`, `description`.

**Metal** ♻
Waste type `Metal` (discriminant 3). Includes aluminium, steel, and copper. Infinitely
recyclable. Carbon credit rate: 3.2 gCO₂e/g. Minimum acceptable grade: **C**.

**Migration** ⛓
The process of upgrading the contract to a new WASM binary while preserving on-chain state.
See: [Migration Guide](./MIGRATION_GUIDE.md)

**Milestone** 💰
A platform-level recycling threshold with an attached bonus reward percentage. When a
participant's total weight crosses a milestone `threshold`, they receive a bonus calculated as
`bonus_pct` of their `total_tokens_earned`. See: `Milestone` struct.

---

## O

**Organic** ♻
Waste type `Organic` (discriminant 5). Includes food scraps and yard waste. Biodegradable.
Carbon credit rate: 0.5 gCO₂e/g. Minimum acceptable grade: **D**.

**Ownership** ♻
The `current_owner` field of a `Waste` item, representing the participant who currently holds
it. Ownership changes with every accepted transfer.

---

## P

**Paper** ♻
Waste type `Paper` (discriminant 0). Includes newspapers, cardboard, and office paper.
Biodegradable. Carbon credit rate: 1.8 gCO₂e/g. Minimum acceptable grade: **D**.

**Participant** 👤
Any registered entity (individual or organisation) on the platform. Fields include: `address`,
`role`, `name`, `latitude`, `longitude`, `is_registered`, `total_waste_processed`,
`total_tokens_earned`, `reputation_score`, `certification`, `registered_at`, `last_active_at`.

**Participant Role** 👤
One of three on-chain roles that determines what operations a participant may perform:

| Role         | Key Responsibilities |
|--------------|----------------------|
| Recycler     | Submit waste, transfer to Collector or Manufacturer |
| Collector    | Collect from Recyclers, grade waste, deliver to Manufacturer |
| Manufacturer | Create incentives, receive waste, grade incoming materials |

**Pending Transfer** ⛓
A two-step transfer approval record (`PendingTransfer`) that must be accepted or rejected by
the recipient within 24 hours (`TRANSFER_EXPIRY_SECS`). Status values: `Pending`, `Approved`,
`Rejected`, `Expired`.

**PetPlastic** ♻
Waste type `PetPlastic` (discriminant 1). Polyethylene terephthalate — bottles and food
containers. Carbon credit rate: 2.5 gCO₂e/g. Minimum acceptable grade: **C**.

**Plastic** ♻
Waste type `Plastic` (discriminant 2). General mixed plastics. Carbon credit rate: 2.5 gCO₂e/g.
Minimum acceptable grade: **D**.

**Processing Status** ♻
A forward-only lifecycle stage for waste items:
`Collected → Sorted → Processed → Recycled → Manufactured`.
Each transition is recorded in `processing_history` as a `ProcessingRecord`.

---

## R

**Recycler** 👤
The entry-level participant role responsible for submitting recyclable materials. Recyclers may:
- Register and submit waste items
- Transfer waste to Collectors or Manufacturers
- Earn reward tokens via incentives

Cannot grade waste or create incentives.
See: [Participant Roles](./PARTICIPANT_QUICK_REFERENCE.md#roles)

**Registration** 👤
The on-chain act of adding a new participant via `register_participant`, providing: address,
role, name, latitude, and longitude.

**Remaining Budget** 💰
The `remaining_budget` field of an `Incentive`; decremented each time a reward is claimed.
When it reaches zero, the incentive auto-deactivates.

**Reputation Score** 👤
An on-chain integer score on the `Participant` struct that increases with positive actions
(transfers: +5 pts, confirmations: +3 pts, verifications: +10 pts).

**Reservation** ♻ ⛓
A time-limited "hold" on a waste item, preventing other participants from transferring it.
Stored in `reserved_by` and `reserved_until` on the `Waste` struct.

**Reward Points** 💰
The token amount distributed per kilogram of waste through an incentive. May be a flat rate
(`reward_points`) or a tiered rate from `IncentiveTier`.

**Rollback** ⛓
Reverting to a previous contract WASM version by re-deploying an older binary and (if needed)
restoring state from a backup. See: [Migration Guide](./MIGRATION_GUIDE.md#rollback-procedures)

---

## S

**Seasonal Multiplier** 💰
A time-bounded boost to all rewards, stored as a `SeasonalMultiplier` with `multiplier`
(basis points), `start`, and `end` timestamps. Max 5× (500 bp). Set by admin.

**Soroban** ⛓
Stellar's smart contract execution environment. Contracts are written in Rust, compiled to
WebAssembly (WASM), and run inside the Soroban host. See: https://soroban.stellar.org

**Statistics** 👤
Per-participant recycling metrics tracked in `RecyclingStats`: submissions, verified count,
weight, carbon credits, reward points, per-type counts, and grade counts.

**Storage** ⛓
On-chain data persistence via Soroban's instance storage. Keys are tuples or `Symbol` values.
See: [Storage Implementation](./PARTICIPANTS_STORAGE_IMPLEMENTATION.md)

**Stroops** ⛓
The smallest unit of XLM. 1 XLM = 10,000,000 stroops. Used for transaction fees.

**Supply Chain** ♻
The complete physical and on-chain flow of waste materials:
**Recycler** → (collects) → **Collector** → (delivers) → **Manufacturer**.

---

## T

**Tracking Code** ⛓ ♻
A human-readable QR-code identifier auto-generated for each waste item on submission.
Format: `WS-{waste_id:09}-{checksum:04}`. Stored in `tracking_code` on the `Waste` struct.

**Token Address** ⛓ 💰
The Stellar asset contract address for the reward token. Configured via `set_token_address`.
Used when distributing token rewards through `reward_tokens`.

**Transfer** ♻ ⛓
Moving ownership of a waste item from one participant to another. Recorded as a `WasteTransfer`
in transfer history. Subject to route validation (Recycler→Collector, Recycler→Manufacturer,
Collector→Manufacturer). Blocked if waste is expired, deactivated, or reserved by a third party.

**Transfer History** ⛓
A complete, immutable audit trail of all ownership transfers for a waste item.
Stored per waste ID under the `("transfer_history", waste_id)` key.

**TTL (Time To Live)** ⛓ ♻
The number of seconds after submission at which a waste item is considered expired.
Configured per waste type via `set_waste_ttl`; 0 means no expiry.
See: [Expiration System](#expiration).

---

## V

**Verification** ♻
The process of marking a `Material` (v1) as verified by a trusted participant. Verified
materials are eligible for incentive reward claims. Tracked by the `verified` flag.

**Version Compatibility Matrix** ⛓
A table showing which contract versions are upgrade-compatible and whether data migration is
required. See: [Migration Guide](./MIGRATION_GUIDE.md#version-compatibility-matrix)

---

## W

**WASM** ⛓
WebAssembly. The binary format used to deploy Soroban smart contracts. The Scavngr contract
is compiled with `cargo build --target wasm32-unknown-unknown --release` and optimised with
`soroban contract optimize`.

**Waste** ♻ ⛓
The primary on-chain entity representing a recyclable material item. Key fields:

| Field               | Type    | Description |
|---------------------|---------|-------------|
| `waste_id`          | u128    | Unique identifier |
| `waste_type`        | enum    | Category (Paper, Plastic, …) |
| `weight`            | u128    | Mass in grams |
| `current_owner`     | Address | Current holder |
| `latitude`          | i128    | Location (× 10⁶) |
| `longitude`         | i128    | Location (× 10⁶) |
| `is_active`         | bool    | Active in system |
| `is_confirmed`      | bool    | Confirmed by verifier |
| `grade`             | enum    | Quality grade (A–D) |
| `expires_at`        | u64     | Expiry timestamp (0 = none) |
| `processing_status` | enum    | Lifecycle stage |
| `tracking_code`     | String  | QR code identifier |

**Waste Grade** ♻ 💰
See [Grade](#grade).

**Waste Types and Categories** ♻
The seven categories of recyclable material tracked by the platform:

| Discriminant | Name        | Description | Carbon Rate (gCO₂e/g) | Min Grade |
|:------------:|-------------|-------------|:---------------------:|:---------:|
| 0            | Paper       | Newspapers, cardboard, office paper | 1.8 | D |
| 1            | PetPlastic  | PET bottles and food containers | 2.5 | C |
| 2            | Plastic     | General mixed plastics | 2.5 | D |
| 3            | Metal       | Aluminium, steel, copper | 3.2 | C |
| 4            | Glass       | Bottles, jars, containers | 0.8 | C |
| 5            | Organic     | Food scraps, yard waste | 0.5 | D |
| 6            | Electronic  | Computers, phones, batteries | 4.0 | B |

**WasteGrade** ⛓ ♻
The `WasteGrade` enum with variants `A`, `B`, `C`, `D`. See [Grade](#grade).

**WasteTransfer** ⛓
The `WasteTransfer` struct recorded when ownership of waste changes hands. Fields: `waste_id`,
`from`, `to`, `transferred_at`, `latitude`, `longitude`, `note`.

**WasteType** ⛓ ♻
The `WasteType` enum with seven variants. See [Waste Types](#waste-types-and-categories).

---

## X

**XLM** ⛓
Stellar Lumens — Stellar's native cryptocurrency used for transaction fees and network
operations. Abbreviated from the ISO currency code XLM.

---

## Acronyms and Abbreviations

| Acronym | Full Form | Definition |
|---------|-----------|-----------|
| AML     | Anti-Money Laundering | Compliance check (future) |
| API     | Application Programming Interface | Contract interaction surface |
| bp      | Basis Points | 1/100th of a percent (e.g. 150 bp = 1.5×) |
| CID     | Content Identifier | IPFS hash identifying a file |
| CLI     | Command Line Interface | Terminal tool for contract deployment |
| CO₂e   | CO₂ equivalent | Standard unit of carbon footprint |
| DAO     | Decentralised Autonomous Organisation | Governance (future) |
| E2E     | End-to-End | Testing methodology covering full workflows |
| IPFS    | InterPlanetary File System | Decentralised file storage for hashes |
| KYC     | Know Your Customer | Identity verification (future) |
| NFT     | Non-Fungible Token | Unique digital asset (future) |
| PET     | Polyethylene Terephthalate | Plastic type used in PetPlastic category |
| RPC     | Remote Procedure Call | Protocol for invoking contract functions |
| TTL     | Time To Live | Maximum age of a waste item before expiry |
| WASM    | WebAssembly | Binary format for smart contracts |
| WEEE    | Waste Electrical & Electronic Equipment | EU directive for e-waste |
| XLM     | Stellar Lumens | Stellar's native cryptocurrency |

---

## Cross-References

### By Topic

**Participant Management**
- [Participant Quick Reference](./PARTICIPANT_QUICK_REFERENCE.md)
- [Participant Implementation](./PARTICIPANT_IMPLEMENTATION.md)
- [Participant Serialization](./PARTICIPANT_SERIALIZATION.md)

**Waste Management**
- [Waste Storage Quick Reference](./WASTE_STORAGE_QUICK_REFERENCE.md)
- [Waste Storage Implementation](./WASTE_STORAGE_IMPLEMENTATION.md)
- [Transfer Record Implementation](./TRANSFER_RECORD_IMPLEMENTATION.md)

**Incentive Management**
- [Incentive Quick Reference](./INCENTIVE_QUICK_REFERENCE.md)
- [Incentive Implementation](./INCENTIVE_IMPLEMENTATION.md)

**Grading System**
- `stellar-contract/src/types.rs` — `WasteGrade`, `GradeRecord`, `WasteType::min_acceptable_grade`
- `stellar-contract/src/test_grading.rs` — Grading unit tests

**Expiration System**
- `stellar-contract/src/lib.rs` — `set_waste_ttl`, `get_waste_ttl`, `get_expired_wastes`, `cleanup_expired_wastes`
- `stellar-contract/src/test_expiration.rs` — Expiration unit tests

**Testing & Quality**
- [E2E Testing Suite](./E2E_TESTING.md)
- [Test Coverage Report](./TEST_COVERAGE_REPORT.md)

**Deployment & Operations**
- [Migration Guide](./MIGRATION_GUIDE.md)
- [Kubernetes Deployment](./KUBERNETES_DEPLOYMENT.md)
- [CI/CD Pipeline](./CI_CD_PIPELINE.md)

---

## Related Documentation

- [Contract API](./API_DOCUMENTATION.md) — Complete API reference
- [Architecture](./ARCHITECTURE.md) — System design overview
- [README](../README.md) — Project overview
- [Contributing Guide](../CONTRIBUTING.md) — Development guidelines

---

## Maintenance Notes

- This glossary is updated with every feature release.
- When adding a new contract function, enum variant, or struct field, update the relevant entry
  or add a new one following the formatting conventions above.
- Terms link to implementation files and documentation for traceability.
- Acronyms follow industry standards where applicable.
