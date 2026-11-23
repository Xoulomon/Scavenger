# Tutorial 04 — Practice Exercises

Work through these exercises to reinforce the concepts from Tutorials 01–03. Each exercise has a clear pass criterion and hints. Solutions are in [Tutorial 05](./05-solutions.md).

---

## Exercise 1 — Weight Validation (Beginner)

**Context:** The `register_waste` function currently accepts any `weight` value, including `0`.

**Task:** Add validation that:

1. Rejects `weight == 0`
2. Rejects `weight > 1_000_000_000` (1 billion grams max)
3. Returns a meaningful error message for each case

**Tests to write:**

```rust
#[test]
fn ex1_zero_weight_is_rejected() { /* ... */ }

#[test]
fn ex1_max_weight_is_accepted() { /* ... */ }

#[test]
fn ex1_over_max_weight_is_rejected() { /* ... */ }
```

**Pass criterion:** All three tests pass with `cargo test ex1`.

**Hint:** Use `if weight == 0 { panic!("...") }` — Soroban panics abort the transaction and return an error to the caller.

---

## Exercise 2 — Batch Registration (Intermediate)

**Context:** The REST API sends multiple waste records in a single request. Calling `register_waste` once per record is expensive in fees.

**Task:** Implement a `register_wastes_batch` function that:

1. Accepts a `Vec<(Symbol, u64)>` of `(id, weight)` pairs
2. Requires the caller to be an approved participant
3. Registers all records atomically (all succeed or all fail)
4. Emits a single `batch_registered` event containing the count

**Tests to write:**

```rust
#[test]
fn ex2_batch_of_three_creates_three_records() { /* ... */ }

#[test]
fn ex2_empty_batch_is_rejected() { /* ... */ }

#[test]
fn ex2_unapproved_batch_is_rejected() { /* ... */ }
```

**Pass criterion:** All three tests pass with `cargo test ex2`.

**Hint:** Soroban `Vec` in contract arguments maps to `soroban_sdk::Vec<T>`, not the standard `std::vec::Vec`.

---

## Exercise 3 — Expiry Mechanism (Intermediate)

**Context:** Waste records should expire if not confirmed within 30 ledgers of creation.

**Task:**

1. Add a `created_ledger: u32` field to `WasteRecord`, set to `env.ledger().sequence()` on creation
2. Modify `confirm_waste` to panic if the current ledger is more than 30 ahead of `created_ledger`
3. Add a `is_expired` view function that returns `bool`

**Tests to write:**

```rust
#[test]
fn ex3_fresh_record_is_not_expired() { /* ... */ }

#[test]
fn ex3_confirmation_after_30_ledgers_fails() { /* ... */ }
```

**Pass criterion:** Both tests pass with `cargo test ex3`.

**Hint:** Advance the test environment's ledger sequence with `env.ledger().with_mut(|l| l.sequence_number += 31)`.

---

## Exercise 4 — Charity Split (Advanced)

**Context:** The Scavenger protocol donates a percentage of rewards to a configured charity address.

**Task:**

1. Add a `set_charity` admin function that stores a `(Address, u32)` tuple for `(charity_address, bps)` (basis points, 1 bps = 0.01 %)
2. Modify `claim_reward` to split the reward: `owner_amount = reward * (10000 - bps) / 10000`, `charity_amount = reward - owner_amount`
3. Transfer both amounts in the same transaction
4. Emit a `charity_donation` event

**Tests to write:**

```rust
#[test]
fn ex4_500_bps_gives_5_percent_to_charity() { /* ... */ }

#[test]
fn ex4_zero_bps_gives_all_to_owner() { /* ... */ }

#[test]
fn ex4_bps_over_10000_is_rejected() { /* ... */ }
```

**Pass criterion:** All three tests pass with `cargo test ex4`.

---

## Exercise 5 — Error Enum (Advanced)

**Context:** The current implementation uses `panic!(&str)` for errors. This makes it hard for callers to distinguish error types.

**Task:**

1. Define a `ContractError` enum using `#[contracterror]` with variants:
   - `NotInitialized = 1`
   - `AlreadyInitialized = 2`
   - `NotApproved = 3`
   - `WasteNotFound = 4`
   - `AlreadyConfirmed = 5`
   - `InvalidWeight = 6`
   - `Expired = 7`
   - `ChaosBpsOutOfRange = 8`
2. Replace all `panic!` calls with `Err(ContractError::Variant)` returns (change return types to `Result<_, ContractError>`)
3. Update all existing tests to use `expect_err` where appropriate

**Tests to write:**

```rust
#[test]
fn ex5_invalid_weight_returns_correct_error_code() { /* ... */ }

#[test]
fn ex5_double_confirm_returns_already_confirmed() { /* ... */ }
```

**Pass criterion:** All tests pass. `ContractError::InvalidWeight` is surfaced as error code `6` in the transaction result.

**Hint:** `#[contracterror]` requires `#[derive(Copy, Clone, Debug, PartialEq)]` and the variants must be assigned explicit `u32` discriminants.

---

## General Guidelines

- Write failing tests first, then make them pass
- Run `cargo clippy` after each exercise and fix all warnings
- Check `cargo test` output includes only your target prefix to avoid noise from other exercises
- Do not look at the solution guide until you have a working implementation or are genuinely stuck
