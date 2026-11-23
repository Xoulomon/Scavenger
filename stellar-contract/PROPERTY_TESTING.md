# Property-Based Testing

Property-based testing uses randomized inputs to verify that contract invariants hold across a wide range of scenarios, rather than testing specific examples.

## Running

```bash
# Run all property tests
cargo test --package stellar-scavngr-contract --test property_tests

# Run with output
cargo test --package stellar-scavngr-contract --test property_tests -- --nocapture

# Run with more cases
PROPTEST_CASES=1000 cargo test --package stellar-scavngr-contract --test property_tests
```

## Invariants Tested

### Type system properties (256 cases each)

- **WasteType roundtrip**: `from_u32(to_u32(wt)) == wt` for all valid types
- **WasteType rejection**: `from_u32(v)` returns `None` for v >= 7
- **ParticipantRole roundtrip**: same roundtrip for roles
- **ParticipantRole rejection**: `from_u32(v)` returns `None` for v >= 3
- **CertificationLevel monotonicity**: higher waste counts never produce lower certifications
- **CertificationLevel correctness**: each count maps to the expected tier
- **Carbon credit proportionality**: more weight always yields more credits
- **Carbon credits zero**: zero weight yields zero credits

### Contract invariants (64 cases each)

- **Waste count consistency**: after N submissions, `get_participant_wastes` returns exactly N items
- **Waste property preservation**: submitted waste retains its type, weight, and submitter
- **Transfer integrity**: transferred waste keeps type and weight, owner changes to recipient
- **Coordinate validation**: valid microdegree coordinates are accepted
- **Incentive budget**: `remaining_budget == total_budget` on creation
- **Metrics consistency**: `total_wastes_count` increments with each submission
- **Double registration rejection**: re-registering the same address panics
- **Multi-type independence**: waste IDs are unique across types, counts match

## Adding New Properties

1. Add a new test inside a `proptest! { }` block in `tests/property_tests.rs`
2. Use `prop_assert!` / `prop_assert_eq!` instead of `assert!`
3. Choose strategies that cover the domain: `0u32..7` for waste types, `100u64..100_000` for weights
4. Keep contract-touching tests at 64 cases to avoid slow CI; pure logic tests can use 256+

## Configuration

Default case count is set per block via `#![proptest_config(ProptestConfig::with_cases(N))]`. Override at runtime with `PROPTEST_CASES=N`.

Failures are persisted to `proptest-regressions/` and replayed on subsequent runs.
