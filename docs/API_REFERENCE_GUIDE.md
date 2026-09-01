# Scavngr — API Reference Guide

> **Issue:** #534
> **Category:** Documentation
> **Audience:** Developers integrating with the Scavngr Soroban smart contract
> **Last Updated:** 2026-05-26

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Authentication & Authorization](#authentication--authorization)
4. [Data Types](#data-types)
5. [Error Codes & Handling](#error-codes--handling)
6. [Contract Functions](#contract-functions)
   - [Admin Functions](#admin-functions)
   - [Participant Functions](#participant-functions)
   - [Waste / Material Functions](#waste--material-functions)
   - [Incentive Functions](#incentive-functions)
   - [Reward Functions](#reward-functions)
   - [Auction Functions](#auction-functions)
   - [Stats & Metrics Functions](#stats--metrics-functions)
   - [Utility Functions](#utility-functions)
7. [Quick Reference Cards](#quick-reference-cards)
   - [Recycler Quick Reference](#recycler-quick-reference)
   - [Collector Quick Reference](#collector-quick-reference)
   - [Manufacturer Quick Reference](#manufacturer-quick-reference)
   - [Admin Quick Reference](#admin-quick-reference)

---

## Overview

The Scavngr smart contract is a **Soroban (Rust)** contract deployed on the Stellar blockchain. It manages a decentralized recycling supply chain involving three participant roles:

| Role | Value | Description |
|------|-------|-------------|
| `Recycler` | `0` | Collects and submits recyclable waste |
| `Collector` | `1` | Aggregates and transfers waste along the chain |
| `Manufacturer` | `2` | Creates incentives and distributes rewards |

All state-changing calls are Stellar transactions; read-only calls are simulated (no fee).

---

## Prerequisites

```bash
# Install Rust + WASM target
rustup target add wasm32-unknown-unknown

# Install Soroban CLI
cargo install --locked soroban-cli --features opt

# Configure testnet network alias (one-time)
soroban network add \
  --global testnet \
  --rpc-url https://soroban-testnet.stellar.org \
  --network-passphrase "Test SDF Network ; September 2015"

# Generate and fund a deployer keypair
soroban keys generate deployer --network testnet
curl "https://friendbot.stellar.org?addr=$(soroban keys address deployer)"
```

---

## Authentication & Authorization

Every state-changing call requires:

1. **`address.require_auth()`** — the transaction must be signed by the relevant Stellar account.
2. **Role checks** — specific roles are enforced per function (see Access Control Matrix below).

```
Access Control Matrix
──────────────────────────────────────────────────────────────
Function group          Admin   Owner/Self  Any registered
──────────────────────────────────────────────────────────────
initialize_admin          ✓
transfer_admin            ✓
set_charity_contract      ✓
set_token_address         ✓
set_percentages           ✓
pause / unpause           ✓
register_participant                            ✓ (self)
update_role                          ✓ (self)
deregister_participant               ✓ (self)
submit_material                                ✓ registered
recycle_waste                                  ✓ registered
transfer_waste                       ✓ (owner)
create_incentive                               ✓ manufacturer
distribute_rewards                             ✓ manufacturer
deactivate_waste          ✓
──────────────────────────────────────────────────────────────
```

---

## Data Types

### `ParticipantRole`
```rust
pub enum ParticipantRole {
    Recycler     = 0,
    Collector    = 1,
    Manufacturer = 2,
}
```

### `WasteType`
```rust
pub enum WasteType {
    Plastic,
    Metal,
    Paper,
    Glass,
    Organic,
    Electronic,
    Textile,
    Rubber,
    Chemical,
    Mixed,
}
```

### `CertificationLevel`
```rust
pub enum CertificationLevel {
    Beginner,    // 0 – 99 999 g processed
    Intermediate,// 100 000 – 499 999 g
    Advanced,    // 500 000 – 999 999 g
    Expert,      // 1 000 000 – 4 999 999 g
    Master,      // 5 000 000+ g
}
```
Higher certification levels earn a larger reward multiplier.

### `Participant`
```rust
pub struct Participant {
    pub address:              Address,
    pub role:                 ParticipantRole,
    pub name:                 Symbol,          // max 32 chars
    pub latitude:             i128,            // microdegrees (1° = 1_000_000)
    pub longitude:            i128,
    pub is_registered:        bool,
    pub total_waste_processed: u128,           // grams
    pub total_tokens_earned:   u128,
    pub registered_at:        u64,             // Unix timestamp
    pub reputation_score:     i128,            // range [-1000, 10000]
    pub last_active_at:       u64,
    pub certification:        CertificationLevel,
}
```

### `Waste` (v2)
```rust
pub struct Waste {
    pub waste_id:      u128,
    pub waste_type:    WasteType,
    pub weight:        u128,           // grams
    pub recycler:      Address,
    pub current_owner: Address,
    pub latitude:      i128,
    pub longitude:     i128,
    pub created_at:    u64,
    pub is_active:     bool,
    pub is_confirmed:  bool,
    pub tracking_code: String,
    pub expires_at:    u64,            // 0 = no expiry
}
```

### `Incentive`
```rust
pub struct Incentive {
    pub id:               u64,
    pub rewarder:         Address,
    pub waste_type:       WasteType,
    pub reward_points:    u64,         // tokens per kg
    pub total_budget:     u64,         // total token budget
    pub remaining_budget: u64,
    pub active:           bool,
    pub start_time:       u64,         // Unix timestamp, 0 = immediate
    pub end_time:         u64,         // Unix timestamp, 0 = no expiry
}
```

### `RecyclingStats`
```rust
pub struct RecyclingStats {
    pub participant:      Address,
    pub total_wastes:     u64,
    pub total_weight:     u64,         // grams
    pub total_tokens:     u64,
    pub verified_count:   u64,
    pub recycling_rate:   u32,         // 0–100 %
}
```

### `GlobalMetrics`
```rust
pub struct GlobalMetrics {
    pub total_wastes:  u64,
    pub total_weight:  u64,
    pub total_tokens:  u128,
}
```

---

## Error Codes & Handling

All panics surface as Soroban contract errors. The message string is included in the transaction result.

| Panic Message | Trigger | Resolution |
|---------------|---------|------------|
| `"Admin already initialized"` | `initialize_admin` called twice | Deploy fresh contract |
| `"Admin not set"` | Admin call before initialization | Call `initialize_admin` first |
| `"Unauthorized: caller is not admin"` | Non-admin calls admin function | Use correct admin account |
| `"Participant already registered"` | Duplicate `register_participant` | Check before registering |
| `"Caller is not a registered participant"` | Unregistered address calls guarded fn | Register first |
| `"Participant not found"` | Address not in storage | Verify address and registration |
| `"Participant is not registered"` | Deregistered participant | Re-register if needed |
| `"Caller is not a manufacturer"` | Non-manufacturer calls mfr-only fn | Use manufacturer account |
| `"Waste item not found"` | Invalid waste ID | Check ID validity |
| `"Waste weight must be greater than zero"` | Zero weight submitted | Provide positive weight |
| `"Waste weight exceeds maximum allowed"` | Weight > 1 000 000 kg | Split submission |
| `"Self-transfer is not allowed"` | `from == to` in transfer | Use different recipient |
| `"Invalid transfer: role combination not allowed"` | Illegal role path | Follow Recycler→Collector→Manufacturer |
| `"Incentive not found"` | Invalid incentive ID | Check incentive exists |
| `"Incentive is not active"` | Updating inactive incentive | Reactivate or create new |
| `"Reward must be greater than zero"` | Zero reward points | Provide positive reward |
| `"Total budget must be greater than zero"` | Zero budget | Provide positive budget |
| `"Insufficient balance"` | Donate more than earned | Earn more tokens |
| `"Token address not set"` | `reward_tokens` before token setup | Call `set_token_address` |
| `"Total percentages cannot exceed 100"` | Sum of percentages > 100 | Reduce percentages |
| `"Charity address cannot be the same as admin"` | Same address for charity/admin | Use different address |
| `"Reentrant call detected"` | Re-entry on guarded function | Architectural issue; fix caller |
| `"Contract is paused"` | Any call while paused | Wait for admin to unpause |
| `"Invalid auction duration"` | Outside 1 h – 7 d range | Use valid duration |

---

## Contract Functions

### Admin Functions

---

#### `initialize_admin`

Initialize the contract administrator. **Must be called exactly once** immediately after deployment.

```
initialize_admin(admin: Address) → void
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `admin` | `Address` | Address that receives admin privileges. Must sign the transaction. |

**Errors:** `"Admin already initialized"`

**Example (Soroban CLI):**
```bash
soroban contract invoke \
  --id $CONTRACT_ID \
  --source admin \
  --network testnet \
  -- initialize_admin \
  --admin $(soroban keys address admin)
```

---

#### `get_admin`

Returns the primary admin address.

```
get_admin(env: Env) → Address
```

**Errors:** `"Admin not set"` if not initialized.

---

#### `get_admins`

Returns all admin addresses (multi-sig support).

```
get_admins(env: Env) → Vec<Address>
```

---

#### `add_admin`

Add a new admin to the admin list (existing admin only).

```
add_admin(current_admin: Address, new_admin: Address) → void
```

---

#### `remove_admin`

Remove an admin from the list. Cannot remove the last admin.

```
remove_admin(current_admin: Address, admin_to_remove: Address) → void
```

**Errors:** `"Cannot remove the last admin"`, `"Admin to remove not found"`

---

#### `transfer_admin`

Replace the entire admin list with a new set of addresses.

```
transfer_admin(current_admin: Address, new_admins: Vec<Address>) → void
```

**Errors:** `"Admin list cannot be empty"`

---

#### `set_charity_contract`

Set the charity contract address for token donations.

```
set_charity_contract(admin: Address, charity_address: Address) → void
```

**Errors:** `"Charity address cannot be the same as admin"`

---

#### `set_token_address`

Set the SEP-41 token contract address used for reward transfers.

```
set_token_address(admin: Address, token_address: Address) → void
```

---

#### `set_percentages`

Atomically set both collector and owner reward percentages.

```
set_percentages(admin: Address, collector_percentage: u32, owner_percentage: u32) → void
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `collector_percentage` | `u32` | Share (0–100) for each collector in the transfer chain |
| `owner_percentage` | `u32` | Share (0–100) for the current waste owner |

**Defaults:** collector = 5%, owner = 50%
**Errors:** `"Total percentages cannot exceed 100"`

---

#### `set_seasonal_multiplier`

Set a seasonal reward multiplier (basis points: 100 = 1×, 200 = 2×, max 500).

```
set_seasonal_multiplier(admin: Address, multiplier: u32, start: u64, end: u64) → void
```

**Errors:** Panics if `multiplier < 100`, `multiplier > 500`, or `start >= end`.

---

### Participant Functions

---

#### `register_participant`

Register a new supply-chain participant.

```
register_participant(
    address:   Address,
    role:      ParticipantRole,
    name:      Symbol,
    latitude:  i128,
    longitude: i128,
) → Participant
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `address` | `Address` | Participant's Stellar address. Must sign. |
| `role` | `ParticipantRole` | `Recycler` (0), `Collector` (1), `Manufacturer` (2) |
| `name` | `Symbol` | Short display name (max 32 chars) |
| `latitude` | `i128` | Microdegrees (e.g. `52_520_000` = 52.52°N) |
| `longitude` | `i128` | Microdegrees (e.g. `13_405_000` = 13.405°E) |

**Returns:** `Participant` record with `registered_at` and initial zeros.

**Errors:** `"Participant already registered"`, invalid coordinates.

**Example:**
```bash
soroban contract invoke \
  --id $CONTRACT_ID \
  --source alice \
  --network testnet \
  -- register_participant \
  --address $(soroban keys address alice) \
  --role 0 \
  --name alice \
  --latitude 52520000 \
  --longitude 13405000
```

---

#### `get_participant`

Retrieve a participant record by address.

```
get_participant(address: Address) → Option<Participant>
```

Returns `None` if not registered.

---

#### `get_participant_info`

Retrieve a participant together with their recycling statistics.

```
get_participant_info(address: Address) → Option<ParticipantInfo>
```

Returns `ParticipantInfo { participant, stats }` or `None`.

---

#### `is_participant_registered`

Check whether an address is a registered and active participant.

```
is_participant_registered(address: Address) → bool
```

---

#### `update_role`

Change the role of a registered participant. Preserves all other fields.

```
update_role(address: Address, new_role: ParticipantRole) → Participant
```

**Errors:** `"Participant not found"`, `"Participant is not registered"`

---

#### `deregister_participant`

Mark a participant as deregistered. Record is retained; they can no longer perform role-gated actions.

```
deregister_participant(address: Address) → Participant
```

---

#### `update_participant_location`

Update GPS coordinates of a registered participant.

```
update_participant_location(address: Address, latitude: i128, longitude: i128) → Participant
```

---

#### `get_all_participants`

Paginated list of all registered participant addresses.

```
get_all_participants(offset: u32, limit: u32) → Vec<Address>
```

---

#### `can_collect`

Check whether a participant may collect waste (Recycler or Collector role).

```
can_collect(address: Address) → bool
```

---

#### `can_manufacture`

Check whether a participant may create incentives (Manufacturer role).

```
can_manufacture(address: Address) → bool
```

---

### Waste / Material Functions

---

#### `recycle_waste` *(v2 — recommended)*

Register a new waste item with GPS location. Returns the new waste ID.

```
recycle_waste(
    waste_type: WasteType,
    weight:     u128,        // grams
    recycler:   Address,
    latitude:   i128,
    longitude:  i128,
) → u128
```

**Errors:** weight = 0, weight > 1 000 000 kg, not registered.

**Example:**
```bash
soroban contract invoke \
  --id $CONTRACT_ID \
  --source alice \
  --network testnet \
  -- recycle_waste \
  --waste_type '{"Plastic": {}}' \
  --weight 5000 \
  --recycler $(soroban keys address alice) \
  --latitude 52520000 \
  --longitude 13405000
```

---

#### `submit_material` *(v1 — legacy)*

Submit a waste material without GPS. Use `recycle_waste` for new integrations.

```
submit_material(
    waste_type:  WasteType,
    weight:      u64,
    submitter:   Address,
    description: String,
) → Material
```

---

#### `get_waste_v2`

Retrieve a v2 waste record by its `u128` ID.

```
get_waste_v2(waste_id: u128) → Option<Waste>
```

---

#### `get_participant_wastes_v2`

Get all v2 waste IDs currently owned by a participant.

```
get_participant_wastes_v2(participant: Address) → Vec<u128>
```

---

#### `transfer_waste_v2` *(v2 — recommended)*

Transfer waste ownership between participants. Enforces valid role route.

```
transfer_waste_v2(
    waste_id:  u128,
    from:      Address,
    to:        Address,
    latitude:  i128,
    longitude: i128,
) → void
```

**Valid routes:** Recycler → Collector, Recycler → Manufacturer, Collector → Manufacturer
**Errors:** `"Invalid transfer: role combination not allowed"`, `"Self-transfer is not allowed"`

---

#### `transfer_waste` *(v1 — legacy)*

```
transfer_waste(waste_id: u64, from: Address, to: Address, note: String) → Material
```

---

#### `get_waste_transfer_history`

Get the full transfer history for a waste item.

```
get_waste_transfer_history(waste_id: u64) → Vec<WasteTransfer>
```

---

#### `get_waste_transfer_history_v2`

Transfer history for v2 waste items.

```
get_waste_transfer_history_v2(waste_id: u128) → Vec<WasteTransfer>
```

---

#### `waste_exists`

Check if a waste record with the given ID exists.

```
waste_exists(waste_id: u64) → bool
```

---

#### `get_waste_by_tracking_code`

Look up a v2 waste item by its human-readable tracking code.

```
get_waste_by_tracking_code(code: String) → Option<Waste>
```

---

### Incentive Functions

---

#### `create_incentive`

Create a new recycling incentive. Caller must be a registered Manufacturer.

```
create_incentive(
    rewarder:      Address,
    waste_type:    WasteType,
    reward_points: u64,      // tokens per kg
    budget:        u64,      // total token budget
) → Incentive
```

**Example:**
```bash
soroban contract invoke \
  --id $CONTRACT_ID \
  --source mfr \
  --network testnet \
  -- create_incentive \
  --rewarder $(soroban keys address mfr) \
  --waste_type '{"Plastic": {}}' \
  --reward_points 10 \
  --budget 100000
```

---

#### `update_incentive`

Update the reward points and total budget of an active incentive.

```
update_incentive(
    incentive_id:    u64,
    new_reward_points: u64,
    new_total_budget:  u64,
) → Incentive
```

**Errors:** `"Incentive not found"`, `"Incentive is not active"`, zero values rejected.

---

#### `deactivate_incentive`

Deactivate an incentive (caller must be the original rewarder).

```
deactivate_incentive(incentive_id: u64, rewarder: Address) → Incentive
```

---

#### `update_incentive_status`

Toggle the active status of an incentive.

```
update_incentive_status(incentive_id: u64, is_active: bool) → Incentive
```

---

#### `get_incentive_by_id`

Retrieve an incentive by its numeric ID.

```
get_incentive_by_id(incentive_id: u64) → Option<Incentive>
```

---

#### `get_incentives` / `get_incentives_by_waste_type`

Get all active incentives for a specific waste type, sorted by reward descending.

```
get_incentives(waste_type: WasteType) → Vec<Incentive>
```

---

#### `get_active_incentives`

Get all currently active incentives across all waste types.

```
get_active_incentives() → Vec<Incentive>
```

---

#### `calculate_incentive_reward`

Calculate the token reward for a given waste amount under a specific incentive.

```
calculate_incentive_reward(incentive_id: u64, waste_amount: u64) → u64
```

Formula: `floor(waste_amount / 1000) * reward_points`, capped at `remaining_budget`.

---

### Reward Functions

---

#### `distribute_rewards`

Distribute supply-chain rewards: manufacturer creates the payout to the entire chain.

```
distribute_rewards(
    waste_id:     u64,
    incentive_id: u64,
    manufacturer: Address,
) → void
```

Splits the calculated reward proportionally:
- **Collectors** in the transfer chain each receive `weight × reward_points × collector_pct%`
- **Owner (current)** receives `owner_pct%`
- **Recycler (submitter)** receives the remainder
- All amounts are multiplied by the recipient's certification-level bonus.

---

#### `reward_tokens`

Manually reward tokens to a registered recipient (protected by reentrancy guard).

```
reward_tokens(
    rewarder:  Address,
    recipient: Address,
    amount:    i128,
    waste_id:  u64,
) → void
```

**Errors:** `"Reward amount must be greater than zero"`, `"Recipient not registered"`, `"Token address not set"`

---

#### `donate_to_charity`

Donate tokens from a participant's earned balance to the charity contract.

```
donate_to_charity(donor: Address, amount: i128) → void
```

**Errors:** `"Donation amount must be greater than zero"`, `"Insufficient balance"`, `"Charity contract not set"`

---

### Auction Functions

---

#### `create_auction`

Create a Dutch-style auction for waste material.

```
create_auction(
    waste_id:    u128,
    start_price: u128,
    duration:    u64,   // seconds; min 3600 (1h), max 604800 (7d)
) → u64
```

Returns the new auction ID.

---

#### `place_bid`

Place a bid on an active auction.

```
place_bid(auction_id: u64, amount: u128) → void
```

Bid must exceed current price by at least 5%.

---

#### `end_auction`

Finalize the auction and transfer waste to the highest bidder.

```
end_auction(auction_id: u64) → void
```

---

#### `cancel_auction`

Cancel an auction before any bids have been placed.

```
cancel_auction(auction_id: u64) → void
```

**Errors:** `"Cannot cancel auction with bids"`

---

### Stats & Metrics Functions

---

#### `get_metrics`

Get global platform metrics.

```
get_metrics() → GlobalMetrics
```

Returns:
```json
{
  "total_wastes": 1234,
  "total_weight": 5678900,
  "total_tokens": 987654321
}
```

---

#### `get_stats`

Get recycling stats for a specific participant.

```
get_stats(participant: Address) → Option<RecyclingStats>
```

---

#### `get_supply_chain_stats`

Get global supply chain statistics.

```
get_supply_chain_stats() → SupplyChainStats
```

---

#### `get_current_multiplier`

Return the currently active seasonal reward multiplier in basis points (100 = 1×).

```
get_current_multiplier() → u32
```

---

### Utility Functions

---

#### `get_waste_type_string`

Convert a `WasteType` variant to its human-readable string.

```
get_waste_type_string(waste_type: WasteType) → String
```

---

#### `get_participant_role_string`

Convert a `ParticipantRole` variant to its human-readable string.

```
get_participant_role_string(role: ParticipantRole) → String
```

---

#### `is_valid_transfer`

Check if a transfer from `from` to `to` is a permitted role transition.

```
is_valid_transfer(from: Address, to: Address) → bool
```

Valid routes: Recycler→Collector, Recycler→Manufacturer, Collector→Manufacturer.

---

## Quick Reference Cards

### Recycler Quick Reference

```
RECYCLER ROLE — What you can do
════════════════════════════════════════════════════════

Register:  register_participant(address, Recycler, name, lat, lon)
Submit:    recycle_waste(Plastic, 5000g, address, lat, lon) → waste_id
Transfer:  transfer_waste_v2(waste_id, me, collector, lat, lon)
Earn:      Rewards distributed automatically via distribute_rewards()
View:      get_participant_wastes_v2(address)
Stats:     get_stats(address)
Donate:    donate_to_charity(address, amount)

Transfer routes open to you:
  You → Collector ✓
  You → Manufacturer ✓

Certification levels (reward multiplier):
  Beginner      (< 100 kg)     → 1.00×
  Intermediate  (100 – 500 kg) → 1.05×
  Advanced      (500 kg – 1 t) → 1.10×
  Expert        (1 – 5 t)      → 1.20×
  Master        (5 t+)         → 1.50×
```

---

### Collector Quick Reference

```
COLLECTOR ROLE — What you can do
════════════════════════════════════════════════════════

Register:  register_participant(address, Collector, name, lat, lon)
Receive:   Accept transfer from Recycler (transfer_waste_v2)
Transfer:  transfer_waste_v2(waste_id, me, manufacturer, lat, lon)
Earn:      collector_percentage of reward on distribute_rewards()
View:      get_participant_wastes_v2(address)
Stats:     get_stats(address)

Transfer routes open to you:
  You → Manufacturer ✓

Reward formula (per distribute_rewards call):
  your_share = total_reward × collector_pct% × certification_multiplier
  Default collector_pct = 5%

Check if eligible to collect:
  can_collect(address) → true
```

---

### Manufacturer Quick Reference

```
MANUFACTURER ROLE — What you can do
════════════════════════════════════════════════════════

Register:    register_participant(address, Manufacturer, name, lat, lon)
Incentivize: create_incentive(address, Plastic, 10pts/kg, 100000 budget)
Update:      update_incentive(incentive_id, new_pts, new_budget)
Deactivate:  deactivate_incentive(incentive_id, address)
Distribute:  distribute_rewards(waste_id, incentive_id, address)
Query:       get_active_incentives()
             get_incentives(WasteType)
             get_active_mfr_incentive(address, WasteType)

Reward calculation:
  reward = floor(waste_weight_g / 1000) × reward_points
  capped at incentive.remaining_budget

Auction materials:
  create_auction(waste_id, start_price, duration)
  end_auction(auction_id)
```

---

### Admin Quick Reference

```
ADMIN ROLE — What you can do
════════════════════════════════════════════════════════

Setup:
  initialize_admin(address)             # once, at deployment
  set_token_address(admin, token_addr)  # SEP-41 reward token
  set_charity_contract(admin, charity)  # charity recipient
  set_percentages(admin, 5, 50)         # collector%, owner%

Multi-sig:
  add_admin(current_admin, new_admin)
  remove_admin(current_admin, target)
  transfer_admin(current_admin, [addr1, addr2])

Governance:
  pause_contract(admin)
  unpause_contract(admin)
  deactivate_waste(admin, waste_id)
  set_seasonal_multiplier(admin, 150, start_ts, end_ts)

Certifications:
  grant_certification(address, Expert)

Bulk import (migration):
  bulk_import_wastes(wastes_vec)         # max 100 per call
  bulk_import_participants(parts_vec)    # max 100 per call
```

---

## Related Documentation

- [Architecture Diagram](./architecture-diagram.svg)
- [Deployment Runbook](./DEPLOYMENT_RUNBOOK.md)
- [Troubleshooting Guide](./TROUBLESHOOTING_GUIDE.md)
- [API Documentation (REST)](./API_DOCUMENTATION.md)
- [User Guide](./USER_GUIDE.md)
