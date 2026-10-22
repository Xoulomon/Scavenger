# Negative-Path Test Coverage

Closes #948. Verified by #1544.

## Overview

`stellar-contract/tests/negative_path_tests.rs` adds 21 tests that cover every
documented error condition in the contract. Previous tests focused almost
entirely on happy paths.

All rows in this table have been verified against the test file as part of
issue #1544: every listed test function exists in
`stellar-contract/tests/negative_path_tests.rs` and the suite passes with

```bash
cargo test -p stellar-scavngr-contract negative_path
```

---

## Error condition catalogue

| # | Error condition | Test function | Expected outcome | Test file |
|---|---|---|---|---|
| 1 | Duplicate participant registration | `neg_duplicate_participant_registration` | `panic!("Participant already registered")` | `stellar-contract/tests/negative_path_tests.rs` |
| 2 | Get non-existent participant | `neg_get_nonexistent_participant_returns_none` | Returns `None` | `stellar-contract/tests/negative_path_tests.rs` |
| 3 | `is_registered` for unknown address | `neg_is_registered_returns_false_for_unknown` | Returns `false` | `stellar-contract/tests/negative_path_tests.rs` |
| 4 | Double `initialize_admin` | `neg_double_initialize_admin` | `panic!("Admin already initialized")` | `stellar-contract/tests/negative_path_tests.rs` |
| 5 | Percentages sum > 100 | `neg_percentages_sum_exceeds_100` | `panic!("Total percentages cannot exceed 100")` | `stellar-contract/tests/negative_path_tests.rs` |
| 6 | Percentages == 100 | `neg_percentages_exactly_100_is_accepted` | OK (boundary) | `stellar-contract/tests/negative_path_tests.rs` |
| 7 | Percentages == 0 + 0 | `neg_zero_percentages_are_accepted` | OK (boundary) | `stellar-contract/tests/negative_path_tests.rs` |
| 8 | Waste with zero weight | `neg_zero_weight_waste_rejected` | `panic!("must be greater than zero")` | `stellar-contract/tests/negative_path_tests.rs` |
| 9 | Get non-existent waste | `neg_get_nonexistent_waste_returns_none` | Returns `None` | `stellar-contract/tests/negative_path_tests.rs` |
| 10 | Unregistered address submits waste | `neg_unregistered_address_cannot_submit_waste` | `panic!("Caller is not a registered participant")` | `stellar-contract/tests/negative_path_tests.rs` |
| 11 | Collector submits waste | `neg_collector_cannot_submit_waste` | Panics (not a recycler) | `stellar-contract/tests/negative_path_tests.rs` |
| 12 | Self-transfer | `neg_self_transfer_rejected` | `panic!("Self-transfer is not allowed")` | `stellar-contract/tests/negative_path_tests.rs` |
| 13 | Non-owner transfers waste | `neg_non_owner_transfer_rejected` | `panic!("Caller is not the owner…")` | `stellar-contract/tests/negative_path_tests.rs` |
| 14 | Transfer non-existent waste | `neg_transfer_nonexistent_waste_panics` | Panics (`WasteNotFound`) | `stellar-contract/tests/negative_path_tests.rs` |
| 15 | Recycler creates incentive | `neg_recycler_cannot_create_incentive` | `panic!("Caller is not a manufacturer")` | `stellar-contract/tests/negative_path_tests.rs` |
| 16 | Collector creates incentive | `neg_collector_cannot_create_incentive` | `panic!("Caller is not a manufacturer")` | `stellar-contract/tests/negative_path_tests.rs` |
| 17 | Get non-existent incentive | `neg_get_nonexistent_incentive_returns_none` | Returns `None` | `stellar-contract/tests/negative_path_tests.rs` |
| 18 | Update non-existent incentive | `neg_update_nonexistent_incentive_panics` | `panic!("Incentive not found")` | `stellar-contract/tests/negative_path_tests.rs` |
| 19 | Deactivate non-existent incentive | `neg_deactivate_nonexistent_incentive_panics` | `panic!("Incentive not found")` | `stellar-contract/tests/negative_path_tests.rs` |
| 20 | Zero reward incentive | `neg_zero_reward_incentive_is_accepted` | OK (documents current behaviour) | `stellar-contract/tests/negative_path_tests.rs` |
| 21 | Zero budget incentive | `neg_zero_budget_incentive_is_accepted` | OK (documents current behaviour) | `stellar-contract/tests/negative_path_tests.rs` |

**Status: ✅ All 21 rows reference passing tests.**

---

## Notes on items 20–21

`create_incentive` does not currently validate that `reward_points > 0` or
`total_budget > 0`. Tests 20 and 21 document this **as regression guards** —
if the contract is later hardened to reject zero values, these tests will fail
and alert the developer to update expected behaviour.

---

## Running the negative-path suite

```bash
cargo test -p stellar-scavngr-contract negative_path
```

## Coverage check (CI enforcement)

The CI pipeline verifies that every row in this table has a non-empty "Test file"
column. Run the following to confirm locally:

```bash
# Count rows that are missing a test file reference (should print 0)
grep -c "| $" docs/NEGATIVE_PATH_COVERAGE.md || echo "0 rows missing test references"
```
