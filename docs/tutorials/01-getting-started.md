# Tutorial 01 — Getting Started with Scavenger Contracts

**Level:** Beginner
**Time:** ~30 minutes
**Goal:** Set up a local environment, write your first Soroban contract function, and deploy it to testnet.

---

## What You Will Build

A minimal `WasteRegistry` contract that:
- Stores a waste record on-chain
- Returns it by ID
- Emits an event on creation

---

## 1. Project Setup

The Scavenger contract lives in `stellar-contract/`. Open `Cargo.toml` and verify the Soroban SDK version:

```toml
[dependencies]
soroban-sdk = { version = "20", features = ["testutils"] }
```

The `testutils` feature enables the in-process test environment. Never enable it in production WASM builds — the workspace handles this via feature flags.

---

## 2. Contract Entry Point

Every Soroban contract is a Rust struct annotated with `#[contract]`. Open `stellar-contract/src/lib.rs`:

```rust
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, Symbol, symbol_short};

#[contracttype]
#[derive(Clone)]
pub struct WasteRecord {
    pub id: Symbol,
    pub weight: u64,
    pub owner: Address,
}

#[contract]
pub struct WasteRegistry;

#[contractimpl]
impl WasteRegistry {
    /// Store a new waste record. Emits `waste_created` event.
    pub fn register_waste(env: Env, id: Symbol, weight: u64, owner: Address) {
        owner.require_auth();

        let key = (symbol_short!("waste"), id.clone());
        env.storage().persistent().set(&key, &WasteRecord {
            id: id.clone(),
            weight,
            owner: owner.clone(),
        });

        env.events().publish(
            (symbol_short!("waste"), symbol_short!("created")),
            (id, weight, owner),
        );
    }

    /// Retrieve a waste record by ID. Returns None if not found.
    pub fn get_waste(env: Env, id: Symbol) -> Option<WasteRecord> {
        let key = (symbol_short!("waste"), id);
        env.storage().persistent().get(&key)
    }
}
```

**Key concepts:**
- `#[contracttype]` — marks structs that can be stored on-chain (must implement `Clone`)
- `env.storage().persistent()` — data survives across transactions
- `owner.require_auth()` — asserts the transaction was signed by `owner`
- `env.events().publish()` — emits an indexed event

---

## 3. Write Tests

Soroban's `testutils` feature gives you an in-process environment that mimics the real network. Add a test module in `stellar-contract/src/lib.rs`:

```rust
#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Env};

    fn setup() -> (Env, WasteRegistryClient<'static>) {
        let env = Env::default();
        let contract_id = env.register_contract(None, WasteRegistry);
        let client = WasteRegistryClient::new(&env, &contract_id);
        (env, client)
    }

    #[test]
    fn tutorial_01_register_and_get() {
        let (env, client) = setup();
        let owner = Address::generate(&env);
        let id = soroban_sdk::symbol_short!("waste1");

        env.mock_all_auths();
        client.register_waste(&id, &500u64, &owner);

        let record = client.get_waste(&id).expect("record should exist");
        assert_eq!(record.weight, 500);
        assert_eq!(record.owner, owner);
    }

    #[test]
    fn tutorial_01_get_missing_returns_none() {
        let (env, client) = setup();
        let id = soroban_sdk::symbol_short!("nope");
        assert!(client.get_waste(&id).is_none());
    }
}
```

Run the tests:

```bash
cd stellar-contract
cargo test tutorial_01
```

Expected output:

```
test test::tutorial_01_register_and_get ... ok
test test::tutorial_01_get_missing_returns_none ... ok
```

---

## 4. Build the WASM

```bash
stellar contract build
```

The compiled WASM is written to `target/wasm32-unknown-unknown/release/scavenger_contract.wasm`.

---

## 5. Deploy to Testnet

```bash
# Deploy
CONTRACT_ID=$(stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/scavenger_contract.wasm \
  --source dev-key \
  --network testnet)

echo "Deployed at: $CONTRACT_ID"
```

---

## 6. Invoke from CLI

```bash
# Register a waste record
stellar contract invoke \
  --id "$CONTRACT_ID" \
  --source dev-key \
  --network testnet \
  -- register_waste \
  --id waste1 \
  --weight 1000 \
  --owner $(soroban keys address dev-key)

# Fetch it back
stellar contract invoke \
  --id "$CONTRACT_ID" \
  --source dev-key \
  --network testnet \
  -- get_waste \
  --id waste1
```

---

## Checkpoint

Verify your implementation:
- [ ] `cargo test tutorial_01` passes with no errors
- [ ] Contract builds without warnings
- [ ] `get_waste` returns `None` for an ID that was never registered
- [ ] Testnet deploy succeeds and `get_waste` returns the stored record

---

## Next Steps

Continue to [Tutorial 02 — Intermediate Contracts](./02-intermediate-contracts.md) to add role-based access control and contract events.
