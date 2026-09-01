# Tutorial 03 — Advanced Patterns

**Level:** Advanced
**Time:** ~60 minutes
**Goal:** Implement cross-contract calls, gas-aware storage design, re-entrancy guards, and property-based testing.

**Prerequisite:** Complete [Tutorial 02](./02-intermediate-contracts.md).

---

## What You Will Build

- A `IncentiveContract` that calls into `WasteRegistry` to verify records before distributing token rewards
- A re-entrancy guard trait
- Gas-efficient storage patterns (instance vs persistent vs temporary)
- Property-based tests using `proptest`

---

## 1. Cross-Contract Calls

Define the interface for `WasteRegistry` that `IncentiveContract` will call at runtime:

```rust
use soroban_sdk::{contractclient, Address, Env, Symbol};

#[contractclient(name = "WasteRegistryClient")]
pub trait WasteRegistryInterface {
    fn get_waste(env: Env, id: Symbol) -> Option<WasteRecord>;
}
```

Then invoke it from `IncentiveContract`:

```rust
use soroban_sdk::{contract, contractimpl, token, Address, Env, Symbol};

#[contract]
pub struct IncentiveContract;

#[contractimpl]
impl IncentiveContract {
    /// Distribute token rewards for a confirmed waste record.
    pub fn claim_reward(
        env: Env,
        claimant: Address,
        waste_id: Symbol,
        registry_id: Address,
        token_id: Address,
    ) {
        claimant.require_auth();

        // Cross-contract call — read the record from WasteRegistry
        let registry = WasteRegistryClient::new(&env, &registry_id);
        let record = registry.get_waste(&waste_id)
            .expect("waste record not found");

        if record.owner != claimant {
            panic!("claimant is not the waste owner");
        }
        if record.status != WasteStatus::Confirmed {
            panic!("waste must be confirmed before claiming reward");
        }

        // Reward: 1 token per kg (weight is in grams)
        let reward_amount = (record.weight / 1000) as i128;
        if reward_amount == 0 {
            panic!("waste too light for a reward");
        }

        let token = token::Client::new(&env, &token_id);
        token.transfer(&env.current_contract_address(), &claimant, &reward_amount);

        env.events().publish(
            (soroban_sdk::symbol_short!("reward"), soroban_sdk::symbol_short!("paid")),
            (claimant, waste_id, reward_amount),
        );
    }
}
```

---

## 2. Re-entrancy Guard

Soroban's execution model prevents classic re-entrancy at the VM level, but defence-in-depth is still valuable for complex multi-call flows. Implement a guard in `instance` storage:

```rust
const LOCK_KEY: &str = "lock";

fn acquire_lock(env: &Env) {
    if env.storage().instance().has(&soroban_sdk::symbol_short!("lock")) {
        panic!("re-entrancy detected");
    }
    env.storage().instance().set(&soroban_sdk::symbol_short!("lock"), &true);
}

fn release_lock(env: &Env) {
    env.storage().instance().remove(&soroban_sdk::symbol_short!("lock"));
}
```

Wrap any function that makes external calls:

```rust
pub fn claim_reward(env: Env, /* ... */) {
    acquire_lock(&env);
    // ... claim logic ...
    release_lock(&env);
}
```

---

## 3. Storage Tier Selection

Choosing the wrong storage tier wastes fees. Use this decision table:

| Data | Tier | Reason |
|------|------|--------|
| Admin address | `instance` | One per contract, read often |
| Participant approval map | `persistent` | Long-lived, sized by participant count |
| Individual waste records | `persistent` | Long-lived, keyed by ID |
| Re-entrancy lock | `instance` | Single boolean, per-contract |
| Per-transaction nonce | `temporary` | Valid only within a ledger |
| Aggregated stats cache | `temporary` | Rebuilt on miss, no archive needed |

Extend TTLs for long-lived data to avoid ledger entry expiry:

```rust
const LEDGER_MONTH: u32 = 30 * 24 * 60 * 12; // ~1 month in ledgers

env.storage().persistent().extend_ttl(
    &key,
    LEDGER_MONTH,
    LEDGER_MONTH * 2,
);
```

---

## 4. Property-Based Testing with proptest

Add `proptest` to `stellar-contract/Cargo.toml` dev-dependencies:

```toml
[dev-dependencies]
proptest = "1"
```

Test that reward calculation never overflows for valid weight inputs:

```rust
#[cfg(test)]
mod prop_tests {
    use proptest::prelude::*;

    proptest! {
        #[test]
        fn tutorial_03_reward_never_overflows(weight in 0u64..=1_000_000_000u64) {
            let reward = (weight / 1000) as i128;
            prop_assert!(reward >= 0);
            prop_assert!(reward <= i128::MAX);
        }

        #[test]
        fn tutorial_03_zero_weight_gives_zero_reward(weight in 0u64..999u64) {
            let reward = (weight / 1000) as i128;
            prop_assert_eq!(reward, 0);
        }
    }
}
```

```bash
cargo test tutorial_03
```

---

## 5. Security Checklist

Before deploying an advanced contract, verify:

- [ ] **Authentication** — every mutating function calls `address.require_auth()` for the relevant signer
- [ ] **Overflow** — arithmetic on `u128`/`i128` uses checked ops or saturating arithmetic when possible
- [ ] **Integer division** — `weight / 1000` truncates; document this rounding behaviour
- [ ] **Cross-contract trust** — validate all data returned from external contracts; never assume a result is safe
- [ ] **Upgrade gate** — `upgrade` is behind admin auth, tested in CI
- [ ] **Storage TTL** — persistent entries have `extend_ttl` calls for long-lived data
- [ ] **Event coverage** — every state change emits a typed event for indexers

---

## 6. Gas Profiling

Use the Stellar CLI gas estimator to check resource consumption before deploying:

```bash
stellar contract invoke \
  --id "$CONTRACT_ID" \
  --source dev-key \
  --network testnet \
  --fee 1000000 \
  -- claim_reward \
  --claimant $(soroban keys address dev-key) \
  --waste_id waste1 \
  --registry_id "$REGISTRY_ID" \
  --token_id "$TOKEN_ID"
```

Observe the `fee_charged` in the transaction result and reduce it by:
1. Batching storage reads with `get_or_default` helpers
2. Prefetching known keys at function start
3. Using `temporary` storage for ephemeral data

---

## Checkpoint

- [ ] `claim_reward` succeeds for confirmed waste owned by the claimant
- [ ] `claim_reward` panics when waste is not confirmed
- [ ] `claim_reward` panics when the claimant is not the waste owner
- [ ] Proptest suite passes 1000 randomised cases
- [ ] Re-entrancy guard panics on a simulated double-enter
- [ ] Gas estimate is under the testnet fee budget

---

## Next Steps

Work through the hands-on challenges in [Tutorial 04 — Practice Exercises](./04-practice-exercises.md).
