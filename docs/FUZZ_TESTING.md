# Fuzz Testing

## Overview

Fuzz testing uses property-based testing to generate random inputs and verify contract behavior under edge cases and unexpected conditions.

## Framework

- **Tool**: proptest
- **Language**: Rust
- **Coverage**: Contract functions with variable inputs

## Fuzz Test Scenarios

### 1. Participant Registration Fuzzing

- **Input**: Random role (0-2), latitude (-90 to 90), longitude (-180 to 180)
- **Property**: Should not panic with any valid coordinates
- **Regression**: Stores failing cases in `.proptest-regressions`

### 2. Waste Submission Fuzzing

- **Input**: Random weight (1 to u128::MAX), coordinates
- **Property**: Should handle any weight value without panicking
- **Edge Cases**: Zero weight, maximum weight, extreme coordinates

### 3. Waste Transfer Fuzzing

- **Input**: Random waste_id, coordinates
- **Property**: Should gracefully handle invalid waste IDs
- **Validation**: No panics on non-existent waste

### 4. Incentive Creation Fuzzing

- **Input**: Random reward_points, budget values
- **Property**: Should accept any positive reward/budget combination
- **Bounds**: Tests u128 boundaries

## Running Fuzz Tests

```bash
cd stellar-contract

# Run all fuzz tests
cargo test --test fuzz_contract_operations

# Run specific fuzz test
cargo test --test fuzz_contract_operations fuzz_participant_registration

# Run with more iterations
PROPTEST_CASES=10000 cargo test --test fuzz_contract_operations
```

## Regression Testing

Failed test cases are stored in `.proptest-regressions` files for deterministic replay:

```bash
# Automatically re-runs stored regression cases
cargo test --test fuzz_contract_operations
```

## CI/CD Integration

Fuzz tests run on every push with 1000 iterations:

```yaml
- name: Run Fuzz Tests
  run: PROPTEST_CASES=1000 cargo test --test fuzz_contract_operations
```

## Performance

- **Default Cases**: 256 per property
- **CI Cases**: 1000 per property
- **Typical Runtime**: < 30 seconds

## Interpreting Results

- ✅ **PASS**: All generated inputs handled correctly
- ❌ **FAIL**: Regression case found and stored
- ⚠️ **SHRINK**: Minimal failing case identified

## Best Practices

1. Run locally before pushing
2. Review regression cases for patterns
3. Update properties if behavior changes intentionally
4. Increase iterations for critical paths
