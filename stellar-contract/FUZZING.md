# Contract Fuzzing Suite

## Approach

The contract uses two complementary fuzzing approaches:

1. **proptest-based fuzzing** for unit-test-level fuzz targets within the contract test suite
2. **cargo-fuzz / libFuzzer** for integration-level fuzzing of public entry-point input deserialization

Since Soroban contracts target `no_std`/WASM, proptest generates randomized inputs and shrinks failing cases to minimal reproductions. The cargo-fuzz harness uses `libfuzzer-sys` to fuzz the deserialization of public entry-point arguments in a separate binary.

## Running

### Proptest Fuzzing

```bash
# Run comprehensive fuzzing suite
cargo test --package stellar-scavngr-contract --test fuzz_comprehensive -- --nocapture

# Run with extended cases (default: 32-128 per test)
PROPTEST_CASES=5000 cargo test --package stellar-scavngr-contract --test fuzz_comprehensive

# Run all fuzz tests (comprehensive + existing)
cargo test --package stellar-scavngr-contract fuzz_ -- --nocapture

# Run regression tests
cargo test --package stellar-scavngr-contract --test fuzz_regression
```

### Cargo-Fuzz (Deserialization)

```bash
# Run the deserialization fuzz target
cargo fuzz run fuzz_deserialization

# Run with limited iterations (for CI)
cargo fuzz run fuzz_deserialization -- -max_total_time=60

# List all fuzz targets
cargo fuzz list
```

## Fuzzing Targets

| File | Category | What it covers |
|------|----------|---------------|
| `fuzz_comprehensive.rs` | Boundary values | Extreme weights (0, MAX), invalid waste types, invalid roles, coordinate boundaries |
| `fuzz_comprehensive.rs` | State transitions | Submit-then-transfer, double transfer, nonexistent waste ops, unregistered user ops |
| `fuzz_comprehensive.rs` | Multi-participant | Chain transfers (R->C->M), self-transfer rejection, independent submissions |
| `fuzz_comprehensive.rs` | Incentives | Extreme reward/budget values, non-manufacturer rejection |
| `fuzz_regression.rs` | Regression | Deterministic edge case tests for discovered failures |
| `fuzz_contract_operations.rs` | Existing | Basic registration, submission, transfer fuzzing |
| `fuzz_waste_submission.rs` | Existing | Waste submission with varied inputs |
| `fuzz_waste_transfer.rs` | Existing | Transfer operation fuzzing |
| `fuzz_deserialization.rs` | **cargo-fuzz** | Input deserialization of all public entry points (register_participant, submit_material, transfer_waste) |

## Adding New Fuzz Targets

### Proptest Targets
1. Add a new `proptest! { }` block in `fuzz_comprehensive.rs`
2. Use `std::panic::catch_unwind` to catch expected panics
3. Use `prop_assert!` for invariant checks
4. Choose strategies that target boundaries, not just random ranges

### Cargo-Fuzz Targets
1. Create a new file in `fuzz/fuzz_targets/`
2. Use `#![no_main]` and `libfuzzer_sys::fuzz_target!`
3. Use `std::panic::catch_unwind` to catch panics
4. Add the `[[bin]]` entry to `fuzz/Cargo.toml`
5. Add the fuzz package to workspace members in the root `Cargo.toml`

## Creating Regression Tests

When proptest finds a failure, it saves the minimal case to `proptest-regressions/`. Convert these to deterministic tests in `fuzz_regression.rs`:

```rust
#[test]
#[should_panic]
fn regression_description_of_issue() {
    // Reproduce the exact inputs from the proptest failure
}
```

## Corpus Management

Proptest persists failure cases in `proptest-regressions/` directories (auto-created next to test files). These are replayed on every run to prevent regressions. Commit these files to version control.

## Fuzzing Methodology

The `fuzz_deserialization` target exercises the deserialization layer of public entry points by feeding raw bytes that are interpreted as:
- `ParticipantRole` discriminant values
- `WasteType` discriminant values
- `i128` coordinates for participant registration
- `u64` weights for waste submission
- `u128` waste IDs and `u64` weights for transfers
- `String` descriptions and notes

Any panic, overflow, or invalid state transition discovered during fuzzing should be reported as an issue and converted to a regression test.
