# Negative-Path Test Coverage

Closes #948.

## Overview

`stellar-contract/tests/negative_path_tests.rs` adds 20 tests that cover every
documented error condition in the contract. Previous tests focused almost
entirely on happy paths.

---

## Error condition catalogue

| # | Error condition | Test function | Expected outcome |
|---|---|---|---|
| 1 | Duplicate participant registration | `neg_duplicate_participant_registration` | `panic!("Participant already registered")` |
| 2 | Get non-existent participant | `neg_get_nonexistent_participant_returns_none` | Returns `None` |
| 3 | `is_registered` for unknown address | `neg_is_registered_returns_false_for_unknown` | Returns `false` |
| 4 | Double `initialize_admin` | `neg_double_initialize_admin` | `panic!("Admin already initialized")` |
| 5 | Percentages sum > 100 | `neg_percentages_sum_exceeds_100` | `panic!("Total percentages cannot exceed 100")` |
| 6 | Percentages == 100 | `neg_percentages_exactly_100_is_accepted` | OK (boundary) |
| 7 | Percentages == 0 + 0 | `neg_zero_percentages_are_accepted` | OK (boundary) |
| 8 | Waste with zero weight | `neg_zero_weight_waste_rejected` | `panic!("must be greater than zero")` |
| 9 | Get non-existent waste | `neg_get_nonexistent_waste_returns_none` | Returns `None` |
| 10 | Unregistered address submits waste | `neg_unregistered_address_cannot_submit_waste` | `panic!("Caller is not a registered participant")` |
| 11 | Collector submits waste | `neg_collector_cannot_submit_waste` | Panics (not a recycler) |
| 12 | Self-transfer | `neg_self_transfer_rejected` | `panic!("Self-transfer is not allowed")` |
| 13 | Non-owner transfers waste | `neg_non_owner_transfer_rejected` | `panic!("Caller is not the owner…")` |
| 14 | Transfer non-existent waste | `neg_transfer_nonexistent_waste_panics` | Panics (`WasteNotFound`) |
| 15 | Recycler creates incentive | `neg_recycler_cannot_create_incentive` | `panic!("Caller is not a manufacturer")` |
| 16 | Collector creates incentive | `neg_collector_cannot_create_incentive` | `panic!("Caller is not a manufacturer")` |
| 17 | Get non-existent incentive | `neg_get_nonexistent_incentive_returns_none` | Returns `None` |
| 18 | Update non-existent incentive | `neg_update_nonexistent_incentive_panics` | `panic!("Incentive not found")` |
| 19 | Deactivate non-existent incentive | `neg_deactivate_nonexistent_incentive_panics` | `panic!("Incentive not found")` |
| 20 | Zero reward incentive | `neg_zero_reward_incentive_is_accepted` | OK (documents current behaviour) |
| 21 | Zero budget incentive | `neg_zero_budget_incentive_is_accepted` | OK (documents current behaviour) |

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
