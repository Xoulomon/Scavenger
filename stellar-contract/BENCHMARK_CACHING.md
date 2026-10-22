# Storage Read Caching — Resource Cost Optimization

## Function profiled

`transfer_waste` (one of the top 5 most-invoked contract functions per
`stellar-contract/benches/contract_benchmarks.rs`'s `waste_transfer` group)
performed 4 separate `env.storage().instance().get::<_, Participant>(...)`
reads per invocation for only 2 distinct participant records:

1. `require_registered(&env, &from)` — read `from`'s `Participant`
2. `require_registered(&env, &to)` — read `to`'s `Participant`
3. `is_valid_transfer(&env, from, to)` — read `from`'s `Participant` again
4. `is_valid_transfer(&env, from, to)` — read `to`'s `Participant` again

Reads 3 and 4 fetched records already fetched (and discarded) in steps 1
and 2, purely to re-derive `is_registered`/`role` for the transfer-route
check.

## Change made

- Added `require_registered_participant`, which does the same
  registration check as `require_registered` but returns the fetched
  `Participant` instead of discarding it.
- Added `role_transition_allowed(from_p, to_p)`, a pure function extracted
  from `is_valid_transfer`'s body, operating on already-fetched
  `Participant` values instead of addresses.
- `is_valid_transfer` (public API, unchanged signature and behavior) now
  fetches both records once and delegates to `role_transition_allowed`.
- `transfer_waste` now calls `require_registered_participant` once per
  address (2 reads total) and passes the results directly to
  `role_transition_allowed`, eliminating the 2 redundant reads.

No behavior changed: the same registration and role-transition checks run
in the same order with the same panic conditions; only the number of
storage reads for the already-in-scope data changed.

## Before / after (instance storage reads per `transfer_waste` call)

| | Before | After | Reduction |
|---|---|---|---|
| Participant storage reads (`from` + `to`, registration + role check) | 4 | 2 | 50% |

This removes 2 of the ~4-6 total instance-storage reads `transfer_waste`
performs per call (the remainder being the waste/material record read and
write, which are already single reads/writes and out of scope for this
change).

## Benchmarks

`stellar-contract/benches/contract_benchmarks.rs`'s `waste_transfer` group
(`transfer_waste` benchmark) exercises exactly this code path and will
reflect the reduced storage-read count on the next `cargo bench` run
against a saved baseline (see `docs/archive/stellar-contract/BENCHMARK_RESULTS.md` for the run/compare
commands: `cargo bench --package stellar-scavngr-contract -- --baseline
<name>`). Re-running and re-saving the baseline is left as a follow-up
since this change does not alter benchmark code itself.

## Acceptance criteria status

- [x] Reduced redundant storage reads by caching within a single
      invocation (`transfer_waste`)
- [x] No behavior change (same checks, same order, same panics)
- [ ] Re-run `cargo bench` and update the saved Criterion baseline
      (follow-up — requires a Soroban toolchain run, not done here)
