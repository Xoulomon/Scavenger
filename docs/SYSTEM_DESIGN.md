# Scavngr System Design Document

## Overview

This document provides a detailed technical design of the Scavngr platform — a decentralized recycling ecosystem built on Stellar blockchain using Soroban smart contracts. It covers contract state management, the waste tracking flow, the incentive system design, the reward distribution algorithm, and security considerations.

---

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Contract State Management](#contract-state-management)
3. [Waste Tracking Flow](#waste-tracking-flow)
4. [Incentive System Design](#incentive-system-design)
5. [Reward Distribution Algorithm](#reward-distribution-algorithm)
6. [Security Considerations](#security-considerations)
7. [Data Model Reference](#data-model-reference)

---

## System Architecture

Scavngr is composed of four primary layers:

```
┌──────────────────────────────────────────────────┐
│                  Frontend Layer                   │
│  React + TypeScript + Vite                       │
│  Freighter Wallet Integration                     │
└────────────────────┬─────────────────────────────┘
                     │ HTTPS / Soroban RPC
                     ▼
┌──────────────────────────────────────────────────┐
│               Backend / Indexer Layer             │
│  Rust (Actix-web) + TypeScript Indexer           │
│  REST API · Caching (Redis) · Rate Limiting       │
└────────────────────┬─────────────────────────────┘
                     │ Soroban SDK
                     ▼
┌──────────────────────────────────────────────────┐
│           Soroban Smart Contract Layer            │
│  Participant Management · Waste Tracking          │
│  Incentive Management · Reward Distribution       │
│  Statistics & Global Metrics                      │
└────────────────────┬─────────────────────────────┘
                     │ XDR / Ledger
                     ▼
┌──────────────────────────────────────────────────┐
│            Stellar Blockchain Network             │
│  Testnet / Mainnet · Soroban RPC                  │
│  Transaction Settlement · Token Ledger            │
└──────────────────────────────────────────────────┘
```

### Participant Roles

```
ParticipantRole
├── Recycler    (0) — submits and transfers waste
├── Collector   (1) — collects materials from recyclers
└── Manufacturer (2) — processes materials, creates incentives
```

---

## Contract State Management

### Storage Architecture

The Scavngr contract uses Soroban's **instance storage** and **persistent storage** to maintain on-chain state. The two storage tiers serve different purposes:

| Storage Tier | Use Case | TTL |
|---|---|---|
| `instance` | Frequently read data (participants, config, counters) | Extended automatically |
| `persistent` | Long-lived data (waste records, transfer history) | Extended on access |

### Global State Keys

```rust
// Admin and configuration
ADMINS          // Vec<Address>   — multi-sig admin list
CHARITY         // Address        — charity donation address
REWARD_CFG      // RewardConfig   — collector/owner split percentages
TOKEN_ADDR      // Address        — reward token contract
PAUSED          // bool           — emergency pause flag
REENTRANCY_GUARD // bool          — re-entrancy lock

// Counters and aggregates
TOTAL_WEIGHT    // u128           — total grams processed globally
TOTAL_TOKENS    // u128           — total tokens rewarded globally
TOTAL_CARBON    // u128           — total carbon credits earned
PART_INDEX      // u32            — next participant index
MULTISIG_THRESHOLD // u32         — approvals required for admin actions
PROPOSAL_COUNT  // u64            — next multi-sig proposal ID

// Feature-specific counters
CHALLENGE_COUNT  // u64           — next challenge ID
PENDING_XFR_CNT // u64            — next pending transfer ID
AUCTION_COUNT   // u64            — next auction ID
SEASONAL_MUL    // SeasonalMultiplier — active seasonal reward multiplier
```

### Per-Entity Storage Keys

Entities are stored by composite key `(prefix, id)`:

```rust
// Participants — keyed by Address tuple
("participant", address)         → Participant

// Waste records — keyed by waste_id
("waste", waste_id: u64)         → Waste
("waste_transfers", waste_id)    → Vec<WasteTransfer>
("waste_tracking", code: String) → u64  (tracking code → ID)

// Incentives — keyed by incentive_id
("incentive", incentive_id: u64) → Incentive
("incentive_count",)             → u64

// Auctions
("auction", auction_id: u64)     → Auction

// Challenges
("challenge", challenge_id: u64) → Challenge
("challenge_progress", (challenge_id, participant)) → ChallengeProgress

// Pending transfers
("pending_transfer", id: u64)    → PendingTransfer

// Multi-sig proposals
("proposal", id: u64)            → AdminProposal
```

### State Lifecycle

```
Contract Initialization
        │
        ▼
initialize_admin(admin)
        │
        ├─► set_token_address(admin, token)
        ├─► set_charity_contract(admin, charity)
        └─► set_percentages(admin, collector_pct, owner_pct)
                │
                ▼
         Ready for Use
```

### Multi-Sig Admin State Machine

Admin actions that affect critical configuration (percentage changes, admin transfers, waste deactivation) require multi-sig approval:

```
propose_admin_action()
        │
        ▼
AdminProposal { approvers: [], executed: false, created_at }
        │
        ├──► approve_admin_action()  [other admins sign]
        │         │
        │         ▼
        │    approvers.len() >= MULTISIG_THRESHOLD
        │         │
        │         ▼
        └──► execute_admin_action()  →  proposal.executed = true
```

Proposals expire after **7 days** (`PROPOSAL_TTL_SECS = 7 * 24 * 60 * 60`).

---

## Waste Tracking Flow

### Lifecycle Overview

Every piece of waste follows this state machine from submission to processing:

```
[Recycler]
    │
    ▼
submit_material(submitter, waste_type, weight, lat, lon)
    │
    ▼
Waste { status: Pending, verified: false, confirmed: false }
    │
    ▼
verify_material(material_id, verifier)
    │  verifier must be registered and have appropriate role
    ▼
Waste { verified: true }
    │
    ▼
transfer_waste(waste_id, from, to, lat, lon, note)
    │  Emits WasteTransfer record; appends to transfer history
    │  to must be a valid registered participant
    ▼
Waste { current_holder: Collector/Manufacturer }
    │
    ▼
confirm_waste_details(waste_id, confirmer)
    │
    ▼
Waste { confirmed: true }
    │
    ▼
recycle_waste() / Processing
    │
    ▼
Waste { status: Completed }
```

### Batch Submission

For high-throughput scenarios, multiple waste items can be submitted atomically:

```rust
submit_materials_batch(submitter, materials: Vec<Material>)
```

This minimises counter storage writes by incrementing once per batch rather than once per item.

### Transfer Validation Rules

A transfer is valid only when:

1. `from` is a registered participant
2. `to` is a registered participant
3. The waste item exists and is active
4. `from` is the current holder of the waste
5. The transfer path is valid (Recycler → Collector → Manufacturer only; no backward transfers)
6. The transfer has not expired (pending transfers expire after **24 hours**)

```
Transfer Path Validation:
Recycler    → Collector      ✓
Recycler    → Manufacturer   ✗ (must pass through Collector)
Collector   → Manufacturer   ✓
Collector   → Recycler       ✗
Manufacturer → any           ✗ (end of supply chain)
```

### Transfer History

Every state change to a waste item appends a `WasteTransfer` record:

```rust
pub struct WasteTransfer {
    pub waste_id:  u64,
    pub from:      Address,
    pub to:        Address,
    pub lat:       i32,
    pub lon:       i32,
    pub note:      String,
    pub timestamp: u64,
}
```

The full history is retrievable via `get_waste_transfer_history(waste_id)`, providing an immutable audit trail on-chain.

### Tracking Codes

Each waste item can be assigned a human-readable tracking code stored as:

```
("waste_tracking", code: String) → waste_id: u64
```

This allows off-chain systems and QR-code scanners to look up waste by code rather than numeric ID.

---

## Incentive System Design

### Incentive Model

Incentives are created by **Manufacturers** to offer reward points for specific waste types. This creates a market-driven signal for recyclers and collectors about which materials are most needed.

```rust
pub struct Incentive {
    pub id:            u64,
    pub rewarder:      Address,         // Manufacturer address
    pub waste_type:    WasteType,       // Material this incentive targets
    pub reward_points: u64,             // Base reward per unit
    pub budget:        u128,            // Remaining budget in tokens
    pub is_active:     bool,
    pub created_at:    u64,
    pub tiers:         Vec<IncentiveTier>, // Volume-based tiers
}

pub struct IncentiveTier {
    pub min_weight:    u128,
    pub reward_points: u64,
}
```

### Incentive Tiers

Tiered rewards incentivise higher-volume submission:

```
Weight Submitted   →   Reward Per Unit
< 10 kg            →   base rate (reward_points)
≥ 10 kg            →   Tier 1 rate
≥ 50 kg            →   Tier 2 rate
≥ 100 kg           →   Tier 3 rate
```

### Incentive Lookup

The contract provides several query functions for incentive discovery:

| Function | Use Case |
|---|---|
| `get_incentives(waste_type)` | Active incentives for a given waste type |
| `get_active_incentives()` | All active incentives across all waste types |
| `get_active_mfr_incentive(manufacturer, waste_type)` | Best incentive offered by a specific manufacturer |
| `get_incentive_by_id(id)` | Direct lookup by ID |

### Incentive Lifecycle

```
create_incentive(rewarder, waste_type, reward_points, budget)
        │
        ▼
Incentive { is_active: true, budget: N }
        │
        ├──► update_incentive(id, rewarder, reward_points, budget)
        │         [manufacturer adjusts terms]
        │
        ├──► budget decremented on each reward distribution
        │         [budget → 0: incentive auto-deactivates]
        │
        └──► deactivate_incentive(id, rewarder)
                  [manual deactivation]
```

### Reward Calculation

```rust
pub fn calculate_incentive_reward(incentive_id: u64, waste_amount: u64) -> u64 {
    let incentive = get_incentive(incentive_id);

    // Find highest applicable tier
    let rate = incentive.tiers
        .iter()
        .filter(|t| waste_amount >= t.min_weight as u64)
        .map(|t| t.reward_points)
        .max()
        .unwrap_or(incentive.reward_points); // Fall back to base rate

    rate * waste_amount
}
```

### Seasonal Multipliers

Admins can set time-bounded multipliers to boost rewards during campaigns:

```rust
pub struct SeasonalMultiplier {
    pub multiplier: u32,  // e.g., 150 = 1.5x
    pub start:      u64,
    pub end:        u64,
}

// Final reward = base_reward * current_multiplier / 100
```

---

## Reward Distribution Algorithm

### Overview

When a waste item completes the supply chain, `reward_tokens` distributes tokens to the supply chain participants. The distribution splits rewards between the **original waste owner (Recycler)** and the **collector** based on configured percentages.

### Configuration

```rust
// Stored as RewardConfig
collector_percentage: u32  // e.g., 30 → Collector gets 30%
owner_percentage:     u32  // e.g., 70 → Owner gets 70%
// Constraint: collector_pct + owner_pct == 100
```

### Distribution Flow

```
distribute_rewards(waste_id, incentive_id, manufacturer)
        │
        ├─1─► Load waste record → get owner address
        ├─2─► Load incentive record → get reward_points, budget
        ├─3─► Calculate total_reward = calculate_incentive_reward(incentive_id, waste.weight)
        ├─4─► Apply seasonal multiplier (if active)
        │         total_reward = total_reward * multiplier / 100
        ├─5─► Check incentive.budget >= total_reward
        ├─6─► Deduct from incentive.budget
        ├─7─► _reward_tokens(env, waste_id, total_reward)
        │         ├─► owner_reward   = total_reward * owner_pct / 100
        │         ├─► collector_reward = total_reward * collector_pct / 100
        │         ├─► Transfer owner_reward   → waste.owner
        │         ├─► Transfer collector_reward → last collector in transfer history
        │         └─► Update TOTAL_TOKENS counter
        └─8─► Emit RewardDistributed event
```

### Internal `_reward_tokens` Logic

```rust
fn _reward_tokens(env: &Env, waste_id: u64, total_reward: u128) {
    let cfg = get_reward_config(env);
    let waste = get_waste(env, waste_id);

    // Owner share
    let owner_amount = total_reward * cfg.owner_pct as u128 / 100;

    // Collector share (last address in transfer history with Collector role)
    let collector_amount = total_reward * cfg.collector_pct as u128 / 100;
    let collector = get_last_collector_from_history(env, waste_id);

    // Execute token transfers via Soroban token interface
    let token = token::Client::new(env, &get_token_address(env));
    token.transfer(&env.current_contract_address(), &waste.owner, &(owner_amount as i128));
    if let Some(collector_addr) = collector {
        token.transfer(&env.current_contract_address(), &collector_addr, &(collector_amount as i128));
    }

    // Update participant earnings records
    update_participant_earnings(env, &waste.owner, owner_amount as i128);

    // Update global metrics
    let total: u128 = env.storage().instance().get(&TOTAL_TOKENS).unwrap_or(0);
    env.storage().instance().set(&TOTAL_TOKENS, &(total + total_reward));

    // Emit event
    events::emit_tokens_rewarded(env, &waste.owner, total_reward, waste_id);
}
```

### Reentrancy Protection

All token-transferring functions use a **reentrancy guard** to prevent recursive calls:

```rust
fn lock(env: &Env) {
    if env.storage().instance().get::<_, bool>(&REENTRANCY_GUARD).unwrap_or(false) {
        panic!("Reentrancy detected");
    }
    env.storage().instance().set(&REENTRANCY_GUARD, &true);
}

fn unlock(env: &Env) {
    env.storage().instance().set(&REENTRANCY_GUARD, &false);
}
```

### Overflow Safety

All arithmetic uses `checked_add` / `checked_mul` to prevent silent integer overflow:

```rust
let new_total = total_tokens
    .checked_add(amount as u128)
    .expect("Total tokens overflow");
```

### Milestone System

The contract tracks cumulative weight milestones for participants:

```rust
// Predefined thresholds in grams
const MILESTONE_THRESHOLDS: [u128; 7] = [
    100_000,       //  100 g
    500_000,       //  500 g
    1_000_000,     //    1 kg
    5_000_000,     //    5 kg
    10_000_000,    //   10 kg
    50_000_000,    //   50 kg
    100_000_000,   //  100 kg
];
```

When a participant's total processed weight crosses a threshold, a `MilestoneReached` event is emitted and they may qualify for bonus rewards.

### Carbon Credit Calculation

```rust
pub fn calculate_carbon_credits(waste_type: WasteType, weight_grams: u128) -> u128 {
    // Credits are proportional to weight and material type
    // Higher-impact materials (e.g., electronics) earn more credits
    let credit_rate = match waste_type {
        WasteType::Plastic     => 2,
        WasteType::Metal       => 5,
        WasteType::Electronic  => 10,
        WasteType::Glass       => 1,
        _                      => 1,
    };
    weight_grams * credit_rate / 1_000  // per kg
}
```

---

## Security Considerations

### Access Control

Every state-mutating function enforces role-based access via `require_auth()` and role checks:

| Action | Required Role |
|---|---|
| `initialize_admin` | None (one-time) |
| `set_token_address` | Admin |
| `set_percentages` | Admin (multi-sig) |
| `register_participant` | Self (address auth) |
| `submit_material` | Recycler |
| `verify_material` | Registered participant |
| `transfer_waste` | Current waste holder |
| `create_incentive` | Manufacturer |
| `distribute_rewards` | Manufacturer |
| `deactivate_waste` | Admin (multi-sig) |
| `grant_certification` | Admin |

### Emergency Pause

The contract implements a pause mechanism for incident response:

```rust
fn require_not_paused(env: &Env) {
    if env.storage().instance().get::<_, bool>(&PAUSED).unwrap_or(false) {
        panic!("Contract is paused");
    }
}
```

All state-mutating endpoints call `require_not_paused` before executing.

### Multi-Sig Governance

Critical admin actions require approval from multiple admins:

```
set_percentages, transfer_admin, deactivate_waste
        │
        └─► AdminProposal created → requires N-of-M approvals
                  N = MULTISIG_THRESHOLD (configurable)
                  M = total admins
```

### Validation Layers

```
User Input
    │
    ├─► Frontend validation (TypeScript)
    ├─► Backend validation (Rust Actix-web)
    └─► Contract validation (Soroban)
            ├─► Role checks
            ├─► Registration checks
            ├─► Weight bounds (MIN_WEIGHT..MAX_WEIGHT)
            ├─► Coordinate bounds (-90..90 lat, -180..180 lon)
            └─► Transfer path validation
```

### Event Audit Trail

All significant state changes emit on-chain events, providing an immutable audit log:

| Event | Trigger |
|---|---|
| `ParticipantRegistered` | New participant registered |
| `WasteSubmitted` | Waste item created |
| `WasteTransferred` | Ownership transferred |
| `WasteVerified` | Material verified |
| `IncentiveCreated` | New incentive posted |
| `TokensRewarded` | Reward distributed |
| `MilestoneReached` | Weight milestone crossed |
| `AdminChanged` | Admin set modified |

### Known Constraints

| Constraint | Value | Rationale |
|---|---|---|
| Max active challenges | 10 | Prevent state bloat |
| Min auction duration | 1 hour | Prevent flash auctions |
| Max auction duration | 7 days | Prevent stale auctions |
| Min bid increment | 5% | Prevent bid spam |
| Proposal TTL | 7 days | Prevent stale proposals |
| Transfer expiry | 24 hours | Prevent forgotten transfers |

---

## Data Model Reference

### Core Entities

```rust
pub struct Participant {
    pub address:             Address,
    pub role:                ParticipantRole,
    pub name:                String,
    pub lat:                 i32,
    pub lon:                 i32,
    pub is_registered:       bool,
    pub total_weight:        u128,
    pub total_tokens_earned: u128,
    pub reputation:          i128,
    pub carbon_credits:      u128,
    pub certification:       Option<CertificationLevel>,
}

pub struct Waste {
    pub id:               u64,
    pub owner:            Address,
    pub current_holder:   Address,
    pub waste_type:       WasteType,
    pub weight:           u128,
    pub lat:              i32,
    pub lon:              i32,
    pub is_active:        bool,
    pub verified:         bool,
    pub confirmed:        bool,
    pub timestamp:        u64,
    pub tracking_code:    Option<String>,
    pub grade:            Option<WasteGrade>,
}

pub struct Incentive {
    pub id:            u64,
    pub rewarder:      Address,
    pub waste_type:    WasteType,
    pub reward_points: u64,
    pub budget:        u128,
    pub is_active:     bool,
    pub created_at:    u64,
    pub tiers:         Vec<IncentiveTier>,
}
```

### WasteType Enum

```rust
pub enum WasteType {
    Plastic,
    Metal,
    Paper,
    Glass,
    Electronic,
    Organic,
    Textile,
    Hazardous,
    Other,
}
```

### GlobalMetrics

```rust
pub struct GlobalMetrics {
    pub total_wastes:  u128,
    pub total_weight:  u128,
    pub total_tokens:  u128,
    pub total_carbon:  u128,
    pub participants:  u32,
}
```

---

## References

- [Soroban Storage Documentation](https://developers.stellar.org/docs/build/smart-contracts/storage)
- [Stellar Token Interface](https://developers.stellar.org/docs/tokens)
- [Soroban Security Model](https://developers.stellar.org/docs/build/smart-contracts/security)
- [Contract Source: `stellar-contract/src/lib.rs`](../stellar-contract/src/lib.rs)
- [Type Definitions: `stellar-contract/src/types.rs`](../stellar-contract/src/types.rs)
- [System Architecture: `docs/ARCHITECTURE.md`](./ARCHITECTURE.md)
