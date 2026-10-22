# Factory Helpers Guide

This guide describes the factory pattern used across Scavenger for building test data. Factories provide type-safe, reusable builders for creating test entities with sensible defaults.

## Overview

Factory helpers eliminate verbose test setup by providing builder patterns with:

- **Sensible defaults** — Each field has a meaningful default value
- **Partial overrides** — Override only the fields you need to test
- **Type safety** — Compile-time validation of test data
- **Reusability** — Share factories across all test packages
- **Maintainability** — Update entity structure once, not in every test file

## Factory Pattern

### Basic Structure

Each factory follows this pattern:

```rust
// backend/src/test/factories.rs

pub struct ParticipantBuilder {
    address: Address,
    role: ParticipantRole,
    name: String,
    reputation: i128,
    // ... other fields
}

impl ParticipantBuilder {
    /// Create a builder with default values
    pub fn new() -> Self {
        ParticipantBuilder {
            address: Address::random(&env),
            role: ParticipantRole::Recycler,
            name: "Test User".to_string(),
            reputation: 100,
            // ... defaults for all fields
        }
    }

    /// Override the address
    pub fn address(mut self, address: Address) -> Self {
        self.address = address;
        self
    }

    /// Override the role
    pub fn role(mut self, role: ParticipantRole) -> Self {
        self.role = role;
        self
    }

    // ... builder methods for all fields

    /// Build the final Participant
    pub fn build(self) -> Participant {
        Participant {
            address: self.address,
            role: self.role,
            name: self.name,
            reputation: self.reputation,
            // ... all fields
        }
    }
}

impl Default for ParticipantBuilder {
    fn default() -> Self {
        Self::new()
    }
}
```

### TypeScript Factories

For frontend and indexer tests:

```typescript
// frontend/src/test/factories.ts

export function createParticipant(
  overrides?: Partial<Participant>
): Participant {
  return {
    id: "participant-1",
    address: "GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    role: "recycler",
    name: "Test User",
    reputation: 100,
    email: "test@example.com",
    location: {
      latitude: 0,
      longitude: 0,
    },
    joinedAt: new Date().toISOString(),
    ...overrides,
  };
}

export function createWasteBatch(
  overrides?: Partial<WasteBatch>
): WasteBatch {
  return {
    id: "waste-1",
    type: "plastic",
    weight: 100,
    submittedBy: "participant-1",
    status: "pending",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}
```

## Factories by Entity

### Core Entities

Each package provides factories for these core entities:

#### 1. Participant
- **Fields**: id, address, role, name, reputation, email, location, joinedAt
- **Defaults**: Random UUID, recycler role, 100 reputation, current timestamp
- **Test usage**: `ParticipantBuilder::new().role(ParticipantRole::Manufacturer).build()`

#### 2. Waste Batch
- **Fields**: id, type, weight, submittedBy, status, createdAt, updatedAt
- **Defaults**: Random ID, "plastic" type, 100 weight, "pending" status
- **Test usage**: `WasteBatchBuilder::new().weight(500).build()`

#### 3. Transfer
- **Fields**: id, wasteId, fromAddress, toAddress, status, createdAt
- **Defaults**: Random IDs, "pending" status, current timestamp
- **Test usage**: `TransferBuilder::new().status(TransferStatus::Completed).build()`

#### 4. Incentive
- **Fields**: id, rewardAmount, wasteType, startDate, endDate, active
- **Defaults**: 50 reward, "plastic" waste type, active=true
- **Test usage**: `IncentiveBuilder::new().wasteType(WasteType::Glass).build()`

## Usage Patterns

### Pattern 1: Default Factory

```rust
#[test]
fn test_register_participant() {
    let participant = ParticipantBuilder::new().build();
    assert!(register(&participant).is_ok());
}
```

### Pattern 2: Override Single Field

```rust
#[test]
fn test_manufacturer_permissions() {
    let participant = ParticipantBuilder::new()
        .role(ParticipantRole::Manufacturer)
        .build();
    
    assert!(has_manufacturing_permissions(&participant));
}
```

### Pattern 3: Override Multiple Fields

```rust
#[test]
fn test_transfer_between_users() {
    let from = ParticipantBuilder::new()
        .role(ParticipantRole::Recycler)
        .build();
    
    let to = ParticipantBuilder::new()
        .role(ParticipantRole::Collector)
        .build();
    
    let waste = WasteBatchBuilder::new()
        .submittedBy(from.id.clone())
        .build();
    
    assert!(transfer_waste(&waste, from, to).is_ok());
}
```

### Pattern 4: Collection of Entities

```rust
#[test]
fn test_leaderboard_calculation() {
    let participants: Vec<Participant> = (0..100)
        .map(|i| {
            ParticipantBuilder::new()
                .name(format!("User {}", i))
                .reputation((i as i128) * 10)
                .build()
        })
        .collect();
    
    let leaderboard = calculate_leaderboard(&participants);
    assert_eq!(leaderboard.len(), 100);
}
```

## Implementation Checklist

When implementing factories for a new entity:

- [ ] Define factory builder struct with all entity fields
- [ ] Implement sensible defaults for each field
- [ ] Add builder methods for each field (fluent API)
- [ ] Add `build()` method that constructs the final entity
- [ ] Implement `Default` trait
- [ ] Add comprehensive factory tests
- [ ] Document all fields and defaults in inline comments
- [ ] Update this guide with the new factory

## Location Guidelines

- **Rust smart contract factories**: `stellar-contract/src/test/factories.rs`
- **Backend factories**: `backend/src/test/factories.rs`
- **Frontend factories**: `frontend/src/test/factories.ts`
- **Indexer factories**: `indexer/src/test/fixtures.ts`

## Testing Factories

Each factory should have tests that verify:

```rust
#[cfg(test)]
mod factory_tests {
    use super::*;

    #[test]
    fn test_participant_factory_defaults() {
        let participant = ParticipantBuilder::new().build();
        
        assert!(!participant.address.is_empty());
        assert_eq!(participant.role, ParticipantRole::Recycler);
        assert_eq!(participant.reputation, 100);
    }

    #[test]
    fn test_participant_factory_overrides() {
        let custom_address = "CUSTOM_ADDRESS".to_string();
        let participant = ParticipantBuilder::new()
            .address(custom_address.clone())
            .role(ParticipantRole::Manufacturer)
            .reputation(500)
            .build();
        
        assert_eq!(participant.address, custom_address);
        assert_eq!(participant.role, ParticipantRole::Manufacturer);
        assert_eq!(participant.reputation, 500);
    }
}
```

## Performance Considerations

Factories should be lightweight and fast:

- Avoid expensive operations (file I/O, network calls) in factories
- Use randomization sparingly (consider seeding for reproducible tests)
- Cache environment setup if needed across tests
- Consider using cloning vs. references based on ownership needs

## Version Compatibility

When entities evolve:

1. Add new fields to factory with sensible defaults
2. Keep old builder methods for backward compatibility
3. Mark deprecated fields with deprecation warnings
4. Update factory tests to cover new fields
5. Update this guide with migration notes

## Related Documentation

- [Testing Guide](./TESTING_GUIDE.md)
- [API Documentation](./API_DOCUMENTATION.md)
- [Data Models](./DATABASE_SCHEMA.md)
Closes #946.

## Why Factories?

Before this PR every test hand-built participants, waste items, incentives and
transfers inline, leading to:

- Inconsistent field values across tests (different coordinate defaults, different weights)
- Boilerplate duplication that made tests hard to read
- Brittle setup that broke whenever a function signature changed

The factories in `stellar-contract/tests/factories.rs` solve all three problems.

---

## Quick-start

```rust
// At the top of your test file:
mod factories;
use factories::*;

#[test]
fn my_test() {
    let env = Env::default();
    let (client, admin, recycler, collector, manufacturer) = setup_full_env(&env);

    let waste_id  = WasteFactory::plastic(&env, &client, &recycler);
    let incentive = IncentiveFactory::plastic(&env, &client, &manufacturer);
    TransferFactory::transfer(&client, waste_id, &recycler, &collector);
}
```

---

## Reference

### Environment helpers

| Function | Description |
|---|---|
| `make_client(env)` | Register contract, enable `mock_all_auths`, return client |
| `make_client_no_auth(env)` | Register contract without calling `mock_all_auths` |
| `setup_full_env(env)` | Full setup: client + admin + recycler + collector + manufacturer |

### `ParticipantFactory`

| Method | Description |
|---|---|
| `recycler(env, client)` | Register and return a Recycler address |
| `collector(env, client)` | Register and return a Collector address |
| `manufacturer(env, client)` | Register and return a Manufacturer address |
| `with_role(env, client, role)` | Register with any role |
| `with_location(env, client, role, lat, lon)` | Register with a specific location |

All methods generate a unique `Address` via `Address::generate(env)`.

### `WasteFactory`

| Method | Description |
|---|---|
| `plastic(env, client, owner)` | Submit 1 000 g of Plastic, return waste ID |
| `metal(env, client, owner)` | Submit 1 000 g of Metal, return waste ID |
| `glass(env, client, owner)` | Submit 1 000 g of Glass, return waste ID |
| `paper(env, client, owner)` | Submit 1 000 g of Paper, return waste ID |
| `electronics(env, client, owner)` | Submit 1 000 g of Electronics, return waste ID |
| `with_type(env, client, owner, waste_type, weight)` | Custom type and weight |
| `with_location(env, client, owner, type, weight, lat, lon)` | Custom location |

All methods return `u128` waste IDs (matching the contract's internal type).

### `IncentiveFactory`

| Method | Description |
|---|---|
| `plastic(env, client, manufacturer)` | Plastic incentive, 100 reward, 1 000 budget |
| `metal(env, client, manufacturer)` | Metal incentive, 200 reward, 2 000 budget |
| `with_params(env, client, mfr, type, reward, budget)` | Fully custom |

All methods return `u64` incentive IDs.

### `TransferFactory`

| Method | Description |
|---|---|
| `transfer(client, waste_id, from, to)` | Transfer at (0, 0) |
| `transfer_at(client, waste_id, from, to, lat, lon)` | Transfer at a specific location |

---

## Adoption checklist

When writing a new test:

1. Call `setup_full_env(&env)` instead of copy-pasting the setup block.
2. Create waste via `WasteFactory::<type>()` instead of calling `recycle_waste` directly.
3. Create incentives via `IncentiveFactory::with_params()`.
4. Transfer waste via `TransferFactory::transfer()`.

---

## Running the factory tests

```bash
cargo test -p stellar-scavngr-contract factory
```
