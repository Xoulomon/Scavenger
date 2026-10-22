# Checks-Effects-Interactions Audit

## Scope

Reviewed every function in `stellar-contract/src/lib.rs` that performs a
cross-contract call (`token::Client::new(...).transfer(...)`), searching for
state mutations (storage writes) that occur **after** an external call.

External-call sites found:

```
grep -n "token_client.transfer" stellar-contract/src/lib.rs
```

## Findings

### 1. `purchase_carbon_listing` — violation, fixed ✅

**Status: RESOLVED**

Previously issued `token_client.transfer(&buyer, &listing.seller, ...)`
**before** marking the listing inactive, crediting the buyer's carbon
credits, and removing the listing from the active-listings index. A
reentrant token contract could call back into `purchase_carbon_listing`
(or another function reading the same listing) while `listing.is_active`
was still `true`, allowing the same listing to be purchased more than
once.

**Fix:** all storage writes (buyer stats, `listing.is_active = false`,
`remove_active_listing`) now happen before the token transfer.

**Implementation Details:**
- **Location:** `stellar-contract/src/lib.rs`, lines 3937–4017
- **Effect Order (CEI):**
  1. **Checks** (lines 3941–3964): Validate listing exists, is active, seller ≠ buyer, token address set, compute prices
  2. **Effects** (lines 3968–3997): 
     - Credit buyer's carbon_credits_earned (lines 3968–3975)
     - Mark listing.is_active = false (line 3987)
     - Persist listing to storage (lines 3989–3990)
     - Remove from active-listings index (line 3992)
     - Update total tokens bookkeeping (line 3994)
  3. **Interaction** (lines 4000–4001): token_client.transfer call happens LAST
- **Reentrancy Protection:** By the time `token_client.transfer` executes, the listing is already marked inactive and buyer stats are credited. A malicious token contract reentering `purchase_carbon_listing` will fail the `if !listing.is_active` check and cannot double-purchase.
- **Code Comment:** Lines 3966–3967 document the CEI pattern and reentrancy protection
- **Tests:** `stellar-contract/tests/cei_reentrancy_test.rs`
  - `purchase_carbon_listing_deactivates_listing_before_returning()` - verifies ordering
  - `purchase_carbon_listing_persists_state_before_transfer()` - verifies state resilience on failure

### 2. `distribute_reward` (waste incentive payout) — violation, fixed ✅

**Status: RESOLVED**

Previously decremented `incentive.remaining_budget` and persisted the
incentive **after** a loop of `token_client.transfer` calls to collectors,
the submitter, and (if applicable) the recycler share. Since
`total_reward` is fully computed before the loop and does not depend on
the transfers themselves, a reentrant callee invoked during any of those
transfers could observe the stale (pre-decrement) `remaining_budget` and
trigger another payout against the same incentive before it was marked
exhausted.

**Fix:** the `incentive.remaining_budget` update (and `add_to_total_tokens`
bookkeeping) now happens immediately after the reward amounts are computed
and before any `token_client.transfer` call in the loop.

**Implementation Details:**
- **Location:** `stellar-contract/src/lib.rs`, lines 5489–5572
- **Effect Order (CEI):**
  1. **Checks** (lines 5493–5525): Validate material exists and verified, incentive exists and active, compute base reward with multiplier, check budget sufficiency
  2. **Effects** (lines 5525–5540):
     - Decrement incentive.remaining_budget by total_reward (lines 5525–5527)
     - Mark incentive.active = false if budget exhausted (lines 5528–5530)
     - Persist incentive to storage via set_incentive (line 5531)
     - Update total tokens bookkeeping via add_to_total_tokens (line 5532)
  3. **Interaction** (lines 5534–5572): token_client.transfer loop happens LAST
     - Transfer to collectors (lines 5547–5551)
     - Transfer to submitter/owner (lines 5554–5558)
     - Transfer remaining to recycler if applicable (lines 5560–5566)
- **Reentrancy Protection:** By the time any token_client.transfer executes, the incentive budget has been decremented and the incentive state persisted. A malicious token contract reentering `distribute_reward` will find reduced budget and cannot drain more rewards than allowed.
- **Code Comment:** Lines 5520–5524 document the CEI pattern and reentrancy protection
- **Tests:** `stellar-contract/tests/cei_reentrancy_test.rs`
  - `distribute_reward_decrements_budget_before_returning()` - verifies ordering
  - `distribute_rewards_persists_budget_before_transfers()` - verifies state resilience on failure

## Regression coverage

See `stellar-contract/tests/cei_reentrancy_test.rs`, enhanced with real assertions for:
1. State ordering for `purchase_carbon_listing` (6 test cases)
2. State ordering for `distribute_reward` (6 test cases)
3. Robustness tests confirming state persists even if transfers fail

A full malicious-callee integration harness (a mock token contract that
reenters mid-`transfer`) is not currently feasible with the existing Soroban
test harness/mocks in this repo without adding a new mock-token test contract
crate; that is recommended as a follow-up so the ordering fix has an executable
reentrancy proof, not just a static ordering guarantee.

## Acceptance criteria status

- [x] Reviewed all functions performing external cross-contract calls
- [x] State mutations now occur before external calls in both identified call sites
- [x] Findings documented (this file)
- [x] Tests added to verify state ordering (cei_reentrancy_test.rs)
- [x] Code comments document CEI pattern and reentrancy protection
- [ ] Full malicious-callee integration test (follow-up, see above)
