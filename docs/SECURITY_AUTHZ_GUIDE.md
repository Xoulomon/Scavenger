# Security & Authorization Guide

Closes #949.

## Authorization model

The contract has three tiers of access control:

| Tier | Guard function | Panic message |
|---|---|---|
| **Admin** (strict — address must be current admin) | `require_admin` | `"Unauthorized: caller is not admin"` |
| **Admin** (soft — historical alias) | `only_admin` | `"Caller is not the contract admin"` |
| **Manufacturer** | `only_manufacturer` | `"Caller is not a manufacturer"` |
| **Registered participant** | `require_registered` | `"Caller is not a registered participant"` |
| **Waste owner** | inline check | `"Caller is not the owner of this waste item"` |
| **Incentive rewarder** | inline check | `"Only incentive creator can deactivate"` |

> Note: `require_admin` and `only_admin` differ slightly in implementation;
> `require_admin` is used by multi-admin functions (e.g. `transfer_admin`,
> `set_token_address`) while `only_admin` guards single-admin setters (e.g.
> `set_charity_contract`, `set_percentages`, `deactivate_waste`).

---

## Protected endpoints and their guards

| Function | Guard | Notes |
|---|---|---|
| `initialize_admin` | One-shot | Panics `"Admin already initialized"` on second call |
| `transfer_admin` | `require_admin` | New admin list must not be empty |
| `set_percentages` | `only_admin` | Sum of percentages must be ≤ 100 |
| `set_charity_contract` | `only_admin` | Charity address ≠ admin address |
| `set_token_address` | `require_admin` | Sets SEP-41 token contract |
| `deactivate_waste` | `only_admin` | Cannot deactivate already-deactivated waste |
| `create_incentive` | `only_manufacturer` | Only Manufacturer role can create |
| `deactivate_incentive` | `require_registered` + inline rewarder check | Only original creator can deactivate |
| `transfer_waste_v2` | `from.require_auth()` + inline owner check | `from` must equal `waste.current_owner` |

---

## Test coverage in `authz_tests.rs`

| Test | What is validated |
|---|---|
| `authz_admin_can_transfer_admin` | Happy path — correct admin transfers role |
| `authz_non_admin_cannot_transfer_admin` | Non-admin blocked with correct message |
| `authz_transfer_admin_empty_list_rejected` | Structural validation — empty list rejected |
| `authz_old_admin_loses_privileges_after_transfer` | Privilege revocation is immediate |
| `authz_admin_can_set_percentages` | Happy path |
| `authz_non_admin_cannot_set_percentages` | Wrong caller blocked |
| `authz_percentage_overflow_is_token_tampering` | Tampering via overflow rejected |
| `authz_admin_can_set_charity` | Happy path |
| `authz_non_admin_cannot_set_charity` | Wrong caller blocked |
| `authz_admin_can_deactivate_waste` | Happy path |
| `authz_non_admin_cannot_deactivate_waste` | Wrong caller blocked |
| `authz_double_deactivate_waste_rejected` | Replay-style attack rejected |
| `authz_rewarder_can_deactivate_incentive` | Happy path |
| `authz_non_rewarder_cannot_deactivate_incentive` | Different manufacturer blocked |
| `authz_owner_can_transfer_waste` | Happy path |
| `authz_non_owner_cannot_transfer_waste` | Non-owner blocked |
| `authz_double_initialize_admin_rejected` | Re-initialization attack rejected |
| `authz_admin_can_set_token_address` | Happy path |
| `authz_non_admin_cannot_set_token_address` | Wrong caller blocked |

---

## Running the security test suite

```bash
cargo test -p stellar-scavngr-contract authz
```

---

## Threat model notes

1. **Re-initialization attack** — `initialize_admin` is one-shot. Any second
   call panics, preventing an attacker from overwriting the admin after deploy.

2. **Privilege escalation via percentage overflow** — `set_percentages` rejects
   sums > 100, preventing an attacker from extracting more tokens than the
   reward pool allows.

3. **Incentive creator impersonation** — `deactivate_incentive` verifies
   `incentive.rewarder == caller`. A different manufacturer cannot deactivate
   or manipulate another manufacturer's incentive.

4. **Waste ownership spoofing** — `transfer_waste_v2` verifies
   `waste.current_owner == from`. An attacker cannot transfer waste they do not
   own, even if they pass a valid `from` address.

5. **Admin privilege revocation** — `transfer_admin` atomically replaces the
   entire admin list. The old admin loses all privileges immediately after the
   call, preventing two-admin races.

---

## Unauthenticated entrypoints (issue #1518)

The following public functions intentionally do **not** call `require_auth` or
perform a role/ownership check.  Each is documented with its reason and the
risk accepted.

| Function | Why unauthenticated | Risk accepted |
|---|---|---|
| `is_paused` | Pure read; no state mutation | None — read-only |
| `get_admins` | Pure read | None — read-only |
| `get_admin` | Pure read | None — read-only |
| `get_charity_contract` | Pure read | None — read-only |
| `get_collector_percentage` | Pure read | None — read-only |
| `get_owner_percentage` | Pure read | None — read-only |
| `get_token_address` | Pure read | None — read-only |
| `get_current_multiplier` | Pure read | None — read-only |
| `is_participant_registered` | Pure read | None — read-only |
| `get_participant` | Pure read | None — read-only |
| `get_participant_info` | Pure read | None — read-only |
| `get_participant_earnings` | Pure read | None — read-only |
| `get_all_participants` | Pure read | None — read-only |
| `get_waste` / `get_material` | Pure read | None — read-only |
| `get_waste_v2` | Pure read | None — read-only |
| `get_participant_wastes` / `_v2` | Pure read | None — read-only |
| `get_waste_transfer_history` | Pure read | None — read-only |
| `get_stats` | Pure read | None — read-only |
| `get_metrics` | Pure read | None — read-only |
| `get_global_metrics` | Pure read | None — read-only |
| `get_incentives` / `get_active_incentives` | Pure read | None — read-only |
| `waste_exists` / `incentive_exists` | Pure read | None — read-only |
| `calculate_carbon_credits` | Pure function (no env state) | None — pure computation |
| `confirm_waste_details` | Any registered participant can confirm *another's* waste — deliberate public-goods design | Low — confirmer cannot forge ownership |

### Adding a new mutating entrypoint

When adding a new function that writes to storage:

1. Add `caller.require_auth()` (or an equivalent role/ownership check).
2. Add a `test_auth_sentinel_<name>` test to `tests/auth_audit_test.rs` that
   strips auths and asserts the call panics.
3. If the function is intentionally unauthenticated, add it to the table above
   with a documented reason.

---

## Auth sentinel test coverage (issue #1518)

The `tests/auth_audit_test.rs` file contains `test_auth_sentinel_*` tests
that assert every known mutating entrypoint rejects calls without proper auth.
These tests form a regression barrier: if a new mutating entrypoint is added
without an auth check, it will be caught in code review via the requirement to
add a sentinel test.

Run the full auth suite:

```bash
cargo test -p stellar-scavngr-contract auth
```
