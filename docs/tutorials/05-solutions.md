# Tutorial 05 — Solution Guide

Worked solutions for [Tutorial 04 — Practice Exercises](./04-practice-exercises.md).

Read the exercise first, attempt it yourself, then use this guide to compare approaches or unblock a stuck implementation.

---

## Exercise 1 — Weight Validation

```rust
pub fn register_waste(env: Env, id: Symbol, weight: u64, owner: Address) {
    owner.require_auth();

    if weight == 0 {
        panic!("weight must be greater than zero");
    }
    if weight > 1_000_000_000 {
        panic!("weight exceeds maximum of 1,000,000,000 grams");
    }

    if !Self::is_approved(&env, &owner) {
        panic!("participant not approved");
    }

    let key = (symbol_short!("waste"), id.clone());
    env.storage().persistent().set(&key, &WasteRecord {
        id: id.clone(),
        weight,
        owner: owner.clone(),
        status: WasteStatus::Pending,
        created_ledger: env.ledger().sequence(),
    });

    env.events().publish(
        (symbol_short!("waste"), symbol_short!("created")),
        (id, weight, owner),
    );
}

#[cfg(test)]
mod ex1_tests {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Env};

    #[test]
    fn ex1_zero_weight_is_rejected() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, WasteRegistry);
        let client = WasteRegistryClient::new(&env, &contract_id);
        let admin = Address::generate(&env);
        let participant = Address::generate(&env);
        client.initialize(&admin);
        client.approve_participant(&participant);

        let result = std::panic::catch_unwind(|| {
            client.register_waste(&symbol_short!("w"), &0u64, &participant);
        });
        assert!(result.is_err());
    }

    #[test]
    fn ex1_max_weight_is_accepted() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, WasteRegistry);
        let client = WasteRegistryClient::new(&env, &contract_id);
        let admin = Address::generate(&env);
        let participant = Address::generate(&env);
        client.initialize(&admin);
        client.approve_participant(&participant);
        client.register_waste(&symbol_short!("w"), &1_000_000_000u64, &participant);
        assert!(client.get_waste(&symbol_short!("w")).is_some());
    }

    #[test]
    fn ex1_over_max_weight_is_rejected() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, WasteRegistry);
        let client = WasteRegistryClient::new(&env, &contract_id);
        let admin = Address::generate(&env);
        let participant = Address::generate(&env);
        client.initialize(&admin);
        client.approve_participant(&participant);

        let result = std::panic::catch_unwind(|| {
            client.register_waste(&symbol_short!("w"), &1_000_000_001u64, &participant);
        });
        assert!(result.is_err());
    }
}
```

---

## Exercise 2 — Batch Registration

```rust
use soroban_sdk::Vec as SoroVec;

pub fn register_wastes_batch(
    env: Env,
    records: SoroVec<(Symbol, u64)>,
    owner: Address,
) {
    owner.require_auth();

    if records.is_empty() {
        panic!("batch must contain at least one record");
    }
    if !Self::is_approved(&env, &owner) {
        panic!("participant not approved");
    }

    let count = records.len();
    for (id, weight) in records.iter() {
        let key = (symbol_short!("waste"), id.clone());
        env.storage().persistent().set(&key, &WasteRecord {
            id: id.clone(),
            weight,
            owner: owner.clone(),
            status: WasteStatus::Pending,
            created_ledger: env.ledger().sequence(),
        });
    }

    env.events().publish(
        (symbol_short!("waste"), symbol_short!("batch")),
        (owner, count),
    );
}
```

**Why atomicity is free:** Soroban transaction execution is atomic by design. If any `panic!` fires during the loop, all storage writes in that transaction are rolled back automatically.

---

## Exercise 3 — Expiry Mechanism

```rust
const EXPIRY_LEDGERS: u32 = 30;

pub fn is_expired(env: Env, id: Symbol) -> bool {
    let key = (symbol_short!("waste"), id);
    let record: WasteRecord = match env.storage().persistent().get(&key) {
        Some(r) => r,
        None => return false,
    };
    env.ledger().sequence() > record.created_ledger + EXPIRY_LEDGERS
}

pub fn confirm_waste(env: Env, id: Symbol, confirmer: Address) {
    confirmer.require_auth();
    Self::require_admin(&env);

    let key = (symbol_short!("waste"), id.clone());
    let mut record: WasteRecord = env.storage().persistent()
        .get(&key)
        .expect("waste not found");

    if record.status != WasteStatus::Pending {
        panic!("waste already confirmed");
    }
    if env.ledger().sequence() > record.created_ledger + EXPIRY_LEDGERS {
        panic!("waste record has expired");
    }

    record.status = WasteStatus::Confirmed;
    env.storage().persistent().set(&key, &record);
    env.events().publish(
        (symbol_short!("waste"), symbol_short!("confirmed")),
        id,
    );
}
```

Test ledger advancement:

```rust
#[test]
fn ex3_confirmation_after_30_ledgers_fails() {
    let env = Env::default();
    env.mock_all_auths();
    // ... setup ...
    client.register_waste(&id, &500u64, &participant);

    env.ledger().with_mut(|l| l.sequence_number += 31);

    let result = std::panic::catch_unwind(|| client.confirm_waste(&id, &admin));
    assert!(result.is_err());
}
```

---

## Exercise 4 — Charity Split

```rust
const CHARITY_KEY: &str = "charity";

pub fn set_charity(env: Env, charity_address: Address, bps: u32) {
    Self::require_admin(&env);
    if bps > 10_000 {
        panic!("basis points must be <= 10000");
    }
    env.storage().instance()
        .set(&symbol_short!("charity"), &(charity_address, bps));
}

// Inside claim_reward, replace single transfer with:
let (charity_addr, bps): (Address, u32) = env.storage().instance()
    .get(&symbol_short!("charity"))
    .unwrap_or((env.current_contract_address(), 0));

let charity_amount = reward_amount * bps as i128 / 10_000;
let owner_amount = reward_amount - charity_amount;

let token = token::Client::new(&env, &token_id);
token.transfer(&env.current_contract_address(), &claimant, &owner_amount);
if charity_amount > 0 {
    token.transfer(&env.current_contract_address(), &charity_addr, &charity_amount);
    env.events().publish(
        (symbol_short!("charity"), symbol_short!("donated")),
        (charity_addr, charity_amount),
    );
}
```

---

## Exercise 5 — Error Enum

```rust
use soroban_sdk::contracterror;

#[contracterror]
#[derive(Copy, Clone, Debug, PartialEq)]
pub enum ContractError {
    NotInitialized     = 1,
    AlreadyInitialized = 2,
    NotApproved        = 3,
    WasteNotFound      = 4,
    AlreadyConfirmed   = 5,
    InvalidWeight      = 6,
    Expired            = 7,
    BpsOutOfRange      = 8,
}
```

Change `register_waste` return type:

```rust
pub fn register_waste(
    env: Env,
    id: Symbol,
    weight: u64,
    owner: Address,
) -> Result<(), ContractError> {
    owner.require_auth();

    if weight == 0 || weight > 1_000_000_000 {
        return Err(ContractError::InvalidWeight);
    }
    if !Self::is_approved(&env, &owner) {
        return Err(ContractError::NotApproved);
    }
    // ... storage write ...
    Ok(())
}
```

Updated test:

```rust
#[test]
fn ex5_invalid_weight_returns_correct_error_code() {
    // ...setup...
    let err = client.try_register_waste(&id, &0u64, &participant)
        .expect_err("should fail");
    assert_eq!(err.unwrap(), ContractError::InvalidWeight);
}
```

The `try_` prefix is generated automatically by `#[contractclient]` — it returns `Result<T, ContractError>` instead of panicking.

---

## Key Takeaways

| Pattern                | Lesson                                                                                         |
| ---------------------- | ---------------------------------------------------------------------------------------------- |
| Explicit weight bounds | Always validate numeric inputs at the contract boundary                                        |
| Atomic batches         | Soroban transactions are all-or-nothing; use this as a feature                                 |
| Ledger-relative expiry | Avoid wall-clock time in contracts; ledger sequences are deterministic                         |
| Basis-point arithmetic | Always check `bps <= 10000`; integer division truncates toward zero                            |
| `#[contracterror]`     | Typed errors give callers machine-readable codes; prefer over `panic!` in production contracts |
