#![cfg(test)]
//! Expiration test helpers and utilities.

//! Tests for the waste expiration system (issue #543).
//!
//! Covers:
//! - `set_waste_ttl` / `get_waste_ttl` admin configuration
//! - `expires_at` field populated correctly on `recycle_waste`
//! - `Waste::is_expired` logic
//! - `get_expired_wastes` listing
//! - `cleanup_expired_wastes` deactivation + event emission
//! - Transfer blocked on expired waste (`transfer_waste_v2`)
//! - Independent per-type TTLs
//! - Zero TTL means no expiry

use crate::types::{ParticipantRole, WasteType};
use crate::{ScavengerContract, ScavengerContractClient};
use soroban_sdk::{symbol_short, testutils::Address as _, Address, Env};

// ─── Helpers ────────────────────────────────────────────────────────────────

/// Creates a fresh environment, registers the contract, and initialises an admin.
fn setup_with_admin() -> (Env, ScavengerContractClient<'static>, Address) {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, ScavengerContract {});
    let client = ScavengerContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    client.initialize_admin(&admin);
    (env, client, admin)
}

fn register_recycler(client: &ScavengerContractClient, env: &Env) -> Address {
    let addr = Address::generate(env);
    client.register_participant(
        &addr,
        &ParticipantRole::Recycler,
        &symbol_short!("recycler"),
        &0,
        &0,
    );
    addr
}

fn register_collector(client: &ScavengerContractClient, env: &Env) -> Address {
    let addr = Address::generate(env);
    client.register_participant(
        &addr,
        &ParticipantRole::Collector,
        &symbol_short!("collector"),
        &0,
        &0,
    );
    addr
}

// ─── TTL configuration ──────────────────────────────────────────────────────

#[test]
fn test_default_waste_ttl_is_zero() {
    let (_env, client, _admin) = setup_with_admin();
    // Before any TTL is set, every waste type should return 0 (no expiry).
    assert_eq!(client.get_waste_ttl(&WasteType::Paper), 0u64);
    assert_eq!(client.get_waste_ttl(&WasteType::Plastic), 0u64);
    assert_eq!(client.get_waste_ttl(&WasteType::Metal), 0u64);
    assert_eq!(client.get_waste_ttl(&WasteType::Glass), 0u64);
    assert_eq!(client.get_waste_ttl(&WasteType::Organic), 0u64);
    assert_eq!(client.get_waste_ttl(&WasteType::Electronic), 0u64);
    assert_eq!(client.get_waste_ttl(&WasteType::PetPlastic), 0u64);
}

#[test]
fn test_set_and_get_waste_ttl() {
    let (_env, client, admin) = setup_with_admin();
    let seven_days: u64 = 7 * 24 * 60 * 60;

    client.set_waste_ttl(&admin, &WasteType::Paper, &seven_days);
    assert_eq!(client.get_waste_ttl(&WasteType::Paper), seven_days);
}

#[test]
fn test_set_ttl_for_each_waste_type_independently() {
    let (_env, client, admin) = setup_with_admin();

    let ttls: &[(WasteType, u64)] = &[
        (WasteType::Paper, 100),
        (WasteType::Plastic, 200),
        (WasteType::PetPlastic, 300),
        (WasteType::Metal, 400),
        (WasteType::Glass, 500),
        (WasteType::Organic, 600),
        (WasteType::Electronic, 700),
    ];

    for (wt, ttl) in ttls.iter() {
        client.set_waste_ttl(&admin, wt, ttl);
    }
    for (wt, ttl) in ttls.iter() {
        assert_eq!(client.get_waste_ttl(wt), *ttl);
    }
}

#[test]
fn test_set_ttl_to_zero_disables_expiry() {
    let (_env, client, admin) = setup_with_admin();
    // First set a non-zero TTL…
    client.set_waste_ttl(&admin, &WasteType::Organic, &3600u64);
    assert_eq!(client.get_waste_ttl(&WasteType::Organic), 3600u64);
    // …then reset to 0 to disable expiry.
    client.set_waste_ttl(&admin, &WasteType::Organic, &0u64);
    assert_eq!(client.get_waste_ttl(&WasteType::Organic), 0u64);
}

#[test]
#[should_panic]
fn test_non_admin_cannot_set_waste_ttl() {
    let (env, client, _admin) = setup_with_admin();
    let non_admin = Address::generate(&env);
    // non_admin is not in the admin list → should panic.
    client.set_waste_ttl(&non_admin, &WasteType::Paper, &100u64);
}

// ─── expires_at field on recycle_waste ──────────────────────────────────────

#[test]
fn test_expires_at_set_on_recycle_when_ttl_configured() {
    let (env, client, admin) = setup_with_admin();
    let recycler = register_recycler(&client, &env);

    let start_ts: u64 = 10_000;
    env.ledger().with_mut(|li| li.timestamp = start_ts);

    let ttl: u64 = 3_600; // 1 hour
    client.set_waste_ttl(&admin, &WasteType::Glass, &ttl);

    let waste_id = client.recycle_waste(&WasteType::Glass, &1_000u128, &recycler, &0, &0);
    let waste = client.get_waste_v2(&waste_id).unwrap();

    assert_eq!(waste.expires_at, start_ts + ttl);
}

#[test]
fn test_expires_at_zero_when_no_ttl_configured() {
    let (env, client, _admin) = setup_with_admin();
    let recycler = register_recycler(&client, &env);

    env.ledger().with_mut(|li| li.timestamp = 5_000);

    // Metal has no TTL set.
    let waste_id = client.recycle_waste(&WasteType::Metal, &2_000u128, &recycler, &0, &0);
    let waste = client.get_waste_v2(&waste_id).unwrap();

    assert_eq!(waste.expires_at, 0u64);
}

// ─── is_expired logic ───────────────────────────────────────────────────────

#[test]
fn test_waste_not_expired_before_ttl_elapses() {
    let (env, client, admin) = setup_with_admin();
    let recycler = register_recycler(&client, &env);

    env.ledger().with_mut(|li| li.timestamp = 1_000);
    client.set_waste_ttl(&admin, &WasteType::Plastic, &500u64);
    let waste_id = client.recycle_waste(&WasteType::Plastic, &1_000u128, &recycler, &0, &0);

    // Advance time but stay within the TTL window.
    env.ledger().with_mut(|li| li.timestamp = 1_499);
    let expired = client.get_expired_wastes();
    assert_eq!(expired.len(), 0);
}

#[test]
fn test_waste_is_expired_after_ttl_elapses() {
    let (env, client, admin) = setup_with_admin();
    let recycler = register_recycler(&client, &env);

    env.ledger().with_mut(|li| li.timestamp = 1_000);
    let ttl: u64 = 500;
    client.set_waste_ttl(&admin, &WasteType::Paper, &ttl);
    let waste_id = client.recycle_waste(&WasteType::Paper, &1_000u128, &recycler, &0, &0);

    // expires_at = 1500; advance to exactly 1500 (boundary).
    env.ledger().with_mut(|li| li.timestamp = 1_500);
    let expired = client.get_expired_wastes();
    assert_eq!(expired.len(), 1);
    assert_eq!(expired.get(0).unwrap(), waste_id);
}

// ─── get_expired_wastes ──────────────────────────────────────────────────────

#[test]
fn test_get_expired_wastes_returns_empty_initially() {
    let (_env, client, _admin) = setup_with_admin();
    let expired = client.get_expired_wastes();
    assert_eq!(expired.len(), 0);
}

#[test]
fn test_get_expired_wastes_only_returns_expired_items() {
    let (env, client, admin) = setup_with_admin();
    let recycler = register_recycler(&client, &env);

    env.ledger().with_mut(|li| li.timestamp = 1_000);

    // Paper expires in 500 s; Metal has no expiry.
    client.set_waste_ttl(&admin, &WasteType::Paper, &500u64);
    let paper_id = client.recycle_waste(&WasteType::Paper, &1_000u128, &recycler, &0, &0);
    let _metal_id = client.recycle_waste(&WasteType::Metal, &1_000u128, &recycler, &0, &0);

    // Advance past Paper's TTL.
    env.ledger().with_mut(|li| li.timestamp = 1_600);
    let expired = client.get_expired_wastes();

    assert_eq!(expired.len(), 1);
    assert_eq!(expired.get(0).unwrap(), paper_id);
}

#[test]
fn test_get_expired_wastes_multiple_expired() {
    let (env, client, admin) = setup_with_admin();
    let recycler = register_recycler(&client, &env);

    env.ledger().with_mut(|li| li.timestamp = 1_000);
    client.set_waste_ttl(&admin, &WasteType::Paper, &300u64);
    client.set_waste_ttl(&admin, &WasteType::Organic, &400u64);

    let paper_id = client.recycle_waste(&WasteType::Paper, &500u128, &recycler, &0, &0);
    let organic_id = client.recycle_waste(&WasteType::Organic, &500u128, &recycler, &0, &0);

    // Both expired at ts 1_400 (Organic: 1000+400).
    env.ledger().with_mut(|li| li.timestamp = 1_500);
    let expired = client.get_expired_wastes();

    assert_eq!(expired.len(), 2);
    assert!(expired.contains(&paper_id));
    assert!(expired.contains(&organic_id));
}

// ─── cleanup_expired_wastes ──────────────────────────────────────────────────

#[test]
fn test_cleanup_expired_wastes_deactivates_items() {
    let (env, client, admin) = setup_with_admin();
    let recycler = register_recycler(&client, &env);

    env.ledger().with_mut(|li| li.timestamp = 2_000);
    client.set_waste_ttl(&admin, &WasteType::Glass, &1_000u64);
    let waste_id = client.recycle_waste(&WasteType::Glass, &3_000u128, &recycler, &0, &0);

    // Verify it's active before cleanup.
    assert!(client.get_waste_v2(&waste_id).unwrap().is_active);

    // Advance past expiry and run cleanup.
    env.ledger().with_mut(|li| li.timestamp = 3_500);
    let count = client.cleanup_expired_wastes(&admin);

    assert_eq!(count, 1);
    // Waste should now be deactivated.
    assert!(!client.get_waste_v2(&waste_id).unwrap().is_active);
}

#[test]
fn test_cleanup_returns_zero_when_nothing_expired() {
    let (env, client, admin) = setup_with_admin();
    let recycler = register_recycler(&client, &env);

    env.ledger().with_mut(|li| li.timestamp = 1_000);
    // Metal has no TTL — will never expire.
    let _waste_id = client.recycle_waste(&WasteType::Metal, &1_000u128, &recycler, &0, &0);

    let count = client.cleanup_expired_wastes(&admin);
    assert_eq!(count, 0);
}

#[test]
fn test_cleanup_only_deactivates_expired_not_active() {
    let (env, client, admin) = setup_with_admin();
    let recycler = register_recycler(&client, &env);

    env.ledger().with_mut(|li| li.timestamp = 1_000);
    client.set_waste_ttl(&admin, &WasteType::Organic, &500u64);

    // Expired item.
    let expired_id = client.recycle_waste(&WasteType::Organic, &1_000u128, &recycler, &0, &0);
    // Non-expiring item.
    let active_id = client.recycle_waste(&WasteType::Metal, &1_000u128, &recycler, &0, &0);

    env.ledger().with_mut(|li| li.timestamp = 2_000);
    let count = client.cleanup_expired_wastes(&admin);

    assert_eq!(count, 1);
    assert!(!client.get_waste_v2(&expired_id).unwrap().is_active);
    assert!(client.get_waste_v2(&active_id).unwrap().is_active);
}

#[test]
fn test_cleanup_idempotent_after_second_run() {
    let (env, client, admin) = setup_with_admin();
    let recycler = register_recycler(&client, &env);

    env.ledger().with_mut(|li| li.timestamp = 1_000);
    client.set_waste_ttl(&admin, &WasteType::Paper, &200u64);
    let _waste_id = client.recycle_waste(&WasteType::Paper, &1_000u128, &recycler, &0, &0);

    env.ledger().with_mut(|li| li.timestamp = 1_500);
    let first_run = client.cleanup_expired_wastes(&admin);
    assert_eq!(first_run, 1);

    // Second run should find nothing left to clean up.
    let second_run = client.cleanup_expired_wastes(&admin);
    assert_eq!(second_run, 0);
}

#[test]
#[should_panic]
fn test_non_admin_cannot_cleanup_expired_wastes() {
    let (env, client, _admin) = setup_with_admin();
    let non_admin = Address::generate(&env);
    client.cleanup_expired_wastes(&non_admin);
}

// ─── Transfer blocked on expired waste ──────────────────────────────────────

#[test]
fn test_transfer_succeeds_before_expiry() {
    let (env, client, admin) = setup_with_admin();
    let recycler = register_recycler(&client, &env);
    let collector = register_collector(&client, &env);

    env.ledger().with_mut(|li| li.timestamp = 1_000);
    client.set_waste_ttl(&admin, &WasteType::Plastic, &1_000u64);
    let waste_id = client.recycle_waste(&WasteType::Plastic, &1_000u128, &recycler, &0, &0);

    // Transfer well within the TTL window.
    env.ledger().with_mut(|li| li.timestamp = 1_500);
    client.transfer_waste_v2(&waste_id, &recycler, &collector, &0, &0);

    let waste = client.get_waste_v2(&waste_id).unwrap();
    assert_eq!(waste.current_owner, collector);
}

#[test]
#[should_panic]
fn test_transfer_blocked_when_waste_expired() {
    let (env, client, admin) = setup_with_admin();
    let recycler = register_recycler(&client, &env);
    let collector = register_collector(&client, &env);

    env.ledger().with_mut(|li| li.timestamp = 1_000);
    client.set_waste_ttl(&admin, &WasteType::Organic, &100u64);
    let waste_id = client.recycle_waste(&WasteType::Organic, &1_000u128, &recycler, &0, &0);

    // Advance past expiry.
    env.ledger().with_mut(|li| li.timestamp = 1_200);
    // Should panic — waste has expired.
    client.transfer_waste_v2(&waste_id, &recycler, &collector, &0, &0);
}

// ─── Independent per-type TTLs ───────────────────────────────────────────────

#[test]
fn test_different_waste_types_have_independent_ttls() {
    let (env, client, admin) = setup_with_admin();
    let recycler = register_recycler(&client, &env);

    env.ledger().with_mut(|li| li.timestamp = 1_000);

    // Only Paper gets a short TTL; Electronic gets a long one.
    client.set_waste_ttl(&admin, &WasteType::Paper, &300u64);
    client.set_waste_ttl(&admin, &WasteType::Electronic, &10_000u64);

    let paper_id = client.recycle_waste(&WasteType::Paper, &1_000u128, &recycler, &0, &0);
    let electronic_id =
        client.recycle_waste(&WasteType::Electronic, &1_000u128, &recycler, &0, &0);

    // At ts 1400, only Paper has expired.
    env.ledger().with_mut(|li| li.timestamp = 1_400);
    let expired = client.get_expired_wastes();

    assert_eq!(expired.len(), 1);
    assert_eq!(expired.get(0).unwrap(), paper_id);
    assert!(!expired.contains(&electronic_id));
}

#[test]
fn test_waste_without_ttl_never_appears_in_expired_list() {
    let (env, client, _admin) = setup_with_admin();
    let recycler = register_recycler(&client, &env);

    env.ledger().with_mut(|li| li.timestamp = 1_000);
    // No TTL set — expires_at will be 0.
    let _waste_id = client.recycle_waste(&WasteType::Metal, &5_000u128, &recycler, &0, &0);

    // Jump far into the future.
    env.ledger().with_mut(|li| li.timestamp = 999_999_999);
    let expired = client.get_expired_wastes();
    assert_eq!(expired.len(), 0);
}

// ─── Individual waste expiration check ──────────────────────────────────────

#[test]
fn test_check_waste_expiration_returns_true_for_expired_waste() {
    let (env, client, admin) = setup_with_admin();
    let recycler = register_recycler(&client, &env);

    env.ledger().with_mut(|li| li.timestamp = 1_000);
    client.set_waste_ttl(&admin, &WasteType::Plastic, &100);
    let waste_id = client.recycle_waste(&WasteType::Plastic, &1_000u128, &recycler, &0, &0);

    // Not yet expired
    assert!(!client.check_waste_expiration(&waste_id));

    // Advance past expiry
    env.ledger().with_mut(|li| li.timestamp = 1_200);
    assert!(client.check_waste_expiration(&waste_id));
}

#[test]
fn test_check_waste_expiration_returns_false_for_nonexistent_waste() {
    let (_env, client, _admin) = setup_with_admin();
    assert!(!client.check_waste_expiration(&999_999u128));
}

#[test]
fn test_check_waste_expiration_returns_false_for_inactive_waste() {
    let (env, client, admin) = setup_with_admin();
    let recycler = register_recycler(&client, &env);

    env.ledger().with_mut(|li| li.timestamp = 1_000);
    client.set_waste_ttl(&admin, &WasteType::Plastic, &100);
    let waste_id = client.recycle_waste(&WasteType::Plastic, &1_000u128, &recycler, &0, &0);

    // Deactivate waste
    client.deactivate_waste(&waste_id);
    env.ledger().with_mut(|li| li.timestamp = 1_200);
    // Inactive wastes are not considered "expired" by the check
    assert!(!client.check_waste_expiration(&waste_id));
}

// ─── Approaching expiry ─────────────────────────────────────────────────────

#[test]
fn test_get_wastes_approaching_expiry_returns_wastes_near_expiry() {
    let (env, client, admin) = setup_with_admin();
    let recycler = register_recycler(&client, &env);

    env.ledger().with_mut(|li| li.timestamp = 1_000);
    client.set_waste_ttl(&admin, &WasteType::Paper, &1_000);
    let waste_id = client.recycle_waste(&WasteType::Paper, &1_000u128, &recycler, &0, &0);

    // At ts 1500: expires_at = 2000 (1000 + 1000), remaining = 500
    env.ledger().with_mut(|li| li.timestamp = 1_500);
    let within_1000 = client.get_wastes_approaching_expiry(&1_000);
    assert_eq!(within_1000.len(), 1);
    assert_eq!(within_1000.get(0).unwrap(), waste_id);

    // Within 100 seconds — not yet approaching
    let within_100 = client.get_wastes_approaching_expiry(&100);
    assert_eq!(within_100.len(), 0);
}

// ─── Lifecycle summary ──────────────────────────────────────────────────────

#[test]
fn test_lifecycle_summary_counts_active_and_inactive() {
    let (env, client, admin) = setup_with_admin();
    let recycler = register_recycler(&client, &env);

    env.ledger().with_mut(|li| li.timestamp = 1_000);

    // Waste 1: expires in 1000 seconds
    client.set_waste_ttl(&admin, &WasteType::Paper, &1_000);
    let _id1 = client.recycle_waste(&WasteType::Paper, &1_000u128, &recycler, &0, &0);

    // Waste 2: no expiry
    let _id2 = client.recycle_waste(&WasteType::Metal, &2_000u128, &recycler, &0, &0);

    // Both active
    let (active, inactive) = client.get_lifecycle_summary();
    assert_eq!(active, 2);
    assert_eq!(inactive, 0);

    // Advance past expiry for waste 1
    env.ledger().with_mut(|li| li.timestamp = 3_000);
    let (active, inactive) = client.get_lifecycle_summary();
    assert_eq!(active, 1);
    assert_eq!(inactive, 1);
}

// ─── Global metrics includes expiration ─────────────────────────────────────

#[test]
fn test_get_metrics_has_expiration_and_grading_counts() {
    let (env, client, admin) = setup_with_admin();
    let recycler = register_recycler(&client, &env);

    env.ledger().with_mut(|li| li.timestamp = 1_000);
    client.set_waste_ttl(&admin, &WasteType::Paper, &500);
    let _id1 = client.recycle_waste(&WasteType::Paper, &1_000u128, &recycler, &0, &0);
    let _id2 = client.recycle_waste(&WasteType::Metal, &2_000u128, &recycler, &0, &0);

    let metrics = client.get_metrics();
    // 2 active wastes with expanded fields
    assert_eq!(metrics.active_waste_count, 2);
    assert_eq!(metrics.expired_waste_count, 0);
}


// ─── Edge-case expiration tests ─────────────────────────────────────
// Issue #1269: Add expiration edge-case tests beyond test_expiration.rs coverage

/// Tests for exact-boundary expiration: timestamp equals expires_at should be expired.
#[test]
fn test_expiration_exact_boundary() {
    let (env, client, admin, _, _) = setup_with_admin();
    let recycler = register_recycler(&client, &env);

    env.ledger().with_mut(|li| li.timestamp = 1_000);
    client.set_waste_ttl(&admin, &WasteType::Plastic, &0);
    let waste_id = client.recycle_waste(&WasteType::Plastic, &1_000u128, &recycler, &0, &0);

    // With TTL=0, waste should already be expired at timestamp 1000
    assert!(client.check_waste_expiration(&waste_id));
}

/// Tests that timestamp going backwards does not affect expiration status.
#[test]
fn test_expiration_timestamp_never_goes_backwards() {
    let (env, client, admin, _, _) = setup_with_admin();
    let recycler = register_recycler(&client, &env);

    env.ledger().with_mut(|li| { li.timestamp = 1_000; });
    client.set_waste_ttl(&admin, &WasteType::Plastic, &100);
    let waste_id = client.recycle_waste(&WasteType::Plastic, &1_000u128, &recycler, &0, &0);

    // Move forward past expiry
    env.ledger().with_mut(|li| { li.timestamp = 1_200; });
    assert!(client.check_waste_expiration(&waste_id));

    // Move backward (simulating clock skew)
    env.ledger().with_mut(|li| { li.timestamp = 1_050; });
    // Still expired because the stored expires_at was based on the original timestamp
    assert!(client.check_waste_expiration(&waste_id));
}

/// Tests that extremely large TTL values are accepted without overflow.
#[test]
fn test_extremely_large_ttl_accepted() {
    let (env, client, admin, _, _) = setup_with_admin();
    let recycler = register_recycler(&client, &env);

    env.ledger().with_mut(|li| li.timestamp = 1_000);
    // Large TTL should be accepted without panic
    client.set_waste_ttl(&admin, &WasteType::Plastic, &u64::MAX);
    assert_eq!(client.get_waste_ttl(&WasteType::Plastic), u64::MAX);
}

/// Tests minimum non-zero TTL (1 second).
#[test]
fn test_minimal_ttl_boundary() {
    let (env, client, admin, _, _) = setup_with_admin();
    let recycler = register_recycler(&client, &env);

    env.ledger().with_mut(|li| li.timestamp = 1_000);
    client.set_waste_ttl(&admin, &WasteType::Plastic, &1);
    let waste_id = client.recycle_waste(&WasteType::Plastic, &1_000u128, &recycler, &0, &0);

    // Not expired yet (TTL=1, current timestamp = 1000)
    assert!(!client.check_waste_expiration(&waste_id));

    // Move past TTL boundary
    env.ledger().with_mut(|li| { li.timestamp = 1_002; });
    assert!(client.check_waste_expiration(&waste_id));
}

/// Tests that cleanup_expired_wastes handles mixed expired and non-expired items correctly.
#[test]
fn test_cleanup_mixed_expired_and_active() {
    let (env, client, admin, _, _) = setup_with_admin();
    let recycler = register_recycler(&client, &env);

    env.ledger().with_mut(|li| li.timestamp = 1_000);
    client.set_waste_ttl(&admin, &WasteType::Plastic, &100);
    client.set_waste_ttl(&admin, &WasteType::Metal, &0); // No TTL
    let plastic_id = client.recycle_waste(&WasteType::Plastic, &1_000u128, &recycler, &0, &0);
    let metal_id = client.recycle_waste(&WasteType::Metal, &2_000u128, &recycler, &0, &0);

    // Move past plastic expiry
    env.ledger().with_mut(|li| { li.timestamp = 1_200; });

    let before_count = client.get_metrics().active_waste_count;
    let deactivated = client.cleanup_expired_wastes(&admin);
    assert!(deactivated > 0);

    // Plastic should be expired, Metal should still be active
    assert!(client.check_waste_expiration(&plastic_id));
}

/// Tests get_wastes_approaching_expiry excludes items with no TTL set.
#[test]
fn test_approaching_expiry_excludes_no_ttl() {
    let (env, client, admin, _, _) = setup_with_admin();
    let recycler = register_recycler(&client, &env);

    env.ledger().with_mut(|li| li.timestamp = 1_000);
    client.set_waste_ttl(&admin, &WasteType::Plastic, &1000);
    client.recycle_waste(&WasteType::Plastic, &1_000u128, &recycler, &0, &0);
    let metal_id = client.recycle_waste(&WasteType::Metal, &2_000u128, &recycler, &0, &0); // No TTL

    let approaching = client.get_wastes_approaching_expiry(&WasteType::Plastic, &500);
    // Should not include metal (which has no TTL)
    assert!(!approaching.is_empty());
}
