# Tutorial 02 — Intermediate Contracts

**Level:** Intermediate
**Time:** ~45 minutes
**Goal:** Add role-based access control, contract upgrade support, and multi-field storage to the waste registry from Tutorial 01.

**Prerequisite:** Complete [Tutorial 01](./01-getting-started.md).

---

## What You Will Build

Extend the `WasteRegistry` contract with:
- Admin initialization (single owner with elevated privileges)
- Role-gated functions (`register_waste` restricted to verified participants)
- Contract upgrade via WASM hash replacement
- Event-driven status transitions

---

## 1. Admin Initialization Pattern

Most Scavenger contracts use a one-time initialization pattern. The admin address is stored in `instance` storage (lives as long as the contract) and can only be set once:

```rust
use soroban_sdk::{contract, contractimpl, Address, Env, symbol_short};

const ADMIN_KEY: &str = "admin";

#[contractimpl]
impl WasteRegistry {
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&symbol_short!("admin")) {
            panic!("already initialized");
        }
        env.storage().instance()
            .set(&symbol_short!("admin"), &admin);
    }

    fn require_admin(env: &Env) -> Address {
        let admin: Address = env.storage().instance()
            .get(&symbol_short!("admin"))
            .expect("not initialized");
        admin.require_auth();
        admin
    }
}
```

**Why `instance` storage?**
Instance data persists for the lifetime of the contract and is cheaper to read than `persistent` data for frequently-accessed values like the admin address.

---

## 2. Participant Registry

Add a map of approved participants before allowing waste registration:

```rust
use soroban_sdk::{map, Map, Symbol};

#[contractimpl]
impl WasteRegistry {
    /// Admin-only: approve a participant address.
    pub fn approve_participant(env: Env, participant: Address) {
        Self::require_admin(&env);

        let mut participants: Map<Address, bool> = env
            .storage()
            .persistent()
            .get(&symbol_short!("parts"))
            .unwrap_or(map![&env]);

        participants.set(participant.clone(), true);
        env.storage().persistent().set(&symbol_short!("parts"), &participants);

        env.events().publish(
            (symbol_short!("part"), symbol_short!("added")),
            participant,
        );
    }

    fn is_approved(env: &Env, address: &Address) -> bool {
        let participants: Map<Address, bool> = env
            .storage()
            .persistent()
            .get(&symbol_short!("parts"))
            .unwrap_or(map![env]);
        participants.get(address.clone()).unwrap_or(false)
    }
}
```

Now gate `register_waste`:

```rust
pub fn register_waste(env: Env, id: Symbol, weight: u64, owner: Address) {
    owner.require_auth();

    if !Self::is_approved(&env, &owner) {
        panic!("participant not approved");
    }

    // ... existing storage + event logic
}
```

---

## 3. Status Transitions

Track waste through a lifecycle:

```rust
#[contracttype]
#[derive(Clone, PartialEq)]
pub enum WasteStatus {
    Pending,
    Confirmed,
    Recycled,
}

#[contracttype]
#[derive(Clone)]
pub struct WasteRecord {
    pub id: Symbol,
    pub weight: u64,
    pub owner: Address,
    pub status: WasteStatus,
}

#[contractimpl]
impl WasteRegistry {
    pub fn confirm_waste(env: Env, id: Symbol, confirmer: Address) {
        confirmer.require_auth();
        Self::require_admin(&env);  // only admin can confirm

        let key = (symbol_short!("waste"), id.clone());
        let mut record: WasteRecord = env.storage().persistent()
            .get(&key)
            .expect("waste not found");

        if record.status != WasteStatus::Pending {
            panic!("waste already confirmed");
        }

        record.status = WasteStatus::Confirmed;
        env.storage().persistent().set(&key, &record);

        env.events().publish(
            (symbol_short!("waste"), symbol_short!("confirmed")),
            id,
        );
    }
}
```

---

## 4. Contract Upgrades

Soroban supports upgrading the WASM hash in-place. Add an upgrade function gated behind `require_admin`:

```rust
use soroban_sdk::BytesN;

#[contractimpl]
impl WasteRegistry {
    pub fn upgrade(env: Env, new_wasm_hash: BytesN<32>) {
        Self::require_admin(&env);
        env.deployer().update_current_contract_wasm(new_wasm_hash);
    }
}
```

Upgrade workflow on testnet:

```bash
# Build the new version
stellar contract build

# Upload new WASM (returns hash)
NEW_HASH=$(stellar contract upload \
  --wasm target/wasm32-unknown-unknown/release/scavenger_contract.wasm \
  --source dev-key \
  --network testnet)

# Invoke the upgrade function
stellar contract invoke \
  --id "$CONTRACT_ID" \
  --source dev-key \
  --network testnet \
  -- upgrade \
  --new_wasm_hash "$NEW_HASH"
```

---

## 5. Tests

```rust
#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Env};

    fn setup() -> (Env, WasteRegistryClient<'static>, Address) {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, WasteRegistry);
        let client = WasteRegistryClient::new(&env, &contract_id);
        let admin = Address::generate(&env);
        client.initialize(&admin);
        (env, client, admin)
    }

    #[test]
    fn tutorial_02_only_approved_can_register() {
        let (env, client, _admin) = setup();
        let unapproved = Address::generate(&env);
        let id = soroban_sdk::symbol_short!("w1");

        let result = std::panic::catch_unwind(|| {
            client.register_waste(&id, &100u64, &unapproved);
        });
        assert!(result.is_err(), "unapproved participant must be rejected");
    }

    #[test]
    fn tutorial_02_approve_then_register() {
        let (env, client, _admin) = setup();
        let participant = Address::generate(&env);
        let id = soroban_sdk::symbol_short!("w2");

        client.approve_participant(&participant);
        client.register_waste(&id, &250u64, &participant);

        let record = client.get_waste(&id).unwrap();
        assert_eq!(record.status, WasteStatus::Pending);
    }

    #[test]
    fn tutorial_02_confirm_transitions_status() {
        let (env, client, admin) = setup();
        let participant = Address::generate(&env);
        let id = soroban_sdk::symbol_short!("w3");

        client.approve_participant(&participant);
        client.register_waste(&id, &500u64, &participant);
        client.confirm_waste(&id, &admin);

        let record = client.get_waste(&id).unwrap();
        assert_eq!(record.status, WasteStatus::Confirmed);
    }
}
```

```bash
cargo test tutorial_02
```

---

## Checkpoint

- [ ] `initialize` panics on a second call
- [ ] `register_waste` panics when caller is not approved
- [ ] `confirm_waste` changes status from `Pending` to `Confirmed`
- [ ] `confirm_waste` panics if called again on an already-confirmed record
- [ ] `upgrade` can only be called by the admin

---

## Next Steps

Continue to [Tutorial 03 — Advanced Patterns](./03-advanced-patterns.md) to explore cross-contract calls, security hardening, and gas optimisation.
