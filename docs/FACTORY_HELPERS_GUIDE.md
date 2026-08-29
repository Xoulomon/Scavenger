# Factory Helpers Guide

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
