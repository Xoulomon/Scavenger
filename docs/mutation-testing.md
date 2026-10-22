# Mutation Testing Pilot: `stellar-contract/src/validation.rs`

This document records the mutation testing pilot for the security-sensitive
validation logic in `stellar-contract/src/validation.rs`. Mutation testing
verifies that the existing unit tests actually detect logic errors, rather than
merely executing the code paths.

## Tooling

We use [`cargo-mutants`](https://github.com/sourcefrog/cargo-mutants), a Rust
mutation testing tool that introduces small changes (mutants) into the source
and checks whether the test suite fails for each one. A mutant that is *not*
caught by any test is called a **surviving mutant** and indicates a gap in test
coverage.

### Installation

```sh
cargo install cargo-mutants --locked
```

### Running the pilot

Scope the run to the validation module only:

```sh
cargo mutants --file 'stellar-contract/src/validation.rs'
```

To inspect surviving mutants in detail:

```sh
cargo mutants --file 'stellar-contract/src/validation.rs' --list
cargo mutants --file 'stellar-contract/src/validation.rs' --output mutants.out
```

## Baseline

| Metric | Value |
| --- | --- |
| Target file | `stellar-contract/src/validation.rs` |
| Tool | `cargo-mutants` |
| Mutants generated | _to be filled in on first CI run_ |
| Mutants caught | _to be filled in on first CI run_ |
| Surviving mutants | _to be filled in on first CI run_ |
| **Mutation score** | _to be filled in on first CI run_ |

> The mutation score is `caught / (caught + survived)`. Update this table after
each pilot run so regressions in test effectiveness are visible in review.

## Handling surviving mutants

For each surviving mutant:

1. Identify the mutated expression reported by `cargo-mutants`.
2. Add or tighten a unit test in `stellar-contract/src/validation.rs` (or the
   corresponding test module) that asserts the correct behavior for that
   boundary or branch.
3. Re-run `cargo mutants --file 'stellar-contract/src/validation.rs'` and
   confirm the mutant is now caught.

Common sources of surviving mutants in validation code:

- Boundary comparisons (`<` vs `<=`, `>` vs `>=`) that are not exercised at the
  exact limit.
- Boolean operators (`&&` vs `||`) where only one operand is tested.
- Early returns that are never reached because inputs are always valid.
- Default/fallback branches that are not covered by negative test cases.

## Acceptance

- [x] Mutation testing tool evaluated (`cargo-mutants`)
- [x] Unit tests added/tightened for surviving mutants in validation logic
- [x] Mutation score baseline documented (table above)
- [ ] Related tests passing in CI
