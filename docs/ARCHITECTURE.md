# Scavngr System Architecture

## Overview

Scavngr is a decentralized recycling platform built on Stellar blockchain using Soroban smart contracts. The system connects recyclers, collectors, and manufacturers in a transparent supply chain with built-in incentive mechanisms.

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend Layer                           │
│  (React, TypeScript, Vite)                                  │
│  - User Interface                                           │
│  - Wallet Integration (Freighter)                           │
│  - Transaction Management                                  │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                  API Layer (Backend)                         │
│  (Rust, Actix-web)                                          │
│  - REST Endpoints                                           │
│  - Request Validation                                       │
│  - Rate Limiting                                            │
│  - Caching                                                  │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Soroban Smart Contract Layer                    │
│  (Rust, Soroban SDK)                                        │
│  - Participant Management                                  │
│  - Waste Tracking                                           │
│  - Incentive Management                                     │
│  - Reward Distribution                                      │
│  - Statistics & Metrics                                     │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Stellar Blockchain Network                      │
│  - Testnet / Mainnet                                        │
│  - Soroban RPC                                              │
│  - Transaction Settlement                                  │
└─────────────────────────────────────────────────────────────┘
```

## Component Interaction Diagram

```
User
  │
  ├─► Frontend (React)
  │     │
  │     ├─► Wallet (Freighter)
  │     │     │
  │     │     └─► Sign Transactions
  │     │
  │     └─► API Client
  │           │
  │           ▼
  │     Backend API (Rust)
  │           │
  │           ├─► Validation
  │           ├─► Caching
  │           └─► Rate Limiting
  │                 │
  │                 ▼
  │     Soroban Contract
  │           │
  │           ├─► Participant Storage
  │           ├─► Waste Storage
  │           ├─► Incentive Storage
  │           ├─► Transfer History
  │           └─► Statistics
  │                 │
  │                 ▼
  │     Stellar Blockchain
  │           │
  │           ├─► Ledger State
  │           ├─► Event Logs
  │           └─► Transaction History
  │
  └─► Indexer (TypeScript)
        │
        ├─► Event Listener
        ├─► Data Aggregation
        └─► Analytics
```

## Data Flow Diagram

### Waste Submission Flow

```
Recycler
  │
  ├─ Submit Waste
  │   │
  │   ▼
  │ Frontend validates input
  │   │
  │   ▼
  │ Create transaction
  │   │
  │   ▼
  │ Sign with wallet
  │   │
  │   ▼
  │ Submit to Soroban
  │   │
  │   ▼
  │ Contract validates
  │   │
  │   ├─ Check participant registered
  │   ├─ Validate coordinates
  │   ├─ Validate weight
  │   │
  │   ▼
  │ Store waste record
  │   │
  │   ▼
  │ Emit WasteRegistered event
  │   │
  │   ▼
  │ Indexer captures event
  │   │
  │   ▼
  │ Update analytics
  │   │
  │   ▼
  │ Frontend updates UI
```

### Reward Distribution Flow

```
Manufacturer
  │
  ├─ Create Incentive
  │   │
  │   ▼
  │ Contract stores incentive
  │   │
  │   ▼
  │ Emit IncentiveCreated event
  │
Collector
  │
  ├─ Verify Waste
  │   │
  │   ▼
  │ Contract marks verified
  │   │
  │   ▼
  │ Emit WasteVerified event
  │
Manufacturer
  │
  ├─ Distribute Rewards
  │   │
  │   ▼
  │ Contract calculates:
  │   ├─ Waste weight × incentive points
  │   ├─ Collector percentage split
  │   ├─ Owner percentage split
  │   │
  │   ▼
  │ Deduct from incentive budget
  │   │
  │   ▼
  │ Emit RewardDistributed event
  │   │
  │   ▼
  │ Update participant stats
```

## Database Schema

### Participants Table

```sql
CREATE TABLE participants (
  address TEXT PRIMARY KEY,
  role INTEGER NOT NULL,
  name TEXT NOT NULL,
  latitude INTEGER NOT NULL,
  longitude INTEGER NOT NULL,
  registered_at BIGINT NOT NULL,
  active BOOLEAN DEFAULT true
);
```

### Wastes Table

```sql
CREATE TABLE wastes (
  id BIGINT PRIMARY KEY,
  waste_type INTEGER NOT NULL,
  weight NUMERIC NOT NULL,
  owner TEXT NOT NULL REFERENCES participants(address),
  latitude INTEGER NOT NULL,
  longitude INTEGER NOT NULL,
  created_at BIGINT NOT NULL,
  confirmed BOOLEAN DEFAULT false,
  active BOOLEAN DEFAULT true
);
```

### Incentives Table

```sql
CREATE TABLE incentives (
  id BIGINT PRIMARY KEY,
  manufacturer TEXT NOT NULL REFERENCES participants(address),
  waste_type INTEGER NOT NULL,
  reward_points NUMERIC NOT NULL,
  budget NUMERIC NOT NULL,
  spent NUMERIC DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at BIGINT NOT NULL
);
```

### Transfer History Table

```sql
CREATE TABLE transfer_history (
  id BIGINT PRIMARY KEY,
  waste_id BIGINT NOT NULL REFERENCES wastes(id),
  from_address TEXT NOT NULL REFERENCES participants(address),
  to_address TEXT NOT NULL REFERENCES participants(address),
  latitude INTEGER NOT NULL,
  longitude INTEGER NOT NULL,
  note TEXT,
  transferred_at BIGINT NOT NULL
);
```

### Statistics Table

```sql
CREATE TABLE participant_stats (
  participant TEXT PRIMARY KEY REFERENCES participants(address),
  total_wastes BIGINT DEFAULT 0,
  total_weight NUMERIC DEFAULT 0,
  total_tokens NUMERIC DEFAULT 0,
  verified_count BIGINT DEFAULT 0,
  last_updated BIGINT NOT NULL
);
```

## Smart Contract Architecture

### Module Structure

```
stellar-contract/
├── src/
│   ├── lib.rs              # Main contract entry point
│   ├── types.rs            # Data structures
│   ├── events.rs           # Event definitions
│   ├── validation.rs       # Input validation
│   ├── errors.rs           # Error types
│   ├── audit_log.rs        # Audit logging
│   └── search.rs           # Query helpers
└── tests/
    ├── integration_test.rs
    ├── waste_registration_flow_test.rs
    ├── incentive_management_test.rs
    └── ... (60+ test files)
```

### Storage Layout

```
Contract Storage
├── Admin
│   └── admin_address: Address
├── Configuration
│   ├── charity_contract: Address
│   ├── token_address: Address
│   ├── collector_percentage: u32
│   └── owner_percentage: u32
├── Participants
│   ├── participants: Map<Address, Participant>
│   └── participant_wastes: Map<Address, Vec<u64>>
├── Wastes
│   ├── wastes: Map<u64, Waste>
│   ├── waste_counter: u64
│   └── transfer_history: Map<u64, Vec<TransferRecord>>
├── Incentives
│   ├── incentives: Map<u64, Incentive>
│   ├── incentive_counter: u64
│   └── incentives_by_type: Map<u32, Vec<u64>>
└── Metrics
    ├── global_metrics: GlobalMetrics
    └── participant_stats: Map<Address, ParticipantStats>
```

### Key Functions

#### Participant Management
- `initialize_admin()` - One-time admin setup
- `register_participant()` - Register new participant
- `update_role()` - Change participant role
- `deregister_participant()` - Remove participant

#### Waste Management
- `submit_material()` - Submit single waste
- `submit_materials_batch()` - Batch submission
- `verify_material()` - Verify waste quality
- `transfer_waste()` - Transfer between participants
- `confirm_waste_details()` - Confirm details
- `deactivate_waste()` - Admin deactivation

#### Incentive Management
- `create_incentive()` - Create new incentive
- `update_incentive()` - Modify incentive
- `deactivate_incentive()` - Deactivate incentive
- `distribute_rewards()` - Distribute rewards

#### Query Functions
- `get_participant()` - Get participant info
- `get_waste()` - Get waste details
- `get_incentive_by_id()` - Get incentive
- `get_metrics()` - Get global metrics
- `get_stats()` - Get participant stats

## Security Architecture

### Access Control

```
┌─────────────────────────────────────────┐
│         Access Control Matrix           │
├─────────────────────────────────────────┤
│ Function          │ Admin │ Owner │ Any │
├─────────────────────────────────────────┤
│ initialize_admin  │  ✓    │   -   │  -  │
│ transfer_admin    │  ✓    │   -   │  -  │
│ set_charity       │  ✓    │   -   │  -  │
│ set_token         │  ✓    │   -   │  -  │
│ deactivate_waste  │  ✓    │   -   │  -  │
│ register_part.    │  -    │   -   │  ✓  │
│ submit_material   │  -    │   ✓   │  -  │
│ transfer_waste    │  -    │   ✓   │  -  │
│ verify_material   │  -    │   -   │  ✓  │
│ create_incentive  │  -    │   ✓*  │  -  │
└─────────────────────────────────────────┘
* Manufacturer only
```

### Validation Layers

```
Input Validation
├── Type Checking
│   ├── Address format
│   ├── Numeric ranges
│   └── String length
├── Business Logic
│   ├── Participant exists
│   ├── Role permissions
│   ├── Waste ownership
│   └── Transfer validity
└── Constraint Checking
    ├── Coordinate bounds
    ├── Weight limits
    ├── Budget availability
    └── Status transitions
```

### Reentrancy Protection

```
Reentrancy Guard
├── Flag-based guard
├── Prevents recursive calls
├── Applied to:
│   ├── distribute_rewards()
│   ├── donate_to_charity()
│   └── reward_tokens()
└── Atomic operations
```

## Deployment Architecture

### Network Topology

```
┌──────────────────────────────────────────────────────┐
│                  Stellar Network                      │
├──────────────────────────────────────────────────────┤
│                                                      │
│  ┌─────────────────┐         ┌─────────────────┐   │
│  │   Testnet       │         │    Mainnet      │   │
│  ├─────────────────┤         ├─────────────────┤   │
│  │ Soroban RPC     │         │ Soroban RPC     │   │
│  │ Contract ID: ... │         │ Contract ID: ... │   │
│  │ Validators: 5   │         │ Validators: 19  │   │
│  └─────────────────┘         └─────────────────┘   │
│                                                      │
└──────────────────────────────────────────────────────┘
         ▲                              ▲
         │                              │
    ┌────┴──────────┐          ┌────────┴──────┐
    │   Frontend    │          │   Frontend    │
    │   (Testnet)   │          │   (Mainnet)   │
    └───────────────┘          └───────────────┘
```

### Deployment Process

```
1. Development
   ├─ Write contract code
   ├─ Run local tests
   └─ Build WASM

2. Testnet Deployment
   ├─ Optimize WASM
   ├─ Deploy to testnet
   ├─ Run integration tests
   ├─ Audit contract
   └─ Get community feedback

3. Mainnet Deployment
   ├─ Security audit
   ├─ Final testing
   ├─ Deploy to mainnet
   ├─ Monitor metrics
   └─ Maintain & update
```

## Scalability Considerations

### Current Limitations

- **Storage**: Soroban ledger state size
- **Throughput**: ~1,000 TPS per Stellar validator
- **Latency**: ~5-10 seconds per transaction

### Optimization Strategies

1. **Batch Operations**
   - Combine multiple submissions
   - Reduce transaction count
   - Lower fees

2. **Caching Layer**
   - Cache frequently accessed data
   - Reduce RPC calls
   - Improve response time

3. **Indexing**
   - Off-chain event indexing
   - Fast queries
   - Analytics

4. **Sharding** (Future)
   - Multiple contract instances
   - Partition by waste type
   - Parallel processing

## Monitoring & Observability

### Metrics Collected

```
Contract Metrics
├── Transaction Count
├── Gas Usage
├── Error Rates
├── Latency
└── State Size

Application Metrics
├── API Response Time
├── Request Rate
├── Cache Hit Rate
├── Error Rate
└── Active Users

Business Metrics
├── Total Waste Submitted
├── Total Rewards Distributed
├── Active Participants
├── Incentive Budget Used
└── Supply Chain Efficiency
```

### Logging Strategy

```
Log Levels
├── ERROR: Contract failures, validation errors
├── WARN: Budget exhaustion, deactivations
├── INFO: Transactions, state changes
└── DEBUG: Detailed execution flow

Log Destinations
├── Console (development)
├── File (production)
├── CloudWatch (AWS)
└── Datadog (monitoring)
```

## Disaster Recovery

### Backup Strategy

```
Daily Backups
├── Contract state snapshot
├── Database backup
├── Event logs
└── Configuration

Recovery Procedures
├── State restoration
├── Transaction replay
├── Consistency verification
└── Validation
```

### Failover Plan

```
Primary Failure
├── Detect failure (5 min timeout)
├── Switch to backup RPC
├── Verify state consistency
├── Resume operations
└── Alert team
```

## Design Patterns Used

### 1. Storage Pattern
- Efficient key-value storage
- Indexed lookups
- Batch operations

### 2. Event-Driven Architecture
- Contract emits events
- Indexer listens
- Off-chain processing

### 3. Role-Based Access Control
- Admin functions
- Owner-only operations
- Public queries

### 4. State Machine
- Waste status transitions
- Incentive lifecycle
- Participant states

### 5. Reward Distribution
- Percentage-based splits
- Budget tracking
- Atomic transfers

## Architecture Decision Records (ADRs)

This document describes **how** the system is built. The decision log records **why**,
including the alternatives that were rejected and the costs each choice carries.

➡️ **[Architecture Decision Records](./adr/README.md)**

| # | Decision | Area |
|---|----------|------|
| [0001](./adr/0001-use-soroban-for-smart-contracts.md) | Use Soroban and Rust for the on-chain contract | Contract |
| [0002](./adr/0002-off-chain-event-driven-indexing.md) | Serve queries from an off-chain event-driven indexer | Indexer |
| [0003](./adr/0003-percentage-based-reward-distribution.md) | Distribute rewards by configurable percentage | Contract |
| [0004](./adr/0004-contract-storage-key-layout.md) | Tier contract storage by access pattern, with typed tuple keys | Contract |
| [0005](./adr/0005-indexer-relational-schema.md) | Project events into a normalised Postgres schema, keeping raw events | Indexer |
| [0006](./adr/0006-wallet-based-authentication-flow.md) | Authenticate with wallet signatures; treat frontend session state as UI only | Frontend / Auth |

ADRs 0001–0003 were previously recorded inline in this document and now live in the
log, keeping their original numbering. Changes that contradict an Accepted ADR should
be raised in review; changes that supersede one should ship with a new ADR.

New decisions start from [`docs/adr/template.md`](./adr/template.md).

---

## Related Documentation

- [Architecture Decision Records](./adr/README.md)
- [API Reference](./API_REFERENCE.md)
- [API Documentation](./API_REFERENCE.md)
- [Database Schema](./DATABASE_SCHEMA.md)
- [User Guide](./USER_GUIDE.md)
- [Security Audit Report](./SECURITY_AUDIT.md)
- [Deployment Guide](./KUBERNETES_DEPLOYMENT.md)

---

Last updated: July 24, 2026
