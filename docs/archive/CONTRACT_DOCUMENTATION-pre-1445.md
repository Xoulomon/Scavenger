# Scavngr Smart Contract Documentation

> **Issue:** #753  
> **Contract:** `stellar-contract` (Soroban / Rust)  
> **Network:** Stellar (Testnet / Mainnet)

---

## Table of Contents

1. [Contract Overview](#contract-overview)
2. [Data Types](#data-types)
3. [Contract Functions](#contract-functions)
   - [Admin](#admin-functions)
   - [Participants](#participant-functions)
   - [Waste / Materials](#waste--material-functions)
   - [Incentives](#incentive-functions)
   - [Rewards](#reward-functions)
   - [Stats & Metrics](#stats--metrics-functions)
4. [Events](#events)
5. [Storage Layout](#storage-layout)
6. [Error Codes](#error-codes)
7. [Security Guide](#security-guide)
8. [Testing Guide](#testing-guide)
9. [Performance Guide](#performance-guide)
10. [Upgrade Procedures](#upgrade-procedures)

---

## Contract Overview

Scavngr is a decentralized recycling supply-chain contract deployed on the Stellar blockchain using **Soroban** smart contracts. It coordinates three participant roles in a transparent waste-processing pipeline:

```
Recycler ──► Collector ──► Manufacturer
    └─────────────────────────────────►┘
```

**Key capabilities:**
- On-chain participant registration with role-based access control
- Waste item lifecycle: submit → verify → transfer → confirm → reward
- Manufacturer-created incentives with configurable reward splits
- Token reward distribution via Stellar token interface
- Charity donation routing
- Batch operations for high-throughput submissions
- Carbon credit tracking
- Full event log for indexing

**Contract ID** (Testnet): see `soroban.toml`  
**Source:** `stellar-contract/src/lib.rs`

---

## Data Types

### `ParticipantRole`

```rust
pub enum ParticipantRole {
    Recycler     = 0,  // Submits recyclable waste
    Collector    = 1,  // Aggregates and transfers waste
    Manufacturer = 2,  // Creates incentives, receives waste
}
```

### `WasteType`

Plastic, Paper, Metal, Glass, Organic, Electronic, Textile, Rubber, Chemical, Construction, Medical, Mixed

### `WasteGrade`

```rust
pub enum WasteGrade { A = 0, B = 1, C = 2, D = 3 }
```

### `Waste` (v2 storage)

| Field | Type | Description |
|-------|------|-------------|
| `id` | `u128` | Unique waste identifier |
| `owner` | `Address` | Current owner |
| `waste_type` | `WasteType` | Material category |
| `weight` | `u128` | Weight in grams |
| `latitude` | `i128` | Location latitude (microdegrees) |
| `longitude` | `i128` | Location longitude (microdegrees) |
| `is_confirmed` | `bool` | Whether confirmed by a third party |
| `is_active` | `bool` | Whether the item is active |
| `confirmer` | `Option<Address>` | Address that confirmed |
| `timestamp` | `u64` | Creation ledger timestamp |

### `Participant`

| Field | Type | Description |
|-------|------|-------------|
| `address` | `Address` | Participant's address |
| `role` | `ParticipantRole` | Assigned role |
| `name` | `Symbol` | Display name |
| `latitude` | `i128` | Location latitude (microdegrees) |
| `longitude` | `i128` | Location longitude (microdegrees) |
| `is_registered` | `bool` | Registration status |
| `registered_at` | `u64` | Registration timestamp |

### `Incentive`

| Field | Type | Description |
|-------|------|-------------|
| `id` | `u64` | Unique identifier |
| `rewarder` | `Address` | Manufacturer who created it |
| `waste_type` | `WasteType` | Target waste type |
| `reward_points` | `u128` | Reward tokens per kg |
| `budget` | `u128` | Remaining token budget |
| `is_active` | `bool` | Active status |

### `GlobalMetrics`

| Field | Type | Description |
|-------|------|-------------|
| `total_wastes` | `u128` | All registered waste items |
| `total_tokens_distributed` | `u128` | All tokens ever distributed |
| `total_participants` | `u32` | Registered participant count |

---

## Contract Functions

### Admin Functions

#### `initialize_admin(admin: Address) → Result<(), Error>`

Initialise the contract admin. **Can only be called once.**

**Auth:** None (first-call only)  
**Errors:** `AlreadyInitialized (1)`

```bash
soroban contract invoke \
  --id $CONTRACT_ID --source $DEPLOYER --network testnet \
  -- initialize_admin --admin $ADMIN_ADDR
```

---

#### `transfer_admin(current_admin: Address, new_admin: Address) → Result<(), Error>`

Transfer admin rights to a new address.

**Auth:** `current_admin` must sign  
**Errors:** `Unauthorized (2)`

---

#### `set_charity_contract(admin: Address, charity_address: Address) → Result<(), Error>`

Configure the charity contract for donation routing.

**Auth:** `admin`  
**Errors:** `Unauthorized (2)`, `SameAddress (28)`

---

#### `set_token_address(admin: Address, token_address: Address) → Result<(), Error>`

Set the SEP-41 reward token contract.

**Auth:** `admin`  
**Errors:** `Unauthorized (2)`

---

#### `set_percentages(admin: Address, collector_pct: u32, owner_pct: u32) → Result<(), Error>`

Set reward split percentages. The sum of `collector_pct + owner_pct` must not exceed 100; the remainder goes to the recycler.

**Auth:** `admin`  
**Errors:** `Unauthorized (2)`, `InvalidPercentage (14)`

---

### Participant Functions

#### `register_participant(address: Address, role: ParticipantRole, name: Symbol, lat: i128, lon: i128) → Result<(), Error>`

Register a new participant on-chain.

| Parameter | Type | Constraints |
|-----------|------|-------------|
| `address` | `Address` | Must not already be registered |
| `role` | `ParticipantRole` | 0=Recycler, 1=Collector, 2=Manufacturer |
| `name` | `Symbol` | Non-empty |
| `lat` | `i128` | `[-90_000_000, +90_000_000]` |
| `lon` | `i128` | `[-180_000_000, +180_000_000]` |

**Auth:** `address` must sign  
**Errors:** `AlreadyRegistered (4)`, `InvalidCoordinates (13)`  
**Events:** `reg` (PARTICIPANT_REGISTERED)

```bash
soroban contract invoke \
  --id $CONTRACT_ID --source $USER_KEY --network testnet \
  -- register_participant \
  --address $USER_ADDR --role 0 --name alice \
  --lat 40714000 --lon -74006000
```

---

#### `get_participant(address: Address) → Option<Participant>`

Read-only fetch of a participant record.

---

#### `get_participant_info(address: Address) → Option<(Participant, RecyclingStats)>`

Returns participant data combined with accumulated recycling statistics.

---

#### `update_role(address: Address, new_role: ParticipantRole) → Result<(), Error>`

Update a participant's role (admin-only).

**Auth:** Contract admin  
**Errors:** `Unauthorized (2)`, `ParticipantNotFound (10)`

---

#### `deregister_participant(address: Address) → Result<(), Error>`

Remove a participant from the registry.

**Auth:** `address` must sign (or admin)  
**Errors:** `ParticipantNotFound (10)`

---

#### `is_participant_registered(address: Address) → bool`

Returns `true` if the address is a registered, active participant.

---

### Waste / Material Functions

#### `submit_material(submitter: Address, waste_type: WasteType, weight: u128, lat: i128, lon: i128) → Result<u128, Error>`

Register a new waste item. Returns the assigned `waste_id`.

**Auth:** `submitter` (must be registered)  
**Errors:** `NotRegistered (3)`, `InvalidWeight (12)`, `InvalidCoordinates (13)`  
**Events:** `recycled` (WASTE_REGISTERED)

---

#### `submit_materials_batch(submitter: Address, materials: Vec<MaterialInput>) → Result<Vec<u128>, Error>`

Batch-submit multiple materials in a single transaction. Returns list of waste IDs.

**Auth:** `submitter`

---

#### `verify_material(material_id: u128, verifier: Address) → Result<(), Error>`

Mark a material as verified by a second party.

**Auth:** `verifier` (must be registered, must not be the owner)

---

#### `transfer_waste(waste_id: u128, from: Address, to: Address, lat: i128, lon: i128, note: String) → Result<(), Error>`

Transfer waste ownership. Valid routes:

| From | To |
|------|----|
| Recycler | Collector |
| Recycler | Manufacturer |
| Collector | Manufacturer |

**Auth:** `from` must sign and be the current owner  
**Errors:** `WasteNotFound (7)`, `NotWasteOwner (6)`, `InvalidTransferRoute (27)`, `WasteDeactivated (18)`, `WasteExpired (44)`, `WasteReservedByOther (42)`  
**Events:** `transfer` (WASTE_TRANSFERRED)

---

#### `confirm_waste_details(waste_id: u128, confirmer: Address) → Result<(), Error>`

Confirm waste details (must be a third party, not the owner).

**Auth:** `confirmer`  
**Errors:** `SelfConfirmation (22)`, `WasteAlreadyConfirmed (20)`, `WasteDeactivated (18)`  
**Events:** `confirmed` (WASTE_CONFIRMED)

---

#### `reset_waste_confirmation(waste_id: u128, owner: Address) → Result<(), Error>`

Reset the confirmation status (owner only).

**Auth:** `owner`  
**Errors:** `WasteNotConfirmed (21)`, `NotWasteOwner (6)`

---

#### `deactivate_waste(admin: Address, waste_id: u128) → Result<(), Error>`

Permanently deactivate a waste item (admin only).

**Auth:** contract admin  
**Errors:** `WasteAlreadyDeactivated (19)`

---

#### `get_waste(waste_id: u128) → Option<Waste>`

Retrieve a waste record by ID.

---

#### `get_participant_wastes(participant: Address) → Vec<u128>`

List all waste IDs owned by a participant.

---

#### `get_waste_transfer_history(waste_id: u128) → Vec<TransferRecord>`

Full transfer history for a waste item, ordered chronologically.

---

### Incentive Functions

#### `create_incentive(rewarder: Address, waste_type: WasteType, reward_points: u128, budget: u128) → Result<u64, Error>`

Create a new incentive program. Returns `incentive_id`.

**Auth:** `rewarder` (must be Manufacturer)  
**Errors:** `NotManufacturer (5)`, `NotRegistered (3)`, `InvalidAmount (11)`

---

#### `update_incentive(incentive_id: u64, rewarder: Address, reward_points: u128, budget: u128) → Result<(), Error>`

Update an existing active incentive.

**Auth:** `rewarder` (must be the original creator)  
**Errors:** `IncentiveNotFound (9)`, `IncentiveInactive (23)`, `NotCreator (30)`

---

#### `deactivate_incentive(incentive_id: u64, rewarder: Address) → Result<(), Error>`

Deactivate an incentive program.

**Auth:** `rewarder` (creator only)  
**Errors:** `IncentiveNotFound (9)`, `NotCreator (30)`

---

#### `get_incentive_by_id(incentive_id: u64) → Option<Incentive>`

Retrieve an incentive by ID.

---

#### `get_incentives(waste_type: WasteType) → Vec<Incentive>`

Get all **active** incentives for a given waste type, sorted by `reward_points` descending.

---

#### `get_active_incentives() → Vec<Incentive>`

Get all active incentives across all waste types.

---

#### `get_active_mfr_incentive(manufacturer: Address, waste_type: WasteType) → Option<Incentive>`

Find the highest-reward active incentive offered by a specific manufacturer for a waste type.

---

### Reward Functions

#### `distribute_rewards(waste_id: u128, incentive_id: u64, manufacturer: Address) → Result<u128, Error>`

Distribute supply chain rewards for a confirmed waste item.

Reward split (defaults: collector=0%, owner=0%, remainder→recycler):
```
collector_reward = budget_used * collector_pct / 100
owner_reward     = budget_used * owner_pct / 100
recycler_reward  = budget_used - collector_reward - owner_reward
```

**Auth:** `manufacturer`  
**Errors:** `WasteNotFound (7)`, `IncentiveNotFound (9)`, `WasteTypeMismatch (25)`, `NoRewardAvailable (26)`, `InsufficientBudget (31)`  
**Events:** `rewarded` (TOKENS_REWARDED)

---

### Stats & Metrics Functions

#### `get_metrics() → GlobalMetrics`

Global platform statistics (total wastes, tokens distributed, participants).

---

#### `get_stats(participant: Address) → Option<RecyclingStats>`

Per-participant recycling statistics (submissions, verifications, tokens earned).

---

#### `get_supply_chain_stats() → SupplyChainStats`

Aggregate supply chain metrics across all transfers.

---

## Events

All events are emitted via `env.events().publish()` and can be indexed from the Stellar Horizon or Soroban RPC event stream.

| Symbol | Trigger | Topic | Data |
|--------|---------|-------|------|
| `recycled` | Waste registered | `(symbol, waste_id)` | `(waste_type, weight, recycler, lat, lon)` |
| `transfer` | Waste transferred | `(symbol, waste_id)` | `(from, to)` |
| `confirmed` | Waste confirmed | `(symbol, waste_id)` | `confirmer` |
| `reg` | Participant registered | `(symbol, address)` | `(role, name, lat, lon)` |
| `rewarded` | Tokens distributed | `(symbol, recipient)` | `(amount, waste_id)` |
| `donated` | Charity donation | `(symbol, donor)` | `(amount, charity)` |
| `deactive` | Waste deactivated | `(symbol, waste_id)` | `(admin, timestamp)` |
| `expired` | Waste expired | `(symbol, waste_id)` | `timestamp` |
| `paused` | Contract paused | `(symbol,)` | `admin` |
| `unpaused` | Contract unpaused | `(symbol,)` | `admin` |
| `graded` | Waste graded | `(symbol, waste_id)` | `(grade, grader)` |
| `carbon` | Carbon credits earned | `(symbol, participant)` | `(waste_type, weight, credits)` |
| `carb_rdm` | Carbon credits redeemed | `(symbol, participant)` | `(amount, remaining)` |
| `adm_xfr` | Admin transferred | `(symbol,)` | `previous_admin` |
| `upg_prop` | Upgrade proposed | `(symbol, proposal_id)` | `new_implementation` |
| `upg_exec` | Upgrade executed | `(symbol, proposal_id)` | `version` |
| `perm_gr` | Permission granted | `(symbol, subject)` | `(permission, granted_by)` |
| `reconcil` | Waste reconciled | `(symbol, waste_id)` | `(original, adjusted, by)` |

### Subscribing to Events (TypeScript)

```typescript
const server = new SorobanRpc.Server(RPC_URL);
const events = await server.getEvents({
  startLedger: fromLedger,
  filters: [{
    type: 'contract',
    contractIds: [CONTRACT_ID],
    topics: [['recycled']]  // filter by symbol
  }]
});
```

---

## Storage Layout

The contract uses three Soroban storage tiers:

| Tier | Key Pattern | Contents | TTL |
|------|-------------|----------|-----|
| **Persistent** | `Admin` | Admin address | Permanent |
| **Persistent** | `Participant(address)` | Participant record | Permanent |
| **Persistent** | `Waste(id)` | Waste record (v2) | Permanent |
| **Persistent** | `WasteCounter` | Incrementing waste ID | Permanent |
| **Persistent** | `Incentive(id)` | Incentive record | Permanent |
| **Persistent** | `IncentiveCounter` | Incrementing incentive ID | Permanent |
| **Persistent** | `ParticipantWastes(address)` | `Vec<u128>` of owned waste IDs | Permanent |
| **Persistent** | `TransferHistory(waste_id)` | `Vec<TransferRecord>` | Permanent |
| **Persistent** | `GlobalMetrics` | Aggregate counters | Permanent |
| **Temporary** | `ReentrancyGuard(fn_name)` | Reentrancy lock (single ledger) | Temporary |
| **Instance** | `TokenAddress` | Reward token contract | Instance |
| **Instance** | `CharityContract` | Charity contract address | Instance |
| **Instance** | `Percentages` | Collector/owner split | Instance |
| **Instance** | `Paused` | Circuit-breaker flag | Instance |

---

## Error Codes

| Code | Variant | Trigger |
|------|---------|---------|
| 1 | `AlreadyInitialized` | `initialize_admin` called twice |
| 2 | `Unauthorized` | Caller is not admin |
| 3 | `NotRegistered` | Caller/target not registered |
| 4 | `AlreadyRegistered` | Address already registered |
| 5 | `NotManufacturer` | Only Manufacturer can create incentives |
| 6 | `NotWasteOwner` | Caller doesn't own the waste |
| 7 | `WasteNotFound` | Waste ID doesn't exist |
| 8 | `MaterialNotFound` | Material ID doesn't exist (v1) |
| 9 | `IncentiveNotFound` | Incentive ID doesn't exist |
| 10 | `ParticipantNotFound` | Participant address not found |
| 11 | `InvalidAmount` | Amount is zero |
| 12 | `InvalidWeight` | Weight is zero |
| 13 | `InvalidCoordinates` | Lat/lon out of range |
| 14 | `InvalidPercentage` | Percentages exceed 100 |
| 15 | `InsufficientBalance` | Token balance too low |
| 16 | `CharityNotSet` | Charity address not configured |
| 17 | `TokenAddressNotSet` | Token address not configured |
| 18 | `WasteDeactivated` | Operation on deactivated waste |
| 19 | `WasteAlreadyDeactivated` | Already deactivated |
| 20 | `WasteAlreadyConfirmed` | Already confirmed |
| 21 | `WasteNotConfirmed` | Not yet confirmed |
| 22 | `SelfConfirmation` | Owner tried to confirm own waste |
| 23 | `IncentiveInactive` | Incentive not active |
| 24 | `MaterialNotVerified` | Material must be verified first |
| 25 | `WasteTypeMismatch` | Type mismatch between waste and incentive |
| 26 | `NoRewardAvailable` | Budget exhausted or weight too low |
| 27 | `InvalidTransferRoute` | Invalid role-to-role transfer path |
| 28 | `SameAddress` | Two addresses must differ |
| 29 | `Overflow` | Arithmetic overflow |
| 30 | `NotCreator` | Not the original creator |
| 31 | `InsufficientBudget` | Budget cannot cover reward |
| 32 | `TooManySplits` | >10 splits requested |
| 33 | `WeightMismatch` | Split weights don't sum to original |
| 44 | `WasteExpired` | Waste TTL has elapsed |
| 50 | `WasteFrozen` | Waste has an open dispute |
| 51 | `PermissionDenied` | RBAC permission check failed |

---

## Security Guide

### Access Control

- **Admin-only functions**: `transfer_admin`, `set_charity_contract`, `set_token_address`, `set_percentages`, `deactivate_waste`, `pause`/`unpause`.
- All state-changing functions require the caller to sign via `Address::require_auth()`.
- Role-based gating: `create_incentive` requires `Manufacturer`; only owners can transfer waste.

### Reentrancy Protection

Critical functions use a per-function temporary storage lock:

```rust
let guard_key = DataKey::ReentrancyGuard(function_name);
if env.storage().temporary().has(&guard_key) {
    panic!("Reentrant call");
}
env.storage().temporary().set(&guard_key, &true);
// ... function body ...
env.storage().temporary().remove(&guard_key);
```

### Input Validation

- Coordinates: latitude `|lat| ≤ 90_000_000`, longitude `|lon| ≤ 180_000_000`
- Weight: must be > 0
- Percentages: `collector_pct + owner_pct ≤ 100`
- Addresses: duplicate address checks where applicable

### Audit Findings

See [`docs/SECURITY_AUDIT.md`](SECURITY_AUDIT.md) for the full security audit report.

### Known Limitations

- No on-chain dispute arbitration (disputes freeze waste items)
- Token distribution requires the token contract to trust the calling contract

---

## Testing Guide

### Running Tests

```bash
# All tests
cargo test

# Specific test file
cargo test --test integration_test

# With output
cargo test -- --nocapture

# Watch mode
cargo watch -x test
```

### Test Structure

```
stellar-contract/tests/
├── integration_test.rs          # End-to-end scenarios
├── admin_functions_test.rs      # Admin-only functions
├── waste_registration_flow_test.rs
├── waste_transfer_flow_test.rs
├── waste_confirmation_flow_test.rs
├── incentive_management_test.rs
├── token_reward_distribution_test.rs
├── security_testing.rs          # Overflow, auth bypass
├── edge_cases_test.rs
├── performance_test.rs          # Gas benchmarks
├── fuzz_*.rs                    # Property-based fuzz tests
└── ...
```

### Writing New Tests

```rust
#[test]
fn test_register_and_submit() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, ScavngrContract);
    let client = ScavngrContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.initialize_admin(&admin);

    let recycler = Address::generate(&env);
    client.register_participant(
        &recycler, &ParticipantRole::Recycler,
        &Symbol::new(&env, "alice"),
        &40_714_000, &-74_006_000,
    );

    let waste_id = client.submit_material(
        &recycler, &WasteType::Plastic, &1000, &40_714_000, &-74_006_000,
    );
    assert!(waste_id > 0);
}
```

### Fuzz Testing

```bash
cargo install cargo-fuzz
cd stellar-contract
cargo fuzz run fuzz_waste_submission -- -max_total_time=60
```

See [`stellar-contract/FUZZING.md`](../stellar-contract/FUZZING.md).

### Snapshot Testing

Test snapshots capture ledger state after each test run and are stored in `stellar-contract/test_snapshots/`. They are automatically compared on CI.

---

## Performance Guide

### Gas Benchmarks (typical)

| Operation | CPU Instructions | Notes |
|-----------|-----------------|-------|
| `register_participant` | ~500K | One-time per address |
| `submit_material` | ~800K | Includes counter update |
| `transfer_waste` | ~1.2M | Includes history append |
| `confirm_waste_details` | ~600K | |
| `distribute_rewards` | ~2M | Token transfer included |
| `get_participant_wastes` (100 items) | ~300K | Read-only |

### Optimization Tips

- **Batch submissions**: `submit_materials_batch` amortises counter reads across items
- **Storage keys**: Use short key names to minimise ledger entry size
- **Read-only calls**: Use `simulate_transaction` (no fee) for all view functions
- **Pagination**: For large `get_participant_wastes` results, slice client-side

Full benchmark results: [`stellar-contract/BENCHMARK_RESULTS.md`](../stellar-contract/BENCHMARK_RESULTS.md)

---

## Upgrade Procedures

The contract uses an on-chain upgrade proposal system (`stellar-contract/src/upgrade.rs`).

### Upgrade Workflow

```
1. Admin proposes upgrade → emit upg_prop
2. Required approvers sign proposal → emit upg_app (per approver)
3. Once threshold met, admin executes → emit upg_exec
```

### CLI Upgrade Steps

```bash
# 1. Build new WASM
cd stellar-contract
cargo build --target wasm32-unknown-unknown --release
soroban contract optimize \
  --wasm target/wasm32-unknown-unknown/release/stellar_scavngr_contract.wasm

# 2. Propose upgrade (on-chain)
soroban contract invoke \
  --id $CONTRACT_ID --source $ADMIN_KEY --network testnet \
  -- propose_upgrade --new_wasm_hash $NEW_HASH

# 3. Execute after approvals
soroban contract invoke \
  --id $CONTRACT_ID --source $ADMIN_KEY --network testnet \
  -- execute_upgrade --proposal_id $PROPOSAL_ID

# 4. Verify version
soroban contract invoke \
  --id $CONTRACT_ID --network testnet \
  -- get_version
```

### Data Migration

Soroban storage keys are forwards-compatible. If new storage keys are added, existing data is unaffected. If key structures change, migration functions must be included in the upgrade WASM.

See [`docs/MIGRATION_GUIDE.md`](MIGRATION_GUIDE.md) and [`docs/UPGRADE_GUIDE.md`](UPGRADE_GUIDE.md) for detailed procedures.
