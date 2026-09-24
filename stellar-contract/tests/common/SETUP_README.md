# Shared Test Setup Helpers

## What changed

`stellar-contract/tests/*.rs` files each hand-rolled their own contract
registration + admin initialization + participant registration boilerplate
(e.g. `waste_reservation_test.rs` had a local `setup()` duplicating logic also
present in `factories.rs` and dozens of other test files).

Added `stellar-contract/tests/common/setup.rs` with:

- `make_client(env)` — registers the contract and returns a client.
- `setup_admin(env)` — mocks auths, creates a client, generates + initializes
  an admin address.
- `register_participant_with_role(env, client, role, name)` — registers one
  participant of a given role with a short deterministic name.
- `setup_with_recycler(env)` — `setup_admin` + one registered recycler.
- `setup_full_env(env)` — `setup_admin` + one recycler, collector, and
  manufacturer.

Wired into `tests/common/mod.rs` via `pub mod setup;`.

`waste_reservation_test.rs` was migrated to use
`common::setup::setup_with_recycler` in place of its local `setup()`
function, as a reference for migrating the remaining test files.

## Why

Reduces duplicated setup boilerplate across the contract test suite and gives
future tests one shared, tested implementation to build on instead of copying
another file's local helper.

## Follow-up

Other test files with local `setup()`/`setup_full_env` style functions (see
`factories.rs` and similar) can be migrated to `common::setup::*` the same
way, file by file, without behavior changes.
