# Flaky Test Analysis & Stabilization

Closes #947.

## Root causes of flakiness in this codebase

### 1. Missing `env.mock_all_auths()`

**Symptom:** Test passes locally with certain feature flags, fails on CI.

**Cause:** Every contract function that calls `address.require_auth()` panics
unless the test environment is told to accept all auth requests. When tests
omitted `env.mock_all_auths()` the panic was non-deterministic depending on
build configuration.

**Fix:** Call `env.mock_all_auths()` at the top of every test (or in the
shared `setup()` helper) before any contract call.

```rust
// ✗ Flaky — may panic depending on build flags
let contract_id = env.register_contract(None, ScavengerContract);

// ✓ Stable — always mocks auth
env.mock_all_auths();
let contract_id = env.register_contract(None, ScavengerContract);
```

---

### 2. Shared `Env` / `ScavengerContractClient` between tests

**Symptom:** Tests pass alone, fail when the full suite runs in parallel.

**Cause:** Rust test runner executes tests in parallel by default. If two tests
share the same `Env` they mutate the same contract storage concurrently,
producing race conditions.

**Fix:** Each test must create its own `Env::default()` and register its own
contract instance.

```rust
// ✗ Flaky — shared state
static CLIENT: Lazy<ScavengerContractClient> = ...;

// ✓ Stable — isolated per test
#[test]
fn my_test() {
    let env = Env::default();   // fresh every time
    let (client, ..) = setup(&env);
}
```

---

### 3. Non-deterministic ordering of unordered collections

**Symptom:** Assertion on element position in a returned `Vec` fails
intermittently.

**Cause:** Some tests asserted `history.get(0) == foo` after operations whose
order was not guaranteed. Soroban `Vec` is insertion-ordered, but if the order
of insertions depended on iteration over a host-side `HashMap` the positions
were non-deterministic.

**Fix:** Assert on counts and set membership rather than absolute positions, or
sort before comparing.

```rust
// ✗ Flaky — position may vary
assert_eq!(history.get(0).unwrap().to, collector);

// ✓ Stable — assert count first, then check the record explicitly
assert_eq!(history.len(), 1);
assert_eq!(history.get(0).unwrap().to, collector);
// (acceptable when the test controls insertion order)
```

---

### 4. Wall-clock / ledger timestamp dependence

**Symptom:** Time-sensitive tests fail on slow CI runners or when parallelism
delays execution.

**Cause:** Tests that relied on `env.ledger().timestamp()` advancing
automatically between calls saw different values across environments.

**Fix:** Set ledger time explicitly when the test is time-sensitive.

```rust
// ✓ Stable — ledger time is deterministic
env.ledger().with_mut(|l| l.timestamp = 1_000_000);
```

---

## Stabilized test file

`stellar-contract/tests/stable_suite.rs` — 15 tests, each:

- Owns a private `Env::default()`
- Calls `env.mock_all_auths()` before any contract call
- Makes only deterministic assertions
- Leaves no visible side-effects

---

## Running the suite 10 times to verify stability

```bash
for i in $(seq 10); do
  echo "=== Run $i ==="
  cargo test -p stellar-scavngr-contract 2>&1 | tail -5
done
```

All 10 runs should show `test result: ok`.

---

## Checklist when writing new tests

- [ ] `Env::default()` created inside the test function (not shared)
- [ ] `env.mock_all_auths()` called before the first contract call
- [ ] Assertions use counts or sorted comparisons, not raw index positions
- [ ] No reliance on `std::time`, wall-clock, or un-seeded random

---

## Current Status — Issue #1524

**Audit date:** 2026-10-19

### Rust / Soroban contract tests

All four root causes documented above have been fixed in
`stellar-contract/tests/stable_suite.rs`:

| Root cause | Fixed? | Notes |
| :--- | :--- | :--- |
| Missing `env.mock_all_auths()` | ✅ | `setup()` always calls this first |
| Shared `Env` / client between tests | ✅ | Each test owns `Env::default()` |
| Non-deterministic collection order | ✅ | Assertions use counts, not positions |
| Wall-clock / ledger time dependence | ✅ | Ledger time set explicitly when needed |

### Frontend tests

No intermittently-failing (flaky) frontend tests were found in the current
codebase. All frontend tests in `frontend/src/` avoid fixed `setTimeout` waits
and use synchronous or MSW-mocked I/O.

### Process for newly discovered flaky tests

See the quarantine process in `docs/TESTING_GUIDE.md` (section **Quarantining a
Test**). In short:

1. Open a GitHub issue describing the flakiness.
2. Replace real timers with `vi.useFakeTimers()` and `vi.advanceTimersByTime()`.
3. Delete tests that duplicate a stronger unit test.
4. If the test cannot be fixed immediately, annotate with a reason and issue
   reference rather than leaving it unannotated.
