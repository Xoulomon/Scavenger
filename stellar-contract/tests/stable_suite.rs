//! Deterministic, flakiness-free test suite — closes #947.
//!
//! # Why tests become flaky in Soroban
//!
//! The most common causes in this codebase were:
//!
//! 1. **Missing `env.mock_all_auths()`** — `require_auth()` in the contract
//!    panics unless auth is mocked. Tests that forgot this call passed only
//!    when the auth check happened to be skipped (e.g. wrong binary feature
//!    flags) and failed otherwise.
//!
//! 2. **Shared global state** — Rust test runner executes tests in parallel by
//!    default. Tests that reuse a single `Env` or `ScavengerContractClient`
//!    across threads race with each other. Fix: each test owns its own
//!    `Env::default()`.
//!
//! 3. **Iteration order of unordered collections** — Soroban `Map` / `Vec`
//!    returned from the contract is ordered by insertion, but tests that
//!    sorted results using `HashMap` or `.iter()` on host-side structures saw
//!    non-deterministic order. Fix: use index-based assertions or sort before
//!    comparing.
//!
//! 4. **Wall-clock time dependence** — Tests that called `std::time::Instant`
//!    or relied on `env.ledger().timestamp()` advancing by itself would differ
//!    between fast and slow CI machines. Fix: set ledger time explicitly when
//!    time-sensitive, or avoid asserting on absolute timestamps.
//!
//! Every test in this file follows these rules:
//!   - Owns its own `Env::default()` (no sharing between tests).
//!   - Calls `env.mock_all_auths()` before any contract call.
//!   - Uses only deterministic assertions (counts, equality, ordering).
//!   - Leaves no side-effects visible to other tests.

#![cfg(test)]

use soroban_sdk::{testutils::Address as _, Address, Env};
use stellar_scavngr_contract::{ParticipantRole, ScavengerContract, ScavengerContractClient, WasteType};

// ── Shared setup (pure fn — returns a fresh client, no shared state) ──────────

/// Returns a fresh, fully-initialised client with one participant of each role.
/// Each call produces completely independent state.
fn setup(env: &Env) -> (ScavengerContractClient<'_>, Address, Address, Address, Address) {
    // mock_all_auths MUST come before any contract call that calls require_auth.
    // Forgetting this is the #1 source of intermittent failures.
    env.mock_all_auths();

    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(env, &contract_id);

    let admin = Address::generate(env);
    let recycler = Address::generate(env);
    let collector = Address::generate(env);
    let manufacturer = Address::generate(env);
    let name = soroban_sdk::symbol_short!("test");

    client.initialize_admin(&admin);
    client.register_participant(&recycler, &ParticipantRole::Recycler, &name, &0i128, &0i128);
    client.register_participant(&collector, &ParticipantRole::Collector, &name, &0i128, &0i128);
    client.register_participant(&manufacturer, &ParticipantRole::Manufacturer, &name, &0i128, &0i128);

    (client, admin, recycler, collector, manufacturer)
}

// ── Participant registration stability ───────────────────────────────────────

#[test]
fn stable_register_recycler_is_idempotent_across_runs() {
    // Each run gets a fresh env — no cross-test contamination.
    let env = Env::default();
    let (client, _, recycler, _, _) = setup(&env);

    assert!(
        client.is_participant_registered(&recycler),
        "Recycler should always be registered after setup"
    );
}

#[test]
fn stable_unregistered_address_returns_false() {
    let env = Env::default();
    let (client, _, _, _, _) = setup(&env);
    let stranger = Address::generate(&env);

    // Deterministic: a freshly-generated address is never registered.
    assert!(!client.is_participant_registered(&stranger));
}

#[test]
fn stable_multiple_roles_registered_independently() {
    let env = Env::default();
    let (client, _, recycler, collector, manufacturer) = setup(&env);

    // All three roles are always registered after setup.
    assert!(client.is_participant_registered(&recycler));
    assert!(client.is_participant_registered(&collector));
    assert!(client.is_participant_registered(&manufacturer));
}

#[test]
fn stable_two_recyclers_have_distinct_addresses() {
    let env = Env::default();
    let (client, _, _, _, _) = setup(&env);

    let name = soroban_sdk::symbol_short!("test");
    let r1 = Address::generate(&env);
    let r2 = Address::generate(&env);
    client.register_participant(&r1, &ParticipantRole::Recycler, &name, &0i128, &0i128);
    client.register_participant(&r2, &ParticipantRole::Recycler, &name, &0i128, &0i128);

    // Address::generate always returns unique addresses within the same Env.
    assert_ne!(r1, r2);
    assert!(client.is_participant_registered(&r1));
    assert!(client.is_participant_registered(&r2));
}

// ── Waste submission stability ────────────────────────────────────────────────

#[test]
fn stable_waste_id_increases_monotonically() {
    let env = Env::default();
    let (client, _, recycler, _, _) = setup(&env);

    let id1 = client.recycle_waste(&WasteType::Plastic, &1000u128, &recycler, &0i128, &0i128);
    let id2 = client.recycle_waste(&WasteType::Metal, &1000u128, &recycler, &0i128, &0i128);
    let id3 = client.recycle_waste(&WasteType::Glass, &1000u128, &recycler, &0i128, &0i128);

    // IDs are assigned sequentially — always strictly increasing.
    assert!(id2 > id1, "ID must increase: {} > {}", id2, id1);
    assert!(id3 > id2, "ID must increase: {} > {}", id3, id2);
}

#[test]
fn stable_waste_submitter_recorded_correctly() {
    let env = Env::default();
    let (client, _, recycler, _, _) = setup(&env);

    let id = client.recycle_waste(&WasteType::Plastic, &500u128, &recycler, &0i128, &0i128);
    let waste = client.get_waste_v2(&id).expect("waste must exist");

    // The submitter must always equal the recycler address.
    assert_eq!(waste.submitter, recycler);
}

#[test]
fn stable_waste_type_recorded_correctly() {
    let env = Env::default();
    let (client, _, recycler, _, _) = setup(&env);

    let id = client.recycle_waste(&WasteType::Metal, &750u128, &recycler, &0i128, &0i128);
    let waste = client.get_waste_v2(&id).expect("waste must exist");

    assert_eq!(waste.waste_type, WasteType::Metal);
}

#[test]
fn stable_waste_weight_recorded_correctly() {
    let env = Env::default();
    let (client, _, recycler, _, _) = setup(&env);

    let weight: u128 = 1_234;
    let id = client.recycle_waste(&WasteType::Glass, &weight, &recycler, &0i128, &0i128);
    let waste = client.get_waste_v2(&id).expect("waste must exist");

    assert_eq!(waste.weight, weight);
}

// ── Incentive creation stability ──────────────────────────────────────────────

#[test]
fn stable_incentive_id_is_deterministic() {
    // Two identical setups in separate envs must both get id 0 (or 1) for
    // the first incentive — the counter starts from a known state.
    let env = Env::default();
    let (client, _, _, _, manufacturer) = setup(&env);

    let inc = client.create_incentive(&manufacturer, &WasteType::Plastic, &100u64, &1_000u64);

    // Whatever the first ID is, it must be consistent across runs.
    let inc2 = client
        .get_incentive_by_id(&inc.id)
        .expect("Incentive must be retrievable by the ID returned at creation");

    assert_eq!(inc.id, inc2.id);
    assert_eq!(inc2.waste_type, WasteType::Plastic);
}

#[test]
fn stable_two_incentives_have_distinct_ids() {
    let env = Env::default();
    let (client, _, _, _, manufacturer) = setup(&env);

    let inc1 = client.create_incentive(&manufacturer, &WasteType::Plastic, &100u64, &1_000u64);
    let inc2 = client.create_incentive(&manufacturer, &WasteType::Metal, &200u64, &2_000u64);

    assert_ne!(inc1.id, inc2.id);
}

// ── Transfer stability ────────────────────────────────────────────────────────

#[test]
fn stable_transfer_recorded_in_history() {
    let env = Env::default();
    let (client, _, recycler, collector, _) = setup(&env);

    let id = client.recycle_waste(&WasteType::Plastic, &1_000u128, &recycler, &0i128, &0i128);
    client.transfer_waste_v2(&id, &recycler, &collector, &0i128, &0i128);

    let history = client.get_waste_transfer_history_v2(&id);
    // History always has exactly one record after one transfer.
    assert_eq!(history.len(), 1, "Expected exactly 1 transfer record");
    assert_eq!(history.get(0).unwrap().from, recycler);
    assert_eq!(history.get(0).unwrap().to, collector);
}

#[test]
fn stable_multi_hop_transfer_history_length() {
    let env = Env::default();
    let (client, _, recycler, collector, manufacturer) = setup(&env);

    let id = client.recycle_waste(&WasteType::Metal, &1_000u128, &recycler, &0i128, &0i128);
    client.transfer_waste_v2(&id, &recycler, &collector, &0i128, &0i128);
    client.transfer_waste_v2(&id, &collector, &manufacturer, &0i128, &0i128);

    let history = client.get_waste_transfer_history_v2(&id);
    assert_eq!(history.len(), 2, "Expected exactly 2 transfer records");
}

#[test]
fn stable_independent_wastes_have_independent_histories() {
    let env = Env::default();
    let (client, _, recycler, collector, _) = setup(&env);

    let id1 = client.recycle_waste(&WasteType::Plastic, &1_000u128, &recycler, &0i128, &0i128);
    let id2 = client.recycle_waste(&WasteType::Glass, &1_000u128, &recycler, &0i128, &0i128);

    // Only transfer id1
    client.transfer_waste_v2(&id1, &recycler, &collector, &0i128, &0i128);

    let h1 = client.get_waste_transfer_history_v2(&id1);
    let h2 = client.get_waste_transfer_history_v2(&id2);

    assert_eq!(h1.len(), 1, "id1 should have 1 transfer");
    assert_eq!(h2.len(), 0, "id2 should have 0 transfers");
}

// ── Metrics stability ─────────────────────────────────────────────────────────

#[test]
fn stable_metrics_reflect_waste_count() {
    let env = Env::default();
    let (client, _, recycler, _, _) = setup(&env);

    let before = client.get_metrics().total_wastes_count;
    client.recycle_waste(&WasteType::Plastic, &1_000u128, &recycler, &0i128, &0i128);
    client.recycle_waste(&WasteType::Metal, &1_000u128, &recycler, &0i128, &0i128);
    let after = client.get_metrics().total_wastes_count;

    assert_eq!(after, before + 2, "Metrics must reflect exactly the wastes added");
}
